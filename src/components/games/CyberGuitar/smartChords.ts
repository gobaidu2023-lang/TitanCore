// smartChords.ts
// 【CyberGuitar 智能多节拍和弦与电子编曲伴奏引擎 (Smart Multi-Beat Chord Workstation)】
// 核心逻辑：按电子琴与电吉他编曲键盘模式，玩家按一个键点一下，触发一整套多节拍吉他 Riff 与完整和弦，彻底告别单音敲击！

export interface RiffNoteAction {
  offsetBeat: number; // 相对拍子偏移 (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5)
  stringIndex: number; // 弹奏哪根琴弦 (0~5)
  freq: number;        // 具体音高频率 (Hz)
  velocity: number;    // 力度
  strum?: boolean;     // 是否触发扫弦
}

export interface SmartChordPad {
  key: string;         // '1', '2', '3', '4'
  name: string;        // 如 "主和弦 Riff (E Major)"
  roman: string;       // "I 级", "IV 级", "V 级", "vi 级"
  desc: string;        // 情绪描述
  color: string;
  notes: RiffNoteAction[]; // 4 拍完整吉他 Riff 节奏切片
}

export interface StyleArrangement {
  id: string;
  name: string;
  referenceMp3: string; // 参考的官方 MP3
  bpm: number;
  toneMode: 'ambient' | 'rock_distortion';
  description: string;
  drumLoop: {
    beat: number;
    drums: ('kick' | 'snare' | 'hat' | 'tom')[];
  }[];
  pads: SmartChordPad[];
}

// 基于项目根目录 6 首 MP3 精心提炼的 3 套经典电子编曲工作站风格
export const SMART_STYLES: StyleArrangement[] = [
  // =========================================================================
  // 风格 1：【星辰极光 · 赛博电音】(Align the Stars / Catch the Starlight)
  // 参考曲目：Align_the_Stars.mp3 (128 BPM) / Catch_the_Starlight.mp3
  // 风格特点：空灵琶音、大调浪漫、多节拍吉他流水线条
  // =========================================================================
  {
    id: 'align_stars',
    name: '星辰极光 (Align the Stars)',
    referenceMp3: 'Align_the_Stars.mp3 (128 BPM)',
    bpm: 128,
    toneMode: 'ambient',
    description: '🌿 赛博空灵 · 梦幻琶音流水线与电影感和弦',
    drumLoop: [
      { beat: 0,   drums: ['kick', 'hat'] },
      { beat: 1,   drums: ['hat'] },
      { beat: 2,   drums: ['snare', 'hat'] },
      { beat: 3,   drums: ['hat'] },
      { beat: 3.5, drums: ['kick'] }
    ],
    pads: [
      {
        key: 'Q',
        name: '晨曦极光 (E Maj Riff)',
        roman: 'I 级主和弦',
        desc: '温暖广袤，清澈分解琶音流水',
        color: '#38bdf8',
        notes: [
          { offsetBeat: 0,   stringIndex: 5, freq: 82.41,  velocity: 0.95 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 164.81, velocity: 0.8 },
          { offsetBeat: 1,   stringIndex: 2, freq: 196.00, velocity: 0.85 },
          { offsetBeat: 1.5, stringIndex: 1, freq: 246.94, velocity: 0.8 },
          { offsetBeat: 2,   stringIndex: 0, freq: 369.99, velocity: 0.9, strum: true },
          { offsetBeat: 2.5, stringIndex: 1, freq: 246.94, velocity: 0.75 },
          { offsetBeat: 3,   stringIndex: 2, freq: 196.00, velocity: 0.8 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 164.81, velocity: 0.75 }
        ]
      },
      {
        key: 'W',
        name: '梦境巡航 (A Add9 Riff)',
        roman: 'IV 级上扬',
        desc: '开阔空灵，宛如掠过云海',
        color: '#818cf8',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 110.00, velocity: 0.95 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 164.81, velocity: 0.8 },
          { offsetBeat: 1,   stringIndex: 1, freq: 246.94, velocity: 0.85 },
          { offsetBeat: 1.5, stringIndex: 0, freq: 369.99, velocity: 0.9 },
          { offsetBeat: 2,   stringIndex: 2, freq: 220.00, velocity: 0.88, strum: true },
          { offsetBeat: 2.5, stringIndex: 0, freq: 369.99, velocity: 0.8 },
          { offsetBeat: 3,   stringIndex: 1, freq: 246.94, velocity: 0.85 },
          { offsetBeat: 3.5, stringIndex: 2, freq: 220.00, velocity: 0.75 }
        ]
      },
      {
        key: 'E',
        name: '动力跃迁 (B Sus4 Riff)',
        roman: 'V 级动力',
        desc: '情绪推进，期待感拉满',
        color: '#c084fc',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 123.47, velocity: 1.0 },
          { offsetBeat: 0.5, stringIndex: 2, freq: 196.00, velocity: 0.8 },
          { offsetBeat: 1,   stringIndex: 1, freq: 246.94, velocity: 0.85 },
          { offsetBeat: 1.5, stringIndex: 0, freq: 329.63, velocity: 0.9 },
          { offsetBeat: 2,   stringIndex: 0, freq: 369.99, velocity: 0.95, strum: true },
          { offsetBeat: 2.5, stringIndex: 1, freq: 246.94, velocity: 0.8 },
          { offsetBeat: 3,   stringIndex: 2, freq: 196.00, velocity: 0.85 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 164.81, velocity: 0.8 }
        ]
      },
      {
        key: 'R',
        name: '星云深处 (C# Min Riff)',
        roman: 'vi 级抒情',
        desc: '深邃治愈，优美小调回声',
        color: '#f472b6',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 138.59, velocity: 0.95 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 164.81, velocity: 0.8 },
          { offsetBeat: 1,   stringIndex: 2, freq: 207.65, velocity: 0.85 },
          { offsetBeat: 1.5, stringIndex: 1, freq: 246.94, velocity: 0.8 },
          { offsetBeat: 2,   stringIndex: 0, freq: 329.63, velocity: 0.9, strum: true },
          { offsetBeat: 2.5, stringIndex: 1, freq: 246.94, velocity: 0.75 },
          { offsetBeat: 3,   stringIndex: 2, freq: 207.65, velocity: 0.8 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 164.81, velocity: 0.75 }
        ]
      }
    ]
  },

  // =========================================================================
  // 风格 2：【疾驰路障 · 重金属摇滚】(Beyond the Barricade / Iron Hearts Rising)
  // 参考曲目：Beyond_the_Barricade.mp3 (138 BPM) / Iron_Hearts_Rising.mp3
  // 风格特点：失真电吉他、Drop D 强力和弦扫弦、双踩轰鸣、重击 Riff
  // =========================================================================
  {
    id: 'barricade_rock',
    name: '疾驰路障 (Beyond Barricade)',
    referenceMp3: 'Beyond_the_Barricade.mp3 (138 BPM)',
    bpm: 138,
    toneMode: 'rock_distortion',
    description: '🎸 硬核摇滚 · 失真电吉他重音扫弦与双踩狂飙',
    drumLoop: [
      { beat: 0,   drums: ['kick', 'hat'] },
      { beat: 0.5, drums: ['kick'] },
      { beat: 1,   drums: ['hat'] },
      { beat: 2,   drums: ['snare', 'kick'] },
      { beat: 3,   drums: ['hat'] },
      { beat: 3.5, drums: ['kick'] }
    ],
    pads: [
      {
        key: 'Q',
        name: '重装出击 (D5 Power Riff)',
        roman: '主音强力和弦',
        desc: '低音粗犷咆哮，重型重击下扫',
        color: '#f43f5e',
        notes: [
          { offsetBeat: 0,   stringIndex: 5, freq: 73.42,  velocity: 1.15, strum: true },
          { offsetBeat: 0.5, stringIndex: 5, freq: 73.42,  velocity: 1.0 },
          { offsetBeat: 1,   stringIndex: 4, freq: 110.00, velocity: 1.05 },
          { offsetBeat: 1.5, stringIndex: 5, freq: 73.42,  velocity: 0.95 },
          { offsetBeat: 2,   stringIndex: 3, freq: 146.83, velocity: 1.15, strum: true },
          { offsetBeat: 2.5, stringIndex: 4, freq: 110.00, velocity: 1.0 },
          { offsetBeat: 3,   stringIndex: 2, freq: 185.00, velocity: 1.1 },
          { offsetBeat: 3.5, stringIndex: 1, freq: 220.00, velocity: 1.2 }
        ]
      },
      {
        key: 'W',
        name: '突破封锁 (G5 Punch Riff)',
        roman: 'IV 级冲击',
        desc: '冲击感强力扫弦，穿透空气',
        color: '#fb7185',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 98.00,  velocity: 1.15, strum: true },
          { offsetBeat: 0.5, stringIndex: 4, freq: 98.00,  velocity: 1.0 },
          { offsetBeat: 1,   stringIndex: 3, freq: 146.83, velocity: 1.05 },
          { offsetBeat: 1.5, stringIndex: 2, freq: 196.00, velocity: 1.1 },
          { offsetBeat: 2,   stringIndex: 1, freq: 246.94, velocity: 1.2, strum: true },
          { offsetBeat: 2.5, stringIndex: 2, freq: 196.00, velocity: 1.05 },
          { offsetBeat: 3,   stringIndex: 3, freq: 146.83, velocity: 1.1 },
          { offsetBeat: 3.5, stringIndex: 4, freq: 98.00,  velocity: 1.0 }
        ]
      },
      {
        key: 'E',
        name: '炽热过载 (A5 Shred Riff)',
        roman: 'V 级高燃',
        desc: '高音推弦撕裂，暴走爆发',
        color: '#fbbf24',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 110.00, velocity: 1.2, strum: true },
          { offsetBeat: 0.5, stringIndex: 3, freq: 164.81, velocity: 1.1 },
          { offsetBeat: 1,   stringIndex: 2, freq: 220.00, velocity: 1.15 },
          { offsetBeat: 1.5, stringIndex: 1, freq: 277.18, velocity: 1.2 },
          { offsetBeat: 2,   stringIndex: 0, freq: 369.99, velocity: 1.25, strum: true },
          { offsetBeat: 2.5, stringIndex: 1, freq: 277.18, velocity: 1.1 },
          { offsetBeat: 3,   stringIndex: 2, freq: 220.00, velocity: 1.15 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 164.81, velocity: 1.05 }
        ]
      },
      {
        key: 'R',
        name: '钢铁之心 (B5 Drop Riff)',
        roman: 'vi 级厚重',
        desc: '沉重金属压迫感，低频重锤',
        color: '#f97316',
        notes: [
          { offsetBeat: 0,   stringIndex: 5, freq: 82.41,  velocity: 1.2, strum: true },
          { offsetBeat: 0.5, stringIndex: 5, freq: 82.41,  velocity: 1.05 },
          { offsetBeat: 1,   stringIndex: 4, freq: 123.47, velocity: 1.1 },
          { offsetBeat: 1.5, stringIndex: 3, freq: 164.81, velocity: 1.1 },
          { offsetBeat: 2,   stringIndex: 2, freq: 196.00, velocity: 1.2, strum: true },
          { offsetBeat: 2.5, stringIndex: 3, freq: 164.81, velocity: 1.05 },
          { offsetBeat: 3,   stringIndex: 4, freq: 123.47, velocity: 1.1 },
          { offsetBeat: 3.5, stringIndex: 5, freq: 82.41,  velocity: 1.0 }
        ]
      }
    ]
  },

  // =========================================================================
  // 风格 3：【午夜深蓝 · 放克灵魂】(Midnight Motion / Falling Into Blue)
  // 参考曲目：Midnight_Motion.mp3 (110 BPM) / Falling_Into_Blue.mp3
  // 风格特点：切分音放克扫弦、Slap Bass 律动、灵动跳跃、复古都市
  // =========================================================================
  {
    id: 'midnight_funk',
    name: '午夜深蓝 (Midnight Motion)',
    referenceMp3: 'Midnight_Motion.mp3 (110 BPM)',
    bpm: 110,
    toneMode: 'ambient',
    description: '✨ 灵魂放克 · 16 分音符切分扫弦与弹性律动',
    drumLoop: [
      { beat: 0,   drums: ['kick', 'hat'] },
      { beat: 0.5, drums: ['hat'] },
      { beat: 1,   drums: ['snare'] },
      { beat: 1.5, drums: ['hat'] },
      { beat: 2,   drums: ['kick'] },
      { beat: 2.5, drums: ['hat'] },
      { beat: 3,   drums: ['snare', 'hat'] },
      { beat: 3.5, drums: ['tom'] }
    ],
    pads: [
      {
        key: 'Q',
        name: '放克弹跳 (Dm7 Funk Chop)',
        roman: '主调律动',
        desc: '清脆切分短扫，极致弹性',
        color: '#10b981',
        notes: [
          { offsetBeat: 0,   stringIndex: 5, freq: 73.42,  velocity: 1.0 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 146.83, velocity: 0.85 },
          { offsetBeat: 1,   stringIndex: 2, freq: 174.61, velocity: 0.9, strum: true },
          { offsetBeat: 1.5, stringIndex: 1, freq: 220.00, velocity: 0.8 },
          { offsetBeat: 2,   stringIndex: 0, freq: 261.63, velocity: 0.95 },
          { offsetBeat: 2.5, stringIndex: 2, freq: 174.61, velocity: 0.85, strum: true },
          { offsetBeat: 3,   stringIndex: 1, freq: 220.00, velocity: 0.9 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 146.83, velocity: 0.8 }
        ]
      },
      {
        key: 'W',
        name: '霓虹滑步 (Gm7 Slide Riff)',
        roman: 'IV 级滑音',
        desc: '半音滑步跳音，俏皮灵动',
        color: '#06b6d4',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 98.00,  velocity: 1.0 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 146.83, velocity: 0.85 },
          { offsetBeat: 1,   stringIndex: 2, freq: 196.00, velocity: 0.95, strum: true },
          { offsetBeat: 1.5, stringIndex: 1, freq: 233.08, velocity: 0.85 },
          { offsetBeat: 2,   stringIndex: 0, freq: 293.66, velocity: 0.95 },
          { offsetBeat: 2.5, stringIndex: 1, freq: 233.08, velocity: 0.85, strum: true },
          { offsetBeat: 3,   stringIndex: 2, freq: 196.00, velocity: 0.9 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 146.83, velocity: 0.8 }
        ]
      },
      {
        key: 'E',
        name: '灵魂微醺 (Am7 Soul Arp)',
        roman: 'v 级灵魂',
        desc: '微醺浪漫，都市夜幕感',
        color: '#6366f1',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 110.00, velocity: 1.0 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 164.81, velocity: 0.85 },
          { offsetBeat: 1,   stringIndex: 2, freq: 220.00, velocity: 0.9, strum: true },
          { offsetBeat: 1.5, stringIndex: 1, freq: 261.63, velocity: 0.85 },
          { offsetBeat: 2,   stringIndex: 0, freq: 329.63, velocity: 0.95 },
          { offsetBeat: 2.5, stringIndex: 1, freq: 261.63, velocity: 0.8, strum: true },
          { offsetBeat: 3,   stringIndex: 2, freq: 220.00, velocity: 0.85 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 164.81, velocity: 0.8 }
        ]
      },
      {
        key: 'R',
        name: '闪耀海岸 (BbMaj7 Dream)',
        roman: 'VI 级梦幻',
        desc: '大七和弦高级色彩，梦境回响',
        color: '#a855f7',
        notes: [
          { offsetBeat: 0,   stringIndex: 4, freq: 116.54, velocity: 1.0 },
          { offsetBeat: 0.5, stringIndex: 3, freq: 174.61, velocity: 0.85 },
          { offsetBeat: 1,   stringIndex: 2, freq: 220.00, velocity: 0.9, strum: true },
          { offsetBeat: 1.5, stringIndex: 1, freq: 261.63, velocity: 0.85 },
          { offsetBeat: 2,   stringIndex: 0, freq: 349.23, velocity: 0.95, strum: true },
          { offsetBeat: 2.5, stringIndex: 1, freq: 261.63, velocity: 0.85 },
          { offsetBeat: 3,   stringIndex: 2, freq: 220.00, velocity: 0.9 },
          { offsetBeat: 3.5, stringIndex: 3, freq: 174.61, velocity: 0.8 }
        ]
      }
    ]
  }
];
