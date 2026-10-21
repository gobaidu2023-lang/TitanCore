import { ipcMain, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { Db } from '../db';
import { DownloadService } from './DownloadService';
import { SecurityService } from './SecurityService';
import { titanFetch } from '../TitanNet';
import axios from 'axios';
import { ArchiveService } from '../utils/ArchiveService';

// ========== 路径约定 ==========
export const GAMES_ROOT = app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'games')
  : path.join(app.getAppPath(), '..', 'games');

const LIBRARY_PATH = path.join(GAMES_ROOT, 'library.json');

// ========== 工具 ==========
function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function getLibrary(): Record<string, any> {
  if (!fs.existsSync(LIBRARY_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf-8')); }
  catch { return {}; }
}

function saveLibrary(lib: Record<string, any>) {
  ensureDir(GAMES_ROOT);
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2));
}

function broadcast(channel: string, data: any) {
  BrowserWindow.getAllWindows().forEach(win => {
    if (!win.isDestroyed()) {
      try { win.webContents.send(channel, data); } catch {}
    }
  });
}

// 下载封面
async function downloadCover(appid: number, url: string, destPath: string) {
  try {
    // fix42(A3): binaries must never pass through titanFetch (responseType:'text'
    // injects U+FFFD and kills the webp header). Dedicated axios stream, mirrors
    // CoverPackService.downloadPack. axios rejects non-2xx by itself.
    const res = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 30000,
      headers: { 'User-Agent': 'TitanCore/2.0' }
    });
    const writer = fs.createWriteStream(destPath);
    res.data.pipe(writer);
    await new Promise<void>((resolve, reject) => {
      let hasError = false;
      const cleanup = (err?: any) => {
        if (hasError) return;
        hasError = true;
        writer.destroy();
        if (err) reject(err);
      };
      writer.on('error', (err) => cleanup(err));
      res.data.on('error', (err: any) => cleanup(err));
      writer.on('close', () => {
        if (hasError) return;
        resolve();
      });
    });
  } catch (e: any) {
    try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch {}
    console.warn(`[GameService] 封面下载失败 ${appid}:`, e.message);
  }
}

// 正在安装中的游戏集合（防重入）
const installingSet = new Set<number>();

// ========== 核心流程 ==========
async function doInstall(appid: number, meta: any) {
  const safeAppId = String(appid ?? '').trim();
  if (!/^\d+$/.test(safeAppId)) {
    throw new Error('ERR_INVALID_APPID');
  }
  const numAppId = Number(safeAppId);
  if (installingSet.has(numAppId)) {
    throw new Error('ERR_GAME_INSTALLING');
  }
  installingSet.add(numAppId);

  // R67: Steam 式更新语义 — 用户点更新即明确意图, 先强杀游戏 exe 再覆盖安装
  if (meta?.exe_name) {
    try { spawn('taskkill', ['/F', '/IM', String(meta.exe_name), '/T'], { windowsHide: true }); } catch {}
  }

  const appDir = path.join(GAMES_ROOT, String(appid));
  const gameDir = path.join(appDir, 'game');
  const tempDir = path.join(Db.getDataRoot(), 'TitanTemp', `game_${appid}`);

  if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
  ensureDir(tempDir);
  ensureDir(gameDir);

  // fix42(A5): gid hoisted so the catch path can kill the aria2 orphan task
  let gid: string | null = null;
  try {
    // 1. 交给 aria2c 下载
    broadcast('tcgame:install-progress', { appid, status: 'downloading' });
    // R57: 镜像数组全量透传, aria2 原生多源竞速(addUri string[] 契约); 单链接兼容回退
    const mirrorUrls = (Array.isArray(meta.download_urls) && meta.download_urls.length ? meta.download_urls : (meta.download_url ? [meta.download_url] : [])) as string[]
    if (mirrorUrls.length === 0) throw new Error('ERR_DOWNLOAD_URL_MISSING')
    gid = await DownloadService.addUri(mirrorUrls, {
      dir: tempDir,
      resourceId: `game_${appid}`,
      // R55v2: 落盘名确定性约定 = ${appid}.zip (元数据驱动; 纯数字+.zip 过 sanitize 不变形)
      title: `${appid}.zip`
    });

  
    // 3. 等待下载完成（30分钟超时，对齐 UpdaterService 主程序包策略）
    await DownloadService.waitForCompletion(gid, 1800000);

    // 4. 停止轮询，进入解压阶段

    // R55v2: 与 addUri title 同一约定(appid.zip), 两端都从元数据派生, 不扫描目录
    const zipPath = path.join(tempDir, `${appid}.zip`);

    broadcast('tcgame:install-progress', { appid, status: 'extracting' });
    await ArchiveService.extract(zipPath, gameDir);

    // 5. 下载封面
    if (meta.cover_url) {
      await downloadCover(appid, meta.cover_url, path.join(appDir, 'cover.webp'));
    }

    // 6. 写本地元数据
    const localMeta = {
      appid,
      title: meta.title,
      version: meta.version,
      exeName: meta.exe_name,
      installedAt: new Date().toISOString()
    };
    fs.writeFileSync(path.join(appDir, 'meta.json'), JSON.stringify(localMeta, null, 2));

    // 7. 更新 library.json
    const lib = getLibrary();
    lib[String(appid)] = localMeta;
    saveLibrary(lib);

    broadcast('tcgame:install-done', { appid, success: true });
  } catch (err: any) {
    // fix42(A5): on timeout the aria2 task outlives the rejection and keeps
    // downloading into tempDir; kill it BEFORE finally wipes that dir.
    if (gid) await DownloadService.removeTask(gid).catch(() => {});
    // 失败广播统一由外层 ipcMain.handle catch 处理，此处只抛异常
    throw err;
  } finally {
    installingSet.delete(numAppId);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

// ========== 注册 IPC（tcgame: 前缀） ==========
export function registerGameService() {
  ensureDir(GAMES_ROOT);

  ipcMain.handle('tcgame:fetch-list', async () => {
    try {
      const config = Db.get<any>('app_seed_config');
      const serverUrl = config?.serverUrl;
      if (!serverUrl) return { success: false, error: 'ERR_SERVER_REQUIRED' };

      const token = Db.getEncrypted<any>('auth_ticket')?.token;
      if (!token) return { success: false, error: 'ERR_LOGIN_REQUIRED' };

      const res = await titanFetch(`${serverUrl}/titan/games.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Titan-Token': token
        },
        body: JSON.stringify({ action: 'list' })
      });

      if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

      // R55v2: 对齐 minigames v1.2 明文惯例(vote.php 生产验证), 废弃从未跑通的加密管道
      const json = await res.json() as { code?: number; msg?: string; data?: any };
      if (json.code !== 200) return { success: false, error: json.msg || 'ERR_SERVER_REJECTED' };
      const list = Array.isArray(json.data) ? json.data : (json.data?.data || []);
      return { success: true, data: list };
    } catch (e: any) {
      return { success: false, error: e.message || 'ERR_NETWORK_ERROR' };
    }
  });

  ipcMain.handle('tcgame:install', async (_e, appid: number, meta: any) => {
    try {
      await doInstall(appid, meta);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('tcgame:launch', async (_e, appid: number, exeName: string) => {
    const safeAppId = String(appid).trim();
    if (!/^\d+$/.test(safeAppId)) return { success: false, error: 'ERR_INVALID_APPID' };

    const baseExe = path.basename(String(exeName || '').trim());
    if (!baseExe) return { success: false, error: 'ERR_INVALID_EXENAME' };

    const gameDir = path.join(GAMES_ROOT, safeAppId, 'game');
    const exePath = path.join(gameDir, baseExe);
    if (!fs.existsSync(exePath)) {
      return { success: false, error: 'ERR_GAME_BINARY_MISSING' };
    }
    try {
      const child = spawn(exePath, [], { cwd: gameDir, detached: true, windowsHide: false });
      child.unref();
      return { success: true, pid: child.pid };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('tcgame:uninstall', async (_e, appid: number, exeName: string) => {
    const safeAppId = String(appid).trim();
    if (!/^\d+$/.test(safeAppId)) return { success: false, error: 'ERR_INVALID_APPID' };
    // fix42(A4): refuse while the exe is alive. basename() strips any subdir from
    // exe_name (taskkill /IM rejects paths; tasklist only shows bare image names),
    // and line-start boundary matching avoids substring false positives (game.exe
    // must not match epicgames.exe / mygame.exe).
    const baseExe = exeName ? path.basename(String(exeName)) : '';
    if (baseExe) {
      try {
        const list = execSync('tasklist', { windowsHide: true, timeout: 5000 }).toString();
        const upperExe = baseExe.toUpperCase();
        const hit = list.split(/\r?\n/).some(l => {
          const line = l.trim().toUpperCase();
          return line.startsWith(upperExe + ' ') || line === upperExe;
        });
        if (hit) return { success: false, error: 'ERR_GAME_RUNNING' };
      } catch {}
    }
    const appDir = path.join(GAMES_ROOT, String(appid));
    if (baseExe) {
      try {
        spawn('taskkill', ['/F', '/IM', baseExe, '/T'], { windowsHide: true });
      } catch {}
    }
    if (fs.existsSync(appDir)) fs.rmSync(appDir, { recursive: true, force: true });
    const lib = getLibrary();
    delete lib[String(appid)];
    saveLibrary(lib);
    return { success: true };
  });

  ipcMain.handle('tcgame:installed', async (_e, appid: number) => {
    const lib = getLibrary();
    return !!lib[String(appid)];
  });

  ipcMain.handle('tcgame:get-library', async () => getLibrary());

  ipcMain.handle('tcgame:get-playtime', async () => {
    let totalMinutes = 0;
    if (!fs.existsSync(GAMES_ROOT)) return { totalMinutes: 0 };
    const dirs = fs.readdirSync(GAMES_ROOT).filter(d => /^\d+$/.test(d));
    for (const dir of dirs) {
      const ptPath = path.join(GAMES_ROOT, dir, 'playtime.json');
      if (fs.existsSync(ptPath)) {
        try {
          const pt = JSON.parse(fs.readFileSync(ptPath, 'utf-8'));
          totalMinutes += (pt.sessionMinutes || 0);
        } catch {}
      }
    }
    return { totalMinutes };
  });
}