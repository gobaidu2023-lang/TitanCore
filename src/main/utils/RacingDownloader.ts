// 文件路径: src/main/utils/RacingDownloader.ts
// 职责: 通用小文件全量竞速与大文件 Aria2 冲刺窗口竞速下载器，支持渐进式 SHA256 校验
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import axios from 'axios'
import { app } from 'electron'
import { Db } from '../db'
import { DownloadService } from '../services/DownloadService'
import { ArchiveService } from './ArchiveService'

export interface RaceOptions {
  destPath: string            // 最终落盘绝对路径
  expectedSha256?: string     // 渐进式哈希：下发则校验，不下发则跳过
  label?: string              // 模块打标
}

export class RacingDownloader {
  private static get TEMP_ROOT(): string {
    let baseRoot: string
    try {
      baseRoot = Db.getDataRoot()
    } catch {
      baseRoot = app.getPath('userData')
    }
    const p = path.join(baseRoot, 'TitanTemp', 'racing')
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    return p
  }

  /**
   * 清理历史会话遗留的过期临时目录（如异常退出或文件锁导致的 race_s_* / race_l_* / deploy_*）
   */
  static cleanupStaleTempDirs(maxAgeMs = 10 * 60 * 1000): void {
    const now = Date.now()
    const scanAndClean = (baseDir: string, prefixes: string[]) => {
      try {
        if (!fs.existsSync(baseDir)) return
        for (const entry of fs.readdirSync(baseDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          if (!prefixes.some(p => entry.name.startsWith(p))) continue
          const full = path.join(baseDir, entry.name)
          try {
            const st = fs.statSync(full)
            if (now - st.mtimeMs >= maxAgeMs) {
              fs.rmSync(full, { recursive: true, force: true })
            }
          } catch {}
        }
      } catch {}
    }

    const racingRoot = this.TEMP_ROOT
    scanAndClean(racingRoot, ['race_s_', 'race_l_'])
    scanAndClean(path.dirname(racingRoot), ['deploy_'])
  }

  // ================= 方案 A：小文件全量竞速（适合清单、补丁、小配置 < 30MB） =================
  static async raceSmallFile(urls: string[], options: RaceOptions): Promise<string> {
    if (!urls || urls.length === 0) throw new Error('ERR_NO_URLS')

    const raceId = `race_s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const raceDir = path.join(this.TEMP_ROOT, raceId)
    fs.mkdirSync(raceDir, { recursive: true })

    const maxAttempts = 2
    let lastAttemptErrors: string[] = []

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controllers = urls.map(() => new AbortController())
        const mirrorErrors = new Array<string>(urls.length).fill('')
        let attemptTimedOut = false
        const attemptTimer = setTimeout(() => {
          attemptTimedOut = true
          controllers.forEach(c => c.abort())
        }, 60000)

        const raceOne = async (url: string, index: number): Promise<string> => {
          const tmpPath = path.join(raceDir, `a${attempt}_part_${index}.tmp`)
          try {
            await this.streamToFile(url, tmpPath, controllers[index].signal)
            if (controllers[index].signal.aborted) throw new Error('ABORTED')
            await this.validateSmallFile(tmpPath, options)
            if (controllers[index].signal.aborted) throw new Error('ABORTED')
            return tmpPath
          } catch (err: any) {
            const canceledByDeadline = attemptTimedOut && (err?.code === 'ERR_CANCELED' || err?.message === 'ABORTED')
            mirrorErrors[index] = `#${index + 1}:${canceledByDeadline ? 'TIMEOUT' : this.formatMirrorError(err)}`
            throw err
          }
        }

        const raceTasks = urls.map((u, i) => raceOne(u, i))
        let winnerTmp = ''
        try {
          winnerTmp = await Promise.any(raceTasks)
        } catch {
          lastAttemptErrors = mirrorErrors.filter(Boolean)
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 600))
            continue
          }
          const summary = lastAttemptErrors.length > 0 ? lastAttemptErrors.join(', ') : 'UNKNOWN'
          throw new Error(`ERR_RACE_ALL_FAILED:${summary}`)
        } finally {
          clearTimeout(attemptTimer)
          controllers.forEach(c => c.abort())
          // 关键：等待所有竞速任务分支完全退出，确保各分支流与文件句柄彻底释放
          await Promise.allSettled(raceTasks)
        }

        await this.moveFileWithRetry(winnerTmp, options.destPath)
        return options.destPath
      }

      throw new Error(`ERR_RACE_ALL_FAILED:${lastAttemptErrors.join(', ') || 'UNKNOWN'}`)
    } finally {
      await this.rmWithRetry(raceDir, 5)
    }
  }

  // ================= 方案 B：大文件窗口竞速（Aria2 托管，适合更新大包 > 30MB） =================
  static async raceLargeArchive(
    urls: string[],
    options: RaceOptions & { windowBytes?: number; windowTimeoutMs?: number }
  ): Promise<string> {
    if (!urls || urls.length === 0) throw new Error('ERR_NO_URLS')

    const WINDOW_BYTES = options.windowBytes ?? 16 * 1024 * 1024 // 16MB 冲刺线
    const WINDOW_TIMEOUT_MS = options.windowTimeoutMs ?? 20000    // 20 秒冲刺窗口
    const POLL_MS = 500

    const dir = path.dirname(options.destPath)
    const fileName = path.basename(options.destPath)
    const base = fileName.replace(/\.[^.]+$/, '')
    const ext = path.extname(fileName) || '.zip'

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    if (urls.length === 1) {
      const gid = await DownloadService.addUri(urls[0], { dir, title: fileName })
      if (gid === '__BROWSER_FALLBACK__') throw new Error('ERR_BROWSER_FALLBACK')
      await DownloadService.waitForCompletion(gid, 1800000)
      if (options.expectedSha256 && options.expectedSha256.trim()) {
        await this.verifySha256(options.destPath, options.expectedSha256)
      }
      return options.destPath
    }

    const raceDir = path.join(this.TEMP_ROOT, `race_l_${Date.now()}`)
    fs.mkdirSync(raceDir, { recursive: true })
    const gids: string[] = []

    try {
      for (let i = 0; i < urls.length; i++) {
        const gid = await DownloadService.addUri(urls[i], {
          dir: raceDir,
          title: `${base}_r${i}${ext}`
        })
        if (gid === '__BROWSER_FALLBACK__') throw new Error('ERR_BROWSER_FALLBACK')
        gids.push(gid)
      }

      const start = Date.now()
      let winnerIdx = -1
      while (Date.now() - start < WINDOW_TIMEOUT_MS) {
        for (let i = 0; i < gids.length; i++) {
          const st = await DownloadService.tellStatus(gids[i])
          if (!st) continue
          const done = parseInt(st.completedLength) || 0
          if (st.status === 'complete' || done >= WINDOW_BYTES) {
            winnerIdx = i
            break
          }
        }
        if (winnerIdx >= 0) break
        await new Promise(r => setTimeout(r, POLL_MS))
      }

      if (winnerIdx < 0) {
        let maxBytes = -1
        for (let i = 0; i < gids.length; i++) {
          const st = await DownloadService.tellStatus(gids[i])
          const done = st ? (parseInt(st.completedLength) || 0) : 0
          if (done > maxBytes) {
            maxBytes = done
            winnerIdx = i
          }
        }
        if (maxBytes <= 0) throw new Error('ERR_ALL_MIRRORS_STALLED')
      }

      for (let i = 0; i < gids.length; i++) {
        if (i !== winnerIdx) {
          await DownloadService.removeTask(gids[i]).catch(() => {})
        }
      }

      await DownloadService.waitForCompletion(gids[winnerIdx], 1800000)

      const winnerFile = path.join(raceDir, `${base}_r${winnerIdx}${ext}`)

      if (options.expectedSha256 && options.expectedSha256.trim()) {
        await this.verifySha256(winnerFile, options.expectedSha256)
      }

      if (fs.existsSync(options.destPath)) fs.unlinkSync(options.destPath)
      fs.renameSync(winnerFile, options.destPath)

      return options.destPath
    } finally {
      for (const gid of gids) {
        await DownloadService.removeTask(gid).catch(() => {})
      }
      await new Promise(r => setTimeout(r, 200))
      await this.rmWithRetry(raceDir, 5)
    }
  }

  // ================= 基础工具 =================
  private static assertZipHeader(filePath: string) {
    if (!fs.existsSync(filePath)) throw new Error('ERR_TARGET_MISSING')
    const stat = fs.statSync(filePath)
    if (stat.size < 22) throw new Error('ERR_SIZE_TOO_SMALL')

    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(4)
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    if (buf.toString('hex') !== '504b0304') throw new Error('ERR_INVALID_ZIP_HEADER')
  }

  private static async verifySha256(filePath: string, expected: string): Promise<void> {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    try {
      await new Promise<void>((resolve, reject) => {
        stream.on('data', d => hash.update(d))
        stream.on('end', () => resolve())
        stream.on('error', reject)
      })
    } finally {
      if (!stream.destroyed) stream.destroy()
    }
    const actual = hash.digest('hex').toLowerCase()
    if (actual !== expected.toLowerCase().trim()) {
      throw new Error(`ERR_SHA256_MISMATCH: expected ${expected}, got ${actual}`)
    }
  }

  private static async validateSmallFile(tmpPath: string, options: RaceOptions): Promise<void> {
    if (options.destPath.toLowerCase().endsWith('.zip')) {
      this.assertZipHeader(tmpPath)
      const archiveOk = await ArchiveService.test(tmpPath)
      if (!archiveOk) throw new Error('ERR_INVALID_ARCHIVE')
    }
    if (options.expectedSha256 && options.expectedSha256.trim()) {
      await this.verifySha256(tmpPath, options.expectedSha256)
    }
  }

  private static formatMirrorError(err: any): string {
    const status = err?.response?.status
    if (status) return `HTTP_${status}`
    const code = String(err?.code || '').toUpperCase()
    const msg = String(err?.message || 'NET_ERROR').replace(/[\r\n]+/g, ' ').trim()
    if (code === 'ECONNABORTED' || msg.toLowerCase().includes('timeout')) return 'TIMEOUT'
    if (code === 'ERR_CANCELED' || msg === 'ABORTED') return 'CANCELED'
    if (code) return code
    if (msg.startsWith('ERR_')) return msg.split(':')[0]
    return msg.slice(0, 32)
  }

  private static destroyStreamAndWaitClose(writer: fs.WriteStream, waitMs = 1000): Promise<void> {
    if (writer.closed) return Promise.resolve()
    return new Promise(resolve => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve()
      }
      const timer = setTimeout(done, waitMs)
      writer.once('close', done)
      writer.once('error', done)
      if (!writer.destroyed) writer.destroy()
    })
  }

  private static async streamToFile(url: string, dest: string, signal?: AbortSignal): Promise<void> {
    const res = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 8,
      headers: { 'User-Agent': 'TitanCore/2.0/Nexus' },
      signal,
      validateStatus: s => s >= 200 && s < 300
    })
    const writer = fs.createWriteStream(dest)
    try {
      await pipeline(res.data, writer)
    } catch (err) {
      await this.destroyStreamAndWaitClose(writer)
      throw err
    }
  }

  private static async moveFileWithRetry(src: string, dest: string, tries = 5): Promise<void> {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    for (let i = 0; i < tries; i++) {
      try {
        try {
          if (fs.existsSync(dest)) fs.unlinkSync(dest)
        } catch (unlinkErr: any) {
          if (unlinkErr?.code !== 'ENOENT') throw unlinkErr
        }
        try {
          fs.renameSync(src, dest)
        } catch (renErr: any) {
          if (renErr?.code === 'EXDEV') {
            fs.copyFileSync(src, dest)
            try { fs.unlinkSync(src) } catch {}
          } else {
            throw renErr
          }
        }
        return
      } catch (e: any) {
        const code = String(e?.code || '').toUpperCase()
        const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
        if (!retryable || i === tries - 1) throw e
        await new Promise(r => setTimeout(r, 150 * Math.pow(2, i)))
      }
    }
  }

  private static async rmWithRetry(target: string, tries = 5): Promise<void> {
    if (!fs.existsSync(target)) return
    for (let i = 0; i < tries; i++) {
      try {
        fs.rmSync(target, { recursive: true, force: true })
        return
      } catch (e) {
        if (i === tries - 1) break
        await new Promise(r => setTimeout(r, 250 * Math.pow(2, i)))
      }
    }
  }
}
