// 文件名: src/main/services/CoverPackService.ts
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import axios from 'axios';
import { app } from 'electron';
import { Db } from '../db';

export class CoverPackService {
    private static coversDir: string;
    private static readonly COVER_EXTS = ['.webp', '.jpg', '.png'];
    private static readonly COVER_SECRET = process.env.TITAN_CLIENT_SECRET || 'TITAN_COMMUNITY_CLIENT_SECRET';
    private static pendingFetches = new Map<string, Promise<boolean>>();
    private static appIdCache = new Map<string, string>();

    public static init() {
        this.coversDir = path.join(Db.getDataRoot(), 'cache', 'covers');
        if (!fs.existsSync(this.coversDir)) fs.mkdirSync(this.coversDir, { recursive: true });
    }

    // 【核心】从任意资源 ID（如 titan_protocol_1058 / patch_72 / game_1 / col_xxx / steam_gate_xxx）解析真实 Steam AppID
    public static resolveAppId(id: string, fallbackSrc?: string): string {
        if (!id && !fallbackSrc) return '';
        const clean = String(id || '').trim();

        if (/^\d+$/.test(clean)) return clean;

        const directMatch = clean.match(/^(?:steam_gate_|sharegame_)(\d+)$/i);
        if (directMatch) return directMatch[1];

        if (clean) {
            const cached = this.appIdCache.get(clean);
            if (cached) return cached;

            try {
                const row = Db.query<any>(
                    'SELECT target_id, cover, meta_json, collection_ids FROM titan_resources WHERE id = ? LIMIT 1',
                    [clean]
                )[0];

                if (row) {
                    let resolved = '';

                    if (row.target_id && /^\d+$/.test(String(row.target_id).trim())) {
                        resolved = String(row.target_id).trim();
                    }

                    if (!resolved && row.meta_json) {
                        try {
                            const meta = JSON.parse(row.meta_json);
                            const metaTarget = String(meta?.target_id || meta?.steam_appid || '').trim();
                            if (/^\d+$/.test(metaTarget)) {
                                resolved = metaTarget;
                            }
                        } catch {}
                    }

                    if (!resolved && row.cover) {
                        resolved = this.extractAppIdFromUrl(String(row.cover));
                    }

                    if (!resolved && row.collection_ids) {
                        try {
                            const childIds = JSON.parse(row.collection_ids);
                            if (Array.isArray(childIds) && childIds.length > 0) {
                                resolved = this.resolveAppId(String(childIds[0]));
                            }
                        } catch {}
                    }

                    if (resolved && /^\d+$/.test(resolved)) {
                        this.appIdCache.set(clean, resolved);
                        return resolved;
                    }
                }
            } catch {}
        }

        if (fallbackSrc) {
            const fromSrc = this.extractAppIdFromUrl(fallbackSrc);
            if (fromSrc && /^\d+$/.test(fromSrc)) {
                if (clean) this.appIdCache.set(clean, fromSrc);
                return fromSrc;
            }
        }

        return '';
    }

    private static extractAppIdFromUrl(urlStr: string): string {
        if (!urlStr) return '';
        const gwMatch = urlStr.match(/cover_gateway\.php\?id=(\d+)/i);
        const steamMatch = urlStr.match(/\/steam\/apps\/(\d+)\//i);
        const webpMatch = urlStr.match(/\/covers\/(?:[0-9a-f]\/[0-9a-f]\/[0-9a-f]\/)?(\d+)\.webp/i);
        return gwMatch?.[1] || steamMatch?.[1] || webpMatch?.[1] || '';
    }

    // 【新增】检查本地缓存封面是否存在（原始优先、真实 AppID 归一兜底）
    public static hasLocalCover(id: string, fallbackSrc?: string): boolean {
        if (!id) return false;
        if (!this.coversDir) this.init();

        const idsToCheck: string[] = [id];
        const normalized = id.replace(/^steam_gate_/, '');
        if (normalized !== id) idsToCheck.push(normalized);
        const realAppId = this.resolveAppId(id, fallbackSrc);
        if (realAppId && !idsToCheck.includes(realAppId)) idsToCheck.push(realAppId);

        for (const checkId of idsToCheck) {
            for (const ext of this.COVER_EXTS) {
                if (fs.existsSync(path.join(this.coversDir, `${checkId}${ext}`))) return true;
            }
        }
        return false;
    }

    // 【新增】解析本地缓存封面路径（原始优先、真实 AppID 归一兜底）
    public static resolveLocalCover(id: string, fallbackSrc?: string): string | null {
        if (!id) return null;
        if (!this.coversDir) this.init();

        const idsToCheck: string[] = [id];
        const normalized = id.replace(/^steam_gate_/, '');
        if (normalized !== id) idsToCheck.push(normalized);
        const realAppId = this.resolveAppId(id, fallbackSrc);
        if (realAppId && !idsToCheck.includes(realAppId)) idsToCheck.push(realAppId);

        for (const checkId of idsToCheck) {
            for (const ext of this.COVER_EXTS) {
                const filePath = path.join(this.coversDir, `${checkId}${ext}`);
                if (fs.existsSync(filePath)) return filePath;
            }
        }
        return null;
    }

    // 【新增】解析 Steam 客户端本地缓存的竖版封面路径（兼容根目录、SHA1哈希子目录及旧版平铺命名，中文与高清优先）

    // 【核心新增】当本地未命中时，后台异步携带 HMAC 强签名鉴权向元数据服务器要图并静默落盘
    public static async fetchAndCacheCover(id: string, fallbackSrc?: string): Promise<boolean> {
        if (!id && !fallbackSrc) return false;
        const normalizedId = this.resolveAppId(id, fallbackSrc);
        if (!/^\d+$/.test(normalizedId)) return false;

        if (!this.coversDir) this.init();

        const existing = this.resolveLocalCover(normalizedId);
        if (existing) return true;

        const inflight = this.pendingFetches.get(normalizedId);
        if (inflight) return inflight;

        const task = (async (): Promise<boolean> => {
            try {
                const timestamp = Math.floor(Date.now() / 1000);
                const sign = crypto.createHmac('sha256', this.COVER_SECRET).update(`${normalizedId}:${timestamp}`).digest('hex');

                const masterBase = (process.env.TITAN_NODE_2 || '').replace(/\/$/, '');
                const primaryBase = (Db.get<any>('app_seed_config')?.serverUrl || Db.get<any>('app_settings')?.serverUrl || masterBase).replace(/\/$/, '');
                const bases = Array.from(new Set([primaryBase, masterBase].filter(Boolean)));
                if (bases.length === 0) return false;

                for (const base of bases) {
                    try {
                        const gatewayUrl = `${base}/titan/cover_gateway.php?id=${normalizedId}`;
                        const res = await axios.get(gatewayUrl, {
                            responseType: 'arraybuffer',
                            timeout: 12000,
                            headers: {
                                'User-Agent': 'TitanCore/3.0',
                                'X-Titan-Client': 'TitanCore',
                                'X-Titan-Timestamp': String(timestamp),
                                'X-Titan-Sign': sign
                            }
                        });

                        if (res.status === 200 && res.data && res.data.length > 0) {
                            const contentType = (res.headers['content-type'] as string) || '';
                            const ext = contentType.includes('webp') ? '.webp' : (contentType.includes('png') ? '.png' : '.jpg');
                            const targetPath = path.join(this.coversDir, `${normalizedId}${ext}`);
                            const tempPath = `${targetPath}.tmp.${Date.now()}`;

                            await fs.promises.writeFile(tempPath, Buffer.from(res.data));
                            await fs.promises.rename(tempPath, targetPath);
                            return true;
                        }
                    } catch {}
                }
                return false;
            } catch {
                return false;
            } finally {
                this.pendingFetches.delete(normalizedId);
            }
        })();

        this.pendingFetches.set(normalizedId, task);
        return task;
    }

    public static resolveSteamCover(appId: string, steamPath: string): string | null {
        const numMatch = appId.match(/\d+/);
        const cleanId = numMatch ? numMatch[0] : appId;
        if (!/^\d+$/.test(cleanId) || !steamPath) return null;

        const libCacheRoot = path.join(steamPath, 'appcache', 'librarycache');
        const appidDir = path.join(libCacheRoot, cleanId);

        const candidates: string[] = [];
        const collectVerticalCovers = (dir: string) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isFile()) {
                        const name = entry.name.toLowerCase();
                        if (
                            (name.startsWith('library_600x900') || name.startsWith('library_capsule')) &&
                            (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp'))
                        ) {
                            candidates.push(path.join(dir, entry.name));
                        }
                    } else if (entry.isDirectory()) {
                        collectVerticalCovers(path.join(dir, entry.name));
                    }
                }
            } catch {}
        };

        if (fs.existsSync(appidDir)) {
            collectVerticalCovers(appidDir);
        }

        if (candidates.length > 0) {
            const scoreCover = (filePath: string): number => {
                const n = path.basename(filePath).toLowerCase();
                let score = 0;
                if (n.includes('schinese')) score += 100;
                if (n.startsWith('library_600x900')) score += 50;
                else if (n.startsWith('library_capsule')) score += 20;
                if (n.includes('_2x')) score += 5;
                return score;
            };
            candidates.sort((a, b) => scoreCover(b) - scoreCover(a));
            return candidates[0];
        }

        for (const suffix of ['_library_600x900_schinese.jpg', '_library_600x900.jpg', '_library_capsule_schinese.jpg', '_library_capsule.jpg']) {
            const legacyPath = path.join(libCacheRoot, `${appId}${suffix}`);
            if (fs.existsSync(legacyPath)) return legacyPath;
        }

        return null;
    }

    // 【新增】解析 Steam 客户端本地缓存的横版封面路径（Header）
    public static resolveSteamHeader(appId: string, steamPath: string): string | null {
        const numMatch = appId.match(/\d+/);
        const cleanId = numMatch ? numMatch[0] : appId;
        if (!/^\d+$/.test(cleanId) || !steamPath) return null;

        const appidDir = path.join(steamPath, 'appcache', 'librarycache', cleanId);
        if (!fs.existsSync(appidDir)) return null;

        const findHeader = (dir: string): string | null => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile()) {
                    const name = entry.name.toLowerCase();
                    if (name.startsWith('library_header') || name.startsWith('header')) {
                        return path.join(dir, entry.name);
                    }
                }
            }
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const found = findHeader(path.join(dir, entry.name));
                    if (found) return found;
                }
            }
            return null;
        };

        return findHeader(appidDir);
    }
}
