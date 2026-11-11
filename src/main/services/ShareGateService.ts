// 文件路径: src/main/services/ShareGateService.ts
import fs from 'node:fs'
import path from 'node:path'
import { Db } from '../db'
import { titanFetch } from '../TitanNet'
import { CloudSaveService } from './CloudSaveService'
import { SteamDetector } from './SteamDetector'
import { SteamLaunchService } from './SteamLaunchService'
import { WinNative } from '../utils/winNative'

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

export class ShareGateService {
  private static isAuthorizing = false
  private static authLockTimestamp = 0
  private static purgingSet = new Set<string>()

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
      } else if (action === 'purge-poison-cache') {
        const res = await this.purgeDenuvoPoisonCache(payload.app_id)
        return { code: 200, msg: `已排查并清理 ${res.purgedFiles.length} 个失效凭证文件`, data: res }
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
    // 1. 参数强断言 (Fail-Fast，兼容处理资源 ID 前缀)
    const strAppId = String(appId || '').replace(/^steam_gate_/, '').trim()
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

      // 4.5 前置主动排毒：仅在申领新凭据入库时，清除历史损坏的旧许可证，确保后续启动直接生成全新健康许可证
      let purgedCount = 0
      try {
        const purgeRes = await this.purgeDenuvoPoisonCache(strAppId)
        purgedCount = purgeRes.purgedFiles.length
      } catch (purgeErr) {
        console.warn('[ShareGateService] 申领前置排毒告警:', purgeErr)
      }

      // 5. 原生 Win32 API 直接写入 Steam 应用注册表（零临时文件、零 reg.exe 子进程）
      const appRegKey = `Software\\Valve\\Steam\\Apps\\${strAppId}`
      const okSteamId = WinNative.regWriteString('HKCU', appRegKey, 'SteamID', String(source_steamid64))
      const okAppTicket = WinNative.regWriteBinary('HKCU', appRegKey, 'AppTicket', Buffer.from(appticket_hex, 'hex'))
      const okETicket = (eticket_hex && eticket_hex.trim().length > 0)
        ? WinNative.regWriteBinary('HKCU', appRegKey, 'ETicket', Buffer.from(eticket_hex.trim(), 'hex'))
        : WinNative.regDeleteValue('HKCU', appRegKey, 'ETicket')

      const importSuccess = okSteamId && okAppTicket && okETicket
      if (!importSuccess) {
        console.error('[ShareGateService] 原生写入 Steam 注册表失败', { okSteamId, okAppTicket, okETicket })
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
          remaining: remaining !== undefined ? remaining : 4,
          purged_cache_count: purgedCount
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

  /**
   * 定位指定 AppID 对应游戏的本地安装根目录
   */
  static findGameInstallDir(steamPath: string, appId: string): string | null {
    const cleanAppId = String(appId || '').replace(/^steam_gate_/, '').trim()
    if (!steamPath || !cleanAppId || !/^\d+$/.test(cleanAppId)) return null

    try {
      const libraryRoots: string[] = [steamPath]
      const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
      if (fs.existsSync(vdfPath)) {
        const content = fs.readFileSync(vdfPath, 'utf-8')
        const matches = content.matchAll(/"path"\s+"([^"]+)"/g)
        for (const m of matches) {
          const raw = m[1].replace(/\\\\/g, '\\').trim()
          if (raw && !libraryRoots.some(r => r.toLowerCase() === raw.toLowerCase())) {
            libraryRoots.push(raw)
          }
        }
      }

      for (const lib of libraryRoots) {
        const acfPath = path.join(lib, 'steamapps', `appmanifest_${cleanAppId}.acf`)
        if (fs.existsSync(acfPath)) {
          const acfContent = fs.readFileSync(acfPath, 'utf-8')
          const m = acfContent.match(/"installdir"\s+"([^"]+)"/)
          if (m && m[1]) {
            const candidate = path.join(lib, 'steamapps', 'common', m[1])
            if (fs.existsSync(candidate)) {
              return candidate
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ShareGateService] 定位游戏安装目录异常:', e)
    }
    return null
  }

  /**
   * 前置主动清理 Denuvo 离线毒缓存（dbdata 等损坏的离线许可证文件）
   * 彻底解决由于 Steam 账号撕裂残留导致的 88500012 错误
   * 零感知、毫秒级靶向定向排毒，绝不影响玩家存档与系统核心文件
   */
  static async purgeDenuvoPoisonCache(appId: string): Promise<{ success: boolean; purgedFiles: string[] }> {
    const purgedFiles: string[] = []
    const cleanAppId = String(appId || '').replace(/^steam_gate_/, '').trim()
    if (!cleanAppId || !/^\d+$/.test(cleanAppId)) return { success: false, purgedFiles }

    // 幂等防重入并发锁
    if (this.purgingSet.has(cleanAppId)) {
      return { success: true, purgedFiles: [] }
    }
    this.purgingSet.add(cleanAppId)

    try {
      const detectRes = await SteamDetector.detect()
      const steamPath = detectRes?.path
      const installDir = steamPath ? this.findGameInstallDir(steamPath, cleanAppId) : null

      const POISON_FILE_REGEX = /^(dbdata(\..+)?|.*\.dbdata|denuvo_.*\.dat|steam_authe(\..+)?)$/i
      const SKIP_DIRS = new Set([
        'content', 'data', 'paks', 'assets', 'dlc', 'mods',
        '.git', 'shadercache', 'movies', 'sound', 'audio',
        'video', 'media', 'textures', 'ui'
      ])

      // 1. 靶向收集候选检查目录（根目录 + 二进制程序可能所在的一/二/三级目录，跳过资产大目录）
      if (installDir && fs.existsSync(installDir)) {
        const targetDirs = new Set<string>()
        targetDirs.add(installDir)

        const collectBinaryDirs = (currentDir: string, depth = 0) => {
          if (depth > 2 || !fs.existsSync(currentDir)) return
          try {
            const subEntries = fs.readdirSync(currentDir, { withFileTypes: true })
            for (const sub of subEntries) {
              if (sub.isDirectory() && !SKIP_DIRS.has(sub.name.toLowerCase())) {
                const subPath = path.join(currentDir, sub.name)
                targetDirs.add(subPath)
                collectBinaryDirs(subPath, depth + 1)
              }
            }
          } catch {}
        }

        collectBinaryDirs(installDir, 0)

        // 对收集到的可疑程序目录进行定向排毒
        for (const dir of targetDirs) {
          try {
            const files = fs.readdirSync(dir, { withFileTypes: true })
            for (const file of files) {
              if (file.isFile() && POISON_FILE_REGEX.test(file.name)) {
                const fullPath = path.join(dir, file.name)
                try {
                  fs.unlinkSync(fullPath)
                  purgedFiles.push(fullPath)
                  console.log(`[ShareGateService] 前置已自动清除 Denuvo 毒缓存: ${fullPath}`)
                } catch (delErr) {
                  console.warn(`[ShareGateService] 清理文件失败 ${fullPath}:`, delErr)
                }
              }
            }
          } catch {}
        }
      }

      // 2. 扫描 %LOCALAPPDATA% 目录下当前游戏或 AppID 绑定的专有缓存
      const localAppData = process.env.LOCALAPPDATA
      if (localAppData) {
        // A. %LOCALAPPDATA%\Denuvo 目录（严格仅清理包含 cleanAppId 的专有文件）
        const localDenuvoDir = path.join(localAppData, 'Denuvo')
        if (fs.existsSync(localDenuvoDir)) {
          try {
            const entries = fs.readdirSync(localDenuvoDir, { withFileTypes: true })
            for (const ent of entries) {
              if (ent.name.includes(cleanAppId)) {
                const p = path.join(localDenuvoDir, ent.name)
                try {
                  fs.rmSync(p, { recursive: true, force: true })
                  purgedFiles.push(p)
                } catch {}
              }
            }
          } catch {}
        }

        // B. 游戏专属目录 %LOCALAPPDATA%\<GameInstallDir>
        if (installDir) {
          const gameBaseName = path.basename(installDir)
          if (gameBaseName) {
            const localGameDir = path.join(localAppData, gameBaseName)
            if (fs.existsSync(localGameDir)) {
              try {
                const entries = fs.readdirSync(localGameDir, { withFileTypes: true })
                for (const ent of entries) {
                  if (ent.isFile() && POISON_FILE_REGEX.test(ent.name)) {
                    const p = path.join(localGameDir, ent.name)
                    try {
                      fs.unlinkSync(p)
                      purgedFiles.push(p)
                    } catch {}
                  }
                }
              } catch {}
            }
          }
        }
      }

      // 3. 扫描 %PROGRAMDATA%\Denuvo 目录（严格按照 cleanAppId 隔离过滤，杜绝误删其他合法正版游戏令牌）
      const programData = process.env.ProgramData || process.env.ALLUSERSPROFILE
      if (programData) {
        const progDenuvoDir = path.join(programData, 'Denuvo')
        if (fs.existsSync(progDenuvoDir)) {
          try {
            const entries = fs.readdirSync(progDenuvoDir, { withFileTypes: true })
            for (const ent of entries) {
              if (ent.name.includes(cleanAppId)) {
                const p = path.join(progDenuvoDir, ent.name)
                try {
                  fs.rmSync(p, { recursive: true, force: true })
                  purgedFiles.push(p)
                } catch {}
              }
            }
          } catch {}
        }
      }

      return { success: true, purgedFiles }
    } catch (err: any) {
      console.warn('[ShareGateService] 前置排毒流程异常:', err?.message)
      return { success: false, purgedFiles }
    } finally {
      this.purgingSet.delete(cleanAppId)
    }
  }
}
