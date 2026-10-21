// types.ts 巴达布前哨 - 规则层共享类型

export type CardCategory =
  | 'unit'
  | 'resource_point'
  | 'material'
  | 'food'
  | 'corpse'
  | 'enemy'
  | 'building'
  | 'equipment'
  | 'location'
  | 'idea'
  | 'medical'
  | 'pack'

export type DamageType = 'physical' | 'magic' | 'true'
export type TraitType = 'none' | 'untouchable' | 'psyker'
export type TaxType = 'gold' | 'population' | 'seed'

export interface CardDef {
  id: string
  name: string
  category: CardCategory
  price: number
  unsellable?: boolean
  desc?: string

  satiety?: number
  foodPerMonth?: number
  uses?: number

  isVillager?: boolean
  isLabor?: boolean           // 劳动力标记：六类成年单位（平民/辅助军/修女/智库/刺客/阿斯塔特），可顶替配方中的 civilian 工位
  isOurCorpse?: boolean
  isOurUnit?: boolean
  canBreed?: boolean
  isUndraggable?: boolean

  // 战斗属性
  hp?: number
  attack?: number
  attackInterval?: number // 攻击间隔秒数（独立计时出刀）
  damageType?: DamageType
  isMagicImmune?: boolean
  isPhysicalImmune?: boolean

  capacityBonus?: number
  maxStorage?: number
  corruptionDelta?: number
  unlocksRecipe?: string
  isPack?: boolean

  // 帝国什一税军舰标记
  isTaxShip?: boolean
  taxShipType?: TaxType
  taxShipTarget?: number
  taxShipCurrent?: number
}

export interface TraitRequirement {
  cardId: string
  trait: 'untouchable' | 'psyker'
  count?: number
}

export interface AlternativeInput {
  options: string[]
  count: number
}

export interface BonusOutput {
  cardId: string
  chance: number
  requiresCard?: string // 指定卡牌在场才触发（如食品精制厂双份加成）
}

export interface RecipeDef {
  id: string
  name: string
  baseTime: number
  inputs: Record<string, number>
  outputs: Record<string, number>
  consumes?: Record<string, number>
  consumeAnyInputs?: boolean
  consumeSource?: boolean
  sourceId?: string
  anyInputs?: AlternativeInput[]
  requiredTraits?: TraitRequirement[]
  successChance?: number
  failConsumes?: string[]
  failOutputs?: Record<string, number>
  needsUnlock?: boolean
  requiredOrigin?: string     // 输入 corpse 必须为指定来源单位死亡产出（如 'astartes'）
  allowExtraMembers?: boolean // 宽容匹配：堆内存在配方外额外成员时仍放行（巢都系/熔炉系配方）
  corruptionDelta?: number
  bonusOutputs?: BonusOutput[]
  isInfiniteWorkstation?: boolean
}

export interface Vec2 {
  x: number
  y: number
}