// 文件名: src/main/services/MiniGameAssetService.ts
/**
 * MiniGameAssetService - 小游戏素材包安装服务
 *
 * 职责:
 *   1. 从服务端 minigames.php 拉取素材包下载链接（token 鉴权 + base64 加密负载，与 games.php 同构）
 *   2. aria2c 下载 zip -> 7z 解压到 <安装目录>\games\<gameId>\
 *   3. 状态持久化: games\<gameId>\meta.json（存在即已安装）
 *   4. IPC: minigame:fetch-links / install / uninstall / get-state
 *   5. 事件: minigame:install-progress / minigame:install-done（与 tcgame 同构）
 *
 * 复用: DownloadService(aria2c 下载/进度/等待) / ArchiveService(7z 解压) / GAMES_ROOT(GameService 导出)
 * 路径约定: zip 内部结构与原 public\games\<gameId>\ 完全一致，根目录含 <gameId>.webp 封面
 */
import { ipcMain, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { Db } from '../db';
import { DownloadService } from './DownloadService';
import { titanFetch } from '../TitanNet';
import { GAMES_ROOT } from './GameService';
import { ArchiveService } from '../utils/ArchiveService';
import { RacingDownloader } from '../utils/RacingDownloader';

// 当前可安装的小游戏白名单（与大厅卡片、zip 包一一对应）
export const MINI_GAME_IDS = ['starcat', 'badab', 'cyberguitar'] as const;
type MiniGameId = typeof MINI_GAME_IDS[number];

interface MiniGameMeta {
  id: MiniGameId;
  version: string;
  installedAt: string;
}

// 防重入集合
const installingSet = new Set<string>();

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function broadcast(channel: string, data: any) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      try { win.webContents.send(channel, data); } catch {}
    }
  });
}

function readLocalMeta(gameId: string): MiniGameMeta | null {
  const metaPath = path.join(GAMES_ROOT, gameId, 'meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    if (meta && meta.id === gameId) return meta;
  } catch {}
  return null;
}

// ========== 核心流程 (8MB 冲刺线多源竞速，赢家跑完全程) ==========
async function doInstall(gameId: MiniGameId, downloadUrl: string | string[]) {
  if (installingSet.has(gameId)) {
    throw new Error('ERR_MINIGAME_INSTALLING');
  }
  if (readLocalMeta(gameId)) {
    throw new Error('ERR_MINIGAME_ALREADY_INSTALLED');
  }
  installingSet.add(gameId);

  const urls = (Array.isArray(downloadUrl) ? downloadUrl : [downloadUrl])
    .filter(u => typeof u === 'string' && u.trim().length > 0);
  if (urls.length === 0) {
    installingSet.delete(gameId);
    throw new Error('ERR_DOWNLOAD_URL_MISSING');
  }

  const gameDir = path.join(GAMES_ROOT, gameId);
  const tempDir = path.join(Db.getDataRoot(), 'TitanTemp', `minigame_${gameId}`);
  const targetZip = path.join(tempDir, `${gameId}.zip`);

  if (fs.existsSync(gameDir)) fs.rmSync(gameDir, { recursive: true, force: true });
  ensureDir(tempDir);
  ensureDir(gameDir);

  try {
    broadcast('minigame:install-progress', { gameId, status: 'downloading' });

    // R57: 调用统一 RacingDownloader：设计 8MB 冲刺线窗口竞速，赢家跑完全程，败者即刻销毁
    await RacingDownloader.raceLargeArchive(urls, {
      destPath: targetZip,
      windowBytes: 8 * 1024 * 1024,  // 8MB 冲刺线：谁先跑到 8MB 谁赢
      windowTimeoutMs: 15000,         // 15 秒冲刺窗口
      label: `minigame_${gameId}`
    });

    if (!fs.existsSync(targetZip)) throw new Error('ERR_ZIP_MISSING');

    // 解压
    broadcast('minigame:install-progress', { gameId, status: 'extracting' });
    await ArchiveService.extract(targetZip, gameDir);

    // 写本地元数据（meta.json 存在即已安装）
    const localMeta: MiniGameMeta = {
      id: gameId,
      version: '',
      installedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(gameDir, 'meta.json'), JSON.stringify(localMeta, null, 2));

    broadcast('minigame:install-progress', { gameId, status: 'done' });
    broadcast('minigame:install-done', { gameId, success: true });
  } catch (err: any) {
    // 失败清场，不留半拉子目录与残留
    if (fs.existsSync(gameDir)) fs.rmSync(gameDir, { recursive: true, force: true });
    broadcast('minigame:install-done', { gameId, success: false, error: err?.message || 'ERR_UNKNOWN' });
    throw err;
  } finally {
    installingSet.delete(gameId);
    // 严格清理临时下载目录，防残留、防泄漏
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      /* 容忍 Windows 句柄延迟释放 */
    }
  }
}

// ========== 注册 IPC（minigame: 前缀） ==========
export function registerMiniGameAssetService() {
  ensureDir(GAMES_ROOT);

  ipcMain.handle('minigame:fetch-links', async () => {
    try {
      const config = Db.get<any>('app_seed_config');
      const serverUrl = config?.serverUrl;
      if (!serverUrl) return { success: false, error: 'ERR_SERVER_REQUIRED' };

      const token = Db.getEncrypted<any>('auth_ticket')?.token;
      if (!token) return { success: false, error: 'ERR_LOGIN_REQUIRED' };

      const res = await titanFetch(`${serverUrl}/titan/minigames.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Titan-Token': token
        },
        body: JSON.stringify({ action: 'list' })
      });

      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

      const json = await res.json() as { code?: number; msg?: string; data?: { data?: string } | string };
      if (json.code !== 200) return { success: false, error: json.msg || 'ERR_SERVER_REJECTED' };

      // v1.2 起服务端返回明文 JSON（vote.php 同款生产验证惯例），不再走未验证的加密管道
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      // 只透告白名单内的小游戏
      const filtered = list.filter((g: any) => MINI_GAME_IDS.includes(g?.id));
      return { success: true, data: filtered };
    } catch (e: any) {
      return { success: false, error: e.message || 'ERR_NETWORK_ERROR' };
    }
  });

  ipcMain.handle('minigame:install', async (_e, gameId: string, downloadUrl: string | string[]) => {
    try {
      if (!MINI_GAME_IDS.includes(gameId)) {
        return { success: false, error: 'ERR_INVALID_GAME_ID' };
      }
      if (!downloadUrl || (Array.isArray(downloadUrl) && downloadUrl.length === 0)) {
        return { success: false, error: 'ERR_DOWNLOAD_URL_MISSING' };
      }
      await doInstall(gameId as MiniGameId, downloadUrl);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('minigame:uninstall', async (_e, gameId: string) => {
    if (!MINI_GAME_IDS.includes(gameId)) {
      return { success: false, error: 'ERR_INVALID_GAME_ID' };
    }
    const gameDir = path.join(GAMES_ROOT, gameId);
    if (fs.existsSync(gameDir)) fs.rmSync(gameDir, { recursive: true, force: true });
    return { success: true };
  });

  ipcMain.handle('minigame:get-state', async () => {
    const state: Record<string, any> = {};
    for (const id of MINI_GAME_IDS) {
      const meta = readLocalMeta(id);
      state[id] = meta
        ? { installed: true, version: meta.version, installedAt: meta.installedAt }
        : { installed: false };
    }
    return state;
  });

  ipcMain.handle('minigame:installed', async (_e, gameId: string) => {
    if (!MINI_GAME_IDS.includes(gameId)) return false;
    return !!readLocalMeta(gameId);
  });
}