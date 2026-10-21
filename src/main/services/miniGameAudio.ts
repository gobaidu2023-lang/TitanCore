/**
 * MiniGameAudio - 渲染进程音频捕获与频谱分析服务层
 * 
 * 从 App.vue 提取音频捕获 + 频谱分析逻辑。
 * 供 Vue 小游戏（如 RhythmHajimi）import 调用，替代各自独立的音频实现。
 * 
 * 提供:
 *   startCapture(opts?) / stopCapture()
 *   getBassEnergy() / getMidEnergy() / getTotalEnergy() / getFrequencyData()
 */

export interface AudioCaptureOptions {
  fftSize?: number
  smoothingTimeConstant?: number
  videoMaxWidth?: number
  videoMaxHeight?: number
  videoMaxFrameRate?: number
}

export interface AudioEnergy {
  bass: number
  mid: number
  high: number
  total: number
  bassRise: number
  midRise: number
  totalRise: number
}

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let mediaStream: MediaStream | null = null
let mediaSource: MediaStreamAudioSourceNode | null = null
let rafId = 0
let isCapturing = false
let isInitializing = false

let dataArray: Uint8Array = new Uint8Array(0)
let prevBass = 0
let prevMid = 0
let prevTotal = 0

let currentEnergy: AudioEnergy = {
  bass: 0, mid: 0, high: 0, total: 0,
  bassRise: 0, midRise: 0, totalRise: 0
}

/**
 * 启动桌面音频捕获与频谱分析
 */
export async function startCapture(options: AudioCaptureOptions = {}): Promise<void> {
  if (isCapturing || isInitializing) return
  isInitializing = true

  const {
    fftSize = 256,
    smoothingTimeConstant = 0.3,
    videoMaxWidth = 64,
    videoMaxHeight = 64,
    videoMaxFrameRate = 1
  } = options

  try {
    // 彻底清理旧资源，防止竞态和 InvalidStateError
    await stopCapture()

    let sourceId = ''
    if ((window as any).electron?.sys?.getDesktopAudioSource) {
      sourceId = await Promise.race([
        (window as any).electron.sys.getDesktopAudioSource(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Audio timeout')), 5000))
      ])
    }

    const constraints: any = sourceId
      ? {
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxWidth: videoMaxWidth,
              maxHeight: videoMaxHeight,
              maxFrameRate: videoMaxFrameRate
            }
          }
        }
      : { audio: true, video: false }

    const rawStream = await navigator.mediaDevices.getUserMedia(constraints)

    // 如果启动过程中被中断，清理并退出
    if (!isInitializing) {
      rawStream.getTracks().forEach(t => t.stop())
      return
    }

    // 移除视频轨道，仅保留音频
    if (sourceId) {
      rawStream.getVideoTracks().forEach(track => {
        track.stop()
        rawStream.removeTrack(track)
      })
    }

    const audioTracks = rawStream.getAudioTracks()
    if (audioTracks.length === 0) {
      throw new Error('no_audio')
    }

    mediaStream = new MediaStream(audioTracks)
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = smoothingTimeConstant

    mediaSource = audioCtx.createMediaStreamSource(mediaStream)
    mediaSource.connect(analyser)

    dataArray = new Uint8Array(analyser.frequencyBinCount)

    isCapturing = true
    isInitializing = false

    // 启动分析循环
    analyzeLoop()
  } catch (e: any) {
    isCapturing = false
    isInitializing = false
    console.warn('[MiniGameAudio] 桌面音频捕获失败:', e)

    // Fallback：尝试麦克风模式
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStream = s
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = fftSize
      analyser.smoothingTimeConstant = smoothingTimeConstant
      mediaSource = audioCtx.createMediaStreamSource(s)
      mediaSource.connect(analyser)
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      isCapturing = true
      isInitializing = false
      analyzeLoop()
    } catch (fallbackErr: any) {
      isInitializing = false
      console.error('[MiniGameAudio] 麦克风 fallback 也失败:', fallbackErr)
      throw fallbackErr
    }
  }
}

/**
 * 停止音频捕获并释放所有资源
 */
export async function stopCapture(): Promise<void> {
  isCapturing = false
  isInitializing = false
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  mediaSource?.disconnect()
  mediaStream?.getTracks().forEach(t => t.stop())

  if (audioCtx && audioCtx.state !== 'closed') {
    try { await audioCtx.close() } catch {}
  }

  audioCtx = null
  analyser = null
  mediaSource = null
  mediaStream = null
  dataArray = new Uint8Array(0)

  prevBass = 0
  prevMid = 0
  prevTotal = 0

  currentEnergy = {
    bass: 0, mid: 0, high: 0, total: 0,
    bassRise: 0, midRise: 0, totalRise: 0
  }
}

function analyzeLoop() {
  if (!isCapturing || !analyser) return
  rafId = requestAnimationFrame(analyzeLoop)

  analyser.getByteFrequencyData(dataArray)

  // 与 RhythmHajimi 频段划分对齐: bass[0,8), mid[8,32), high[32,64)
  const bassEnd = Math.min(8, dataArray.length)
  let b = 0
  for (let i = 0; i < bassEnd; i++) b += dataArray[i]
  b = bassEnd > 0 ? b / bassEnd / 255 : 0

  const midEnd = Math.min(32, dataArray.length)
  let m = 0
  for (let i = 8; i < midEnd; i++) m += dataArray[i]
  m = midEnd > 8 ? m / (midEnd - 8) / 255 : 0

  const highEnd = Math.min(64, dataArray.length)
  let h = 0
  for (let i = 32; i < highEnd; i++) h += dataArray[i]
  h = highEnd > 32 ? h / (highEnd - 32) / 255 : 0

  // 总能量（均方根）
  let t = 0
  for (let i = 0; i < dataArray.length; i++) {
    t += dataArray[i] * dataArray[i]
  }
  t = dataArray.length > 0 ? t / dataArray.length / 65025 : 0

  const bassRise = b - prevBass
  const midRise = m - prevMid
  const totalRise = t - prevTotal

  prevBass = b
  prevMid = m
  prevTotal = t

  currentEnergy = { bass: b, mid: m, high: h, total: t, bassRise, midRise, totalRise }
}

/** 获取当前低频能量 0-1 */
export function getBassEnergy(): number { return currentEnergy.bass }

/** 获取当前中频能量 0-1 */
export function getMidEnergy(): number { return currentEnergy.mid }

/** 获取当前高频能量 0-1 */
export function getHighEnergy(): number { return currentEnergy.high }

/** 获取当前总能量 0-1 */
export function getTotalEnergy(): number { return currentEnergy.total }

/** 获取当前低频相对上一帧的变化量 */
export function getBassRise(): number { return currentEnergy.bassRise }

/** 获取当前中频相对上一帧的变化量 */
export function getMidRise(): number { return currentEnergy.midRise }

/** 获取当前总能量相对上一帧的变化量 */
export function getTotalRise(): number { return currentEnergy.totalRise }

/** 获取完整的频谱数据副本（Uint8Array，长度 = frequencyBinCount） */
export function getFrequencyData(): Uint8Array {
  if (!analyser || dataArray.length === 0) return new Uint8Array(0)
  return new Uint8Array(dataArray)
}

/** 是否正在捕获音频 */
export function isActive(): boolean { return isCapturing }
