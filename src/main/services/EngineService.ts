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
  private static manifestNodeStatuses: Record<string, boolean> = {};

  static getManifestProbeResult(): { url: string; node: string } | null {
    return this.manifestProbeResult;
  }

  static getManifestNodeStatuses(): Record<string, boolean> {
    if (Object.keys(this.manifestNodeStatuses).length === 0) {
      const fromDb = Db.get<Record<string, boolean>>('manifest_node_statuses');
      if (fromDb) return { ...fromDb };
    }
    return { ...this.manifestNodeStatuses };
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

  static async check(engine: 'ost' | 'st' = 'ost'): Promise<{ ready: boolean; version: number; path: string | null }> {
    const config = Db.get<any>(`engine_config_${engine}`)
    // 【修改】currentEngine 经由归一化读出：此后 ST 永远不可能通过 ready 判定（掐断点之一）
    const currentEngine = this.normalizeEngine()
    const isReady = (config?.engine_status === 'ready') && (currentEngine === engine)
    return { ready: isReady, version: config?.version || 0, path: null }
  }

  private static getUpdateCheckUrl(serverUrl: string, engine: string): string {
    return `${serverUrl}/titan/update_check.php?action=get_engine_config&engine=${engine}`
  }

  private static saveEngineConfig(engine: 'ost', remoteVersion: number, remoteConfig: any, toolMirrors?: string[]): void {
    const mirrors = toolMirrors || remoteConfig.mirrors || (remoteConfig.tool_url ? [remoteConfig.tool_url] : []);
    Db.set(`engine_config_${engine}`, {
      version: remoteVersion,
      engine_status: remoteConfig.engine_status || 'ready',
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
      opensteamtool: 'https://manifest.opensteamtool.com',
      wudrm: 'http://gmrc.wudrm.com/manifest',
      steamrun: 'https://manifest.steam.run/api/manifest'
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
          this.saveEngineConfig(engine, remoteVersion, remoteConfig)
          console.log(`[EngineService] Engine ${engine} config initialized v${remoteVersion}`)
        } else {
          const mirrors = remoteConfig.mirrors || (remoteConfig.tool_url ? [remoteConfig.tool_url] : []);
          Db.set(`engine_config_${engine}`, {
            version: localConfig.version || 0,
            engine_status: remoteConfig.engine_status || 'ready',
            tool_url: remoteConfig.tool_url,
            mirrors: mirrors,
            target_dlls: remoteConfig.target_dlls,
            plugin_dir: remoteConfig.plugin_dir,
            updated_at: Date.now()
          })
          console.log(`[EngineService] Engine ${engine} status synced, deployed v${localConfig.version || 0}`)
        }

        if (remoteConfig.manifest_nodes && typeof remoteConfig.manifest_nodes === 'object') {
          Db.set('manifest_node_map', remoteConfig.manifest_nodes);
          console.log('[EngineService] manifest_nodes updated from remote');
        }

      } catch (e: any) {
        console.warn(`[EngineService] Init engine ${engine} config failed:`, e.message)
      }
    }

    await this.probeManifestNodes();
  }

  private static async probeManifestNodes(): Promise<void> {
    const nodeMap = this.getManifestNodeMap();
    const nodeNames = ['opensteamtool', 'wudrm', 'steamrun'] as const;
    const TEST_GID = '123456789012345';
    
    this.manifestNodeStatuses = {};
    this.manifestProbeResult = null;


    const results = await Promise.allSettled(
      nodeNames.map(async (name) => {
        const probeUrl = `${nodeMap[name]}/${TEST_GID}`;
        const isConnected = await this.probeNode(probeUrl, 5000);
        return { name, isConnected };
      })
    );

    results.forEach((res) => {
      if (res.status === 'fulfilled') {
        this.manifestNodeStatuses[res.value.name] = res.value.isConnected;
      }
    });

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
    Db.set('manifest_node_statuses', this.manifestNodeStatuses);

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

  static async setManifestNode(node: string, steamPath: string): Promise<{ success: boolean; msg: string }> {
    if (node === 'auto') {
      Db.set('manifest_node_mode', 'auto');
      await this.probeManifestNodes();
      return { success: true, msg: 'SUCCESS_ENGINE_AUTO' };
    }

    const validNodes = ['opensteamtool', 'wudrm', 'steamrun'];
    if (!validNodes.includes(node)) {
      return { success: false, msg: 'ERR_INVALID_NODE' };
    }

    const nodeMap = this.getManifestNodeMap();
    const url = nodeMap[node];
    
    Db.set('manifest_node_mode', node);
    
    this.manifestProbeResult = { url, node };
    this.manifestNodeStatuses[node] = true;
    Db.set('manifest_probe_cache', this.manifestProbeResult);
    Db.set('manifest_node_statuses', this.manifestNodeStatuses);
    
    return { success: true, msg: `SUCCESS_ENGINE_MANUAL:${node}` };
  }

  static async silentCheckUpdate(engine: 'ost' | 'st'): Promise<{ hasUpdate: boolean; version?: number; engine?: string; msg?: string; remoteConfig?: any }> {
    // 【新增】入口归一化：更新检查只针对 OST 执行，ST 永不再参与（掐断点之三）
    engine = this.normalizeEngine()

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

      if (remoteVersion > localState.version) {
        return { hasUpdate: true, version: remoteVersion, engine, remoteConfig }
      }

      return { hasUpdate: false, version: remoteVersion, engine, remoteConfig }
    } catch (e: any) {
      console.warn(`[EngineService] Silent check failed:`, e.message)
      return { hasUpdate: false, msg: e.message }
    }
  }

  // TC-P23: 强制拉取最新引擎工具包(模式切换缺包时调用; fetch+deploy 归一到服务层, 不在胶水层拼)
  static async pullLatest(engine: 'ost' | 'st' = 'ost'): Promise<{ success: boolean; error?: string }> {
    try {
      engine = this.normalizeEngine()
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
        expected_engine_version: remoteConfig.engine_version || 0
      }, 'ost')
      if (deployRes.success) {
        const old = Db.get<any>('engine_config_ost') || {}
        Db.set('engine_config_ost', { ...old, version: remoteConfig.engine_version || 0, updated_at: Date.now() })
      }
      return { success: deployRes.success === true, error: deployRes.success ? undefined : (deployRes.msg || 'DEPLOY_FAIL') }
    } catch (e: any) {
      return { success: false, error: e?.message || 'UNKNOWN' }
    }
  }
}

export function registerEngineService() {
  ipcMain.removeHandler('engine:check')
  ipcMain.handle('engine:check', async (_e, engine: 'ost' | 'st') => await EngineService.check(engine))

  ipcMain.removeHandler('engine:silent-check')
  ipcMain.handle('engine:silent-check', async (_e, engine: 'ost' | 'st') => await EngineService.silentCheckUpdate(engine))

  ipcMain.removeHandler('engine:apply-latest-update')
  ipcMain.handle('engine:apply-latest-update', async () => {
    const sUrl = Db.get<any>('app_seed_config')?.serverUrl
    if (!sUrl) return { success: false, msg: 'ERR_SERVER_REQUIRED' }
    try {
      const res = await titanFetch(`${sUrl}/titan/update_check.php?action=get_engine_config&engine=ost`, {
        method: 'GET',
        headers: { 'User-Agent': 'TitanCore/2.0' }
      })
      if (!res.ok) return { success: false, msg: 'ERR_GATEWAY_EXCEPTION' }
      const remoteConfig = await res.json()
      if (!remoteConfig || !remoteConfig.success) return { success: false, msg: 'ERR_GATEWAY_EXCEPTION' }

      const detectRes = await SteamDetector.detect()
      if (!detectRes?.path) return { success: false, msg: 'ERR_STEAM_MISSING' }

      // 存量自愈：旧时代 dwmapi 劫持已废弃，应用引擎更新时静默清理
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
        fast_mode: false
      }, 'ost')

      if (deployRes.success) {
        const old = Db.get<any>('engine_config_ost') || {}
        Db.set('engine_config_ost', { ...old, version: remoteConfig.engine_version || 0, updated_at: Date.now() })
        return { success: true, msg: `SUCCESS_ENGINE_UPDATED:${remoteConfig.engine_version || 0}` }
      }
      return deployRes
    } catch (e: any) {
      return { success: false, msg: 'ERR_NETWORK_ERROR' }
    }
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
      return { success: false, msg: err?.message || 'INTERNAL_ERROR' }
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
      return { success: false, mode: ModeSwitchService.getMode(), error: e?.message || 'SWITCH_EXCEPTION' }
    }
  })

  ipcMain.removeHandler('ost:launch-steam')
  ipcMain.handle('ost:launch-steam', async () => {
    try {
      return await SteamLaunchService.launchSteam()
    } catch (e: any) {
      console.error('[EngineService] ost:launch-steam 异常:', e)
      return { success: false, error: e?.message }
    }
  })

  ipcMain.removeHandler('ost:launch-steam-native')
  ipcMain.handle('ost:launch-steam-native', async () => {
    try {
      return await SteamLaunchService.launchSteamNative()
    } catch (e: any) {
      console.error('[EngineService] ost:launch-steam-native 异常:', e)
      return { success: false, native: true, error: e?.message }
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