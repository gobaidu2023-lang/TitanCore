// Stack.ts 巴达布前哨 - 引擎：堆叠实体与视图（2500x1400大世界、原版2D堆叠、露边铭牌与帝国征税军舰动态卡面）
import { Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js'
import { CARD_W, CARD_H, getDef } from '../game/cards'
import { CardCategory, RecipeDef, TraitType, TaxType } from '../game/types'
import { PACK_CONFIGS } from '../game/packs'
import { RECIPES } from '../game/recipes'

// 底层大世界物理尺寸扩展 1.3 倍：2500 × 1400
// 一号裁定⑧：不缩卡面，放大世界底板（16:9 与背景视频同比例），卡牌相对视野变小、统筹更从容
export const BOARD_W = 3200
export const BOARD_H = 1800

// 黑玻璃战术操作台标准视口规格（在世界中居中）
export const CONSOLE_W = 2560
export const CONSOLE_H = 1440
export const CONSOLE_X = (BOARD_W - CONSOLE_W) / 2 // 290
export const CONSOLE_Y = (BOARD_H - CONSOLE_H) / 2 // 180

// 顶部战备区高度：商店栏上边距16 + 正方形槽位160 + 下边距16（卡牌落点/分垛/回弹/出包统一以此为界）
export const CONSOLE_TOP_ZONE = 192

export const SELL_ZONE_W = 140
export const STACK_CASCADE = 32
// 卡牌顶部名称区高度（与堆叠层距解耦，一号裁定 2026-09-15 方案A；层距可在调参器自调）
export const NAME_PLATE_H = Math.round(CARD_W * 0.25)

// ================= 等比字号体系（基准=卡宽160；调参器改卡牌宽高，全部文字自动跟随） =================
export const F_PLATE = Math.round(CARD_W * 0.1375)    // 名牌/悬浮提示 22
export const F_BADGE = Math.round(CARD_W * 0.1125)    // HP/售价角标、读条标签 18
export const F_STAT = Math.round(CARD_W * 0.106)      // 属性数字 17
export const F_SMALL = Math.round(CARD_W * 0.0875)    // 税舰英文/小数字 14-15
export const F_MID = Math.round(CARD_W * 0.094)       // 包面英文/蓝图标签 15
export const F_HINT = Math.round(CARD_W * 0.106)      // 包面拆包提示 17
export const F_STACK = Math.round(CARD_W * 0.15)      // 堆叠数量、商店包名 24
export const F_IDEA = Math.round(CARD_W * 0.125)      // 蓝图名称 20
export const F_TIP = Math.round(CARD_W * 0.081)       // 蓝图小提示 13
export const F_SHOPSUB = Math.round(CARD_W * 0.1)     // 商店英文副标 16
export const F_PRICE = Math.round(CARD_W * 0.1625)    // 商店价格 26
export const F_ICON = Math.round(CARD_W * 0.25)       // 出售/商店图标 40
export const F_PACK_ICON = Math.round(CARD_W * 0.275) // 卡包📦 44
export const F_TAX = Math.round(CARD_W * 0.1875)    // 税块倒计时大字 30
export const MAX_STACK_SIZE = 25
// batch21：收税卡 B 与倒计时卡 A 同尺寸的横版常量（300×160）
export const TAX_SHIP_W = 300
export const TAX_SHIP_H = 160
export const HIT_PAD_TOP = 20

export const PC_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif'

export interface CardEntity {
  uid: number
  cardId: string
  trait?: TraitType       // 'none' | 'untouchable' | 'psyker'
  equippedGears?: string[] // 穿戴的装备ID列表（如 ['scrap_club', 'void_suit']）
  usesLeft: number
  hp: number                // 运行时实时生命值
  maxHp: number             // 上限
  view: Container
  slot: Container
  face: Container
  badgePlate: Graphics    // 左下角底板
  badgeText: Text          // 左下角数值文字
  glowRing: Graphics      // 高级/特质卡牌边框辉光
  statIcon: Text          // 右下角属性图标底（食物🍖 / 武器🗡 / 防具♥ / 货币🪙）
  statNum: Text           // 右下角属性数值（压在图标上显示）
  mutateBar: Graphics     // batch65：尸变倒计时红条（卡牌上方独立车道，引擎 updateSpecialBars 驱动）
  riftBar: Graphics       // batch65：亚空间裂隙刷怪倒计时红条（卡牌上方，引擎 updateSpecialBars 驱动）

  // 金币箱存量运行时内部状态
  chestCoins?: number

  // 尸体来源单位（'astartes' = 阿斯塔特尸体，基因种子封于其中）
  originUnit?: string

  // batch19：活体摘取标记——每具阿斯塔特仅可献身一次（随存档持久化）
  geneHarvested?: boolean

  // 食物卡运行时剩余饱食度（年末逐口消耗后留存，未消耗时为空 = 满值）
  satietyLeft?: number

  // 帝国什一税军舰专属运行时动态状态
  taxType?: TaxType
  taxTarget?: number
  taxPaid?: number
  taxShipPlate?: Graphics
  taxShipText?: Text
  taxShipSubText?: Text
}

export interface ActiveTask {
  recipe: RecipeDef
  progress: number
  workers: number
}

export interface Stack {
  id: number
  members: CardEntity[]
  task: ActiveTask | null
  x: number
  y: number
  badge: Text
  lockRing: Graphics
  taskBarBg: Graphics
  taskBar: Graphics
  taskLabel: Text
}

const CATEGORY_COLORS: Record<CardCategory, number> = {
  unit: 0x2b8a3e,
  resource_point: 0x6b4a2b,
  material: 0x5a6b7a,
  food: 0x8a7a2b,
  corpse: 0x3f3f46,
  enemy: 0x8a2b2b,
  building: 0x334155,
  equipment: 0x1e40af,
  location: 0x581c87,
  idea: 0x0f172a,
  pack: 0x0f766e,
  medical: 0x047857
}

const RARE_GLOW_CONFIGS: Record<string, { color: number; width: number; alpha: number }> = {
  astartes: { color: 0xeab308, width: 4.5, alpha: 1.0 },                // 帝国日曜金
  battle_sister: { color: 0x38bdf8, width: 3.5, alpha: 0.85 },        // 纯洁圣光青
  private_librarian: { color: 0xa855f7, width: 3.5, alpha: 0.85 },    // 亚空间灵能紫
  private_assassin: { color: 0xf43f5e, width: 3.0, alpha: 0.8 },      // 刺客绯红
  power_armor: { color: 0x06b6d4, width: 3.5, alpha: 0.9 },            // 动力甲电弧青
  gene_seed: { color: 0x10b981, width: 3.5, alpha: 0.95 },            // 基因原体翡翠绿
  blackstone: { color: 0x8b5cf6, width: 3.5, alpha: 0.9 },            // 亚空间黑石深紫
  high_alloy: { color: 0x60a5fa, width: 3.0, alpha: 0.8 },            // 高阶合金钛蓝
  rift_beacon: { color: 0xfbbf24, width: 4.0, alpha: 0.95 },          // 终局裂隙信标辉金
}

export function stackVisualHeight(stack: Stack): number {
  if (!stack || !stack.members || stack.members.length === 0) return CARD_H
  return CARD_H + Math.max(0, stack.members.length - 1) * STACK_CASCADE
}

function appendTopNamePlate(container: Container, nameStr: string, trait: TraitType = 'none'): void {
  const plate = new Graphics()
  const isUntouchable = trait === 'untouchable'
  const isPsyker = trait === 'psyker'

  const bgColor = isUntouchable ? 0x0c4a6e : (isPsyker ? 0x4a044e : 0x090a10)
  const borderColor = isUntouchable ? 0x38bdf8 : (isPsyker ? 0xc084fc : 0xffffff)

  plate.rect(0, 0, CARD_W, NAME_PLATE_H).fill({ color: bgColor, alpha: 0.85 })
  plate.rect(0, NAME_PLATE_H - 1, CARD_W, 1).fill({ color: borderColor, alpha: 0.35 })
  container.addChild(plate)

  let text = nameStr
  let textColor = '#ffffff'
  if (isUntouchable) {
    text = `${nameStr} [无魂]`
    textColor = '#38bdf8'
  } else if (isPsyker) {
    text = `${nameStr} [灵能]`
    textColor = '#e879f9'
  }

  const title = new Text({
    text,
    style: new TextStyle({
      fontFamily: PC_FONT_FAMILY,
      fontSize: F_PLATE,
      fill: textColor,
      fontWeight: 'bold',
      stroke: { color: '#000000', width: 3 }
    })
  })
  title.position.set(8, 9)
  container.addChild(title)
}

export function makeCardFace(cardId: string, textures: Map<string, Texture>, trait: TraitType = 'none'): Container {
  const face = new Container()
  const tex = textures.get(cardId)
  const def = getDef(cardId)

  if (tex) {
    const sp = new Sprite(tex)
    sp.anchor.set(0.5, 0.5)
    const s = Math.min(CARD_W / tex.width, CARD_H / tex.height)
    sp.scale.set(s)
    sp.position.set(CARD_W / 2, CARD_H / 2)
    face.addChild(sp)

    appendTopNamePlate(face, def.name, trait)
    return face
  }

  // batch21：收税卡 B 重写——与倒计时卡 A 同尺寸（300×160）同风格横版：深色底+金框+顶部标题；
  // 占 A 的坑位，底边停在战备区分界线，永不侵入操作区
  if (cardId === 'tax_ship') {
    const g = new Graphics()
    g.roundRect(0, 0, TAX_SHIP_W, TAX_SHIP_H, 8)
      .fill({ color: 0x1c1206, alpha: 0.95 })
      .stroke({ width: 2, color: 0xf59e0b, alpha: 0.9 })
    g.roundRect(4, 4, TAX_SHIP_W - 8, TAX_SHIP_H - 8, 4)
      .stroke({ width: 1, color: 0xd97706, alpha: 0.5 })
    face.addChild(g)

    const title = new Text({
      text: '⚡ 什一税征收中',
      style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_PLATE, fill: '#fcd34d', fontWeight: '900' })
    })
    title.anchor.set(0.5, 0)
    title.position.set(TAX_SHIP_W / 2, 12)
    face.addChild(title)
    return face
  }

  if (cardId.startsWith('pack_')) {
    const packCfg = PACK_CONFIGS[cardId]
    const g = new Graphics()
    const color = packCfg ? packCfg.color : 0x0f766e
    const borderColor = packCfg ? packCfg.borderColor : 0x2dd4bf

    g.roundRect(0, 0, CARD_W, CARD_H, 8)
      .fill({ color })
      .stroke({ width: 3, color: borderColor, alpha: 0.95 })

    g.roundRect(6, 6, CARD_W - 12, CARD_H - 12, 4)
      .stroke({ width: 1, color: borderColor, alpha: 0.4 })
    face.addChild(g)

    const icon = new Text({ text: '📦', style: new TextStyle({ fontSize: F_PACK_ICON }) })
    icon.anchor.set(0.5, 0.5)
    icon.position.set(CARD_W / 2, CARD_H / 2 + 4)

    const hint = new Text({
      text: '点击拆包',
      style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_HINT, fill: '#facc15', fontWeight: 'bold', stroke: { color: '#000000', width: 2 } })
    })
    hint.anchor.set(0.5, 1)
    hint.position.set(CARD_W / 2, CARD_H - 10)

    face.addChild(icon, hint)
    appendTopNamePlate(face, packCfg ? packCfg.name : def.name, trait)
    return face
  }

  if (cardId.startsWith('idea_')) {
    const g = new Graphics()
    g.roundRect(0, 0, CARD_W, CARD_H, 8).fill({ color: 0x0f172a }).stroke({ width: 2.5, color: 0x38bdf8, alpha: 0.9 })
    g.roundRect(5, 5, CARD_W - 10, CARD_H - 10, 4).stroke({ width: 1, color: 0x38bdf8, alpha: 0.3 })
    face.addChild(g)

    const tag = new Text({
      text: '💡 科技蓝图',
      style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_MID, fill: '#38bdf8', fontWeight: 'bold' })
    })
    tag.anchor.set(0.5, 0)
    tag.position.set(CARD_W / 2, 36)

    const name = new Text({
      text: def.name,
      style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_IDEA, fill: '#ffffff', fontWeight: 'bold', align: 'center', wordWrap: true, wordWrapWidth: CARD_W - 16, stroke: { color: '#000000', width: 3 } })
    })
    name.anchor.set(0.5, 0.5)
    name.position.set(CARD_W / 2, CARD_H / 2)

    const tip = new Text({
      text: '已永久掌握',
      style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_TIP, fill: '#4ade80', fontWeight: 'bold' })
    })
    tip.anchor.set(0.5, 1)
    tip.position.set(CARD_W / 2, CARD_H - 10)

    face.addChild(tag, name, tip)
    // 科技蓝图卡面自明化：顶部铭牌直接印出本卡解锁的配方名，中部保留"科技蓝图"类型标识
    const unlockedRecipe = RECIPES.find(r => r.id === cardId.replace('idea_', ''))
    appendTopNamePlate(face, unlockedRecipe ? unlockedRecipe.name : def.name, trait)
    return face
  }

  const cat = def.category
  const color = CATEGORY_COLORS[cat] ?? 0x27272a

  const g = new Graphics()
  g.roundRect(0, 0, CARD_W, CARD_H, 6).fill({ color })
  g.roundRect(0, 0, CARD_W, CARD_H, 6).stroke({ width: 2, color: 0x000000, alpha: 0.5 })
  face.addChild(g)

  const label = new Text({
    text: def.name,
    style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_MID, fill: '#ffffff', fontWeight: 'bold', align: 'center', wordWrap: true, wordWrapWidth: CARD_W - 12, stroke: { color: '#000000', width: 3 } })
  })
  label.anchor.set(0.5, 0.5)
  label.position.set(CARD_W / 2, CARD_H / 2)
  face.addChild(label)

  appendTopNamePlate(face, def.name, trait)
  return face
}

export function createCardEntity(cardId: string, textures: Map<string, Texture>, trait: TraitType = 'none'): CardEntity {
  const view = new Container()
  const face = makeCardFace(cardId, textures, trait)
  const slot = new Container()

  const glowRing = new Graphics()
  glowRing.visible = false

  const statIcon = new Text({ text: '', style: new TextStyle({ fontSize: 24 }) })
  statIcon.anchor.set(0.5, 0.5)
  statIcon.position.set(CARD_W - 18, CARD_H - 18)
  statIcon.visible = false

  const statNum = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: PC_FONT_FAMILY,
      fontSize: F_STAT,
      fill: '#ffffff',
      fontWeight: '900',
      stroke: { color: '#000000', width: 3 }
    })
  })
  statNum.anchor.set(0.5, 0.5)
  statNum.position.set(CARD_W - 18, CARD_H - 18)
  statNum.visible = false

  // batch65：尸变/裂隙倒计时红条（统一卡牌上方 -18 车道，与任务读条同车道，有任务时任务条优先覆盖=语义"暂停"）
  const mutateBar = new Graphics()
  mutateBar.position.set(4, -18)
  mutateBar.visible = false

  // batch65：亚空间裂隙刷怪倒计时红条（同车道；裂隙卡无任务，天然不冲突）
  const riftBar = new Graphics()
  riftBar.position.set(4, -18)
  riftBar.visible = false

  const badgePlate = new Graphics()
  const badgeText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: PC_FONT_FAMILY,
      fontSize: F_BADGE,
      fill: '#ffffff',
      fontWeight: '900',
      stroke: { color: '#000000', width: 3 }
    })
  })
  badgeText.anchor.set(0.5, 0.5)

  // 军舰动态收税信息面板组件
  const taxShipPlate = new Graphics()
  taxShipPlate.visible = false

  const taxShipText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: PC_FONT_FAMILY,
      fontSize: F_TAX, // batch21：横版需求大字（30 号）
      fill: '#fef08a',
      fontWeight: '900',
      align: 'center',
      stroke: { color: '#000000', width: 3 }
    })
  })
  taxShipText.anchor.set(0.5, 0.5)
  taxShipText.position.set(TAX_SHIP_W / 2, 66)
  taxShipText.visible = false

  const taxShipSubText = new Text({
    text: '',
    style: new TextStyle({
      fontFamily: PC_FONT_FAMILY,
      fontSize: F_SMALL, // batch21：横版底部进度条带（14 号）
      fill: '#94a3b8',
      fontWeight: 'bold',
      align: 'center',
      stroke: { color: '#000000', width: 2 }
    })
  })
  taxShipSubText.anchor.set(0.5, 0.5)
  taxShipSubText.position.set(TAX_SHIP_W / 2, TAX_SHIP_H - 24)
  taxShipSubText.visible = false

  view.addChild(glowRing)
  view.addChild(face)
  view.addChild(badgePlate)
  view.addChild(badgeText)
  view.addChild(statIcon)
  view.addChild(statNum)
  view.addChild(mutateBar)
  view.addChild(riftBar)
  view.addChild(taxShipPlate)
  view.addChild(taxShipText)
  view.addChild(taxShipSubText)
  view.addChild(slot)

  const def = getDef(cardId)
  const hp = def.hp ?? 0
  const entity: CardEntity = {
    uid: 0,
    cardId,
    trait,
    equippedGears: [],
    usesLeft: def.uses ?? 0,
    hp,
    maxHp: hp,
    view,
    slot,
    face,
    badgePlate,
    badgeText,
    glowRing,
    statIcon,
    statNum,
    mutateBar,
    riftBar,
    chestCoins: 0,
    taxType: 'gold',
    taxTarget: 50,
    taxPaid: 0,
    taxShipPlate,
    taxShipText,
    taxShipSubText
  }

  refreshCardBadge(entity)
  applyRareGlow(entity)

  return entity
}

export function refreshCardBadge(card: CardEntity): void {
  const def = getDef(card.cardId)

  // 军舰动态收税卡面刷新分支
  if (card.cardId === 'tax_ship') {
    card.badgePlate.visible = false
    card.badgeText.visible = false
    card.statIcon.visible = false
    card.statNum.visible = false

    if (card.taxShipPlate && card.taxShipText && card.taxShipSubText) {
      card.taxShipPlate.clear()
      const paid = card.taxPaid ?? 0
      const target = card.taxTarget ?? 50
      const isFull = paid >= target

      // batch21 横版布局：中部需求大字（F_TAX）+ 底部进度条带（已缴 x/y · 操作提示）
      card.taxShipPlate.roundRect(8, TAX_SHIP_H - 40, TAX_SHIP_W - 16, 32, 6)
        .fill({ color: isFull ? 0x064e3b : 0x18181b, alpha: 0.9 })
        .stroke({ width: 1.5, color: isFull ? 0x34d399 : 0xf59e0b, alpha: 0.85 })

      const reqStr = card.taxType === 'gold' ? `🪙 金币 × ${target}`
        : card.taxType === 'population' ? `🧑 人口 × ${target}`
        : `🧬 基因种子 × ${target}`
      card.taxShipText.text = isFull ? `★ 什一税已备齐 ★` : reqStr
      card.taxShipText.style.fill = isFull ? '#6ee7b7' : '#fde047'

      card.taxShipSubText.text = isFull ? `已缴 ${paid}/${target} · 特使待命起航` : `已缴 ${paid}/${target} · 拖入卡牌上缴`
      card.taxShipSubText.style.fill = isFull ? '#a7f3d0' : '#94a3b8'

      card.taxShipPlate.visible = true
      card.taxShipText.visible = true
      card.taxShipSubText.visible = true
    }
    return
  }

  const isUnit = def.category === 'unit' || def.category === 'enemy'
  card.badgePlate.clear()

  // 1. 左下角角标绘制：单位显示 HP，非单位（含金币箱售价3）显示售价
  if (isUnit && card.maxHp > 0) {
    card.badgePlate.roundRect(6, CARD_H - 32, 48, 26, 6)
      .fill({ color: 0x7f1d1d, alpha: 0.95 })
      .stroke({ width: 1.5, color: 0xef4444, alpha: 0.9 })

    card.badgeText.text = `${card.hp}`
    card.badgeText.style.fill = '#ffffff'
    card.badgeText.position.set(6 + 24, CARD_H - 32 + 13)
    card.badgePlate.visible = true
    card.badgeText.visible = true
  } else if (!isUnit && def.price > 0 && !def.unsellable) {
    card.badgePlate.roundRect(6, CARD_H - 32, 46, 26, 6)
      .fill({ color: 0x78350f, alpha: 0.95 })
      .stroke({ width: 1.5, color: 0xf59e0b, alpha: 0.9 })

    card.badgeText.text = `${def.price}`
    card.badgeText.style.fill = '#fef08a'
    card.badgeText.position.set(6 + 23, CARD_H - 32 + 13)
    card.badgePlate.visible = true
    card.badgeText.visible = true
  } else {
    card.badgePlate.visible = false
    card.badgeText.visible = false
  }

  // 2. 右下角角标绘制：食物饱食度 / 装备属性 / 己方劳动力口粮 / 金币箱存量
  let statEmoji = ''
  let statValue = 0

  if (def.category === 'food' && ((card.satietyLeft ?? def.satiety) ?? 0) > 0) {
    statEmoji = '🍖'
    statValue = (card.satietyLeft ?? def.satiety) ?? 0
  } else if (def.category === 'equipment') {
    if ((def.attack ?? 0) > 0) {
      statEmoji = '🗡'
      statValue = def.attack ?? 0
    } else if ((def.hp ?? 0) > 0) {
      statEmoji = '♥'
      statValue = def.hp ?? 0
    }
  } else if (def.category === 'unit' && def.isOurUnit && card.cardId !== 'baby' && (def.foodPerMonth ?? 0) > 0) {
    // 己方成年劳动力：口粮角标（🍖 压 foodPerMonth 消耗值）
    statEmoji = '🍖'
    statValue = def.foodPerMonth ?? 0
  } else if (card.cardId === 'coin_chest') {
    // 金币箱：右下角可视化箱内已存金币总额
    statEmoji = '🪙'
    statValue = card.chestCoins ?? 0
  }

  if (statEmoji) {
    card.statIcon.text = statEmoji
    card.statNum.text = `${statValue}`

    // 针对金币箱 3 位数（如 100）自适应调整字号防止溢出
    if (statValue >= 100) {
      card.statNum.style.fontSize = F_SMALL
    } else {
      card.statNum.style.fontSize = F_STAT
    }

    card.statIcon.visible = true
    card.statNum.visible = true
  } else {
    card.statIcon.visible = false
    card.statNum.visible = false
  }
}

export function applyRareGlow(card: CardEntity): void {
  let glowCfg = RARE_GLOW_CONFIGS[card.cardId]

  if (!glowCfg && card.trait && card.trait !== 'none') {
    if (card.trait === 'untouchable') {
      glowCfg = { color: 0x38bdf8, width: 3.0, alpha: 0.85 }
    } else if (card.trait === 'psyker') {
      glowCfg = { color: 0xa855f7, width: 3.0, alpha: 0.85 }
    }
  }

  if (!glowCfg) {
    card.glowRing.visible = false
    return
  }

  card.glowRing.clear()
  card.glowRing.roundRect(-4, -4, CARD_W + 8, CARD_H + 8, 10)
    .stroke({ width: glowCfg.width, color: glowCfg.color, alpha: glowCfg.alpha })
  card.glowRing.visible = true
}

export function createStack(x: number, y: number): Stack {
  const badge = new Text({
    text: '',
    style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_STACK, fill: '#ffffff', fontWeight: '900', stroke: { color: '#000000', width: 4 } })
  })
  badge.anchor.set(1, 0)
  badge.visible = false

  const lockRing = new Graphics()
  const taskBarBg = new Graphics()
  taskBarBg.rect(0, 0, CARD_W, 8).fill({ color: 0x000000, alpha: 0.7 })
  taskBarBg.visible = false

  const taskBar = new Graphics()
  taskBar.visible = false

  const taskLabel = new Text({
    text: '',
    style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_BADGE, fill: '#ffd75e', fontWeight: '700', stroke: { color: '#000000', width: 3 } })
  })
  taskLabel.anchor.set(0.5, 1)
  taskLabel.visible = false

  return { id: 0, members: [], task: null, x, y, badge, lockRing, taskBarBg, taskBar, taskLabel }
}

export function refreshStackView(stack: Stack): void {
  const n = stack.members.length
  if (n === 0) {
    stack.badge.visible = false
    stack.lockRing.visible = false
    stack.taskBarBg.visible = false
    stack.taskBar.visible = false
    stack.taskLabel.visible = false
    return
  }
  const root = stack.members[0].view

  stack.badge.visible = n > 1
  if (n > 1) {
    stack.badge.text = `×${n}`
    stack.badge.position.set(CARD_W - 2, 2)
  }

  const locked = stack.task !== null
  stack.lockRing.clear()
  if (locked) {
    stack.lockRing.rect(-3, -3, CARD_W + 6, stackVisualHeight(stack) + 6).stroke({ width: 3, color: 0xffd75e })
  }
  stack.lockRing.visible = locked
  stack.taskBarBg.visible = locked
  stack.taskBar.visible = locked
  stack.taskLabel.visible = locked
  if (locked && stack.task) {
    stack.taskLabel.text = stack.task.recipe.name
    stack.taskLabel.position.set(CARD_W / 2, -22)
    stack.taskBarBg.position.set(0, -18)
    stack.taskBar.position.set(0, -18)
    stack.taskBar.clear()
    const w = Math.max(2, CARD_W * Math.min(1, stack.task.progress))
    // batch65：亚空间大魔召唤仪式读条统一红色（刷怪/仪式系红色分级），其余任务保持青色
    const taskBarColor = stack.task.recipe.id === 'ritual_boss' ? 0xef4444 : 0x00f0ff
    stack.taskBar.rect(0, 0, w, 8).fill({ color: taskBarColor })
  }

  stack.members.forEach(m => refreshCardBadge(m))
  root.addChild(stack.lockRing, stack.taskBarBg, stack.taskBar, stack.taskLabel, stack.badge)
}
