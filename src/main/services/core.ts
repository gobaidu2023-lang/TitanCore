// 文件路径: \src\main\services\core.ts
import { ipcMain, BrowserWindow, shell, dialog, app, protocol, net } from 'electron'
import fs from 'node:fs'
import { spawn, execFile } from 'node:child_process'
import util from 'node:util'
import { Readable } from 'stream'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Db } from '../db'
import { SecurityService } from './SecurityService'
import { SteamDetector } from './SteamDetector'
import { EngineService, registerEngineService } from './EngineService'
import { SyncManager } from './SyncManager'
import { TitanProtocol, ProtocolConfig } from './TitanProtocol'
import { ResourceService } from './ResourceService'
import { SearchService } from './SearchService'
import { LibraryService } from './LibraryService'
import { GatewayService } from './GatewayService'
import { titanFetch } from '../TitanNet'
import { CoverPackService } from './CoverPackService'
import { DownloadService } from './DownloadService'
import { UpdaterService } from './UpdaterService'
import { HeartbeatService } from './HeartbeatService'
import { PatternSyncService } from './PatternSyncService'
import { registerGameService, GAMES_ROOT } from './GameService'
import { registerMiniGameAssetService, MINI_GAME_IDS } from './MiniGameAssetService'
import { DepotKeyService } from './DepotKeyService'
import { ModeSwitchService } from './ModeSwitchService'
import { SteamLaunchService } from './SteamLaunchService'
import { CloudSaveService, registerCloudSaveService } from './CloudSaveService'
import { ToolService, registerToolService } from './ToolService'
import { DiagnosticExportService } from './DiagnosticExportService'
import { ShareGateService } from './ShareGateService'
import { DepotHealerService } from './DepotHealerService'

// 进程保活：杜绝 dev 调试时因微小未捕获异步异常导致闪退
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason)
})
// ===================== 日志落盘结束 =====================

const TITAN_SALT = process.env.TITAN_SALT || 'TITAN_COMMUNITY_DEFAULT_SALT'
const DEFAULT_NODES: Record<string, string> = {
  node1: process.env.TITAN_NODE_1 || '',
  node2: process.env.TITAN_NODE_2 || '',
  node3: process.env.TITAN_NODE_3 || ''
}

let activeNodeUrls: Record<string, string> | null = null
let currentConnectedNode: string | null = null
let mainWindowRef: BrowserWindow | null = null
let serverUrl: string = ''
let activeResetSession: { uid: number; ticket: string; expire: number } | null = null

const safeSend = (channel: string, data: any) => {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data)
  }
}

const decodeKey = (key: string) => {
  if (!key) return ''
  if (key.startsWith('http://') || key.startsWith('https://')) return key
  if (key.startsWith('TITAN-')) {
    try {
      return Array.from(Buffer.from(key.slice(6).split('').reverse().join(''), 'base64').toString('binary'))
        .map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ TITAN_SALT.charCodeAt(i % TITAN_SALT.length)))
        .join('')
    } catch {
      return ''
    }
  }
  return key
}

export const getNodeUrl = (nodeId: string) => decodeKey((activeNodeUrls?.[nodeId] || DEFAULT_NODES[nodeId]) ?? '')

export const setNodeUrls = (urls: Record<string, string>) => {
  activeNodeUrls = { ...urls }
  Db.set('titan_nodes', { selectedNode: Db.get<any>('titan_nodes')?.selectedNode || 'node1', nodes: activeNodeUrls })
}

const pushStatus = (status: any) => safeSend('auth:status', status)

async function refreshCopywriting(sUrl: string): Promise<void> {
  try {
    if (!sUrl) return
    const base = sUrl.endsWith('/') ? sUrl.slice(0, -1) : sUrl
    const verRes = await titanFetch(`${base}/titan/vote.php?action=copy_version&t=${Date.now()}`, { timeout: 5000 })
    if (!verRes.ok) return
    const verJson = await verRes.json()
    const remoteVer = verJson?.version
    if (!remoteVer || typeof remoteVer !== 'string') return
    if (Db.get<string>('copy_version') === remoteVer) return
    const pullRes = await titanFetch(`${base}/titan/vote.php?action=copy_pull&t=${Date.now()}`, { timeout: 5000 })
    if (!pullRes.ok) return
    const pullJson = await pullRes.json()
    if (pullJson?.ok && pullJson.guide && typeof pullJson.guide === 'object' && pullJson.version === remoteVer) {
      Db.set('copy_guide', pullJson.guide)
      Db.set('copy_version', remoteVer)
      console.error(`[COPY] 指南文案已热更 version=${remoteVer}`)
    }
  } catch { /* 静默兜底 */ }
}

async function doConnect(nodeId: string) {
  const url = getNodeUrl(nodeId)
  if (!url) return { success: false }
  try {
    const res = await titanFetch(`${url}?t=${Date.now()}`)
    if (!res.ok) return { success: false }
    const seed = await res.json()
    if (!seed || typeof seed !== 'object') return { success: false }

    seed.nodes && setNodeUrls(seed.nodes)
    if (seed.api_base || seed.endpoints) {
      const old = Db.get<any>('app_seed_config') || {}
      const newConfig = {
        ...old,
        serverUrl: seed.api_base || old.serverUrl,
        endpoints: seed.endpoints || old.endpoints,
        shopUrl: seed.shop_url || seed.shop || old.shopUrl,
        stUrl: seed.st || old.stUrl
      }
      Db.set('app_seed_config', newConfig)
      serverUrl = newConfig.serverUrl || serverUrl
    }
    currentConnectedNode = nodeId
    EngineService.initEngineConfig().catch(() => {})
    return { success: true, seed }
  } catch (e) {
    console.error('[NET] doConnect failed:', e)
    return { success: false }
  }
}

// Happy Eyeballs: in-memory staggered ladder probing (session-only, never persists selectedNode)
export const autoConnect = async () => {
  const saved = Db.get<{ selectedNode: string; nodes?: Record<string, string> }>('titan_nodes')
  console.log('[NET:AutoConnect] 启动自动连接, 读取本地保存节点状态:', JSON.stringify(saved))
  activeNodeUrls = saved?.nodes || null

  // 0. one-time legacy normalize: 借助 titan_nodes_v2_migrated 闸门确保只执行一次存量清洗，
  //    老用户残留 node1 归一为 auto；后续用户在设置页显式选取的 node1 永久保留不受洗盘影响
  const isMigrated = Db.get<boolean>('titan_nodes_v2_migrated')
  if (!isMigrated) {
    if (saved && saved.selectedNode === 'node1') {
      const normalized = { selectedNode: 'auto', nodes: saved.nodes || {} }
      Db.set('titan_nodes', normalized)
      if (saved) saved.selectedNode = 'auto'
    }
    Db.set('titan_nodes_v2_migrated', true)
  }

  // 1. explicit manual pin (any concrete node id), single-node direct connect
  const manualNode = saved?.selectedNode
  if (manualNode && manualNode !== 'auto') {
    const res = await doConnect(manualNode)
    if (res.success) {
      pushStatus({ isConnected: true, selectedNode: manualNode, actualNode: manualNode, error: null, seed: res.seed })
      await autoLogin()
      return
    }
  }

  // 2. staggered ladder: node1 @0ms, node2 @350ms, node3 @700ms
  const candidateNodes = ['node1', 'node2', 'node3']
  const abortController = new AbortController()
  const { signal } = abortController

  const attemptConnect = async (nodeId: string): Promise<{ nodeId: string; seed: any }> => {
    const url = getNodeUrl(nodeId)
    console.log(`[NET:Probe] 开始探测节点 [${nodeId}], 目标URL: ${url}`)
    if (!url) {
      console.warn(`[NET:Probe] 节点 [${nodeId}] 解析URL为空!`)
      throw new Error('ERR_EMPTY_URL')
    }
    const startTime = Date.now()
    try {
      const res = await titanFetch(`${url}?t=${Date.now()}`, { signal, timeout: 6000 })
      const elapsed = Date.now() - startTime
      console.log(`[NET:Probe] 节点 [${nodeId}] HTTP响应: 状态码=${res.status}, 耗时=${elapsed}ms`)
      if (!res.ok) throw new Error(`HTTP_${res.status}`)
      const seed = await res.json()
      if (!seed || typeof seed !== 'object') throw new Error('ERR_INVALID_SEED')
      console.log(`[NET:Probe] 节点 [${nodeId}] 数据校验通过`)
      return { nodeId, seed }
    } catch (err: any) {
      const elapsed = Date.now() - startTime
      console.warn(`[NET:Probe] 节点 [${nodeId}] 探测失败(耗时${elapsed}ms): ${err?.message || err}`)
      throw err
    }
  }

  const racePromise = new Promise<{ nodeId: string; seed: any }>((resolve, reject) => {
    let failedCount = 0
    const total = candidateNodes.length

    candidateNodes.forEach((nodeId, index) => {
      const delay = index * 350
      new Promise<void>(r => setTimeout(r, delay)).then(async () => {
        if (signal.aborted) return
        try {
          const result = await attemptConnect(nodeId)
          if (!signal.aborted) {
            abortController.abort()
            resolve(result)
          }
        } catch (err) {
          failedCount++
          if (failedCount >= total) {
            reject(new Error('ALL_NODES_UNREACHABLE'))
          }
        }
      })
    })
  })

  try {
    const winner = await racePromise
    currentConnectedNode = winner.nodeId

    // 仅由竞速获胜节点更新网络与种子配置，杜绝落败请求造成的并发覆盖
    const winSeed = winner.seed
    if (winSeed) {
      winSeed.nodes && setNodeUrls(winSeed.nodes)
      if (winSeed.api_base || winSeed.endpoints) {
        const old = Db.get<any>('app_seed_config') || {}
        const newConfig = {
          ...old,
          serverUrl: winSeed.api_base || old.serverUrl,
          endpoints: winSeed.endpoints || old.endpoints,
          shopUrl: winSeed.shop_url || winSeed.shop || old.shopUrl,
          stUrl: winSeed.st || old.stUrl
        }
        Db.set('app_seed_config', newConfig)
        serverUrl = newConfig.serverUrl || serverUrl
      }
    }

    // contract: selectedNode keeps the user's selection ('auto'), actualNode reports the winner
    pushStatus({
      isConnected: true,
      selectedNode: manualNode || 'auto',
      actualNode: winner.nodeId,
      error: null,
      seed: winner.seed
    })

    EngineService.initEngineConfig().catch(() => {})
    await autoLogin()
  } catch (e: any) {
    console.error('[NET] all ladder probes failed:', e.message)
    pushStatus({ isConnected: false, selectedNode: manualNode || 'auto', actualNode: null, error: 'ERR_ALL_NODES_DOWN' })
  }
}

async function requestBase64<T>(endpoint: string, body: object): Promise<{ data: T | null; err?: string }> {
  if (!serverUrl) return { data: null, err: 'ERR_SERVER_REQUIRED' }
  try {
    const res = await titanFetch(`${serverUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      if (res.status === 400) {
        try {
          const errJson = await res.json()
          if (errJson?.msg && typeof errJson.msg === 'string') {
            return { data: null, err: errJson.msg }
          }
        } catch {}
      }
      if (res.status === 401) return { data: null, err: 'ERR_INVALID_CREDENTIALS' }
      if (res.status === 409) return { data: null, err: 'ERR_IDENTITY_OCCUPIED' }
      if (res.status === 429) return { data: null, err: 'ERR_TOO_MANY_REQUESTS' }
      if (res.status >= 500) return { data: null, err: 'ERR_SERVER_MAINTENANCE' }
      return { data: null, err: `ERR_REQUEST_ERROR:${res.status}` }
    }

    const json = await res.json() as { data?: { data?: string } | string }
    const base64Payload = typeof json.data === 'object' ? json.data?.data : json.data
    if (!base64Payload || typeof base64Payload !== 'string') return { data: null, err: 'ERR_SERVER_RESPONSE_ERROR' }

    const decoded = SecurityService.decryptPayload<T>(base64Payload)
    return { data: decoded, err: decoded ? undefined : 'ERR_DECRYPT_FAIL' }
  } catch (e: any) {
    return { data: null, err: 'ERR_NETWORK_ERROR' }
  }
}

async function requestBootstrap(): Promise<any | null> {
  const token = Db.getEncrypted<any>('auth_ticket')?.token
  if (!serverUrl || !token) return null
  try {
    const res = await titanFetch(`${serverUrl}/titan/bootstrap.php?t=${Date.now()}`, {
      headers: { 'X-Titan-Token': token }
    })
    if (!res.ok) return null
    const json = await res.json() as { data?: { data?: string } | string }
    const hexPayload = typeof json.data === 'object' ? json.data?.data : json.data
    if (!hexPayload) return null
    const decrypted = SecurityService.decryptNetworkPayload<any>(hexPayload)
    return decrypted?.data ?? null
  } catch (e) {
    return null
  }
}

async function postLoginSync(userId: number, username: string): Promise<{ success: boolean; msg?: string }> {
  const p = await requestBootstrap()
  if (!p) return { success: false, msg: 'ERR_BOOTSTRAP_FAIL' }

  const up = p.user_profile
  const quota = p.quota_info
  if (up) {
    const profile = {
      id: up.id, username: up.username, email: up.email || '', avatarUrl: up.avatar || '', hbits: up.hbits || 0, groupIds: [], mainGroup: up.level_label || 'Free', vipLevel: up.level_id || 0,
      dailyQuota: { used: quota?.used || 0, limit: quota?.limit || 0, remaining: quota?.remaining || 0, extraRemaining: quota?.extra_remaining || quota?.extraRemaining || 0 },
      isVip: (up.level_id || 0) > 0, vipExpireDate: up.expire_date || ((up.level_id || 0) > 0 ? 'ACTIVE' : null), cores: (up.level_id || 0) > 1 ? 4 : 1
    }
    Db.set(`user.${up.id}.profile`, profile)
  }
  if (p.endpoints) Db.set('endpoints', p.endpoints)
  if (p.sidebar) Db.set('sidebar', p.sidebar)
  if (p.app_config) Db.set('app_settings', p.app_config)
  if (quota) Db.set('quota_info', quota)

  safeSend('auth:bootstrap', { endpoints: p.endpoints, sidebar: p.sidebar, appConfig: p.app_config, userProfile: p.user_profile, quotaInfo: quota })
  safeSend('auth:login-success', { userId, username })
  return { success: true }
}

const issueTicket = async (data: any, identifier: string, expire: number): Promise<{ success: boolean; msg: string }> => {
  const saved = Db.setEncrypted('auth_ticket', { token: data.access_token, refresh_token: data.refresh_token, userId: data.user_id, username: data.username || identifier, expires_in: expire, session_key: data.session_key || '' })
  if (!saved) return { success: false, msg: 'ERR_TICKET_STORE_FAIL' }

  SecurityService.initializeNetworkSecurity(data.session_key || '')
  const syncRes = await postLoginSync(data.user_id, data.username || identifier)

  if (!syncRes.success) {
    Db.setEncrypted('auth_ticket', null)
    SecurityService.initializeNetworkSecurity('')
    return { success: false, msg: syncRes.msg || 'ERR_SYNC_FAIL' }
  }

  const freshTicket = Db.getEncrypted<any>('auth_ticket')
  if (freshTicket?.token && serverUrl) {
    HeartbeatService.start(freshTicket.token, serverUrl)
  }

  setTimeout(() => {
    safeSend('app:trigger-update-check', {})
  }, 4000)
  return { success: true, msg: 'SUCCESS_AUTH' }
}

async function handleLogin(identification: string, password: string) {
  const result = await requestBase64<any>('/titan/titan_auth.php', { action: 'login', identification, password, device_id: 'titan_desktop_v15' })
  if (result.err) return { success: false, msg: result.err }
  const data = result.data
  return data?.access_token ? await issueTicket(data, identification, 7200) : { success: false, msg: 'ERR_INVALID_CREDENTIALS' }
}

async function handleRegister(username: string, email: string, password: string) {
  const result = await requestBase64<any>('/titan/titan_register.php', { username, email, password, device_id: 'titan_desktop_v15' })
  if (result.err) return { success: false, msg: result.err }
  const data = result.data
  return data?.access_token ? await issueTicket(data, username, 3600) : { success: false, msg: 'ERR_REGISTER_REJECTED' }
}

async function handleRefresh() {
  const t = Db.getEncrypted<any>('auth_ticket')
  if (!t?.refresh_token) return { success: false, msg: 'ERR_TICKET_LOST' }
  const result = await requestBase64<any>('/titan/titan_auth.php', { action: 'refresh', refresh_token: t.refresh_token, device_id: 'titan_desktop_v15' })
  if (result.err) return { success: false, msg: result.err }
  const data = result.data
  if (!data?.access_token) return { success: false, msg: 'ERR_TICKET_EXPIRED' }

  Db.setEncrypted('auth_ticket', { ...t, token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in || 7200, session_key: data.session_key || t.session_key || '' })
  data.session_key && SecurityService.initializeNetworkSecurity(data.session_key)
  return { success: true, msg: 'SUCCESS_REFRESH' }
}

export async function autoLogin() {
  if (!serverUrl) {
    const seed = Db.get<any>('app_seed_config')
    if (seed?.serverUrl) serverUrl = seed.serverUrl
  }
  if (!serverUrl) return

  const ticket = Db.getEncrypted<any>('auth_ticket')
  if (!ticket?.token) {
    safeSend('auth:ready-guest', null)
    return
  }

  const res = await handleRefresh()
  if (!res.success) {
    safeSend('auth:session-invalid', { message: res.msg })
    pushStatus({ isConnected: true, selectedNode: currentConnectedNode, error: res.msg || 'ERR_SESSION_INVALID' })
    return
  }

  const syncRes = await postLoginSync(ticket.userId, ticket.username)
  if (!syncRes.success) {
    safeSend('auth:session-invalid', { message: syncRes.msg || 'ERR_SYNC_FAIL' })
    pushStatus({ isConnected: true, selectedNode: currentConnectedNode, error: syncRes.msg || 'ERR_SYNC_FAIL' })
  } else {
    const freshTicket = Db.getEncrypted<any>('auth_ticket')
    if (freshTicket?.token && serverUrl) {
      HeartbeatService.start(freshTicket.token, serverUrl)
    }
    setTimeout(() => {
      safeSend('app:trigger-update-check', {})
    }, 4000)
  }
}

async function handleRedeem(card: string, contact: string): Promise<{ success: boolean; msg: string }> {
  const ticket = Db.getEncrypted<any>('auth_ticket')
  if (!ticket?.token) return { success: false, msg: 'ERR_LOGIN_REQUIRED' }
  if (!serverUrl) return { success: false, msg: 'ERR_SERVER_REQUIRED' }

  try {
    const res = await titanFetch(`${serverUrl}/titan/nuke.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Titan-Token': ticket.token }, body: JSON.stringify({ card, contact }) })
    const json = await res.json() as { code?: number; msg?: string; data?: any }
    if (json.code !== 200) return { success: false, msg: json.msg || 'ERR_REDEEM_FAIL' }

    const hexPayload = json.data?.data
    if (!hexPayload || typeof hexPayload !== 'string') return { success: false, msg: 'ERR_SERVER_RESPONSE_ERROR' }

    const decrypted = SecurityService.decryptNetworkPayload<any>(hexPayload)
    if (!decrypted) return { success: false, msg: 'ERR_DECRYPT_FAIL' }

    const expireDate = decrypted.data?.expire_date || 'PERMANENT'
    await postLoginSync(ticket.userId, ticket.username)
    return { success: true, msg: 'SUCCESS_REDEEM', data: { expireDate } }
  } catch (e: any) {
    return { success: false, msg: 'ERR_NETWORK_ERROR' }
  }
}

async function forgotApi(body: object): Promise<any> {
  if (!serverUrl) return { ok: false, msg: 'ERR_OFFLINE_MODE' }
  try {
    const res = await titanFetch(`${serverUrl}/titan/reset_api.php`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Titan-Token': 'titan666' }, body: JSON.stringify(body) })
    return await res.json()
  } catch (e) {
    return { ok: false, msg: 'ERR_NETWORK_ERROR' }
  }
}

async function fetchSecureLinkDirect(resourceId: string, sUrl: string): Promise<{ success: boolean; mirrors?: any[]; coverUrl?: string; msg?: string }> {
  const token = Db.getEncrypted<any>('auth_ticket')?.token
  if (!sUrl || !token) return { success: false, msg: 'ERR_OFFLINE_OR_UNAUTHORIZED' }

  try {
    const res = await titanFetch(`${sUrl}/titan/titan_gateway.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Titan-Token': token },
      body: JSON.stringify({ action: 'fetch_secure_link', resource_id: resourceId })
    })

    let json: { code?: number; msg?: string; data?: { data?: string } | string } | null = null
    try {
      json = await res.json() as any
    } catch {}

    if (res.status === 429 || json?.code === 429) return { success: false, msg: json?.msg || 'QUOTA_EXHAUSTED' }
    if (!res.ok) return { success: false, msg: json?.msg || `ERR_REQUEST:${res.status}` }


    if (!json || json.code !== 200) return { success: false, msg: json?.msg || 'errors.deployNoManifest' }

    const hexPayload = typeof json.data === 'object' ? json.data?.data : json.data
    if (!hexPayload) return { success: false, msg: 'ERR_SERVER_RESPONSE' }

    const decrypted = SecurityService.decryptNetworkPayload<any>(hexPayload)
    if (!decrypted || !decrypted.data) return { success: false, msg: 'ERR_DECRYPT_FAIL' }

    const actualData = decrypted.quota_limit !== undefined ? decrypted : (decrypted.data || decrypted)
    if (actualData.quota_limit !== undefined) {
      GatewayService.pushQuotaUpdate(actualData.quota_limit, actualData.quota_remaining, actualData.extra_remaining || 0)
    }

    const mirrors = Array.isArray(decrypted.data) 
      ? decrypted.data 
      : (decrypted.data.data || decrypted.data.mirrors || [])

    const coverUrl = (actualData as any).cover_url || ''

    return { success: true, mirrors, coverUrl }
  } catch (e: any) {
    return { success: false, msg: 'ERR_NETWORK_ERROR' }
  }
}

let isAppFirstLaunch = false

export function initCore(mainWindow: BrowserWindow, isFirstLaunch = false) {
  isAppFirstLaunch = isFirstLaunch
  mainWindowRef = mainWindow
  serverUrl = Db.get<any>('app_seed_config')?.serverUrl || ''

  DownloadService.registerIpcHandlers()
  DownloadService.startDaemon().catch(() => {})

  HeartbeatService.onTokenRefresh = async () => {
    const res = await handleRefresh()
    return res.success ? (Db.getEncrypted<any>('auth_ticket')?.token || null) : null
  }
  UpdaterService.registerIpcHandlers()

  setTimeout(() => {
    PatternSyncService.validatePatterns().catch(() => {})
  }, 30000)

  setTimeout(() => {
    refreshCopywriting(serverUrl).catch(() => {})
  }, 4000)

  setTimeout(() => {
    DepotKeyService.syncIfNeeded().catch(() => {})
  }, 120_000)
  
  CoverPackService.init()
  try { (protocol as any).unhandle('titan-img') } catch {}
  protocol.handle('titan-img', async (request) => {
    try {
      const url = new URL(request.url)

      if (url.hostname === 'minigame') {
        const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
        const m = rel.match(/^games\/([a-zA-Z0-9_-]+)\/(.+)$/)
        if (!m) return new Response('Forbidden', { status: 403 })
        const gameId = m[1]
        if (!MINI_GAME_IDS.includes(gameId as any)) return new Response('Forbidden', { status: 403 })
        const relPath = m[2]
        if (relPath.split('/').some((seg: string) => seg === '..')) return new Response('Forbidden', { status: 403 })
        const baseDir = path.join(GAMES_ROOT, gameId)
        const filePath = path.normalize(path.join(baseDir, relPath))
        const baseLower = (baseDir + path.sep).toLowerCase()
        if (!filePath.toLowerCase().startsWith(baseLower)) return new Response('Forbidden', { status: 403 })
        if (!fs.existsSync(filePath)) return new Response('Not Found', { status: 404 })

        const stat = fs.statSync(filePath)
        const size = stat.size
        const mimeMap: Record<string, string> = {
          '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
          '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json',
          '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
          '.mp4': 'video/mp4', '.webm': 'video/webm'
        }
        const mime = mimeMap[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
        const rangeHeader = request.headers.get('range')
        if (rangeHeader) {
          const rm = rangeHeader.match(/bytes=(\d+)-(\d*)/)
          const start = rm ? parseInt(rm[1], 10) : 0
          const end = rm && rm[2] ? Math.min(parseInt(rm[2], 10), size - 1) : size - 1
          if (Number.isNaN(start) || start >= size || start > end) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' }
            })
          }
          const chunk = fs.createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(chunk) as unknown as ReadableStream, {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(end - start + 1),
              'Content-Type': mime
            }
          })
        }
        return new Response(Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream, {
          status: 200,
          headers: { 'Accept-Ranges': 'bytes', 'Content-Length': String(size), 'Content-Type': mime }
        })
      }

      const id = decodeURIComponent(url.pathname.replace(/^\//, ''))
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return new Response('Forbidden', { status: 403 })

      if (url.hostname === 'cover') {
        const fallbackSrc = url.searchParams.get('src') || undefined
        let coverPath = CoverPackService.resolveLocalCover(id, fallbackSrc)
        if (!coverPath) {
          const ok = await CoverPackService.fetchAndCacheCover(id, fallbackSrc)
          if (ok) {
            coverPath = CoverPackService.resolveLocalCover(id, fallbackSrc)
          }
        }
        if (coverPath) return net.fetch(pathToFileURL(coverPath).href)
        return new Response('Not Found', { status: 404 })
      }

      if (url.hostname === 'steam') {
        const normalizedId = id.replace(/^steam_gate_/, '')
        if (!/^\d+$/.test(normalizedId)) return new Response('Forbidden', { status: 403 })
        const detectRes = await SteamDetector.detect()
        if (!detectRes?.path) return new Response('Not Found', { status: 404 })

        const isHeader = url.searchParams.get('header') === '1'
        if (isHeader) {
          const headerPath = CoverPackService.resolveSteamHeader(normalizedId, detectRes.path)
          if (headerPath) return net.fetch(pathToFileURL(headerPath).href)
        } else {
          const coverPath = CoverPackService.resolveSteamCover(normalizedId, detectRes.path)
          if (coverPath) return net.fetch(pathToFileURL(coverPath).href)
        }
        return new Response('Not Found', { status: 404 })
      }

      return new Response(null, { status: 400 })
    } catch (e) {
      return new Response('Server Error', { status: 500 })
    }
  })

  ipcMain.removeHandler('sys:check-local-cover')
  ipcMain.handle('sys:check-local-cover', async (_e, id: string) => {
    if (!id) return false
    return CoverPackService.hasLocalCover(id)
  })

  ipcMain.removeHandler('sys:client-ready')
  ipcMain.handle('sys:client-ready', async () => {
    console.log('[LifeCycle] 收到前端就绪信号 (sys:client-ready), 准备触发 ui-ready 并启动后台连接')
    // 渲染进程 Vue 树与 BootSplash 遮罩已彻底渲染完毕，安全通知主窗口
    mainWindowRef?.emit('titan:ui-ready')

    const firstLaunch = isAppFirstLaunch
    // 一次性消费首发标记，保证全量同步仅执行一次，后续启动与重连纯走增量
    isAppFirstLaunch = false
    Db.markFirstLaunchComplete()

    // data track: fire-and-forget - network handshake + warm-up preload in background
    autoConnect().then(() => {
      const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
      if (sUrl) {
        
        SyncManager.startSync({ force: firstLaunch }).catch(() => {})
      }
    }).catch((err: any) => {
      console.error('[NET] autoConnect error:', err)
    })

    SteamDetector.detect().then((det) => {
      if (det?.path) DepotHealerService.start(det.path).catch(() => {})
    }).catch(() => {})

    // return the REAL first-launch flag in 0ms (flag passed from main.ts via initCore)
    return { isFirstLaunch: firstLaunch }
  })

  // 安全拦截：禁止通过通用配置接口读取或篡改核心凭证与网络底层配置
  const SENSITIVE_CONFIG_KEYS = new Set(['auth_ticket', 'app_seed_config', 'titan_nodes'])

  ipcMain.removeHandler('sys:get-config')
  ipcMain.handle('sys:get-config', async (_e, key: string) => {
    if (SENSITIVE_CONFIG_KEYS.has(key)) return null
    return Db.get(key)
  })

  ipcMain.removeHandler('sys:set-config')
  ipcMain.handle('sys:set-config', async (_e, key: string, value: any) => {
    if (SENSITIVE_CONFIG_KEYS.has(key)) return { success: false, error: 'ERR_ACCESS_DENIED' }
    return Db.set(key, value)
  })

  ipcMain.removeHandler('sys:sync-start')
  ipcMain.handle('sys:sync-start', async (_e, options) => {
    try {
      SyncManager.startSync(options).catch(() => {})
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  registerEngineService()

  ipcMain.removeHandler('steam:detect')
  ipcMain.handle('steam:detect', async () => await SteamDetector.detect())

  ipcMain.removeHandler('steam:select-folder')
  ipcMain.handle('steam:select-folder', async () => {
    if (!mainWindowRef) return { canceled: true }
    const res = await dialog.showOpenDialog(mainWindowRef, { title: '请指派 Steam 核心环境 (必须包含 steam.exe)', properties: ['openDirectory'] })
    if (res.canceled || res.filePaths.length === 0) return { canceled: true }

    const dir = res.filePaths[0]
    const isValid = await SteamDetector.validatePath(dir)
    if (!isValid) return { success: false, msg: 'ERR_STEAM_VALIDATE_FAIL' }

    SteamDetector.setManualPath(dir)
    return { success: true, path: dir, source: 'manual' }
  })

  ipcMain.removeHandler('auth:connect')
  ipcMain.handle('auth:connect', async (_e, id: string, emergencyKey?: string) => {
    if (id === 'auto') {
      // route AUTO to the ladder, never to doConnect('auto') which has no url and would
      // instantly fail with ERR_NODE_FAIL:auto
      Db.set('titan_nodes', { selectedNode: 'auto', nodes: activeNodeUrls || {} })
      await autoConnect()
      return { success: true }
    }

    // [容灾] 手动应急节点：TITAN-key 解码成功后覆写当前选中节点槽位并持久化（UI 布局不变）
    if (emergencyKey && typeof emergencyKey === 'string') {
      const trimmedKey = emergencyKey.trim()
      if (!trimmedKey.startsWith('TITAN-') || !decodeKey(trimmedKey)) {
        return { success: false, error: 'ERR_INVALID_NODE_KEY' }
      }
      activeNodeUrls = { ...(activeNodeUrls || {}), [id]: trimmedKey }
      Db.set('titan_nodes', { selectedNode: id, nodes: activeNodeUrls })
    }

    // explicit concrete node (node1 / node2 / node3)
    currentConnectedNode !== id && (currentConnectedNode = null)
    const res = await doConnect(id)
    if (res.success) {
      Db.set('titan_nodes', { selectedNode: id, nodes: activeNodeUrls || {} })
      // batch61: 成功种子的自宣节点表刚覆写了内存表——应急 key 必须重放覆写，否则重启即失效
      if (emergencyKey && typeof emergencyKey === 'string') {
        activeNodeUrls = { ...(activeNodeUrls || {}), [id]: emergencyKey.trim() }
        Db.set('titan_nodes', { selectedNode: id, nodes: activeNodeUrls })
      }
      serverUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
      await autoLogin()
    }
    pushStatus({ isConnected: res.success, selectedNode: id, actualNode: res.success ? id : null, error: res.success ? null : `ERR_NODE_FAIL:${id}`, seed: res.seed })
    return res
  })

  ipcMain.removeHandler('auth:disconnect')
  ipcMain.handle('auth:disconnect', async () => {
    currentConnectedNode = null
    pushStatus({ isConnected: false, selectedNode: null, error: null })
    return { success: true }
  })

  ipcMain.removeHandler('auth:register')
  ipcMain.handle('auth:register', async (_e, u: string, m: string, p: string) => await handleRegister(u, m, p))

  ipcMain.removeHandler('auth:login')
  ipcMain.handle('auth:login', async (_e, i: string, p: string) => await handleLogin(i, p))

  ipcMain.removeHandler('auth:logout')
  ipcMain.handle('auth:logout', async () => {
    HeartbeatService.stop()
    Db.setEncrypted('auth_ticket', null)
    Db.set('user_profile', null)
    SecurityService.initializeNetworkSecurity('')
    safeSend('auth:logout-success', { mode: 'hard' })
    return { success: true }
  })

  ipcMain.removeHandler('auth:refresh')
  ipcMain.handle('auth:refresh', async () => await handleRefresh())

  ipcMain.removeHandler('auth:redeem')
  ipcMain.handle('auth:redeem', async (_e, card: string, contact: string) => await handleRedeem(card, contact))

  ipcMain.removeHandler('auth:forgot-search')
  ipcMain.handle('auth:forgot-search', async (_e, u: string, m: string) => {
    activeResetSession = null
    const res = await forgotApi({ act: 'search', kw: u, email: m })

    if (res?.ok && res?.id) {
      if (res.reset_ticket) {
        activeResetSession = {
          uid: res.id,
          ticket: res.reset_ticket,
          expire: Date.now() + 300000
        }
      }
      return { ok: true, id: res.id, username: res.username }
    }
    return { ok: false, msg: res?.err || 'ERR_ACCOUNT_NOT_FOUND' }
  })

  ipcMain.removeHandler('auth:forgot-reset')
  ipcMain.handle('auth:forgot-reset', async (_e, uid: number, pass: string, email: string) => {
    const ticket = (activeResetSession && activeResetSession.uid === uid && Date.now() < activeResetSession.expire)
      ? activeResetSession.ticket
      : ''

    const res = await forgotApi({ act: 'reset', uid, pass, email, reset_ticket: ticket })
    if (res?.ok) {
      activeResetSession = null
    }
    return res
  })

  ipcMain.removeHandler('sys:open-external')
  ipcMain.handle('sys:open-external', async (_e, url: string) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        await shell.openExternal(url)
        return { success: true }
      } catch {
        try {
          // two-stage self-heal: route through explorer.exe when default-browser handle is broken
          const child = spawn('explorer.exe', [url], { detached: true, stdio: 'ignore' })
          child.unref()
          return { success: true }
        } catch (err: any) {
          console.error('[sys:open-external] explorer fallback failed:', err)
          return { success: false, msg: 'ERR_OPEN_EXTERNAL_FAILED' }
        }
      }
    }
    return { success: false, msg: 'ERR_INVALID_URL' }
  })

  ipcMain.removeHandler('sys:get-discovery-list')
  ipcMain.handle('sys:get-discovery-list', async (_e, tabId: string) => ResourceService.getDiscoveryList(tabId))

  ipcMain.removeHandler('sys:get-collection-children')
  ipcMain.handle('sys:get-collection-children', async (_e, collectionId: string) => ResourceService.getCollectionChildren(collectionId))

  ipcMain.removeHandler('sys:global-search')
  ipcMain.handle('sys:global-search', async (_e, keyword: string) => {
    const res = await SearchService.globalSearch(keyword)
    if (res.quota) safeSend('auth:update-quota', res.quota)
    return res
  })

  ipcMain.removeHandler('sys:toggle-library')
  ipcMain.handle('sys:toggle-library', async (_e, resourceId: string, extraData?: any) => {
    const res = LibraryService.toggleLibrary(resourceId, extraData)
    if (res.success) {
      safeSend('titan:library-updated', { action: res.status, resourceId })
    }
    return res
  })

  ipcMain.removeHandler('sys:sharegate')
  ipcMain.handle('sys:sharegate', async (_e, payload) => {
    return ShareGateService.handleIpc(payload)
  })

  ipcMain.removeHandler('sys:batch-deploy-meta')
  ipcMain.handle('sys:batch-deploy-meta', async (_e, appIds: string[]) => {
    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
    const token = Db.getEncrypted<any>('auth_ticket')?.token
    if (!sUrl || !token) return { success: false, msg: 'ERR_OFFLINE_OR_UNAUTHORIZED' }

    try {
      const res = await titanFetch(`${sUrl}/titan/titan_gateway.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Titan-Token': token },
        body: JSON.stringify({ action: 'batch_deploy_meta', app_ids: appIds })
      })

      if (!res.ok) return { success: false, msg: json?.msg || `ERR_REQUEST:${res.status}` }

  
      if (json.code !== 200) return { success: false, msg: json.msg || 'ERR_GATEWAY_REJECTED' }

      const hexPayload = typeof json.data === 'object' ? json.data?.data : json.data
      if (!hexPayload) return { success: false, msg: 'ERR_SERVER_RESPONSE' }

      const decrypted = SecurityService.decryptNetworkPayload<any>(hexPayload)
      if (!decrypted) return { success: false, msg: 'ERR_DECRYPT_FAIL' }

      return { success: true, data: decrypted?.data?.results || [] }
    } catch (e: any) {
      return { success: false, msg: 'ERR_NETWORK_ERROR' }
    }
  })

  ipcMain.removeHandler('sys:vote-game')
  ipcMain.handle('sys:vote-game', async (_e, { appId, type }: { appId: string; type: 'up' | 'down' }) => {
    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
    if (!sUrl || !appId) return { success: false, msg: 'ERR_PARAM' }

    try {
      const res = await titanFetch(`${sUrl}/titan/vote.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, type })
      })
      if (!res.ok) return { success: false, msg: `HTTP_${res.status}` }
      const data = await res.json()
      return { success: true, data }
    } catch (e: any) {
      return { success: false, msg: e.message }
    }
  })

  ipcMain.removeHandler('sys:get-votes')
  ipcMain.handle('sys:get-votes', async (_e, appId: string) => {
    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
    if (!sUrl || !appId) return { success: false, votes: { up: 0, down: 0 } }

    try {
      const res = await titanFetch(`${sUrl}/titan/vote.php?app_id=${encodeURIComponent(appId)}&t=${Date.now()}`)
      if (!res.ok) return { success: false, votes: { up: 0, down: 0 } }
      const data = await res.json()
      return { success: true, votes: data?.votes || { up: 0, down: 0 } }
    } catch (e) {
      return { success: false, votes: { up: 0, down: 0 } }
    }
  })

  ipcMain.removeHandler('titan:deploy-game')
  ipcMain.handle('titan:deploy-game', async (_e, appId: string) => {
    const detectRes = await SteamDetector.detect()
    if (!detectRes?.path) return { success: false, msg: 'ERR_DEPLOY_NO_STEAM' }

    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl

    let realSteamAppId = appId
    let requestResourceId = appId.startsWith('steam_gate_') ? appId : `steam_gate_${appId}`

    const localResRow = Db.query<any>('SELECT id, meta_json FROM titan_resources WHERE id = ?', [appId])[0]

    if (localResRow) {
      requestResourceId = localResRow.id
      try {
        const meta = JSON.parse(localResRow.meta_json || '{}')
        realSteamAppId = (meta.target_id || meta.steam_appid || appId).toString()
      } catch (e) {
      }
    } else {
      realSteamAppId = appId.replace(/^steam_gate_/, '')
    }

    const secureLinkRes = await fetchSecureLinkDirect(requestResourceId, sUrl)
    if (!secureLinkRes?.success || !secureLinkRes.mirrors || secureLinkRes.mirrors.length === 0) {
      return { success: false, msg: secureLinkRes?.msg || 'ERR_DEPLOY_NO_MANIFEST' }
    }

    const engine = 'ost' as const
    let engineConfig = Db.get<any>(`engine_config_${engine}`)
    if (!engineConfig) {
      await EngineService.initEngineConfig().catch(() => {})
      engineConfig = Db.get<any>(`engine_config_${engine}`)
      if (!engineConfig) return { success: false, msg: 'ERR_DEPLOY_NO_ENGINE' }
    }

    // 引擎版号校验：复用 EngineService 现有检测能力，版号未对齐后端最新则视为校验失败，强制走全量重新拉取
    let effectiveFastMode = true
    let effectiveToolUrl = engineConfig.tool_url
    let effectiveToolMirrors = engineConfig.mirrors || []
    let effectiveTargetDlls = engineConfig.target_dlls || []
    let expectedEngineVersion = engineConfig.version || 0

    try {
      const updateCheck = await EngineService.silentCheckUpdate(engine)
      if (updateCheck.hasUpdate && updateCheck.remoteConfig) {
        console.log(`[titan:deploy-game] 引擎版号未对齐后端最新 (本地: v${engineConfig.version || 0}, 最新: v${updateCheck.version})，触发全量重新拉取工具包`)
        effectiveFastMode = false
        expectedEngineVersion = updateCheck.version || expectedEngineVersion
        if (updateCheck.remoteConfig.tool_url) effectiveToolUrl = updateCheck.remoteConfig.tool_url
        if (updateCheck.remoteConfig.mirrors?.length) effectiveToolMirrors = updateCheck.remoteConfig.mirrors
        if (updateCheck.remoteConfig.target_dlls?.length) effectiveTargetDlls = updateCheck.remoteConfig.target_dlls
      }
    } catch (e: any) {
      console.warn('[titan:deploy-game] 引擎版本静默校验跳过 (网络离线或异常):', e.message)
    }

    const protocolConfig: ProtocolConfig = {
      app_id: realSteamAppId,
      tool_url: effectiveToolUrl,
      tool_mirrors: effectiveToolMirrors,
      manifest_url: secureLinkRes.mirrors[0]?.url || secureLinkRes.mirrors[0],
      manifest_mirrors: secureLinkRes.mirrors.map((m: any) => m.url || m).filter(Boolean),
      target_dlls: effectiveTargetDlls,
      fast_mode: effectiveFastMode,
      expected_engine_version: expectedEngineVersion
    }
    const deployResult = await TitanProtocol.deploy(detectRes.path, protocolConfig, engine as 'ost' | 'st')
    if (deployResult.success) {
      const liveAutoUpdate = TitanProtocol.inspectLuaAutoUpdate(detectRes.path, realSteamAppId)
      LibraryService.toggleAutoUpdate(`steam_gate_${realSteamAppId}`, liveAutoUpdate)
    }

    return deployResult
  })

  ipcMain.removeHandler('titan:uninstall-game')
  ipcMain.handle('titan:uninstall-game', async (_e, steamPath: string, appId: string, engine: 'ost' | 'st') => await TitanProtocol.uninstall(steamPath, appId, undefined, engine))

  ipcMain.removeHandler('titan:force-restore')
  ipcMain.handle('titan:force-restore', async (_e, steamPath: string) => await TitanProtocol.forceRestore(steamPath))

  ipcMain.removeHandler('sys:fetch-secure-link')
  ipcMain.handle('sys:fetch-secure-link', async (_e, resourceId: string) => {
    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
    return await fetchSecureLinkDirect(resourceId, sUrl)
  })

  ipcMain.removeHandler('sys:push-cloud-library')
  ipcMain.handle('sys:push-cloud-library', async (_e, resourceIds: string[]) => {
    return LibraryService.pushCloudLibrary(resourceIds)
  })

  ipcMain.removeHandler('sys:pull-cloud-library')
  ipcMain.handle('sys:pull-cloud-library', async (_e) => {
    return LibraryService.pullCloudLibrary()
  })

  ipcMain.removeHandler('sys:get-user-library')
  ipcMain.handle('sys:get-user-library', async () => {
    const steamPath = SteamDetector.lastDetectedPath || (await SteamDetector.detect())?.path || ''
    return LibraryService.getLibrary(steamPath)
  })

  ipcMain.removeHandler('sys:remove-user-library')
  ipcMain.handle('sys:remove-user-library', async (_e, resourceId: string) => {
    const res = LibraryService.removeGame(resourceId)
    if (res) {
      safeSend('titan:library-updated', { action: 'removed', resourceId })
    }
    return res
  })

  ipcMain.removeHandler('sys:open-local-folder')
  ipcMain.handle('sys:open-local-folder', async (_e, folderPath: string) => {
    if (!folderPath || typeof folderPath !== 'string') {
      return { success: false, error: 'INVALID_PATH' }
    }
    try {
      const resolved = path.resolve(folderPath)
      if (!fs.existsSync(resolved)) {
        fs.mkdirSync(resolved, { recursive: true })
      }
      const stat = fs.statSync(resolved)
      if (!stat.isDirectory()) {
        return { success: false, error: 'ERR_NOT_A_DIRECTORY' }
      }
      const err = await shell.openPath(resolved)
      if (err) return { success: false, error: err }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 纯净原生极速拉起：0毫秒IO、零误报、交由 Steam 原生调度决策
  ipcMain.removeHandler('titan:launch-game')
  ipcMain.handle('titan:launch-game', async (_e, appId: string) => {
    const cleanAppId = String(appId).replace(/^steam_gate_/, '').trim()
    if (!/^\d+$/.test(cleanAppId)) return { success: false, msg: 'ERR_INVALID_APPID' }

    try {
      await shell.openExternal(`steam://run/${cleanAppId}`)
      return { success: true, msg: 'LAUNCH_OK' }
    } catch (e: any) {
      return { success: false, msg: e?.message || 'ERR_LAUNCH_FAILED' }
    }
  })

  // ===================== 扩展诊断：修复建议死区 =====================
  ipcMain.removeHandler('titan:run-diagnostics')
  ipcMain.handle('titan:run-diagnostics', async () => {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes?.path
    if (!steamPath) return { success: false, msg: 'ERR_STEAM_MISSING', data: [] }

    const engine = 'ost' as const
    const probeResult = EngineService.getManifestProbeResult()
    const results = await TitanProtocol.runDiagnostics(steamPath, engine as 'ost' | 'st', probeResult)

    const filtered = results

    const tomlItem = PatternSyncService.diagnoseAlignment(steamPath)
    const gameCfgIndex = filtered.findIndex(r => r.name === 'DIAG_GAME_CFG')
    if (gameCfgIndex >= 0) filtered.splice(gameCfgIndex + 1, 0, tomlItem)
    else filtered.push(tomlItem)

    const hasAutoFixable = filtered.some(r => !r.ok && r.name === 'DIAG_TOML_ALIGN')
    const hasOtherFail = filtered.some(r => !r.ok && r.name !== 'DIAG_ADVICE' && r.name !== 'DIAG_TOML_ALIGN')
    const adviceIndex = filtered.findIndex(r => r.name === 'DIAG_ADVICE')

    if (adviceIndex >= 0) {
      if (hasAutoFixable) {
        filtered[adviceIndex].message = 'DIAG_ADVICE_TOML'
      } else if (hasOtherFail) {
        filtered[adviceIndex].message = 'DIAG_ADVICE_DEPLOY'
      } else {
        filtered[adviceIndex].ok = true
        filtered[adviceIndex].message = 'DIAG_ADVICE_ALL_OK'
      }
    } else if (!tomlItem.ok) {
      // 修复建议死区：当其它项全部正常唯独 TOML 对齐异常时，补回修复建议项
      filtered.push({
        name: 'DIAG_ADVICE',
        ok: false,
        message: 'DIAG_ADVICE_TOML'
      })
    }

    return { success: true, data: filtered }
  })

  // ===================== 一键导出全量诊断日志 =====================
  ipcMain.removeHandler('titan:export-diagnostics')
  ipcMain.handle('titan:export-diagnostics', async () => {
    return await DiagnosticExportService.export()
  })

  ipcMain.removeHandler('sys:push-telemetry')
  ipcMain.handle('sys:push-telemetry', async (_e, events: any[]) => {
    const ticket = Db.getEncrypted<any>('auth_ticket')?.token
    if (!ticket || !serverUrl) return { code: 401 }
    try {
      const res = await titanFetch(`${serverUrl}/titan/heartbeat.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Titan-Token': ticket },
        body: JSON.stringify({ action: 'telemetry_batch', telemetry_events: events }),
        timeout: 10000
      })
      return await res.json()
    } catch (e: any) {
      return { code: 500, msg: e.message }
    }
  })

  ipcMain.removeHandler('sys:batch-telemetry')
  ipcMain.handle('sys:batch-telemetry', async (_e, events: any[]) => {
    const ticket = Db.getEncrypted<any>('auth_ticket')?.token
    const targetUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
    if (!targetUrl) return { code: 400, msg: 'Server URL Missing' }
    try {
      const res = await titanFetch(`${targetUrl}/titan/telemetry.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Titan-Token': ticket || '' 
        },
        body: JSON.stringify({ telemetry_events: events }),
        timeout: 10000
      })
      return await res.json()
    } catch (e: any) {
      return { code: 500, msg: e.message }
    }
  })

  ipcMain.removeHandler('sys:set-manifest-node')
  ipcMain.handle('sys:set-manifest-node', async (_e, node: string) => {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes?.path
    if (!steamPath) return { success: false, msg: 'ERR_STEAM_MISSING' }
    return await EngineService.setManifestNode(node, steamPath)
  })

  ipcMain.removeHandler('sys:get-manifest-node')
  ipcMain.handle('sys:get-manifest-node', async () => {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes?.path
    if (!steamPath) return { success: false, msg: 'ERR_STEAM_MISSING', selectedNode: 'auto', url: '', statuses: {} }

    const savedMode = Db.get<string>('manifest_node_mode') || 'auto'
    const probeCache = Db.get<any>('manifest_probe_cache')
    const statuses = EngineService.getManifestNodeStatuses()

    return { 
      success: true, 
      selectedNode: savedMode, 
      url: probeCache?.url || '', 
      statuses 
    }
  })

  ipcMain.removeHandler('sys:repair-environment')
  ipcMain.handle('sys:repair-environment', async () => {
    try {
      return await ModeSwitchService.repairEnvironment()
    } catch (e: any) {
      console.error('[core] sys:repair-environment 异常:', e)
      return { success: false, error: e?.message || 'REPAIR_EXCEPTION' }
    }
  })

  ipcMain.removeHandler('sys:get-sync-state')
  ipcMain.handle('sys:get-sync-state', async () => SyncManager.getState())

  ipcMain.removeHandler('sys:validate-patterns')
  ipcMain.handle('sys:validate-patterns', async () => {
    return await PatternSyncService.validatePatterns().catch((e: any) => ({ pulled: 0, missing: [], error: e?.message || 'UNKNOWN' }))
  })

  ipcMain.removeHandler('sys:get-device-info')
  ipcMain.handle('sys:get-device-info', async () => {
    try {
      return await HeartbeatService.getHardwareSpecs()
    } catch (e) {
      return { cpu: 'Unknown', cpuCores: 0, gpu: 'Unknown', ram: 'Unknown', osVersion: 'Unknown' }
    }
  })

  ipcMain.removeHandler('sys:get-hardware')
  ipcMain.handle('sys:get-hardware', async () => {
    try {
      return await HeartbeatService.getHardwareSpecs()
    } catch (e) {
      return { cpu: 'Unknown', cpuCores: 0, gpu: 'Unknown', ram: 'Unknown', osVersion: 'Unknown' }
    }
  })

  ipcMain.removeHandler('sys:import-lua-folder')
  ipcMain.handle('sys:import-lua-folder', async () => {
    if (!mainWindowRef) return { success: false, msg: 'ERR_WINDOW_MISSING' }

    const { filePaths } = await dialog.showOpenDialog(mainWindowRef, {
      title: '选择包含 AppID.lua 清单的文件夹',
      properties: ['openDirectory']
    })
    if (filePaths.length === 0) return { success: false, msg: 'CANCELLED' }

    const dir = filePaths[0]
    let files: string[] = []
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.lua'))
    } catch (e) {
      return { success: false, msg: 'ERR_READ_DIR' }
    }

    const appIds = files
      .map(f => f.replace(/\.lua$/, ''))
      .filter(id => /^\d+$/.test(id))

    if (appIds.length === 0) {
      return { success: false, msg: 'ERR_NO_VALID_LUA' }
    }

    const existingLib = LibraryService.getLibrary()
    const existingIds = new Set(existingLib.map((i: any) => i.resource_id))
    const toImport = appIds.filter(id => !existingIds.has(`steam_gate_${id}`))
    const skipped = appIds.length - toImport.length

    if (toImport.length === 0) {
      return { success: true, imported: 0, skipped, failed: 0 }
    }

    const sUrl = Db.get<any>('app_seed_config')?.serverUrl || serverUrl
    const token = Db.getEncrypted<any>('auth_ticket')?.token
    const metaMap: Record<string, { title?: string; cover?: string }> = {}

    if (sUrl && token) {
      const BATCH_SIZE = 50
      for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
        const batch = toImport.slice(i, i + BATCH_SIZE)
        try {
          const res = await titanFetch(`${sUrl}/titan/titan_gateway.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Titan-Token': token },
            body: JSON.stringify({ action: 'batch_deploy_meta', app_ids: batch })
          })
          if (res.ok) {
            const json = await res.json() as { code?: number; data?: { data?: string } | string }
            if (json.code !== 200) continue
            const hexPayload = typeof json.data === 'object' ? json.data?.data : json.data
            if (hexPayload) {
              const decrypted = SecurityService.decryptNetworkPayload<any>(hexPayload)
              const results = decrypted?.data?.results || []
              for (const item of results) {
                if (item.app_id && item.success !== false) {
                  metaMap[item.app_id] = {
                    title: item.title || `AppID: ${item.app_id}`,
                    cover: item.cover || ''
                  }
                }
              }
            }
          }
        } catch (e) {
        }
      }
    }

    const detectRes = await SteamDetector.detect()
    const targetLuaDir = detectRes?.path ? ModeSwitchService.getActiveLuaDir(detectRes.path) : null
    if (targetLuaDir && !fs.existsSync(targetLuaDir)) {
      try { fs.mkdirSync(targetLuaDir, { recursive: true }) } catch {}
    }

    const importedIds: string[] = []
    let failed = 0
    for (const appId of toImport) {
      if (targetLuaDir) {
        const srcLuaPath = path.join(dir, `${appId}.lua`)
        if (fs.existsSync(srcLuaPath)) {
          try {
            let luaContent = fs.readFileSync(srcLuaPath, 'utf-8')
            luaContent = DepotKeyService.patchLuaContent(appId, luaContent)
            fs.writeFileSync(path.join(targetLuaDir, `${appId}.lua`), luaContent, 'utf-8')
          } catch (e: any) {
            console.warn(`[sys:import-lua-folder] 复制/注入 lua 失败: ${appId}`, e.message)
          }
        }
      }
      const meta = metaMap[appId] || { title: `AppID: ${appId}`, cover: '' }
      const res = LibraryService.toggleLibrary(`steam_gate_${appId}`, {
        title: meta.title,
        type: 'titan_protocol',
        cover: meta.cover
      })
      if (res.success) {
        importedIds.push(`steam_gate_${appId}`)
      } else {
        failed++
      }
    }

    if (importedIds.length > 0) {
      LibraryService.pushCloudLibrary(importedIds).catch(() => {})
      safeSend('titan:library-updated', { action: 'added', resourceIds: importedIds })
    }

    return { success: true, imported: importedIds.length, skipped, failed }
  })

  ipcMain.removeHandler('sys:toggle-auto-update')
  ipcMain.handle('sys:toggle-auto-update', async (_e, resourceId: string, autoUpdate: boolean) => {
    const uid = Db.getEncrypted<any>('auth_ticket')?.userId
    if (!uid) return { success: false, msg: 'ERR_LOGIN_REQUIRED' }

    const detectRes = await SteamDetector.detect()
    if (!detectRes?.path) return { success: false, msg: 'ERR_DEPLOY_NO_STEAM' }

    const engine = 'ost' as const
    const appId = resourceId.replace(/^steam_gate_/, '')
    if (!/^\d+$/.test(appId)) return { success: false, msg: 'ERR_INVALID_APPID' }

    const luaOk = TitanProtocol.toggleLuaAutoUpdate(detectRes.path, appId, autoUpdate, engine)
    if (!luaOk) return { success: false, msg: 'library.batch.toggleUpdateFailed' }

    const dbRes = LibraryService.toggleAutoUpdate(resourceId, autoUpdate)
    if (!dbRes.success) return dbRes

    return { success: true }
  })

  setTimeout(() => {
    SteamDetector.detect().then(d => {
      if (d.path) LibraryService.syncManifestCache(d.path).catch(() => {})
    })
  }, 300_000)

  setInterval(() => {
    SteamDetector.detect().then(d => {
      if (d.path) LibraryService.syncManifestCache(d.path).catch(() => {})
    })
  }, 3_600_000)

  // 业务模块自治 IPC 挂载
  registerCloudSaveService()
  registerToolService(data => safeSend('tools:changed', data))

  ModeSwitchService.setDeployBusyChecker(() => TitanProtocol.hasActiveDeployment())

  // 加固：对 deployTrigger 增加反射检查与全量部署回退，保证 Dev 态永不炸飞
  ModeSwitchService.setDeployTrigger(async () => {
    try {
      if (typeof (EngineService as any).pullLatest === 'function') {
        return await (EngineService as any).pullLatest()
      }
      const sUrl = Db.get<any>('app_seed_config')?.serverUrl
      if (!sUrl) return { success: false, error: 'ERR_SERVER_REQUIRED' }
      const res = await titanFetch(`${sUrl}/titan/update_check.php?action=get_engine_config&engine=ost`, {
        method: 'GET',
        headers: { 'User-Agent': 'TitanCore/2.0' }
      })
      if (!res.ok) return { success: false, error: 'ERR_GATEWAY_EXCEPTION' }
      const remoteConfig = await res.json()
      if (!remoteConfig?.success) return { success: false, error: 'ERR_GATEWAY_EXCEPTION' }

      const detectRes = await SteamDetector.detect()
      if (!detectRes?.path) return { success: false, error: 'ERR_STEAM_MISSING' }

      const mirrors = remoteConfig.mirrors || (remoteConfig.tool_url ? [remoteConfig.tool_url] : [])
      const deployRes = await TitanProtocol.deploy(detectRes.path, {
        app_id: 'SYSTEM_ENGINE',
        tool_url: remoteConfig.tool_url,
        tool_mirrors: mirrors,
        target_dlls: remoteConfig.target_dlls || ['xinput1_4.dll', 'OpenSteamTool.dll', 'cloud_redirect.dll'],
        fast_mode: false
      }, 'ost')

      return { success: deployRes.success, error: deployRes.msg }
    } catch (e: any) {
      return { success: false, error: e?.message || 'DEPLOY_TRIGGER_FAILED' }
    }
  })

  CloudSaveService.ensureCrEnvAtStartup().catch((err: any) => {
    console.error('[core] 启动云存档环境自检失败:', err?.message || err)
  })

  registerGameService()
  registerMiniGameAssetService()
}