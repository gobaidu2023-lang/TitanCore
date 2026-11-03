import { ref } from 'vue'
import Swal from 'sweetalert2'
import { tcToast } from '../utils/tcToast'
import { t } from '../i18n'

export type AntiCheatLaunchPreference = 'ask' | 'native' | 'inject'

const PREF_KEY = 'tc_anti_cheat_launch_pref'

// 全局单例状态，确保顶栏与各页面共享同一套弹窗感知
const isSteamLaunching = ref(false)
const showAntiCheatModal = ref(false)
const detectedAntiCheatGames = ref<string[]>([])
let pendingCallbacks: { onSuccess?: (res: any) => void; onError?: (err: any) => void } | null = null

export function handleLaunchFeedback(res: any, onRetry?: () => void) {
  if (!res) return

  // 0. 主号保护启动（账号不在白名单，未注入，纯原生环境）
  if (res.protected && res.success) {
    const acc = res.accountName ? ` (${res.accountName})` : ''
    tcToast(t('steam.launcher.protectedTitle'), t('steam.launcher.protectedDesc', { acc }), 'info')
    return
  }

  // 1. 成功：原生干净启动
  if (res.native && res.success) {
    tcToast(t('steam.launcher.nativeTitle'), t('steam.launcher.nativeDesc'), 'success')
    return
  }

  // 2. 成功：辅助挂载并握手成功
  if (res.success && res.handshake) {
    tcToast(t('steam.launcher.readyTitle'), t('steam.launcher.readyDesc'), 'success')
    return
  }

  // 3. 成功：经典模式普通启动
  if (res.success && !res.degraded && !res.error) {
    tcToast(t('steam.launcher.successTitle'), '', 'success')
    return
  }

  // 4. 降级：Steam 启动了，但辅助未能挂载
  if (res.success && res.degraded) {
    let errorDetail = ''
    if (res.error === 'HANDSHAKE_TIMEOUT') {
      errorDetail = t('steam.launcher.degHandshake')
    } else if (res.error === 'NATIVE_MISSING') {
      errorDetail = t('steam.launcher.degNative')
    } else if (res.error === 'DLL_MISSING') {
      errorDetail = t('steam.launcher.degDll')
    } else {
      errorDetail = res.error || t('steam.launcher.degUnknown')
    }

    Swal.fire({
      icon: 'warning',
      title: t('steam.launcher.degradedTitle'),
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #d1d5db;">
          <p style="margin-bottom: 8px;">${t('steam.launcher.degradedDesc')}</p>
          <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; font-family: monospace; font-size: 12px; color: #f59e0b;">
            ${t('steam.launcher.detectDetail')}: ${errorDetail}
          </div>
          <p style="font-weight: bold; margin-bottom: 4px; color: #fff;">${t('steam.launcher.solTitle')}</p>
          <ol style="padding-left: 18px; margin: 0; color: #9ca3af;">
            <li>${t('steam.launcher.sol1')}</li>
            <li>${t('steam.launcher.sol2')}</li>
            <li>${t('steam.launcher.sol3')}</li>
          </ol>
        </div>
      `,
      confirmButtonText: t('steam.launcher.iKnow'),
      showDenyButton: true,
      denyButtonText: t('steam.launcher.runDiagnostics'),
      showCancelButton: Boolean(onRetry),
      cancelButtonText: t('steam.launcher.retry'),
      background: '#0f172a',
      color: '#fff',
      confirmButtonColor: '#00f3ff',
      denyButtonColor: '#3b82f6',
      cancelButtonColor: '#334155',
      customClass: {
        popup: 'rounded-2xl border border-white/10 shadow-2xl'
      }
    }).then((result) => {
      if (result.isDenied) {
        window.dispatchEvent(new CustomEvent('titan-navigate', { detail: 'settings' }))
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('titan:open-diagnostics'))
        }, 200)
      } else if (result.dismiss === Swal.DismissReason.cancel && onRetry) {
        onRetry()
      }
    })
    return
  }

  // 5. 启动彻底失败
  if (!res.success) {
    let failReason = ''
    let solution = ''

    if (res.error === 'STEAM_NOT_FOUND') {
      failReason = t('steam.launcher.errNotFound')
      solution = t('steam.launcher.solNotFound')
    } else if (res.error === 'STEAM_STILL_RUNNING') {
      failReason = t('steam.launcher.errStillRunning')
      solution = t('steam.launcher.solStillRunning')
    } else if (res.error === 'BUSY') {
      failReason = t('steam.launcher.errBusy')
      solution = t('steam.launcher.solBusy')
    } else {
      failReason = res.error ? t(res.error) : t('steam.launcher.errSystem')
      solution = t('steam.launcher.solSystem')
    }

    Swal.fire({
      icon: 'error',
      title: t('steam.launcher.failTitle'),
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #d1d5db;">
          <p style="color: #f87171; font-weight: bold; margin-bottom: 6px;">${t('steam.launcher.reasonLabel')}: ${failReason}</p>
          <p style="color: #9ca3af;">${t('steam.launcher.solLabel')}: ${solution}</p>
        </div>
      `,
      confirmButtonText: t('steam.launcher.confirm'),
      showDenyButton: true,
      denyButtonText: t('steam.launcher.runDiagnostics'),
      background: '#0f172a',
      color: '#fff',
      confirmButtonColor: '#ef4444',
      denyButtonColor: '#3b82f6'
    }).then((result) => {
      if (result.isDenied) {
        window.dispatchEvent(new CustomEvent('titan-navigate', { detail: 'settings' }))
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('titan:open-diagnostics'))
        }, 200)
      }
    })
  }
}

export function useSteamLauncher() {
  const getLaunchPreference = (): AntiCheatLaunchPreference => {
    return 'inject'
  }

  const setLaunchPreference = (_pref: AntiCheatLaunchPreference) => {
    // 兼容空实现
  }

  const executeLaunchNative = async (showFeedback = true) => {
    isSteamLaunching.value = true
    let res: any = null
    try {
      res = await (window as any).electron?.ost?.launchSteamNative()
    } catch (e: any) {
      res = { success: false, error: e?.message || 'LAUNCH_NATIVE_IPC_ERROR' }
    } finally {
      isSteamLaunching.value = false
    }

    if (showFeedback && res) {
      try {
        handleLaunchFeedback(res)
      } catch (uiErr) {
        console.warn('[useSteamLauncher] UI feedback error:', uiErr)
      }
    }

    if (res?.success) {
      pendingCallbacks?.onSuccess?.(res)
    } else {
      pendingCallbacks?.onError?.(res)
    }
    pendingCallbacks = null
    return res
  }

  const executeLaunchAssisted = async (showFeedback = true) => {
    isSteamLaunching.value = true
    let res: any = null
    try {
      res = await (window as any).electron?.ost?.launchSteam()
    } catch (e: any) {
      res = { success: false, error: e?.message || 'LAUNCH_IPC_ERROR' }
    } finally {
      isSteamLaunching.value = false
    }

    if (showFeedback && res) {
      try {
        handleLaunchFeedback(res, () => executeLaunchAssisted(true))
      } catch (uiErr) {
        console.warn('[useSteamLauncher] UI feedback error:', uiErr)
      }
    }

    if (res?.success) {
      pendingCallbacks?.onSuccess?.(res)
    } else {
      pendingCallbacks?.onError?.(res)
    }
    pendingCallbacks = null
    return res
  }

  const launchSteamWithGuard = async (callbacks?: {
    onSuccess?: (res: any) => void
    onError?: (err: any) => void
    silentSuccess?: boolean
  }) => {
    if (isSteamLaunching.value) return
    pendingCallbacks = callbacks || null
    const showFeedback = !callbacks?.silentSuccess

    // 纯净模式已具备零文件污染与降权隔离，直接无感启动，无需弹窗扰民
    return await executeLaunchAssisted(showFeedback)
  }

  const handleChooseNative = async () => {
    showAntiCheatModal.value = false
    return await executeLaunchNative(true)
  }

  const handleChooseAssisted = async () => {
    showAntiCheatModal.value = false
    return await executeLaunchAssisted(true)
  }

  const handleCloseModal = () => {
    showAntiCheatModal.value = false
    pendingCallbacks = null
  }

  return {
    isSteamLaunching,
    showAntiCheatModal,
    detectedAntiCheatGames,
    getLaunchPreference,
    setLaunchPreference,
    launchSteamWithGuard,
    handleChooseNative,
    handleChooseAssisted,
    handleCloseModal
  }
}
