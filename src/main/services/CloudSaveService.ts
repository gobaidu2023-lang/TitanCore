// 文件路径: src/services/CloudSaveService.ts
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { app, dialog, BrowserWindow, shell, ipcMain } from 'electron'
import axios from 'axios'
import { SteamDetector } from './SteamDetector'
import { ModeSwitchService } from './ModeSwitchService'
import { CoverPackService } from './CoverPackService'
import { Db } from '../db'
import { ArchiveService } from '../utils/ArchiveService'
import { Logger } from '../utils/logger'
import { WinNative } from '../utils/winNative'

const CHUNK_SIZE = 10 * 1024 * 1024 // 10MB

function getServerUrl(): string {
  return Db.get<any>('app_seed_config')?.serverUrl || ''
}

function getAuthToken(): string | null {
  return Db.getEncrypted<any>('auth_ticket')?.token || null
}

export interface SteamAccountDetail {
  steamId64: string      // 17-18位 SteamID64，供 OST Lua 账号闸精准匹配
  accountId: string      // 32位 AccountID，展示与本地重定向路径定位
  personaName: string    // 玩家个人昵称（优先展示）
  accountName: string    // 登录用户名（次级展示）
  mostRecent: boolean    // 是否当前活跃/最近登录
  timestamp: number      // 活跃时间戳
}

export class CloudSaveService {

  // ================= 路径统一入口 =================
  private static getSaveRoot(steamPath: string, accountId: string, appId: string): string {
    const accStr = String(accountId ?? '').trim()
    const appStr = String(appId ?? '').trim()
    if (!/^\d+$/.test(accStr) || !/^\d+$/.test(appStr)) {
      throw new Error(`ERR_INVALID_ACCOUNT_OR_APP_ID: invalid accountId (${accountId}) or appId (${appId})`)
    }
    return path.join(this.getCrRoot(steamPath), 'cloud_redirect', 'storage', accStr, appStr)
  }

  // TC-P13: CR 存储根解析 -- env(CR_STATE_DIR) 优先, 回落 Steam 根; 两模式共用一份, 不随切换变化
  private static getCrRoot(steamPath: string): string {
    return process.env.CR_STATE_DIR || steamPath
  }

  // TC-P13: 目录文件计数(迁移校验用)
  private static countFiles(dir: string): number {
    if (!fs.existsSync(dir)) return 0
    let n = 0
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.isDirectory()) n += this.countFiles(path.join(dir, item.name))
      else n++
    }
    return n
  }

  // 严密校验：验证源端所有文件是否已 100% 完好无损镜像拷贝至目标端（防合并场景下误报）
  private static verifySourceCopied(srcDir: string, dstDir: string): boolean {
    if (!fs.existsSync(srcDir)) return true
    for (const item of fs.readdirSync(srcDir, { withFileTypes: true })) {
      const srcSub = path.join(srcDir, item.name)
      const dstSub = path.join(dstDir, item.name)
      if (item.isDirectory()) {
        if (!fs.existsSync(dstSub)) return false
        if (!this.verifySourceCopied(srcSub, dstSub)) return false
      } else {
        if (!fs.existsSync(dstSub)) return false
        try {
          if (fs.statSync(srcSub).size !== fs.statSync(dstSub).size) return false
        } catch {
          return false
        }
      }
    }
    return true
  }

  // TC-P13: 广播环境变量变更(Explorer 新启动进程免重启生效; 主通路是 TC 自己注入 process.env)
  private static broadcastEnvChange(): void {
    try { WinNative.broadcastSettingChange() } catch { }
  }

  // TC-P13: 写用户级 CR_STATE_DIR(注册表, 写一次永久生效) + 注入本进程 + 广播
  static writeCrStateDirEnv(value: string): boolean {
    process.env.CR_STATE_DIR = value
    try {
      const ok = WinNative.regWriteString('HKCU', 'Environment', 'CR_STATE_DIR', value)
      if (!ok) {
        console.error('[CloudSaveService] 用户级环境变量 CR_STATE_DIR 写入注册表失败，已保留当前进程内存值')
        return false
      }

      // 额外对齐登记 TitanCore 软件注册表（0 风险：InstallPath 与 Path 永久保持安装根目录，同时记录 OstDir 供 C++ 探针秒级识别）
      try {
        const tcRoot = path.dirname(value)
        WinNative.regWriteString('HKCU', 'Software\\TitanCore', 'InstallPath', tcRoot)
        WinNative.regWriteString('HKCU', 'Software\\TitanCore', 'Path', tcRoot)
        WinNative.regWriteString('HKCU', 'Software\\TitanCore', 'OstDir', value)
      } catch {}

      this.broadcastEnvChange()
      console.info('[CloudSaveService] 用户级环境变量 CR_STATE_DIR 及 TitanCore 注册表项写入成功:', value)
      return true
    } catch (e: any) {
      console.error('[CloudSaveService] 用户级环境变量 CR_STATE_DIR 写入注册表失败，已保留当前进程内存值:', e?.message)
      return false
    }
  }

  // TC-P13: 启动静默自检(无弹窗) -- 已存在且值不符→重写; 不存在且无旧数据→写入; 有旧数据→兜底内存并自动安全平滑迁移
  static async ensureCrEnvAtStartup(): Promise<void> {
    try {
      const want = ModeSwitchService.ostDir
      const cur = process.env.CR_STATE_DIR
      const det = await SteamDetector.detect()
      const legacyDir = det.path ? fs.existsSync(path.join(det.path, 'cloud_redirect')) : false
      const legacyLog = det.path ? fs.existsSync(path.join(det.path, 'cloud_redirect.log')) : false
      const legacy = legacyDir || legacyLog

      // 无论环境变量是否已设置，只要检测到 Steam 根残留存量云存档/日志，且 Steam 未运行，立即自动静默安全迁移！
      if (legacy && !this.isSteamRunning()) {
        console.info('[CloudSaveService] 启动自检检测到 Steam 根残留存量旧版云存档，执行自动静默安全迁移...')
        const migRes = await this.migrateCrStorage()
        if (migRes.success) {
          console.info('[CloudSaveService] 启动自动静默迁移存量云存档成功')
        } else {
          console.warn('[CloudSaveService] 启动自动迁移存量云存档未完成:', migRes.error)
        }
      }

      if (cur === want) return
      if (cur && cur !== want) {
        const ok = this.writeCrStateDirEnv(want)
        if (!ok) console.warn('[CloudSaveService] 环境变量 CR_STATE_DIR 修正更新失败')
        return
      }
      if (!cur && !legacy) {
        const ok = this.writeCrStateDirEnv(want)
        if (!ok) console.warn('[CloudSaveService] 环境变量 CR_STATE_DIR 初始化写入失败')
        return
      }
      if (!cur && legacy) {
        // 装过旧版的机器：Steam 根有旧数据且尚未设置 env
        // 1. 本进程先强制兜底设置内存值，确保当前运行及子进程不丢变量
        process.env.CR_STATE_DIR = want
        console.warn('[CloudSaveService] 检测到 Steam 根目录下存在存量旧版云存档，已先注入当前进程内存变量兜底')
        // 2. 如果 Steam 当前未运行，则尝试自动安全平滑迁移
        if (!this.isSteamRunning()) {
          console.info('[CloudSaveService] Steam 未运行，开始对旧存量存档执行启动自动平滑迁移...')
          const migRes = await this.migrateCrStorage()
          if (migRes.success) {
            console.info('[CloudSaveService] 存量旧版云存档自动平滑迁移成功，环境变量已落位')
          } else {
            console.warn('[CloudSaveService] 自动迁移未完成，保留旧数据等待用户在系统自检中手动迁移:', migRes.error)
          }
        }
      }
    } catch (e: any) {
      console.warn('[CloudSaveService] 启动 env 自检异常:', e?.message)
    }
  }

  // TC-P13: 存量存档一次性迁移(系统自检手动触发): 关 Steam -> 整目录及日志拷贝校验 -> 成功才写 env; 删净原文件
  static async migrateCrStorage(): Promise<{ success: boolean; error?: string }> {
    try {
      const det = await SteamDetector.detect()
      const steamPath = det.path
      if (!steamPath) return { success: false, error: 'STEAM_NOT_FOUND' }
      const src = path.join(steamPath, 'cloud_redirect')
      const srcLog = path.join(steamPath, 'cloud_redirect.log')
      if (!fs.existsSync(src) && !fs.existsSync(srcLog)) return { success: false, error: 'NO_LEGACY_DATA' }
      await ModeSwitchService.ensureSteamDead()
      const ostDir = ModeSwitchService.ostDir
      fs.mkdirSync(ostDir, { recursive: true })

      if (fs.existsSync(src)) {
        const dst = path.join(ostDir, 'cloud_redirect')
        fs.cpSync(src, dst, { recursive: true })
        if (!this.verifySourceCopied(src, dst)) return { success: false, error: 'VERIFY_FAIL' }
        fs.rmSync(src, { recursive: true, force: true })
      }

      if (fs.existsSync(srcLog)) {
        const dstLog = path.join(ostDir, 'cloud_redirect.log')
        fs.copyFileSync(srcLog, dstLog)
        try { fs.unlinkSync(srcLog) } catch {}
      }

      if (!this.writeCrStateDirEnv(ostDir)) return { success: false, error: 'ENV_WRITE_FAIL' }
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'UNKNOWN' }
    }
  }

  // Steam 原生本地缓存文件路径
  private static getNativeRemoteCacheVdfPath(steamPath: string, accountId: string, appId: string): string {
    return path.join(steamPath, 'userdata', accountId, appId, 'remotecache.vdf')
  }

  // 检查 Steam 客户端是否处于运行中（原生 Win32 快照探测，无子进程创建）
  private static isSteamRunning(): boolean {
    try {
      if (process.platform === 'win32') {
        return WinNative.isProcessRunning('steam.exe')
      } else {
        const output = execSync('pgrep -x steam || true', { encoding: 'utf-8' })
        return output.trim().length > 0
      }
    } catch {
      return false
    }
  }

  // 获取当前活跃窗口（防失焦导致对话框报错）
  private static getActiveWindow(): BrowserWindow | null {
    return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
  }

  // 检查目标目录下是否存在实质存档文件（排除纯元数据文件干扰）
  private static checkHasActualSave(savePath: string): boolean {
    if (!fs.existsSync(savePath)) return false
    try {
      const entries = fs.readdirSync(savePath)
      const actualFiles = entries.filter(name => 
        !name.endsWith('.cloudredirect') && 
        name !== 'cn.dat' && 
        name !== 'meta.json' && 
        name !== 'file_tokens.dat' && 
        name !== 'root_tokens.dat' && 
		name !== 'root_token.dat'
      )
      return actualFiles.length > 0
    } catch {
      return false
    }
  }

  // 清洗 session 锁并确保 CN >= 1，彻底消灭 Steam 首次启动的黄字告警弹窗
  private static sanitizeSessionAndEnsureCn(dirPath: string): void {
    let currentCn = 1

    // 1. 处理 state.cloudredirect 中的 session 锁与 cn
    const stateFile = path.join(dirPath, 'state.cloudredirect')
    if (fs.existsSync(stateFile)) {
      try {
        const content = fs.readFileSync(stateFile, 'utf-8')
        const state = JSON.parse(content)
        if (state.session) {
          delete state.session
        }
        const parsedCn = parseInt(state.cn, 10)
        if (isNaN(parsedCn) || parsedCn <= 0) {
          state.cn = 1
        }
        currentCn = state.cn
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8')
      } catch (e) {
        console.warn('[CloudSaveService] 处理 state.cloudredirect 失败:', e)
      }
    }

    // 2. 精准操作规范主文件 cn.cloudredirect
    const cnFile = path.join(dirPath, 'cn.cloudredirect')
    try {
      let cnVal = currentCn
      if (fs.existsSync(cnFile)) {
        const val = parseInt(fs.readFileSync(cnFile, 'utf-8').trim(), 10)
        if (!isNaN(val) && val > 0) cnVal = val
      }
      if (cnVal <= 0) cnVal = 1
      fs.writeFileSync(cnFile, String(cnVal), 'utf-8')
    } catch (e) {
      console.warn('[CloudSaveService] 处理 cn.cloudredirect 失败:', e)
    }

    // 顺手清理历史废弃 cn.dat（若存在）
    const legacyCnFile = path.join(dirPath, 'cn.dat')
    if (fs.existsSync(legacyCnFile)) {
      try { fs.unlinkSync(legacyCnFile) } catch {}
    }

    // 3. 移除未决操作日志，避免残留上一台设备的会话冲突
    const pendingFile = path.join(dirPath, 'pending_ops.cloudredirect')
    if (fs.existsSync(pendingFile)) {
      try {
        fs.unlinkSync(pendingFile)
      } catch {}
    }
  }

  // ================= 账号全量结构化解析（SteamID64 + 昵称 + 活跃标记） =================
  public static getDetailedSteamAccounts(steamPath: string): SteamAccountDetail[] {
    const loginUsersPath = path.join(steamPath, 'config', 'loginusers.vdf')
    if (!fs.existsSync(loginUsersPath)) return []

    try {
      const content = fs.readFileSync(loginUsersPath, 'utf-8')
      const users: SteamAccountDetail[] = []

      const userBlockRegex = /"(\d{17,18})"\s*\{([^}]*)\}/g
      let match: RegExpExecArray | null

      while ((match = userBlockRegex.exec(content)) !== null) {
        const steamId64 = match[1]
        const blockContent = match[2]

        const personaMatch = blockContent.match(/"PersonaName"\s+"([^"]*)"/i)
        const personaName = personaMatch ? personaMatch[1] : ''

        const accountMatch = blockContent.match(/"AccountName"\s+"([^"]*)"/i)
        const accountName = accountMatch ? accountMatch[1] : ''

        const recentMatch = blockContent.match(/"MostRecent"\s+"([^"]*)"/i)
        const autoLoginMatch = blockContent.match(/"AutoLogin"\s+"([^"]*)"/i)
        const mostRecent = (recentMatch ? recentMatch[1] === '1' : false) || (autoLoginMatch ? autoLoginMatch[1] === '1' : false)

        const rememberMatch = blockContent.match(/"RememberPassword"\s+"([^"]*)"/i)
        const isRemembered = rememberMatch ? rememberMatch[1] === '1' : true
        if (!isRemembered && !mostRecent) continue

        const tsMatch = blockContent.match(/"Timestamp"\s+"([^"]*)"/i)
        const timestamp = tsMatch ? parseInt(tsMatch[1], 10) || 0 : 0

        const accountId = (BigInt(steamId64) & 0xFFFFFFFFn).toString()
        if (accountId && accountId !== '0') {
          users.push({
            steamId64,
            accountId,
            personaName: personaName || accountName || `User_${accountId}`,
            accountName,
            mostRecent,
            timestamp
          })
        }
      }

      users.sort((a, b) => {
        if (a.mostRecent && !b.mostRecent) return -1
        if (!a.mostRecent && b.mostRecent) return 1
        return b.timestamp - a.timestamp
      })

      return users
    } catch (e) {
      console.warn('[CloudSaveService] 解析 loginusers.vdf 异常:', e)
      return []
    }
  }

  // ================= 解析 Steam 原生切换列表（兼容原 scanAccounts 接口） =================
  private static getSteamLoginUsers(steamPath: string): string[] {
    return this.getDetailedSteamAccounts(steamPath).map(u => u.accountId)
  }

  // ================= TOML 功能开关层：读写 opensteamtool.toml =================
  public static getTomlCloudEnabled(steamPath: string): boolean {
    const tomlPath = ModeSwitchService.getActiveTomlPath(steamPath)
    if (!fs.existsSync(tomlPath)) return true
    try {
      const content = fs.readFileSync(tomlPath, 'utf-8')
      const cloudSection = content.match(/\[cloud\][^\[]*/i)
      if (!cloudSection) return true
      const enabledMatch = cloudSection[0].match(/enabled\s*=\s*(true|false)/i)
      return enabledMatch ? enabledMatch[1].toLowerCase() === 'true' : true
    } catch {
      return true
    }
  }

  public static setTomlCloudEnabled(steamPath: string, enabled: boolean): boolean {
    const tomlPath = ModeSwitchService.getActiveTomlPath(steamPath)
    if (!fs.existsSync(tomlPath)) return false

    try {
      let content = fs.readFileSync(tomlPath, 'utf-8')
      const cloudSectionRegex = /(\[cloud\][\s\S]*?)(?=\n\[|$)/i

      if (cloudSectionRegex.test(content)) {
        content = content.replace(cloudSectionRegex, (section) => {
          if (/enabled\s*=\s*(true|false)/i.test(section)) {
            return section.replace(/enabled\s*=\s*(true|false)/i, `enabled = ${enabled}`)
          } else {
            return `${section.trimEnd()}\nenabled = ${enabled}\n`
          }
        })
      } else {
        content = `${content.trimEnd()}\n\n[cloud]\nenabled = ${enabled}\n`
      }

      const tmpPath = tomlPath + '.tmp'
      fs.writeFileSync(tmpPath, content, 'utf-8')
      fs.renameSync(tmpPath, tomlPath)
      return true
    } catch (e) {
      console.error('[CloudSaveService] 写入 opensteamtool.toml 失败:', e)
      return false
    }
  }

  // ================= Lua 账号闸门层：读写与清理 titan_account_gate.lua =================
  public static getActiveAccountGate(steamPath: string): { enabled: boolean; ids: string[] } {
    const luaPath = path.join(ModeSwitchService.getActiveLuaDir(steamPath), 'titan_account_gate.lua')
    if (!fs.existsSync(luaPath)) return { enabled: false, ids: [] }

    try {
      const content = fs.readFileSync(luaPath, 'utf-8')
      const ids: string[] = []
      const idRegex = /"(\d{17,18})"/g
      let m: RegExpExecArray | null
      while ((m = idRegex.exec(content)) !== null) {
        ids.push(m[1])
      }
      return { enabled: true, ids }
    } catch {
      return { enabled: false, ids: [] }
    }
  }

  // =========================================================================
// 【改造意图】：修复 Windows NTFS 写入锁，增加 EPERM 降级容灾与去代理化纯数组过滤
// 解决 renameSync 被 LuaFileWatcher 占用导致的 EPERM 异常，确保落盘 100% 成功
// =========================================================================

public static setAccountGate(steamPath: string, enabled: boolean, ids: string[]): boolean {
  const luaDir = ModeSwitchService.getActiveLuaDir(steamPath)
  const luaPath = path.join(luaDir, 'titan_account_gate.lua')

  try {
    if (!enabled) {
      if (fs.existsSync(luaPath)) {
        try {
          fs.unlinkSync(luaPath)
        } catch (unlinkErr) {
          // 若被系统锁占用无法删除，写入空注释清空规则，触发 OST 热卸载
          fs.writeFileSync(luaPath, '-- Gate Disabled\n', 'utf-8')
        }
      }
      return true
    }

    if (!fs.existsSync(luaDir)) {
      fs.mkdirSync(luaDir, { recursive: true })
    }

    // 严密清洗与去重：转换为纯字符串，排除空白与非法位长
    const rawList = Array.isArray(ids) ? ids : []
    const validIds = Array.from(
      new Set(
        rawList
          .map(id => String(id || '').trim())
          .filter(id => /^\d{17,18}$/.test(id))
      )
    )

    const idLines = validIds.map(id => `        "${id}"`).join(',\n')
    const luaContent = [
      '-- TitanCore Account Gate Matrix',
      'setaccountgate({',
      '    mode = "whitelist",',
      '    ids = {',
      idLines,
      '    }',
      '})',
      ''
    ].join('\n')

    // Windows 安全原子写：带时间戳的临时文件
    const tmpPath = path.join(luaDir, `titan_account_gate.lua.${Date.now()}.tmp`)
    fs.writeFileSync(tmpPath, luaContent, 'utf-8')

    try {
      if (fs.existsSync(luaPath)) {
        fs.unlinkSync(luaPath)
      }
      fs.renameSync(tmpPath, luaPath)
    } catch (renameErr) {
      // 降级策略：若 rename 被锁拦截，执行直接流覆写，并清除临时文件
      fs.writeFileSync(luaPath, luaContent, 'utf-8')
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath) } catch {}
      }
    }

    return true
  } catch (e) {
    console.error('[CloudSaveService] 写入 titan_account_gate.lua 失败:', e)
    return false
  }
}

  // ================= 本地链：账号扫描（严格基于当前登录列表，无幽灵账号） =================
  static async scanAccounts(): Promise<string[]> {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes.path
    if (!steamPath) return []

    const loginUsers = this.getSteamLoginUsers(steamPath)
    if (loginUsers.length > 0) {
      return loginUsers
    }

    const foundAccounts = new Set<string>()
    const storageDir = path.join(this.getCrRoot(steamPath), 'cloud_redirect', 'storage')
    if (fs.existsSync(storageDir)) {
      try {
        const entries = fs.readdirSync(storageDir, { withFileTypes: true })
        for (const e of entries) {
          if (e.isDirectory() && /^\d+$/.test(e.name)) {
            foundAccounts.add(e.name)
          }
        }
      } catch {}
    }

    try {
      const cloudData = await this.listCloudSaves()
      if (cloudData?.data?.apps && Array.isArray(cloudData.data.apps)) {
        for (const item of cloudData.data.apps) {
          if (item.steam_id && /^\d+$/.test(String(item.steam_id))) {
            foundAccounts.add(String(item.steam_id))
          }
        }
      }
    } catch {}

    return Array.from(foundAccounts).sort()
  }

  // ================= 本地链：存档扫描（仅扫真实存档目录，彻底消除幽灵项） =================
  static async scanSaves(accountId: string): Promise<{ items: any[] }> {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes.path
    if (!steamPath) return { items: [] }

    const foundAppIds = new Set<string>()

    const accountDir = path.join(this.getCrRoot(steamPath), 'cloud_redirect', 'storage', accountId)
    if (fs.existsSync(accountDir)) {
      try {
        for (const entry of fs.readdirSync(accountDir, { withFileTypes: true })) {
          if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
            const savePath = this.getSaveRoot(steamPath, accountId, entry.name)
            if (this.checkHasActualSave(savePath)) {
              foundAppIds.add(entry.name)
            }
          }
        }
      } catch {}
    }

    const items: any[] = []
    for (const appId of Array.from(foundAppIds).sort()) {
      const savePath = this.getSaveRoot(steamPath, accountId, appId)
      const hasLocal = this.checkHasActualSave(savePath)
      const gameName = this.parseAcfGameName(steamPath, appId)
      const headerPath = CoverPackService.resolveSteamHeader(appId, steamPath)
      const headerImage = headerPath
        ? `titan-img://steam/steam_gate_${appId}?header=1`
        : ''

      items.push({
        appId,
        gameName: gameName || `AppID: ${appId}`,
        headerImage,
        hasLocal,
        hasCloud: false,
        cloudDate: ''
      })
    }

    return { items }
  }

  private static parseAcfGameName(steamPath: string, appId: string): string | null {
    const acfPath = path.join(steamPath, 'steamapps', `appmanifest_${appId}.acf`)
    if (fs.existsSync(acfPath)) {
      const name = this.readNameFromAcf(acfPath)
      if (name) return name
    }

    const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
    if (fs.existsSync(vdfPath)) {
      try {
        const content = fs.readFileSync(vdfPath, 'utf-8')
        const matches = content.matchAll(/"path"\s+"([^"]+)"/g)
        for (const m of matches) {
          const libPath = m[1].replace(/\\\\/g, '\\')
          const subAcf = path.join(libPath, 'steamapps', `appmanifest_${appId}.acf`)
          if (fs.existsSync(subAcf)) {
            const name = this.readNameFromAcf(subAcf)
            if (name) return name
          }
        }
      } catch {}
    }
    return null
  }

  private static readNameFromAcf(acfPath: string): string | null {
    try {
      const content = fs.readFileSync(acfPath, 'utf-8')
      const lines = content.split(/\r?\n/)
      for (const line of lines) {
        const m = line.match(/^\s*"name"\s+"([^"]+)"/)
        if (m) return m[1]
      }
      return null
    } catch {
      return null
    }
  }

  // ================= 本地链：打包（使用工作目录解耦） =================
  private static async packSaveDir(accountId: string, appId: string): Promise<string> {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes.path
    if (!steamPath) throw new Error('ERR_STEAM_PATH')

    const saveDir = this.getSaveRoot(steamPath, accountId, appId)
    if (!fs.existsSync(saveDir)) throw new Error('ERR_NO_LOCAL_SAVES')

    this.sanitizeSessionAndEnsureCn(saveDir)

    const gameName = this.parseAcfGameName(steamPath, appId) || `AppID: ${appId}`
    const metaPath = path.join(saveDir, 'meta.json')
    let metaExisted = false
    if (fs.existsSync(metaPath)) {
      metaExisted = true
    } else {
      const meta = {
        app_id: appId,
        game_name: gameName,
        steam_id: accountId,
        account_id: accountId,
        packaged_at: new Date().toISOString(),
        source_path: saveDir
      }
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8')
    }

    const tmpDir = path.join(Db.getDataRoot(), 'TitanTemp', 'cloudsave')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    const zipPath = path.join(tmpDir, `TC${appId}_${Date.now()}.zip`)
    try {
      await ArchiveService.compressDir(saveDir, zipPath)
      return zipPath
    } finally {
      if (!metaExisted) {
        try { fs.unlinkSync(metaPath) } catch {}
      }
    }
  }

  // ================= 云存档链：上传 =================
  static async uploadSave(
    accountId: string,
    appId: string,
    gameName: string
  ): Promise<{ success: boolean; msg: string }> {
    const serverUrl = getServerUrl()
    const token = getAuthToken()
    if (!serverUrl) return { success: false, msg: 'ERR_CLOUD_SERVER_NOT_CONFIGURED' }
    if (!token) return { success: false, msg: 'ERR_LOGIN_REQUIRED' }

    const zipPath = await this.packSaveDir(accountId, appId)
    const fileSize = fs.statSync(zipPath).size

    try {
      const authRes = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        {
          action: 'authorize_upload',
          steam_id: accountId,
          app_id: appId,
          file_size: fileSize,
          game_name: gameName
        },
        {
          headers: { 'X-Titan-Token': token, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      )

      const authData = authRes.data
      if (authData.code !== 200) {
        fs.unlinkSync(zipPath)
        return { success: false, msg: authData.msg || 'ERR_CLOUD_UPLOAD_AUTH' }
      }

      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
      const fd = fs.openSync(zipPath, 'r')
      try {
        for (let i = 0; i < totalChunks; i++) {
          const buffer = Buffer.alloc(CHUNK_SIZE)
          const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, i * CHUNK_SIZE)
          const chunk = buffer.subarray(0, bytesRead)

          await axios.post(`${serverUrl}/titan/cloudsave.php`, chunk, {
            headers: {
              'X-Titan-Token': token,
              'Content-Type': 'application/octet-stream',
              'X-Chunk-Index': String(i),
              'X-Total-Chunks': String(totalChunks),
              'X-App-Id': appId,
              'X-Steam-Id': accountId,
              'X-Game-Name': encodeURIComponent(gameName)
            },
            timeout: 30000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          })
        }
      } finally {
        fs.closeSync(fd)
      }

      const confirmRes = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        {
          action: 'confirm_upload',
          steam_id: accountId,
          app_id: appId,
          file_size: fileSize,
          game_name: gameName
        },
        {
          headers: { 'X-Titan-Token': token, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      )

      fs.unlinkSync(zipPath)

      if (confirmRes.data?.code === 200) {
        return { success: true, msg: 'SUCCESS_CLOUD_UPLOADED' }
      }
      return { success: false, msg: confirmRes.data?.msg || 'ERR_CLOUD_CONFIRM_FAILED' }
    } catch (e: any) {
      try { fs.unlinkSync(zipPath) } catch {}
      Logger.error('CloudSaveService', '云存档上传失败:', { accountId, appId, gameName, error: e?.message || e })
      return { success: false, msg: e.response?.data?.msg || e.message || 'ERR_NETWORK_ERROR' }
    }
  }

  // ================= 云存档链：下载恢复 =================
  static async downloadSave(
    accountId: string,
    appId: string
  ): Promise<{ success: boolean; msg: string }> {
    const serverUrl = getServerUrl()
    const token = getAuthToken()
    if (!serverUrl) return { success: false, msg: 'ERR_CLOUD_SERVER_NOT_CONFIGURED' }
    if (!token) return { success: false, msg: 'ERR_LOGIN_REQUIRED' }

    if (this.isSteamRunning()) {
      return { success: false, msg: 'ERR_STEAM_RUNNING' }
    }

    let authRes: any
    try {
      authRes = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        { action: 'authorize_download', app_id: appId },
        { headers: { 'X-Titan-Token': token, 'Content-Type': 'application/json' }, timeout: 15000 }
      )
    } catch (e: any) {
      // Round26: 透传后端业务提示（如熔断 500 的中文 msg），不再抛原始 AxiosError 穿 IPC
      return { success: false, msg: e.response?.data?.msg || e.message || 'ERR_CLOUD_AUTH_FAILED' }
    }

    const authData = authRes.data
    if (authData.code !== 200) {
      return { success: false, msg: authData.msg || 'ERR_CLOUD_URL_FAILED' }
    }

    const directUrl = authData.data?.direct_url
    if (!directUrl) {
      return { success: false, msg: 'ERR_CLOUD_FILE_GONE' }
    }

    const cloudSteamId = authData.data?.steam_id
    const targetAccountId = (cloudSteamId && /^\d+$/.test(String(cloudSteamId))) ? String(cloudSteamId) : accountId

    const tmpDir = path.join(Db.getDataRoot(), 'TitanTemp', 'cloudsave')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const stamp = Date.now()
    const zipPath = path.join(tmpDir, `restore_${appId}_${stamp}.zip`)
    const stageDir = path.join(tmpDir, `restore_${appId}_${stamp}.stage`)
    let swapDone = false
    let swapBackupDir = ''
    let saveTargetDir = ''

    try {
      const response = await axios.get(directUrl, {
        responseType: 'stream',
        timeout: 0,
        headers: { 'User-Agent': 'TitanCore/2.0' }
      })

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(zipPath)
        response.data.pipe(writer)
        writer.on('finish', resolve)
        writer.on('error', reject)
        response.data.on('error', reject)
      })

      const detectRes = await SteamDetector.detect()
      const steamPath = detectRes.path
      if (!steamPath) throw new Error('ERR_STEAM_PATH')

      const targetDir = this.getSaveRoot(steamPath, targetAccountId, appId)
      saveTargetDir = targetDir // batch61: 提升到函数级，供 catch 回滚使用
      // batch61: 先解到临时 stage 目录，解压成功后才替换目标目录——恢复失败不再清空旧档
      if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true })

      await ArchiveService.extract(zipPath, stageDir)

      fs.unlinkSync(zipPath)

      // batch61: 解压已成功——删 stage 内 meta，然后带备份地替换目标目录（若进程死在替换中途，旧档躺在 <目标>.bak61，手动改名回去即恢复）
      const metaInStage = path.join(stageDir, 'meta.json')
      if (fs.existsSync(metaInStage)) {
        try { fs.unlinkSync(metaInStage) } catch {}
      }
      fs.mkdirSync(path.dirname(targetDir), { recursive: true })
      swapBackupDir = `${targetDir}.bak61`
      if (fs.existsSync(swapBackupDir)) fs.rmSync(swapBackupDir, { recursive: true, force: true })
      if (fs.existsSync(targetDir)) fs.renameSync(targetDir, swapBackupDir)
      try {
        fs.cpSync(stageDir, targetDir, { recursive: true })
        swapDone = true
      } catch (swapErr) {
        // 拷贝中断：旧档还在备份里，立即回滚，绝不留下空窗
        try { fs.rmSync(targetDir, { recursive: true, force: true }) } catch {}
        try { fs.renameSync(swapBackupDir, targetDir) } catch {}
        throw swapErr
      }
      fs.rmSync(stageDir, { recursive: true, force: true })
      fs.rmSync(swapBackupDir, { recursive: true, force: true })

      this.sanitizeSessionAndEnsureCn(targetDir)

      const nativeRemoteCache = this.getNativeRemoteCacheVdfPath(steamPath, targetAccountId, appId)
      if (fs.existsSync(nativeRemoteCache)) {
        try { fs.unlinkSync(nativeRemoteCache) } catch {}
      }

      if (targetAccountId !== accountId) return { success: true, msg: `SUCCESS_CLOUD_RESTORED_ALIGNED:${targetAccountId}` }
      return { success: true, msg: 'SUCCESS_CLOUD_RESTORED' }
    } catch (e: any) {
      try { fs.unlinkSync(zipPath) } catch {}
      // batch61: 若替换中断（swapDone=false），把 .bak61 里的旧档还原回去
      try {
        if (!swapDone && swapBackupDir && fs.existsSync(swapBackupDir)) {
          try { fs.rmSync(saveTargetDir, { recursive: true, force: true }) } catch {}
          try { fs.renameSync(swapBackupDir, saveTargetDir) } catch {}
        }
      } catch {}
      try { if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true }) } catch {}
      Logger.error('CloudSaveService', '云存档下载恢复失败:', { accountId, appId, error: e?.message || e })
      return { success: false, msg: e.message || 'ERR_CLOUD_RESTORE_FAILED' }
    }
  }

  // ================= 本地链：手动打包 =================
  static async manualPack(accountId: string, appId: string): Promise<{ success: boolean; path?: string; msg?: string }> {
    const zipPath = await this.packSaveDir(accountId, appId)

    const win = this.getActiveWindow()
    if (!win) {
      try { fs.unlinkSync(zipPath) } catch {}
      return { success: false, msg: 'ERR_NO_WINDOW' }
    }

    try {
      const { filePath } = await dialog.showSaveDialog(win, {
        title: '保存存档备份',
        defaultPath: `TC-${appId}-local.zip`,
        filters: [{ name: 'ZIP 存档', extensions: ['zip'] }]
      })

      if (!filePath) {
        return { success: false, msg: 'ERR_CANCELLED' }
      }

      fs.copyFileSync(zipPath, filePath)

      Db.set(`last_export_file_${appId}`, filePath)
      Db.set('last_export_dir', path.dirname(filePath))

      return { success: true, path: filePath }
    } finally {
      if (fs.existsSync(zipPath)) {
        try { fs.unlinkSync(zipPath) } catch {}
      }
    }
  }

  // ================= 本地链：手动恢复 =================
  static async manualRestore(accountId: string, appId: string): Promise<{ success: boolean; msg: string }> {
    const win = this.getActiveWindow()
    if (!win) return { success: false, msg: 'ERR_NO_WINDOW' }

    if (this.isSteamRunning()) {
      return { success: false, msg: 'ERR_STEAM_RUNNING' }
    }

    const { filePaths } = await dialog.showOpenDialog(win, {
      title: '选择存档备份文件',
      filters: [{ name: 'ZIP 存档', extensions: ['zip'] }],
      properties: ['openFile']
    })

    if (!filePaths || filePaths.length === 0) return { success: false, msg: 'ERR_CANCELLED' }

    const zipPath = filePaths[0]
    const tmpDir = path.join(Db.getDataRoot(), 'TitanTemp', 'cloudsave', `restore_${appId}_${Date.now()}`)
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })

    try {
      await ArchiveService.extract(zipPath, tmpDir)

      const metaPath = path.join(tmpDir, 'meta.json')
      let meta: any = {}
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        } catch {}
      }

      const metaAppId = String(meta.app_id || appId || '')
      const metaAccountId = String(meta.account_id || meta.steam_id || '')
      const gameName = meta.game_name || `AppID: ${metaAppId || appId}`

      if (meta.app_id && String(meta.app_id) !== appId) {
        throw new Error(`ERR_SAVE_MISMATCH:${meta.app_id}`)
      }

      const targetAccountId = (metaAccountId && /^\d+$/.test(metaAccountId)) ? metaAccountId : accountId
      const isDiffAccount = targetAccountId !== accountId

      const detectRes = await SteamDetector.detect()
      const steamPath = detectRes.path
      if (!steamPath) throw new Error('ERR_STEAM_PATH')

      const targetDir = this.getSaveRoot(steamPath, targetAccountId, appId)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      } else {
        const subEntries = fs.readdirSync(targetDir)
        for (const sub of subEntries) {
          fs.rmSync(path.join(targetDir, sub), { recursive: true, force: true })
        }
      }

      const entries = fs.readdirSync(tmpDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name === 'meta.json') continue
        const src = path.join(tmpDir, entry.name)
        const dest = path.join(targetDir, entry.name)
        if (entry.isDirectory()) {
          this.copyDir(src, dest)
        } else {
          fs.copyFileSync(src, dest)
        }
      }

      this.sanitizeSessionAndEnsureCn(targetDir)

      const nativeRemoteCache = this.getNativeRemoteCacheVdfPath(steamPath, targetAccountId, appId)
      if (fs.existsSync(nativeRemoteCache)) {
        try { fs.unlinkSync(nativeRemoteCache) } catch {}
      }

      if (isDiffAccount) return { success: true, msg: `SUCCESS_CLOUD_RESTORED_ALIGNED_LOCAL:${targetAccountId}` }
      return { success: true, msg: 'SUCCESS_CLOUD_RESTORED_LOCAL' }
    } catch (e: any) {
      return { success: false, msg: e.message || 'ERR_CLOUD_RESTORE_FAILED' }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    }
  }

  // ================= 本地链：打开备份文件/目录 =================
  static async openLocalSaveFolder(
    accountId: string,
    appId: string,
    options?: { forceUnderlying?: boolean }
  ): Promise<{ success: boolean; notFound?: boolean; msg?: string }> {
    if (options?.forceUnderlying) {
      const detectRes = await SteamDetector.detect()
      const steamPath = detectRes.path
      if (!steamPath) return { success: false, msg: 'ERR_STEAM_PATH' }

      const targetDir = this.getSaveRoot(steamPath, accountId, appId)
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true })
      }

      const err = await shell.openPath(targetDir)
      if (err) return { success: false, msg: err }
      return { success: true, msg: 'SUCCESS_OPENED_REDIRECT_DIR' }
    }

    const lastExportFile = Db.get<string>(`last_export_file_${appId}`)
    if (lastExportFile && fs.existsSync(lastExportFile)) {
      shell.showItemInFolder(lastExportFile)
      return { success: true, msg: 'SUCCESS_LOCATED_BACKUP' }
    }

    const lastExportDir = Db.get<string>('last_export_dir')
    if (lastExportDir && fs.existsSync(lastExportDir)) {
      const err = await shell.openPath(lastExportDir)
      if (err) return { success: false, msg: err }
      return { success: true, msg: 'SUCCESS_OPENED_BACKUP_DIR' }
    }

    return { success: false, notFound: true, msg: 'ERR_NO_LOCAL_BACKUP' }
  }

  // ================= 云存档链：删除 =================
  static async deleteSave(appId: string): Promise<{ success: boolean; msg: string }> {
    const serverUrl = getServerUrl()
    const token = getAuthToken()
    if (!serverUrl) return { success: false, msg: 'ERR_CLOUD_SERVER_NOT_CONFIGURED' }
    if (!token) return { success: false, msg: 'ERR_LOGIN_REQUIRED' }

    try {
      const res = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        { action: 'delete', app_id: appId },
        { headers: { 'X-Titan-Token': token, 'Content-Type': 'application/json' }, timeout: 15000 }
      )
      if (res.data?.code === 200) {
        return { success: true, msg: 'SUCCESS_CLOUD_DELETED' }
      }
      return { success: false, msg: res.data?.msg || 'ERR_CLOUD_DELETE_FAILED' }
    } catch (e: any) {
      return { success: false, msg: e.response?.data?.msg || e.message || 'ERR_NETWORK_ERROR' }
    }
  }

  // ================= 云存档链：列表 =================
  static async listCloudSaves(): Promise<any> {
    const serverUrl = getServerUrl()
    const token = getAuthToken()
    if (!serverUrl || !token) return { apps: [], quota: {} }

    const res = await axios.post(
      `${serverUrl}/titan/cloudsave.php`,
      { action: 'list' },
      { headers: { 'X-Titan-Token': token, 'Content-Type': 'application/json' }, timeout: 15000 }
    )
    return res.data
  }

  // ================= 工具方法 =================
  private static copyDir(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name)
      const d = path.join(dest, entry.name)
      if (entry.isDirectory()) this.copyDir(s, d)
      else fs.copyFileSync(s, d)
    }
  }
}

export function registerCloudSaveService() {
  ipcMain.removeHandler('cloudsave:scan-accounts')
  ipcMain.handle('cloudsave:scan-accounts', async () => {
    const accounts = await CloudSaveService.scanAccounts()
    return { accounts }
  })

  ipcMain.removeHandler('cloudsave:scan-saves')
  ipcMain.handle('cloudsave:scan-saves', async (_e, accountId: string) => {
    return await CloudSaveService.scanSaves(accountId)
  })

  ipcMain.removeHandler('cloudsave:upload')
  ipcMain.handle('cloudsave:upload', async (_e, accountId: string, appId: string, gameName: string) => {
    return await CloudSaveService.uploadSave(accountId, appId, gameName)
  })

  ipcMain.removeHandler('cloudsave:download')
  ipcMain.handle('cloudsave:download', async (_e, accountId: string, appId: string) => {
    return await CloudSaveService.downloadSave(accountId, appId)
  })

  ipcMain.removeHandler('cloudsave:manual-pack')
  ipcMain.handle('cloudsave:manual-pack', async (_e, accountId: string, appId: string) => {
    return await CloudSaveService.manualPack(accountId, appId)
  })

  ipcMain.removeHandler('cloudsave:manual-restore')
  ipcMain.handle('cloudsave:manual-restore', async (_e, accountId: string, appId: string) => {
    return await CloudSaveService.manualRestore(accountId, appId)
  })

  ipcMain.removeHandler('cloudsave:open-local-folder')
  ipcMain.handle('cloudsave:open-local-folder', async (_e, accountId: string, appId: string) => {
    return await CloudSaveService.openLocalSaveFolder(accountId, appId)
  })

  ipcMain.removeHandler('cloudsave:delete')
  ipcMain.handle('cloudsave:delete', async (_e, appId: string) => {
    return await CloudSaveService.deleteSave(appId)
  })

  ipcMain.removeHandler('cloudsave:list')
  ipcMain.handle('cloudsave:list', async () => {
    return await CloudSaveService.listCloudSaves()
  })

  ipcMain.removeHandler('cloudsave:migrate-cr')
  ipcMain.handle('cloudsave:migrate-cr', async () => CloudSaveService.migrateCrStorage())
}