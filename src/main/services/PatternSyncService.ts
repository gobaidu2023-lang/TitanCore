import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Db } from '../db'
import { SteamDetector } from './SteamDetector'
import { ModeSwitchService } from './ModeSwitchService'
import { titanFetch } from '../TitanNet'

interface PatternTarget {
  category: 'pattern' | 'ipc'
  dllType: 'steamclient' | 'steamui'
  hash: string
  relativePath: string
}

export class PatternSyncService {
  /**
   * 计算指定文件的 SHA256 哈希值（小写 64 位十六进制）
   */
  private static calculateSha256(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) return null
      // TC-P1: 4MB 分段读，大文件不再整体进内存；保持同步签名，调用方零改动
      const hash = crypto.createHash('sha256')
      const fd = fs.openSync(filePath, 'r')
      try {
        const buf = Buffer.allocUnsafe(4 * 1024 * 1024)
        let bytes = 0
        while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
          hash.update(buf.subarray(0, bytes))
        }
      } finally {
        fs.closeSync(fd)
      }
      return hash.digest('hex').toLowerCase()
    } catch (e: any) {
      console.warn(`[PatternSyncService] 读取计算哈希失败: ${filePath}`, e.message)
      return null
    }
  }

  /**
   * 单个 Pattern/IPC 文件的拉取与安全落盘（落到 targetRoot 活根）
   */
  private static async fetchAndWritePattern(
    serverUrl: string,
    token: string,
    target: PatternTarget,
    targetRoot: string
  ): Promise<void> {
    const destPath = path.join(targetRoot, target.relativePath)
    if (fs.existsSync(destPath)) {
      return // 本地已就绪，跳过
    }

    try {
      const res = await titanFetch(`${serverUrl}/titan/pattern_mirror.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Titan-Token': token
        },
        body: JSON.stringify({
          category: target.category,
          dll_type: target.dllType,
          sha256: target.hash
        })
      })

      if (!res.ok) {
        return // 上游 404 或未同步，静默跳过
      }

      const json = await res.json() as { code?: number; data?: { content?: string } }
      const tomlContent = json?.data?.content

      if (json.code === 200 && typeof tomlContent === 'string' && tomlContent.trim().length > 0) {
        const parentDir = path.dirname(destPath)
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true })
        }
        // TC-P1: 临时文件 + rename，防写一半损坏目标文件
        const tmpPath = `${destPath}.tmp-${process.pid}`
        fs.writeFileSync(tmpPath, tomlContent, 'utf-8')
        fs.renameSync(tmpPath, destPath)
        console.log(`[PatternSyncService] 兜底同步成功: ${target.relativePath}`)
      }
    } catch (e: any) {
      // 保证零阻断
      console.warn(`[PatternSyncService] 同步 ${target.relativePath} 异常:`, e.message)
    }
  }

  /**
   * 核心校验与同步入口（零阻塞，永不向外抛错）
   * 铁律：原生 Steam DLL 哈希探测恒定走物理 Steam 根；落盘/复核恒定走 ModeSwitchService 活根
   */
  static async validatePatterns(): Promise<{ pulled: number; missing: string[]; error?: string }> {
    try {
      const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
      const token = Db.getEncrypted<any>('auth_ticket')?.token
      if (!serverUrl || !token) return { pulled: 0, missing: [], error: 'PREREQ_MISSING' }

      const detectRes = await SteamDetector.detect()
      const realRoot = detectRes?.path
      if (!realRoot || typeof realRoot !== 'string' || !fs.existsSync(realRoot)) {
        return { pulled: 0, missing: [], error: 'PREREQ_MISSING' }
      }

      // 获取当前模式下的活动根目录（纯净模式为 TC\ost，经典模式为 Steam 物理目录）
      const activeRoot = ModeSwitchService.getActiveRoot(realRoot)
      if (!activeRoot || typeof activeRoot !== 'string') {
        return { pulled: 0, missing: [], error: 'PREREQ_MISSING' }
      }

      // 自动自愈：活根若在文件系统中尚未生成，立即创建，不触发假性 PREREQ_MISSING
      if (!fs.existsSync(activeRoot)) {
        try {
          fs.mkdirSync(activeRoot, { recursive: true })
        } catch (e: any) {
          return { pulled: 0, missing: [], error: 'DIR_CREATE_FAIL:' + e.message }
        }
      }

      // 1. 本地 DLL SHA256 计算：【必须且恒定从真实 Steam 根读取】
      const clientDllPath = path.join(realRoot, 'steamclient64.dll')
      const uiDllPath = path.join(realRoot, 'steamui.dll')

      const clientHash = this.calculateSha256(clientDllPath)
      const uiHash = this.calculateSha256(uiDllPath)

      // 2. 构造探测目标
      const targets: PatternTarget[] = []

      if (clientHash) {
        targets.push({
          category: 'pattern',
          dllType: 'steamclient',
          hash: clientHash,
          relativePath: path.join('opensteamtool', 'pattern', 'steamclient', `${clientHash}.toml`)
        })
        targets.push({
          category: 'ipc',
          dllType: 'steamclient',
          hash: clientHash,
          relativePath: path.join('opensteamtool', 'ipc', 'steamclient', `${clientHash}.toml`)
        })
      }

      if (uiHash) {
        targets.push({
          category: 'pattern',
          dllType: 'steamui',
          hash: uiHash,
          relativePath: path.join('opensteamtool', 'pattern', 'steamui', `${uiHash}.toml`)
        })
      }

      // 若两颗原生 DLL 都无法计算出哈希，显式向外抛出明确错误，防止前端全部落在 falsy 上导致界面静默
      if (targets.length === 0) {
        return { pulled: 0, missing: [], error: 'STEAM_DLL_NOT_FOUND' }
      }

      // 3. 并发拉取缺失项（落盘写入【活动活根 activeRoot】）
      await Promise.allSettled(
        targets.map(t => this.fetchAndWritePattern(serverUrl, token, t, activeRoot))
      )

      // 4. 复核探测结果：【检查活动活根 activeRoot 中的落盘情况】
      const pulled = targets.filter(t => fs.existsSync(path.join(activeRoot, t.relativePath))).length
      const missing = targets.filter(t => !fs.existsSync(path.join(activeRoot, t.relativePath))).map(t => t.relativePath)
      return { pulled, missing }
    } catch (e: any) {
      console.warn('[PatternSyncService] validatePatterns 运行被安全捕获:', e.message)
      return { pulled: 0, missing: [], error: e?.message || 'UNKNOWN' }
    }
  }

  /**
   * 纯检测：返回 TOML 配置对齐诊断项（不复用 validatePatterns，因为那个是修复型）
   */
  static diagnoseAlignment(steamPath: string): { name: string; ok: boolean; message: string } {
    try {
      // TC-P12: DLL/steamui 是 Steam 原生文件，永远查真实根；投递产物跟随活根 ostRoot
      const ostRoot = ModeSwitchService.getActiveRoot(steamPath)
      const clientDllPath = path.join(steamPath, 'steamclient64.dll')
      const uiDllPath = path.join(steamPath, 'steamui.dll')

      const clientHash = this.calculateSha256(clientDllPath)
      const uiHash = this.calculateSha256(uiDllPath)

      const checks: string[] = []
      if (clientHash) {
        checks.push(path.join(ostRoot, 'opensteamtool', 'pattern', 'steamclient', `${clientHash}.toml`))
        checks.push(path.join(ostRoot, 'opensteamtool', 'ipc', 'steamclient', `${clientHash}.toml`))
      }
      if (uiHash) {
        checks.push(path.join(ostRoot, 'opensteamtool', 'pattern', 'steamui', `${uiHash}.toml`))
      }

      const allOk = checks.length > 0 && checks.every(p => fs.existsSync(p))

      return {
        name: 'DIAG_TOML_ALIGN',
        ok: allOk,
        message: allOk
          ? 'DIAG_TOML_OK'
          : 'DIAG_TOML_MISMATCH'
      }
    } catch (e: any) {
      return { name: 'DIAG_TOML_ALIGN', ok: false, message: 'DIAG_EXCEPTION:' + e.message }
    }
  }
}