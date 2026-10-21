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
    tcToast('主号安全保护已激活', `当前账号${acc}不在白名单，已纯原生启动并隔绝辅助`, 'info')
    return
  }

  // 1. 成功：原生干净启动
  if (res.native && res.success) {
    tcToast('Steam 已纯原生干净启动', '已隔绝辅助，网游零封号风险', 'success')
    return
  }

  // 2. 成功：辅助挂载并握手成功
  if (res.success && res.handshake) {
    tcToast('Steam 辅助环境已就绪', '纯净隔离模式已激活', 'success')
    return
  }

  // 3. 成功：经典模式普通启动
  if (res.success && !res.degraded && !res.error) {
    tcToast('Steam 客户端已成功启动', '', 'success')
    return
  }

  // 4. 降级：Steam 启动了，但辅助未能挂载
  if (res.success && res.degraded) {
    let errorDetail = ''
    if (res.error === 'HANDSHAKE_TIMEOUT') {
      errorDetail = '挂起注入握手超时（通常为杀毒软件阻止进程通信或系统卡顿）'
    } else if (res.error === 'NATIVE_MISSING') {
      errorDetail = '原生注入引擎模块丢失 (tc_native.node)'
    } else if (res.error === 'DLL_MISSING') {
      errorDetail = '底座工具文件缺失 (OpenSteamTool.dll)'
    } else {
      errorDetail = res.error || '未知降级原因'
    }

    Swal.fire({
      icon: 'warning',
      title: 'Steam 已启动，但辅助未能挂载',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #d1d5db;">
          <p style="margin-bottom: 8px;">系统已为您自动降级为<strong style="color: #10b981;">官方原版环境</strong>启动 Steam，本次运行将不会生效单机辅助。</p>
          <div style="background: rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 8px; margin-bottom: 10px; font-family: monospace; font-size: 12px; color: #f59e0b;">
            检测详情: ${errorDetail}
          </div>
          <p style="font-weight: bold; margin-bottom: 4px; color: #fff;">💡 排查与解决方案建议：</p>
          <ol style="padding-left: 18px; margin: 0; color: #9ca3af;">
            <li>可点击下方【运行系统自检】快速排查环境与权限；</li>
            <li>检查 Windows Defender 或杀毒软件是否拦截了注入文件；</li>
            <li>若注入被系统安全软件持续阻断，可在【设置中心】切换为经典模式。</li>
          </ol>
        </div>
      `,
      confirmButtonText: '我知道了',
      showDenyButton: true,
      denyButtonText: '运行系统自检',
      showCancelButton: Boolean(onRetry),
      cancelButtonText: '重试启动',
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
      failReason = '未能在系统中找到 steam.exe'
      solution = '请前往【设置中心 - 宿主环境】手动指定您的 Steam 安装根目录。'
    } else if (res.error === 'STEAM_STILL_RUNNING') {
      failReason = 'Steam 仍在后台运行，强杀进程超时'
      solution = '请打开任务管理器强制结束 steam.exe 进程后重试。'
    } else if (res.error === 'BUSY') {
      failReason = '已有启动或重启任务正在进行中'
      solution = '请稍等数秒，避免频繁重复点击。'
    } else {
      failReason = res.error ? t(res.error) : '系统调用异常'
      solution = '建议点击【运行系统自检】排查原因，或重新启动电脑。'
    }

    Swal.fire({
      icon: 'error',
      title: '启动 Steam 失败',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #d1d5db;">
          <p style="color: #f87171; font-weight: bold; margin-bottom: 6px;">原因: ${failReason}</p>
          <p style="color: #9ca3af;">💡 解决指引: ${solution}</p>
        </div>
      `,
      confirmButtonText: '确定',
      showDenyButton: true,
      denyButtonText: '运行系统自检',
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
