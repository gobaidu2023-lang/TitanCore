// 文件名: src/main/services/CoverPackService.ts
import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import { app } from 'electron';
import { Db } from '../db';
import { ArchiveService } from '../utils/ArchiveService';

export class CoverPackService {
    private static coversDir: string;
    private static isSyncing = false;
    private static readonly DOWNLOAD_CONCURRENCY = 3;
    private static readonly PACK_TIMEOUT = 30000;
    private static readonly MAX_RETRIES = 2;
    private static readonly COVER_EXTS = ['.webp', '.jpg', '.png'];

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

        for (const checkId of idsToCheck) {
            for (const ext of this.COVER_EXTS) {
                const filePath = path.join(this.coversDir, `${checkId}${ext}`);
                if (fs.existsSync(filePath)) return filePath;
            }
        }
        return null;
    }

    // 【新增】解析 Steam 客户端本地缓存的竖版封面路径
    public static resolveSteamCover(appId: string, steamPath: string): string | null {
        if (!/^\d+$/.test(appId) || !steamPath) return null;

        const appidDir = path.join(steamPath, 'appcache', 'librarycache', appId);
        if (!fs.existsSync(appidDir)) return null;

        const findVerticalCover = (dir: string): string | null => {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            // 先扫当前目录的文件
            for (const entry of entries) {
                if (entry.isFile()) {
                    const name = entry.name.toLowerCase();
                    if (name.startsWith('library_600x900') || name.startsWith('library_capsule')) {
                        return path.join(dir, entry.name);
                    }
                }
            }
            // 再递归进子目录
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const found = findVerticalCover(path.join(dir, entry.name));
                    if (found) return found;
                }
            }
            return null;
        };

        return findVerticalCover(appidDir);
    }

    // 【新增】解析 Steam 客户端本地缓存的横版封面路径（Header）
    public static resolveSteamHeader(appId: string, steamPath: string): string | null {
        if (!/^\d+$/.test(appId) || !steamPath) return null;

        const appidDir = path.join(steamPath, 'appcache', 'librarycache', appId);
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
    // ========== 原有方法一字不动 ==========

    public static async syncPacks(listUrl: string) {
        if (!this.coversDir) this.init();
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const finalUrl = listUrl.includes('?') ? `${listUrl}&t=${Date.now()}` : `${listUrl}?t=${Date.now()}`;
            const res = await axios.get(finalUrl, { timeout: 10000, headers: { 'User-Agent': 'TitanCore/2.0' } });
            
            let packsRaw = res.data;
            if (typeof packsRaw === 'string') {
                try { packsRaw = JSON.parse(packsRaw); } catch (e) { throw new Error('ERR_JSON_PARSE_FAIL'); }
            }
            if (packsRaw && typeof packsRaw === 'object' && Array.isArray((packsRaw as any).data)) {
                packsRaw = (packsRaw as any).data;
            }

            if (!Array.isArray(packsRaw)) throw new Error('ERR_INVALID_PACK_FORMAT');

            const packs: { id: number, url: string }[] = packsRaw;
            const history = Db.get<number[]>('downloaded_cover_packs') || [];
            
            const newPacks = packs.filter(p => !history.includes(p.id)).sort((a, b) => a.id - b.id);
            if (newPacks.length === 0) return;

            const successIds: number[] = [];

            const processPack = async (pack: { id: number, url: string }): Promise<boolean> => {
                const tempFile = path.join(
                    Db.getDataRoot(), 
                    'cache', 
                    `pack_${pack.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.zip`
                );
                
                let retries = this.MAX_RETRIES;
                while (retries >= 0) {
                    try {
                        await this.downloadPack(pack, tempFile);
                        const ok = await ArchiveService.test(tempFile);
                        if (!ok) throw new Error('压缩包 CRC 校验失败');
                        await ArchiveService.extract(tempFile, this.coversDir, { overwrite: true });
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                        
                        const currentHistory = Db.get<number[]>('downloaded_cover_packs') || [];
                        if (!currentHistory.includes(pack.id)) {
                            Db.set('downloaded_cover_packs', [...currentHistory, pack.id]);
                        }
                        
                        return true;
                    } catch (e: any) {
                        if (fs.existsSync(tempFile)) try { fs.unlinkSync(tempFile); } catch {}
                        
                        console.warn(`[CoverPackService] Pack ${pack.id} 尝试失败 (${this.MAX_RETRIES - retries + 1}/${this.MAX_RETRIES + 1}):`, e.message);
                        
                        if (retries === 0) {
                            console.error(`[CoverPackService] Pack ${pack.id} 最终失败:`, e.message);
                            return false;
                        }
                        retries--;
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
                return false;
            };

            const worker = async (workerId: number) => {
                for (let i = workerId; i < newPacks.length; i += this.DOWNLOAD_CONCURRENCY) {
                    if (await processPack(newPacks[i])) {
                        successIds.push(newPacks[i].id);
                    }
                }
            };

            const workers: Promise<void>[] = [];
            for (let i = 0; i < this.DOWNLOAD_CONCURRENCY; i++) {
                workers.push(worker(i));
            }
            await Promise.all(workers);

            if (successIds.length > 0) {
                const currentHistory = Db.get<number[]>('downloaded_cover_packs') || [];
                const updatedHistory = Array.from(new Set([...currentHistory, ...successIds]));
                Db.set('downloaded_cover_packs', updatedHistory);
                this.cleanupLRU();
            }
        } catch (e: any) {
            console.error('[CoverPackService] syncPacks error:', e.message);
        } finally {
            this.isSyncing = false;
        }
    }

    private static async downloadPack(pack: { id: number, url: string }, tempFile: string): Promise<void> {
        const response = await axios({ 
            url: pack.url, 
            method: 'GET', 
            responseType: 'stream', 
            timeout: this.PACK_TIMEOUT, 
            headers: { 'User-Agent': 'TitanCore/2.0' } 
        });
        
        const writer = fs.createWriteStream(tempFile);
        response.data.pipe(writer);
        
        return new Promise<void>((resolve, reject) => {
            let hasError = false;
            
            const cleanup = (err?: any) => {
                if (hasError) return;
                hasError = true;
                writer.destroy();
                if (err) reject(err);
            };
            
            writer.on('error', (err) => cleanup(err));
            response.data.on('error', (err: any) => cleanup(err));
            
            writer.on('close', () => {
                if (hasError) return;
                resolve();
            });
        });
    }

    private static async cleanupLRU(): Promise<void> {
        try {
            const files = await fs.promises.readdir(this.coversDir);
            const coverFiles = files.filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'));
            if (coverFiles.length <= 1000) return;

            const fileStats = await Promise.all(
                coverFiles.map(async (f) => {
                    const filePath = path.join(this.coversDir, f);
                    try {
                        const stat = await fs.promises.stat(filePath);
                        return { path: filePath, mtime: stat.mtimeMs };
                    } catch {
                        return { path: filePath, mtime: 0 };
                    }
                })
            );

            fileStats.sort((a, b) => b.mtime - a.mtime);
            const toDelete = fileStats.slice(1000);
            for (const file of toDelete) {
                fs.promises.unlink(file.path).catch(() => {});
            }
        } catch (e) {}
    }
}