// 文件名: src/main/services/SteamLaunchService.ts
// TC 侧适配 第3批: 从 TC 启动 Steam(纯净=挂起注入+握手; 经典=普通启动; 失败自动降级)
import { execFile, execFileSync, spawn } from 'node:child_process'
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { SteamDetector } from './SteamDetector'
import { ModeSwitchService } from './ModeSwitchService'
import { CloudSaveService } from './CloudSaveService'
import { PatternSyncService } from './PatternSyncService'
import { DepotHealerService } from './DepotHealerService'
import { Logger } from '../utils/logger'

export interface LaunchSteamResult {
  success: boolean
  handshake: boolean
  degraded?: boolean
  protected?: boolean
  account?: string
  accountName?: string
  error?: string
}

interface NativeLaunchResult {
  pid: number
  handshake: boolean
  injected: boolean
  error: string
}

export class SteamLaunchService {
  private static native: any = null
  private static nativeTried = false
  private static busy = false

  // 惰性加载原生插件: 先打包资源目录, 后开发目录
  private static loadNative(): any {
    if (this.nativeTried) return this.native
    this.nativeTried = true
    const candidates: string[] = [
      path.join(process.resourcesPath || '', 'bin', 'tc_native.node'),
      path.join(path.dirname(process.execPath), 'resources', 'bin', 'tc_native.node')
    ]
    try { candidates.push(path.join(app.getAppPath(), 'native', 'build', 'Release', 'tc_native.node')) } catch { }
    candidates.push(path.join(path.dirname(process.execPath), '..', '..', '..', 'native', 'build', 'Release', 'tc_native.node'))
    try { candidates.push(path.join(app.getAppPath(), 'build', 'native', 'Release', 'tc_native.node')) } catch { }  // TC-P17: add_subdirectory 产物位
    try { candidates.push(path.join(app.getAppPath(), 'resources', 'bin', 'tc_native.node')) } catch { }  // TC-P17: 编译后自动复制位
    for (const p of candidates) {
      try {
        if (p && fs.existsSync(p)) { this.native = require(p); return this.native }
      } catch (e: any) {
        console.error('[SteamLaunchService] 原生插件加载失败:', p, e?.message)
      }
    }
    console.error('[SteamLaunchService] 原生插件未找到, 降级为普通启动')
    return null
  }

  // TC-P29: 全仓唯一重启管道 -- 快速强杀(100ms 步进轮询, 死不盲等) -> 复用 launchSteam(模式感知+注入)
  static async restartSteam(): Promise<{ success: boolean; handshake: boolean; degraded?: boolean; error?: string }> {
    try {
      await ModeSwitchService.ensureSteamDead()
      return await this.launchSteam()
    } catch (e: any) {
      Logger.error('SteamLaunchService', '一键启动 Steam 发生致命异常:', e?.message || e)
      return { success: false, handshake: false, error: e?.message || 'UNKNOWN' }
    }
  }

  // 启动账号预测：优先注册表 AutoLoginUser，其次 VDF 活跃/最近标记，再次时间戳排序
  public static predictActiveSteamAccount(steamPath: string): { steamId64: string; accountName: string; personaName: string; source: string } | null {
    try {
      // 1. 优先读取注册表 AutoLoginUser（安全绝对寻址，防止 PATH 丢失）
      let regUser: string | null = null
      try {
        const sysRoot = process.env.SystemRoot || process.env.windir || 'C:\\Windows'
        const regTarget = path.join(sysRoot, 'System32', 'reg.exe')
        const regExe = fsSync.existsSync(regTarget) ? regTarget : 'reg.exe'
        const out = execFileSync(regExe, ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'AutoLoginUser'], { encoding: 'utf-8', timeout: 2000 })
        const m = out.match(/AutoLoginUser\s+REG_SZ\s+(.+)/i)
        if (m && m[1]) regUser = m[1].trim()
      } catch {}

      // 2. 结构化读取 loginusers.vdf
      const accounts = CloudSaveService.getDetailedSteamAccounts(steamPath)
      if (regUser && accounts.length > 0) {
        const matched = accounts.find(a => a.accountName && a.accountName.toLowerCase() === regUser!.toLowerCase())
        if (matched) {
          return {
            steamId64: matched.steamId64,
            accountName: matched.accountName,
            personaName: matched.personaName,
            source: 'registry_match'
          }
        }
      }

      // 3. 兜底回落到活跃/最近登录标记
      if (accounts.length > 0) {
        const recent = accounts.find(a => a.mostRecent)
        if (recent) {
          return {
            steamId64: recent.steamId64,
            accountName: recent.accountName,
            personaName: recent.personaName,
            source: 'vdf_recent'
          }
        }
        // 4. 按活跃时间戳排序取首位
        return {
          steamId64: accounts[0].steamId64,
          accountName: accounts[0].accountName,
          personaName: accounts[0].personaName,
          source: 'vdf_timestamp'
        }
      }
    } catch (e: any) {
      console.warn('[SteamLaunchService] 预测当前 Steam 登录账号异常:', e?.message)
    }
    return null
  }

  private static plainLaunch(steamExe: string, stripEnv = false): void {
    try {
      const cleanEnv = { ...process.env }
      if (stripEnv) {
        delete cleanEnv.CR_STATE_DIR
      } else {
        cleanEnv.CR_STATE_DIR = ModeSwitchService.ostDir
      }
      const p = spawn(steamExe, ['-websocket'], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(steamExe),
        env: cleanEnv
      })
      p.unref()
    } catch (e: any) {
      console.error('[SteamLaunchService] 普通启动失败:', e?.message)
    }
  }

  // 一键启动: 关净 Steam -> (纯净)预写分流标记 -> 注入启动 -> 失败自动重试/降级
  static async launchSteam(): Promise<{ success: boolean; handshake: boolean; degraded?: boolean; error?: string }> {
    if (this.busy) return { success: false, handshake: false, error: 'BUSY' }
    this.busy = true
    try {
      const det = await SteamDetector.detect()
      const steamPath = det.path
      const steamExe = steamPath ? path.join(steamPath, 'steam.exe') : ''
      if (!steamPath || !fs.existsSync(steamExe)) {
        Logger.error('SteamLaunchService', '启动失败: 未找到 steam.exe', { steamPath })
        return { success: false, handshake: false, error: 'STEAM_NOT_FOUND' }
      }

      const mode = ModeSwitchService.getMode()
      const ostRoot = mode === 'pure' ? ModeSwitchService.ostDir : steamPath
      const dllPath = path.join(ostRoot, 'OpenSteamTool.dll')
      const tomlPath = path.join(ostRoot, 'opensteamtool.toml')
      const native = this.loadNative()

      await ModeSwitchService.ensureSteamDead()

      // 清单崩溃防御：启动 Steam 前静默扫描并清理导致 Steam 闪退的损坏清单文件 (如包含空文件名的残缺清单)
      try {
        DepotHealerService.sanitizeDepotCache(steamPath)
      } catch {}

      // 存量云存档静默平滑迁移：在 Steam 彻底退出的黄金窗口期，静默将旧版 cloud_redirect 及日志迁移至 TC 侧
      try {
        const legacyCrDir = path.join(steamPath, 'cloud_redirect')
        const legacyCrLog = path.join(steamPath, 'cloud_redirect.log')
        if (fs.existsSync(legacyCrDir) || fs.existsSync(legacyCrLog)) {
          await CloudSaveService.migrateCrStorage()
        }
      } catch (migErr) {
        console.warn('[SteamLaunchService] 启动前存量云存档静默迁移跳过:', migErr)
      }

      // 前置主动拉取 Pattern / IPC 特征码：尽力而为（Best-effort），绝不阻断启动
      try {
        await PatternSyncService.validatePatterns()
      } catch (patternErr: any) {
        console.warn('[SteamLaunchService] 前置特征码同步捕获:', patternErr?.message)
      }

      // 账号闸前置决策：非白名单账号不注入，主号保护启动（根本不进内存）
      const gate = CloudSaveService.getActiveAccountGate(steamPath)
      if (gate.enabled && gate.ids.length > 0) {
        const predicted = this.predictActiveSteamAccount(steamPath)
        if (predicted) {
          const isWhitelisted = gate.ids.includes(predicted.steamId64)
          if (!isWhitelisted) {
            console.info(`[SteamLaunchService] 主号保护启动（账号 ${predicted.steamId64} [${predicted.accountName || predicted.personaName}] 不在白名单）`)
            // 确保纯净模式分流处于关闭状态
            if (fs.existsSync(tomlPath)) {
              ModeSwitchService.setTomlKey(tomlPath, 'diversion', 'enabled', 'false')
            }
            // 不注入，走裸启动分支，显式覆盖 env 并剥离 CR_STATE_DIR
            this.plainLaunch(steamExe, true)
            return {
              success: true,
              handshake: false,
              protected: true,
              account: predicted.steamId64,
              accountName: predicted.accountName || predicted.personaName
            }
          }
          console.info(`[SteamLaunchService] 账号闸前置校验通过（账号 ${predicted.steamId64} 处于白名单），继续注入流程`)
        } else {
          console.warn('[SteamLaunchService] 账号闸已开启，但未能预判当前 Steam 账号，进入既定注入流程，由运行时账号闸兜底')
        }
      }

      // 经典模式: 启动前将本地最新工具包覆盖同步至 Steam 根并清理早期遗产，代理入口自会挂载
      if (mode === 'classic') {
        await ModeSwitchService.syncClassicArtifacts(steamPath).catch((err) => {
          console.warn('[SteamLaunchService] 经典模式同步最新工具包异常:', err?.message)
        })
        this.plainLaunch(steamExe)
        return { success: true, handshake: false }
      }

      // 纯净模式: 预写启用分流(启动前定案; 最终失败回滚 false)
      ModeSwitchService.setTomlKey(tomlPath, 'diversion', 'enabled', 'true')

      if (!native || !fs.existsSync(dllPath)) {
        this.plainLaunch(steamExe)
        return { success: true, handshake: false, degraded: true, error: !native ? 'NATIVE_MISSING' : 'DLL_MISSING' }
      }

      const timeouts = [25000, 35000]
      for (let attempt = 0; attempt < timeouts.length; attempt++) {
        const eventName = `OST_RDV_${process.pid}_${Date.now()}_${attempt}`
        let result: NativeLaunchResult
        try {
          result = await new Promise<NativeLaunchResult>((resolve, reject) => {
            ;(this.native.launchSuspended as any)(steamExe, dllPath, ostRoot, eventName, timeouts[attempt],
              (err: any, res: NativeLaunchResult) => err ? reject(err) : resolve(res))
          })
        } catch (e: any) {
          result = { pid: 0, handshake: false, injected: false, error: e?.message || String(e) }
        }
        if (result.handshake) return { success: true, handshake: true }
        console.error(`[SteamLaunchService] 注入尝试${attempt + 1}未握手:`, result.error)
        if (attempt < timeouts.length - 1) await ModeSwitchService.ensureSteamDead()
      }

      // 两次未握手: 回滚分流标记 -> 杀净注入失败的残留 Steam -> 普通启动兜底(避免双开互踩)
      Logger.warn('SteamLaunchService', '注入两次未握手，自动降级为原版启动', { tomlPath, steamExe })
      ModeSwitchService.setTomlKey(tomlPath, 'diversion', 'enabled', 'false')
      await ModeSwitchService.ensureSteamDead()
      this.plainLaunch(steamExe)
      return { success: true, handshake: false, degraded: true, error: 'HANDSHAKE_TIMEOUT' }
    } catch (e: any) {
      return { success: false, handshake: false, error: e?.message || 'UNKNOWN' }
    } finally {
      this.busy = false
    }
  }

  // 原生干净启动: 彻底不加载任何辅助或注入插件，纯原生拉起 steam.exe
  static async launchSteamNative(): Promise<{ success: boolean; native: boolean; error?: string }> {
    try {
      const det = await SteamDetector.detect()
      const steamPath = det.path
      const steamExe = steamPath ? path.join(steamPath, 'steam.exe') : ''
      if (!steamPath || !fs.existsSync(steamExe)) {
        return { success: false, native: true, error: 'STEAM_NOT_FOUND' }
      }
      await ModeSwitchService.ensureSteamDead()
      this.plainLaunch(steamExe, true)
      return { success: true, native: true }
    } catch (e: any) {
      console.error('[SteamLaunchService] 原生启动异常:', e?.message)
      return { success: false, native: true, error: e?.message || 'UNKNOWN' }
    }
  }

  // 极速安全感知: 仅扫描 Steam 根目录 steamapps/common 下的游戏，快速匹配反作弊特征
  static async detectAntiCheatGames(): Promise<string[]> {
    try {
      const det = await SteamDetector.detect()
      const steamPath = det.path
      if (!steamPath) return []

      const commonDir = path.join(steamPath, 'steamapps', 'common')
      if (!fs.existsSync(commonDir)) return []

      const entries = await fs.promises.readdir(commonDir, { withFileTypes: true }).catch(() => [])
      const detectedGames = new Set<string>()

      // 常见反作弊游戏的快速映射表
      const knownGameMap: Array<{ key: RegExp; name: string }> = [
        { key: /naraka/i, name: '永劫无间 (NARAKA: BLADEPOINT)' },
        { key: /apex.*legends/i, name: 'Apex 英雄 (Apex Legends)' },
        { key: /pubg/i, name: '绝地求生 (PUBG: BATTLEGROUNDS)' },
        { key: /counter-strike|csgo/i, name: '反恐精英2 (CS2 / CS:GO)' },
        { key: /destiny.*2/i, name: '命运2 (Destiny 2)' },
        { key: /rainbow.*six/i, name: '彩虹六号：围攻 (R6S)' },
        { key: /monster.*hunter.*wilds/i, name: '怪物猎人：荒野 (MH Wilds)' },
        { key: /monster.*hunter.*world/i, name: '怪物猎人：世界 (MHW)' },
        { key: /street.*fighter.*6/i, name: '街头霸王6 (Street Fighter 6)' },
        { key: /dead.*by.*daylight/i, name: '黎明杀机 (Dead by Daylight)' },
        { key: /rust/i, name: '腐蚀 (Rust)' },
        { key: /war.*thunder/i, name: '战争雷霆 (War Thunder)' },
        { key: /the.*finals/i, name: '最终决战 (THE FINALS)' },
        { key: /helldivers.*2/i, name: '绝地潜兵2 (HELLDIVERS 2)' },
      ]

      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const folderName = entry.name

        // 1. 快速检查已知名单
        let matchedKnown = false
        for (const item of knownGameMap) {
          if (item.key.test(folderName)) {
            detectedGames.add(item.name)
            matchedKnown = true
            break
          }
        }
        if (matchedKnown) continue

        // 2. 轻量探查该游戏根目录下是否存在反作弊特征文件/文件夹（只探查浅层）
        try {
          const gameSubDir = path.join(commonDir, folderName)
          const subItems = await fs.promises.readdir(gameSubDir).catch(() => [])
          const hasAntiCheatItem = subItems.some(item => {
            const lower = item.toLowerCase()
            return lower.includes('easyanticheat') ||
                   lower.includes('battleye') ||
                   lower === 'start_protected_game.exe' ||
                   lower === 'beservice.exe' ||
                   lower.includes('anticheat')
          })
          if (hasAntiCheatItem) {
            detectedGames.add(`${folderName} (含反作弊组件)`)
          }
        } catch {}
      }

      return Array.from(detectedGames)
    } catch (e: any) {
      console.warn('[SteamLaunchService] 扫描反作弊游戏异常:', e?.message)
      return []
    }
  }
}
