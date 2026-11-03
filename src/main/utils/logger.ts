// 文件名: src/main/utils/logger.ts
// 【P1】工业级即时落盘黑匣子日志模块（TitanCore 诊断特警系统）
import fs from 'fs'
import path from 'path'
import os from 'os'
import { app, BrowserWindow } from 'electron'

export class Logger {
  private static logFilePath: string = ''
  private static isInitialized = false
  private static writeCount = 0
  private static origConsole: {
    log: typeof console.log
    info: typeof console.info
    warn: typeof console.warn
    error: typeof console.error
    debug: typeof console.debug
  } | null = null

  /**
   * 初始化日志落盘环境
   */
  static init(): string {
    if (this.isInitialized) return this.logFilePath

    try {
      const userDataDir = app.getPath('userData') || path.join(app.getPath('appData'), 'titan-core')
      const logDir = path.join(userDataDir, 'logs')

      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }

      this.logFilePath = path.join(logDir, 'titan-debug.log')

      // 日志轮转：若单个日志超过 10MB，自动归档为 .old.log，防止无限膨胀
      this.checkRotate()

      // 备份原生控制台
      this.origConsole = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
      }

      this.isInitialized = true

      // 写入诊断会话头
      this.writeHeader()

      // 接管全局未捕获异常
      this.hookProcessExceptions()

      // 接管控制台
      this.hookGlobalConsole()

      return this.logFilePath
    } catch (err) {
      // 容灾：若遇到目录无权，降级写入临时目录
      try {
        const fallbackDir = path.join(os.tmpdir(), 'titan-core-logs')
        fs.mkdirSync(fallbackDir, { recursive: true })
        this.logFilePath = path.join(fallbackDir, 'titan-debug.log')
        this.isInitialized = true
        this.writeHeader()
        return this.logFilePath
      } catch {
        return ''
      }
    }
  }

  static getLogFilePath(): string {
    return this.logFilePath
  }

  /**
   * 格式化时间戳 YYYY-MM-DD HH:mm:ss.SSS
   */
  private static formatTime(): string {
    const d = new Date()
    const pad = (n: number, z = 2) => String(n).padStart(z, '0')
    const year = d.getFullYear()
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hour = pad(d.getHours())
    const min = pad(d.getMinutes())
    const sec = pad(d.getSeconds())
    const ms = pad(d.getMilliseconds(), 3)
    return `${year}-${month}-${day} ${hour}:${min}:${sec}.${ms}`
  }

  /**
   * 检查日志大小，若超标（>10MB）执行平滑轮转并保留 1 份 .old.log 备份，防止无限膨胀
   */
  private static checkRotate() {
    if (!this.logFilePath) return
    try {
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath)
        if (stats.size > 10 * 1024 * 1024) {
          const logDir = path.dirname(this.logFilePath)
          const oldPath = path.join(logDir, 'titan-debug.old.log')
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
          fs.renameSync(this.logFilePath, oldPath)
        }
      }
    } catch {}
  }

  /**
   * 核心写入逻辑：同步落盘（appendFileSync），即使毫秒级闪退或强杀也不会丢失关键信息
   */
  private static writeLine(level: string, tag: string, message: string) {
    // 生产模式过滤：直接拦截并丢弃 DEBUG 级别调试日志，大幅减少磁盘 I/O 并杜绝无意义膨胀
    if (app.isPackaged && level === 'DEBUG') return
    if (!this.logFilePath) return

    // 运行期动态防爆：每写入 200 条日志自动检查一次体积，超 10MB 自动轮转，彻底封死单次长时间运行日志膨胀
    this.writeCount++
    if (this.writeCount % 200 === 0) {
      this.checkRotate()
    }

    const line = `[${this.formatTime()}] [${level}] [${tag}] ${message}\n`

    try {
      fs.appendFileSync(this.logFilePath, line, 'utf-8')
    } catch {
      // 静默防止递归崩溃
    }

    // 同步镜像输出至原生控制台（如有控制台附加）
    if (this.origConsole) {
      if (level === 'ERROR' || level === 'FATAL') {
        this.origConsole.error(`[${tag}] ${message}`)
      } else if (level === 'WARN') {
        this.origConsole.warn(`[${tag}] ${message}`)
      } else if (!app.isPackaged) {
        this.origConsole.log(`[${tag}] ${message}`)
      }
    }
  }

  private static formatArgs(args: any[]): string {
    return args
      .map(arg => {
        if (arg instanceof Error) {
          return `${arg.message}\n${arg.stack || ''}`
        }
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg)
          } catch {
            return String(arg)
          }
        }
        return String(arg)
      })
      .join(' ')
  }

  static info(tag: string, ...args: any[]) {
    this.writeLine('INFO', tag, this.formatArgs(args))
  }

  static warn(tag: string, ...args: any[]) {
    this.writeLine('WARN', tag, this.formatArgs(args))
  }

  static error(tag: string, ...args: any[]) {
    this.writeLine('ERROR', tag, this.formatArgs(args))
  }

  static debug(tag: string, ...args: any[]) {
    if (app.isPackaged) return
    this.writeLine('DEBUG', tag, this.formatArgs(args))
  }

  /**
   * 写入详细的软硬件运行环境头信息
   */
  private static writeHeader() {
    const memory = process.memoryUsage()
    const totalMem = Math.round(os.totalmem() / 1024 / 1024)
    const freeMem = Math.round(os.freemem() / 1024 / 1024)
    const cpus = os.cpus()
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown'

    const header = [
      '\n================================================================================',
      `[TITANCORE DEBUG LOG SESSION STARTED]`,
      `Time: ${new Date().toISOString()} (Local: ${this.formatTime()})`,
      `App Version: ${app.getVersion() || '2.0.2'}`,
      `Electron: ${process.versions.electron || 'Unknown'}, Chrome: ${process.versions.chrome || 'Unknown'}, Node: ${process.versions.node || 'Unknown'}`,
      `OS: ${os.type()} ${os.release()} (${os.arch()})`,
      `CPU: ${cpuModel} (${cpus.length} Cores)`,
      `Memory: Free ${freeMem}MB / Total ${totalMem}MB (Node RSS: ${Math.round(memory.rss / 1024 / 1024)}MB)`,
      `Exe Path: ${app.getPath('exe')}`,
      `UserData: ${app.getPath('userData')}`,
      `Log File: ${this.logFilePath}`,
      `Command Args: ${process.argv.join(' ')}`,
      '================================================================================\n'
    ].join('\n')

    try {
      fs.appendFileSync(this.logFilePath, header, 'utf-8')
    } catch {}
  }

  /**
   * 挂载渲染进程全量日志与状态探针
   */
  static attachWindowDiagnostics(win: BrowserWindow) {
    if (!win || win.isDestroyed()) return

    // 1. 抓取渲染进程（Vue/前端控制台）所有输出
    win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      // 生产环境静默：拦截抛弃 level === 0 (DEBUG/VERBOSE) 琐碎调试日志
      if (app.isPackaged && level === 0) return

      const levelMap: Record<number, string> = {
        0: 'DEBUG',
        1: 'INFO',
        2: 'WARN',
        3: 'ERROR'
      }
      const lvl = levelMap[level] || 'INFO'
      const srcShort = sourceId ? path.basename(sourceId) : 'renderer'
      this.writeLine(lvl, `Renderer:${srcShort}:${line}`, message)
    })

    let unresRecoveryTimer: ReturnType<typeof setTimeout> | null = null

    // 2. 监测渲染进程卡死挂起（挂载 3 秒主动破冰看门狗，杜绝干等 16 秒）
    win.on('unresponsive', () => {
      this.writeLine('FATAL', 'WindowMonitor', '【警报】主窗口失去响应 (Window Unresponsive)! 页面主线程或 GPU 可能已死锁卡死!')
      if (unresRecoveryTimer) clearTimeout(unresRecoveryTimer)
      unresRecoveryTimer = setTimeout(() => {
        if (!win || win.isDestroyed()) return
        this.writeLine('WARN', 'WindowMonitor', '【破冰看门狗】窗口持续 3 秒未响应，主动触发重绘冲刷 (invalidate) 以唤醒渲染管线...')
        try {
          win.webContents.invalidate()
        } catch {}
      }, 3000)
    })

    win.on('responsive', () => {
      if (unresRecoveryTimer) {
        clearTimeout(unresRecoveryTimer)
        unresRecoveryTimer = null
      }
      this.writeLine('INFO', 'WindowMonitor', '主窗口恢复响应 (Window Responsive)')
    })

    // 3. 监听 GPU 进程自愈
    app.on('child-process-gone', (_event, details) => {
      if (details.type === 'GPU') {
        this.writeLine('WARN', 'GPUWatchdog', `GPU 渲染进程发生重置 (reason: ${details.reason}, exitCode: ${details.exitCode})，系统正在无感自愈...`)
      }
    })

    // 3. 监测渲染进程崩溃
    win.webContents.on('render-process-gone', (_event, details) => {
      this.writeLine('FATAL', 'ProcessGone', `渲染进程异常崩溃退出: reason=${details.reason}, exitCode=${details.exitCode}`)
    })

    // 4. 监测页面加载失败
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      this.writeLine('ERROR', 'PageLoad', `页面加载失败: [${errorCode}] ${errorDescription} URL: ${validatedURL}`)
    })

    this.info('WindowMonitor', '主窗口诊断探针挂载完毕')
  }

  /**
   * 接管未捕获异常
   */
  private static hookProcessExceptions() {
    process.on('uncaughtException', (err) => {
      this.error('FATAL:UncaughtException', err)
    })

    process.on('unhandledRejection', (reason) => {
      this.error('FATAL:UnhandledRejection', reason)
    })
  }

  /**
   * 全局控制台拦截落盘，彻底解决生产模式清空 log 的问题
   */
  private static hookGlobalConsole() {
    console.log = (...args: any[]) => this.info('Console', ...args)
    console.info = (...args: any[]) => this.info('Console', ...args)
    console.warn = (...args: any[]) => this.warn('Console', ...args)
    console.error = (...args: any[]) => this.error('Console', ...args)
    console.debug = (...args: any[]) => this.debug('Console', ...args)
  }
}
