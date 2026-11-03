// 文件路径: src/main/services/ToolService.ts
// TC fix50: 外部工具生命周期服务 (DLC管理 / ASF挂卡 - 竞速下载/进程守护/单例并发锁)
import { app, ipcMain, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { Db } from '../db'
import { DownloadService } from './DownloadService'
import { ArchiveService } from '../utils/ArchiveService'
import { titanFetch } from '../TitanNet'

export interface ToolDef {
  id: string        // 客户端内部工具 id (ipc/路径用)
  toolDir: string   // toolsRoot 下专属父目录: 'dlcmanager' / 'tcasf'
  zipName: string   // 压缩包名: 'Titan-DlcTool.zip' / 'TC_ASF.zip'
  dirName: string   // zip 外层目录: 'Titan-DlcTool' / '' (为空表示首层直接展开)
  exeRel: string    // 可执行文件相对名: 'Titan-DlcTool.exe' / 'titan-asf.exe'
  killImage: string // taskkill 映像名
  prefKey?: string  // 显隐 config key: 'pref_tool_dlc_visible' (留空表示仅在实验功能内)
  serverKey: string // tool_download.php 的 tool 键 ('dlc' / 'asf')
  nameKey: string   // i18n key
  icon: string
}

const TOOLS: ToolDef[] = [
  {
    id: 'dlc_manager',
    toolDir: 'dlcmanager',
    zipName: 'Titan-DlcTool.zip',
    dirName: 'Titan-DlcTool',
    exeRel: 'Titan-DlcTool.exe',
    killImage: 'Titan-DlcTool.exe',
    prefKey: 'pref_tool_dlc_visible',
    serverKey: 'dlc',
    nameKey: 'settings.exp.tools.dlc',
    icon: '🧩'
  },
  {
    id: 'asf',
    toolDir: 'tcasf',
    zipName: 'TC_ASF.zip',
    dirName: 'TC_ASF',
    exeRel: 'titan-asf.exe',
    killImage: 'titan-asf.exe',
    prefKey: '',
    serverKey: 'asf',
    nameKey: 'settings.exp.tools.asf',
    icon: '⚡'
  },
  {
    id: 'titan_patcher',
    toolDir: 'TitanPatcher',
    zipName: 'TitanPatcher.zip',
    dirName: '',
    exeRel: 'TitanPatcher.exe',
    killImage: 'TitanPatcher.exe',
    prefKey: '',
    serverKey: 'patcher',
    nameKey: 'settings.exp.tools.patcher',
    icon: ''
  },
  {
    id: 'steamless',
    toolDir: 'steamless',
    zipName: 'Steamless.zip',
    dirName: '',
    exeRel: 'Steamless.CLI.exe',
    killImage: 'Steamless.CLI.exe',
    prefKey: '',
    serverKey: 'steamless',
    nameKey: 'settings.exp.tools.steamless',
    icon: '🛡️'
  }
]

const RACE_WINDOW_MS = 15000
const RACE_POLL_MS = 500
const RACE_LIMIT_BYTES = 1024 * 1024

function mustGetTool(toolId: string): ToolDef {
  const def = TOOLS.find(x => x.id === toolId)
  if (!def) throw new Error('ERR_TOOL_NOT_FOUND:' + toolId)
  return def
}

export class ToolService {
  // 核心修复: 主进程单例任务锁，彻底解决弹窗反复开关触发重复下载的 BUG
  private static inFlightInstalls = new Map<string, Promise<{ success: boolean; error?: string }>>()
  private static inFlightUninstalls = new Map<string, Promise<{ success: boolean; error?: string }>>()

  static resolveToolsRoot(): string {
    const base = app.isPackaged ? path.dirname(process.resourcesPath) : app.getAppPath()
    return path.join(base, 'tools')
  }

  static assertInsideToolsRoot(target: string): void {
    const root = path.resolve(this.resolveToolsRoot()).toLowerCase()
    const t = path.resolve(target).toLowerCase()
    if (t !== root && !t.startsWith(root + path.sep)) {
      throw new Error('ERR_TOOL_PATH_ESCAPE:' + target)
    }
  }

  static getToolDir(toolId: string): string {
    const def = mustGetTool(toolId)
    const dir = path.resolve(this.resolveToolsRoot(), def.toolDir)
    this.assertInsideToolsRoot(dir)
    return dir
  }

  static getExePath(toolId: string): string {
    const def = mustGetTool(toolId)
    const baseDir = this.getToolDir(toolId)

    // 1. 优先按配置的 dirName 路径探测
    if (def.dirName) {
      const p = path.resolve(baseDir, def.dirName, def.exeRel)
      if (fs.existsSync(p)) return p
    }

    // 2. 尝试根目录平铺探测
    const flatPath = path.resolve(baseDir, def.exeRel)
    if (fs.existsSync(flatPath)) return flatPath

    // 3. 动态扫描一级子目录智能自愈
    try {
      if (fs.existsSync(baseDir)) {
        for (const item of fs.readdirSync(baseDir, { withFileTypes: true })) {
          if (item.isDirectory()) {
            const candidate = path.join(baseDir, item.name, def.exeRel)
            if (fs.existsSync(candidate)) return candidate
          }
        }
      }
    } catch {}

    const sub = def.dirName ? path.join(def.dirName, def.exeRel) : def.exeRel
    const exe = path.resolve(baseDir, sub)
    this.assertInsideToolsRoot(exe)
    return exe
  }

  static probeInstalled(toolId: string): boolean {
    try {
      return fs.existsSync(this.getExePath(toolId))
    } catch {
      return false
    }
  }

  static async status(toolId: string): Promise<{ installed: boolean; installing: boolean; uninstalling: boolean }> {
    return {
      installed: this.probeInstalled(toolId),
      installing: this.inFlightInstalls.has(toolId),
      uninstalling: this.inFlightUninstalls.has(toolId)
    }
  }

  static async fetchToolUrls(toolId: string): Promise<{ urls: string[]; sha1?: string; size?: number }> {
    const def = mustGetTool(toolId)
    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || ''
    const token = Db.getEncrypted<any>('auth_ticket')?.token
    if (!sUrl || !token) throw new Error('ERR_TOOL_UNAUTHORIZED')

    try {
      const res = await titanFetch(`${sUrl}/titan/tool_download.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Titan-Token': token },
        body: JSON.stringify({ action: 'get', tool: def.serverKey })
      })
      if (!res.ok) throw new Error(`ERR_TOOL_SERVER:${res.status}`)
      const json = await res.json() as { code?: number; msg?: string; data?: { urls?: string[]; sha1?: string; size?: number } }
      if (json.code !== 200) throw new Error('ERR_TOOL_SERVER:' + (json.msg || 'UNKNOWN'))

      const payload = json.data
      const rawUrls: string[] = Array.isArray(payload?.urls) ? payload.urls : []

      const urls = rawUrls.filter(u => {
        if (typeof u !== 'string') return false
        const clean = u.trim().toLowerCase()
        return clean.startsWith('http') && clean.indexOf('replace_me') === -1
      })

      if (urls.length === 0) throw new Error('ERR_TOOL_SERVER:NO_VALID_URLS')
      return { urls, sha1: payload?.sha1, size: payload?.size }
    } catch (e: any) {
      console.error('[ToolService] fetchToolUrls 失败:', def.id, e?.message || e)
      throw e
    }
  }

  private static async raceDownload(urls: string[], raceDir: string, base: string, expectedSize?: number): Promise<{ zipPath: string; winnerGid: string }> {
    fs.mkdirSync(raceDir, { recursive: true })
    const gids: string[] = []
    const disqualified = new Set<number>()
    const toolToken = Db.getEncrypted<any>('auth_ticket')?.token || ''

    const MIN_VALID_BYTES = expectedSize ? Math.floor(expectedSize * 0.5) : 50 * 1024

    try {
      for (let i = 0; i < urls.length; i++) {
        const isFallback = urls[i].indexOf('/titan/tool_download.php') >= 0
        const headers: string[] = ['Accept-Encoding: identity']
        if (isFallback && toolToken) {
          headers.push(`X-Titan-Token: ${toolToken}`)
        }
        const gid = await DownloadService.addUri(urls[i], {
          dir: raceDir,
          title: `${base}-r${i}.zip`,
          header: headers
        })
        if (gid === '__BROWSER_FALLBACK__') throw new Error('ERR_TOOL_BROWSER_FALLBACK')
        gids.push(gid)
      }

      const start = Date.now()
      let winnerIdx = -1

      while (Date.now() - start < RACE_WINDOW_MS) {
        for (let i = 0; i < gids.length; i++) {
          if (disqualified.has(i)) continue
          const st = await DownloadService.tellStatus(gids[i])
          if (!st) continue
          const done = parseInt(st.completedLength) || 0

          if (st.status === 'error') {
            disqualified.add(i)
            continue
          }

          if (st.status === 'complete') {
            if (done < MIN_VALID_BYTES) {
              console.warn(`[ToolService] 镜像 #${i} 返回内容过小 (${done}B < ${MIN_VALID_BYTES}B)，剔除`)
              disqualified.add(i)
              await DownloadService.removeTask(gids[i]).catch(() => {})
              continue
            }
            winnerIdx = i
            break
          }

          if (done >= RACE_LIMIT_BYTES) {
            winnerIdx = i
            break
          }
        }

        if (winnerIdx >= 0) break

        const alive = gids.map((_, idx) => idx).filter(idx => !disqualified.has(idx))
        if (alive.length === 0) throw new Error('ERR_ALL_MIRRORS_DOWN')
        if (alive.length === 1 && Date.now() - start > 1500) {
          winnerIdx = alive[0]
          break
        }
        await new Promise(r => setTimeout(r, RACE_POLL_MS))
      }

      if (winnerIdx < 0) {
        let best = -1
        for (let i = 0; i < gids.length; i++) {
          if (disqualified.has(i)) continue
          const st = await DownloadService.tellStatus(gids[i])
          const done = st ? (parseInt(st.completedLength) || 0) : 0
          if (done > best) {
            best = done
            winnerIdx = i
          }
        }
        if (best <= 0) throw new Error('ERR_ALL_MIRRORS_DOWN')
      }

      for (let i = 0; i < gids.length; i++) {
        if (i !== winnerIdx) await DownloadService.removeTask(gids[i]).catch(() => {})
      }

      await DownloadService.waitForCompletion(gids[winnerIdx], 1800000)
      const finalZip = path.join(raceDir, `${base}-r${winnerIdx}.zip`)

      if (!fs.existsSync(finalZip)) throw new Error('ERR_TOOL_FILE_MISSING')
      const stat = fs.statSync(finalZip)
      if (stat.size < MIN_VALID_BYTES) {
        console.error(`[ToolService] 下载实体损坏: 仅 ${stat.size} 字节，小于期望下限 ${MIN_VALID_BYTES} 字节`)
        throw new Error('ERR_TOOL_DOWNLOAD_CORRUPT')
      }

      return { zipPath: finalZip, winnerGid: gids[winnerIdx] }
    } catch (e) {
      for (const gid of gids) await DownloadService.removeTask(gid).catch(() => {})
      throw e
    }
  }

  private static async sha1OfFile(file: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha1')
      const s = fs.createReadStream(file)
      s.on('data', d => hash.update(d))
      s.on('end', () => resolve(hash.digest('hex')))
      s.on('error', reject)
    })
  }

  static async install(toolId: string): Promise<{ success: boolean; error?: string }> {
    const def = mustGetTool(toolId)
    if (this.probeInstalled(def.id)) return { success: true }

    // 并发防护：若当前工具已在下载安装流程中，直接复用其 Promise，杜绝重复下载！
    const existing = this.inFlightInstalls.get(def.id)
    if (existing) {
      console.log(`[ToolService] 工具 ${def.id} 正在下载安装中，复用当前任务`)
      return await existing
    }

    const task = (async () => {
      try {
        const { urls, sha1, size } = await this.fetchToolUrls(def.id)
        const parentDir = this.getToolDir(def.id)
        fs.mkdirSync(parentDir, { recursive: true })
        const raceDir = path.join(parentDir, `.race-${Date.now()}`)
        let winnerGid = ''

        try {
          const raceRes = await this.raceDownload(urls, raceDir, def.id, size)
          winnerGid = raceRes.winnerGid
          const zipPath = raceRes.zipPath

          if (sha1 && String(sha1).trim()) {
            const actual = await this.sha1OfFile(zipPath)
            if (actual.toLowerCase() !== String(sha1).trim().toLowerCase()) {
              console.error(`[ToolService] SHA1 校验熔断: 期望=${sha1} 实际=${actual}`)
              throw new Error('ERR_TOOL_SHA1')
            }
          }

          // 解压前释放可能运行中的旧进程占用，防止 Windows 文件写锁导致解压失败
          await this.taskkillAsync(def.killImage)
          if (def.id === 'asf') {
            await this.taskkillAsync('ArchiSteamFarm.exe')
          }

          // 强制覆盖解压，避免已有同名文件导致冲突报错
          await ArchiveService.extract(zipPath, parentDir, { overwrite: true })
        } finally {
          if (winnerGid) {
            await DownloadService.removeTask(winnerGid).catch(() => {})
          }
          try {
            await this.rmWithRetry(raceDir, 3)
          } catch (e) {
            console.error('[ToolService] raceDir 清理失败:', raceDir, e)
          }
        }

        if (!this.probeInstalled(def.id)) throw new Error('ERR_TOOL_EXE_MISSING')
        console.log(`[ToolService] install OK: ${def.id}`)
        return { success: true }
      } catch (e: any) {
        console.error('[ToolService] install 失败:', def.id, e?.message || e)
        return { success: false, error: e?.message || 'ERR_TOOL_INSTALL' }
      }
    })()

    this.inFlightInstalls.set(def.id, task)
    try {
      return await task
    } finally {
      this.inFlightInstalls.delete(def.id)
    }
  }

  private static async taskkillAsync(image: string): Promise<void> {
    await new Promise<void>(resolve => {
      try {
        execFile('taskkill', ['/F', '/T', '/IM', image], () => resolve())
      } catch {
        resolve()
      }
    })
  }

  private static async isProcessRunning(image: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      try {
        execFile('tasklist', ['/FI', 'IMAGENAME eq ' + image, '/NH'], (err, stdout) => {
          if (err || !stdout) return resolve(false)
          resolve(stdout.toLowerCase().includes(image.toLowerCase()))
        })
      } catch {
        resolve(false)
      }
    })
  }

  private static async rmWithRetry(target: string, tries = 3): Promise<void> {
    let lastErr: any = null
    for (let i = 0; i < tries; i++) {
      try {
        fs.rmSync(target, { recursive: true, force: true })
        return
      } catch (e) {
        lastErr = e
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, i)))
      }
    }
    throw lastErr
  }

  static async uninstall(toolId: string): Promise<{ success: boolean; error?: string }> {
    const def = mustGetTool(toolId)

    const existing = this.inFlightUninstalls.get(def.id)
    if (existing) {
      return await existing
    }

    const task = (async () => {
      try {
        const target = this.getToolDir(def.id)
        await this.taskkillAsync(def.killImage)
        // 关键级联清理: 卸载 ASF 时同时杀死后台 ArchiSteamFarm.exe，释放文件占用锁
        if (def.id === 'asf') {
          await this.taskkillAsync('ArchiSteamFarm.exe')
        }
        await this.rmWithRetry(target)
        console.log(`[ToolService] uninstall OK: ${def.id}`)
        return { success: true }
      } catch (e: any) {
        console.error('[ToolService] uninstall 失败:', def.id, e?.message || e)
        return { success: false, error: e?.message || 'ERR_TOOL_UNINSTALL' }
      }
    })()

    this.inFlightUninstalls.set(def.id, task)
    try {
      return await task
    } finally {
      this.inFlightUninstalls.delete(def.id)
    }
  }

  static async launch(toolId: string, payload?: { appid?: string }): Promise<{ success: boolean; error?: string }> {
    const def = mustGetTool(toolId)
    try {
      const exePath = this.getExePath(def.id)
      if (!fs.existsSync(exePath)) return { success: false, error: 'ERR_TOOL_NOT_INSTALLED' }

      const args: string[] = []
      const appid = String(payload?.appid ?? '').trim()
      if (/^\d+$/.test(appid)) {
        args.push('--appid', appid)
      }

      const child = spawn(exePath, args, { detached: true, stdio: 'ignore', cwd: path.dirname(exePath) })
      child.on('error', err => {
        console.error('[ToolService] launch 子进程异常:', def.id, err?.message || err)
      })
      child.unref()
      return { success: true }
    } catch (e: any) {
      console.error('[ToolService] launch 失败:', def.id, e?.message || e)
      return { success: false, error: e?.message || 'ERR_TOOL_LAUNCH' }
    }
  }

  /**
   * 确保 TitanPatcher 为最新版本 (未安装自动下载，有新版本自动更新)
   */
  static async ensureLatestPatcher(): Promise<{ success: boolean; exePath?: string; error?: string }> {
    const toolId = 'titan_patcher'
    const exePath = this.getExePath(toolId)
    const localSha1Key = 'pref_tool_sha1_titan_patcher'
    let installed = this.probeInstalled(toolId)

    // 智能防呆自愈：如果本地目标工具目录尚无可执行文件，但开发工作区已就绪，立即秒级复制自愈
    if (!installed) {
      const devSourceDir = 'D:\\工作\\TitanPatcher'
      const devExe = path.join(devSourceDir, 'TitanPatcher.exe')
      if (fs.existsSync(devExe)) {
        try {
          const parentDir = this.getToolDir(toolId)
          fs.mkdirSync(parentDir, { recursive: true })
          for (const item of ['TitanPatcher.exe', '7z.exe', '7z.dll']) {
            const s = path.join(devSourceDir, item)
            const d = path.join(parentDir, item)
            if (fs.existsSync(s) && !fs.existsSync(d)) {
              fs.copyFileSync(s, d)
            }
          }
          installed = this.probeInstalled(toolId)
          if (installed) {
            console.log('[ToolService] TitanPatcher 本地开发资源自愈就绪')
          }
        } catch (err: any) {
          console.warn('[ToolService] 本地开发资源自愈拷贝跳过:', err?.message)
        }
      }
    }

    try {
      let remoteMeta: { urls: string[]; sha1?: string; size?: number } | null = null
      let fetchError = ''
      try {
        remoteMeta = await this.fetchToolUrls(toolId)
      } catch (err: any) {
        fetchError = err?.message || 'ERR_FETCH_META'
        console.warn('[ToolService] 查询最新 Patcher 元数据失败:', fetchError)
      }

      const recordedSha1 = Db.get<string>(localSha1Key) || ''
      const needInstallOrUpdate = !installed || (remoteMeta?.sha1 && recordedSha1 !== remoteMeta.sha1)

      if (needInstallOrUpdate && remoteMeta && remoteMeta.urls.length > 0) {
        console.log(`[ToolService] TitanPatcher 需要安装或更新, 正在拉取最新版本...`)
        const parentDir = this.getToolDir(toolId)
        fs.mkdirSync(parentDir, { recursive: true })
        const raceDir = path.join(parentDir, `.race-${Date.now()}`)
        let winnerGid = ''

        try {
          const raceRes = await this.raceDownload(remoteMeta.urls, raceDir, toolId, remoteMeta.size)
          winnerGid = raceRes.winnerGid
          const zipPath = raceRes.zipPath

          await this.taskkillAsync('TitanPatcher.exe')
          await ArchiveService.extract(zipPath, parentDir, { overwrite: true })

          if (remoteMeta.sha1) {
            Db.set(localSha1Key, remoteMeta.sha1)
          }
        } finally {
          if (winnerGid) {
            await DownloadService.removeTask(winnerGid).catch(() => {})
          }
          try {
            await this.rmWithRetry(raceDir, 3)
          } catch {}
        }
      }

      if (fs.existsSync(exePath)) {
        return { success: true, exePath }
      }
      return { success: false, error: fetchError ? `拉取补丁助手失败: ${fetchError}` : '未能就绪补丁助手可执行文件' }
    } catch (e: any) {
      if (fs.existsSync(exePath)) {
        return { success: true, exePath }
      }
      return { success: false, error: e?.message || 'ERR_ENSURE_PATCHER' }
    }
  }

  /**
   * 显式打开 TitanPatcher
   */
  /**
   * 显式打开 TitanPatcher
   * 采用三大反杀软误报防卫架构:
   * 1. 安全离线任务桥 (pending_task.json): 彻底废除命令行长参数传递，避开 360 命令行敏感特征扫描;
   * 2. Windows Shell 委托脱钩: 通过 cmd.exe /c start 启动，脱离当前 Node.js 进程树，等同用户双击;
   * 3. 规范目录优先: 优先在工具本地缓存目录落地，杜绝 AppData 高危报警。
   */
  static async openPatcher(zipPath?: string, autoMode = false): Promise<{ success: boolean; error?: string }> {
    const res = await this.ensureLatestPatcher()
    if (!res.success || !res.exePath) {
      return { success: false, error: res.error || '未能准备好官方补丁助手' }
    }

    const exeDir = path.dirname(res.exePath)

    // 1. 通过【安全离线任务桥】投递任务 (如果提供了 zipPath)
    if (zipPath) {
      const taskPayload = JSON.stringify({ zipPath, autoMode })
      const targets = [
        path.join(exeDir, 'pending_task.json'),
        path.join(app.getPath('userData'), 'pending_task.json')
      ]
      for (const t of targets) {
        try {
          fs.writeFileSync(t, taskPayload, 'utf-8')
        } catch (e: any) {
          console.warn('[ToolService] 写入 pending_task.json 异常:', t, e?.message)
        }
      }
    }

    // 2. 进程树解耦启动 (优先通过 Windows Shell start 命令脱离 Node.js 父进程)
    try {
      if (process.platform === 'win32') {
        const child = spawn('cmd.exe', ['/c', 'start', '""', res.exePath], {
          cwd: exeDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
      } else {
        const child = spawn(res.exePath, [], {
          cwd: exeDir,
          detached: true,
          stdio: 'ignore'
        })
        child.unref()
      }
      // 3. 【绅士让位 UX 闭环】：TC 主窗口自动最小化，助手退出后自动弹回
      try {
        const mainWin = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())
        if (mainWin) {
          setTimeout(() => {
            if (!mainWin.isDestroyed()) {
              mainWin.minimize()
            }
          }, 200)

          // 启动安全看门狗：等待 TitanPatcher.exe 启动并监听其退出（最长监听 15 分钟）
          let waitedMs = 0
          let hasObservedRunning = false
          const checkTimer = setInterval(async () => {
            waitedMs += 1000
            if (waitedMs > 900000 || mainWin.isDestroyed()) {
              clearInterval(checkTimer)
              if (!mainWin.isDestroyed() && mainWin.isMinimized()) {
                mainWin.restore()
                mainWin.focus()
              }
              return
            }
            try {
              const running = await this.isProcessRunning('TitanPatcher.exe')
              if (running) {
                hasObservedRunning = true
              } else if (hasObservedRunning || waitedMs >= 8000) {
                // 仅在“确认已运行后退出”或“等待 8 秒未起（防启动失败死锁）”时弹回主窗
                clearInterval(checkTimer)
                if (!mainWin.isDestroyed()) {
                  mainWin.restore()
                  mainWin.focus()
                }
              }
            } catch {
              clearInterval(checkTimer)
            }
          }, 1000)
        }
      } catch (err: any) {
        console.warn('[ToolService] 绅士让位自动调度跳过:', err?.message)
      }

      return { success: true }
    } catch (e: any) {
      return { success: false, error: e?.message }
    }
  }

  /**
   * 为指定游戏下载补丁并拉起自动化安装
   */
  static async installPatchForApp(appId: number): Promise<{ success: boolean; error?: string }> {
    const ensureRes = await this.ensureLatestPatcher()
    if (!ensureRes.success || !ensureRes.exePath) {
      return { success: false, error: ensureRes.error || '未能准备好官方补丁助手' }
    }

    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || ''
    const token = Db.getEncrypted<any>('auth_ticket')?.token
    if (!sUrl || !token) {
      return { success: false, error: '请先登录 TitanCore 账号' }
    }

    // 1. 请求补丁网关
    let patchData: { appid: number; filename: string; urls: string[]; name: string } | null = null
    try {
      const res = await titanFetch(`${sUrl}/titan/patch_gateway.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Titan-Token': token },
        body: JSON.stringify({ action: 'get_patch', appid: appId })
      })
      const json = await res.json() as any
      if (json.code !== 200 || !json.data) {
        return { success: false, error: json.msg || '获取补丁下载地址失败' }
      }
      patchData = json.data
    } catch (e: any) {
      return { success: false, error: '请求补丁服务遇到网络错误: ' + (e?.message || e) }
    }

    if (!patchData || !Array.isArray(patchData.urls) || patchData.urls.length === 0) {
      return { success: false, error: '未找到可用的补丁下载源' }
    }

    // 2. 竞速下载补丁包 (优先存放在工具专属 downloads 缓存区，避免落盘在极度敏感的 AppData 根下触发杀软报警)
    const toolPatcherDir = this.getToolDir('titan_patcher')
    let patchSaveDir = path.join(toolPatcherDir, 'downloads')
    try {
      fs.mkdirSync(patchSaveDir, { recursive: true })
    } catch {
      patchSaveDir = path.join(app.getPath('userData'), 'patches')
      fs.mkdirSync(patchSaveDir, { recursive: true })
    }
    const raceDir = path.join(patchSaveDir, `.race-${appId}-${Date.now()}`)
    let targetZip = ''
    let winnerGid = ''

    try {
      const raceRes = await this.raceDownload(patchData.urls, raceDir, `patch-${appId}`, undefined)
      winnerGid = raceRes.winnerGid
      targetZip = path.join(patchSaveDir, patchData.filename || `${appId}-patch.zip`)
      if (fs.existsSync(targetZip)) {
        try { fs.unlinkSync(targetZip) } catch {}
      }
      fs.copyFileSync(raceRes.zipPath, targetZip)
    } finally {
      if (winnerGid) {
        await DownloadService.removeTask(winnerGid).catch(() => {})
      }
      try {
        await this.rmWithRetry(raceDir, 3)
      } catch {}
    }

    if (!fs.existsSync(targetZip)) {
      Logger.error('ToolService', '补丁包下载落盘失败，目标文件不存在', { appId, targetZip })
      return { success: false, error: '补丁包下载落盘失败' }
    }

    // 3. 显式打开 TitanPatcher 执行自动化部署
    return await this.openPatcher(targetZip, true)
  }

}

export function registerToolService(onChanged?: (data: { toolId: string; installed: boolean }) => void) {
  ipcMain.removeHandler('tools:status')
  ipcMain.handle('tools:status', async (_e, toolId: string) => {
    try {
      return await ToolService.status(toolId)
    } catch (e: any) {
      return { installed: false, error: e?.message || 'ERR_TOOL_STATUS' }
    }
  })

  ipcMain.removeHandler('tools:install')
  ipcMain.handle('tools:install', async (_e, toolId: string) => {
    try {
      const res = await ToolService.install(toolId)
      onChanged?.({ toolId, installed: res.success && ToolService.probeInstalled(toolId) })
      return res
    } catch (e: any) {
      return { success: false, error: e?.message || 'ERR_TOOL_INSTALL' }
    }
  })

  ipcMain.removeHandler('tools:uninstall')
  ipcMain.handle('tools:uninstall', async (_e, toolId: string) => {
    try {
      const res = await ToolService.uninstall(toolId)
      onChanged?.({ toolId, installed: res.success ? false : ToolService.probeInstalled(toolId) })
      return res
    } catch (e: any) {
      return { success: false, error: e?.message || 'ERR_TOOL_UNINSTALL' }
    }
  })

  ipcMain.removeHandler('titan:open-patcher')
  ipcMain.handle('titan:open-patcher', async () => {
    try {
      return await ToolService.openPatcher()
    } catch (e: any) {
      return { success: false, error: e?.message || '打开补丁助手失败' }
    }
  })

  ipcMain.removeHandler('titan:install-patch')
  ipcMain.handle('titan:install-patch', async (_e, payload: { appid: number }) => {
    try {
      const aid = Number(payload?.appid)
      if (!aid) return { success: false, error: '无效的游戏 AppID' }
      return await ToolService.installPatchForApp(aid)
    } catch (e: any) {
      Logger.error('ToolService', '部署补丁异常:', { appid: payload?.appid, error: e?.message || e })
      return { success: false, error: e?.message || '部署补丁失败' }
    }
  })
  ipcMain.removeHandler('tools:launch')
  ipcMain.handle('tools:launch', async (_e, toolId: string, payload?: { appid?: string }) => {
    try {
      return await ToolService.launch(toolId, payload)
    } catch (e: any) {
      return { success: false, error: e?.message || 'ERR_TOOL_LAUNCH' }
    }
  })
}
