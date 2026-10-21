// 文件名: src/stores/telemetryStore.ts
// Round23 修复：设备信息改为"鉴权就绪后"上报，修复看板设备明细全员"访客"虚高。
// 旧逻辑在模块初始化（应用启动瞬间）采集并 1.5s 后 flush，此时 autoLogin 尚未完成、
// 服务端 checkAuth 拿不到有效 token -> user_id=0 -> 记为访客。
// 新逻辑：auth:login-success / auth:bootstrap -> 带真实 uid 上报；
//         auth:ready-guest -> 访客身份上报（真实访客，非脏数据）；
//         15 秒兜底（离线/事件丢失）-> 照常采集。其余逻辑（去重/缓冲/flush/回滚）原样保留。
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTelemetryStore = defineStore('telemetry', () => {
  const eventBuffer = ref<any[]>([])
  let flushTimer: ReturnType<typeof setTimeout> | null = null

  // 30 秒防抖去重字典与时间阈值
  const DEDUP_MS = 30000
  const dedupMap = new Map<string, number>()

  // 遥测批量刷新周期：3 分钟 (180,000 ms)
  const FLUSH_INTERVAL = 180000

  // 标记当前生命周期内是否已上报设备硬件
  let isDeviceReported = false
  // Round23：当前设备事件是否以访客身份压入（登录态到达且仍在缓冲区内时可替换）
  let deviceReportedAsGuest = false
  // Round23：是否已收到任一鉴权就绪事件（登录/访客），供 15 秒兜底判定
  let authEventSeen = false

  function getDedupKey(event: any): string {
    const t = event.type
    if (t === 'search') return `s:${event.keyword}`
    if (t === 'page_view') return `p:${event.page_id}`
    if (t === 'device_info') return `d:hardware`
    return `o:${t}:${JSON.stringify(event)}`
  }

  // 浏览器与渲染层基础特征采集
  function collectBrowserFingerprint() {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    let canvasFp = ''
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('TitanFP' + Math.random(), 2, 2)
      canvasFp = canvas.toDataURL().slice(-16)
    }

    const fp: Record<string, any> = {
      screen: `${window.screen.width}x${window.screen.height}`,
      color_depth: window.screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      canvas_fp: canvasFp,
      webgl_vendor: '',
      webgl_renderer: ''
    }

    try {
      const gl = document.createElement('canvas').getContext('webgl')
      if (gl) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
        if (debugInfo) {
          fp.webgl_vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || ''
          fp.webgl_renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
        }
      }
    } catch {}

    return fp
  }

  // 用户打开客户端后上报一次设备硬件与运行环境
  // asGuest=true 表示当前无登录态，以访客身份如实上报
  async function reportDeviceInfo(asGuest = false) {
    if (isDeviceReported) return
    isDeviceReported = true
    deviceReportedAsGuest = asGuest

    let hw: any = null
    try {
      if ((window as any).electron?.sys?.getHardwareSpecs) {
        hw = await (window as any).electron.sys.getHardwareSpecs()
      }
    } catch (e) {
      console.warn('[Telemetry] 获取硬件信息异常:', e)
    }

    const fp = collectBrowserFingerprint()

    // Round23：原生通道拿到 Unknown GPU/CPU（识别失败）时视为无效，正确回退 WebGL 兜底
    const hwGpu = hw?.gpu && hw.gpu !== 'Unknown GPU' ? hw.gpu : ''
    const hwCpu = hw?.cpu && hw.cpu !== 'Unknown CPU' ? hw.cpu : ''

    const deviceEvent = {
      type: 'device_info',
      cpu: hwCpu || 'Unknown CPU',
      cpuCores: hw?.cpuCores || 0,
      gpu: hwGpu || fp.webgl_renderer || 'Unknown GPU',
      ram: hw?.ram || '',
      osVersion: hw?.osVersion || fp.platform || '',
      screen: fp.screen,
      timezone: fp.timezone,
      language: fp.language,
      canvas_fp: fp.canvas_fp,
      timestamp: Date.now()
    }

    push(deviceEvent)

    // 首次上报设备信息后，延迟 1.5 秒直接推送，避免用户快速退出导致设备信息丢失
    setTimeout(() => {
      flushNow()
    }, 1500)
  }

  // Round23：登录态就绪（自动登录/手动登录成功）-> 以真实 uid 上报设备信息
  function reportDeviceInfoOnAuthReady() {
    authEventSeen = true
    if (isDeviceReported) {
      // 兜底期已以访客身份压入、且尚未 flush：撤下访客事件，改投带登录态批次
      if (deviceReportedAsGuest) {
        const idx = eventBuffer.value.findIndex(e => e?.type === 'device_info')
        if (idx !== -1) {
          eventBuffer.value.splice(idx, 1)
          isDeviceReported = false
          deviceReportedAsGuest = false
          reportDeviceInfo(false)
        }
      }
      return
    }
    reportDeviceInfo(false)
  }

  // Round23：明确处于访客模式 -> 以访客身份上报（真实访客，不是脏数据）
  function reportDeviceInfoAsGuest() {
    authEventSeen = true
    if (isDeviceReported) return
    reportDeviceInfo(true)
  }

  // Round23：订阅鉴权就绪事件（preload 白名单已允许 auth: 前缀 on 通道）
  function wireAuthReadyListeners() {
    const bridge = (window as any).electron
    if (!bridge?.on) return
    try {
      bridge.on('auth:login-success', () => reportDeviceInfoOnAuthReady())
      bridge.on('auth:bootstrap', () => reportDeviceInfoOnAuthReady())
      bridge.on('auth:ready-guest', () => reportDeviceInfoAsGuest())
    } catch (e) {
      console.warn('[Telemetry] 鉴权就绪事件订阅失败:', e)
    }
  }

  // Round23：15 秒兜底——既无登录也无访客事件（离线/事件丢失）时仍照常采集；
  // 此时确无 token 可带，记为访客是真实状态
  setTimeout(() => {
    if (!authEventSeen && !isDeviceReported) {
      reportDeviceInfo(true)
    }
  }, 15000)

  // 搜索事件埋点
  function trackSearch(keyword: string, resultCount: number) {
    if (!keyword || keyword.trim().length === 0) return
    push({
      type: 'search',
      keyword: keyword.trim().substring(0, 50),
      result_count: resultCount,
      timestamp: Date.now()
    })
  }

  // 🟢 大厅业务事件通用埋点（安装点击/游戏启动/兑换等）
  // type 约定：lobby_install_click / lobby_game_launch / lobby_redeem
  function trackLobbyEvent(type: string, payload: Record<string, any> = {}) {
    if (!type) return
    push({
      type,
      ...payload,
      timestamp: Date.now()
    })
  }

  // 页面进入埋点
  function enterPage(pageId: string) {
    push({
      type: 'page_view',
      page_id: pageId,
      entry_time: Date.now()
    })
  }

  // 页面退出埋点（过滤低于 1 秒的误触）
  function exitPage(pageId: string, durationMs: number) {
    if (durationMs < 1000) return
    push({
      type: 'page_view',
      page_id: pageId,
      duration_ms: durationMs,
      exit_time: Date.now()
    })
  }

  // 压入事件缓冲区（30秒去重 + 缓冲区超量直接落盘）
  function push(event: any) {
    const key = getDedupKey(event)
    const now = Date.now()

    // 定期清除过期的去重键，防止内存泄漏
    for (const [k, t] of dedupMap.entries()) {
      if (now - t > DEDUP_MS * 2) {
        dedupMap.delete(k)
      }
    }

    const last = dedupMap.get(key)
    if (last && now - last < DEDUP_MS) {
      // 30秒内有相同操作：剔除缓冲区旧事件，保留最新数据
      const idx = eventBuffer.value.findIndex(e => getDedupKey(e) === key)
      if (idx !== -1) {
        eventBuffer.value.splice(idx, 1)
      }
    }
    dedupMap.set(key, now)
    eventBuffer.value.push(event)

    // 缓冲区达到 30 条直接触发上报，不用死等 3 分钟
    if (eventBuffer.value.length >= 30) {
      flushNow()
      return
    }

    // 软上限兜底，最多堆积 100 条
    if (eventBuffer.value.length > 100) {
      eventBuffer.value = eventBuffer.value.slice(-100)
    }

    scheduleFlush()
  }

  // 安排 3 分钟批次定时器
  function scheduleFlush() {
    if (flushTimer) return
    flushTimer = setTimeout(() => {
      flushNow()
    }, FLUSH_INTERVAL)
  }

  // 立即执行批量推送
  function flushNow() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = null
    }

    if (eventBuffer.value.length === 0) return

    const batch = [...eventBuffer.value]
    eventBuffer.value = []

    // 净化 Vue 响应式对象，防止 Electron structuredClone 序列化崩溃
    let clonedBatch: any[] = []
    try {
      clonedBatch = JSON.parse(JSON.stringify(batch))
    } catch (e) {
      console.warn('[TelemetryStore] 事件序列化失败:', e)
      return
    }

    if ((window as any).electron?.sys?.batchTelemetry) {
      (window as any).electron.sys.batchTelemetry(clonedBatch).catch(() => {
        // 网络通信故障回滚：旧数据排前，超长截断尾部（保旧弃新）
        eventBuffer.value = [...batch, ...eventBuffer.value]
        if (eventBuffer.value.length > 100) {
          eventBuffer.value = eventBuffer.value.slice(0, 100)
        }
      })
    }
  }

  // 窗口卸载前紧急冲洗数据
  window.addEventListener('beforeunload', () => {
    flushNow()
  })

  // Round23：订阅鉴权就绪事件（替代旧的"模块初始化即刻上报"）
  wireAuthReadyListeners()

  return {
    trackSearch,
    trackLobbyEvent,
    enterPage,
    exitPage,
    reportDeviceInfo,
    flushNow
  }
})
