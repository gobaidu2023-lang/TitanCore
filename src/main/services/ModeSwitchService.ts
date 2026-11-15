// 文件名: src/main/services/ModeSwitchService.ts
// TC 侧适配: 纯净/经典模式切换服务
// 规范: 彻底解耦 CR 依赖、复用 deploy 安装语义纯覆盖安装、加固 dev 开发环境回退
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { Db } from '../db'
import { app } from 'electron'
import { SteamDetector } from './SteamDetector'
import { PatternSyncService } from './PatternSyncService'
import { Logger } from '../utils/logger'
import { CloudSaveService } from './CloudSaveService'
import { WinNative } from '../utils/winNative'
import { TitanProtocol } from './TitanProtocol'
import { EngineService } from './EngineService'
import { resolve7zExePath } from '../utils/resolve7z'

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export type OstMode = 'pure' | 'classic'

export class ModeSwitchService {
  private static readonly MODE_KEY = 'ost_mode'
  private static busy = false

  // TC 安装目录与纯净模式工件根
  private static get tcDir(): string { return app.isPackaged ? path.dirname(process.execPath) : app.getAppPath() }
  static get ostDir(): string { return path.join(this.tcDir, 'ost') }

  // 同步活根解析(纯净=TC\ost; 经典=沿用传入路径)
  static getRootSync(steamPath?: string | null): string | null {
    if (this.getMode() === 'pure') return this.ostDir
    return steamPath || null
  }

  static isBusy(): boolean {
    return this.busy
  }

  static isSteamAlive(): Promise<boolean> {
    return this.isSteamRunning()
  }

  // 自检 %AppData%\titan-core\tools 基础运行件缓存是否完整（缺失时尝试本地 tool.zip 自愈解压）
  private static toolsCacheReady(): boolean {
    const required = ['OpenSteamTool.dll', 'xinput1_4.dll', 'cloud_redirect.dll', 'opensteamtool.toml']
    let ready = required.every(f => !!this.findInDir(this.toolsDir, f))

    if (!ready) {
      // 本地缓存自愈：若工具目录缺失散装文件但存在已下载的 tool.zip，先走本地解压
      const localZip = path.join(this.toolsDir, 'tool.zip')
      if (fs.existsSync(localZip)) {
        try {
          const { execFileSync } = require('node:child_process')
          const sevenZipExe = resolve7zExePath()
          if (sevenZipExe && fs.existsSync(sevenZipExe)) {
            execFileSync(sevenZipExe, ['x', localZip, `-o${this.toolsDir}`, '-y', '-aoa'], { timeout: 30000, windowsHide: true })
            ready = required.every(f => !!this.findInDir(this.toolsDir, f))
          }
        } catch {}
      }
    }

    return ready
  }

  // 固定使用唯一可写缓存目录 %AppData%\titan-core\tools，杜绝穿透命中安装/资源目录下的旧包或只读目录
  static get toolsDir(): string {
    return path.join(app.getPath('userData'), 'tools')
  }

  // 改造：按 deploy 纯覆盖语义分发运行核心件；若 ostDir 缺少 CR 则按需由 tools 补齐，不碰 Steam 根
  private static async deployArtifactsToRoot(dstDir: string): Promise<void> {
    // TC-P32: 规范化小写比对，杜绝 Windows 盘符大小写不一致导致的穿透误判
    const isPureTarget = path.resolve(dstDir).toLowerCase() === path.resolve(this.ostDir).toLowerCase();
    if (isPureTarget) {
      // TC-P32: 纯净模式下注入是唯一入口 -- 物理铲除 ost 目录存量代理入口及历史 .bak (加持退避重试)
      for (const f of ['xinput1_4.dll', 'xinput1_4.dll.bak']) {
        await this.retryOp(() => {
          const p = path.join(this.ostDir, f);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        });
      }
    }
    const coreDlls = isPureTarget ? ['OpenSteamTool.dll'] : ['OpenSteamTool.dll', 'xinput1_4.dll'];
    for (const dll of coreDlls) {
      const src = this.findInDir(this.toolsDir, dll);
      if (!src) throw new Error('TOOLS_MISSING:' + dll);
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
      const dst = path.join(dstDir, dll);
      await this.retryOp(() => fs.copyFileSync(src, dst));
      if (fs.statSync(src).size !== fs.statSync(dst).size) throw new Error('VERIFY_FAIL:' + dll);
    }

    // CR 钉死 ostDir：仅当 ostDir 缺失且 tools 中存在时就地补全
    const ostCrPath = path.join(this.ostDir, 'cloud_redirect.dll');
    if (!fs.existsSync(ostCrPath)) {
      const crSrc = this.findInDir(this.toolsDir, 'cloud_redirect.dll');
      if (crSrc) {
        if (!fs.existsSync(this.ostDir)) fs.mkdirSync(this.ostDir, { recursive: true });
        try { fs.copyFileSync(crSrc, ostCrPath); } catch {}
      }
    }
  }

  // 改造：从 toolsDir 纯覆盖安装 toml；若丢失则直接熔断回滚，严禁静默假成功
  private static async installTomlToRoot(dstDir: string): Promise<void> {
    const srcToml = this.findInDir(this.toolsDir, 'opensteamtool.toml');
    if (!srcToml || !fs.existsSync(srcToml)) {
      throw new Error('TOOLS_MISSING:opensteamtool.toml');
    }
    if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
    const targetToml = path.join(dstDir, 'opensteamtool.toml');
    await this.retryOp(() => fs.copyFileSync(srcToml, targetToml));
  }

  // 清理早期版本遗留在 Steam\bin 下的影子模块克隆文件（非 Steam 官方文件）
  static async cleanLegacyDiversionFiles(steamPath: string): Promise<void> {
    if (!steamPath) return
    for (const f of ['diversion.dll', 'diversion64.dll']) {
      await this.retryOp(() => {
        const p = path.join(steamPath, 'bin', f)
        if (fs.existsSync(p)) fs.unlinkSync(p)
      }).catch(() => {})
    }
  }

  // 经典模式纯本地毫秒级兜底：清理旧遗产文件，仅当活根缺失核心件时才从本地 tools 缓存补齐缺失项，绝不联网或重复写盘
  static async ensureClassicRootFromLocalCache(steamPath: string): Promise<void> {
    if (!steamPath || this.getMode() !== 'classic') return
    await this.cleanLegacyDiversionFiles(steamPath)

    const missingDlls = ['OpenSteamTool.dll', 'xinput1_4.dll'].filter(
      dll => !fs.existsSync(path.join(steamPath, dll))
    )
    const tomlPath = path.join(steamPath, 'opensteamtool.toml')
    const missingToml = !fs.existsSync(tomlPath)
    const ostCrPath = path.join(this.ostDir, 'cloud_redirect.dll')
    const missingCr = !fs.existsSync(ostCrPath)

    if (missingDlls.length === 0 && !missingToml && !missingCr) return
    if (!this.toolsCacheReady()) return

    for (const dll of missingDlls) {
      const src = this.findInDir(this.toolsDir, dll)
      if (!src) continue
      const dst = path.join(steamPath, dll)
      await this.retryOp(() => fs.copyFileSync(src, dst))
    }

    if (missingCr) {
      const crSrc = this.findInDir(this.toolsDir, 'cloud_redirect.dll')
      if (crSrc) {
        if (!fs.existsSync(this.ostDir)) fs.mkdirSync(this.ostDir, { recursive: true })
        try { fs.copyFileSync(crSrc, ostCrPath) } catch {}
      }
    }

    if (missingToml) {
      await this.installTomlToRoot(steamPath)
      this.setTomlKey(tomlPath, 'diversion', 'enabled', 'false')
      const cloudEnabled = Db.get<boolean>('user_pref_cloud_save') ?? true
      this.setTomlKey(tomlPath, 'cloud', 'enabled', cloudEnabled ? 'true' : 'false')
    }
  }

  // TC: 按需环境修复（先体检定位具体故障项：仅涉及核心件/看门狗/冲突/Lua 迁移时才关闭 Steam 重铺文件；CR/TOML/节点只做轻量修复并如实返回成败）
  static async repairEnvironment(): Promise<{ success: boolean; error?: string }> {
    if (this.busy || TitanProtocol.hasActiveDeployment()) {
      return { success: false, error: 'BUSY_DEPLOYING' }
    }

    this.busy = true
    try {
      const det = await SteamDetector.detect()
      const steamPath = det?.path
      if (!steamPath) return { success: false, error: 'STEAM_NOT_FOUND' }

      const diagResults = await TitanProtocol.runDiagnostics(steamPath, 'ost', EngineService.getManifestProbeResult())
      const isOk = (name: string) => diagResults.find(r => r.name === name)?.ok ?? true
      const needsDllRepair = !isOk('DIAG_OST_DLL')
      const needsCoreRepair = needsDllRepair || !isOk('DIAG_GAME_CFG') || !isOk('DIAG_ENGINE_CONFLICT') || !isOk('DIAG_OST_WATCHDOG')
      const needsCrMigrate = !isOk('DIAG_CR_STORAGE_LEGACY')
      const needsNodeProbe = !isOk('DIAG_MANIFEST_URL') || !EngineService.getManifestProbeResult()?.url

      if (needsCoreRepair) {
        await this.ensureSteamDead()
        await TitanProtocol.waitForPrefetch()

        if (needsDllRepair || !this.toolsCacheReady()) {
          // 优先尝试向云端拉取最新工具包（若网络离线且本地已有缓存则用本地缓存兜底，缺缓存且拉取失败才报错）
          const pull = await EngineService.pullLatest('ost', true).catch((err: any) => ({ success: false, error: err?.message }))
          if (!pull?.success && !this.toolsCacheReady()) {
            Logger.error('ModeSwitchService', '环境修复失败: 工具包拉取失败且本地无可用缓存', pull?.error)
            return { success: false, error: pull?.error ? TitanProtocol.translateError(pull.error, 'TOOLS_PULL_FAIL') : 'TOOLS_PULL_FAIL' }
          }
        }

        // TC-P32: 一键环境修复时，纯净模式必须强力净化 Steam 根，杜绝代理残留与注入器冲突
        await this.cleanLegacyDiversionFiles(steamPath)

        // 清理 TC\ost\modules 下看门狗监测到的泄露垃圾目录（解决 DIAG_OST_WATCHDOG 红灯死循环）
        const modulesDir = path.join(this.ostDir, 'modules')
        for (const stray of ['config', 'logs', 'appcache']) {
          const strayPath = path.join(modulesDir, stray)
          if (fs.existsSync(strayPath)) {
            await this.retryOp(() => fs.rmSync(strayPath, { recursive: true, force: true })).catch(() => {})
          }
        }

        const steamLua = path.join(steamPath, 'config', 'lua')
        const pureLua = path.join(this.ostDir, 'config', 'lua')
        if (this.getMode() === 'pure') {
          // 纯净模式：若 Steam 根目录仍有未迁入的 lua 或 opensteamtool 目录，先自动合并搬入 TC\ost 并校验后再清理
          if (fs.existsSync(steamLua)) {
            fs.mkdirSync(pureLua, { recursive: true })
            await this.copyDir(steamLua, pureLua).catch(() => {})
            const srcFiles = fs.readdirSync(steamLua).filter(f => f.toLowerCase().endsWith('.lua'))
            if (srcFiles.every(f => fs.existsSync(path.join(pureLua, f)))) {
              await this.retryOp(() => fs.rmSync(steamLua, { recursive: true, force: true })).catch(() => {})
            }
          }
          const legacyOst = path.join(steamPath, 'opensteamtool')
          const pureOst = path.join(this.ostDir, 'opensteamtool')
          if (fs.existsSync(legacyOst)) {
            fs.mkdirSync(pureOst, { recursive: true })
            await this.copyDir(legacyOst, pureOst).catch(() => {})
            await this.retryOp(() => fs.rmSync(legacyOst, { recursive: true, force: true })).catch(() => {})
          }
          for (const f of ['OpenSteamTool.dll', 'OpenSteamTool.dll.bak', 'xinput1_4.dll', 'xinput1_4.dll.bak', 'opensteamtool.toml', 'opensteamtool.toml.bak', 'dwmapi.dll', 'dwmapi.dll.bak', 'cloud_redirect.dll', 'cloud_redirect.log']) {
            await this.retryOp(() => {
              const p = path.join(steamPath, f)
              if (fs.existsSync(p)) fs.unlinkSync(p)
            }).catch(() => {})
          }
        } else {
          // 经典模式：若 TC\ost\config\lua 存在 lua 文件，顺手合并补回 Steam\config\lua
          if (fs.existsSync(pureLua)) {
            fs.mkdirSync(steamLua, { recursive: true })
            await this.copyDir(pureLua, steamLua).catch(() => {})
          }
          for (const f of ['OpenSteamTool.dll', 'opensteamtool.toml']) {
            await this.retryOp(() => {
              const p = path.join(this.ostDir, f)
              if (fs.existsSync(p)) fs.unlinkSync(p)
            }).catch(() => {})
          }
        }

        const activeRoot = this.getActiveRoot(steamPath)
        const activeLuaDir = path.join(activeRoot, 'config', 'lua')
        if (!fs.existsSync(activeLuaDir)) {
          fs.mkdirSync(activeLuaDir, { recursive: true })
        }

        // lay down core dlls + base toml + CR
        await this.deployArtifactsToRoot(activeRoot)
        await this.installTomlToRoot(activeRoot)

        // restore diversion flag and cloud-save toggle
        const tomlNow = path.join(activeRoot, 'opensteamtool.toml')
        this.setTomlKey(tomlNow, 'diversion', 'enabled', this.getMode() === 'pure' ? 'true' : 'false')
        const cloudEnabled = Db.get<boolean>('user_pref_cloud_save') ?? true
        this.setTomlKey(tomlNow, 'cloud', 'enabled', cloudEnabled ? 'true' : 'false')
        if (app.isPackaged) {
          this.setTomlKey(tomlNow, 'log', 'level', '"info"')
        }
        CloudSaveService.setTomlCloudEnabled(steamPath, cloudEnabled)
      }

      // 迁移存量旧云存档并固死 CR_STATE_DIR 环境变量（如实检查迁移结果，不吞错）
      if (needsCrMigrate || fs.existsSync(path.join(steamPath, 'cloud_redirect')) || fs.existsSync(path.join(steamPath, 'cloud_redirect.log'))) {
        const migRes = await CloudSaveService.migrateCrStorage()
        if (!migRes?.success && migRes?.error !== 'NO_LEGACY_DATA') {
          return { success: false, error: migRes?.error || 'VERIFY_FAIL' }
        }
      }
      if (needsCoreRepair || needsCrMigrate || process.env.CR_STATE_DIR !== this.ostDir) {
        process.env.CR_STATE_DIR = this.ostDir
        CloudSaveService.writeCrStateDirEnv(this.ostDir)
      }

      // 特征码对齐同步（如实校验对齐结果，离线/未登录直接报真实错误）
      if (!PatternSyncService.diagnoseAlignment(steamPath).ok) {
        const patRes = await PatternSyncService.validatePatterns()
        if (patRes?.error) {
          return { success: false, error: patRes.error }
        }
        if (!PatternSyncService.diagnoseAlignment(steamPath).ok) {
          return { success: false, error: 'NETWORK_ERROR' }
        }
      }

      // 清单节点探测
      if (needsNodeProbe) {
        await EngineService.probeManifestNodes().catch(() => {})
        if (!EngineService.getManifestProbeResult()?.url) {
          return { success: false, error: 'NETWORK_ERROR' }
        }
      }

      return { success: true }
    } catch (e: any) {
      return { success: false, error: TitanProtocol.translateError(e, 'REPAIR_FAIL') }
    } finally {
      this.busy = false
    }
  }

  private static findInDir(dir: string, name: string): string | null {
    if (!fs.existsSync(dir)) return null
    const lower = name.toLowerCase()
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, item.name)
      if (item.isDirectory()) {
        const hit = this.findInDir(p, name)
        if (hit) return hit
      } else if (item.name.toLowerCase() === lower) {
        return p
      }
    }
    return null
  }

  // ============ 模式查询（数据库 ost_mode 为唯一真理源，缺省默认 classic） ============
  static getMode(): OstMode {
    const recorded = Db.get<string>(this.MODE_KEY)
    return recorded === 'pure' ? 'pure' : 'classic'
  }

  static getActiveRoot(steamPath: string): string {
    return this.getMode() === 'pure' ? this.ostDir : steamPath
  }

  static getActiveTomlPath(steamPath: string): string {
    return path.join(this.getActiveRoot(steamPath), 'opensteamtool.toml')
  }

  static getActiveLuaDir(steamPath: string): string {
    return path.join(this.getActiveRoot(steamPath), 'config', 'lua')
  }

  // ============ Steam 关停阶梯 ============
  private static isImageRunning(imageName: string): boolean {
    try {
      return WinNative.isProcessRunning(imageName)
    } catch {
      return false
    }
  }

  private static async isSteamRunning(): Promise<boolean> {
    return this.isImageRunning('steam.exe')
  }

  // 通知 Windows 服务管理器停止 Steam Client Service (内置普通用户亦具备 STOP 权限)
  private static stopSteamClientService(): Promise<boolean> {
    if (process.platform !== 'win32') return Promise.resolve(false)
    const scExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'sc.exe')
    return new Promise((resolve) => {
      execFile(scExe, ['stop', 'Steam Client Service'], { windowsHide: true, timeout: 3000 }, (err) => {
        resolve(!err)
      })
    })
  }

  private static async waitProcessExit(imageName: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (!this.isImageRunning(imageName)) return true
      await delay(100)
    }
    return !this.isImageRunning(imageName)
  }

  static async ensureSteamDead(): Promise<void> {
    const wasRunning = await this.isSteamRunning()
    WinNative.killProcesses(['steam.exe', 'steamwebhelper.exe', 'crashhandler64.exe', 'crashhandler.exe'], true)
    if (wasRunning) {
      await this.waitProcessExit('steam.exe', 5000)
    }

    // 若后台 SteamService.exe 仍在收尾或未退出，主动停止并等待其彻底释放管道句柄再继续
    if (this.isImageRunning('steamservice.exe')) {
      const stopSent = await this.stopSteamClientService()
      if (this.isImageRunning('steamservice.exe')) {
        if (!stopSent) {
          // 服务未注册或通知失败时尝试直接结束进程（管理员或用户态进程生效）
          WinNative.killProcesses(['steamservice.exe'], true)
        } else {
          // 优先给服务 2 秒优雅退出，超时仍残留则补一次强杀兜底
          const exitedGracefully = await this.waitProcessExit('steamservice.exe', 2000)
          if (!exitedGracefully) {
            WinNative.killProcesses(['steamservice.exe'], true)
          }
        }
        const exited = await this.waitProcessExit('steamservice.exe', 12000)
        if (!exited) {
          console.warn('[ModeSwitchService] 等待 SteamService.exe 退出超时，继续后续流程')
        }
      }
    }

    await delay(500)
    if (await this.isSteamRunning()) throw new Error('STEAM_STILL_RUNNING')
  }

  private static async retryOp<T>(op: () => T): Promise<T> {
    let lastErr: any = null
    for (let i = 0; i < 3; i++) {
      try { return op() } catch (e) { lastErr = e; await delay(500 * (i + 1)) }
    }
    throw lastErr
  }

  private static async copyDir(src: string, dst: string): Promise<void> {
    if (!fs.existsSync(src)) return
    await this.retryOp(() => fs.cpSync(src, dst, { recursive: true }))
  }

  static setTomlKey(tomlPath: string, section: string, key: string, value: string): boolean {
    try {
      if (!fs.existsSync(tomlPath)) return false
      let content = fs.readFileSync(tomlPath, 'utf-8')
      const sectionRegex = new RegExp(`(\\[${section}\\][\\s\\S]*?)(?=\\n\\[|$)`, 'i')
      const kvLine = `${key} = ${value}`
      if (sectionRegex.test(content)) {
        content = content.replace(sectionRegex, (sec) => {
          const kre = new RegExp(`(${key}\\s*=\\s*)([^\\n]+)`, 'i')
          return kre.test(sec) ? sec.replace(kre, `$1${value}`) : `${sec.trimEnd()}\n${kvLine}\n`
        })
      } else {
        content = `${content.trimEnd()}\n\n[${section}]\n${kvLine}\n`
      }
      const tmp = `${tomlPath}.tmp-${process.pid}`
      fs.writeFileSync(tmp, content, 'utf-8')
      fs.renameSync(tmp, tomlPath)
      return true
    } catch (e: any) {
      console.error('[ModeSwitchService] toml 写入失败:', tomlPath, e?.message)
      return false
    }
  }

  // ============ 模式切换主流程 ============
  static async switchMode(target: OstMode): Promise<{ success: boolean; mode: OstMode; error?: string }> {
    const current = this.getMode()
    if (current === target) return { success: true, mode: target }
    if (this.busy) return { success: false, mode: current, error: 'BUSY' }
    if (TitanProtocol.hasActiveDeployment()) return { success: false, mode: current, error: 'DEPLOY_IN_PROGRESS' }

    this.busy = true
    try {
      // 前置对齐 ost_mode：确保缺包自动拉取及活根解析全程对齐目标模式；若中途失败则回滚为 current
      Db.set(this.MODE_KEY, target)
      await TitanProtocol.waitForPrefetch()

      if (!this.toolsCacheReady()) {
        const pull = await EngineService.pullLatest('ost', true)
        if (!pull?.success) { Db.set(this.MODE_KEY, current); return { success: false, mode: current, error: pull?.error ? TitanProtocol.translateError(pull.error, 'TOOLS_PULL_FAIL') : 'TOOLS_PULL_FAIL' } }
        if (!this.toolsCacheReady()) { Db.set(this.MODE_KEY, current); return { success: false, mode: current, error: 'TOOLS_PULL_INCOMPLETE' } }
      }

      const det = await SteamDetector.detect()
      const steamPath = det.path
      if (!steamPath) {
        Logger.error('ModeSwitchService', '模式切换失败: 未检测到 Steam 安装路径')
        Db.set(this.MODE_KEY, current)
        return { success: false, mode: current, error: 'STEAM_NOT_FOUND' }
      }

      await this.ensureSteamDead()

      const ostDir = this.ostDir
      const sourceRoot = target === 'pure' ? steamPath : ostDir
      const destRoot = target === 'pure' ? ostDir : steamPath
      if (!fs.existsSync(ostDir)) fs.mkdirSync(ostDir, { recursive: true })

      try {
        // 1. 安装核心 DLL（剔除 CR，纯覆盖分发）
        await this.deployArtifactsToRoot(destRoot)

        // 2. 从工具包直接安装 toml（纯覆盖，不再靠 moveFile 搬运，避免冷启动缺失）
        await this.installTomlToRoot(destRoot)

        // 3. 云存档数据实体随切换主动无感迁移：调用标准全量迁移方法，整目录及日志深度校验后迁移入 TC/ost
        try {
          const migRes = await CloudSaveService.migrateCrStorage()
          if (migRes.success) {
            console.info('[ModeSwitchService] 模式切换时存量云存档自动平滑迁移完成')
          }
        } catch (migErr) {
          console.warn('[ModeSwitchService] 模式切换时存量云存档迁移异常:', migErr)
        }

        // 4. 清理旧 .bak 备份及早期 bin/diversion*.dll 遗产（包含 opensteamtool.toml.bak，剔除 CR）
        await this.cleanLegacyDiversionFiles(steamPath)
        for (const f of ['OpenSteamTool.dll', 'xinput1_4.dll', 'dwmapi.dll', 'opensteamtool.toml']) {
          try { fs.unlinkSync(path.join(sourceRoot, `${f}.bak`)) } catch { }
        }

        // 5. 净化段：切纯净模式时强力清空 Steam 根残留工件（加持指数退避重试，杜绝杀软占用导致残留，扫净历史残留）
        if (target === 'pure') {
          for (const f of ['OpenSteamTool.dll', 'xinput1_4.dll', 'opensteamtool.toml', 'cloud_redirect.dll', 'cloud_redirect.log']) {
            await this.retryOp(() => {
              const p = path.join(steamPath, f)
              if (fs.existsSync(p)) fs.unlinkSync(p)
            })
          }
        } else {
          // 切经典模式时，清理 ostDir 下的旧核心件与 toml（保留 cloud_redirect）
          for (const f of ['OpenSteamTool.dll', 'opensteamtool.toml']) {
            await this.retryOp(() => {
              const p = path.join(ostDir, f)
              if (fs.existsSync(p)) fs.unlinkSync(p)
            })
          }
        }

        // 6. 插件 lua 目录全量覆盖迁移（以当前源端为唯一基准，零记账，杜绝旧文件残留）
        const srcLua = path.join(sourceRoot, 'config', 'lua')
        const dstLua = path.join(destRoot, 'config', 'lua')

        if (!fs.existsSync(dstLua)) {
          fs.mkdirSync(dstLua, { recursive: true })
        }

        if (fs.existsSync(srcLua)) {
          // 增量合并拷贝：严禁先 rmSync 清空 dstLua，防止源目录为空或部分缺失时把目标端存量 lua 抹空
          await this.copyDir(srcLua, dstLua)

          // 仅当切换到纯净模式、且校验源端所有 lua 文件均已完好落入目标端后，才清理 Steam 根目录残留
          if (target === 'pure') {
            const srcFiles = fs.readdirSync(srcLua).filter(f => f.toLowerCase().endsWith('.lua'))
            const allCopied = srcFiles.every(f => fs.existsSync(path.join(dstLua, f)))
            if (allCopied) {
              await this.retryOp(() => fs.rmSync(srcLua, { recursive: true, force: true }))
            }
          }
        }

        // 彻底铲除历史废弃的 lua_archive 永久底账目录，杜绝已卸载游戏死灰复燃
        const deadArchive = path.join(Db.getDataRoot(), 'lua_archive')
        if (fs.existsSync(deadArchive)) {
          try { fs.rmSync(deadArchive, { recursive: true, force: true }) } catch {}
        }

        const srcOstDir = path.join(sourceRoot, 'opensteamtool')
        if (fs.existsSync(srcOstDir)) {
          await this.copyDir(srcOstDir, path.join(destRoot, 'opensteamtool'))
          if (target === 'pure') {
            await this.retryOp(() => fs.rmSync(srcOstDir, { recursive: true, force: true }))
          }
        }

        // 7. 纯净化：抹除 Steam 根历史弃用的 dwmapi 废弃入口（加持退避重试）
        if (target === 'pure') {
          for (const f of ['dwmapi.dll', 'dwmapi.dll.bak']) {
            await this.retryOp(() => {
              const p = path.join(steamPath, f)
              if (fs.existsSync(p)) fs.unlinkSync(p)
            })
          }
        }
      } catch (e: any) {
        Db.set(this.MODE_KEY, current)
        Logger.error('ModeSwitchService', '模式切换部署文件失败:', e?.message || e)
        return { success: false, mode: current, error: TitanProtocol.translateError(e, 'DEPLOY_FAIL') }
      }

      // 8. 写入分流决策与配置项：精准落入当前活根 destRoot 的 opensteamtool.toml
      const tomlNow = path.join(destRoot, 'opensteamtool.toml')
      this.setTomlKey(tomlNow, 'diversion', 'enabled', target === 'pure' ? 'true' : 'false')
      const cloudEnabled = Db.get<boolean>('user_pref_cloud_save') ?? true
      this.setTomlKey(tomlNow, 'cloud', 'enabled', cloudEnabled ? 'true' : 'false')
      if (app.isPackaged) {
        this.setTomlKey(tomlNow, 'log', 'level', '"info"')
      }
      CloudSaveService.setTomlCloudEnabled(steamPath, cloudEnabled)

      // 9. 确保新活根下的 pattern / ipc 特征码同步就绪
      await PatternSyncService.validatePatterns().catch(() => {})

      // 无论切换任何模式，永久将 CR 云存档重定向模块固死在 TC/ost
      process.env.CR_STATE_DIR = ostDir;
      CloudSaveService.writeCrStateDirEnv(ostDir);

      Db.set(this.MODE_KEY, target)
      return { success: true, mode: target }
    } catch (e: any) {
      Db.set(this.MODE_KEY, current)
      Logger.error('ModeSwitchService', '模式切换发生未知未捕获异常:', e?.message || e)
      return { success: false, mode: current, error: TitanProtocol.translateError(e, 'ERR_ENGINE_SWITCH_FAIL') }
    } finally {
      this.busy = false
    }
  }
}