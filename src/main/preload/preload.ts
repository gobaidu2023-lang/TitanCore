import { contextBridge, ipcRenderer } from 'electron'

const ALLOWED_INVOKE_PREFIXES = ['auth:', 'sys:', 'steam:', 'engine:', 'titan:', 'download:', 'app:', 'tcgame:', 'cloudsave:', 'minigame:', 'ost:', 'tools:', 'badab:']
const ALLOWED_INVOKE_CHANNELS = ['get-desktop-audio-source', 'win-toggle-fullscreen', 'win-is-fullscreen', 'badab:claim-victory']
const ALLOWED_SEND_CHANNELS = ['win-min', 'win-max', 'win-close', 'win-exit-fullscreen']
const ALLOWED_ON_PREFIXES = ['auth:', 'sys:', 'titan:', 'lifecycle:', 'download:', 'app:', 'tcgame:', 'cloudsave:', 'minigame:', 'tools:']

const isAllowedInvoke = (channel: string) => 
  ALLOWED_INVOKE_PREFIXES.some(p => channel.startsWith(p)) || 
  ALLOWED_INVOKE_CHANNELS.includes(channel) ||
  ALLOWED_SEND_CHANNELS.includes(channel)

const isAllowedOn = (channel: string) => 
  ALLOWED_ON_PREFIXES.some(p => channel.startsWith(p))

contextBridge.exposeInMainWorld('electron', {
  window: {
    min: () => ipcRenderer.send('win-min'),
    max: () => ipcRenderer.send('win-max'),
    close: () => ipcRenderer.send('win-close'),
    toggleFullScreen: () => ipcRenderer.invoke('win-toggle-fullscreen'),
    isFullScreen: () => ipcRenderer.invoke('win-is-fullscreen'),
    exitFullScreen: () => ipcRenderer.send('win-exit-fullscreen')
  },
  sys: {
    getDesktopAudioSource: () => ipcRenderer.invoke('get-desktop-audio-source'),
    openExternal: (url: string) => ipcRenderer.invoke('sys:open-external', url),
    openLocalFolder: (folderPath: string) => ipcRenderer.invoke('sys:open-local-folder', folderPath),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('sys:show-item-in-folder', filePath),
    getUserLibrary: () => ipcRenderer.invoke('sys:get-user-library'),
    removeUserLibrary: (resourceId: string) => ipcRenderer.invoke('sys:remove-user-library', resourceId),
    setManifestNode: (node: string) => ipcRenderer.invoke('sys:set-manifest-node', node),
    getManifestNode: () => ipcRenderer.invoke('sys:get-manifest-node'),
    runDiagnostics: () => ipcRenderer.invoke('titan:run-diagnostics'),
    launchGame: (appId: string) => ipcRenderer.invoke('titan:launch-game', appId),
    proxyPost: (url: string, body: any) => ipcRenderer.invoke('sys:proxy-post', { url, body }),
    checkUpdate: () => ipcRenderer.invoke('app:check-update'),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    startUpdate: () => ipcRenderer.invoke('app:start-update'),
    pushTelemetry: (events: any[]) => ipcRenderer.invoke('sys:push-telemetry', events),
    batchTelemetry: (events: any[]) => ipcRenderer.invoke('sys:batch-telemetry', events),
    toggleAutoUpdate: (resourceId: string, autoUpdate: boolean) => ipcRenderer.invoke('sys:toggle-auto-update', resourceId, autoUpdate),
    redeemCores: (score: number, amount: number, gameId?: string) => ipcRenderer.invoke('sys:redeem-cores', score, amount, gameId),
    getDeviceInfo: () => ipcRenderer.invoke('sys:get-device-info'),
    getHardwareSpecs: () => ipcRenderer.invoke('sys:get-hardware')
  },
  tcgame: {
    fetchList: () => ipcRenderer.invoke('tcgame:fetch-list'),
    install: (appid: number, meta: any) => ipcRenderer.invoke('tcgame:install', appid, meta),
    launch: (appid: number, exeName: string) => ipcRenderer.invoke('tcgame:launch', appid, exeName),
    installed: (appid: number) => ipcRenderer.invoke('tcgame:installed', appid),
    uninstall: (appid: number, exeName: string) => ipcRenderer.invoke('tcgame:uninstall', appid, exeName),
    getLibrary: () => ipcRenderer.invoke('tcgame:get-library'),
    getPlaytime: () => ipcRenderer.invoke('tcgame:get-playtime'),
    onProgress: (cb: (data: any) => void) => {
      const handler = (_: any, data: any) => cb(data)
      ipcRenderer.on('tcgame:install-progress', handler)
      return () => ipcRenderer.removeListener('tcgame:install-progress', handler)
    },
    onInstallDone: (cb: (data: any) => void) => {
      const handler = (_: any, data: any) => cb(data)
      ipcRenderer.on('tcgame:install-done', handler)
      return () => ipcRenderer.removeListener('tcgame:install-done', handler)
    }
  },
  minigame: {
    fetchLinks: () => ipcRenderer.invoke('minigame:fetch-links'),
    install: (gameId: string, downloadUrl: string | string[]) => ipcRenderer.invoke('minigame:install', gameId, downloadUrl),
    uninstall: (gameId: string) => ipcRenderer.invoke('minigame:uninstall', gameId),
    getState: () => ipcRenderer.invoke('minigame:get-state'),
    installed: (gameId: string) => ipcRenderer.invoke('minigame:installed', gameId),
    claimBadabVictory: (route: 'justice' | 'corruption', elapsedSec: number, starYear: number) => ipcRenderer.invoke('badab:claim-victory', route, elapsedSec, starYear),
    onProgress: (cb: (data: any) => void) => {
      const handler = (_: any, data: any) => cb(data)
      ipcRenderer.on('minigame:install-progress', handler)
      return () => ipcRenderer.removeListener('minigame:install-progress', handler)
    },
    onInstallDone: (cb: (data: any) => void) => {
      const handler = (_: any, data: any) => cb(data)
      ipcRenderer.on('minigame:install-done', handler)
      return () => ipcRenderer.removeListener('minigame:install-done', handler)
    }
  },
  cloudsave: {
    scanAccounts: () => ipcRenderer.invoke('cloudsave:scan-accounts'),
    scanSaves: (accountId: string) => ipcRenderer.invoke('cloudsave:scan-saves', accountId),
    upload: (accountId: string, appId: string, gameName: string) => ipcRenderer.invoke('cloudsave:upload', accountId, appId, gameName),
    download: (accountId: string, appId: string) => ipcRenderer.invoke('cloudsave:download', accountId, appId),
    manualPack: (accountId: string, appId: string) => ipcRenderer.invoke('cloudsave:manual-pack', accountId, appId),
    manualRestore: (accountId: string, appId: string) => ipcRenderer.invoke('cloudsave:manual-restore', accountId, appId),
    openLocalFolder: (accountId: string, appId: string) => ipcRenderer.invoke('cloudsave:open-local-folder', accountId, appId),
    deleteSave: (appId: string) => ipcRenderer.invoke('cloudsave:delete', appId),
    listCloudSaves: () => ipcRenderer.invoke('cloudsave:list'),
    migrateCrStorage: () => ipcRenderer.invoke('cloudsave:migrate-cr')
  },
  ost: {
    getMode: () => ipcRenderer.invoke('ost:get-mode'),
    switchMode: (target: 'pure' | 'classic') => ipcRenderer.invoke('ost:switch-mode', target),
    launchSteam: () => ipcRenderer.invoke('ost:launch-steam'),
    launchSteamNative: () => ipcRenderer.invoke('ost:launch-steam-native'),
    scanAntiCheatGames: () => ipcRenderer.invoke('ost:scan-anticheat-games')
  },
  invoke: (channel: string, ...args: any[]) => {
    if (!isAllowedInvoke(channel)) {
      throw new Error(`[Security] IPC invoke channel '${channel}' is not in the whitelist. ` +
        `Allowed prefixes: ${ALLOWED_INVOKE_PREFIXES.join(', ')}, ` +
        `Allowed channels: ${ALLOWED_INVOKE_CHANNELS.join(', ')}, ${ALLOWED_SEND_CHANNELS.join(', ')}`)
    }
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    if (!isAllowedOn(channel)) {
      throw new Error(`[Security] IPC on channel '${channel}' is not in the whitelist. ` +
        `Allowed prefixes: ${ALLOWED_ON_PREFIXES.join(', ')}`)
    }
    const subscription = (_event: any, ...args: any[]) => func(...args)
    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  },
  telemetry: {
    trackEvent: (event: string, data: any) => console.log('[Telemetry]', event, data)
  }
})