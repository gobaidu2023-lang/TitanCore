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
    private static readonly COVER_SECRET = 'TitanV15_KimiFinal_2025';
    private static pendingFetches = new Set<string>();

    public static init() {
        this.coversDir = path.join(Db.getDataRoot(), 'cache', 'covers');
        if (!fs.existsSync(this.coversDir)) fs.mkdirSync(this.coversDir, { recursive: true });
    }

    // 【新增】检查本地缓存封面是否存在（原始优先、归一兜底）
    public static hasLocalCover(id: string): boolean {
        if (!id) return false;
        if (!this.coversDir) this.init();

        const idsToCheck: string[] = [id];
        const normalized = id.replace(/^steam_gate_/, '');
        if (normalized !== id) idsToCheck.push(normalized);
        const numMatch = id.match(/\d+/);
        if (numMatch && !idsToCheck.includes(numMatch[0])) idsToCheck.push(numMatch[0]);

        for (const checkId of idsToCheck) {
            for (const ext of this.COVER_EXTS) {
                if (fs.existsSync(path.join(this.coversDir, `${checkId}${ext}`))) return true;
            }
        }
        return false;
    }

    // 【新增】解析本地缓存封面路径（原始优先、归一兜底）
    public static resolveLocalCover(id: string): string | null {
        if (!id) return null;
        if (!this.coversDir) this.init();

        const idsToCheck: string[] = [id];
        const normalized = id.replace(/^steam_gate_/, '');
        if (normalized !== id) idsToCheck.push(normalized);
        const numMatch = id.match(/\d+/);
        if (numMatch && !idsToCheck.includes(numMatch[0])) idsToCheck.push(numMatch[0]);

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
    public static async fetchAndCacheCover(id: string): Promise<boolean> {
        if (!id) return false;
        const numMatch = id.match(/\d+/);
        const normalizedId = numMatch ? numMatch[0] : id.replace(/^steam_gate_/, '');
        if (!/^\d+$/.test(normalizedId)) return false;

        if (this.pendingFetches.has(normalizedId)) return false;
        if (!this.coversDir) this.init();

        const existing = this.resolveLocalCover(normalizedId);
        if (existing) return true;

        this.pendingFetches.add(normalizedId);

        try {
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = crypto.createHmac('sha256', this.COVER_SECRET).update(`${normalizedId}:${timestamp}`).digest('hex');

            const serverUrl = Db.get<any>('app_seed_config')?.serverUrl || Db.get<any>('app_settings')?.serverUrl || (process.env.TITAN_NODE_2 || '');
            const gatewayUrl = `${serverUrl}/titan/cover_gateway.php?id=${normalizedId}`;

            const res = await axios.get(gatewayUrl, {
                responseType: 'arraybuffer',
                timeout: 8000,
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
            return false;
        } catch (e: any) {
            return false;
        } finally {
            this.pendingFetches.delete(normalizedId);
        }
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
