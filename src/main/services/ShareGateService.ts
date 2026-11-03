// 文件路径: src/main/services/ShareGateService.ts
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'
import { Db } from '../db'
import { titanFetch } from '../TitanNet'
import { CloudSaveService } from './CloudSaveService'
import { SteamDetector } from './SteamDetector'
import { SteamLaunchService } from './SteamLaunchService'

export interface ShareGateSlot {
  slot_index: number
  status: 'locked' | 'available'
  created_at: number | null
  unlock_at: number | null
  remaining_seconds: number
  unlock_time_str: string
  desc: string
}

export interface ShareGateQuota {
  app_id: string
  share_type?: 'exclusive' | 'lottery'
  cost?: number
  warning_title?: string
  warning_desc?: string
  user_quota_remaining?: number
  lottery_claimed_count?: number
  lottery_max_count?: number
  lottery_cd_reached?: boolean
  lottery_unlock_time?: string
  lottery_remaining_seconds?: number
  limit: number
  remaining: number
  next_release_time?: string
  reset_at?: string
  user_already_claimed?: boolean
  user_daily_game_limit_reached?: boolean
  total_games_claimed?: number
  slots: ShareGateSlot[]
}

export interface ShareGateAuthPayload {
  app_id: string
  source_steamid64: string
  appticket_hex: string
  eticket_hex?: string | null
  remaining?: number
}

// 构造原子导入的 .reg 文件内容 (Windows Registry Editor Version 5.00 规范)
function buildRegContent(appId: string, sourceSteamId: string, appTicketHex: string, eticketHex?: string | null): string {
  const formatHex = (hex: string) => hex.match(/.{1,2}/g)?.join(',') || ''

  const appTicketBytes = formatHex(appTicketHex)
  // 单票: "ETicket"=- (系统原生物理清除旧键)；双票: "ETicket"=hex:... (覆盖写入)
  const eticketLine = (eticketHex && eticketHex.trim().length > 0)
    ? `"ETicket"=hex:${formatHex(eticketHex)}`
    : `"ETicket"=-`

  // 必须双反斜杠 \\ (JS 模板字符串转义后才是单个反斜杠)
  return [
    'Windows Registry Editor Version 5.00',
    '',
    `[HKEY_CURRENT_USER\\Software\\Valve\\Steam\\Apps\\${appId}]`,
    `"SteamID"="${sourceSteamId}"`,
    `"AppTicket"=hex:${appTicketBytes}`,
    eticketLine,
    ''
  ].join('\r\n')
}

export class ShareGateService {
  private static isAuthorizing = false
  private static authLockTimestamp = 0

  private static getServerUrl(): string {
    return Db.get<any>('app_seed_config')?.serverUrl || ''
  }

  private static getAuthToken(): string | null {
    return Db.getEncrypted<any>('auth_ticket')?.token || null
  }

  static async handleIpc(payload: any): Promise<{ code: number; msg?: string; data?: any }> {
    const action = payload?.action
    if (!action) {
      return { code: 400, msg: '缺少必要的操作指令' }
    }

    try {
      if (action === 'quota') {
        return await this.getQuota(payload.app_id)
      } else if (action === 'authorize') {
        return await this.authorize(payload.app_id, payload.target_steamid64)
      } else if (action === 'local-accounts') {
        return await this.getLocalSteamAccounts()
      } else if (action === 'ticket-records') {
        return this.getTicketRecords()
      }
      return { code: 400, msg: `未知操作指令: ${action}` }
    } catch (err: any) {
      console.error('[ShareGateService] 处理异常:', err)
      return { code: 500, msg: err?.message || '共享服务网关异常，请稍后重试' }
    }
  }

  // 查询游戏配额（含滑动 24 小时释放倒计时与 5 槽位全景时间矩阵）
  static async getQuota(appId: string): Promise<{ code: number; msg?: string; data?: ShareGateQuota }> {
    if (!appId || !/^\d+$/.test(String(appId))) {
      return { code: 400, msg: '无效的目标游戏 AppID' }
    }

    const defaultSlots: ShareGateSlot[] = Array.from({ length: 5 }, (_, i) => ({
      slot_index: i + 1,
      status: 'available' as const,
      created_at: null,
      unlock_at: null,
      remaining_seconds: 0,
      unlock_time_str: '',
      desc: '空闲可领'
    }))

    try {
      const serverUrl = this.getServerUrl()
      const token = this.getAuthToken()

      if (serverUrl) {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        }
        if (token) {
          headers['X-Titan-Token'] = token
        }
        const res = await titanFetch(`${serverUrl}/titan/titan_sharegate.php`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'quota', app_id: Number(appId) }),
          timeout: 8000
        })

        if (res.ok) {
          const json = await res.json()
          if (json && json.code === 200 && json.data) {
            return {
              code: 200,
              data: {
                app_id: String(appId),
                share_type: json.data.share_type || 'exclusive',
                cost: Number(json.data.cost) || 10,
                warning_title: json.data.warning_title || '',
                warning_desc: json.data.warning_desc || '',
                user_quota_remaining: Number(json.data.user_quota_remaining) || 0,
                lottery_claimed_count: Number(json.data.lottery_claimed_count) || 0,
                lottery_max_count: Number(json.data.lottery_max_count) || 4,
                lottery_cd_reached: !!json.data.lottery_cd_reached,
                lottery_unlock_time: json.data.lottery_unlock_time || '',
                lottery_remaining_seconds: Number(json.data.lottery_remaining_seconds) || 0,
                limit: json.data.limit ?? 5,
                remaining: json.data.remaining ?? 5,
                next_release_time: json.data.next_release_time || '',
                user_already_claimed: !!json.data.user_already_claimed,
                user_daily_game_limit_reached: !!json.data.user_daily_game_limit_reached,
                total_games_claimed: json.data.total_games_claimed ?? 0,
                slots: Array.isArray(json.data.slots) && json.data.slots.length > 0 ? json.data.slots : defaultSlots
              }
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('[ShareGateService] 专线配额接口暂不可达，启用安全兜底:', e?.message)
    }

    // 默认兜底展示（保障前端界面正常渲染）
    return {
      code: 200,
      data: {
        app_id: String(appId),
        limit: 5,
        remaining: 5,
        next_release_time: '',
        slots: defaultSlots
      }
    }
  }

  // 执行授权提取与本地注册表原子写入
  static async authorize(appId: string, targetSteamId64: string): Promise<{ code: number; msg?: string; data?: any }> {
    // 1. 参数强断言 (Fail-Fast，不清洗直报)
    const strAppId = String(appId || '').trim()
    const strSteamId = String(targetSteamId64 || '').trim()

    if (!/^\d+$/.test(strAppId)) {
      return { code: 400, msg: '游戏 AppID 必须为纯数字' }
    }
    if (!/^\d{17,20}$/.test(strSteamId)) {
      return { code: 400, msg: '目标授权账号的 SteamID64 格式无效' }
    }

    // 2. 防重写锁 (看门狗 40 秒超龄强制复位)
    const now = Date.now()
    if (this.isAuthorizing && (now - this.authLockTimestamp < 40000)) {
      return { code: 429, msg: '正在为您向 Steam 专线获取凭据，请勿重复点击' }
    }

    this.isAuthorizing = true
    this.authLockTimestamp = now

    try {
      const serverUrl = this.getServerUrl()
      const token = this.getAuthToken()

      if (!serverUrl || !token) {
        return { code: 401, msg: '未检测到有效的用户登录凭证，请登录后重试' }
      }

      // 3. 向后端专线发起凭据请求 (32s 超时)
      const res = await titanFetch(`${serverUrl}/titan/titan_sharegate.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Titan-Token': token
        },
        body: JSON.stringify({
          action: 'authorize',
          app_id: Number(strAppId),
          target_steamid64: strSteamId
        }),
        timeout: 32000
      })

      const json = await res.json().catch(() => null)
      if (!res.ok || !json || json.code !== 200 || !json.data) {
        const errCode = json?.code || res.status || 500
        const errMsg = json?.msg || '未能成功从正版号池获取凭据，请稍后重试'
        return { code: errCode, msg: errMsg }
      }

      const { source_steamid64, appticket_hex, eticket_hex, remaining } = json.data

      // 4. 返回凭据强断言
      if (!/^\d{17,20}$/.test(String(source_steamid64 || ''))) {
        return { code: 500, msg: '后端下发的源账号 SteamID 凭据损坏' }
      }
      if (!appticket_hex || typeof appticket_hex !== 'string' || (appticket_hex.length % 2 !== 0) || !/^[0-9a-fA-F]+$/.test(appticket_hex)) {
        return { code: 500, msg: '后端下发的所有权票据 (AppTicket) 校验不合格' }
      }
      if (eticket_hex && (typeof eticket_hex !== 'string' || (eticket_hex.length % 2 !== 0) || !/^[0-9a-fA-F]+$/.test(eticket_hex))) {
        return { code: 500, msg: '后端下发的加密票据 (ETicket) 校验不合格' }
      }

      // 5. 构造临时 .reg 文件
      const regContent = buildRegContent(strAppId, String(source_steamid64), appticket_hex, eticket_hex)
      const tempRegPath = path.join(os.tmpdir(), `tc_share_${strAppId}_${Date.now()}.reg`)

      await fs.promises.writeFile(tempRegPath, regContent, 'utf8')

      // 6. 原子导入注册表并安全清理临时文件 (统一在 finish 闭环)
      const importSuccess = await new Promise<boolean>((resolve) => {
        execFile('reg.exe', ['import', tempRegPath], { windowsHide: true, timeout: 5000 }, (error) => {
          // 清理临时文件，容错重试
          try {
            if (fs.existsSync(tempRegPath)) {
              fs.rmSync(tempRegPath, { force: true, maxRetries: 3, retryDelay: 100 })
            }
          } catch (e) {
            console.warn('[ShareGateService] 清理临时 .reg 文件告警:', e)
          }

          if (error) {
            console.error('[ShareGateService] reg.exe import 失败:', error)
            resolve(false)
          } else {
            resolve(true)
          }
        })
      })

      if (!importSuccess) {
        return { code: 500, msg: '写入本地 Steam 注册表失败，请检查杀毒软件权限拦截' }
      }

      // 7. 写入本地操作日志 (环形缓存，非核心数据，独立 try/catch)
      try {
        Db.run(
          `INSERT INTO sharegate_ticket_records (app_id, source_steamid, target_steamid, created_at) VALUES (?, ?, ?, ?)`,
          [strAppId, String(source_steamid64), strSteamId, new Date().toISOString()]
        )
      } catch (logErr) {
        // 忽略日志写入异常，不影响主流程
      }

      return {
        code: 200,
        msg: '授权成功',
        data: {
          app_id: strAppId,
          share_type: json.data.share_type || 'exclusive',
          quota_remaining: json.data.quota_remaining,
          remaining: remaining !== undefined ? remaining : 4
        }
      }
    } catch (err: any) {
      console.error('[ShareGateService] 授权执行异常:', err)
      return { code: 500, msg: err?.message || '授权执行异常，请检查网络后重试' }
    } finally {
      this.isAuthorizing = false
    }
  }

  // 本地票档只读记录
  static getTicketRecords(): { code: number; data: any[] } {
    try {
      const rows = Db.query<any>(`SELECT * FROM sharegate_ticket_records ORDER BY id DESC LIMIT 100`)
      return { code: 200, data: rows || [] }
    } catch {
      return { code: 200, data: [] }
    }
  }

  // 获取本地登录账号列表
  static async getLocalSteamAccounts(): Promise<{ code: number; msg?: string; data?: any }> {
    try {
      const detectRes = await SteamDetector.detect()
      const steamPath = detectRes?.path
      if (!steamPath) {
        return { code: 200, data: { current: null, accounts: [] } }
      }
      const predicted = SteamLaunchService.predictActiveSteamAccount(steamPath)
      const accounts = CloudSaveService.getDetailedSteamAccounts(steamPath)
      const currentUser = predicted || accounts.find(a => a.mostRecent) || accounts[0] || null
      return {
        code: 200,
        data: {
          current: currentUser ? {
            steamId64: currentUser.steamId64,
            accountName: currentUser.accountName,
            personaName: currentUser.personaName
          } : null,
          accounts: accounts.map(a => ({
            steamId64: a.steamId64,
            accountName: a.accountName,
            personaName: a.personaName,
            mostRecent: !!a.mostRecent
          }))
        }
      }
    } catch (e: any) {
      console.warn('[ShareGateService] 读取本地 Steam 账号失败:', e)
      return { code: 200, data: { current: null, accounts: [] } }
    }
  }
}
