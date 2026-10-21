// 文件名: src/main/services/ModeSwitchService.ts
// TC 侧适配: 纯净/经典模式切换服务
// 规范: 彻底解耦 CR 依赖、复用 deploy 安装语义纯覆盖安装、加固 dev 开发环境回退
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { Db } from '../db'
import { app } from 'electron'
import { SteamDetector } from './SteamDetector'
import { PatternSyncService } from './PatternSyncService'
import { CloudSaveService } from './CloudSaveService'

const execFileAsync = promisify(execFile)
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export type OstMode = 'pure' | 'classic'

export class ModeSwitchService {
  private static readonly MODE_KEY = 'ost_mode'
  static readonly FAMILY_LIBRARY_MODE_KEY = 'user_pref_family_library_mode'
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

  private static deployBusyFn: (() => boolean) | null = null
  static setDeployBusyChecker(fn: () => boolean): void {
    this.deployBusyFn = fn
  }

  private static deployTrigger: (() => Promise<{ success: boolean; error?: string }>) | null = null
  static setDeployTrigger(fn: () => Promise<{ success: boolean; error?: string }>): void {
    this.deployTrigger = fn
  }

  // 改造：自检必要基础运行件（CR 钉死 ostDir，不作为切换阻塞条件）
  private static toolsCacheReady(): boolean {
    const required = ['OpenSteamTool.dll', 'xinput1_4.dll', 'cloud_redirect.dll', 'opensteamtool.toml']
    if (required.every(f => !!this.findInDir(this.toolsDir, f))) return true

    // 本地缓存自愈：若工具目录缺失散装文件但存在已下载的 tool.zip，先走本地解压
    const localZip = path.join(this.toolsDir, 'tool.zip')
    if (fs.existsSync(localZip)) {
      try {
        const { execFileSync } = require('node:child_process')
        const { resolve7z } = require('../utils/resolve7z')
        const z = resolve7z()
        if (z?.sevenZipPath && fs.existsSync(z.sevenZipPath)) {
          execFileSync(z.sevenZipPath, ['x', localZip, `-o${this.toolsDir}`, '-y', '-aoa'], { timeout: 30000, windowsHide: true })
          if (required.every(f => !!this.findInDir(this.toolsDir, f))) return true
        }
      } catch {}
    }
    return false
  }

  // 改造：加固全环境穿透。若 userData 下无完整包，自动穿透寻找各安装与资源目录下的 tools
  static get toolsDir(): string { 
    const defaultTools = path.join(app.getPath('userData'), 'tools');
    if (!this.checkDirHasTools(defaultTools)) {
      const candidates = [
        path.join(app.getAppPath(), 'tools'),
        path.join(app.getAppPath(), 'resources', 'tools'),
        path.join(process.cwd(), 'tools'),
        path.join(process.cwd(), 'resources', 'tools'),
        path.join(path.dirname(process.execPath), 'resources', 'tools'),
        path.join(path.dirname(process.execPath), 'tools'),
        path.join(process.resourcesPath || '', 'tools')
      ];
      for (const cand of candidates) {
        if (this.checkDirHasTools(cand)) {
          return cand;
        }
      }
    }
    return defaultTools;
  }

  private static checkDirHasTools(dir: string): boolean {
    if (!dir || !fs.existsSync(dir)) return false;
    return !!(this.findInDir(dir, 'OpenSteamTool.dll') && this.findInDir(dir, 'xinput1_4.dll'));
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

  // TC: 一键初始化环境修复（系统自检 dll/toml 缺失入口；强杀 -> 铺文件 -> 重跑诊断全绿）
  static async repairEnvironment(): Promise<{ success: boolean; error?: string }> {
    if (this.busy || (this.deployBusyFn && this.deployBusyFn())) {
      return { success: false, error: 'BUSY_DEPLOYING' }
    }

    this.busy = true
    try {
      const det = await SteamDetector.detect()
      const steamPath = det?.path
      if (!steamPath) return { success: false, error: 'STEAM_NOT_FOUND' }

      await this.ensureSteamDead()

      if (!this.toolsCacheReady()) {
        if (!this.deployTrigger) return { success: false, error: 'DEPLOY_TRIGGER_MISSING' }
        // 解除自锁：拉包期间临时释放 busy，防止被 TitanProtocol 自身拦截
        this.busy = false
        const pull = await this.deployTrigger()
        this.busy = true
        if (!pull?.success) return { success: false, error: 'TOOLS_PULL_FAIL:' + (pull?.error || '') }
      }

      // TC-P32: 一键环境修复时，纯净模式必须强力净化 Steam 根，杜绝代理残留与注入器冲突
      if (this.getMode() === 'pure') {
        for (const f of ['xinput1_4.dll', 'xinput1_4.dll.bak', 'dwmapi.dll', 'dwmapi.dll.bak']) {
          await this.retryOp(() => {
            const p = path.join(steamPath, f);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          });
        }
      }

      const activeRoot = this.getActiveRoot(steamPath)

      // lay down core dlls + base toml + CR
      await this.deployArtifactsToRoot(activeRoot)
      await this.installTomlToRoot(activeRoot)

      // restore diversion flag and cloud-save toggle
      const tomlNow = path.join(activeRoot, 'opensteamtool.toml')
      this.setTomlKey(tomlNow, 'diversion', 'enabled', this.getMode() === 'pure' ? 'true' : 'false')
      const cloudEnabled = Db.get<boolean>('user_pref_cloud_save') ?? true
      CloudSaveService.setTomlCloudEnabled(activeRoot, cloudEnabled)

      // chain pattern alignment in the same transaction (no double-click)
      await PatternSyncService.validatePatterns().catch(() => {})

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message || 'REPAIR_FAIL' }
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

  // ============ 模式查询 ============
  static getMode(): OstMode {
    const recorded = Db.get<string>(this.MODE_KEY)
    if (recorded === 'pure' || recorded === 'classic') return recorded
    return fs.existsSync(path.join(this.ostDir, 'OpenSteamTool.dll')) ? 'pure' : 'classic'
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
  private static async isSteamRunning(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf-8', timeout: 5000 })
      return stdout.toLowerCase().includes('steam.exe')
    } catch {
      return false
    }
  }

  static async ensureSteamDead(): Promise<void> {
    if (!await this.isSteamRunning()) return
    try { await execFileAsync('taskkill', ['/F', '/T', '/IM', 'steam.exe'], { timeout: 5000 }) } catch { }
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      if (!await this.isSteamRunning()) break
      await delay(100)
    }
    await delay(300)
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

  
  static async getFamilyLibraryMode(): Promise<boolean> {
    const pref = Db.get<boolean>(this.FAMILY_LIBRARY_MODE_KEY)
    if (typeof pref === 'boolean') return pref

    try {
      const det = await SteamDetector.detect()
      const activeRoot = this.getRootSync(det?.path) || this.ostDir
      const tomlPath = path.join(activeRoot, 'opensteamtool.toml')
      if (fs.existsSync(tomlPath)) {
        const content = fs.readFileSync(tomlPath, 'utf-8')
        const match = content.match(/family_library_mode\s*=\s*(true|false)/i)
        if (match) {
          const val = match[1].toLowerCase() === 'true'
          Db.set(this.FAMILY_LIBRARY_MODE_KEY, val)
          return val
        }
      }
    } catch {}
    return false
  }

  static async setFamilyLibraryMode(enabled: boolean): Promise<boolean> {
    Db.set(this.FAMILY_LIBRARY_MODE_KEY, enabled)
    const valStr = enabled ? 'true' : 'false'

    try {
      const det = await SteamDetector.detect()
      const steamPath = det?.path
      const activeRoot = this.getRootSync(steamPath) || this.ostDir

      const activeToml = path.join(activeRoot, 'opensteamtool.toml')
      if (fs.existsSync(activeToml)) {
        this.setTomlKey(activeToml, 'general', 'family_library_mode', valStr)
      }

      const tcToml = path.join(this.ostDir, 'opensteamtool.toml')
      if (fs.existsSync(tcToml) && path.resolve(tcToml).toLowerCase() !== path.resolve(activeToml).toLowerCase()) {
        this.setTomlKey(tcToml, 'general', 'family_library_mode', valStr)
      }

      if (steamPath) {
        const steamToml = path.join(steamPath, 'opensteamtool.toml')
        if (fs.existsSync(steamToml) && path.resolve(steamToml).toLowerCase() !== path.resolve(activeToml).toLowerCase()) {
          this.setTomlKey(steamToml, 'general', 'family_library_mode', valStr)
        }
      }
      return true
    } catch (e: any) {
      console.error('[ModeSwitchService] setFamilyLibraryMode 失败:', e?.message)
      return false
    }
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
    if (this.deployBusyFn && this.deployBusyFn()) return { success: false, mode: current, error: 'DEPLOY_IN_PROGRESS' }

    if (!this.toolsCacheReady()) {
      if (!this.deployTrigger) return { success: false, mode: current, error: 'DEPLOY_TRIGGER_MISSING' }
      const pull = await this.deployTrigger()
      if (!pull?.success) return { success: false, mode: current, error: 'TOOLS_PULL_FAIL:' + (pull?.error || '') }
      if (!this.toolsCacheReady()) return { success: false, mode: current, error: 'TOOLS_PULL_INCOMPLETE' }
    }

    this.busy = true
    try {
      const det = await SteamDetector.detect()
      const steamPath = det.path
      if (!steamPath) return { success: false, mode: current, error: 'STEAM_NOT_FOUND' }

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

        // 4. 清理旧 .bak 备份（包含 opensteamtool.toml.bak，剔除 CR）
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
          // 切经典模式时，清理 ostDir 下的旧 toml
          await this.retryOp(() => {
            const p = path.join(ostDir, 'opensteamtool.toml')
            if (fs.existsSync(p)) fs.unlinkSync(p)
          })
        }

        // 6. 插件 lua 目录全量覆盖迁移（以当前源端为唯一基准，零记账，杜绝旧文件残留）
        const srcLua = path.join(sourceRoot, 'config', 'lua')
        const dstLua = path.join(destRoot, 'config', 'lua')

        if (fs.existsSync(srcLua)) {
          // 清理目标端旧残留，确保目标端 100% 与当前源端镜像对齐
          if (fs.existsSync(dstLua)) {
            await this.retryOp(() => fs.rmSync(dstLua, { recursive: true, force: true }))
          }
          fs.mkdirSync(dstLua, { recursive: true })
          // 全量覆盖拷贝
          await this.copyDir(srcLua, dstLua)

          // 仅当切换到纯净模式时，按纯净原则清理 Steam 根目录下的残留
          if (target === 'pure') {
            await this.retryOp(() => fs.rmSync(srcLua, { recursive: true, force: true }))
          }
        } else if (!fs.existsSync(dstLua)) {
          fs.mkdirSync(dstLua, { recursive: true })
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
        return { success: false, mode: current, error: 'DEPLOY_FAIL:' + (e?.message || e) }
      }

      // 8. 写入分流决策：纯净模式 diversion=true，经典模式 diversion=false
      const tomlNow = path.join(destRoot, 'opensteamtool.toml')
      this.setTomlKey(tomlNow, 'diversion', 'enabled', target === 'pure' ? 'true' : 'false')
      const cloudEnabled = Db.get<boolean>('user_pref_cloud_save') ?? true
      CloudSaveService.setTomlCloudEnabled(destRoot, cloudEnabled)
      const familyModeTarget = Db.get<boolean>(this.FAMILY_LIBRARY_MODE_KEY) ?? false
      this.setTomlKey(tomlNow, 'general', 'family_library_mode', familyModeTarget ? 'true' : 'false')

      // 无论切换任何模式，永久将 CR 云存档重定向模块固死在 TC/ost
      process.env.CR_STATE_DIR = ostDir;
      CloudSaveService.writeCrStateDirEnv(ostDir);

      Db.set(this.MODE_KEY, target)
      return { success: true, mode: target }
    } catch (e: any) {
      return { success: false, mode: current, error: e?.message || 'UNKNOWN' }
    } finally {
      this.busy = false
    }
  }
}