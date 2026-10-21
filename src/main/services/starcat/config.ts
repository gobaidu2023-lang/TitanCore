import { UpgradeCard } from './types'

export const ASSET_PATHS = {
  catIdle: { dir: '/games/starcat/cat_idle', prefix: 'cat_idle_', count: 19 },
  catAtk: { dir: '/games/starcat/cat_atk', prefix: 'cat_atk_', count: 11 },
  npcIdle: { dir: '/games/starcat/npc_idle', prefix: 'npc_idle_', count: 41 },
  bossIdle: { dir: '/games/starcat/boss_idle', prefix: 'boss_idle_', count: 34 },
  bossAtk1: { dir: '/games/starcat/boss_atk1', prefix: 'boss_atk1_', count: 31 },
  bossAtk2: { dir: '/games/starcat/boss_atk2', prefix: 'boss_atk2_', count: 41 }
}

// 第一关进入 Boss 的战术积分阈值
export const STAGE1_BOSS_TRIGGER_SCORE = 2000

// 关卡 3 决战标准配置
export const STAGE3_BOSS_CONFIG = {
  targetX: 1440,
  y: 540,
  scale: 2.8,
  hp: 75000,
  enrageHp: 15000,
  meteorScale: 0.32
}

export const UPGRADE_CARDS_STAGE_1: UpgradeCard[] = [
  {
    id: 'triple_shot',
    name: '分裂弹道',
    desc: '主炮升级为三重散射弹道，火力覆盖范围大幅提升',
    cost: 1000
  },
  {
    id: 'energy_shield',
    name: '能量护盾',
    desc: '受到伤害时触发 0.5 秒绝对无敌帧，避免连续受伤',
    cost: 1000
  },
  {
    id: 'star_cannon',
    name: '歼星炮',
    desc: '按 Q 消耗 80 能量发射缓慢飞行的湮灭光球，造成 750px 超大范围毁灭打击 (单轮弱点仅受 1 发暴击 7500 伤)',
    cost: 1000
  }
]

export const SECRET_SHOP_ITEMS = [
  { id: 'energy_recycle', name: '能量回收装置', desc: '能量自动恢复速度提升至 14 点/秒' },
  { id: 'energy_expand', name: '能量扩容装置', desc: '能量最大上限提升至 200 点' },
  { id: 'weapon_boost', name: '武器强化装置', desc: '子弹基础威力提升至 30 点 (+20 增伤)' }
]

export const SECRET_SHOP_BUNDLE_COST = 10000