// 文件名: src/main/services/LibraryService.ts
import { Db } from '../db'
import { titanFetch } from '../TitanNet'
import fs from 'node:fs'
import path from 'node:path'

// 协议资源类型白名单（命中即过写闸门）
const PROTOCOL_TYPES = new Set(['titan_protocol'])

export class LibraryService {
    
    private static getCurrentUid(): string | null {
        const ticket = Db.getEncrypted<any>('auth_ticket')
        return ticket?.userId ? String(ticket.userId) : null
    }

    private static getServerUrl(): string {
        return Db.get<any>('app_seed_config')?.serverUrl || ''
    }

    private static getAuthToken(): string | null {
        return Db.getEncrypted<any>('auth_ticket')?.token || null
    }

    /**
     * 【写闸门核心】协议资源身份归一（全项目唯一入口）
     * 任意来源的标识 → steam_gate_<纯数字AppID>；解析不出真实 AppID 返回 null（调用方必须拒绝写入）
     * 解析序：剥离全部 steam_gate_ 前缀后为纯数字 → 本地目录 meta(target_id / steam_appid)
     */
    private static normalizeProtocolResource(resourceId: string): string | null {
        const stripped = resourceId.replace(/^(steam_gate_)+/, '')
        let appId = /^\d+$/.test(stripped) ? stripped : ''

        if (!appId) {
            try {
                const rows = Db.query<any>(
                    'SELECT meta_json FROM titan_resources WHERE id = ? OR id = ? LIMIT 1',
                    [resourceId, stripped]
                )
                if (rows.length > 0) {
                    const meta = JSON.parse(rows[0].meta_json || '{}')
                    const target = String(meta.target_id || meta.steam_appid || '')
                    if (/^\d+$/.test(target)) appId = target
                }
            } catch {}
        }

        return appId ? `steam_gate_${appId}` : null
    }

    static async pushCloudLibrary(resourceIds: string[]): Promise<{ success: boolean; msg: string }> {
        const serverUrl = this.getServerUrl()
        const token = this.getAuthToken()
        if (!serverUrl) return { success: false, msg: 'ERR_OFFLINE' }
        if (!token) return { success: false, msg: 'ERR_UNAUTHORIZED' }

        try {
            const res = await titanFetch(`${serverUrl}/titan/cloud_library.php?action=push`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Titan-Token': token
                },
                body: new URLSearchParams({ resource_ids: JSON.stringify(resourceIds) }).toString()
            })
            return await res.json()
        } catch (e: any) {
            return { success: false, msg: 'ERR_NETWORK_ERROR' }
        }
    }

    static async pullCloudLibrary(): Promise<{ success: boolean; msg: string; data?: any[] }> {
        const serverUrl = this.getServerUrl()
        const token = this.getAuthToken()
        if (!serverUrl) return { success: false, msg: 'ERR_OFFLINE', data: [] }
        if (!token) return { success: false, msg: 'ERR_UNAUTHORIZED', data: [] }

        try {
            const res = await titanFetch(`${serverUrl}/titan/cloud_library.php?action=pull`, {
                headers: { 'X-Titan-Token': token }
            })
            return await res.json()
        } catch (e: any) {
            return { success: false, msg: 'ERR_NETWORK_ERROR', data: [] }
        }
    }

    static upsertGame(resourceId: string, extraData: any = {}): boolean {
        const uid = this.getCurrentUid()
        if (!uid) return false

        let title = extraData.title || ''
        let type = extraData.type || ''
        let cover = extraData.cover || ''
        
        if (!title || !type || !cover) {
            try {
                const rows = Db.query<any>('SELECT title, type, cover FROM titan_resources WHERE id = ?', [resourceId])
                if (rows && rows.length > 0) {
                    const res = rows[0]
                    title = title || res.title || ''
                    type = type || res.type || ''
                    cover = cover || res.cover || ''
                }
            } catch (e) {
                console.warn('[LibraryService] 元数据补全失败:', e)
            }
        }

        let metaData: any = {}
        if (extraData.meta_json) {
            try {
                metaData = typeof extraData.meta_json === 'string' ? JSON.parse(extraData.meta_json) : extraData.meta_json
            } catch {}
        }
        if (title) metaData.title = title
        if (cover) metaData.cover = cover
        if (extraData.desc) metaData.desc = extraData.desc
        if (type) metaData.type = type

        const row = {
            uid: uid,
            resource_id: resourceId,
            local_path: extraData.local_path || '',
            added_at: extraData.added_at || Date.now(),
            title: title,
            type: type,
            cover: cover,
            meta_json: JSON.stringify(metaData)
        }

        return Db.upsertUserLibrary(row)
    }

    static removeGame(resourceId: string): boolean {
        const uid = this.getCurrentUid()
        if (!uid) return false
        return Db.deleteUserLibrary(uid, resourceId)
    }

    static getLibrary(): any[] {
        const uid = this.getCurrentUid()
        if (!uid) return []
        return Db.getUserLibrary(uid)
    }

    static toggleLibrary(resourceId: string, extraData?: any): { success: boolean; status?: string; msg?: string } {
        const uid = this.getCurrentUid()
        if (!uid) return { success: false, msg: 'ERR_NOT_LINKED' }

        // ========== [ 写闸门 ] 协议资源身份归一：垃圾标识在结构上无法落库 ==========
        const rawType = String(extraData?.type || '')
        if (PROTOCOL_TYPES.has(rawType) || resourceId.startsWith('steam_gate_')) {
            const normalizedId = this.normalizeProtocolResource(resourceId)
            if (!normalizedId) {
                return { success: false, msg: `ERR_DEPLOY_REJECTED:${resourceId}` }
            }
            if (normalizedId !== resourceId) {
                // 目录 id / 畸形 id → 归一 id：清除可能的旧行，保证身份唯一
                this.removeGame(resourceId)
                resourceId = normalizedId
            }
        }
        // ==========================================================================

        const lib = this.getLibrary()
        const exists = lib.find((x: any) => x.resource_id === resourceId)

        if (exists) {
            this.upsertGame(resourceId, { added_at: exists.added_at, ...extraData })
            return { success: true, status: 'updated' }
        } else {
            this.upsertGame(resourceId, { added_at: Date.now(), ...extraData })
            return { success: true, status: 'added' }
        }
    }

    static toggleAutoUpdate(resourceId: string, autoUpdate: boolean): { success: boolean; msg?: string } {
        const uid = this.getCurrentUid();
        if (!uid) return { success: false, msg: 'ERR_LOGIN_REQUIRED' };

        const lib = this.getLibrary();
        const exists = lib.find((x: any) => x.resource_id === resourceId);
        if (!exists) return { success: false, msg: 'ERR_NOT_IN_LIBRARY' };

        let metaData: any = {};
        // db.ts getUserLibrary 已注入解析后的 meta 对象，优先直接复用
        if (exists.meta && typeof exists.meta === 'object') {
            metaData = { ...exists.meta };
        } else if (exists.meta_json && typeof exists.meta_json === 'string') {
            try { metaData = JSON.parse(exists.meta_json); } catch {}
        }

        metaData.autoUpdate = autoUpdate;

        const row = {
            uid: uid,
            resource_id: resourceId,
            local_path: exists.local_path || '',
            added_at: exists.added_at || Date.now(),
            title: exists.title || '',
            type: exists.type || '',
            cover: exists.cover || '',
            meta_json: JSON.stringify(metaData)
        };

        const saved = Db.upsertUserLibrary(row);
        return saved ? { success: true } : { success: false, msg: 'ERR_DB_UPDATE' };
    }

    // ================= [ Manifest 缓存同步 ] =================

    private static readonly MANIFEST_CACHE_PATH = path.join(Db.getDataRoot(), 'cache', 'manifest_cache.json')
    private static readonly MAX_CACHE_APPIDS = 1000

    static async syncManifestCache(steamPath: string): Promise<void> {
        try {
            const cacheDir = path.dirname(this.MANIFEST_CACHE_PATH)
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

            let cache: Record<string, Array<{ depotId: string; manifestId: string; ts: number }>> = {}
            if (fs.existsSync(this.MANIFEST_CACHE_PATH)) {
                try { cache = JSON.parse(fs.readFileSync(this.MANIFEST_CACHE_PATH, 'utf-8')) } catch {}
            }

            const lib = this.getLibrary()
            const now = Date.now()

            // 先组装任务列表，过滤掉非协议资源和无效 appid
            const tasks = lib
                .filter(item => item.type === 'titan_protocol')
                .map(item => {
                    const appId = String(item.resource_id).replace(/^steam_gate_/, '')
                    if (!/^\d+$/.test(appId)) return null
                    return { appId, acfPath: path.join(steamPath, 'steamapps', `appmanifest_${appId}.acf`) }
                })
                .filter((x): x is { appId: string; acfPath: string } => x !== null)

            // 并发读取所有 ACF，单个失败不影响其他
            const results = await Promise.all(
                tasks.map(async ({ appId, acfPath }) => {
                    try {
                        const content = await fs.promises.readFile(acfPath, 'utf-8')
                        const re = /"(\d+)"\s*\{[^}]*"manifest"\s*"(\d+)"[^}]*\}/g
                        const entries: Array<{ depotId: string; manifestId: string; ts: number }> = []
                        let m: RegExpExecArray | null
                        while ((m = re.exec(content)) !== null) {
                            entries.push({ depotId: m[1], manifestId: m[2], ts: now })
                        }
                        return { appId, entries: entries.length > 0 ? entries : null }
                    } catch {
                        return { appId, entries: null }
                    }
                })
            )

            // 把有结果的写进缓存
            for (const { appId, entries } of results) {
                if (entries) cache[appId] = entries
            }

            // 滚动上限：按 ts 保留最新的 1000 个 appid
            const sorted = Object.entries(cache).sort((a, b) => (b[1][0]?.ts || 0) - (a[1][0]?.ts || 0))
            if (sorted.length > this.MAX_CACHE_APPIDS) {
                cache = Object.fromEntries(sorted.slice(0, this.MAX_CACHE_APPIDS))
            }

            fs.writeFileSync(this.MANIFEST_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8')
        } catch (e) {
            console.warn('[LibraryService] manifest 缓存同步失败:', e)
        }
    }
}