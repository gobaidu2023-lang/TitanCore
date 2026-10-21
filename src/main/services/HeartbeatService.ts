// 文件名: src/main/services/HeartbeatService.ts
import { BrowserWindow } from 'electron'
import axios from 'axios'
import { app } from 'electron'
import * as os from 'os'

export class HeartbeatService {
  private static timer: NodeJS.Timeout | null = null
  private static active = false
  private static token = ''
  private static serverUrl = ''
  private static nonce = ''
  private static consecutiveErrors = 0

  // token 过期时的自救回调：由外部注入，防止循环依赖
  static onTokenRefresh: (() => Promise<string | null>) | null = null

  // 断线通知只触发一次，恢复前不重复向前端弹出警报
  private static failNotified = false

  static start(token: string, serverUrl: string) {
    this.stop()
    this.active = true
    this.token = token
    this.serverUrl = serverUrl.replace(/\/+$/, '')
    this.consecutiveErrors = 0
    this.tick()
  }

  static stop() {
    this.active = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.token = ''
    this.nonce = ''
    this.failNotified = false
  }

  private static cachedSpecs: { cpu: string; cpuCores: number; gpu: string; ram: string; osVersion: string } | null = null

  // 原生硬件信息提取工具（带持久缓存与注册表强力探测兜底，零阻塞）
  public static async getHardwareSpecs(): Promise<{ cpu: string; cpuCores: number; gpu: string; ram: string; osVersion: string }> {
    if (this.cachedSpecs) return this.cachedSpecs

    const cpus = os.cpus() || []
    const rawCpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Unknown CPU'
    const cpuModel = rawCpuModel
      .replace(/\(R\)/gi, '')
      .replace(/\(TM\)/gi, '')
      .replace(/CPU @ [\d.]+GHz/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Unknown CPU'
    const cpuCores = cpus.length
    const totalMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024))
    let gpuModel = 'Unknown GPU'

    // 1. 首选：Electron 内置图形驱动感知
    try {
      const gpuInfo = await (app as any).getGPUInfo('basic')
      if (gpuInfo?.gpuDevice?.length > 0) {
        const activeDevice = gpuInfo.gpuDevice.find((d: any) => d.active) || gpuInfo.gpuDevice[0]
        const rawGpuString = activeDevice?.deviceString || ''
        if (rawGpuString && !rawGpuString.toLowerCase().includes('basic')) {
          gpuModel = rawGpuString.replace(/Direct3D.*/i, '').replace(/D3D.*/i, '').trim()
        }
      }
    } catch {}

    // 2. 增强兜底：从 Windows 硬件驱动类注册表精准嗅探独显（无视 wmic 废弃与 Electron 图形沙箱限制）
    if (gpuModel === 'Unknown GPU' || gpuModel.toLowerCase().includes('basic')) {
      try {
        const { execSync } = require('child_process')
        const out = execSync('reg.exe query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}" /s /v DriverDesc', { encoding: 'utf-8', timeout: 2000 })
        const lines = out.split('\n').filter((l: string) => l.includes('DriverDesc'))
        const candidateGpus = lines
          .map((l: string) => l.split('REG_SZ')[1]?.trim())
          .filter(Boolean)
          .filter((name: string) => !/virtual|mirror|remote|idd|oray/i.test(name))

        if (candidateGpus.length > 0) {
          const discrete = candidateGpus.find((g: string) => /nvidia|geforce|amd|radeon|rtx|gtx/i.test(g))
          gpuModel = discrete || candidateGpus[0]
        }
      } catch {}
    }

    // 3. 操作系统版本人类友好格式化
    const rawRelease = os.release() || ''
    let friendlyOs = `Windows (${rawRelease})`
    try {
      const parts = rawRelease.split('.')
      const build = parseInt(parts[2] || '0', 10)
      if (parts[0] === '10' && parts[1] === '0') {
        friendlyOs = build >= 22000 ? `Windows 11 (Build ${build})` : `Windows 10 (Build ${build})`
      }
    } catch {}

    this.cachedSpecs = {
      cpu: cpuModel,
      cpuCores,
      gpu: gpuModel,
      ram: `${totalMemoryGB} GB`,
      osVersion: friendlyOs
    }
    return this.cachedSpecs
  }

  // 纯粹心跳与算力循环：剔除所有遥测与设备信息字段
  private static async tick() {
    if (!this.active || !this.token || !this.serverUrl) return

    const url = `${this.serverUrl}/titan/heartbeat.php`
    const payload = {
      nonce: this.nonce,
      current_view: 'discovery'
    }

    try {
      const res = await axios.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Titan-Token': this.token
        },
        timeout: 15000
      })

      const json = res.data
      if (json.code === 200 && json.data) {
        const raw = typeof json.data === 'object' ? (json.data?.data || json.data) : json.data
        const data = typeof raw === 'string'
          ? JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
          : raw

        this.nonce = data.next_challenge?.nonce || ''
        this.consecutiveErrors = 0

        // 之前断线后首次恢复，通知渲染进程
        if (this.failNotified) {
          this.failNotified = false
          const w = BrowserWindow.getAllWindows()[0]
          if (w && !w.isDestroyed()) {
            w.webContents.send('sys:heartbeat-recovered', {})
          }
        }

        // 同步收益数据到前端
        const win = BrowserWindow.getAllWindows()[0]
        if (win && !win.isDestroyed()) {
          win.webContents.send('sys:heartbeat-success', {
            earned: data.earned,
            hbits: data.hbits,
            status: data.status
          })
        }

        const delay = (data.next_challenge?.wait_seconds || 60) * 1000
        this.timer = setTimeout(() => this.tick(), delay)
        return
      }

      throw new Error('Invalid heartbeat response')
    } catch (e: any) {
      this.consecutiveErrors++
      console.warn('[Heartbeat] Failed:', e.message)

      // 401 凭证失效：自救刷新 Token
      if (e?.response?.status === 401 && this.onTokenRefresh) {
        const newToken = await this.onTokenRefresh().catch(() => null)
        if (newToken) {
          this.token = newToken
          this.consecutiveErrors = 0
          this.timer = setTimeout(() => this.tick(), 2000)
          return
        }
      }

      // 连续 3 次失败向 UI 报警
      if (this.consecutiveErrors >= 3 && !this.failNotified) {
        this.failNotified = true
        const w = BrowserWindow.getAllWindows()[0]
        if (w && !w.isDestroyed()) {
          w.webContents.send('sys:heartbeat-failed', { count: this.consecutiveErrors })
        }
      }

      // 阶梯退避重试
      const delay = this.consecutiveErrors > 5 ? 30000 : 5000
      this.timer = setTimeout(() => this.tick(), delay)
    }
  }
}