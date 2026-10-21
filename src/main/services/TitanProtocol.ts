import fs from 'fs';
import path from 'path';
import { app, BrowserWindow } from 'electron';
import axios from 'axios';
import { exec, spawn } from 'child_process';
import util from 'util';
import { Db } from '../db';
import { ArchiveService } from '../utils/ArchiveService';
import { RacingDownloader } from '../utils/RacingDownloader';
import { DepotKeyService } from './DepotKeyService'; 
import { ModeSwitchService } from './ModeSwitchService'
import { CloudSaveService } from './CloudSaveService';
import { PatternSyncService } from './PatternSyncService';

export interface ProtocolConfig {
    app_id: string;
    tool_url?: string;
    tool_mirrors?: string[];
    manifest_url?: string;
    manifest_mirrors?: string[];
    target_dlls?: string[];
    fast_mode?: boolean;
    expected_engine_version?: number;
}

export interface ProtocolResult {
    success: boolean;
    msg: string;
    path?: string;
    needRestartSteam?: boolean;
}

export interface DiagnosticItem {
    name: string;
    ok: boolean;
    message: string;
    warning?: boolean;
}

export class TitanProtocol {
    
    private static get TEMP_ROOT() { 
        return path.join(Db.getDataRoot(), 'TitanTemp'); 
    }
    
    private static readonly PLUGIN_DIR_NAME_OST = 'lua';
    
    private static deploymentLocks: Map<string, number> = new Map();
    private static readonly LOCK_TTL_MS = 90000;
    private static readonly GLOBAL_LOCK_KEY = 'GLOBAL_REPAIR';

    // ================= [ 云存档 DLL 实用工具 ] =================

    private static get CLOUD_REDIRECT_CACHE_DIR(): string { 
        return path.join(Db.getDataRoot(), 'TitanCache', 'ost'); 
    }

    static hasCloudRedirectCache(): boolean { 
        return fs.existsSync(path.join(this.CLOUD_REDIRECT_CACHE_DIR, 'cloud_redirect.dll')); 
    }

    // ================= [ 诊断 ] =================

    static async runDiagnostics(steamPath: string, engine: 'ost' = 'ost', manifestProbeResult?: { url: string } | null): Promise<DiagnosticItem[]> {
        const results: DiagnosticItem[] = []
        
        // 存量自愈：旧时代 dwmapi 劫持已废弃，若 Steam 根残留则静默清理
        for (const deadFile of ['dwmapi.dll', 'dwmapi.dll.bak']) {
            const deadPath = path.join(steamPath, deadFile);
            if (fs.existsSync(deadPath)) {
                try { fs.unlinkSync(deadPath); } catch {}
            }
        }

        // 1. DLL 完整性(TC-P8: 跟随引擎模式活根, 纯净模式工件在 TC\ost; CR 恒定钉死 ostDir)
        const ostRoot = ModeSwitchService.getRootSync(steamPath) || steamPath
        // TC-P32: 纯净模式 ost 不再含 xinput 代理入口，自检清单依模式分离
        const dlls = ModeSwitchService.getMode() === 'pure'
            ? ['OpenSteamTool.dll', 'cloud_redirect.dll', 'opensteamtool.toml']
            : ['xinput1_4.dll', 'OpenSteamTool.dll', 'cloud_redirect.dll', 'opensteamtool.toml'];
        const missingDlls = dlls.filter(d => {
            const checkDir = d.toLowerCase() === 'cloud_redirect.dll'
                ? ModeSwitchService.ostDir
                : ostRoot;
            return !fs.existsSync(path.join(checkDir, d));
        })
        results.push({
            name: 'DIAG_OST_DLL',
            ok: missingDlls.length === 0,
            message: missingDlls.length === 0 
                ? 'DIAG_OST_OK'
                : 'DIAG_OST_MISSING'
        })
        

        // 4. 清单 URL 连通性（仅 OST）
        if (engine === 'ost') {
            const urlOk = manifestProbeResult?.url != null
            results.push({
                name: 'DIAG_MANIFEST_URL',
                ok: urlOk,
                message: urlOk 
                    ? 'DIAG_URL_OK'
                    : 'DIAG_URL_FAIL'
            })
        }
        
        // 5. 游戏配置检测
        // fix45: pluginDirName 声明随 LUA_DIR 块一并迁入此处（该块依赖它）
        const pluginDirName = this.PLUGIN_DIR_NAME_OST
        const luaDir = path.join(ModeSwitchService.getActiveRoot(steamPath), 'config', pluginDirName)
        let hasLua = false
        if (fs.existsSync(luaDir)) {
            try {
                hasLua = fs.readdirSync(luaDir).some(f => f.endsWith('.lua'))
            } catch {}
        }
        results.push({
            name: 'DIAG_GAME_CFG',
            ok: hasLua,
            message: hasLua 
                ? 'DIAG_GAME_CFG_OK'
                : 'DIAG_GAME_CFG_NOT_READY'
        })
        
        // TC-P13: 云存档存储统一检查(Steam 根有旧数据或旧日志 -> 亮灯提示, 弹窗右下角一键迁移)
        const legacyCrDir = path.join(steamPath, 'cloud_redirect')
        const legacyCrLog = path.join(steamPath, 'cloud_redirect.log')
        const hasLegacyCr = fs.existsSync(legacyCrDir) || fs.existsSync(legacyCrLog)
        results.push({
            name: 'DIAG_CR_STORAGE_LEGACY',
            ok: !hasLegacyCr,
            message: hasLegacyCr ? 'DIAG_CR_STORAGE_MIGRATE' : 'DIAG_CR_STORAGE_OK',
        })

        // 引擎冲突检测：纯净模式下 Steam 根目录严禁残留 xinput1_4 等劫持文件
        const isPureMode = ModeSwitchService.getMode() === 'pure'
        const hasEngineConflict = isPureMode && fs.existsSync(path.join(steamPath, 'xinput1_4.dll'))
        results.push({
            name: 'DIAG_ENGINE_CONFLICT',
            ok: !hasEngineConflict,
            message: hasEngineConflict ? 'DIAG_ENGINE_CONFLICTED' : 'DIAG_ENGINE_CLEAN',
        })

        // 指挥官硬要求：防止用户把 TC 也安装到 Program Files 下（黄字警告，出现在系统自检上）
        const appPath = process.execPath || (app ? app.getAppPath() : '')
        const isProtectedDir = /program files/i.test(appPath)
        results.push({
            name: 'DIAG_TC_INSTALL_DIR',
            ok: !isProtectedDir,
            warning: isProtectedDir,
            message: isProtectedDir ? 'DIAG_TC_DIR_PROTECTED_WARN' : 'DIAG_TC_DIR_OK',
        })

        // 纯净模式影子隔离洁净度与看门狗状态检测
        const modulesDir = path.join(ModeSwitchService.ostDir, 'modules')
        const strayFolders = ['config', 'logs', 'appcache'].filter(d => fs.existsSync(path.join(modulesDir, d)))
        const watchdogClean = strayFolders.length === 0
        results.push({
            name: 'DIAG_OST_WATCHDOG',
            ok: watchdogClean,
            message: watchdogClean ? 'DIAG_WATCHDOG_CLEAN' : 'DIAG_WATCHDOG_LEAK',
        })

        // 核心收敛文案（排除仅为 warning 的项）
        const allOk = results.every(r => r.ok || r.warning)
        if (!allOk) {
            results.push({
                name: 'DIAG_ADVICE',
                ok: false,
                message: 'DIAG_ADVICE_DEPLOY',
            })
        }
        
        return results
    }

    // ================= [ Lua 自动更新开关 ] =================

    static toggleLuaAutoUpdate(steamPath: string, appId: string, enabled: boolean, engine: 'ost' = 'ost'): boolean {
        const pluginDirName = this.PLUGIN_DIR_NAME_OST;
        const activeLuaDir = path.join(ModeSwitchService.getActiveRoot(steamPath), 'config', pluginDirName);
        const activeLuaPath = path.join(activeLuaDir, `${appId}.lua`);
        const legacyLuaPath = path.join(steamPath, 'config', pluginDirName, `${appId}.lua`);
        let luaPath = activeLuaPath;
        if (!fs.existsSync(activeLuaPath) && fs.existsSync(legacyLuaPath)) {
            try {
                fs.mkdirSync(activeLuaDir, { recursive: true });
                fs.copyFileSync(legacyLuaPath, activeLuaPath);
                fs.unlinkSync(legacyLuaPath);
            } catch { luaPath = legacyLuaPath; }
        }
        
        if (!fs.existsSync(luaPath)) {
            console.warn(`[TitanProtocol] Lua 文件不存在，跳过切换: ${luaPath}`);
            return false;
        }
        
        try {
            const content = fs.readFileSync(luaPath, 'utf-8');
            const lines = content.split(/\r?\n/);
            
            const processedLines = lines.map(line => {
                if (line.includes('setManifestid')) {
                    const isCommented = line.trim().startsWith('--');
                    if (enabled) {
                        if (!isCommented) return '-- ' + line;
                    } else {
                        if (isCommented) return line.replace(/^(\s*)--\s*/, '$1');
                    }
                }
                return line;
            });

            if (!enabled && !processedLines.some(l => l.includes('setManifestid'))) {
                const lockLines = this.buildManifestLockLines(steamPath, appId);
                if (lockLines.length === 0) {
                    console.warn(`[TitanProtocol] 无 manifest 数据源，无法锁定: ${appId}`);
                    return false;
                }
                processedLines.push(...lockLines);
            }

            fs.writeFileSync(luaPath, processedLines.join('\n'), 'utf-8');
            console.log(`[TitanProtocol] 自动更新已${enabled ? '开启' : '关闭'}: ${appId}.lua`);
            return true;
        } catch (e) {
            console.error('[TitanProtocol] 切换 Lua 自动更新失败:', e);
            return false;
        }
    }

    private static buildManifestLockLines(steamPath: string, appId: string): string[] {
        const entries: Array<{ depotId: string; manifestId: string }> = []
        try {
            const cachePath = path.join(Db.getDataRoot(), 'cache', 'manifest_cache.json')
            if (fs.existsSync(cachePath)) {
                const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
                const list = cache?.[appId]
                if (Array.isArray(list)) {
                    for (const e of list) {
                        if (e && /^\d+$/.test(String(e.depotId)) && /^\d+$/.test(String(e.manifestId))) {
                            entries.push({ depotId: String(e.depotId), manifestId: String(e.manifestId) })
                        }
                    }
                }
            }
        } catch { /* cache 读取失败静默走 acf 兜底 */ }
        if (entries.length === 0) {
            try {
                const acfPath = path.join(steamPath, 'steamapps', `appmanifest_${appId}.acf`)
                if (fs.existsSync(acfPath)) {
                    const content = fs.readFileSync(acfPath, 'utf-8')
                    const re = /"(\d+)"\s*\{[^}]*"manifest"\s*"(\d+)"[^}]*\}/g
                    let m: RegExpExecArray | null
                    while ((m = re.exec(content)) !== null) {
                        entries.push({ depotId: m[1], manifestId: m[2] })
                    }
                }
            } catch { /* acf 兜底失败返回空 */ }
        }
        return entries.map(e => `setManifestid(${e.depotId}, "${e.manifestId}")`)
    }

    // ================= [ 核心部署与清理流程 ] =================

    private static translateError(e: any): string {
        const msg = String(e?.message || e || '').toLowerCase();
        
        if (msg.includes('enoent') || msg.includes('no such file') || msg.includes('未找到')) {
            return 'ERR_LOCAL_COMPONENT_MISSING';
        }
        if (msg.includes('network') || msg.includes('timeout') || msg.includes('断开')) {
            return 'ERR_ALL_NODES_DOWN';
        }
        if (msg.includes('eacces') || msg.includes('eperm') || msg.includes('access denied')) {
            return 'ERR_DIR_PERMISSION';
        }
        if (msg.includes('ebusy') || msg.includes('locked')) {
            return 'ERR_STEAM_LOCKING';
        }
        return 'ERR_UNKNOWN_DEPLOY:' + msg;
    }

    private static async killSteam(): Promise<void> {
        try {
            this.broadcast(null, 'protocol.STATUS_KILL_STEAM', 'clean');
            const execAsync = util.promisify(exec);
            
            await execAsync('taskkill /F /IM steam.exe /T');
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
        }
    }
    
    static releaseLock(key: string): void {
        if (this.deploymentLocks.has(key)) {
            const lockAge = Date.now() - (this.deploymentLocks.get(key) || 0);
            console.log(`[TitanProtocol] 强制释放锁: ${key} (已持有: ${lockAge}ms)`);
            this.deploymentLocks.delete(key);
        }
    }

    static async forceRestore(steamPath: string): Promise<ProtocolResult> {
        try {
            this.broadcast(10, 'protocol.STATUS_LOCATE_STEAM', 'init');
            
            await this.killSteam();
            
            // 改造：CR 钉死 ostDir，绝对不从 Steam 根误杀；增加 opensteamtool.toml.bak 存量清理
            const targetFiles = [
                'xinput1_4.dll', 'xinput1_4.dll.bak',
                'dwmapi.dll', 'dwmapi.dll.bak',
                'OpenSteamTool.dll', 'OpenSteamTool.dll.bak',
                'opensteamtool.toml', 'opensteamtool.toml.bak',
                'cloud_redirect.log'
            ];
            
            let deletedFiles = 0;
            for (const file of targetFiles) {
                const filePath = path.join(steamPath, file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    deletedFiles++;
                }
            }
            this.broadcast(40, `protocol.STATUS_CLEAN_COMPONENTS:${deletedFiles}`, 'clean');

            const thirdPartyDirs = ['stplug-in', this.PLUGIN_DIR_NAME_OST, 'opensteamtool', 'cloud_redirect', 'localcloud'];
            for (const dirName of thirdPartyDirs) {
                const tpDir = path.join(steamPath, 'config', dirName);
                const rootTpDir = path.join(steamPath, dirName);
                if (fs.existsSync(tpDir)) fs.rmSync(tpDir, { recursive: true, force: true });
                if (fs.existsSync(rootTpDir)) fs.rmSync(rootTpDir, { recursive: true, force: true });
            }
            this.broadcast(70, 'protocol.STATUS_CLEAN_MATRIX', 'clean');

            // TC-P7: 模式感知恢复 -- 纯净模式保留 TC\ost 工件, 扫净 Steam 根后关闭分流标记
            if (ModeSwitchService.getMode() === 'pure') {
                this.broadcast(85, 'protocol.STATUS_DIVERSION_OFF', 'clean');
                ModeSwitchService.setTomlKey(path.join(ModeSwitchService.ostDir, 'opensteamtool.toml'), 'diversion', 'enabled', 'false');
            }

            this.broadcast(100, 'protocol.STATUS_RESTORE_DONE', 'done');
            return { success: true, msg: 'FORCE_RESTORE_OK' };

        } catch (e: any) {
            this.broadcast(0, `protocol.STATUS_CLEAN_FAIL:${this.translateError(e)}`, 'error');
            return { success: false, msg: this.translateError(e) };
        }
    }

    static async uninstall(steamPath: string, appId: string, _targetId?: string | number, engine: 'ost' = 'ost'): Promise<ProtocolResult> {
        try {
            this.broadcast(10, `protocol.STATUS_UNINSTALL_INIT:${appId}`, 'init');

            const pluginDirName = this.PLUGIN_DIR_NAME_OST;
            const artifactRoot = ModeSwitchService.getActiveRoot(steamPath);
            const pluginDir = path.join(artifactRoot, 'config', pluginDirName);
            const depotDir = path.join(steamPath, 'depotcache');
            const luaPath = path.join(pluginDir, `${appId}.lua`);
            const legacyLuaPath = path.join(steamPath, 'config', pluginDirName, `${appId}.lua`);

            const ledger = new Map<string, string>();

            const cachePath = path.join(Db.getDataRoot(), 'cache', 'manifest_cache.json');
            if (fs.existsSync(cachePath)) {
                try {
                    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
                    const entries = cache[appId];
                    if (Array.isArray(entries)) {
                        for (const entry of entries) {
                            if (entry.depotId && entry.manifestId) ledger.set(entry.depotId, entry.manifestId);
                        }
                    }
                } catch {}
            }

            if (fs.existsSync(luaPath)) {
                const content = fs.readFileSync(luaPath, 'utf-8');
                const re = /setManifestid\s*\(\s*(\d+)\s*,\s*"([^"]+)"\s*(?:,\s*\d+\s*)?\)/g;
                let m: RegExpExecArray | null;
                while ((m = re.exec(content)) !== null) {
                    ledger.set(m[1], m[2]);
                }
                if (fs.existsSync(luaPath)) { try { fs.unlinkSync(luaPath) } catch { } }
                if (fs.existsSync(legacyLuaPath)) { try { fs.unlinkSync(legacyLuaPath) } catch { } }
                this.broadcast(40, `protocol.STATUS_CLEAN_LUA:${appId}`, 'clean');
            }

            const acfPath = path.join(steamPath, 'steamapps', `appmanifest_${appId}.acf`);
            if (fs.existsSync(acfPath)) {
                const content = fs.readFileSync(acfPath, 'utf-8');
                const re = /"(\d+)"\s*\{[^}]*"manifest"\s*"(\d+)"[^}]*\}/g;
                let m: RegExpExecArray | null;
                while ((m = re.exec(content)) !== null) {
                    ledger.set(m[1], m[2]);
                }
            }

            let manifestRemoved = 0;
            for (const [depotId, manifestId] of ledger) {
                const f = path.join(depotDir, `${depotId}_${manifestId}.manifest`);
                if (fs.existsSync(f)) {
                    fs.unlinkSync(f);
                    manifestRemoved++;
                }
            }

            this.broadcast(70, `protocol.STATUS_CLEAN_MANIFEST:${manifestRemoved}`, 'clean');
            this.broadcast(100, 'protocol.STATUS_UNINSTALL_DONE', 'done');
            return { success: true, msg: 'UNINSTALL_OK' };

        } catch (e: any) {
            this.broadcast(0, `protocol.STATUS_UNINSTALL_FAIL:${this.translateError(e)}`, 'error');
            return { success: false, msg: this.translateError(e) };
        }
    }

    static async deploy(steamPath: string, config: ProtocolConfig, engine: 'ost' = 'ost'): Promise<ProtocolResult> {
        if (ModeSwitchService.isBusy()) {
            this.broadcast(0, 'protocol.STATUS_MODE_SWITCHING', 'error');
            return { success: false, msg: 'MODE_SWITCHING' };
        }

        this.cleanExpiredLocks();
        
        const lockKey = this.deploymentLocks.has(config.app_id) ? config.app_id : this.GLOBAL_LOCK_KEY;
        if (this.deploymentLocks.has(lockKey)) {
            if (Date.now() - this.deploymentLocks.get(lockKey)! < this.LOCK_TTL_MS) {
                return { success: false, msg: `DEPLOY_BUSY: Task or Global Repair running.` };
            }
            this.deploymentLocks.delete(lockKey);
        }

        this.deploymentLocks.set(config.app_id, Date.now());

        const taskDir = path.join(this.TEMP_ROOT, `deploy_${config.app_id}_${Date.now()}`);
        
        // 关键时机：记录部署前 Steam 是否已在运行（判断是否错过 OST 挂载时机）
        const isSteamRunningBeforeDeploy = await ModeSwitchService.isSteamAlive();

        // 存量自愈：旧时代 dwmapi 劫持已废弃，部署时检测到则静默清理
        for (const deadFile of ['dwmapi.dll', 'dwmapi.dll.bak']) {
            const deadPath = path.join(steamPath, deadFile);
            if (fs.existsSync(deadPath)) {
                try { fs.unlinkSync(deadPath); } catch {}
            }
        }

        // 绑定系统自检同款 Pattern 对齐检测与静默自愈（复用 PatternSyncService 现成能力）
        if (engine === 'ost') {
            try {
                const alignCheck = PatternSyncService.diagnoseAlignment(steamPath);
                if (!alignCheck.ok) {
                    this.broadcast(8, 'protocol.STATUS_HEAL_PATTERN', 'sync');
                    await PatternSyncService.validatePatterns();
                }
            } catch (err: any) {
                console.warn('[TitanProtocol] 部署前 Pattern 对齐自愈异常:', err?.message);
            }
        }

        try {
            if (!fs.existsSync(taskDir)) fs.mkdirSync(taskDir, { recursive: true });
            
            const pluginDirName = this.PLUGIN_DIR_NAME_OST;

            // TC-P32: 源头收敛(Single Source of Truth) -- 纯净模式默认工件剔除 xinput，且收敛过滤入参
            const fallbackDlls = ModeSwitchService.getMode() === 'pure'
                ? ['OpenSteamTool.dll', 'cloud_redirect.dll']
                : ['xinput1_4.dll', 'OpenSteamTool.dll', 'cloud_redirect.dll'];
            const rawTargetDlls = config.target_dlls && config.target_dlls.length > 0 ? config.target_dlls : fallbackDlls;
            const effectiveTargetDlls = ModeSwitchService.getMode() === 'pure'
                ? rawTargetDlls.filter(d => d.toLowerCase() !== 'xinput1_4.dll')
                : rawTargetDlls;

            const toolMirrors = config.tool_mirrors && config.tool_mirrors.length > 0 ? config.tool_mirrors : (config.tool_url ? [config.tool_url] : []);
            let manifestMirrors = config.manifest_mirrors && config.manifest_mirrors.length > 0 ? config.manifest_mirrors : (config.manifest_url ? [config.manifest_url] : []);

            let skipEnvironmentSetup = false;
            
            if (config.fast_mode) {
                this.broadcast(5, 'protocol.STATUS_CHECK_ENV', 'check');
                if (this.checkEnvironment(steamPath, effectiveTargetDlls, pluginDirName, engine, config.expected_engine_version)) {
                    skipEnvironmentSetup = true;
                    this.broadcast(10, 'protocol.STATUS_ENV_GREEN', 'check');
                }
            }

            if (!skipEnvironmentSetup) {
                const toolsDir = ModeSwitchService.toolsDir;
                if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });
                const toolZipPath = path.join(toolsDir, 'tool.zip');
                
                // 优先检查本地 toolsDir 工具包缓存是否齐全
                let cacheHit = this.checkToolsCache(toolsDir, effectiveTargetDlls, engine, config.expected_engine_version);

                // 若文件未齐全但本地已存在 tool.zip，先尝试本地解压自愈
                if (!cacheHit && fs.existsSync(toolZipPath)) {
                    try {
                        await ArchiveService.extract(toolZipPath, toolsDir);
                        cacheHit = this.checkToolsCache(toolsDir, effectiveTargetDlls, engine, config.expected_engine_version);
                    } catch {}
                }

                // 仅当本地缓存彻底不存在时，才走网络竞速下载
                if (!cacheHit) {
                    if (toolMirrors.length === 0) throw new Error('ERR_NO_TOOL_NODE');
                    await this.downloadWithMirrors(toolMirrors, toolZipPath, 'LABEL_TOOL_PACK');
                    this.broadcast(40, 'protocol.STATUS_EXTRACT_COMPONENTS', 'extract');
                    await ArchiveService.extract(toolZipPath, toolsDir);
                    if (config.expected_engine_version && config.expected_engine_version > 0) {
                        try {
                            fs.writeFileSync(path.join(toolsDir, 'tool_version.json'), JSON.stringify({ version: config.expected_engine_version, ts: Date.now() }), 'utf-8');
                        } catch {}
                    }
                } else {
                    this.broadcast(40, 'protocol.STATUS_CACHE_HIT', 'check');
                }

                await this.killSteam();

                this.broadcast(60, 'protocol.STATUS_VERIFY_IO', 'install');
                const ostArtifactRoot = ModeSwitchService.getRootSync(steamPath) || steamPath;

                // TC-P32: 纯净模式下执行双根物理净化(tc/ost 与 Steam 根)，彻底铲除历史 xinput 及其备份残留 (带退避重试)
                if (ModeSwitchService.getMode() === 'pure') {
                    for (const f of ['xinput1_4.dll', 'xinput1_4.dll.bak']) {
                        await this.retryFileOpAsync(() => {
                            const ostTarget = path.join(ostArtifactRoot, f);
                            if (fs.existsSync(ostTarget)) fs.unlinkSync(ostTarget);
                            const steamTarget = path.join(steamPath, f);
                            if (fs.existsSync(steamTarget)) fs.unlinkSync(steamTarget);
                        });
                    }
                }

                // 改造：CR dll 恒装 ostDir，从 rootDlls 中剔除，两模式下绝对不向 Steam 根写入 CR
                const rootDlls = effectiveTargetDlls.filter(d => d.toLowerCase() !== 'cloud_redirect.dll');
                await this.installDLL(toolsDir, ostArtifactRoot, rootDlls);
                if (effectiveTargetDlls.some(d => d.toLowerCase() === 'cloud_redirect.dll')) {
                    await this.installDLL(toolsDir, ModeSwitchService.ostDir, ['cloud_redirect.dll']);
                }
                
                // toml 纯覆盖安装（删去 bak）
                await this.installToml(toolsDir, ostArtifactRoot, engine);
                // template toml overwrote mode/cloud flags: rewrite both to current state
                const tomlNow = ModeSwitchService.getActiveTomlPath(steamPath);
                ModeSwitchService.setTomlKey(tomlNow, 'diversion', 'enabled', ModeSwitchService.getMode() === 'pure' ? 'true' : 'false');
                const cloudEnabled = Db.get<boolean>('user_pref_cloud_save') ?? true;
                CloudSaveService.setTomlCloudEnabled(steamPath, cloudEnabled);

                // 存量云存档自动兜底平滑迁移：部署完成后若检测到 Steam 根残留，静默迁移入 TC/ost
                try {
                    const legacyCrDir = path.join(steamPath, 'cloud_redirect');
                    const legacyCrLog = path.join(steamPath, 'cloud_redirect.log');
                    if (fs.existsSync(legacyCrDir) || fs.existsSync(legacyCrLog)) {
                        await CloudSaveService.migrateCrStorage();
                    }
                } catch {}

                // 全量更新工具包成功后，持久化对齐的引擎版号
                if (config.expected_engine_version && config.expected_engine_version > 0) {
                    const oldCfg = Db.get<any>(`engine_config_${engine}`) || {};
                    Db.set(`engine_config_${engine}`, {
                        ...oldCfg,
                        version: config.expected_engine_version,
                        updated_at: Date.now()
                    });
                }
            }

            if (manifestMirrors.length > 0) {
                const manifestZipPath = path.join(taskDir, 'manifest.zip');
                const manifestDir = path.join(taskDir, 'manifest_extract');
                
                await this.downloadWithMirrors(manifestMirrors, manifestZipPath, '清单协议矩阵');
                
                this.broadcast(75, 'protocol.STATUS_EXTRACT_MANIFEST', 'extract');
                await ArchiveService.extract(manifestZipPath, manifestDir);

                await this.distributeResources(manifestDir, steamPath, pluginDirName, config.app_id);
            } else {
                this.broadcast(80, 'protocol.STATUS_NO_MANIFEST', 'init');
            }

            this.cleanupSync(taskDir);
            this.broadcast(100, 'protocol.STATUS_DEPLOY_DONE', 'done');
            DepotKeyService.applyToDeploy(steamPath, config.app_id, engine); 
            return { success: true, msg: 'DEPLOY_OK', path: steamPath, needRestartSteam: false };

        } catch (e: any) {
            this.cleanupSync(taskDir);
            this.broadcast(0, `protocol.STATUS_DEPLOY_FAIL:${this.translateError(e)}`, 'error');
            return { success: false, msg: this.translateError(e) };
        } finally {
            this.deploymentLocks.delete(config.app_id);
        }
    }

    private static cleanExpiredLocks(): void {
        const now = Date.now();
        for (const [appId, lockTime] of this.deploymentLocks.entries()) {
            if (now - lockTime > this.LOCK_TTL_MS) this.deploymentLocks.delete(appId);
        }
    }

    static hasActiveDeployment(): boolean {
        this.cleanExpiredLocks();
        return this.deploymentLocks.size > 0;
    }

    // 改造：CR 探测单独定向到 ostDir，并严格校验引擎版号对齐
    private static checkEnvironment(steamPath: string, targetDlls: string[], pluginDirName: string, engine: 'ost' = 'ost', expectedVersion?: number): boolean {
        if (!fs.existsSync(path.join(ModeSwitchService.getActiveRoot(steamPath), 'config', pluginDirName))) return false;
        if (!targetDlls || targetDlls.length === 0) return false;
        for (const dll of targetDlls) {
            const checkDir = dll.toLowerCase() === 'cloud_redirect.dll'
                ? ModeSwitchService.ostDir
                : ModeSwitchService.getActiveRoot(steamPath);
            if (!fs.existsSync(path.join(checkDir, dll))) return false;
        }
        if (!fs.existsSync(ModeSwitchService.getActiveTomlPath(steamPath))) return false;

        // 版号对齐校验：若指定了期望版号，且本地记录版号落后，则环境校验失败，强制全量拉取
        if (expectedVersion && expectedVersion > 0) {
            const localVer = Db.get<any>(`engine_config_${engine}`)?.version || 0;
            if (localVer < expectedVersion) {
                console.log(`[TitanProtocol] 引擎版号未对齐后端最新 (本地: v${localVer}, 期望: v${expectedVersion})，环境校验失败`);
                return false;
            }
        }
        return true;
    }

    private static checkToolsCache(toolsDir: string, targetDlls: string[], engine: 'ost' = 'ost', expectedVersion?: number): boolean {
        if (!fs.existsSync(toolsDir)) return false;
        for (const dll of targetDlls) {
            if (!this.findDllInDir(toolsDir, dll)) return false;
        }
        if (!fs.existsSync(path.join(toolsDir, 'opensteamtool.toml'))) return false;

        // 缓存版号校验：若期望版号高于缓存版号，旧缓存失效
        if (expectedVersion && expectedVersion > 0) {
            try {
                const verFile = path.join(toolsDir, 'tool_version.json');
                if (!fs.existsSync(verFile)) return false;
                const cachedVer = JSON.parse(fs.readFileSync(verFile, 'utf-8'))?.version || 0;
                if (cachedVer < expectedVersion) return false;
            } catch {
                return false;
            }
        }
        return true;
    }

    private static async downloadWithMirrors(mirrors: string[], dest: string, label: string): Promise<void> {
        if (mirrors.length === 0) throw new Error(`ERR_NO_NODE:${label}`);
        this.broadcast(null, JSON.stringify({ key: 'protocol.STATUS_DOWNLOAD_NODE', params: { node: `NODE_RACING:${mirrors.length}`, label } }), 'download');
        await RacingDownloader.raceSmallFile(mirrors, { destPath: dest, label });
    }

    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static async retryFileOpAsync<T>(op: () => T): Promise<T> {
        let lastErr: any;
        for (let i = 0; i < 3; i++) {
            try {
                return op();
            } catch (e: any) {
                lastErr = e;
                const msg = String(e?.message || e?.code || '').toLowerCase();
                if (i < 2 && (msg.includes('ebusy') || msg.includes('eperm') || msg.includes('eacces') || msg.includes('locked'))) {
                    await this.delay(500 * (i + 1));
                    continue;
                }
                throw e;
            }
        }
        throw lastErr;
    }

    // 改造：公开为 static 供外部同构调用，纯覆盖部署，彻底删去 .bak 备份分支
    static async installToml(sourceDir: string, steamPath: string, engine: 'ost' = 'ost'): Promise<void> {
        const sourceToml = path.join(sourceDir, 'opensteamtool.toml');
        const targetToml = ModeSwitchService.getActiveTomlPath(steamPath);

        if (!fs.existsSync(sourceToml)) {
            console.warn('[TitanProtocol] 源 toml 不存在，跳过: ' + sourceToml);
            return;
        }

        const targetDir = path.dirname(targetToml);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        await this.retryFileOpAsync(() => {
            fs.copyFileSync(sourceToml, targetToml);
        });

        console.log('[TitanProtocol] opensteamtool.toml 已纯覆盖部署');
    }

    private static async distributeResources(sourceDir: string, steamRoot: string, pluginDirName: string, appId?: string) {
        const pluginDir = path.join(ModeSwitchService.getActiveRoot(steamRoot), 'config', pluginDirName);
        const depotDir = path.join(steamRoot, 'depotcache');

        if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });
        if (!fs.existsSync(depotDir)) fs.mkdirSync(depotDir, { recursive: true });

        const manifestEntries: Array<{ depotId: string; manifestId: string; ts: number }> = [];
        const MANIFEST_RE = /^(\d+)_(\d+)\.manifest$/;

        const walkManifests = async (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                    await walkManifests(filePath);
                } else if (file.includes('_manifest') || file.endsWith('.manifest')) {
                    const m = file.match(MANIFEST_RE);
                    if (m) {
                        manifestEntries.push({ depotId: m[1], manifestId: m[2], ts: Date.now() });
                    }
                    await this.retryFileOpAsync(() => {
                        fs.copyFileSync(filePath, path.join(depotDir, file));
                    });
                }
            }
        };
        await walkManifests(sourceDir);

        if (manifestEntries.length > 0 && appId) {
            try {
                const cacheDir = path.join(Db.getDataRoot(), 'cache');
                if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
                const cachePath = path.join(cacheDir, 'manifest_cache.json');
                let cache: Record<string, Array<{ depotId: string; manifestId: string; ts: number }>> = {};
                if (fs.existsSync(cachePath)) {
                    try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch {}
                }
                cache[appId] = manifestEntries;
                fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
            } catch (e: any) {
                console.warn('[TitanProtocol] 部署写入 manifest_cache.json 失败:', e.message);
            }
        }

        const walkLua = async (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                if (fs.statSync(filePath).isDirectory()) {
                    await walkLua(filePath);
                } else if (file.endsWith('.lua')) {
                    await this.retryFileOpAsync(() => {
                        fs.copyFileSync(filePath, path.join(pluginDir, file));
                    });
                }
            }
        };
        await walkLua(sourceDir);
    }

    private static async installDLL(sourceDir: string, steamPath: string, targetDlls: string[]) {
        for (const dllName of targetDlls) {
            const sourceDllPath = this.findDllInDir(sourceDir, dllName);
            const targetDll = path.join(steamPath, dllName);

            if (sourceDllPath) {
                if (!fs.existsSync(steamPath)) {
                    fs.mkdirSync(steamPath, { recursive: true });
                }
                await this.retryFileOpAsync(() => {
                    fs.copyFileSync(sourceDllPath, targetDll);
                });
            }
        }
    }

    private static findDllInDir(dir: string, dllName: string): string | null {
        if (!fs.existsSync(dir)) return null;
        for (const file of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = this.findDllInDir(fullPath, dllName);
                if (found) return found;
            } else if (file.toLowerCase() === dllName.toLowerCase()) {
                return fullPath;
            }
        }
        return null;
    }

    private static cleanupSync(dir: string) {
        if (fs.existsSync(dir)) {
            try { 
                fs.rmSync(dir, { recursive: true, force: true }); 
            } catch (e: any) {
                console.warn(`[TitanProtocol] 临时目录残留清理失败: ${e.message}，已忽略`);
            }
        }
    }

    private static broadcast(progress: number | null, msg: string, step: string) {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.send('titan:protocol-log', { step, progress: progress ?? -1, msg });
        }
    }
}