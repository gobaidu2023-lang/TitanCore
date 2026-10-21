// Board.ts 巴达布前哨 - 引擎：牌桌唯一权威（单堆20上限自动分垛、防完全重叠、仓库3座限制与操作台边界守护）
import { Container, Texture } from 'pixi.js'
import {
  Stack, CardEntity,
  createStack, createCardEntity, refreshStackView, makeCardFace,
  refreshCardBadge, applyRareGlow,
  STACK_CASCADE, MAX_STACK_SIZE, stackVisualHeight, TAX_SHIP_W, TAX_SHIP_H,
  CONSOLE_X, CONSOLE_Y, CONSOLE_W, CONSOLE_H, CONSOLE_TOP_ZONE
} from './Stack'
import { CARD_W, CARD_H, getDef } from '../game/cards'
import { TraitType } from '../game/types'
import { EQUIP_CONFIGS } from '../game/equipment'

export interface CardHit {
  stack: Stack
  index: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}

export class Board {
  public cards = new Map<number, CardEntity>()
  public stacks = new Map<number, Stack>()
  private uidCounter = 1
  private stackIdCounter = 1
  public onChanged: (() => void) | null = null

  constructor(
    public readonly cardLayer: Container,
    private textures: Map<string, Texture>
  ) {}

  spawnCard(cardId: string, x: number, y: number, trait?: TraitType): Stack {
    const stack = this.newRecord(x, y)
    const card = this.makeCard(cardId, trait)
    this.cards.set(card.uid, card)
    stack.members.push(card)
    this.relink(stack)
    refreshStackView(stack)
    this.emitChanged()
    return stack
  }

  adoptCard(card: CardEntity, x: number, y: number): Stack {
    const stack = this.newRecord(x, y)
    stack.members.push(card)
    this.relink(stack)
    refreshStackView(stack)
    this.emitChanged()
    return stack
  }

  private newRecord(x: number, y: number): Stack {
    const stack = createStack(x, y)
    stack.id = this.stackIdCounter++
    this.stacks.set(stack.id, stack)
    return stack
  }

  private makeCard(cardId: string, explicitTrait?: TraitType): CardEntity {
    let trait: TraitType = explicitTrait ?? 'none'

    if (cardId === 'battle_sister') {
      trait = 'untouchable'
    } else if (cardId === 'private_librarian') {
      trait = 'psyker'
    } else if (!explicitTrait && (cardId === 'civilian' || cardId === 'auxilia' || cardId === 'baby')) {
      // batch19修复：原 else if (rand < 0.10) 与上一分支 0.1 恒等——灵能分支是死代码、概率恒为 0；恢复各 10%
      const rand = Math.random()
      if (rand < 0.1) {
        trait = 'untouchable'
      } else if (rand < 0.2) {
        trait = 'psyker'
      } else {
        trait = 'none'
      }
    }

    const card = createCardEntity(cardId, this.textures, trait)
    card.uid = this.uidCounter++
    card.trait = trait
    card.equippedGears = []
    return card
  }

  /** 关键防御重构：严格过滤已被物理销毁的幽灵实体，绝不向 null 调用 set */
  public relink(stack: Stack): void {
    if (!stack || !stack.members) return

    // 存活防御过滤：移除任何 view 为 null 或已被 destroy 的死卡
    stack.members = stack.members.filter(m => m && m.view && !m.view.destroyed && this.cards.has(m.uid))

    stack.members.forEach((m, i) => {
      if (!m.view || m.view.destroyed || !m.view.position) return
      const parent = i === 0 ? this.cardLayer : stack.members[i - 1].slot
      if (m.view.parent !== parent) parent.addChild(m.view)
      m.view.position.set(i === 0 ? stack.x : 0, i === 0 ? stack.y : STACK_CASCADE)
      if (m.view.scale) m.view.scale.set(1, 1)
    })
  }

  /** 堆叠安全合并：支持单堆 20 张上限管控与溢出自动向右平行分垛（Auto-Spill） */
  mergeStacks(moving: Stack, target: Stack): void {
    if (moving === target || !moving || !target) return
    if (!this.stacks.has(moving.id) || !this.stacks.has(target.id)) return

    // 双向过滤无效实体
    moving.members = (moving.members || []).filter(m => m && m.view && !m.view.destroyed && this.cards.has(m.uid))
    target.members = (target.members || []).filter(m => m && m.view && !m.view.destroyed && this.cards.has(m.uid))

    if (moving.members.length === 0 || target.members.length === 0) return

    const root = target.members[0]
    const remainingCards = [...target.members.slice(1), ...moving.members]

    const sameAsRoot: CardEntity[] = []
    const others: CardEntity[] = []

    for (const card of remainingCards) {
      if (card.cardId === root.cardId) {
        sameAsRoot.push(card)
      } else {
        others.push(card)
      }
    }

    const groups = new Map<string, CardEntity[]>()
    for (const card of others) {
      if (!groups.has(card.cardId)) groups.set(card.cardId, [])
      groups.get(card.cardId)!.push(card)
    }

    const sortedRest: CardEntity[] = [...sameAsRoot]
    for (const group of groups.values()) {
      sortedRest.push(...group)
    }

    target.members = [root, ...sortedRest]

    this.disposeChrome(moving)
    this.stacks.delete(moving.id)

    // 核心机制：单堆上限 20 张管控，溢出自动分垛
    if (target.members.length > MAX_STACK_SIZE) {
      this.handleStackSpill(target)
    } else {
      this.relink(target)
      refreshStackView(target)
    }

    this.emitChanged()
  }

  /** 自动平行分垛核心实现：满 20 张向右偏移，绝不戳边与超高 */
  public handleStackSpill(target: Stack): Stack[] {
    const createdStacks: Stack[] = []
    let currentStack = target

    while (currentStack.members.length > MAX_STACK_SIZE) {
      const overflowCards = currentStack.members.splice(MAX_STACK_SIZE)
      this.relink(currentStack)
      refreshStackView(currentStack)

      const nextPos = this.findFreeSpillPosition(currentStack.x, currentStack.y)
      const newStack = this.newRecord(nextPos.x, nextPos.y)
      newStack.members = overflowCards
      this.relink(newStack)
      refreshStackView(newStack)
      createdStacks.push(newStack)

      currentStack = newStack
    }

    this.relink(currentStack)
    refreshStackView(currentStack)
    return createdStacks
  }

  /** 计算平行分垛安全落点：优先向右偏移约 48px，右侧越界则换下一行安全区，避让已有非同类卡堆 */
  public findFreeSpillPosition(baseX: number, baseY: number): { x: number; y: number } {
    let candX = baseX + 48
    let candY = baseY

    const minX = CONSOLE_X + 24
    const maxX = CONSOLE_X + CONSOLE_W - CARD_W - 24
    const minY = CONSOLE_Y + CONSOLE_TOP_ZONE
    const maxY = CONSOLE_Y + CONSOLE_H - CARD_H - 60

    for (let attempt = 0; attempt < 30; attempt++) {
      if (candX > maxX) {
        candX = minX
        candY += CARD_H + 28
      }
      if (candY > maxY) {
        candY = minY
      }

      let occupied = false
      for (const s of this.stacks.values()) {
        if (s.members.length > 0 && Math.abs(s.x - candX) < 18 && Math.abs(s.y - candY) < 18) {
          occupied = true
          break
        }
      }

      if (!occupied) {
        return { x: candX, y: candY }
      }

      candX += 48
    }

    return {
      x: clamp(candX, minX, maxX),
      y: clamp(candY, minY, maxY)
    }
  }

  /** 防两组完全重叠算法：若目标位置已有其他非合并卡牌无缝重叠，自动进行错位偏移 */
  public findNonOverlappingPosition(stack: Stack, x: number, y: number): { x: number; y: number } {
    let targetX = x
    let targetY = y
    const minX = CONSOLE_X + 20
    const maxX = CONSOLE_X + CONSOLE_W - CARD_W - 20
    const minY = CONSOLE_Y + CONSOLE_TOP_ZONE
    const maxY = CONSOLE_Y + CONSOLE_H - CARD_H - 40

    for (let i = 0; i < 15; i++) {
      let hasOverlap = false
      for (const s of this.stacks.values()) {
        if (s === stack || s.members.length === 0) continue
        if (Math.abs(s.x - targetX) < 14 && Math.abs(s.y - targetY) < 14) {
          hasOverlap = true
          break
        }
      }

      if (!hasOverlap) break

      targetX += 32
      targetY += 24

      if (targetX > maxX) targetX = minX + 20
      if (targetY > maxY) targetY = minY + 20
    }

    return {
      x: clamp(targetX, minX, maxX),
      y: clamp(targetY, minY, maxY)
    }
  }

  /** 统计场上指定类型扩容仓库建筑的存在数量（货棚与货仓分开独立计数） */
  public countWarehouse(cardId: string): number {
    let count = 0
    for (const c of this.cards.values()) {
      if (c.cardId === cardId) {
        count++
      }
    }
    return count
  }

  /** batch18：货棚+货仓全场合计上限 5 座（设计意图：后期淘汰简易货棚、全造卡牌货仓） */
  public canBuildWarehouse(cardId: string): boolean {
    if (cardId === 'shed' || cardId === 'warehouse') {
      return this.countWarehouse('shed') + this.countWarehouse('warehouse') < 5
    }
    return true
  }

  /**
   * 巢都人口上限（一号裁定⑨闭环）：
   * - 巢都内存在婴儿时：成年人口全部弹出（婴儿独占巢都，先弹大人）
   * - 无婴儿时：成年人口上限 2，超出弹出
   * 返回被弹出并已安置到相邻空地的单位卡
   */
  public ejectExcessNestPopulation(): CardEntity[] {
    const ejected: CardEntity[] = []
    for (const st of this.stacks.values()) {
      if (!st.members || st.members.length === 0) continue
      if (st.members[0].cardId !== 'hive_city') continue

      const isAdult = (m: CardEntity) => {
        try {
          return !!getDef(m.cardId).isLabor
        } catch {
          return false
        }
      }
      const babies = st.members.filter(m => m.cardId === 'baby')
      const adults = st.members.filter(isAdult)

      const shouldEjectAll = babies.length > 0
      const excessAdults = shouldEjectAll ? adults.length : Math.max(0, adults.length - 2)
      for (let k = 0; k < excessAdults; k++) {
        const target = st.members.find(isAdult)
        if (!target) break
        const idx = st.members.indexOf(target)
        if (idx <= 0) break
        const grabbed = this.grabAt(st, idx)
        const pos = this.findNonOverlappingPosition(grabbed, st.x + CARD_W + 20, st.y)
        this.placeStack(grabbed, pos.x, pos.y)
        if (grabbed.members[0]) ejected.push(grabbed.members[0])
      }

      // 极端兜底：无大人时婴儿超过 2 个，弹出多余的（从堆顶弹）
      if (adults.length === 0 || excessAdults >= adults.length) {
        let babyOverflow = st.members.filter(m => m.cardId === 'baby').length - 2
        while (babyOverflow > 0) {
          const idx = st.members.map(m => m.cardId).lastIndexOf('baby')
          if (idx <= 0) break
          const grabbed = this.grabAt(st, idx)
          const pos = this.findNonOverlappingPosition(grabbed, st.x - CARD_W - 20, st.y)
          this.placeStack(grabbed, pos.x, pos.y)
          if (grabbed.members[0]) ejected.push(grabbed.members[0])
          babyOverflow--
        }
      }
    }
    return ejected
  }

  grabAt(stack: Stack, index: number): Stack {
    if (!stack || !stack.members || stack.members.length === 0) return stack
    if (index <= 0 || stack.members.length < 2) return stack
    const idx = Math.min(index, stack.members.length - 1)
    const moving = stack.members.splice(idx)
    const ns = this.newRecord(stack.x, stack.y + idx * STACK_CASCADE)
    ns.members = moving
    this.relink(stack)
    this.relink(ns)
    refreshStackView(stack)
    refreshStackView(ns)
    this.emitChanged()
    return ns
  }

  placeStack(stack: Stack, x: number, y: number): void {
    if (!stack || !stack.members || stack.members.length === 0 || !stack.members[0]) return
    stack.x = x
    stack.y = y
    const rv = stack.members[0].view
    if (!rv || rv.destroyed) return
    if (rv.parent) rv.parent.removeChild(rv)
    this.cardLayer.addChild(rv)
    if (rv.position) rv.position.set(x, y)
    this.emitChanged()
  }

  removeCard(card: CardEntity): void {
    const stack = this.stackOf(card)
    if (!stack) return
    const idx = stack.members.indexOf(card)
    if (idx >= 0) stack.members.splice(idx, 1)

    // batch17守卫：成员死亡/被移除后，若堆上任务的投入/消耗引用了该卡且堆内已无此卡 → 任务自动作废（修：婴儿死亡仍读条产出、尸体被吃后任务空转）
    if (stack.task && stack.members.length > 0) {
      const r = stack.task.recipe
      const refsCard = ((r.inputs?.[card.cardId] || 0) > 0) || ((r.consumes?.[card.cardId] || 0) > 0)
      if (refsCard && !stack.members.some(m => m.cardId === card.cardId)) {
        stack.task = null
      }
    }

    if (stack.members.length === 0) {
      this.stacks.delete(stack.id)
    } else {
      this.relink(stack)
      refreshStackView(stack)
    }

    if (card.slot && card.slot.children.length > 0) {
      card.slot.removeChildren()
    }
    if (card.view && card.view.parent) card.view.parent.removeChild(card.view)
    if (card.view && !card.view.destroyed) {
      card.view.destroy({ children: true })
    }
    this.cards.delete(card.uid)

    this.emitChanged()
  }

  removeStack(stack: Stack): void {
    if (!stack) return
    this.disposeChrome(stack)
    if (stack.members) {
      for (const m of [...stack.members]) {
        if (m.slot && m.slot.children.length > 0) {
          m.slot.removeChildren()
        }
        if (m.view && m.view.parent) m.view.parent.removeChild(m.view)
        if (m.view && !m.view.destroyed) {
          m.view.destroy({ children: true })
        }
        this.cards.delete(m.uid)
      }
    }
    stack.members = []
    this.stacks.delete(stack.id)
    this.emitChanged()
  }

  transformCard(card: CardEntity, newCardId: string, newTrait?: TraitType): void {
    const stack = this.stackOf(card)
    if (!stack) return
    if (card.view && card.face && !card.face.destroyed) {
      card.view.removeChild(card.face)
      card.face.destroy({ children: true })
    }

    const oldEquipped = card.equippedGears ? [...card.equippedGears] : []
    const oldCardId = card.cardId

    card.cardId = newCardId
    if (newTrait !== undefined) {
      card.trait = newTrait
    } else if (newCardId === 'battle_sister') {
      card.trait = 'untouchable'
    } else if (newCardId === 'private_librarian') {
      card.trait = 'psyker'
    }

    card.equippedGears = oldEquipped
    let bonusHp = 0
    for (const gid of oldEquipped) {
      const cfg = EQUIP_CONFIGS[gid]
      if (cfg?.hpBonus) bonusHp += cfg.hpBonus
    }

    card.usesLeft = getDef(newCardId).uses ?? 0
    const baseHp = getDef(newCardId).hp ?? 0
    card.maxHp = baseHp + bonusHp
    card.hp = card.maxHp
    // batch17守卫：变身（如尸体→尸变体）使任务所需卡消失 → 任务自动作废（修：火葬/回收读条中尸变导致人卡与敌卡黏连锁死）
    if (stack.task) {
      const r = stack.task.recipe
      const refsOld = ((r.inputs?.[oldCardId] || 0) > 0) || ((r.consumes?.[oldCardId] || 0) > 0)
      if (refsOld && !stack.members.some(m => m.cardId === oldCardId)) {
        stack.task = null
      }
    }

    card.face = makeCardFace(newCardId, this.textures, card.trait)
    if (card.view && !card.view.destroyed) {
      card.view.addChildAt(card.face, 1)
    }
    refreshCardBadge(card)
    applyRareGlow(card)
    refreshStackView(stack)
    this.emitChanged()
  }

  stackOf(card: CardEntity): Stack | null {
    for (const s of this.stacks.values()) {
      if (s.members && s.members.includes(card)) return s
    }
    return null
  }

  findStackAt(x: number, y: number, exclude?: Stack): Stack | null {
    const children = this.cardLayer.children
    const pad = 4
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i]
      for (const s of this.stacks.values()) {
        if (s === exclude || !s.members || s.members.length === 0 || !s.members[0]) continue
        if (s.members[0].view === child) {
          // batch21：收税卡横版——点击判定框与视觉同尺寸（300×160），拖卡上缴全区域可命中
          const isTax = s.members[0].cardId === 'tax_ship'
          const w = isTax ? TAX_SHIP_W : CARD_W
          const h = isTax ? TAX_SHIP_H : stackVisualHeight(s)
          const bottom = s.y + h
          if (x >= s.x - pad && x <= s.x + w + pad && y >= s.y - pad && y <= bottom + pad) {
            return s
          }
          break
        }
      }
    }
    return null
  }

  findCardAt(x: number, y: number, exclude?: Stack): CardHit | null {
    const pile = this.findStackAt(x, y, exclude)
    if (!pile || !pile.members || pile.members.length === 0) return null
    const n = pile.members.length
    if (n === 1) return { stack: pile, index: 0 }

    const relY = y - pile.y
    if (relY <= 0) return { stack: pile, index: 0 }

    const splitLimit = (n - 1) * STACK_CASCADE
    if (relY < splitLimit) {
      const i = Math.floor(relY / STACK_CASCADE)
      return { stack: pile, index: Math.min(i, n - 1) }
    } else {
      return { stack: pile, index: n - 1 }
    }
  }

  allCards(): CardEntity[] {
    return [...this.cards.values()]
  }

  countCards(): number {
    return this.cards.size
  }

  /** batch14存档：读档重建全部卡牌后，把 uid/stackId 计数器推到已用最大值+1，防冲突 */
  restoreCounters(nextUid: number, nextStackId: number): void {
    this.uidCounter = Math.max(this.uidCounter, nextUid)
    this.stackIdCounter = Math.max(this.stackIdCounter, nextStackId)
  }

  /** batch64：全量重链所有堆（结算阶段防御性兜底，修复成员视图偶发失步） */
  relinkAllStacks(): void {
    for (const s of this.stacks.values()) {
      if (!s.members || s.members.length === 0) continue
      this.relink(s)
      refreshStackView(s)
    }
  }

  clearAll(): void {
    for (const s of [...this.stacks.values()]) {
      this.removeStack(s)
    }
    this.emitChanged()
  }

  private disposeChrome(stack: Stack): void {
    for (const c of [stack.badge, stack.lockRing, stack.taskBarBg, stack.taskBar, stack.taskLabel]) {
      if (c && c.parent) c.parent.removeChild(c)
    }
  }

  private emitChanged(): void {
    this.onChanged?.()
  }
}