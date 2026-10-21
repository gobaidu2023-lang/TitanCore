// 文件名: electron.d.ts
interface Window {
  electron: {
    window: {
      min: () => void
      max: () => void
      close: () => void
      toggleFullScreen: () => Promise<boolean>
      isFullScreen: () => Promise<boolean>
      exitFullScreen: () => void
    }
    sys: {
      getDesktopAudioSource: () => Promise<any>
      openExternal: (url: string) => Promise<{ success: boolean; msg?: string }>
      openLocalFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
      showItemInFolder: (filePath: string) => Promise<any>
      getUserLibrary: () => Promise<any[]>
      removeUserLibrary: (resourceId: string) => Promise<boolean>
      setManifestNode: (node: string) => Promise<any>
      getManifestNode: () => Promise<any>
      runDiagnostics: () => Promise<any>
      launchGame: (appId: string) => Promise<any>
      proxyPost: (url: string, body: any) => Promise<any>
      checkUpdate: () => Promise<any>
      getVersion: () => Promise<string>
      startUpdate: () => Promise<any>
      pushTelemetry: (events: any[]) => Promise<any>
      batchTelemetry: (events: any[]) => Promise<any>
      toggleAutoUpdate: (resourceId: string, autoUpdate: boolean) => Promise<any>
      redeemCores: (score: number, amount: number) => Promise<any>
      getDeviceInfo: () => Promise<any>
      getHardwareSpecs: () => Promise<{ cpu: string; gpu: string; memory: string; os: string }>
    }
    tcgame: {
      fetchList: () => Promise<any>
      install: (appid: number, meta: any) => Promise<any>
      launch: (appid: number, exeName: string) => Promise<any>
      installed: (appid: number) => Promise<boolean>
      uninstall: (appid: number, exeName: string) => Promise<any>
      getLibrary: () => Promise<any>
      getPlaytime: () => Promise<any>
      onProgress: (cb: (data: any) => void) => () => void
      onInstallDone: (cb: (data: any) => void) => () => void
    }
    minigame: {
      fetchLinks: () => Promise<any>
      install: (gameId: string, downloadUrl: string | string[]) => Promise<any>
      uninstall: (gameId: string) => Promise<any>
      getState: () => Promise<any>
      installed: (gameId: string) => Promise<boolean>
      onProgress: (cb: (data: any) => void) => () => void
      onInstallDone: (cb: (data: any) => void) => () => void
    }
    cloudsave: {
      scanAccounts: () => Promise<any>
      scanSaves: (accountId: string) => Promise<any>
      upload: (accountId: string, appId: string, gameName: string) => Promise<any>
      download: (accountId: string, appId: string) => Promise<any>
      manualPack: (accountId: string, appId: string) => Promise<any>
      manualRestore: (accountId: string, appId: string) => Promise<any>
      openLocalFolder: (accountId: string, appId: string) => Promise<any>
      deleteSave: (appId: string) => Promise<any>
      listCloudSaves: () => Promise<any>
      migrateCrStorage: () => Promise<{ success: boolean; error?: string }>
    }
    ost: {
      getMode: () => Promise<'pure' | 'classic'>
      switchMode: (target: 'pure' | 'classic') => Promise<{ success: boolean; mode: 'pure' | 'classic'; error?: string }>
      launchSteam: () => Promise<{ success: boolean; handshake: boolean; degraded?: boolean; protected?: boolean; account?: string; accountName?: string; error?: string }>
      launchSteamNative: () => Promise<{ success: boolean; native: boolean; error?: string }>
      scanAntiCheatGames: () => Promise<string[]>
      getFamilyLibraryMode: () => Promise<boolean>
      setFamilyLibraryMode: (enabled: boolean) => Promise<boolean>
    }
    invoke: (channel: string, ...args: any[]) => Promise<any>
    on: (channel: string, func: (...args: any[]) => void) => () => void
    telemetry: {
      trackEvent: (event: string, data: any) => void
    }
  }
}
