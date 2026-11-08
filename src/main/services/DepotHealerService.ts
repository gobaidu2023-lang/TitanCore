import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { BrowserWindow, Notification } from 'electron'
import { SteamDetector } from './SteamDetector'
import { ModeSwitchService } from './ModeSwitchService'

export class DepotHealerService {
  private static watcher: fs.FSWatcher | null = null
  private static currentSteamPath: string | null = null
  private static currentLogPath: string | null = null
  private static lastOffset: number = 0
  private static debounceTimer: NodeJS.Timeout | null = null
  private static isReading: boolean = false
  // 30 秒内存 TTL 防重入缓存: `${appId}:${depotId}` -> timestamp
  private static healedCache = new Map<string, number>()

  /**
   * 启动日志监听器
   * @param steamPath 可选指定的 Steam 根目录
   */
  static async start(steamPath?: string): Promise<void> {
    try {
      let targetPath = steamPath
      if (!targetPath) {
        targetPath = SteamDetector.lastDetectedPath || (await SteamDetector.detect())?.path || ''
      }
      if (!targetPath || !fs.existsSync(targetPath)) {
        return
      }

      // 避免重复监听同一路径
      if (this.currentSteamPath === targetPath && this.watcher) {
        return
      }

      this.stop()
      this.currentSteamPath = targetPath
      const logFile = path.join(targetPath, 'logs', 'content_log.txt')
      this.currentLogPath = logFile

      if (!fs.existsSync(logFile)) {
        const logsDir = path.join(targetPath, 'logs')
        if (fs.existsSync(logsDir)) {
          this.watcher = fs.watch(logsDir, (eventType, filename) => {
            if (filename === 'content_log.txt' && fs.existsSync(logFile)) {
              this.start(targetPath)
            }
          })
        }
        return
      }

      // 启动自愈时，扫描并清除导致 Steam 闪退的损坏清单文件 (如包含空文件名的残缺清单)
      this.sanitizeDepotCache(targetPath)

      // 核心低开销保证：启动时游标直接定位在末尾，不读任何历史旧日志，0 性能开销
      const stat = fs.statSync(logFile)
      this.lastOffset = stat.size

      // Windows 内核级事件监听：平时完全休眠，0% CPU
      this.watcher = fs.watch(logFile, () => {
        this.scheduleRead()
      })

      console.log(`[DepotHealerService] 智能自愈雷达就绪，监听: ${logFile} (初始偏移: ${this.lastOffset})`)
    } catch (e: any) {
      console.warn('[DepotHealerService] 启动自愈监听异常:', e.message)
    }
  }

  /**
   * 停止监听并清理资源
   */
  static stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      try {
        this.watcher.close()
      } catch {}
      this.watcher = null
    }
    this.currentSteamPath = null
    this.currentLogPath = null
    this.lastOffset = 0
    this.isReading = false
  }

  /**
   * 200ms 防抖调度，等待 Steam 写入完成
   */
  private static scheduleRead(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.readIncrementalLog().catch(() => {})
    }, 200)
  }

  /**
   * 增量读取新增日志字节，严格控制内存
   */
  private static async readIncrementalLog(): Promise<void> {
    if (this.isReading || !this.currentLogPath || !fs.existsSync(this.currentLogPath)) {
      return
    }
    this.isReading = true
    try {
      const stat = fs.statSync(this.currentLogPath)
      const newSize = stat.size

      // 日志被 Steam 轮转/清空，重置游标
      if (newSize < this.lastOffset) {
        this.lastOffset = 0
      }
      if (newSize === this.lastOffset) {
        return
      }

      // 仅读取新增字节，若新增量异常巨大（> 256KB），只截取尾部 64KB，彻底防爆内存
      const diff = newSize - this.lastOffset
      const readLen = diff > 256 * 1024 ? 64 * 1024 : diff
      const readStart = newSize - readLen

      const buf = Buffer.allocUnsafe(readLen)
      const fd = fs.openSync(this.currentLogPath, 'r')
      try {
        fs.readSync(fd, buf, 0, readLen, readStart)
      } finally {
        fs.closeSync(fd)
      }
      this.lastOffset = newSize

      const text = buf.toString('utf-8')
      this.parseAndHeal(text)
    } catch (e: any) {
      console.warn('[DepotHealerService] 读取增量日志失败:', e.message)
    } finally {
      this.isReading = false
    }
  }

  /**
   * 精准指纹匹配与自愈分发
   */
  private static parseAndHeal(logText: string): void {
    // 1. 指纹一：缺少解密密钥 (Missing decryption key)
    // 匹配: AppID 588650 update canceled : Failed to initialize depot 1046441, manifest ... (Missing decryption key)
    const regexMissingKey = /AppID\s+(\d+)\s+update canceled\s*:\s*Failed to initialize depot\s+(\d+)[^(\n]*\((?:Missing decryption key|未找到解密密钥)\)/gi
    let match: RegExpExecArray | null

    while ((match = regexMissingKey.exec(logText)) !== null) {
      const appId = parseInt(match[1], 10)
      const depotId = parseInt(match[2], 10)
      if (appId > 0 && depotId > 0) {
        this.healDepot(appId, depotId, 'missing_key')
      }
    }

    // 2. 指纹二：解密失败/无效内容配置 (Manifest still encrypted / Invalid content configuration)
    // 匹配: AppID 227300 update canceled : Manifest 1536500_3488965392130597377 is still encrypted (Invalid content configuration)
    const regexInvalidConfig = /AppID\s+(\d+)\s+update canceled\s*:\s*Manifest\s+(\d+)_(\d+)\s+(?:is still encrypted|仍处于加密状态)\s*\((?:Invalid content configuration|无效的内容配置)\)/gi
    while ((match = regexInvalidConfig.exec(logText)) !== null) {
      const appId = parseInt(match[1], 10)
      const depotId = parseInt(match[2], 10)
      const gid = match[3]
      if (appId > 0 && depotId > 0) {
        this.healDepot(appId, depotId, 'invalid_encryption')
        this.cleanBadManifest(depotId, gid)
      }
    }

    // 3. 指纹三：清单请求被 CDN 拒绝 401 Unauthorized (授权码失效/过期)
    // 匹配主流全量 URL (含携带 auth 参数的情况): /depot/1209460/manifest/5584347432936369964/... - manifest request received 401 (Unauthorized)
    const regex401 = /\/depot\/(\d+)\/manifest\/(\d+)[^\s]*\s*-\s*manifest request received 401\s*\(Unauthorized\)/gi
    while ((match = regex401.exec(logText)) !== null) {
      const depotId = parseInt(match[1], 10)
      const gid = match[2]
      if (depotId > 0 && gid) {
        this.heal401Depot(depotId, gid).catch(() => {})
      }
    }

    // 匹配 CDN 通用简写响应: Received 401 (Unauthorized) HTTP response for depot 1209460
    const regex401Fallback = /Received 401\s*\(Unauthorized\)\s*HTTP response for depot\s*(\d+)/gi
    while ((match = regex401Fallback.exec(logText)) !== null) {
      const depotId = parseInt(match[1], 10)
      if (depotId > 0) {
        const appId = this.findAppIdForDepot(depotId)
        if (appId) {
          this.healDepot(appId, depotId, '401_fallback_ignore')
        }
      }
    }
  }

  /**
   * 校验 Steam 清单二进制内存中是否存在空文件名等导致底层断言崩溃 (!m_strName.IsEmpty()) 的损坏结构
   */
  static isCorruptManifestData(data: Buffer): boolean {
    try {
      if (data.length < 16) return true
      if (data.readUInt32LE(0) !== 0x71f617d0) return true
      const plen = data.readUInt32LE(4)
      if (plen <= 0 || 8 + plen > data.length) return true
      const payload = data.subarray(8, 8 + plen)

      let idx = 0
      while (idx < payload.length) {
        const tag = payload[idx++]
        const wire = tag & 7
        if (wire !== 2) break

        let length = 0, shift = 0
        while (idx < payload.length) {
          const b = payload[idx++]
          length |= (b & 0x7f) << shift
          if (!(b & 0x80)) break
          shift += 7
        }
        if (idx + length > payload.length) return true
        const mBytes = payload.subarray(idx, idx + length)
        idx += length

        let mIdx = 0
        let hasValidName = false
        while (mIdx < mBytes.length) {
          const mTag = mBytes[mIdx++]
          const mWire = mTag & 7
          const mField = mTag >> 3
          if (mWire === 0) {
            while (mIdx < mBytes.length && (mBytes[mIdx++] & 0x80)) {}
          } else if (mWire === 2) {
            let flen = 0, fshift = 0
            while (mIdx < mBytes.length) {
              const b = mBytes[mIdx++]
              flen |= (b & 0x7f) << fshift
              if (!(b & 0x80)) break
              fshift += 7
            }
            if (mIdx + flen > mBytes.length) return true
            if (mField === 1 && flen > 0) {
              hasValidName = true
            }
            mIdx += flen
          } else if (mWire === 5) {
            mIdx += 4
          } else if (mWire === 1) {
            mIdx += 8
          } else {
            break
          }
        }
        // 如果任一文件映射条目的文件名为空，Steam 在解析时会触发 (!m_strName.IsEmpty()) 必崩
        if (!hasValidName) return true
      }
      return false
    } catch {
      return true
    }
  }

  /**
   * 校验 Steam 清单文件是否损坏
   */
  static isCorruptManifest(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) return false
      const data = fs.readFileSync(filePath)
      return this.isCorruptManifestData(data)
    } catch {
      return true
    }
  }

  /**
   * 扫描并清除 depotcache 中的损坏清单 (如包含空文件名导致 Steam 闪退的清单)
   */
  static sanitizeDepotCache(steamPath?: string): number {
    const targetPath = steamPath || this.currentSteamPath
    if (!targetPath) return 0
    const depotCacheDir = path.join(targetPath, 'depotcache')
    if (!fs.existsSync(depotCacheDir)) return 0

    let cleaned = 0
    try {
      const files = fs.readdirSync(depotCacheDir)
      for (const file of files) {
        if (!file.endsWith('.manifest')) continue
        const fullPath = path.join(depotCacheDir, file)
        if (this.isCorruptManifest(fullPath)) {
          try {
            fs.unlinkSync(fullPath)
            cleaned++
            console.warn(`[DepotHealerService] 已自动清理导致 Steam 崩溃的损坏清单: ${file}`)
          } catch {}
        }
      }
    } catch (e: any) {
      console.warn('[DepotHealerService] 扫描 depotcache 异常:', e?.message)
    }
    return cleaned
  }

  /**
   * 清理本地残留的无效或无法解密的加密清单缓存
   */
  private static cleanBadManifest(depotId: number, gid?: string): void {
    if (!this.currentSteamPath) return
    const depotCacheDir = path.join(this.currentSteamPath, 'depotcache')
    if (!fs.existsSync(depotCacheDir)) return
    try {
      if (gid) {
        const file = path.join(depotCacheDir, `${depotId}_${gid}.manifest`)
        if (fs.existsSync(file)) {
          fs.unlinkSync(file)
          console.log(`[DepotHealerService] 已清理损坏/无法解密的清单缓存: ${file}`)
        }
      } else {
        const files = fs.readdirSync(depotCacheDir)
        for (const file of files) {
          if (file.startsWith(`${depotId}_`) && file.endsWith('.manifest')) {
            try { fs.unlinkSync(path.join(depotCacheDir, file)) } catch {}
          }
        }
      }
    } catch (e: any) {
      console.warn('[DepotHealerService] 清理损坏清单异常:', e?.message)
    }
  }

  /**
   * 根据 depotId 逆向推断所属的游戏 AppID
   */
  private static findAppIdForDepot(depotId: number): number | null {
    const steamPath = this.currentSteamPath || ''
    let activeLuaDir = ''
    try {
      activeLuaDir = ModeSwitchService.getActiveLuaDir(steamPath)
    } catch {}

    const dirsToCheck = [activeLuaDir, steamPath ? path.join(steamPath, 'config', 'lua') : ''].filter(d => d && fs.existsSync(d))
    for (const dir of dirsToCheck) {
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          if (!file.endsWith('.lua')) continue
          const fullPath = path.join(dir, file)
          const content = fs.readFileSync(fullPath, 'utf-8')
          const reg = new RegExp(`(?:addappid|setManifestid|addtoken)\\s*\\(\\s*${depotId}\\b`, 'i')
          if (reg.test(content)) {
            const base = path.basename(file, '.lua')
            const id = parseInt(base, 10)
            if (!isNaN(id) && id > 0) return id
          }
        }
      } catch {}
    }
    return null
  }

  /**
   * 尝试从自建/公共清单归档库直接拉取完整已解密清单并预填至 depotcache
   */
  private static async tryFetchAndPreseedManifest(depotId: number, gid: string): Promise<boolean> {
    if (!this.currentSteamPath) return false
    const depotCacheDir = path.join(this.currentSteamPath, 'depotcache')
    if (!fs.existsSync(depotCacheDir)) {
      try { fs.mkdirSync(depotCacheDir, { recursive: true }) } catch {}
    }
    const targetFile = path.join(depotCacheDir, `${depotId}_${gid}.manifest`)
    if (fs.existsSync(targetFile)) return true

    const url = `https://manifest.luastools.xyz/m/${depotId}/${gid}`
    try {
      const buf = await new Promise<Buffer>((resolve, reject) => {
        const req = https.get(url, { timeout: 8000 }, (res) => {
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}`))
          }
          const chunks: Buffer[] = []
          res.on('data', c => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks)))
        })
        req.on('error', reject)
        req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
      })

      // 验证 Steam 清单二进制文件头魔数及完整性 (严格排除空文件名等损坏清单)
      if (buf.length >= 16 && !this.isCorruptManifestData(buf)) {
        fs.writeFileSync(targetFile, buf)
        console.log(`[DepotHealerService] 401 自愈成功：已从归档库拉取并预填充本地清单 -> ${targetFile}`)
        return true
      }
    } catch (e: any) {
      console.warn(`[DepotHealerService] 拉取清单 ${depotId}_${gid} 失败:`, e?.message)
    }
    return false
  }

  /**
   * 处理 401 鉴权失效清单：优先预灌本地缓存，备选自动排除
   */
  private static async heal401Depot(depotId: number, gid: string): Promise<void> {
    const cacheKey = `401:${depotId}:${gid}`
    const now = Date.now()
    const lastHealed = this.healedCache.get(cacheKey) || 0
    if (now - lastHealed < 30_000) {
      return
    }
    this.healedCache.set(cacheKey, now)

    console.log(`[DepotHealerService] 检测到 Depot ${depotId} 清单 ${gid} 触发 401 Unauthorized，启动自愈...`)

    // 优先：尝试从 manifest 备份归档库拉取完整已解密 manifest 预灌入 depotcache
    const preseeded = await this.tryFetchAndPreseedManifest(depotId, gid)
    const appId = this.findAppIdForDepot(depotId) || 0
    if (preseeded) {
      this.notifyUser(appId, depotId, 'manifest_preseeded')
      return
    }

    // 备选：若云端归档亦无此清单，则定位其所属游戏并将其作为无效死包排除
    if (appId > 0) {
      this.healDepot(appId, depotId, '401_fallback_ignore')
    }
  }

  /**
   * 执行单个死包的自动排除与通知
   */
  private static healDepot(appId: number, depotId: number, reason: string = 'missing_key'): void {
    const cacheKey = `${appId}:${depotId}`
    const now = Date.now()
    const lastHealed = this.healedCache.get(cacheKey) || 0
    if (now - lastHealed < 30_000) {
      return // 30 秒防重入
    }
    this.healedCache.set(cacheKey, now)

    const steamPath = this.currentSteamPath || ''
    // 智能双模式感知：优先取当前激活根（纯净模式为 D:\TitanCore\ost\config\lua，经典模式为 Steam\config\lua）
    let activeLuaDir = ''
    try {
      activeLuaDir = ModeSwitchService.getActiveLuaDir(steamPath)
    } catch {}

    const candidateFiles: string[] = []
    if (activeLuaDir) {
      candidateFiles.push(path.join(activeLuaDir, `${appId}.lua`))
    }
    if (steamPath) {
      const classicFile = path.join(steamPath, 'config', 'lua', `${appId}.lua`)
      if (!candidateFiles.includes(classicFile)) {
        candidateFiles.push(classicFile)
      }
    }

    const targetFile = candidateFiles.find(f => fs.existsSync(f))
    if (!targetFile) {
      console.warn(`[DepotHealerService] 未找到 AppID ${appId} 对应的 .lua 配置文件`)
      return
    }

    try {
      const content = fs.readFileSync(targetFile, 'utf-8')
      const pattern = new RegExp(`(?:ignore_?depot|block_?depot)\\s*\\(\\s*${depotId}\\s*\\)`, 'i')
      if (pattern.test(content)) {
        return // 已排除过，不重复写入
      }

      // 原子追加排除指令（OST 底层文件监听机制将在 5ms 内自动捕获并无感热重载）
      const reasonText = reason === 'invalid_encryption' ? '无效解密死包/未发售分卷' : (reason === '401_fallback_ignore' ? '清单401鉴权失效分卷' : '无密钥死包')
      const appendBlock = `\n-- [TitanCore 智能自愈] 自动排除${reasonText}\nignore_depot(${depotId})\n`
      fs.appendFileSync(targetFile, appendBlock, 'utf-8')
      console.log(`[DepotHealerService] 成功为游戏 ${appId} 排除失效分卷 Depot ${depotId} (${reasonText}) -> ${targetFile}`)

      // 桌面 Toast 与窗口通知
      this.notifyUser(appId, depotId, reason)
    } catch (e: any) {
      console.error(`[DepotHealerService] 写入自愈配置失败: ${targetFile}`, e)
    }
  }

  /**
   * 推送前端 Toast 与 Windows 桌面系统通知
   */
  private static notifyUser(appId: number, depotId: number, reason: string = 'missing_key'): void {
    // 1. 广播通知给所有 TitanCore 窗口
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send('titan:depot-healed', { appId, depotId, reason })
        } catch {}
      }
    })

    // 2. Windows 桌面系统级弹窗（即使 TC 最小化到托盘也能看得到）
    try {
      if (Notification.isSupported()) {
        const bodyText = reason === 'manifest_preseeded'
          ? `已成功补全失效清单 (Depot ${depotId})，请在 Steam 中点击继续下载！`
          : `已自动排除失效加密分卷 (Depot ${depotId})，请在 Steam 中直接点击继续下载！`

        new Notification({
          title: 'TitanCore 智能自愈',
          body: bodyText,
          silent: false
        }).show()
      }
    } catch {}
  }
}
