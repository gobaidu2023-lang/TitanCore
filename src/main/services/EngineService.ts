import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import { Db } from '../db'
import { SteamDetector } from './SteamDetector'
import { titanFetch } from '../TitanNet'
import { TitanProtocol } from './TitanProtocol'
import { ModeSwitchService } from './ModeSwitchService'
import { CloudSaveService } from './CloudSaveService'
import { SteamLaunchService } from './SteamLaunchService'

export class EngineService {

  private static manifestProbeResult: { url: string; node: string } | null = null;

  static getManifestProbeResult(): { url: string; node: string } | null {
    return this.manifestProbeResult;
  }

  // 【新增】引擎归一化：后端 ST 已下线，本地持久化的任何非 OST 引擎选择一律强制修正回 OST。
  // 只修正参数来源（unlock_engine），不删除任何 ST 链路，ST 分支代码保留以备回滚。
  // 在 check / initEngineConfig / silentCheckUpdate 三个入口调用，保证不变量：
  // "unlock_engine 一旦读出必为 'ost'"。
  private static normalizeEngine(): 'ost' {
    const current = Db.get<string>('unlock_engine') || 'ost';
    if (current !== 'ost') {
      console.warn(`[EngineService] 检测到已下线的引擎选择 "${current}"，已强制修正为 OST`);
      Db.set('unlock_engine', 'ost');
    }
    return 'ost';
  }

  static async check(engine: 'ost' = 'ost'): Promise<{ ready: boolean; version: number; path: string | null }> {
    const currentEngine = this.normalizeEngine()
    const config = Db.get<any>(`engine_config_${currentEngine}`)
    const version = config?.version || 0
    const isReady = (version > 0) && (config?.engine_status === 'ready') && (currentEngine === engine)
    return { ready: isReady, version, path: null }
  }

  private static getUpdateCheckUrl(serverUrl: string, engine: string): string {
    return `${serverUrl}/titan/update_check.php?action=get_engine_config&engine=${engine}`
  }

  private static saveEngineConfig(engine: 'ost', remoteVersion: number, remoteConfig: any, toolMirrors?: string[], statusOverride?: string): void {
    const mirrors = toolMirrors || remoteConfig.mirrors || (remoteConfig.tool_url ? [remoteConfig.tool_url] : []);
    const resolvedStatus = statusOverride || (remoteVersion > 0 ? (remoteConfig.engine_status || 'ready') : 'pending');
    Db.set(`engine_config_${engine}`, {
      version: remoteVersion,
      engine_status: resolvedStatus,
      tool_url: remoteConfig.tool_url,
      mirrors: mirrors,
      target_dlls: remoteConfig.target_dlls,
      plugin_dir: remoteConfig.plugin_dir,
      updated_at: Date.now()
    });
  }

  private static getManifestNodeMap(): Record<string, string> {
    const fromDb = Db.get<Record<string, string>>('manifest_node_map');
    if (fromDb && Object.keys(fromDb).length >= 3) return fromDb;
    return {
      opensteamtool: process.env.TITAN_MANIFEST_NODE_1 || '',
      wudrm: process.env.TITAN_MANIFEST_NODE_2 || '',
      steamrun: process.env.TITAN_MANIFEST_NODE_3 || ''
    };
  }

  static async initEngineConfig(): Promise<void> {
    const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
    if (!serverUrl) {
      console.warn('[EngineService] Server URL not ready, skipping engine config init')
      return
    }

    // 【新增】启动即归一化：被困在 ST 的用户从这里开始被拉回 OST
    this.normalizeEngine();

    for (const engine of ['ost'] as const) {
      try {
        const res = await titanFetch(this.getUpdateCheckUrl(serverUrl, engine), {
          method: 'GET',
          headers: { 'User-Agent': 'TitanCore/2.0' }
        })

        if (!res.ok) continue
        const remoteConfig = await res.json()
        // 【2026-09-11】ST 已下线，此后端恒返回 success=false，此处静默跳过属预期行为
        if (!remoteConfig || !remoteConfig.success) continue

        const remoteVersion = remoteConfig.engine_version || 0
        const localConfig = Db.get<any>(`engine_config_${engine}`)

        if (!localConfig) {
          this.saveEngineConfig(engine, 0, remoteConfig, undefined, 'pending')
          console.log(`[EngineService] Engine ${engine} config initialized v0 (remote v${remoteVersion})`)
        } else {
          const deployedVersion = localConfig.version || 0
          const syncedStatus = deployedVersion > 0 ? (remoteConfig.engine_status || 'ready') : 'pending'
          this.saveEngineConfig(engine, deployedVersion, remoteConfig, undefined, syncedStatus)
          console.log(`[EngineService] Engine ${engine} status synced, deployed v${deployedVersion}`)
        }

        if (remoteConfig.manifest_nodes && typeof remoteConfig.manifest_nodes === 'object') {
          Db.set('manifest_node_map', remoteConfig.manifest_nodes);
          console.log('[EngineService] manifest_nodes updated from remote');
        }

        // 后台静默预热本地 %AppData%\titan-core\tools 缓存，确保离线/切换模式时工具包随时就绪
        TitanProtocol.prefetchToolsCache(remoteConfig).catch(() => {})

      } catch (e: any) {
        console.warn(`[EngineService] Init engine ${engine} config failed:`, e.message)
      }
    }

    await this.probeManifestNodes();
  }

  public static async probeManifestNodes(): Promise<void> {
    const nodeMap = this.getManifestNodeMap();
    const nodeNames = ['opensteamtool', 'wudrm', 'steamrun'] as const;
    const TEST_GID = '123456789012345';

    this.manifestProbeResult = null;

    const results = await Promise.allSettled(
      nodeNames.map(async (name) => {
        if (!nodeMap[name]) return { name, isConnected: false };
        const probeUrl = `${nodeMap[name]}/${TEST_GID}`;
        const isConnected = await this.probeNode(probeUrl, 5000);
        return { name, isConnected };
      })
    );

    for (const name of nodeNames) {
      const hit = results.find(
        (r) => r.status === 'fulfilled' && r.value.name === name && r.value.isConnected
      );
      if (hit) {
        this.manifestProbeResult = { url: nodeMap[name], node: name };
        break;
      }
    }

    Db.set('manifest_probe_cache', this.manifestProbeResult);

    if (!this.manifestProbeResult) {
      console.warn('[EngineService] 所有 manifest 节点无法连接');
    }
  }

  private static async probeNode(url: string, timeoutMs: number): Promise<boolean> {
    try {
      const res = await Promise.race([
        titanFetch(url),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        )
      ]) as Response;
      return res.status > 0 && res.status < 600;
    } catch (e) {
      return false;
    }
  }

  private static lastSilentCheck: { ts: number; engine: string; result: any } | null = null
  static clearUpdateCheckCache(): void { this.lastSilentCheck = null }

  static async silentCheckUpdate(_engine: 'ost' = 'ost'): Promise<{ hasUpdate: boolean; version?: number; engine?: string; msg?: string; remoteConfig?: any }> {
    // 入口归一化：更新检查只针对 OST 执行
    const engine = this.normalizeEngine()

    const now = Date.now()
    if (this.lastSilentCheck && (now - this.lastSilentCheck.ts < 60000) && this.lastSilentCheck.engine === engine) {
      return this.lastSilentCheck.result
    }

    try {
      const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
      if (!serverUrl) return { hasUpdate: false }

      const res = await titanFetch(this.getUpdateCheckUrl(serverUrl, engine), {
        method: 'GET',
        headers: { 'User-Agent': 'TitanCore/2.0' }
      })

      if (!res.ok) return { hasUpdate: false }
      const remoteConfig = await res.json()
      if (!remoteConfig || !remoteConfig.success) return { hasUpdate: false }

      const remoteVersion = remoteConfig.engine_version || 0
      const localState = await this.check(engine)

      // 首次安装尚未部署(localState.version === 0)时不弹窗提示引擎更新，仅回传远端版本供部署按需拉取
      const hasUpdate = localState.version > 0 && remoteVersion > localState.version
      const result = hasUpdate
        ? { hasUpdate: true, version: remoteVersion, engine, remoteConfig }
        : { hasUpdate: false, version: remoteVersion, engine, remoteConfig }
      this.lastSilentCheck = { ts: now, engine, result }
      return result
    } catch (e: any) {
      console.warn(`[EngineService] Silent check failed:`, e.message)
      return { hasUpdate: false, msg: e.message }
    }
  }

  // TC-P23: 强制拉取最新引擎工具包(模式切换缺包时调用; fetch+deploy 归一到服务层, 不在胶水层拼)
  static async pullLatest(_engine: 'ost' = 'ost', allowDuringModeSwitch = false): Promise<{ success: boolean; error?: string }> {
    try {
      const engine = this.normalizeEngine()
      const serverUrl = Db.get<any>('app_seed_config')?.serverUrl
      if (!serverUrl) return { success: false, error: 'ERR_SERVER_REQUIRED' }
      const res = await titanFetch(this.getUpdateCheckUrl(serverUrl, engine), {
        method: 'GET', headers: { 'User-Agent': 'TitanCore/2.0' }
      })
      if (!res.ok) return { success: false, error: 'ERR_GATEWAY_EXCEPTION' }
      const remoteConfig = await res.json()
      if (!remoteConfig || !remoteConfig.success) return { success: false, error: 'ERR_GATEWAY_EXCEPTION' }
      const detectRes = await SteamDetector.detect()
      if (!detectRes?.path) return { success: false, error: 'ERR_STEAM_MISSING' }

      // 存量自愈：旧时代 dwmapi 劫持已废弃，引擎更新时静默清理
      for (const dead of ['dwmapi.dll', 'dwmapi.dll.bak']) {
        const p = path.join(detectRes.path, dead)
        if (fs.existsSync(p)) {
          try { fs.unlinkSync(p) } catch {}
        }
      }
      const mirrors = remoteConfig.mirrors || (remoteConfig.tool_url ? [remoteConfig.tool_url] : [])
      const deployRes = await TitanProtocol.deploy(detectRes.path, {
        app_id: 'SYSTEM_ENGINE',
        tool_url: remoteConfig.tool_url,
        tool_mirrors: mirrors,
        target_dlls: remoteConfig.target_dlls || ['xinput1_4.dll', 'OpenSteamTool.dll', 'cloud_redirect.dll'],
        fast_mode: false,
        expected_engine_version: remoteConfig.engine_version || 0,
        allow_during_mode_switch: allowDuringModeSwitch
      }, 'ost')
      if (deployRes.success) {
        this.saveEngineConfig('ost', remoteConfig.engine_version || 0, remoteConfig, mirrors, 'ready')
        EngineService.clearUpdateCheckCache()
      }
      return { success: deployRes.success === true, error: deployRes.success ? undefined : (deployRes.msg || 'DEPLOY_FAIL') }
    } catch (e: any) {
      return { success: false, error: TitanProtocol.translateError(e, 'ERR_UNKNOWN') }
    }
  }
}

export function registerEngineService() {
  ipcMain.removeHandler('engine:check')
  ipcMain.handle('engine:check', async () => await EngineService.check('ost'))

  ipcMain.removeHandler('engine:silent-check')
  ipcMain.handle('engine:silent-check', async () => await EngineService.silentCheckUpdate('ost'))

  ipcMain.removeHandler('engine:apply-latest-update')
  ipcMain.handle('engine:apply-latest-update', async () => {
    const res = await EngineService.pullLatest('ost')
    if (res.success) {
      const newVer = Db.get<any>('engine_config_ost')?.version || 0
      return { success: true, msg: `SUCCESS_ENGINE_UPDATED:${newVer}` }
    }
    return { success: false, msg: res.error || 'DEPLOY_FAIL' }
  })

  ipcMain.removeHandler('engine:get-gate-status')
  ipcMain.handle('engine:get-gate-status', async () => {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes?.path
    if (!steamPath) return { success: false, msg: 'ERR_STEAM_MISSING' }

    const hasToml = fs.existsSync(ModeSwitchService.getActiveTomlPath(steamPath))
    const cloudEnabled = CloudSaveService.getTomlCloudEnabled(steamPath)
    const gateStatus = CloudSaveService.getActiveAccountGate(steamPath)

    return {
      success: true,
      data: {
        engineReady: hasToml,
        cloudEnabled,
        gateEnabled: gateStatus.enabled,
        gateIds: gateStatus.ids
      }
    }
  })

  ipcMain.removeHandler('engine:toggle-cloud-save')
  ipcMain.handle('engine:toggle-cloud-save', async (_e, enabled: boolean) => {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes?.path
    if (!steamPath) return { success: false, msg: 'ERR_STEAM_MISSING' }

    const ok = CloudSaveService.setTomlCloudEnabled(steamPath, enabled)
    if (ok) {
      Db.set('user_pref_cloud_save', enabled)
    }
    return { success: ok }
  })

  ipcMain.removeHandler('engine:scan-detailed-accounts')
  ipcMain.handle('engine:scan-detailed-accounts', async () => {
    const detectRes = await SteamDetector.detect()
    const steamPath = detectRes?.path
    if (!steamPath) return { success: false, accounts: [] }

    const accounts = CloudSaveService.getDetailedSteamAccounts(steamPath)
    return { success: true, accounts }
  })

  ipcMain.removeHandler('engine:save-account-gate')
  ipcMain.handle('engine:save-account-gate', async (_e, rawPayload: any) => {
    try {
      const detectRes = await SteamDetector.detect()
      const steamPath = detectRes?.path
      if (!steamPath) {
        return { success: false, msg: 'ERR_STEAM_MISSING' }
      }

      const isEnabled = !!rawPayload?.enabled
      const safeIds: string[] = Array.isArray(rawPayload?.ids)
        ? rawPayload.ids.map((id: any) => String(id))
        : []

      const ok = CloudSaveService.setAccountGate(steamPath, isEnabled, safeIds)
      return { success: ok, msg: ok ? 'OK' : 'ERR_FILE_WRITE_FAIL' }
    } catch (err: any) {
      console.error('[EngineService] engine:save-account-gate 调度异常:', err)
      return { success: false, msg: TitanProtocol.translateError(err, 'ERR_FILE_WRITE_FAIL') }
    }
  })

  ipcMain.removeHandler('ost:get-mode')
  ipcMain.handle('ost:get-mode', async () => ModeSwitchService.getMode())

  ipcMain.removeHandler('ost:switch-mode')
  ipcMain.handle('ost:switch-mode', async (_e, target: string) => {
    if (target !== 'pure' && target !== 'classic') {
      return { success: false, mode: ModeSwitchService.getMode(), error: 'BAD_ARG' }
    }
    try {
      return await ModeSwitchService.switchMode(target)
    } catch (e: any) {
      console.error('[EngineService] ost:switch-mode 抛出异常:', e)
      return { success: false, mode: ModeSwitchService.getMode(), error: TitanProtocol.translateError(e, 'ERR_ENGINE_SWITCH_FAIL') }
    }
  })

  ipcMain.removeHandler('ost:launch-steam')
  ipcMain.handle('ost:launch-steam', async () => {
    try {
      return await SteamLaunchService.launchSteam()
    } catch (e: any) {
      console.error('[EngineService] ost:launch-steam 异常:', e)
      return { success: false, error: TitanProtocol.translateError(e, 'ERR_LAUNCH_FAILED') }
    }
  })

  ipcMain.removeHandler('ost:launch-steam-native')
  ipcMain.handle('ost:launch-steam-native', async () => {
    try {
      return await SteamLaunchService.launchSteamNative()
    } catch (e: any) {
      console.error('[EngineService] ost:launch-steam-native 异常:', e)
      return { success: false, native: true, error: TitanProtocol.translateError(e, 'ERR_LAUNCH_FAILED') }
    }
  })

  ipcMain.removeHandler('ost:scan-anticheat-games')
  

  ipcMain.handle('ost:scan-anticheat-games', async () => {
    try {
      return await SteamLaunchService.detectAntiCheatGames()
    } catch (e: any) {
      console.error('[EngineService] ost:scan-anticheat-games 异常:', e)
      return []
    }
  })
}