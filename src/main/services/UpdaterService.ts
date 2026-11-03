// 文件名: src/main/services/UpdaterService.ts
// TitanCore 更新管理服务 (架构重构版: 内置更新器自愈同步，杜绝外挂拉取报毒)
import { app, ipcMain, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { titanFetch } from '../TitanNet'
import { Db } from '../db'
import { DownloadService } from './DownloadService'
import { ArchiveService } from '../utils/ArchiveService'
import { RacingDownloader } from '../utils/RacingDownloader'

export class UpdaterService {
  private static isUpdating = false
  private static updateState: { ready: boolean; error: string | null } = { ready: false, error: null }

  /**
   * 定位内置的 TitanUpdater.exe 物理工件
   * 优先匹配打包后的 resources/bin，兼顾 Dev 开发环境资源穿透
   */
  private static get bundledUpdaterPath(): string | null {
    const candidates = [
      // 1. 生产打包环境: process.resourcesPath/bin (对应 package.json extraResources 规则)
      path.join(process.resourcesPath, 'bin', 'TitanUpdater.exe'),
      // 2. 开发环境与工作区备用候选
      path.join(app.getAppPath(), 'resources', 'bin', 'TitanUpdater.exe'),
      path.join(process.cwd(), 'resources', 'bin', 'TitanUpdater.exe'),
      path.join(path.dirname(process.execPath), 'resources', 'bin', 'TitanUpdater.exe')
    ]

    for (const cand of candidates) {
      if (fs.existsSync(cand)) return cand
    }
    return null
  }

  /**
   * 自愈式工件释放：将内置更新器同步至 %AppData%/titan-core/tools
   * 采用文件大小与修改时间双重校验，免除无意义的磁盘 IO，并在缺失/更新时自动覆盖
   */
  static ensureUpdaterBinary(): string {
    const toolsDir = path.join(app.getPath('userData'), 'tools')
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true })
    }

    const targetExe = path.join(toolsDir, 'TitanUpdater.exe')
    const bundledExe = this.bundledUpdaterPath

    if (bundledExe) {
      let needSync = true
      if (fs.existsSync(targetExe)) {
        try {
          const srcStat = fs.statSync(bundledExe)
          const dstStat = fs.statSync(targetExe)
          // 大小一致且目标文件未过期时跳过写盘
          if (srcStat.size === dstStat.size && dstStat.mtimeMs >= srcStat.mtimeMs) {
            needSync = false
          }
        } catch {
          needSync = true
        }
      }

      if (needSync) {
        try {
          fs.copyFileSync(bundledExe, targetExe)
          console.log('[UpdaterService] TitanUpdater.exe 已就绪并同步至:', targetExe)
        } catch (e: any) {
          console.warn('[UpdaterService] 同步 TitanUpdater.exe 失败:', e.message)
        }
      }
    } else {
      if (!fs.existsSync(targetExe)) {
        console.error('[UpdaterService] 严重告警: 未在 resources/bin 找到内置 TitanUpdater.exe，且本地 tools 目录缺失工件')
      }
    }

    return targetExe
  }

  /**
   * 静默清理更新临时缓存目录（解耦 C++ 更新器，由主程序合法清理）
   */
  private static cleanResidualUpdate(): void {
    try {
      const tmpDir = path.join(app.getPath('userData'), 'update')
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    } catch {}
  }

  static registerIpcHandlers() {
    // 启动即自检一次更新器工件
    this.ensureUpdaterBinary()

    // 启动后顺手物理清空上次更新留下的临时解压文件与 zip
    this.cleanResidualUpdate()

    ipcMain.removeHandler('app:check-update')
    ipcMain.handle('app:check-update', async () => {
      const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
      if (!serverUrl) return { hasUpdate: false }

      try {
        const res = await titanFetch(`${serverUrl}/titan/update_check.php?action=check`)
        const json = await res.json()
        const currentVersion = app.getVersion()

        return {
          hasUpdate: json.latest_version !== currentVersion,
          latestVersion: json.latest_version,
          currentVersion,
          mainUrls: json.main_urls,
          updaterUrls: json.updater_urls,
          mainSize: json.main_size,
          updaterSize: json.updater_size
        }
      } catch (e: any) {
        return { hasUpdate: false, error: e.message }
      }
    })

    ipcMain.removeHandler('app:get-version')
    ipcMain.handle('app:get-version', () => app.getVersion())

    ipcMain.removeHandler('app:start-update')
    ipcMain.handle('app:start-update', async () => {
      if (this.isUpdating) return { success: false, msg: 'UPDATE_IN_PROGRESS' }
      this.isUpdating = true

      const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
      if (!serverUrl) {
        this.isUpdating = false
        return { success: false, msg: 'ERR_SERVER_REQUIRED' }
      }

      let updateInfo: any
      try {
        const res = await titanFetch(`${serverUrl}/titan/update_check.php?action=check`)
        updateInfo = await res.json()
      } catch (e: any) {
        this.isUpdating = false
        return { success: false, msg: 'ERR_FETCH_UPDATE_INFO' }
      }

      this.backgroundUpdateProcess(updateInfo).catch(async (e) => {
        console.error('[UpdaterService] Background update failed:', e)
        this.updateState = { ready: false, error: e.message || 'ERR_DOWNLOAD_FAILED' }
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send('app:update-error', e.message || 'ERR_DOWNLOAD_FAILED')
        }
      })

      return { success: true, msg: 'UPDATE_STARTED' }
    })

    ipcMain.removeHandler('app:execute-update')
    ipcMain.handle('app:execute-update', async () => {
      // 防变砖前置校验：更新状态必须处于就绪，且解压产物必须真实非空
      if (!this.updateState.ready) {
        console.error('[UpdaterService] 拦截执行更新: 更新包尚未就绪')
        return { success: false, msg: 'ERR_UPDATE_NOT_READY' }
      }
      const installDir = path.dirname(app.getPath('exe'))
      const updaterExe = this.ensureUpdaterBinary()
      const tmpDir = path.join(app.getPath('userData'), 'update')
      const extractDir = path.join(tmpDir, 'extracted')

      if (!fs.existsSync(updaterExe)) {
        console.error('[UpdaterService] 执行更新失败: 找不到 TitanUpdater.exe')
        return { success: false, msg: 'ERR_UPDATER_NOT_FOUND' }
      }

      if (!fs.existsSync(extractDir) || fs.readdirSync(extractDir).length === 0) {
        console.error('[UpdaterService] 拦截执行更新: 解压目标目录为空，拒绝破坏性覆盖')
        return { success: false, msg: 'ERR_EXTRACTED_PAYLOAD_EMPTY' }
      }

      // 拉起外部更新器并解耦运行
      spawn(updaterExe, [
        '--pid', String(process.pid),
        '--source', extractDir,
        '--target', installDir
      ], {
        detached: true,
        windowsHide: false, // 允许暗黑科幻 UI 界面合规显示
        stdio: 'ignore'
      }).unref()

      setTimeout(() => app.quit(), 500)
      return { success: true }
    })

    ipcMain.removeHandler('app:get-update-state')
    ipcMain.handle('app:get-update-state', () => this.updateState)
  }

  /**
   * 后台静默下载解压主程序
   * 架构优化: 接入统一 RacingDownloader 与 ArchiveService，支持渐进式 SHA256 校验
   */
  private static async backgroundUpdateProcess(updateInfo: any) {
    const tmpDir = path.join(app.getPath('userData'), 'update')
    const extractDir = path.join(tmpDir, 'extracted')

    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true })
      fs.mkdirSync(extractDir, { recursive: true })

      // 1. 确保内置更新器已被释放并同步至 tools 目录
      this.ensureUpdaterBinary()

      const mainUrls = updateInfo.main_urls || []
      if (mainUrls.length === 0) throw new Error('ERR_NO_AVAILABLE_MIRROR')

      const titancoreZipPath = path.join(tmpDir, 'titancore.zip')

      // 2. 调用统一竞速器：若 updateInfo 下发了 sha256 则自动比对，未下发则直接放行
      await RacingDownloader.raceLargeArchive(mainUrls, {
        destPath: titancoreZipPath,
        expectedSha256: updateInfo.sha256,
        label: 'CLIENT_UPDATE'
      })

      // 3. 统一解压服务
      await ArchiveService.extract(titancoreZipPath, extractDir)

      // 防变砖校验：解压目录必须存在且有实体文件释放
      if (!fs.existsSync(extractDir) || fs.readdirSync(extractDir).length === 0) {
        throw new Error('ERR_EXTRACTED_PAYLOAD_EMPTY')
      }

      this.updateState = { ready: true, error: null }

      const win = BrowserWindow.getAllWindows()[0]
      if (win && !win.isDestroyed()) {
        win.webContents.send('app:update-ready')
      }

    } catch (e: any) {
      this.updateState = { ready: false, error: e.message || 'ERR_DOWNLOAD_FAILED' }
      throw e
    } finally {
      this.isUpdating = false
    }
  }
}
