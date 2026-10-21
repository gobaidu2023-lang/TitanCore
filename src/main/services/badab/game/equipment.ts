// equipment.ts 巴达布前哨 - 规则层：独立装备业务层（槽位规格、穿戴校验、持棒转职阻断与属性结算）
import { CardEntity } from '../engine/Stack'
import { getDef } from './cards'

export type EquipSlot = 'weapon' | 'armor'

export interface EquipItemConfig {
  id: string
  name: string
  slot: EquipSlot
  attackBonus: number
  hpBonus: number
}

/** 纯穿戴卡（2张）规格配置表；其余 6 张战略装备走配方消耗触媒路线 */
export const EQUIP_CONFIGS: Record<string, EquipItemConfig> = {
  scrap_club: {
    id: 'scrap_club',
    name: '废土管棒',
    slot: 'weapon',
    attackBonus: 1,
    hpBonus: 0
  },
  void_suit: {
    id: 'void_suit',
    name: '虚空服',
    slot: 'armor',
    attackBonus: 0,
    hpBonus: 6
  }
}

export interface EffectiveStats {
  attack: number
  attackBonus: number
  maxHp: number
  hpBonus: number
  weapons: string[]
  armors: string[]
}

/** 判定是否为当前允许直接穿戴的装备卡 */
export function isWearable(cardId: string): boolean {
  return cardId in EQUIP_CONFIGS
}

/** 校验目标人类单位是否可以穿戴指定装备 */
export function canEquip(unit: CardEntity, gearId: string): { ok: boolean; reason: string } {
  const def = getDef(unit.cardId)
  if (def.category !== 'unit') {
    return { ok: false, reason: '非人口单位无法穿戴装备' }
  }

  // 约束 1：婴儿禁穿
  if (unit.cardId === 'baby') {
    return { ok: false, reason: '婴儿无法穿戴任何装备' }
  }

  const gearConfig = EQUIP_CONFIGS[gearId]
  if (!gearConfig) {
    return { ok: false, reason: '此物品属于战略触媒，需通过合成配方使用' }
  }

  // 约束 2：单槽位排他（1武器 + 1防具）
  const equipped = unit.equippedGears || []
  for (const equippedId of equipped) {
    const cfg = EQUIP_CONFIGS[equippedId]
    if (cfg && cfg.slot === gearConfig.slot) {
      return { ok: false, reason: `已穿戴同类${gearConfig.slot === 'weapon' ? '武器' : '防具'}，不可重复装备` }
    }
  }

  return { ok: true, reason: '' }
}

/** 执行装备穿戴绑定与生命同步提升 */
export function applyEquip(unit: CardEntity, gearId: string): void {
  if (!unit.equippedGears) {
    unit.equippedGears = []
  }

  const gearConfig = EQUIP_CONFIGS[gearId]
  if (!gearConfig) return

  unit.equippedGears.push(gearId)

  // 穿戴防具（void_suit）时，生命上限 +6，当前 HP 同步 +6
  if (gearConfig.hpBonus > 0) {
    const baseHp = getDef(unit.cardId).hp || 10
    unit.maxHp = (unit.maxHp || baseHp) + gearConfig.hpBonus
    unit.hp = (unit.hp || baseHp) + gearConfig.hpBonus
  }
}

/** 校验单位是否持有武器（持棒平民转职阻断校验） */
export function hasWeaponEquipped(unit: CardEntity): boolean {
  const equipped = unit.equippedGears || []
  return equipped.some(gid => {
    const cfg = EQUIP_CONFIGS[gid]
    return cfg && cfg.slot === 'weapon'
  })
}

/** 实时结算单位包含装备加成后的真实属性与回显列表 */
export function getEffectiveStats(unit: CardEntity): EffectiveStats {
  const def = getDef(unit.cardId)
  const baseAtk = def.attack ?? 0
  const baseHp = def.hp ?? 0

  let attackBonus = 0
  let hpBonus = 0
  const weapons: string[] = []
  const armors: string[] = []

  const equipped = unit.equippedGears || []
  for (const gid of equipped) {
    const cfg = EQUIP_CONFIGS[gid]
    if (!cfg) continue

    attackBonus += cfg.attackBonus
    hpBonus += cfg.hpBonus

    if (cfg.slot === 'weapon') {
      weapons.push(cfg.name)
    } else if (cfg.slot === 'armor') {
      armors.push(cfg.name)
    }
  }

  return {
    attack: baseAtk + attackBonus,
    attackBonus,
    maxHp: baseHp + hpBonus,
    hpBonus,
    weapons,
    armors
  }
}