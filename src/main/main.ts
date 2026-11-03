import { app, BrowserWindow, screen, session, ipcMain, desktopCapturer, shell, protocol, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs/promises'
import fsSync from 'fs'
import { Db } from './db'
import { GatewayService } from './services/GatewayService'
import { initCore } from './services/core'
import { SteamLaunchService } from './services/SteamLaunchService'
import { Logger } from './utils/logger'
import axios from 'axios'

const isDev = !app.isPackaged

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

if (isDev) process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'

app.setPath('userData', path.join(app.getPath('appData'), 'titan-core'))

// ===== 全局即时落盘黑匣子日志系统初始化 =====
Logger.init()
Logger.info('Main', 'TitanCore 启动序列开始，环境: isDev =', isDev, 'userData =', app.getPath('userData'))

// ===== 工业级抗死锁与图形渲染稳定加固 (VS Code / Discord 同款实践) =====
// 禁用 Win11 原生窗口遮挡休眠检测，杜绝无边框窗口在核显/大小核调度下被系统误判休眠导致 16 秒假死
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
// 开启 GPU 光栅化支持，分担界面矢量与动效渲染压力
app.commandLine.appendSwitch('enable-gpu-rasterization')

// ===== 单实例锁与唤醒原有窗口 =====
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
  })
}

interface WindowState extends Partial<Electron.Rectangle> {
  isMaximized?: boolean
  v?: number
}

const getStateFile = () => path.join(Db.getDataRoot(), 'window-state.json')

const getWindowState = async (): Promise<WindowState> => {
  try {
    const raw = await fs.readFile(getStateFile(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

// 退出时同步落盘，杜绝 app.exit 强杀造成的文件截断
const saveWindowStateSync = (bounds: Electron.Rectangle, maximized = false) => {
  try {
    fsSync.writeFileSync(getStateFile(), JSON.stringify({ ...bounds, isMaximized: maximized, v: 2 }), 'utf-8')
  } catch (err) {
    console.error('[Main] Save window state failed:', err)
  }
}

// ===== 图标定位器 =====
function getAppIcon(): Electron.NativeImage {
  const possiblePaths = [
    path.join(__dirname, '../../build/app.ico'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'app.ico'),
    path.join(app.getAppPath(), 'build', 'app.ico'),
    path.join(process.resourcesPath, 'build', 'app.ico')
  ]

  for (const candidate of possiblePaths) {
    if (fsSync.existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate)
      if (!img.isEmpty()) {
        return img
      }
    }
  }

  const fallbackImg = nativeImage.createFromPath(path.join(__dirname, '../../build/app.ico'))
  if (fallbackImg.isEmpty()) {
    console.error('[Icon] FATAL: Failed to resolve app.ico from candidate paths.')
  }
  return fallbackImg
}

// ===== 系统托盘 =====
function createTray() {
  const icon = getAppIcon()
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('TitanCore')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => {
        win?.show()
        if (win?.isMinimized()) win.restore()
        win?.focus()
      }
    },
    {
      label: '提取诊断日志',
      click: () => {
        const logFile = Logger.getLogFilePath()
        if (logFile) shell.showItemInFolder(logFile)
      }
    },
    { type: 'separator' },
    {
      label: '彻底退出',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => {
    if (win?.isVisible()) {
      win.hide()
    } else {
      win?.show()
      if (win?.isMinimized()) win.restore()
      win?.focus()
    }
  })
}

// ===== 全局网络拦截与安全策略 =====
function setupAppProtocolAndNetwork() {
  const realChromeVersion = process.versions.chrome || '138.0.0.0'
  const modernUserAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${realChromeVersion} Safari/537.36`

  session.defaultSession.webRequest.onBeforeSendHeaders((details, cb) => {
    details.requestHeaders['User-Agent'] = modernUserAgent
    if (details.url.includes('/titan/cover_gateway.php')) {
      try {
        const u = new URL(details.url)
        const id = u.searchParams.get('id')
        if (id) {
          const cleanId = id.replace(/^steam_gate_/, '')
          const ts = Math.floor(Date.now() / 1000)
          const secret = 'TitanV15_KimiFinal_2025'
          const sign = crypto.createHmac('sha256', secret).update(`${cleanId}:${ts}`).digest('hex')
          details.requestHeaders['X-Titan-Timestamp'] = String(ts)
          details.requestHeaders['X-Titan-Sign'] = sign
        }
      } catch {}
    }
    cb({ cancel: false, requestHeaders: details.requestHeaders })
  })

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const csp = [
      "default-src 'self' 'unsafe-inline' data: blob: http: https: ws: wss: titan-img:",
      "img-src 'self' data: blob: http: https: titan-img:",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' http: https: ws: wss:"
    ].join('; ')

    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    })
  })
}

// ===== 全局 IPC 路由注册 =====
function registerGlobalIPC() {
  ipcMain.handle('get-desktop-audio-source', async () => (await desktopCapturer.getSources({ types: ['screen'] }))[0]?.id || '')

  ipcMain.on('win-min', () => win?.minimize())
  ipcMain.on('win-max', () => {
    if (!win || win.isDestroyed()) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      if (!win.isVisible()) win.show()
      win.maximize()
    }
  })
  ipcMain.on('win-close', () => win?.close())

  ipcMain.handle('win-toggle-fullscreen', () => {
    if (!win || win.isDestroyed()) return false
    const nextState = !win.isFullScreen()
    win.setFullScreen(nextState)
    return nextState
  })

  ipcMain.handle('win-is-fullscreen', () => {
    if (!win || win.isDestroyed()) return false
    return win.isFullScreen()
  })

  ipcMain.on('win-exit-fullscreen', () => {
    if (win && !win.isDestroyed() && win.isFullScreen()) {
      win.setFullScreen(false)
    }
  })

  ipcMain.handle('sys:show-item-in-folder', async (_event, filePath: string) => {
    if (!filePath || typeof filePath !== 'string') {
      return { success: false, error: 'INVALID_PATH' }
    }
    try {
      // 统一解析为系统标准绝对路径（消除不同斜杠格式造成的 Windows Explorer 寻址失败）
      const normalizedPath = path.resolve(filePath)

      // 1. 若目标路径在磁盘上实际存在
      if (fsSync.existsSync(normalizedPath)) {
        const stat = fsSync.statSync(normalizedPath)
        if (stat.isDirectory()) {
          // 若直接是目录，直接调用 openPath 打开进入该目录
          const err = await shell.openPath(normalizedPath)
          if (err) return { success: false, error: err }
          return { success: true, mode: 'open-dir' }
        } else {
          // 若是具体文件，在资源管理器中高亮选中该文件
          shell.showItemInFolder(normalizedPath)
          return { success: true, mode: 'show-file' }
        }
      }

      // 2. 若目标文件尚未落盘（例如刚添加或正在下载中），自动降级打开其所在父文件夹
      const parentDir = path.dirname(normalizedPath)
      if (fsSync.existsSync(parentDir)) {
        const err = await shell.openPath(parentDir)
        if (err) return { success: false, error: err }
        return { success: true, mode: 'fallback-parent' }
      } else {
        // 若父目录尚不存在，递归创建后打开进入
        fsSync.mkdirSync(parentDir, { recursive: true })
        const err = await shell.openPath(parentDir)
        if (err) return { success: false, error: err }
        return { success: true, mode: 'created-and-opened' }
      }
    } catch (e: any) {
      return { success: false, error: e?.message || 'UNKNOWN_ERROR' }
    }
  })

  ipcMain.handle('sys:restart-steam', async () => SteamLaunchService.restartSteam())

  ipcMain.handle('sys:open-log-dir', async () => {
    const logFile = Logger.getLogFilePath()
    if (logFile && fsSync.existsSync(logFile)) {
      shell.showItemInFolder(logFile)
      return { success: true, path: logFile }
    }
    return { success: false, path: logFile }
  })

  // 安全修复：添加同源校验与解密降级保护，绝不向第三方泄露令牌
  ipcMain.handle('sys:proxy-post', async (_event, { url, body }: { url: string, body: any }) => {
    try {
      const base = (Db.get<any>('app_seed_config')?.serverUrl || '').replace(/\/$/, '')
      const target = url.startsWith('http') ? url : base + '/' + url.replace(/^\//, '')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      // 仅向官方服务器同源子路径注入 Token（base 已归一化，判定与拼接同源，杜绝尾斜杠场景漏判）
      const isOfficial = !url.startsWith('http') || target === base || (base !== '' && target.startsWith(base + '/'))
      if (isOfficial) {
        try {
          const ticket = Db.getEncrypted<any>('auth_ticket')
          if (ticket?.token) {
            headers['X-Titan-Token'] = ticket.token
          }
        } catch (_err) {
          // 解密失败降级为匿名请求，严禁阻断正常网络通信
        }
      }

      const { data } = await axios.post(target, body, {
        headers,
        timeout: 8000
      })
      return data
    } catch (e: any) {
      return { code: e.response?.status || 500, msg: e.response?.data?.msg || e.message || 'Network failure' }
    }
  })

  ipcMain.handle('sys:redeem-cores', async (_event, score: number, amount: number) => {
    const config = Db.get<any>('app_seed_config')
    const serverUrl = config?.serverUrl || ''
    return await GatewayService.redeemCores(score, amount, serverUrl)
  })

  ipcMain.handle('badab:claim-victory', async (_event, route: 'justice' | 'corruption', durationSeconds: number, starYear: number) => {
    const config = Db.get<any>('app_seed_config')
    const serverUrl = config?.serverUrl || ''
    return await GatewayService.claimBadabVictory(route, durationSeconds, starYear, serverUrl)
  })
}

// ===== 检查坐标是否落在当前可用显示器内 =====
function isPositionVisible(x?: number, y?: number): boolean {
  if (typeof x !== 'number' || typeof y !== 'number') return false
  const displays = screen.getAllDisplays()
  return displays.some(d => {
    const { x: dx, y: dy, width: dw, height: dh } = d.bounds
    return x >= dx && x < dx + dw && y >= dy && y < dy + dh
  })
}

// ===== 窗口创建 =====
async function createWindow(isFirstLaunch: boolean) {
  let bounds: WindowState | null = await getWindowState()
  if (bounds && (!bounds.v || bounds.v < 2)) {
    bounds = null
  }

  const primary = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = primary.workAreaSize
  const scale = primary.scaleFactor || 1

  const isPhysicalHighRes = (primary.bounds.width * scale) >= 2560
  const defaultWidth = isPhysicalHighRes ? Math.min(1920, Math.floor(sw * 0.9)) : Math.min(1440, Math.floor(sw * 0.9))
  const defaultHeight = isPhysicalHighRes ? Math.min(1080, Math.floor(sh * 0.9)) : Math.min(900, Math.floor(sh * 0.9))

  const isMaximized = bounds?.isMaximized
  const appIcon = getAppIcon()

  // 坐标可用性探针：若上次记录的副屏被拔除，回退为屏幕居中
  const hasValidPosition = isPositionVisible(bounds?.x, bounds?.y)

  win = new BrowserWindow({
    width: bounds?.width || defaultWidth,
    height: bounds?.height || defaultHeight,
    x: hasValidPosition ? bounds?.x : undefined,
    y: hasValidPosition ? bounds?.y : undefined,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: appIcon,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // 挂载主窗口诊断探针
  Logger.attachWindowDiagnostics(win)

  let windowShown = false
  const showMainWindow = () => {
    if (windowShown || !win || win.isDestroyed() || isQuitting) return
    windowShown = true
    if (isMaximized && !win.isMaximized()) {
      win.maximize()
    }
    win.show()
  }

  // 1. 首选：前端 Vue 真正挂载完成并完成握手 (sys:client-ready) 时优雅送显，物理根绝白屏
  win.once('titan:ui-ready' as any, () => {
    showMainWindow()
  })

  // 2. 兜底：ready-to-show 后 1500ms 硬超时保护，防止极端脚本异常造成窗口假死
  win.once('ready-to-show', () => {
    setTimeout(showMainWindow, 1500)
  })

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win?.hide()
      if (win) saveWindowStateSync(win.getBounds(), win.isMaximized())
    } else {
      if (win) saveWindowStateSync(win.getBounds(), win.isMaximized())
    }
  })

  // 拦截外链：强制使用系统默认浏览器打开，严禁 Electron 内部派生未受控窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      win?.webContents.toggleDevTools()
      return
    }
    if (
      input.key === 'F5' ||
      ((input.control || input.meta) && input.key.toLowerCase() === 'r')
    ) {
      event.preventDefault()
    }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const currentUrl = win?.webContents.getURL() || ''
    if (url !== currentUrl) {
      event.preventDefault()
    }
  })

  initCore(win, isFirstLaunch)

  if (isDev) {
    await win.loadURL('http://127.0.0.1:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    await win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  win.on('closed', () => (win = null))
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'titan-img', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.TitanCore.app')
  }

  setupAppProtocolAndNetwork()
  registerGlobalIPC()

  // 修复时序：先初始化底层数据库并验证完整性，再查询业务指标
  const dbResult = Db.init()
  if (!dbResult.success) {
    console.error('[Main] DB Init Failed:', dbResult.error)
  } else if (dbResult.reset) {
    console.warn('[Main] DB Auto-Repaired:', dbResult.error)
  }

  const isFirstLaunch = Db.isFirstLaunch()

  await createWindow(isFirstLaunch)
  createTray()
  scheduleSilentGarbageCollector()

  let shutdownStarted = false
  app.on('before-quit', (e) => {
    if (shutdownStarted) return
    e.preventDefault()
    shutdownStarted = true
    isQuitting = true

    // 1. 立即隐匿窗口，用户感知瞬间秒退
    if (win && !win.isDestroyed()) {
      saveWindowStateSync(win.getBounds(), win.isMaximized())
      win.hide()
    }

    // 2. 1.5 秒硬超时强退兜底
    const forceTimer = setTimeout(() => app.exit(0), 1500)

    // 3. 静默安全落盘与 WAL 优雅刷盘
    import('./services/DownloadService').then(async ({ DownloadService }) => {
      await DownloadService.shutdown().catch(() => {})
    }).finally(() => {
      try { Db.close() } catch {}
      clearTimeout(forceTimer)
      app.exit(0)
    })
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

app.on('activate', () => !BrowserWindow.getAllWindows().length && createWindow(false))
function scheduleSilentGarbageCollector() {
  setTimeout(() => {
    const dataRoot = Db.getDataRoot()
    const now = Date.now()
    const TWO_HOURS = 2 * 3600 * 1000

    const cleanDirWithTtl = (targetDir: string, filterFn?: (filename: string) => boolean) => {
      if (!fsSync.existsSync(targetDir)) return
      try {
        const entries = fsSync.readdirSync(targetDir, { withFileTypes: true })
        for (const entry of entries) {
          if (filterFn && !filterFn(entry.name)) continue
          const fullPath = path.join(targetDir, entry.name)
          try {
            const stat = fsSync.statSync(fullPath)
            if (now - stat.mtimeMs > TWO_HOURS) {
              fsSync.rmSync(fullPath, { recursive: true, force: true })
            }
          } catch {}
        }
      } catch {}
    }

    // 1. 深度清理 TitanTemp 根下所有任务残卷 (覆盖 deploy_*, game_*, minigame_*, cloudsave, depotkeys, racing)
    cleanDirWithTtl(path.join(dataRoot, 'TitanTemp'))
    // 1.1 穿透清理 TitanTemp/racing 内部孤儿任务目录 (race_s_*, race_l_*)
    cleanDirWithTtl(path.join(dataRoot, 'TitanTemp', 'racing'))

    // 2. 清理 TitanCache/ost 下历史败者的 .race* 孤儿文件
    cleanDirWithTtl(path.join(dataRoot, 'TitanCache', 'ost'), name => name.includes('.race'))

    // 3. 清理主程序更新残留 update 目录
    cleanDirWithTtl(path.join(app.getPath('userData'), 'update'))

    // 4. 清理封面下载残留 tmp 与 pack 文件
    cleanDirWithTtl(path.join(dataRoot, 'cache', 'covers'), name => name.endsWith('.tmp') || name.startsWith('pack_'))

    if (!app.isPackaged) console.log('[Cleaner] 350s 静默全量碎片巡检完毕')
  }, 350 * 1000)
}
