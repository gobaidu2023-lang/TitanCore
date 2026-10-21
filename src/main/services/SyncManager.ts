// 文件名: src/main/services/SyncManager.ts
import fs from 'node:fs';
import path from 'node:path';
import { BrowserWindow, app } from 'electron';
import { Db } from '../db';
import { CoverPackService } from './CoverPackService';
import { EventEmitter } from 'events';

export interface BackendResourceItem {
  id?: string;
  type?: string;
  status?: string;
  meta_json?: string;
  [key: string]: any;
}
import * as crypto from 'node:crypto';
import { titanFetch } from '../TitanNet';

export class SyncManager {
    private static isSyncing = false;
    private static lastSyncTime = 0;
    private static eventEmitter = new EventEmitter();
    private static readonly CLIENT_SECRET = process.env.TITAN_CLIENT_SECRET || 'TITAN_COMMUNITY_CLIENT_SECRET';

    public static get isSyncingState(): boolean {
        return this.isSyncing;
    }

    static initialize(): void {
    }

    static on(event: string, listener: (...args: unknown[]) => void): () => void {
        this.eventEmitter.on(event, listener);
        return () => this.eventEmitter.off(event, listener);
    }

    private static safeSend(win: BrowserWindow, channel: string, data?: unknown): void {
        if (win.isDestroyed() || win.webContents.isDestroyed()) return;
        try { win.webContents.send(channel, data); } catch (e) {}
    }

    private static emit(event: string, data?: unknown): void {
        this.eventEmitter.emit(event, data);
        const wins = BrowserWindow.getAllWindows();
        const channel = event.startsWith('titan:') ? event : `titan:${event}`;
        wins.forEach(win => { this.safeSend(win, channel, data); });
    }

    private static emitLifecycleSyncComplete(): void {
        const wins = BrowserWindow.getAllWindows();
        wins.forEach(win => {
            this.safeSend(win, 'lifecycle:sync-complete', { timestamp: Date.now(), revision: Db.get<number>('local_revision') || 0 });
        });
    }

    static generatePingSync(): string {
        const timestamp = Math.floor(Date.now() / 1000);
        const random = Math.floor(100000 + Math.random() * 900000).toString();
        const hmac = crypto.createHmac('sha256', this.CLIENT_SECRET).update(`${timestamp}:${random}`).digest('hex');
        return `${timestamp}:${random}:${hmac.substring(0, 8)}`;
    }

    private static getCoversDir(): string { return path.join(Db.getDataRoot(), 'cache', 'covers'); }

    private static async deleteCoverFile(resourceId: string): Promise<void> {
        for (const ext of ['.webp', '.jpg', '.png']) {
            fs.promises.unlink(path.join(this.getCoversDir(), `${resourceId}${ext}`)).catch(() => {});
        }
    }

    private static async clearAllCovers(): Promise<void> {
        const coversDir = this.getCoversDir();
        try {
            const files = await fs.promises.readdir(coversDir);
            const coverFiles = files.filter(f => f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.png'));
            for (const file of coverFiles) {
                fs.promises.unlink(path.join(coversDir, file)).catch(() => {});
            }
        } catch (e) {}
    }

    private static triggerCoverSync(serverUrl: string): void {
        try {
            const coverEndpoints = Db.get<Record<string, string>>('endpoints') || {};
            const coverPacksPath = coverEndpoints['cover_packs'] || '/titan/cover_packs.json';
            const coverPacksUrl = coverPacksPath.startsWith('http') ? coverPacksPath : `${serverUrl}${coverPacksPath}`;
            CoverPackService.syncPacks(coverPacksUrl).catch(() => {});
        } catch (e) {}
    }

    static async syncRadarRules(): Promise<void> {
        try {
            const serverUrl = Db.get<any>('app_seed_config')?.serverUrl || Db.get<any>('app_settings')?.serverUrl || '';
            if (!serverUrl) return;

            const res = await titanFetch(`${serverUrl}/titan/titan_radar.php?t=${Date.now()}`, { timeout: 10000 });
            if (res.ok) {
                const json = await res.json();
                const payload = json.data || json;
                if (payload) {
                    Db.set('radar_denuvo_rules', payload);
                    if (payload.search_intent_dict) {
                        Db.set('search_intent_dict', payload.search_intent_dict);
                    }
                }
            }
        } catch (e) {
        }
    }

    static getState(): { running: boolean; lastSyncAt: number | null } {
        return { running: this.isSyncing, lastSyncAt: this.lastSyncTime };
    }

    static async startSync(options?: { force?: boolean }): Promise<void> {
        // 【修复】并发守卫提到最前面：原来守卫之前的"版本检查→DELETE 清库"也能并发执行，
        // 两次同步撞车会一边删一边被对方打断，数据库撕裂
        if (this.isSyncing) return;
        this.isSyncing = true;
        this.lastSyncTime = Date.now();
        // 【修复TDZ】serverUrl 声明必须在前：round11 的 begin 日志引用它时它尚未声明，
        // 参数求值即抛 ReferenceError，.catch 吞掉异常且 isSyncing 已置 true 导致全局死锁
        const serverUrl = Db.get<any>('app_seed_config')?.serverUrl || Db.get<string>('server_url');
        console.error(`[SYNC] begin: serverUrl=${!!serverUrl} force=${!!options?.force} localRev=${Db.get<number>('local_revision') || 0} localVer=${Db.get<number>('resource_version') || 0}`);

        if (serverUrl) {
            this.syncRadarRules().catch(() => {});
        }

        try {
            const dbHealth = Db.query<{c: number}>('SELECT count(id) as c FROM titan_resources');
            if (!dbHealth || dbHealth.length === 0 || (dbHealth[0] && dbHealth[0].c === 0)) {
                Db.set('local_revision', 0);
            }
        } catch (e) {}

        if (serverUrl) {
            try {
                const versionUrl = `${serverUrl}/titan/update_check.php?action=check_main&t=${Date.now()}`;
                const versionRes = await titanFetch(versionUrl, { method: 'GET', timeout: 10000 });
                if (versionRes.ok) {
                    const versionData = await versionRes.json();
                    if (versionData && versionData.success) {
                        const serverVersion = versionData.resource_version || 1;
                        const localVersion = Db.get<number>('resource_version') || 0;

                        if (serverVersion !== localVersion) {
                            console.error(`[SYNC] resource_version changed: server=${serverVersion} local=${localVersion}, clearing local db`);
                            Db.run('DELETE FROM titan_resources');
                            this.clearAllCovers();
                            Db.set('local_revision', 0);
                            Db.set('last_sync_id', '');
                            Db.set('downloaded_cover_packs', []);
                            Db.set('resource_version', serverVersion);
                        }
                    }
                }
            } catch (e) {}
        }

        if (!serverUrl) {
            this.emit('sync:complete', { upsert: 0, delete: 0, unchanged: true });
            this.emit('titan:library-updated', { upsert: 0, delete: 0, unchanged: true });
            this.emitLifecycleSyncComplete();
            // fix41: early return sits outside the try/finally that resets isSyncing;
            // without this reset the whole sync pipeline locked up until restart.
            this.isSyncing = false;
            return;
        }

        try {
            const endpoints = Db.get<Record<string, string>>('endpoints') || {};
            const endpoint = endpoints['data'] || '/titan/data.php';
            const fullUrl = endpoint.startsWith('http') ? endpoint : `${serverUrl}${endpoint}`;

            let currentRev = options?.force ? 0 : (Db.get<number>('local_revision') || 0);
            let lastSyncId = options?.force ? '' : (Db.get<string>('last_sync_id') || '');

            let hasMore = false;
            let totalUpsert = 0;
            let totalDelete = 0;
            const allChangedIds: string[] = [];
            const allBatchRows: any[] = [];
            const allDeletedIds: string[] = [];

            let syncAborted = false;
            let pageCount = 0;
            const MAX_PAGES = 60;

            do {
                pageCount++;
                if (pageCount > MAX_PAGES) {
                    syncAborted = true;
                    break;
                }

                const headers: Record<string, string> = { 
                    'X-Titan-Revision': currentRev.toString(),
                    'X-Titan-Last-Id': lastSyncId,
                    'X-Titan-Ping': this.generatePingSync(),
                    'User-Agent': 'TitanCore/2.0',
                    'Accept': 'application/json'
                };

                const tokenObj = Db.getEncrypted<any>('auth_ticket');
                if (tokenObj?.token) headers['X-Titan-Token'] = tokenObj.token;

                let apiResponse: any = null;
                let fetchSuccess = false;

                for (let retry = 1; retry <= 3; retry++) {
                    try {
                        const response = await titanFetch(`${fullUrl}?_t=${Date.now()}&retry=${retry}`, {
                            method: 'GET',
                            headers,
                            timeout: 15000
                        });

                        if (response.status === 401 || response.status === 403) {
                            // fix41: emit() prefixes the IPC channel with 'titan:', so the literal
                            // 'auth:session-invalid' never reached authStore. Keep the in-process
                            // eventEmitter.emit (future main-side subscribers, e.g. A8 cleanup),
                            // plus direct safeSend to renderers (same pattern as core.ts login).
                            this.eventEmitter.emit('auth:session-invalid', { message: 'Session expired' });
                            BrowserWindow.getAllWindows().forEach(win => {
                                this.safeSend(win, 'auth:session-invalid', { message: 'Session expired' });
                            });
                            syncAborted = true;
                            break;
                        }

                        if (response.status === 304) {
                            hasMore = false;
                            fetchSuccess = true;
                            break;
                        }

                        if (response.ok) {
                            apiResponse = await response.json();
                            fetchSuccess = true;
                            break;
                        }

                        throw new Error(`HTTP ${response.status}`);
                    } catch (e: any) {
                        if (retry === 3) {
                            syncAborted = true;
                        } else {
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }
                }

                if (syncAborted) break;
                if (!fetchSuccess || !apiResponse) {
                    continue;
                }

                if (apiResponse.code !== 200 || !apiResponse.data?.data) {
                    syncAborted = true;
                    break;
                }

                const base64String = apiResponse.data.data;
                let payloadData: BackendResourceItem[] = [];
                let nextRevision = currentRev;

                try {
                    const decodedStr = Buffer.from(base64String, 'base64').toString('utf-8');
                    const decodedPayload = JSON.parse(decodedStr);
                    if (Array.isArray(decodedPayload.data)) {
                        payloadData = decodedPayload.data;
                        nextRevision = decodedPayload.revision || currentRev;
                        hasMore = !!decodedPayload.has_more;

                        if (hasMore && nextRevision < currentRev) {
                            hasMore = false;
                        }

                        if (payloadData.length > 0) {
                            lastSyncId = payloadData[payloadData.length - 1].id;
                        }
                    } else {
                        hasMore = false;
                    }
                } catch (e) {
                    syncAborted = true;
                    break;
                }

                console.error(`[SYNC] page ${pageCount}: items=${payloadData.length} rev=${nextRevision} hasMore=${hasMore}`);
                if (payloadData.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const item of payloadData as any[]) {
                    if (!item || !item.id) {
                        continue;
                    }

                    if (item.status === 'deleted') {
                        allDeletedIds.push(item.id);
                        allChangedIds.push(item.id);
                        continue;
                    }

                    if (!item.type) {
                        syncAborted = true;
                        break;
                    }

                    allBatchRows.push({
                        id: item.id, type: item.type, title: item.title, cover: item.cover,
                        tags: item.tags || '', rating: item.rating || 0, meta_json: item.meta_json,
                        policy_vip: item.policy_vip || 0, policy_price: item.policy_price || 0,
                        policy_start: item.policy_start || 0, policy_end: item.policy_end || 0,
                        time_action: item.time_action || item.policy_mode || 'hide',
                        updated_at: item.updated_at, status: 'active', desc: item.desc || '',
                        collection_ids: item.collection_ids || '[]',
                        hide_in_main: item.hide_in_main || 0,
                        target_id: item.target_id || null
                    });
                    allChangedIds.push(item.id);
                }

                if (syncAborted) break;

                currentRev = nextRevision;

            } while (hasMore);

            if (syncAborted) {
                console.error(`[SYNC] aborted at page ${pageCount} (buffered upsert=${allBatchRows.length} delete=${allDeletedIds.length})`);
                if (allDeletedIds.length > 0) {
                    Db.deleteResourcesBatch(allDeletedIds);
                    for (const id of allDeletedIds) {
                        this.deleteCoverFile(id);
                        totalDelete++;
                    }
                }

                if (allBatchRows.length > 0) {
                    const writeOk = Db.upsertResourcesBatch(allBatchRows);
                    if (writeOk) {
                        totalUpsert += allBatchRows.length;
                        Db.checkpoint();
                    }
                }

                if (allBatchRows.length > 0) {
                    this.triggerCoverSync(serverUrl);
                }

                this.emit('sync:complete', { upsert: totalUpsert, delete: totalDelete, changedIds: allChangedIds, partial: true });
                this.emit('titan:library-updated', { upsert: totalUpsert, delete: totalDelete, changedIds: allChangedIds, partial: true });
                this.emitLifecycleSyncComplete();
                return;
            }

            if (allDeletedIds.length > 0) {
                Db.deleteResourcesBatch(allDeletedIds);
                for (const id of allDeletedIds) {
                    this.deleteCoverFile(id);
                    totalDelete++;
                }
            }

            if (allBatchRows.length > 0) {
                const writeOk = Db.upsertResourcesBatch(allBatchRows);
                if (!writeOk) {
                    this.emit('sync:complete', { upsert: 0, delete: totalDelete, unchanged: true, error: 'WRITE_FAIL' });
                    this.emit('titan:library-updated', { upsert: 0, delete: totalDelete, unchanged: true, error: 'WRITE_FAIL' });
                    this.emitLifecycleSyncComplete();
                    return;
                }
                totalUpsert += allBatchRows.length;
            }

            console.error(`[SYNC] complete: upsert=${allBatchRows.length} delete=${allDeletedIds.length} rev=${currentRev}`);
            Db.checkpoint();
            Db.set('local_revision', currentRev);
            Db.set('last_sync_id', lastSyncId);
            this.triggerCoverSync(serverUrl);

            const wins = BrowserWindow.getAllWindows();
            wins.forEach(win => {
                this.safeSend(win, 'titan:library-updated', { upsert: totalUpsert, delete: totalDelete, changedIds: allChangedIds, revision: currentRev, forceReload: true });
            });

            this.emit('sync:complete', { upsert: totalUpsert, delete: totalDelete, changedIds: allChangedIds, revision: currentRev });
            this.emitLifecycleSyncComplete();

        } catch (e: any) {
            console.error(`[SYNC] fatal:`, e?.message || e);
            this.emit('sync:complete', { upsert: 0, delete: 0, unchanged: true, error: e.message });
            this.emit('titan:library-updated', { upsert: 0, delete: 0, unchanged: true, error: e.message });
            this.emitLifecycleSyncComplete();
        } finally {
            this.isSyncing = false;
        }
    }
}
