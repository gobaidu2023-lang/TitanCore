import * as MiniGameAudio from '../miniGameAudio'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

/* ==================== 内置工业科幻 BGM 节拍引擎 ==================== */
let bgmInterval: number | null = null
let bgmStep = 0
let bgmBassEnergy = 0

export function startSynthBGM() {
  if (bgmInterval) return
  const bpm = 134
  const stepMs = (60 / bpm / 4) * 1000 // 16分音符节奏步进

  bgmInterval = window.setInterval(() => {
    bgmStep = (bgmStep + 1) % 16
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // 每拍重低音底鼓 (Kick Drum)
    if (bgmStep % 4 === 0) {
      playKick(ctx, now)
      bgmBassEnergy = 1.0
    } else {
      bgmBassEnergy = Math.max(0, bgmBassEnergy - 0.18)
    }

    // 工业合成电贝斯 (Synth Bass Pulse)
    if (bgmStep % 2 === 0) {
      playSynthBassNote(ctx, now, bgmStep)
    }
  }, stepMs)
}

export function stopSynthBGM() {
  if (bgmInterval) {
    clearInterval(bgmInterval)
    bgmInterval = null
  }
  bgmBassEnergy = 0
  bgmStep = 0
}

export function getSynthBass(): number {
  return bgmBassEnergy
}

function playKick(ctx: AudioContext, time: number) {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.setValueAtTime(140, time)
    osc.frequency.exponentialRampToValueAtTime(32, time + 0.14)
    gain.gain.setValueAtTime(0.35, time)
    gain.gain.linearRampToValueAtTime(0.001, time + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.15)
  } catch {}
}

function playSynthBassNote(ctx: AudioContext, time: number, step: number) {
  try {
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    const notes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42]
    const freq = notes[Math.floor(step / 2) % notes.length]
    osc.frequency.setValueAtTime(freq, time)
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(600, time)
    filter.frequency.exponentialRampToValueAtTime(120, time + 0.12)
    gain.gain.setValueAtTime(0.12, time)
    gain.gain.linearRampToValueAtTime(0.001, time + 0.12)
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.12)
  } catch {}
}

/* ==================== 战术交互与技能音效 ==================== */

export function playLaserSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(880, now)
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.07)
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.07)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.07)
  } catch {}
}

export function playCaptureSound(type: string) {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sine'
    const freqMap: Record<string, number> = {
      normal: 659.25,
      blue: 783.99,
      gold: 1046.5,
      red: 220,
      green: 523.25
    }
    const freq = freqMap[type] || 600
    osc.frequency.setValueAtTime(freq, now)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.4, now + 0.06)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.06)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.06)
  } catch {}
}

export function playShieldCrackSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(1100, now)
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.1)
    gain.gain.setValueAtTime(0.18, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.1)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.1)
  } catch {}
}

export function playBossExplodeSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(140, now)
    osc.frequency.exponentialRampToValueAtTime(25, now + 0.5)
    gain.gain.setValueAtTime(0.35, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.5)
  } catch {}
}

export function playCannonLaunchSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(150, now)
    osc.frequency.linearRampToValueAtTime(600, now + 0.25)
    gain.gain.setValueAtTime(0.25, now)
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.25)
  } catch {}
}

// 歼星炮金属撕裂爆炸音效
export function playCannonMetalTearSound() {
  try {
    const ctx = getAudioContext()
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime

    osc1.type = 'sawtooth'
    osc1.frequency.setValueAtTime(320, now)
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.4)

    osc2.type = 'square'
    osc2.frequency.setValueAtTime(950, now)
    osc2.frequency.exponentialRampToValueAtTime(60, now + 0.35)

    gain.gain.setValueAtTime(0.4, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.45)

    osc1.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)

    osc1.start(now)
    osc2.start(now)
    osc1.stop(now + 0.45)
    osc2.stop(now + 0.45)
  } catch {}
}

// Boss 巨拳捶地冲击波音效
export function playGroundSlamSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(180, now)
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35)
    gain.gain.setValueAtTime(0.45, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.35)
  } catch {}
}

// 地面等离子冲击波奔涌音效
export function playShockwaveSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(90, now)
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.3)
    gain.gain.setValueAtTime(0.3, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
  } catch {}
}

// 激光蓄力前摇高频警报 Telegraph 音效
export function playTelegraphSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'square'
    osc.frequency.setValueAtTime(620, now)
    osc.frequency.linearRampToValueAtTime(1240, now + 0.25)
    gain.gain.setValueAtTime(0.15, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
  } catch {}
}

// Boss 激光发射音效
export function playLaserBeamSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.linearRampToValueAtTime(880, now + 0.2)
    osc.frequency.linearRampToValueAtTime(220, now + 0.75)
    gain.gain.setValueAtTime(0.28, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.75)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.75)
  } catch {}
}

export function playSkillCheckHitSound() {
  try {
    const ctx = getAudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const now = ctx.currentTime
    osc.frequency.setValueAtTime(1318.51, now) // E6
    osc.frequency.setValueAtTime(1567.98, now + 0.08) // G6
    gain.gain.setValueAtTime(0.2, now)
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.3)
  } catch {}
}

export async function stopSynthAudio() {
  stopSynthBGM()
  if (audioCtx && audioCtx.state !== 'closed') {
    await audioCtx.close().catch(() => {})
  }
  audioCtx = null
}
