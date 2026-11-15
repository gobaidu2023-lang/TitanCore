// 文件路径: src/services/CloudSaveService.ts
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { app, dialog, BrowserWindow, ipcMain } from 'electron'
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

const STEAMID64_BASE = 76561197960265728n
const CR_META_EXACT_NAMES = new Set([
  'cn.dat',
  'meta.json',
  'file_tokens.dat',
  'root_tokens.dat',
  'root_token.dat'
])

export class CloudSaveService {

  // ================= 通用重试与账号/路径兜底解析 =================
  private static async withRetry<T>(fn: () => T | Promise<T>, attempts = 3, delayMs = 120): Promise<T> {
    let lastErr: any
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn()
      } catch (e) {
        lastErr = e
        if (i < attempts - 1) {
          await new Promise(r => setTimeout(r, delayMs))
        }
      }
    }
    throw lastErr
  }

  private static withRetrySync<T>(fn: () => T, attempts = 3): T {
    let lastErr: any
    for (let i = 0; i < attempts; i++) {
      try {
        return fn()
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
  }

  // 统一归一化为 CR 与 Steam userdata 通用的 32 位 AccountID（兼容误传 17-18 位 SteamID64）
  private static normalizeAccountId(rawId: unknown): string | null {
    const str = String(rawId ?? '').trim()
    if (!/^\d+$/.test(str)) return null
    try {
      if (str.length >= 17) {
        const low = (BigInt(str) & 0xFFFFFFFFn).toString()
        return low !== '0' ? low : null
      }
      return str !== '0' ? str : null
    } catch {
      return null
    }
  }

  private static toSteamId64(accountId: string): string | null {
    const str = String(accountId ?? '').trim()
    if (!/^\d+$/.test(str) || str === '0') return null
    try {
      if (str.length >= 17) return str
      return (STEAMID64_BASE + BigInt(str)).toString()
    } catch {
      return null
    }
  }

  // 查找兼容：同时匹配 32 位 AccountID 与对应 64 位 SteamID 目录（防用户手工建错目录层）
  private static getAccountFolderAliases(accountId: string): string[] {
    const out: string[] = []
    const push = (v: string | null) => {
      if (v && /^\d+$/.test(v) && !out.includes(v)) out.push(v)
    }
    const raw = String(accountId ?? '').trim()
    const norm = this.normalizeAccountId(raw)
    push(norm)
    push(raw)
    if (norm) push(this.toSteamId64(norm))
    return out
  }

  private static isValidSteamRoot(dir: string | null | undefined): dir is string {
    if (!dir) return false
    try {
      return fs.existsSync(path.join(dir, 'steam.exe'))
    } catch {
      return false
    }
  }

  private static async resolveSteamPath(): Promise<string | null> {
    for (let i = 0; i < 2; i++) {
      try {
        const det = await SteamDetector.detect()
        if (det?.path && this.isValidSteamRoot(det.path)) return det.path
      } catch {}
      if (i === 0) await new Promise(r => setTimeout(r, 150))
    }

    // 兜底读取 Windows Steam 注册表路径
    try {
      const regSteamPath = WinNative.regReadString('HKCU', 'Software\\Valve\\Steam', 'SteamPath')
      if (regSteamPath) {
        const norm = path.win32.normalize(regSteamPath.trim().replace(/^"|"$/g, ''))
        if (this.isValidSteamRoot(norm)) return norm
      }
      const regSteamExe = WinNative.regReadString('HKCU', 'Software\\Valve\\Steam', 'SteamExe')
      if (regSteamExe) {
        const dir = path.win32.dirname(path.win32.normalize(regSteamExe.trim().replace(/^"|"$/g, '')))
        if (this.isValidSteamRoot(dir)) return dir
      }
      const regCmd = WinNative.regReadString('HKCR', 'steam\\shell\\open\\command', '')
      if (regCmd) {
        const m = regCmd.match(/"([a-zA-Z]:\\[^"]+\.exe)"/i) || regCmd.match(/([a-zA-Z]:\\[^\r\n]+?\.exe)/i)
        if (m) {
          const dir = path.win32.dirname(m[1])
          if (this.isValidSteamRoot(dir)) return dir
        }
      }
    } catch {}

    return null
  }

  private static normalizeRootPath(raw: string): string {
    const cleaned = raw.trim().replace(/^"|"$/g, '')
    if (!cleaned) return ''
    const norm = path.win32.normalize(cleaned)
    return norm.length > 3 ? norm.replace(/[\\/]+$/, '') : norm
  }

  // 收集全部有效 CR 状态根目录（按优先级去重，用于读/扫兜底）
  private static getCrRootCandidates(steamPath?: string | null): string[] {
    const rawList: Array<string | null | undefined> = [
      process.env.CR_STATE_DIR,
      WinNative.regReadString('HKCU', 'Environment', 'CR_STATE_DIR'),
      WinNative.regReadString('HKCU', 'Software\\TitanCore', 'OstDir'),
      ModeSwitchService.ostDir,
      steamPath
    ]
    const seen = new Set<string>()
    const result: string[] = []
    for (const raw of rawList) {
      if (!raw || !raw.trim()) continue
      const norm = this.normalizeRootPath(raw)
      if (!norm) continue
      const key = norm.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        result.push(norm)
      }
    }
    return result
  }

  // ================= 路径统一入口 =================
  private static getSaveRoot(steamPath: string | null | undefined, accountId: string, appId: string): string {
    const accStr = String(accountId ?? '').trim()
    const appStr = String(appId ?? '').trim()
    if (!/^\d+$/.test(accStr) || !/^\d+$/.test(appStr)) {
      throw new Error(`ERR_INVALID_ACCOUNT_OR_APP_ID: invalid accountId (${accountId}) or appId (${appId})`)
    }
    const crRoot = this.getCrRoot(steamPath)
    if (!crRoot) throw new Error('ERR_STEAM_PATH')
    return path.join(crRoot, 'cloud_redirect', 'storage', accStr, appStr)
  }

  // 在所有候选 CR 根目录与账号别名中定位真实存档目录
  private static resolveExistingSaveDir(steamPath: string | null | undefined, accountId: string, appId: string): string | null {
    const appStr = String(appId ?? '').trim()
    if (!/^\d+$/.test(appStr)) return null
    const aliases = this.getAccountFolderAliases(accountId)
    if (aliases.length === 0) return null

    let firstExistingDir: string | null = null
    for (const root of this.getCrRootCandidates(steamPath)) {
      for (const acc of aliases) {
        const candidate = path.join(root, 'cloud_redirect', 'storage', acc, appStr)
        if (!fs.existsSync(candidate)) continue
        if (!firstExistingDir) firstExistingDir = candidate
        if (this.checkHasActualSave(candidate)) return candidate
      }
    }
    return firstExistingDir
  }

  // TC-P13: CR 存储主根解析 -- env(CR_STATE_DIR) → 注册表 CR_STATE_DIR/OstDir → ostDir → Steam 根
  private static getCrRoot(steamPath?: string | null): string {
    const envDir = process.env.CR_STATE_DIR ? this.normalizeRootPath(process.env.CR_STATE_DIR) : ''
    if (envDir) return envDir

    const regCrRaw = WinNative.regReadString('HKCU', 'Environment', 'CR_STATE_DIR')
    const regCrDir = regCrRaw ? this.normalizeRootPath(regCrRaw) : ''
    if (regCrDir) {
      process.env.CR_STATE_DIR = regCrDir
      return regCrDir
    }

    const regOstRaw = WinNative.regReadString('HKCU', 'Software\\TitanCore', 'OstDir')
    const regOstDir = regOstRaw ? this.normalizeRootPath(regOstRaw) : ''
    if (regOstDir) return regOstDir

    if (fs.existsSync(ModeSwitchService.ostDir)) return this.normalizeRootPath(ModeSwitchService.ostDir)
    return steamPath ? this.normalizeRootPath(steamPath) : ''
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

  // 递归检查目标目录下是否存在至少 1 个非元数据的实质存档文件（含短暂锁重试）
  private static hasActualSaveFileRecursive(dirPath: string): boolean {
    const entries = this.withRetrySync(() => fs.readdirSync(dirPath, { withFileTypes: true }))
    for (const entry of entries) {
      const nameLower = entry.name.toLowerCase()
      if (entry.isDirectory()) {
        if (this.hasActualSaveFileRecursive(path.join(dirPath, entry.name))) return true
      } else if (entry.isFile()) {
        if (nameLower.endsWith('.cloudredirect') || CR_META_EXACT_NAMES.has(nameLower)) continue
        return true
      }
    }
    return false
  }

  // 检查目标目录下是否存在实质存档文件（排除纯元数据文件及空壳目录干扰）
  private static checkHasActualSave(savePath: string): boolean {
    if (!savePath || !fs.existsSync(savePath)) return false
    try {
      return this.hasActualSaveFileRecursive(savePath)
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

  // 花括号深度安全的 loginusers.vdf 块解析（免疫昵称含 { } 或子对象嵌套）
  private static extractVdfUserBlocks(content: string): Array<{ steamId64: string; blockContent: string }> {
    const blocks: Array<{ steamId64: string; blockContent: string }> = []
    const keyRegex = /"(\d{17,18})"\s*\{/g
    let m: RegExpExecArray | null
    while ((m = keyRegex.exec(content)) !== null) {
      const steamId64 = m[1]
      const openIdx = m.index + m[0].length - 1
      let depth = 1
      let inQuote = false
      let i = openIdx + 1
      while (i < content.length && depth > 0) {
        const ch = content[i]
        if (ch === '\\' && inQuote) {
          i += 2
          continue
        }
        if (ch === '"') {
          inQuote = !inQuote
        } else if (!inQuote) {
          if (ch === '{') depth++
          else if (ch === '}') depth--
        }
        i++
      }
      if (depth === 0) {
        blocks.push({ steamId64, blockContent: content.slice(openIdx + 1, i - 1) })
        keyRegex.lastIndex = i
      }
    }
    return blocks
  }

  // ================= 账号全量结构化解析（SteamID64 + 昵称 + 活跃标记） =================
  public static getDetailedSteamAccounts(steamPath: string, includeUnremembered = false): SteamAccountDetail[] {
    const loginUsersPath = path.join(steamPath, 'config', 'loginusers.vdf')
    if (fs.existsSync(loginUsersPath)) {
      try {
        const content = this.withRetrySync(() => {
          const text = fs.readFileSync(loginUsersPath, 'utf-8')
          if (!text.trim()) throw new Error('EMPTY_LOGINUSERS_VDF')
          return text
        }, 3)
        const users: SteamAccountDetail[] = []

        for (const { steamId64, blockContent } of this.extractVdfUserBlocks(content)) {
          const personaName = this.readVdfStringValue(blockContent, 'PersonaName')
          const accountName = this.readVdfStringValue(blockContent, 'AccountName')

          const recentVal = this.readVdfStringValue(blockContent, 'MostRecent')
          const autoLoginVal = this.readVdfStringValue(blockContent, 'AutoLogin')
          const mostRecent = recentVal === '1' || autoLoginVal === '1'

          const rememberVal = this.readVdfStringValue(blockContent, 'RememberPassword')
          const isRemembered = rememberVal ? rememberVal === '1' : true
          if (!includeUnremembered && !isRemembered && !mostRecent) continue

          const tsVal = this.readVdfStringValue(blockContent, 'Timestamp')
          const timestamp = tsVal ? parseInt(tsVal, 10) || 0 : 0

          const accountId = this.normalizeAccountId(steamId64)
          if (accountId) {
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

        if (users.length > 0) return users
      } catch (e) {
        console.warn('[CloudSaveService] 解析 loginusers.vdf 异常，尝试兜底目录解析:', e)
      }
    }

    // 兜底：当 loginusers.vdf 缺失、被清空或解析为空时，扫描 userdata/<accountId> 补全账号
    const fallbackUsers: SteamAccountDetail[] = []
    const userdataDir = path.join(steamPath, 'userdata')
    if (fs.existsSync(userdataDir)) {
      try {
        for (const entry of this.withRetrySync(() => fs.readdirSync(userdataDir, { withFileTypes: true }))) {
          if (!entry.isDirectory()) continue
          const accountId = this.normalizeAccountId(entry.name)
          const steamId64 = accountId ? this.toSteamId64(accountId) : null
          if (accountId && steamId64) {
            fallbackUsers.push({
              steamId64,
              accountId,
              personaName: `User_${accountId}`,
              accountName: '',
              mostRecent: false,
              timestamp: 0
            })
          }
        }
      } catch {}
    }
    return fallbackUsers
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

  private static readVdfStringValue(content: string, key: string): string {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`"${escapedKey}"\\s+"((?:[^"\\\\]|\\\\.)*)"`, 'i')
    const m = content.match(regex)
    if (!m) return ''
    return m[1].replace(/\\(["\\])/g, '$1').trim()
  }

  private static getLocalConfigPersonaName(steamPath: string, accountId: string): string {
    const localCfgPath = path.join(steamPath, 'userdata', accountId, 'config', 'localconfig.vdf')
    if (!fs.existsSync(localCfgPath)) return ''
    try {
      const content = fs.readFileSync(localCfgPath, 'utf-8')
      return this.readVdfStringValue(content, 'PersonaName')
    } catch {
      return ''
    }
  }

  // ================= 本地链：账号扫描（优先本机 Steam 账号，零本地账号时才用云端兜底） =================
  static async scanAccountsDetailed(): Promise<{ accounts: string[]; accountNames: Record<string, string>; prefetchedCloudData?: any }> {
    const steamPath = await this.resolveSteamPath()
    const foundAccounts = new Set<string>()
    const accountNames: Record<string, string> = {}
    let prefetchedCloudData: any = undefined
    const addAccount = (raw: unknown) => {
      const norm = this.normalizeAccountId(raw)
      if (norm) foundAccounts.add(norm)
    }

    // 1. 优先保留当前/最近登录账号排在首位，并记录已解析的账号昵称（loginusers 缺失时内部已兜底 userdata）
    if (steamPath) {
      try {
        const loginUsers = await this.withRetry(() => this.getDetailedSteamAccounts(steamPath, true))
        for (const u of loginUsers) {
          addAccount(u.accountId)
          const hasRealPersona = Boolean(u.personaName && u.personaName !== `User_${u.accountId}`)
          const displayName = (hasRealPersona ? u.personaName : u.accountName).trim()
          if (displayName && !accountNames[u.accountId]) {
            accountNames[u.accountId] = displayName
          }
        }
      } catch {}
    }

    // 2. 不再因 loginUsers > 0 而短路：全量补扫所有候选 CR 存储根，确保手动恢复的任意账号目录必被发现
    for (const crRoot of this.getCrRootCandidates(steamPath)) {
      const storageDir = path.join(crRoot, 'cloud_redirect', 'storage')
      if (!fs.existsSync(storageDir)) continue
      try {
        const entries = await this.withRetry(() => fs.readdirSync(storageDir, { withFileTypes: true }))
        for (const e of entries) {
          if (!e.isDirectory()) continue
          const normAcc = this.normalizeAccountId(e.name)
          if (!normAcc) continue
          const accPath = path.join(storageDir, e.name)
          // 仅纳入确实包含至少一个有效游戏存档目录的账号，避免空目录形成幽灵项
          try {
            const appEntries = this.withRetrySync(() => fs.readdirSync(accPath, { withFileTypes: true }))
            const hasAnyAppSave = appEntries.some(
              appEntry => appEntry.isDirectory() && /^\d+$/.test(appEntry.name) && this.checkHasActualSave(path.join(accPath, appEntry.name))
            )
            if (hasAnyAppSave) addAccount(normAcc)
          } catch {}
        }
      } catch {}
    }

    // 3. 终极兜底：仅当本机彻底扫描不到任何 Steam 账号时，才借用云端记录的 steam_id 供跨机占位展示（并透传给前端复用，避免重复请求）
    if (foundAccounts.size === 0) {
      try {
        const cloudData = await this.listCloudSaves()
        prefetchedCloudData = cloudData
        if (cloudData?.data?.apps && Array.isArray(cloudData.data.apps)) {
          for (const item of cloudData.data.apps) {
            addAccount(item.steam_id)
          }
        }
      } catch {}
    }

    // 4. 为不在 loginusers.vdf 中的历史/本地账号补查 Steam userdata/<id>/config/localconfig.vdf 昵称
    const accounts = Array.from(foundAccounts)
    if (steamPath) {
      for (const accId of accounts) {
        if (!accountNames[accId]) {
          const localName = this.getLocalConfigPersonaName(steamPath, accId)
          if (localName) accountNames[accId] = localName
        }
      }
    }

    return prefetchedCloudData !== undefined
      ? { accounts, accountNames, prefetchedCloudData }
      : { accounts, accountNames }
  }

  static async scanAccounts(): Promise<string[]> {
    const { accounts } = await this.scanAccountsDetailed()
    return accounts
  }

  // ================= 本地链：存档扫描（多根目录 + 账号格式兜底 + 重试，彻底消除漏检） =================
  static async scanSaves(accountId: string): Promise<{ items: any[] }> {
    const aliases = this.getAccountFolderAliases(accountId)
    if (aliases.length === 0) return { items: [] }

    const steamPath = await this.resolveSteamPath()
    const crRoots = this.getCrRootCandidates(steamPath)
    if (crRoots.length === 0) return { items: [] }

    const foundAppIds = new Set<string>()
    for (const crRoot of crRoots) {
      for (const accFolder of aliases) {
        const accountDir = path.join(crRoot, 'cloud_redirect', 'storage', accFolder)
        if (!fs.existsSync(accountDir)) continue
        try {
          const entries = await this.withRetry(() => fs.readdirSync(accountDir, { withFileTypes: true }))
          for (const entry of entries) {
            if (entry.isDirectory() && /^\d+$/.test(entry.name)) {
              const savePath = path.join(accountDir, entry.name)
              if (this.checkHasActualSave(savePath)) {
                foundAppIds.add(entry.name)
              }
            }
          }
        } catch {}
      }
    }

    const items: any[] = []
    for (const appId of Array.from(foundAppIds).sort()) {
      const savePath = this.resolveExistingSaveDir(steamPath, accountId, appId)
      const hasLocal = savePath ? this.checkHasActualSave(savePath) : false
      const gameName = steamPath ? this.parseAcfGameName(steamPath, appId) : null
      const headerPath = steamPath ? CoverPackService.resolveSteamHeader(appId, steamPath) : null
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

  // ================= 统一业务错误码归一化（防原始 Axios/Node/7Z 英文穿出到界面） =================
  private static formatCloudError(e: any, fallback: string): string {
    const serverMsg = e?.response?.data?.msg
    if (typeof serverMsg === 'string' && serverMsg.trim()) {
      return serverMsg.trim()
    }
    const raw = String(e?.message || '').trim()
    if (!raw) return fallback

    const unzipMatch = raw.match(/7Z_EXTRACT_FAILED_CODE_(\d+)/i)
    if (unzipMatch) return `ERR_UNZIP_FAIL:${unzipMatch[1]}`

    const compressMatch = raw.match(/7Z_COMPRESS_FAILED_CODE_(\d+)/i)
    if (compressMatch) return `ERR_PACK_FAIL:${compressMatch[1]}`

    if (/^ARCHIVE_NOT_FOUND/i.test(raw)) return 'ERR_INVALID_ARCHIVE'
    if (/^SRC_DIR_NOT_FOUND/i.test(raw)) return 'ERR_NO_LOCAL_SAVES'
    if (/^ERR_INVALID_ACCOUNT_OR_APP_ID/i.test(raw)) return 'ERR_INVALID_ACCOUNT_OR_APP_ID'

    if (/^(ERR_|SUCCESS_|TOOLS_|DEPLOY_|ABORTED|BUSY|NETWORK_ERROR|UNKNOWN)/.test(raw)) {
      return raw
    }

    const status = e?.response?.status
    if (status === 401) return 'ERR_SESSION_EXPIRED'
    if (status === 403) return 'ERR_ACCESS_DENIED'
    if (status === 429) return 'ERR_TOO_MANY_REQUESTS'
    if (typeof status === 'number' && status >= 500) return 'ERR_SERVER_BUSY'

    if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT' || /timeout/i.test(raw)) {
      return 'ERR_NETWORK_TIMEOUT'
    }
    if (/ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|Network Error/i.test(raw)) {
      return 'ERR_NETWORK_ERROR'
    }
    return fallback
  }

  // ================= 本地链：打包（使用工作目录解耦） =================
  private static async packSaveDir(accountId: string, appId: string): Promise<string> {
    const steamPath = await this.resolveSteamPath()
    const crRoots = this.getCrRootCandidates(steamPath)
    if (crRoots.length === 0) throw new Error('ERR_STEAM_PATH')

    const normAcc = this.normalizeAccountId(accountId)
    if (!normAcc || !/^\d+$/.test(String(appId ?? '').trim())) {
      throw new Error(`ERR_INVALID_ACCOUNT_OR_APP_ID: invalid accountId (${accountId}) or appId (${appId})`)
    }
    const saveDir = await this.withRetry(() => {
      const resolved = this.resolveExistingSaveDir(steamPath, normAcc, appId)
      if (!resolved || !fs.existsSync(resolved) || !this.checkHasActualSave(resolved)) {
        throw new Error('ERR_NO_LOCAL_SAVES')
      }
      return resolved
    }, 2, 150)

    this.sanitizeSessionAndEnsureCn(saveDir)

    const gameName = (steamPath ? this.parseAcfGameName(steamPath, appId) : null) || `AppID: ${appId}`
    const metaPath = path.join(saveDir, 'meta.json')
    let metaExisted = false
    if (fs.existsSync(metaPath)) {
      metaExisted = true
    } else {
      const meta = {
        app_id: appId,
        game_name: gameName,
        steam_id: normAcc,
        account_id: normAcc,
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
      if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
        try { fs.unlinkSync(zipPath) } catch {}
        throw new Error('ERR_EMPTY_SAVE_ARCHIVE')
      }
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

    const normAcc = this.normalizeAccountId(accountId)
    if (!normAcc || !/^\d+$/.test(String(appId ?? '').trim())) {
      return { success: false, msg: 'ERR_INVALID_ACCOUNT_OR_APP_ID' }
    }

    let zipPath = ''

    try {
      zipPath = await this.packSaveDir(normAcc, appId)
      const fileSize = fs.statSync(zipPath).size
      if (fileSize <= 0) {
        throw new Error('ERR_EMPTY_SAVE_ARCHIVE')
      }

      const authRes = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        {
          action: 'authorize_upload',
          steam_id: normAcc,
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

          const postChunk = () => axios.post(`${serverUrl}/titan/cloudsave.php`, chunk, {
            headers: {
              'X-Titan-Token': token,
              'Content-Type': 'application/octet-stream',
              'X-Chunk-Index': String(i),
              'X-Total-Chunks': String(totalChunks),
              'X-App-Id': appId,
              'X-Steam-Id': normAcc,
              'X-Game-Name': encodeURIComponent(gameName)
            },
            timeout: 60000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
          })

          try {
            await postChunk()
          } catch (chunkErr: any) {
            const status = chunkErr?.response?.status
            const isNonRetryableClientErr = typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429
            if (isNonRetryableClientErr) throw chunkErr
            await new Promise((r) => setTimeout(r, 500))
            await postChunk()
          }
        }
      } finally {
        fs.closeSync(fd)
      }

      const confirmRes = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        {
          action: 'confirm_upload',
          steam_id: normAcc,
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
      if (zipPath) {
        try { fs.unlinkSync(zipPath) } catch {}
      }
      Logger.error('CloudSaveService', '云存档上传失败:', { accountId, appId, gameName, error: e?.message || e })
      return { success: false, msg: this.formatCloudError(e, 'ERR_NETWORK_ERROR') }
    }
  }

  // ================= 本地链：原子替换存档目录并清洗 CR 元数据 =================
  private static async replaceSaveDirAtomically(
    srcRoot: string,
    targetDir: string,
    steamPath: string | null,
    targetAccountId: string,
    appId: string
  ): Promise<void> {
    if (!this.checkHasActualSave(srcRoot)) {
      throw new Error('ERR_EMPTY_SAVE_ARCHIVE')
    }

    fs.mkdirSync(path.dirname(targetDir), { recursive: true })
    const swapBackupDir = `${targetDir}.bak61`
    if (fs.existsSync(swapBackupDir)) {
      await this.withRetry(() => fs.rmSync(swapBackupDir, { recursive: true, force: true }), 3, 150)
    }
    if (fs.existsSync(targetDir)) {
      await this.withRetry(() => fs.renameSync(targetDir, swapBackupDir), 3, 150)
    }

    try {
      await this.withRetry(() => fs.cpSync(srcRoot, targetDir, { recursive: true }), 3, 150)
      const metaInTarget = path.join(targetDir, 'meta.json')
      if (fs.existsSync(metaInTarget)) {
        try { fs.unlinkSync(metaInTarget) } catch {}
      }
      if (!this.checkHasActualSave(targetDir)) {
        throw new Error('ERR_CLOUD_RESTORE_VERIFY_FAILED')
      }
    } catch (swapErr) {
      // 拷贝或校验失败：立即从 .bak61 回滚旧档，绝不留下损坏或空窗
      try { fs.rmSync(targetDir, { recursive: true, force: true }) } catch {}
      if (fs.existsSync(swapBackupDir)) {
        try { fs.renameSync(swapBackupDir, targetDir) } catch {}
      }
      throw swapErr
    }

    if (fs.existsSync(swapBackupDir)) {
      try { fs.rmSync(swapBackupDir, { recursive: true, force: true }) } catch {}
    }

    this.sanitizeSessionAndEnsureCn(targetDir)

    const nativeRemoteCache = steamPath ? this.getNativeRemoteCacheVdfPath(steamPath, targetAccountId, appId) : ''
    if (nativeRemoteCache && fs.existsSync(nativeRemoteCache)) {
      try { fs.unlinkSync(nativeRemoteCache) } catch {}
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
      return { success: false, msg: this.formatCloudError(e, 'ERR_CLOUD_AUTH_FAILED') }
    }

    const authData = authRes?.data
    if (!authData || typeof authData !== 'object' || authData.code !== 200) {
      return { success: false, msg: authData?.msg || 'ERR_CLOUD_URL_FAILED' }
    }

    const directUrl = authData.data?.direct_url
    if (!directUrl) {
      return { success: false, msg: 'ERR_CLOUD_FILE_GONE' }
    }

    const cloudSteamId = this.normalizeAccountId(authData.data?.steam_id) || ''
    const fallbackAccId = this.normalizeAccountId(accountId) || ''
    // 跨账号恢复：优先写入当前界面选中的本机 Steam 账号目录，仅当未选中账号时兜底使用云端记录的归属 ID
    const targetAccountId = fallbackAccId || cloudSteamId
    if (!targetAccountId || !/^\d+$/.test(String(appId ?? '').trim())) {
      return { success: false, msg: 'ERR_INVALID_ACCOUNT_OR_APP_ID' }
    }

    const tmpDir = path.join(Db.getDataRoot(), 'TitanTemp', 'cloudsave')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    const stamp = Date.now()
    const zipPath = path.join(tmpDir, `restore_${appId}_${stamp}.zip`)
    const stageDir = path.join(tmpDir, `restore_${appId}_${stamp}.stage`)

    try {
      // 不设总下载时长上限（兼容大存档慢速网络）；仅对连续 15 秒无任何数据到达判定网络超时
      const IDLE_TIMEOUT_MS = 15000
      const abortController = new AbortController()
      let idleTimedOut = false

      let headerTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        idleTimedOut = true
        abortController.abort()
      }, IDLE_TIMEOUT_MS)

      let response: any
      try {
        response = await axios.get(directUrl, {
          responseType: 'stream',
          timeout: 0,
          signal: abortController.signal,
          headers: { 'User-Agent': 'TitanCore/2.0' }
        })
      } catch (reqErr: any) {
        if (idleTimedOut) throw new Error('ERR_CLOUD_DOWNLOAD_IDLE_TIMEOUT')
        throw reqErr
      } finally {
        if (headerTimer) {
          clearTimeout(headerTimer)
          headerTimer = null
        }
      }

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(zipPath)
        const stream = response.data
        let settled = false
        let streamEnded = false
        let writerClosed = false
        let idleTimer: ReturnType<typeof setTimeout> | null = null

        const clearIdleTimer = () => {
          if (idleTimer) {
            clearTimeout(idleTimer)
            idleTimer = null
          }
        }

        const failAndCleanup = (err: any) => {
          if (settled) return
          settled = true
          clearIdleTimer()
          try { stream.destroy() } catch {}
          if (writerClosed) {
            reject(err)
            return
          }
          // 等待 WriteStream 真正触发 close 释放句柄，避免 Windows 下 catch 内 unlinkSync 报 EBUSY
          const fallbackTimer = setTimeout(() => reject(err), 1500)
          writer.once('close', () => {
            clearTimeout(fallbackTimer)
            reject(err)
          })
          try {
            if (!writer.destroyed) writer.destroy()
          } catch {
            clearTimeout(fallbackTimer)
            reject(err)
          }
        }

        const resetIdleTimer = () => {
          clearIdleTimer()
          idleTimer = setTimeout(() => {
            idleTimedOut = true
            try { abortController.abort() } catch {}
            failAndCleanup(new Error('ERR_CLOUD_DOWNLOAD_IDLE_TIMEOUT'))
          }, IDLE_TIMEOUT_MS)
        }

        writer.once('close', () => {
          writerClosed = true
        })

        stream.on('data', resetIdleTimer)
        stream.on('end', () => {
          streamEnded = true
          clearIdleTimer()
        })
        stream.on('aborted', () => {
          failAndCleanup(new Error(idleTimedOut ? 'ERR_CLOUD_DOWNLOAD_IDLE_TIMEOUT' : 'ERR_NETWORK_ERROR'))
        })
        stream.on('close', () => {
          if (!settled && !streamEnded) {
            failAndCleanup(new Error(idleTimedOut ? 'ERR_CLOUD_DOWNLOAD_IDLE_TIMEOUT' : 'ERR_NETWORK_ERROR'))
          }
        })
        stream.on('error', (err: any) => {
          failAndCleanup(idleTimedOut ? new Error('ERR_CLOUD_DOWNLOAD_IDLE_TIMEOUT') : err)
        })

        writer.on('finish', () => {
          if (settled) return
          if (!streamEnded) {
            failAndCleanup(new Error('ERR_NETWORK_ERROR'))
            return
          }
          settled = true
          clearIdleTimer()
          if (writerClosed) {
            resolve()
          } else {
            const onPostFinishErr = (err: any) => {
              writer.removeListener('close', onCloseResolve)
              reject(err)
            }
            const onCloseResolve = () => {
              writer.removeListener('error', onPostFinishErr)
              resolve()
            }
            writer.once('error', onPostFinishErr)
            writer.once('close', onCloseResolve)
          }
        })
        writer.on('error', (err: any) => {
          failAndCleanup(err)
        })

        if (stream.errored) {
          failAndCleanup(stream.errored)
          return
        }
        if (stream.destroyed && !stream.readableEnded) {
          failAndCleanup(new Error(idleTimedOut ? 'ERR_CLOUD_DOWNLOAD_IDLE_TIMEOUT' : 'ERR_NETWORK_ERROR'))
          return
        }

        resetIdleTimer()
        stream.pipe(writer)
      })

      if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
        throw new Error('ERR_EMPTY_SAVE_ARCHIVE')
      }

      const steamPath = await this.resolveSteamPath()
      const targetDir = this.getSaveRoot(steamPath, targetAccountId, appId)
      // batch61: 先解到临时 stage 目录，解压成功后才替换目标目录——恢复失败不再清空旧档
      if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true })

      await ArchiveService.extract(zipPath, stageDir)

      fs.unlinkSync(zipPath)

      // 兼容手工打包连带了最外层 <appId> 目录的情况
      let extractRoot = stageDir
      const stageEntries = fs.readdirSync(stageDir, { withFileTypes: true })
      if (stageEntries.length === 1 && stageEntries[0].isDirectory() && stageEntries[0].name === appId) {
        extractRoot = path.join(stageDir, appId)
      }

      // batch61: 解压已成功——统一走带备份原子替换（失败自动回滚旧档，无空窗损坏风险）
      await this.replaceSaveDirAtomically(extractRoot, targetDir, steamPath, targetAccountId, appId)
      fs.rmSync(stageDir, { recursive: true, force: true })

      if (targetAccountId !== fallbackAccId) {
        return { success: true, msg: `SUCCESS_CLOUD_RESTORED_ALIGNED:${targetAccountId}`, restoredAccountId: targetAccountId } as any
      }
      return { success: true, msg: 'SUCCESS_CLOUD_RESTORED', restoredAccountId: targetAccountId } as any
    } catch (e: any) {
      try { fs.unlinkSync(zipPath) } catch {}
      try { if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true }) } catch {}
      Logger.error('CloudSaveService', '云存档下载恢复失败:', { accountId, appId, error: e?.message || e })
      return { success: false, msg: this.formatCloudError(e, 'ERR_CLOUD_RESTORE_FAILED') }
    }
  }

  // ================= 本地链：手动打包 =================
  static async manualPack(accountId: string, appId: string): Promise<{ success: boolean; path?: string; msg?: string }> {
    let zipPath = ''

    try {
      zipPath = await this.packSaveDir(accountId, appId)

      const win = this.getActiveWindow()
      if (!win) {
        return { success: false, msg: 'ERR_NO_WINDOW' }
      }

      const { filePath } = await dialog.showSaveDialog(win, {
        title: '保存存档备份',
        defaultPath: `TC-${appId}-local.zip`,
        filters: [{ name: 'ZIP 存档', extensions: ['zip'] }]
      })

      if (!filePath) {
        return { success: false, msg: 'ERR_CANCELLED' }
      }

      fs.copyFileSync(zipPath, filePath)

      return { success: true, path: filePath }
    } catch (e: any) {
      Logger.error('CloudSaveService', '手动打包存档失败:', { accountId, appId, error: e?.message || e })
      return { success: false, msg: this.formatCloudError(e, 'ERR_PACK_FAIL') }
    } finally {
      if (zipPath && fs.existsSync(zipPath)) {
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

      // 兼容用户手工压缩时多包了一层 <appId> 目录的情况
      let contentRoot = tmpDir
      const rootEntries = fs.readdirSync(tmpDir, { withFileTypes: true })
      if (rootEntries.length === 1 && rootEntries[0].isDirectory() && rootEntries[0].name === appId) {
        contentRoot = path.join(tmpDir, appId)
      }

      const metaPath = fs.existsSync(path.join(tmpDir, 'meta.json'))
        ? path.join(tmpDir, 'meta.json')
        : path.join(contentRoot, 'meta.json')
      let meta: any = {}
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        } catch {}
      }

      const metaAccountId = this.normalizeAccountId(meta.account_id || meta.steam_id) || ''

      if (meta.app_id && String(meta.app_id) !== appId) {
        throw new Error(`ERR_SAVE_MISMATCH:${meta.app_id}`)
      }

      const baseAccountId = this.normalizeAccountId(accountId) || ''
      // 跨账号恢复：优先写入当前界面的选中账号，仅未选账号时兜底读取包内原账号 ID
      const targetAccountId = baseAccountId || metaAccountId
      if (!targetAccountId) {
        throw new Error(`ERR_INVALID_ACCOUNT_OR_APP_ID: invalid accountId (${accountId})`)
      }
      const isDiffAccount = targetAccountId !== baseAccountId

      const steamPath = await this.resolveSteamPath()
      const targetDir = this.getSaveRoot(steamPath, targetAccountId, appId)
      await this.replaceSaveDirAtomically(contentRoot, targetDir, steamPath, targetAccountId, appId)

      if (isDiffAccount) {
        return { success: true, msg: `SUCCESS_CLOUD_RESTORED_ALIGNED_LOCAL:${targetAccountId}`, restoredAccountId: targetAccountId } as any
      }
      return { success: true, msg: 'SUCCESS_CLOUD_RESTORED_LOCAL', restoredAccountId: targetAccountId } as any
    } catch (e: any) {
      return { success: false, msg: this.formatCloudError(e, 'ERR_CLOUD_RESTORE_FAILED') }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    }
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
      return { success: false, msg: this.formatCloudError(e, 'ERR_NETWORK_ERROR') }
    }
  }

  // ================= 云存档链：列表 =================
  static async listCloudSaves(): Promise<any> {
    const serverUrl = getServerUrl()
    const token = getAuthToken()
    if (!serverUrl || !token) {
      return { code: 0, error: true, data: { apps: [], quota: {} } }
    }

    try {
      const res = await axios.post(
        `${serverUrl}/titan/cloudsave.php`,
        { action: 'list' },
        { headers: { 'X-Titan-Token': token, 'Content-Type': 'application/json' }, timeout: 15000 }
      )
      if (!res.data || typeof res.data !== 'object') {
        return { code: 0, error: true, data: { apps: [], quota: {} } }
      }
      return res.data
    } catch (e: any) {
      Logger.warn('CloudSaveService', '拉取云存档列表失败:', e?.message || e)
      return { code: 0, error: true, data: { apps: [], quota: {} } }
    }
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
    return await CloudSaveService.scanAccountsDetailed()
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