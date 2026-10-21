// CleanBeatInstrumentEngine.ts
// 【CyberGuitar 声学物理乐器与失真吉他引擎 (Kinetic Strings & Dual Tone Engine)】
// 灵感源自 1.html：彻底告别机械音游，还原自由和弦、物理震颤、自由打击乐与双重音色（空灵原声 + 摇滚失真）

export type GuitarToneMode = 'ambient' | 'rock_distortion';

export interface StringNote {
  label: string;
  freq: number;
  step: number;       // 五线谱音阶步进 (0 = E4)
  accidental: string; // '#' 或 ''
  color: string;
}

export interface TuningConfig {
  name: string;
  desc: string;
  notes: StringNote[];
}

// 4 种绝美调弦配置 (包含开放 Em9 仙品调弦与 Drop D 重金属摇滚调弦)
export const GUITAR_TUNINGS: TuningConfig[] = [
  {
    name: 'Open Em9 (空灵极光)',
    desc: '闭眼乱弹也是仙乐，大自然与电影感和弦',
    notes: [
      { label: 'F#4', freq: 369.99, step: 1, accidental: '#', color: '#38bdf8' },
      { label: 'B3',  freq: 246.94, step: -3, accidental: '',  color: '#818cf8' },
      { label: 'G3',  freq: 196.00, step: -5, accidental: '',  color: '#c084fc' },
      { label: 'E3',  freq: 164.81, step: -7, accidental: '',  color: '#f472b6' },
      { label: 'B2',  freq: 123.47, step: -10, accidental: '', color: '#fb923c' },
      { label: 'E2',  freq: 82.41,  step: -14, accidental: '', color: '#facc15' }
    ]
  },
  {
    name: 'Drop D (重金属摇滚)',
    desc: '强力失真和弦轰鸣，低音粗犷咆哮',
    notes: [
      { label: 'D4',  freq: 293.66, step: -1, accidental: '',  color: '#38bdf8' },
      { label: 'A3',  freq: 220.00, step: -4, accidental: '',  color: '#818cf8' },
      { label: 'F#3', freq: 185.00, step: -6, accidental: '#', color: '#f43f5e' },
      { label: 'D3',  freq: 146.83, step: -8, accidental: '',  color: '#fb7185' },
      { label: 'A2',  freq: 110.00, step: -11, accidental: '', color: '#fb923c' },
      { label: 'D2',  freq: 73.42,  step: -15, accidental: '', color: '#f59e0b' }
    ]
  },
  {
    name: 'Standard (流行原声标准)',
    desc: '民谣与流行经典吉他定弦',
    notes: [
      { label: 'E4',  freq: 329.63, step: 0,   accidental: '',  color: '#38bdf8' },
      { label: 'B3',  freq: 246.94, step: -3, accidental: '',  color: '#818cf8' },
      { label: 'G3',  freq: 196.00, step: -5, accidental: '',  color: '#c084fc' },
      { label: 'D3',  freq: 146.83, step: -8, accidental: '',  color: '#f472b6' },
      { label: 'A2',  freq: 110.00, step: -11, accidental: '', color: '#fb923c' },
      { label: 'E2',  freq: 82.41,  step: -14, accidental: '', color: '#facc15' }
    ]
  },
  {
    name: 'Cyber DADGAD (赛博异域)',
    desc: '充满科幻与探索感的奇幻全息和声',
    notes: [
      { label: 'D4',  freq: 293.66, step: -1, accidental: '',  color: '#22d3ee' },
      { label: 'A3',  freq: 220.00, step: -4, accidental: '',  color: '#38bdf8' },
      { label: 'G3',  freq: 196.00, step: -5, accidental: '',  color: '#a855f7' },
      { label: 'D3',  freq: 146.83, step: -8, accidental: '',  color: '#ec4899' },
      { label: 'A2',  freq: 110.00, step: -11, accidental: '', color: '#f97316' },
      { label: 'D2',  freq: 73.42,  step: -15, accidental: '', color: '#eab308' }
    ]
  }
];

/**
 * 产生平滑软削波失真曲线 (模拟真空管吉他过载踏板 Overdrive / Distortion)
 */
function makeDistortionCurve(amount = 25): Float32Array {
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export class KineticAudioEngine {
  private ctx: AudioContext | null = null;
  public masterGain: GainNode | null = null;
  public delayNode: DelayNode | null = null;
  public distortionNode: WaveShaperNode | null = null;
  public cabFilter: BiquadFilterNode | null = null;

  public toneMode: GuitarToneMode = 'ambient';

  private distortionCurve: Float32Array;

  constructor() {
    this.distortionCurve = makeDistortionCurve(35);
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    // 1. 立体声空间延时 (Stereo Ping-Pong Delay)
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.24;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.28;
    const delayFilter = this.ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2200;

    this.delayNode.connect(delayFilter);
    delayFilter.connect(feedback);
    feedback.connect(this.delayNode);

    // 2. 摇滚吉他箱体失真链 (Distortion + Cabinet Simulator)
    this.distortionNode = this.ctx.createWaveShaper();
    this.distortionNode.curve = this.distortionCurve;
    this.distortionNode.oversample = '4x';

    this.cabFilter = this.ctx.createBiquadFilter();
    this.cabFilter.type = 'lowpass';
    this.cabFilter.frequency.value = 3800; // 模拟吉他 4x12 箱体高频滚降
    this.cabFilter.Q.value = 1.2;

    this.distortionNode.connect(this.cabFilter);
    this.cabFilter.connect(this.masterGain);

    // 汇流到声卡输出
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.connect(this.delayNode);
    this.delayNode.connect(this.ctx.destination);
  }

  public setToneMode(mode: GuitarToneMode) {
    this.toneMode = mode;
  }

  /**
   * 拨动吉他琴弦 (支持空灵原声与电吉他失真双音色)
   */
  public playGuitarString(freq: number, velocity = 0.85) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    const out = this.ctx.createGain();
    const vel = Math.max(0.1, Math.min(1.2, velocity));

    if (this.toneMode === 'rock_distortion' && this.distortionNode) {
      // ==================== 摇滚电吉他失真音色 (Rock Shred Overdrive) ====================
      // 饱满强谐波双锯齿波 + 微失调厚重感
      const peak = Math.min(0.55, 0.15 + vel * 0.35);
      out.gain.setValueAtTime(0.001, now);
      out.gain.linearRampToValueAtTime(peak, now + 0.006);
      out.gain.exponentialRampToValueAtTime(0.0005, now + 2.8); // 保持更长的吉他推弦延音

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const oscSub = this.ctx.createOscillator();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      oscSub.type = 'triangle';

      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(6.5, now); // 微失调加宽声场
      oscSub.frequency.setValueAtTime(freq * 0.5, now); // 下八度加厚低频根音

      const preFilter = this.ctx.createBiquadFilter();
      preFilter.type = 'peaking';
      preFilter.frequency.setValueAtTime(1400, now);
      preFilter.gain.setValueAtTime(8, now); // 提亮金属拨弦中高频

      osc1.connect(preFilter);
      osc2.connect(preFilter);
      oscSub.connect(preFilter);

      preFilter.connect(out);
      out.connect(this.distortionNode); // 进入失真箱体链

      osc1.start(now);
      osc2.start(now);
      oscSub.start(now);

      osc1.stop(now + 2.85);
      osc2.stop(now + 2.85);
      oscSub.stop(now + 2.85);
    } else {
      // ==================== 空灵极光原声音色 (Ambient Dream - 1.html 经典质感) ====================
      const peak = Math.min(0.48, Math.max(0.1, vel * 0.38));
      out.gain.setValueAtTime(0.001, now);
      out.gain.linearRampToValueAtTime(peak, now + 0.008);
      out.gain.exponentialRampToValueAtTime(0.0008, now + 2.4);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(4, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2.6;
      filter.frequency.setValueAtTime(freq * 7.5, now);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.4);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(out);
      out.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.45);
      osc2.stop(now + 2.45);
    }
  }

  /**
   * 敲击合成鼓点 (底鼓、军鼓、踩镲、通鼓)
   */
  public playDrum(type: 'kick' | 'snare' | 'hat' | 'tom', velocity = 0.9) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const vel = Math.max(0.2, Math.min(1.2, velocity));

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.16);

      gain.gain.setValueAtTime(0.75 * vel, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.48);
    } else if (type === 'snare') {
      // 军鼓高频噪声
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.22);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(750, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.38 * vel, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);

      // 军鼓共鸣腔
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.1);
      oscGain.gain.setValueAtTime(0.4 * vel, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(oscGain);
      oscGain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'hat') {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.09);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(6800, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.32 * vel, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
    } else if (type === 'tom') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.26);

      gain.gain.setValueAtTime(0.5 * vel, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  }

  public destroy() {
    try {
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.close().catch(() => {});
        this.ctx = null;
      }
    } catch {}
  }
}
