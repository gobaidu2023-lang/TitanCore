// 文件名: src/i18n/index.ts
import { ref } from 'vue'
import zhCN from './zh-CN.json'
import zhTW from './zh-TW.json'
import enUS from './en-US.json'

const dicts: Record<string, any> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en-US': enUS,
}

export const currentLang = ref('zh-CN')

const ERROR_CODE_MAP: Record<string, string> = {
  'ERR_INVALID_CREDENTIALS': 'errors.invalidCredentials',
  'ERR_IDENTITY_OCCUPIED': 'errors.identityOccupied',
  'ERR_TOO_MANY_REQUESTS': 'errors.tooManyRequests',
  'ERR_SERVER_MAINTENANCE': 'errors.serverMaintenance',
  'ERR_DECRYPT_FAIL': 'errors.decryptFail',
  'ERR_NETWORK_TIMEOUT': 'errors.networkTimeout',
  'ERR_NETWORK_ERROR': 'errors.networkError',
  'ERR_BOOTSTRAP_FAIL': 'errors.bootstrapFail',
  'ERR_TICKET_STORE_FAIL': 'errors.ticketStoreFail',
  'ERR_SYNC_FAIL': 'errors.syncFail',
  'ERR_REGISTER_REJECTED': 'errors.registerRejected',
  'ERR_TICKET_LOST': 'errors.ticketLost',
  'ERR_TICKET_EXPIRED': 'errors.ticketExpired',
  'ERR_SESSION_INVALID': 'errors.sessionInvalid',
  'ERR_LOGIN_REQUIRED': 'errors.loginRequired',
  'ERR_SERVER_REQUIRED': 'errors.serverRequired',
  'ERR_SESSION_EXPIRED': 'errors.sessionExpired',
  'ERR_SECURITY_CHECK_FAIL': 'errors.securityCheckFail',
  'ERR_INVALID_CARD': 'errors.invalidCard',
  'ERR_CARD_USED': 'errors.cardUsed',
  'ERR_EMPTY_CODE': 'errors.emptyCode',
  'ERR_PARAM_ERROR': 'errors.paramError',
  'ERR_SERVICE_ERROR': 'errors.serviceError',
  'ERR_OFFLINE_MODE': 'errors.offlineMode',
  'ERR_ACCOUNT_NOT_FOUND': 'errors.accountNotFound',
  'ERR_STEAM_VALIDATE_FAIL': 'errors.steamValidateFail',
  'ERR_STEAM_NOT_FOUND': 'errors.steamNotFound',
  'ERR_STEAM_NOT_FOUND_EXE': 'errors.steamNotFoundExe',
  'ERR_STEAM_RESTART_FAIL': 'errors.steamRestartFail',
  'ERR_ENGINE_METADATA_FAIL': 'errors.engineMetadataFail',
  'ERR_ENGINE_DECRYPT_FAIL': 'errors.engineDecryptFail',
  'ERR_MIRRORS_UNAVAILABLE': 'errors.mirrorsUnavailable',
  'ERR_ENGINE_EXTRACT_FAIL': 'errors.engineExtractFail',
  'ERR_ENGINE_UP_TO_DATE': 'errors.engineUpToDate',
  'ERR_ENGINE_DEPLOY_SUCCESS': 'errors.engineDeploySuccess',
  'ERR_ENGINE_NETWORK_INTERCEPT': 'errors.engineNetworkIntercept',
  'ERR_ENGINE_SWITCH_FAIL': 'errors.engineSwitchFail',
  'ERR_NODE_FAIL': 'errors.nodeFail',
  'ERR_CONNECTION_FAIL_TITLE': 'errors.connectionFailTitle',
  'ERR_CONNECTION_FAIL_DESC': 'errors.connectionFailDesc',
  'ERR_CONNECTION_FAIL_SOLUTION': 'errors.connectionFailSolution',
  'ERR_OFFLINE_MODE_FAIL': 'errors.offlineModeFail',
  'ERR_REGISTER_REQUIRED_FIELDS': 'errors.registerRequiredFields',
  'ERR_EMAIL_INVALID': 'errors.emailInvalid',
  'ERR_FORGOT_INPUT_REQUIRED': 'errors.forgotInputRequired',
  'ERR_FORGOT_PASSWORD_MIN_LENGTH': 'errors.forgotPasswordMinLength',
  'ERR_FORGOT_RESET_FAIL': 'errors.forgotResetFail',
  'ERR_VERIFY_FAIL': 'errors.verifyFail',
  'ERR_JSON_PARSE_FAIL': 'errors.jsonParseFail',
  'ERR_INVALID_PACK_FORMAT': 'errors.invalidPackFormat',
  'ERR_TOGGLE_REJECTED': 'errors.toggleRejected',
  'ERR_UPDATE_FAIL': 'errors.updateFail',
  'ERR_DEPLOY_ENOENT': 'protocol.ERR_DEPLOY_ENOENT',
  'ERR_DEPLOY_NETWORK': 'protocol.ERR_DEPLOY_NETWORK',
  'ERR_DEPLOY_EACCES': 'protocol.ERR_DEPLOY_EACCES',
  'ERR_DEPLOY_EBUSY': 'protocol.ERR_DEPLOY_EBUSY',
  'ERR_DEPLOY_UNKNOWN': 'protocol.ERR_DEPLOY_UNKNOWN',
  'ERR_NO_GATEWAY_NODE': 'protocol.ERR_NO_GATEWAY_NODE',
  'ERR_NODE_CONNECT_FAIL': 'errors.nodeConnectFail',
  'ERR_AUTH_PROCESSING': 'errors.authProcessing',
  'ERR_LOGIN_FAILED': 'errors.loginFailed',
  'ERR_REGISTER_FAILED': 'errors.registerFailed',
  'ERR_REDEEM_EXCEPTION': 'errors.redeemException',
  'ERR_SHOP_NOT_CONFIGURED': 'errors.shopNotConfigured',
  'ERR_CANNOT_OPEN_BROWSER': 'errors.cannotOpenBrowser',
  'ERR_RESOURCE_NOT_FOUND': 'errors.resourceNotFound',
  'ERR_QUOTA_EXHAUSTED': 'errors.quotaExhausted',
  'ERR_KEYWORD_INVALID': 'errors.keywordInvalid',
  'ERR_VALIDATE_FAIL': 'errors.validateFailTitle',
  'ERR_LAUNCH_FAILED': 'errors.launchFailed',
  'ERR_DEPLOY_NO_MANIFEST': 'errors.deployNoManifest',
  'ERR_CLOUD_SERVER_NOT_CONFIGURED': 'errors.cloudServerNotConfigured',
  'ERR_CLOUD_UPLOAD_AUTH': 'errors.cloudUploadAuthFailed',
  'ERR_CLOUD_CONFIRM_FAILED': 'errors.cloudConfirmFailed',
  'ERR_STEAM_RUNNING': 'errors.steamRunning',
  'ERR_CLOUD_URL_FAILED': 'errors.cloudUrlFailed',
  'ERR_CLOUD_FILE_GONE': 'errors.cloudFileGone',
  'ERR_STEAM_PATH': 'errors.steamPathMissing',
  'ERR_NO_LOCAL_SAVES': 'errors.noLocalSaves',
  'ERR_PACK_FAIL': 'errors.packFailTpl',
  'ERR_UNZIP_FAIL': 'errors.unzipFailTpl',
  'ERR_NO_WINDOW': 'errors.noWindow',
  'ERR_CANCELLED': 'errors.cancelled',
  'ERR_NO_LOCAL_BACKUP': 'errors.noLocalBackup',
  'ERR_CLOUD_RESTORE_FAILED': 'errors.cloudRestoreFailed',
  'ERR_CLOUD_DELETE_FAILED': 'errors.cloudDeleteFailed',
  'ERR_GAME_INSTALLING': 'errors.gameInstalling',
  'ERR_GAME_BINARY_MISSING': 'errors.gameBinaryMissing',
  'ERR_GAME_RUNNING': 'errors.gameRunning',
  'ERR_NOT_LINKED': 'errors.notLinked',
  'ERR_DEPLOY_REJECTED': 'errors.deployRejectedTpl',
  'ERR_NOT_IN_LIBRARY': 'errors.notInLibrary',
  'ERR_DB_UPDATE': 'errors.dbUpdateFailed',
  'ERR_LOCAL_COMPONENT_MISSING': 'errors.localComponentMissing',
  'ERR_ALL_NODES_DOWN': 'errors.allNodesDown',
  'ERR_DIR_PERMISSION': 'errors.dirPermission',
  'ERR_STEAM_LOCKING': 'errors.steamLocking',
  'ERR_UNKNOWN_DEPLOY': 'errors.unknownDeployTpl',
  'ERR_SAVE_MISMATCH': 'errors.saveMismatchTpl',
  'ERR_NO_TOOL_NODE': 'errors.noToolNode',
  'ERR_UNZIP_EXIT': 'errors.unzipExitTpl',
  'ERR_UNZIP_CORRUPT': 'errors.unzipCorruptTpl',
  'ERR_NO_NODE': 'errors.noNodeTpl',
  'ERR_UNKNOWN_NET': 'errors.unknownNet',
  'ERR_ALL_LINKS_DOWN': 'errors.allLinksDownTpl',
  'ERR_STREAM_TIMEOUT': 'errors.streamTimeout',
  'ERR_EMPTY_DOWNLOAD': 'errors.emptyDownload',
  'ERR_TARGET_MISSING': 'errors.targetMissing',
  'ERR_SIZE_TOO_SMALL': 'errors.sizeTooSmall',
  'ERR_INVALID_ARCHIVE': 'errors.invalidArchive',
  'ERR_CLOUD_AUTH_FAILED': 'errors.cloudAuthFailed',
  'ERR_DEPLOY_NO_ENGINE': 'errors.deployNoEngine',
  'ERR_DEPLOY_NO_STEAM': 'errors.deployNoSteam',
  'ERR_DIR_NOT_EXISTS': 'errors.dirNotExists',
  'ERR_FETCH_UPDATE_INFO': 'errors.fetchUpdateInfo',
  'ERR_FILE_WRITE_FAIL': 'errors.fileWriteFail',
  'ERR_GATEWAY_EXCEPTION': 'errors.gatewayException',
  'ERR_GATEWAY_REJECTED': 'errors.gatewayRejected',
  'ERR_INVALID_APPID': 'errors.invalidAppid',
  'ERR_INVALID_NODE': 'errors.invalidNode',
  'ERR_INVALID_URL': 'errors.invalidUrl',
  'ERR_NO_AVAILABLE_MIRROR': 'errors.noAvailableMirror',
  'ERR_NO_AVAILABLE_UPDATER_MIRROR': 'errors.noAvailableUpdaterMirror',
  'ERR_NO_VALID_LUA': 'errors.noValidLua',
  'ERR_OFFLINE': 'errors.offline',
  'ERR_OFFLINE_OR_UNAUTHORIZED': 'errors.offlineOrUnauthorized',
  'ERR_PARAM': 'errors.param',
  'ERR_READ_DIR': 'errors.readDir',
  'ERR_REDEEM_FAIL': 'errors.redeemFail',
  'ERR_SERVER_REJECTED': 'errors.serverRejected',
  'ERR_SERVER_RESPONSE': 'errors.serverResponse',
  'ERR_SERVER_RESPONSE_ERROR': 'errors.serverResponseError',
  'ERR_STEAM_MISSING': 'errors.steamMissing',
  'ERR_UNAUTHORIZED': 'errors.unauthorized',
  'ERR_WINDOW_MISSING': 'errors.windowMissing',
  'ERR_INCOMPLETE_FILE': 'errors.incompleteTpl',
  'NODE_RACING': 'errors.racingTpl',
  'LABEL_TOOL_PACK': 'errors.labelTool',
  'LABEL_MANIFEST_MATRIX': 'errors.labelManifest',
  'DIAG_OST_DLL': 'diag.ostDllName',
  'DIAG_ST_DLL': 'diag.stDllName',
  'DIAG_OST_OK': 'diag.ostOk',
  'DIAG_OST_MISSING': 'diag.ostMissing',
  'DIAG_PATTERN_DIR': 'diag.patternDirName',
  'DIAG_PATTERN_OK': 'diag.patternOk',
  'DIAG_PATTERN_STALE': 'diag.patternStale',
  'DIAG_MANIFEST_URL': 'diag.manifestUrlName',
  'DIAG_URL_OK': 'diag.urlOk',
  'DIAG_URL_FAIL': 'diag.urlFail',
  'DIAG_GAME_CFG': 'diag.gameCfgName',
  'DIAG_CR_STORAGE_LEGACY': 'diag.crStorageName',
  'DIAG_CR_STORAGE_OK': 'diag.crStorageOk',
  'DIAG_CR_STORAGE_MIGRATE': 'diag.crStorageMigrate',
  'DIAG_GAME_CFG_OK': 'diag.gameCfgOk',
  'DIAG_GAME_CFG_NOT_READY': 'diag.gameCfgNotReady',
  'DIAG_ADVICE': 'diag.adviceName',
  'DIAG_TOML_ALIGN': 'diag.tomlAlignName',
  'DIAG_TOML_OK': 'diag.tomlOk',
  'DIAG_TOML_MISMATCH': 'diag.tomlMismatch',
  'DIAG_EXCEPTION': 'diag.exceptionTpl',
  'DIAG_ADVICE_TOML': 'diag.adviceToml',
  'DIAG_ADVICE_DEPLOY': 'diag.adviceDeploy',
  'DIAG_ADVICE_ALL_OK': 'diag.adviceAllOk',
  'DIAG_ENGINE_CONFLICT': 'diag.engineConflictName',
  'DIAG_ENGINE_CONFLICTED': 'diag.engineConflicted',
  'DIAG_ENGINE_CLEAN': 'diag.engineClean',
  'DIAG_TC_INSTALL_DIR': 'diag.tcInstallDirName',
  'DIAG_TC_DIR_PROTECTED_WARN': 'diag.tcDirProtectedWarn',
  'DIAG_TC_DIR_OK': 'diag.tcDirOk',
  'DIAG_OST_WATCHDOG': 'diag.ostWatchdogName',
  'DIAG_WATCHDOG_CLEAN': 'diag.watchdogClean',
  'DIAG_WATCHDOG_LEAK': 'diag.watchdogLeak',
  'ERR_MINIGAME_INSTALLING': 'errors.minigameInstalling',
  'ERR_MINIGAME_ALREADY_INSTALLED': 'errors.minigameAlreadyInstalled',
  'ERR_ARIA2_NOT_READY': 'errors.aria2NotReady',
  'ERR_ZIP_MISSING': 'errors.minigameZipMissing',
  'ERR_DOWNLOAD_URL_MISSING': 'errors.downloadUrlMissing',
  'ERR_UNKNOWN': 'errors.unknownError',
  'ERR_ALL_MIRRORS_DOWN': 'errors.allMirrorsDown',
  'ERR_INVALID_GAME_ID': 'errors.invalidGameId',
  'ERR_INSTALL_FAIL': 'errors.installFailed',
  'ERR_UPDATER_BROWSER_FALLBACK': 'errors.updaterBrowserFallback',
  'ERR_MAIN_DOWNLOAD_FAIL': 'errors.mainDownloadFail',
  'ERR_UPDATER_DOWNLOAD_FAIL': 'errors.updaterDownloadFail',
  'ERR_UPDATER_EXTRACT_FAIL': 'errors.updaterExtractFailTpl',
  'ERR_DOWNLOAD_FAILED': 'errors.downloadFailed',
  'ERR_ACCESS_DENIED': 'errors.accessDenied',
  'ERR_NOT_A_DIRECTORY': 'errors.notADirectory',
  'ERR_INVALID_ACCOUNT_OR_APP_ID': 'errors.invalidAccountOrAppId',
  'ERR_INVALID_EXENAME': 'errors.invalidExeName',
  'ERR_GAME_WONT_START': 'errors.gameWontStart',
  'ERR_LAUNCH_54': 'errors.launch54',
  'ERR_TOOL_STATUS': 'errors.toolStatus',
  'ERR_TOOL_INSTALL': 'errors.toolInstall',
  'ERR_TOOL_UNINSTALL': 'errors.toolUninstall',
  'ERR_TOOL_LAUNCH': 'errors.toolLaunch',
  'ERR_TOOL_NOT_FOUND': 'errors.toolNotFound',
  'ERR_TOOL_NOT_INSTALLED': 'errors.toolNotInstalled',
  'ERR_TOOL_EXE_MISSING': 'errors.toolExeMissing',
  'ERR_TOOL_FILE_MISSING': 'errors.toolFileMissing',
  'ERR_TOOL_SERVER': 'errors.toolServer',
  'ERR_TOOL_SHA1': 'errors.toolSha1',
  'ERR_TOOL_DOWNLOAD_CORRUPT': 'errors.toolDownloadCorrupt',
  'ERR_TOOL_PATH_ESCAPE': 'errors.toolPathEscape',
  'ERR_TOOL_UNAUTHORIZED': 'errors.toolUnauthorized',
  'ERR_TOOL_BROWSER_FALLBACK': 'errors.toolBrowserFallback',
  'ERR_ALL_MIRRORS_STALLED': 'errors.allMirrorsStalled',
  'ERR_NO_INTERNET': 'errors.noInternet',
  'ERR_NO_URLS': 'errors.noUrls',
  'ERR_OPEN_EXTERNAL_FAILED': 'errors.openExternalFailed',
  'ERR_RACE_ALL_FAILED': 'errors.raceAllFailed',
  'ERR_SHA256_MISMATCH': 'errors.sha256Mismatch',
  'ERR_INVALID_ZIP_HEADER': 'errors.invalidZipHeader',
  'ERR_INVALID_ENTRY': 'errors.invalidEntry',
  'ERR_INVALID_SEED': 'errors.invalidSeed',
  'ERR_INVALID_NODE_KEY': 'errors.invalidNodeKey',
  'ERR_EMPTY_URL': 'errors.emptyUrl',
  'ERR_ENGINE_DEPLOY_FAIL': 'errors.engineDeployFail',
  'ERR_UPDATER_NOT_FOUND': 'errors.updaterNotFound',
  'ERR_BROWSER_FALLBACK': 'errors.browserFallback',
  'ERR_REQUEST': 'errors.request',
  'ERR_REQUEST_ERROR': 'errors.requestError',
  'TOOLS_PULL_FAIL': 'errors.toolsPullFail',
  'TOOLS_PULL_INCOMPLETE': 'errors.toolsPullIncomplete',
  'TOOLS_MISSING': 'errors.toolsMissing',
  'DEPLOY_FAIL': 'errors.deployFail',
  'DEPLOY_TRIGGER_MISSING': 'errors.deployTriggerMissing',
  'DEPLOY_IN_PROGRESS': 'errors.deployInProgress',
  'DIR_NOT_FOUND': 'errors.dirNotFound',
  'DIR_PREPARE_FAIL': 'errors.dirPrepareFail',
  'ENV_WRITE_FAIL': 'errors.envWriteFail',
  'BUSY': 'errors.busy',
  'BUSY_DEPLOYING': 'errors.busyDeploying',
  'ABORTED': 'errors.aborted',
  'BAD_ARG': 'errors.badArg',
  'HANDSHAKE_TIMEOUT': 'errors.handshakeTimeout',
  'INVALID_PATH': 'errors.invalidPath',
  'KEYWORD_EMPTY': 'errors.keywordEmpty',
  'KEYWORD_INVALID': 'errors.keywordInvalid',
  'MAGNET_NOT_SUPPORTED': 'errors.magnetNotSupported',
  'NETWORK_ERROR': 'errors.networkError',
  'NO_AUTH': 'errors.noAuth',
  'NO_LEGACY_DATA': 'errors.noLegacyData',
  'OPEN_EXTERNAL_FAILED': 'errors.openExternalFailed',
  'PAYLOAD_DECRYPT_FAIL': 'errors.payloadDecryptFail',
  'PREREQ_MISSING': 'errors.prereqMissing',
  'QUOTA_EXHAUSTED': 'errors.quotaExhausted',
  'STEAM_DLL_NOT_FOUND': 'errors.steamDllNotFound',
  'STEAM_NOT_FOUND': 'errors.steamNotFound',
  'STEAM_STILL_RUNNING': 'errors.steamStillRunning',
  'VERIFY_FAIL': 'errors.verifyFail',
  'WRITE_FAIL': 'errors.writeFail',
  'no_audio': 'errors.noAudio',
  'LAUNCH_NATIVE_IPC_ERROR': 'errors.launchNativeIpcError',
}

const SUCCESS_CODE_MAP: Record<string, string> = {
  'SUCCESS_ENGINE_CACHED': 'errors.engineUpToDate',
  'SUCCESS_ENGINE_DEPLOYED': 'errors.engineDeploySuccess',
  'SUCCESS_AUTH': 'auth.success',
  'SUCCESS_REFRESH': 'auth.refreshSuccess',
  'SUCCESS_CLOUD_UPLOADED': 'errors.cloudUploaded',
  'SUCCESS_CLOUD_RESTORED': 'errors.cloudRestoreDone',
  'SUCCESS_CLOUD_RESTORED_ALIGNED': 'errors.cloudRestoreAligned',
  'SUCCESS_CLOUD_RESTORED_LOCAL': 'errors.cloudRestoreDoneLocal',
  'SUCCESS_CLOUD_RESTORED_ALIGNED_LOCAL': 'errors.cloudRestoreAlignedLocal',
  'SUCCESS_OPENED_REDIRECT_DIR': 'errors.openedRedirectDir',
  'SUCCESS_LOCATED_BACKUP': 'errors.locatedBackup',
  'SUCCESS_OPENED_BACKUP_DIR': 'errors.openedBackupDir',
  'SUCCESS_CLOUD_DELETED': 'errors.cloudDeleted',
  'SUCCESS_ENGINE_UPDATED': 'errors.engineUpdatedTpl',
  'SUCCESS_ENGINE_AUTO': 'errors.engineAutoMode',
  'SUCCESS_ENGINE_MANUAL': 'errors.engineManualModeTpl',
  'SUCCESS_REDEEM': 'errors.redeemSuccess'
}

export function t(key: string, fallback?: string): string
export function t(key: string, params?: Record<string, any>, fallback?: string): string
export function t(key: string, paramsOrFallback?: Record<string, any> | string, fallbackStr?: string): string {
  const lang = currentLang.value
  let params: Record<string, any> | undefined
  let fallback: string | undefined

  if (typeof paramsOrFallback === 'string') {
    fallback = paramsOrFallback
    params = undefined
  } else {
    params = paramsOrFallback
    fallback = fallbackStr
  }

  let actualKey = key
  let hasDetails = false
  let detailInfo = ''

  if (key && typeof key === 'string') {
    const [codeName, ...extraParts] = key.split(':')
    if (ERROR_CODE_MAP[codeName]) {
      actualKey = ERROR_CODE_MAP[codeName]
      if (extraParts.length > 0 && extraParts[0]) {
        hasDetails = true
        detailInfo = extraParts.join(':').trim()
        if (!params) {
          params = { node: extraParts[0], code: extraParts[0], extra: extraParts[1], detail: detailInfo }
        }
      }
    }
  }

  if (key && key.startsWith('SUCCESS_')) {
    const [codeName, ...extraParts] = key.split(':')
    if (SUCCESS_CODE_MAP[codeName]) {
      actualKey = SUCCESS_CODE_MAP[codeName]
      if (extraParts.length > 0 && !params) {
        if (codeName === 'SUCCESS_ENGINE_DEPLOYED') {
          params = { engine: extraParts[0], version: extraParts[1] }
        } else if (codeName === 'SUCCESS_ENGINE_UPDATED') {
          // R59: 补 SUCCESS_ENGINE_UPDATED 自动参数(版本号在 extraParts[0]), 否则模板 v{node} 原样上屏
          params = { node: extraParts[0], version: extraParts[0] }
        }
      }
    }
  }

  // R32: 参数值若为嵌套码(如 NODE_RACING:3 / ERR_NO_NODE:LABEL_TOOL_PACK 的 node), 递归翻译一层
  if (params) {
    for (const pk of Object.keys(params)) {
      const pv = params[pk]
      if (typeof pv === 'string' && /^[A-Z][A-Z0-9_]{2,}(:.+)?$/.test(pv)) {
        params[pk] = t(pv)
      }
    }
  }

  const keys = actualKey.split('.')
  let val: any = dicts[lang]

  for (const k of keys) {
    val = val?.[k]
    if (val === undefined) break
  }

  // Fallback: If zh-TW key is missing, fall back to zh-CN
  if (val === undefined && lang === 'zh-TW') {
    let fallbackVal: any = dicts['zh-CN']
    for (const k of keys) {
      fallbackVal = fallbackVal?.[k]
      if (fallbackVal === undefined) break
    }
    val = fallbackVal
  }

  let result = val || fallback || actualKey
  if (hasDetails && typeof result === 'string' && !result.includes('{detail}') && !result.includes('{node}') && !result.includes('{code}')) {
    result = `${result} (${detailInfo})`
  }

  if (params && typeof result === 'string') {
    for (const [k, v] of Object.entries(params)) {
      result = result.replace(new RegExp(`\{${k}\}`, 'g'), String(v))
    }
  }

  return result
}

export async function setLang(code: string) {
  if (dicts[code]) {
    currentLang.value = code
    if (window.electron && window.electron.invoke) {
      await window.electron.invoke('sys:set-config', 'app_lang', code)
    }
  }
}

export async function initLang() {
  if (window.electron && window.electron.invoke) {
    const saved = await window.electron.invoke('sys:get-config', 'app_lang')
    if (saved && dicts[saved]) {
      currentLang.value = saved
    }
  }
}

export function getCurrentLang() {
  return currentLang.value
}