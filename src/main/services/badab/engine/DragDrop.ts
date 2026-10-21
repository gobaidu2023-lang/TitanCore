// DragDrop.ts 巴达布前哨 - 引擎：拖拽状态机、操作台绝对边界约束、防完全重叠、同类点位收纳与装备穿戴
import { Container } from 'pixi.js'
import { Board } from './Board'
import {
  Stack, CardEntity, ActiveTask, BOARD_W, BOARD_H,
  CONSOLE_X, CONSOLE_Y, CONSOLE_W, CONSOLE_H, CONSOLE_TOP_ZONE,
  stackVisualHeight, refreshStackView, refreshCardBadge
} from './Stack'
import { CARD_W as CW, CARD_H as CH, getDef, HERB_PATCH_HEAL } from '../game/cards'
import { matchRecipe, RECIPES, RecipeCandidate } from '../game/recipes'
import { RecipeDef, Vec2 } from '../game/types'
import { Floater } from './Floater'
import { isWearable, canEquip, applyEquip } from '../game/equipment'

export interface DragHooks {
  tryStartTask: (stack: Stack, userAction?: boolean) => void
  afterChange: () => void
  bounce: (stack: Stack) => void
  /** R50: 拖拽接管视图前取消其 position/scale 补间 */
  cancelViewMotion?: (view: Container) => void
  onChestClick?: (stack: Stack) => void
  onPackClick?: (stack: Stack) => void
  onManualEngage?: (friendlyStack: Stack, enemyStack: Stack) => void
  onCardsCarried?: (cards: CardEntity[], isCarried: boolean) => void
  onPurifyStart?: (purifier: CardEntity, cultistStack: Stack) => void
  onMedPatchStart?: (patch: CardEntity, unitStack: Stack) => void
  isRecipeUnlocked?: (recipeId: string) => boolean
  onDepositTaxShip?: (shipStack: Stack, inputStack: Stack) => void
}

export interface RadarTargetInfo {
  stack: Stack
  color: number
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}

export class DragDrop {
  public state: 'idle' | 'dragging' = 'idle'
  public hoverTarget: Stack | null = null
  public hoverRecipe: RecipeDef | null = null
  public hoverRecipeUnlocked: boolean = false
  public hoverPackIndex: number = -1
  public hoverChest: Stack | null = null
  public hoverTaxShip: Stack | null = null

  public radarTargets: RadarTargetInfo[] = []
  // batch38：连续采集——抓取工人时快照任务，落到同类资源点时迁移（进度保留）
  private pendingTaskMove: { task: ActiveTask; sourceId: string } | null = null

  public lastPos: Vec2 = { x: 0, y: 0 }
  private startPos: Vec2 = { x: 0, y: 0 }

  public carried: Stack | null = null
  private offset: Vec2 = { x: 0, y: 0 }

  constructor(
    private board: Board,
    private dragLayer: Container,
    private hooks: DragHooks,
    private floaters: Floater,
    private isInSellSlot: (p: Vec2, stack?: Stack) => boolean,
    private onSell: (stack: Stack) => void,
    private getPackAt: (p: Vec2, stack?: Stack) => number,
    private onDepositPack: (packIndex: number, stack: Stack) => void,
    private onDepositChest: (chestStack: Stack, coinStack: Stack) => void,
    private onDepositMessHall: (hallStack: Stack, foodStack: Stack) => void
  ) {}

  isBusy(): boolean {
    return this.state !== 'idle'
  }

  pointerDown(p: Vec2, button: number): void {
    this.lastPos = p
    this.startPos = { ...p }
    // batch40：连续采集快照每次按下先清零——拖到空地等非合并落点不再残留陈旧任务引用
    this.pendingTaskMove = null
    if (button !== 0) return
    if (this.state !== 'idle') return

    const hit = this.board.findCardAt(p.x, p.y)
    if (!hit || !hit.stack || !hit.stack.members || hit.stack.members.length === 0) return

    const targetCard = hit.stack.members[hit.index]
    if (!targetCard) return
    const def = getDef(targetCard.cardId)

    if (def.category === 'enemy' || def.isUndraggable) {
      const hint = def.id === 'tax_ship' ? '帝国军舰严禁私自拖移！' : '该单位无法被拖动！'
      this.floaters.show(hit.stack.x + CW / 2, hit.stack.y - 12, hint, '#ef4444', 18)
      return
    }

    // batch30（二号裁定A）：开放整堆搬迁——作业堆 root 可整体拖动、读条保留；
    // 拖成员卡仍中断作业（原有逻辑在下文保留）

    if (hit.stack.task && hit.index > 0) {
      const t = hit.stack.task
      hit.stack.task = null
      refreshStackView(hit.stack)
      // batch38：可迁移任务（点位采集类）快照留底；落点不同类资源点时于 pointerUp 提示中断
      this.pendingTaskMove = t.recipe.consumeSource && t.recipe.sourceId ? { task: t, sourceId: t.recipe.sourceId } : null
    }

    const moving = this.board.grabAt(hit.stack, hit.index)
    if (!moving || !moving.members || moving.members.length === 0 || !moving.members[0]) return

    const rv = moving.members[0].view
    // R50: 接管视图前杀掉其 position/scale 在飞补间（磁力滑入/弹出/液压停稳等），防旧补间把视图钉回旧坐标成尸体卡
    this.hooks.cancelViewMotion?.(rv)
    if (rv.parent) rv.parent.removeChild(rv)
    this.dragLayer.addChild(rv)
    rv.position.set(moving.x, moving.y)
    this.carried = moving
    this.offset = { x: p.x - moving.x, y: p.y - moving.y }
    this.state = 'dragging'

    this.scanRadarTargets()
    this.hooks.onCardsCarried?.(moving.members, true)
  }

  pointerMove(p: Vec2): void {
    this.lastPos = p
    if (this.state === 'dragging' && this.carried) {
      if (!this.carried.members || this.carried.members.length === 0 || !this.carried.members[0]) {
        this.carried = null
        this.state = 'idle'
        this.clearHover()
        this.radarTargets = []
        return
      }

      const curX = p.x - this.offset.x
      const curY = p.y - this.offset.y
      this.carried.members[0].view.position.set(curX, curY)
      this.carried.x = curX
      this.carried.y = curY

      this.updateHover(p)
    }
  }

  pointerUp(p: Vec2, button: number): void {
    this.lastPos = p
    if (button !== 0) return

    if (this.state === 'dragging' && this.carried) {
      const stack = this.carried
      this.carried = null
      this.state = 'idle'
      this.clearHover()
      this.radarTargets = []

      if (!stack.members || stack.members.length === 0 || !stack.members[0]) {
        this.hooks.onCardsCarried?.([], false)
        this.hooks.afterChange()
        return
      }

      this.hooks.onCardsCarried?.(stack.members, false)

      // batch42：连续采集快照提升至此（出售/投币/合并/空地各路径统一消费，中断必有提示）
      const pm = this.pendingTaskMove
      this.pendingTaskMove = null

      // batch30（二号裁定A）：带任务的堆只允许整堆搬迁——不参与出售/投币/合并，读条与进度保留
      if (stack.task) {
        // batch46：root 抓取形态的连续采集——工人若是旧堆 root，整堆（含任务）落到同类资源点时并入并迁移任务
        const tSrc = stack.task.recipe.consumeSource ? stack.task.recipe.sourceId : null
        if (tSrc) {
          let rt = this.board.findStackAt(p.x, p.y, stack)
          if (!rt) rt = this.findMagneticTarget(p, stack)
          if (rt && !rt.task && rt.members && rt.members[0] && rt.members[0].cardId === tSrc) {
            const carriedTask = stack.task
            stack.task = null
            this.board.mergeStacks(stack, rt)
            rt.task = carriedTask
            refreshStackView(rt)
            this.floaters.show(rt.x + CW / 2, rt.y - 12, '★ 连续采集：进度保留', '#38bdf8', 18)
            this.hooks.bounce(rt)
            this.hooks.afterChange()
            return
          }
        }
        const tx = p.x - this.offset.x
        const ty = p.y - this.offset.y
        const minX = CONSOLE_X + 24
        const maxX = CONSOLE_X + CONSOLE_W - CW - 24
        const minY = CONSOLE_Y + CONSOLE_TOP_ZONE
        const maxMaxY = Math.max(minY, CONSOLE_Y + CONSOLE_H - stackVisualHeight(stack) - 24)
        if (tx < minX || tx > maxX || ty < minY || ty > maxMaxY) {
          this.floaters.show(this.startPos.x, this.startPos.y - 12, '操作台外部或战备区禁止放置卡牌', '#ef4444', 18)
          this.bounceBack(stack)
          return
        }
        const safePos = this.board.findNonOverlappingPosition(stack, tx, ty)
        this.board.placeStack(stack, safePos.x, safePos.y)
        this.hooks.bounce(stack)
        this.hooks.afterChange()
        return
      }

      const moveDist = Math.hypot(p.x - this.startPos.x, p.y - this.startPos.y)
      if (moveDist < 6) {
        // batch47：点击开工对多成员堆同样生效（奶+浆果等合并堆此前被 members.length===1 挡死，任务永远起不来）；
        // 其余配方在合并瞬间已自动开局，此处 click-start 实际只会命中无工位烹饪，无副作用
        if (stack.members.length === 1) {
          const rootId = stack.members[0].cardId
          if (rootId === 'coin_chest') {
            this.board.placeStack(stack, stack.x, stack.y)
            this.hooks.onChestClick?.(stack)
            this.hooks.afterChange()
            return
          }
          if (rootId.startsWith('pack_')) {
            this.board.placeStack(stack, stack.x, stack.y)
            this.hooks.onPackClick?.(stack)
            this.hooks.afterChange()
            return
          }
        }
        this.board.placeStack(stack, stack.x, stack.y)
        this.hooks.tryStartTask(stack, true)
        this.hooks.afterChange()
        return
      }

      if (this.isInSellSlot(p, stack)) {
        this.onSell(stack)
        this.hooks.afterChange()
        return
      }

      const packIdx = this.getPackAt(p, stack)
      if (packIdx >= 0) {
        this.onDepositPack(packIdx, stack)
        this.hooks.afterChange()
        return
      }

      let target = this.board.findStackAt(p.x, p.y, stack)
      if (!target) {
        target = this.findMagneticTarget(p, stack)
      }

      // batch42：连续采集——目标为同 sourceId 的在跑采集任务时放行合并（工人加入，任务继续）
      const sameSourceTask = !!(pm && target && target.task && target.task.recipe.consumeSource &&
        target.task.recipe.sourceId === pm.sourceId)
      if (target && (!target.task || sameSourceTask) && target.members && target.members.length > 0 && target.members[0]) {
        const targetRootId = target.members[0].cardId
        const targetDef = getDef(targetRootId)
        const hasOurUnits = stack.members.some(m => getDef(m.cardId).isOurUnit)

        // C1 净化匝道（交战判断之前）：单张修女/智库拖到邪教徒堆 → 贴近放置 + 引擎净化计时
        const isPurifierSingle = stack.members.length === 1 &&
          (stack.members[0].cardId === 'battle_sister' || stack.members[0].cardId === 'private_librarian')
        if (isPurifierSingle && targetRootId === 'cultist') {
          this.board.placeStack(stack, target.x + 18, target.y + 18)
          this.hooks.onPurifyStart?.(stack.members[0], target)
          this.hooks.bounce(stack)
          this.hooks.afterChange()
          return
        }

        // batch24：疗伤贴匝道——单张草本疗伤贴拖到受伤我方单位 → 贴近放置 + 引擎疗伤读条（满血拒绝）
        const isMedPatch = stack.members.length === 1 && stack.members[0].cardId === 'herb_patch'
        if (isMedPatch && targetDef.category === 'unit' && targetDef.isOurUnit) {
          const patient = target.members[0]
          if ((patient.hp ?? 0) >= (patient.maxHp ?? 0)) {
            this.floaters.show(target.x + CW / 2, target.y - 12, '生命值已满，无需疗伤', '#94a3b8', 16)
            this.bounceBack(stack)
            return
          }
          this.board.placeStack(stack, target.x + 18, target.y + 18)
          this.hooks.onMedPatchStart?.(stack.members[0], target)
          this.hooks.bounce(stack)
          this.hooks.afterChange()
          return
        }

        // 0. 帝国什一税军舰纳税吞食判定
        if (targetRootId === 'tax_ship') {
          this.hooks.onDepositTaxShip?.(target, stack)
          this.hooks.afterChange()
          return
        }

        // 1. 先手交战 / 宰杀
        const isCombatTarget = targetDef.category === 'enemy'
        if (isCombatTarget && hasOurUnits) {
          // batch39：交锋落位移交 combat.arrangeEngage（弧形铺开、不堆叠）
          this.hooks.onManualEngage?.(stack, target)
          this.hooks.bounce(stack)
          this.hooks.afterChange()
          return
        }

        // 2. 装备穿戴双向判定
        const movingIsGear = stack.members.length === 1 && isWearable(stack.members[0].cardId)
        const targetIsUnit = target.members.length === 1 && getDef(targetRootId).category === 'unit'
        const movingIsUnit = stack.members.length === 1 && getDef(stack.members[0].cardId).category === 'unit'
        const targetIsGear = target.members.length === 1 && isWearable(targetRootId)

        if ((movingIsGear && targetIsUnit) || (movingIsUnit && targetIsGear)) {
          const unitCard = movingIsUnit ? stack.members[0] : target.members[0]
          const unitStack = movingIsUnit ? stack : target
          const gearCard = movingIsGear ? stack.members[0] : target.members[0]
          const gearStack = movingIsGear ? stack : target

          const check = canEquip(unitCard, gearCard.cardId)
          if (!check.ok) {
            this.floaters.show(unitStack.x + CW / 2, unitStack.y - 12, check.reason, '#ef4444', 18)
            this.bounceBack(stack)
            return
          }

          const finalX = movingIsUnit ? target.x : unitStack.x
          const finalY = movingIsUnit ? target.y : unitStack.y

          applyEquip(unitCard, gearCard.cardId)
          this.board.removeCard(gearCard)

          if (movingIsUnit) {
            this.board.placeStack(unitStack, finalX, finalY)
          }

          refreshCardBadge(unitCard)
          refreshStackView(unitStack)

          const gearName = getDef(gearCard.cardId).name
          this.floaters.show(finalX + CW / 2, finalY - 14, `★ 装备成功: ${gearName}`, '#4ade80', 22)
          this.hooks.bounce(unitStack)
          this.hooks.afterChange()
          return
        }

        // 3. 金币箱存款
        if (targetRootId === 'coin_chest' && stack.members.every(m => m.cardId === 'coin')) {
          this.onDepositChest(target, stack)
          this.hooks.afterChange()
          return
        }

        // 4. 星际食堂存粮
        if (targetRootId === 'mess_hall' && stack.members.every(m => getDef(m.cardId).category === 'food')) {
          this.onDepositMessHall(target, stack)
          this.hooks.afterChange()
          return
        }

        // 5. 太空养殖场圈养
        if (targetRootId === 'breeding_farm' && stack.members.every(m => m.cardId === 'grox')) {
          const curCount = target.members.filter(m => m.cardId === 'grox').length
          const toAdd = stack.members.length
          if (curCount + toAdd > 5) {
            this.floaters.show(target.x + CW / 2, target.y - 12, '太空养殖场已满（上限 5 只）', '#ffaa66', 18)
            this.bounceBack(stack)
            return
          }
          this.board.mergeStacks(stack, target)
          this.floaters.show(target.x + CW / 2, target.y - 12, `已圈养格罗克斯兽 (${curCount + toAdd}/5)`, '#4ade80', 20)
          this.hooks.bounce(target)
          this.hooks.afterChange()
          return
        }

        // 6. 货棚与货仓仓储收纳
        const isTargetWarehouse = targetRootId === 'shed' || targetRootId === 'warehouse'
        const isMovingWarehouse = stack.members[0].cardId === 'shed' || stack.members[0].cardId === 'warehouse'

        if (isTargetWarehouse || isMovingWarehouse) {
          const warehouseStack = isTargetWarehouse ? target : stack
          const storedStack = isTargetWarehouse ? stack : target
          const warehouseDef = getDef(warehouseStack.members[0].cardId)

          const hasLiving = storedStack.members.some(m => {
            const cat = getDef(m.cardId).category
            return cat === 'unit' || cat === 'enemy'
          })

          if (hasLiving) {
            this.floaters.show(stack.x + CW / 2, stack.y - 12, '仓库无法存放活物！', '#ef4444', 18)
            this.bounceBack(stack)
            return
          }

          if (isTargetWarehouse) {
            this.board.mergeStacks(stack, target)
            this.floaters.show(target.x + CW / 2, target.y - 12, `已存入${warehouseDef.name}`, '#4ade80', 20)
            this.hooks.bounce(target)
          } else {
            this.board.mergeStacks(target, stack)
            this.board.placeStack(stack, target.x, target.y)
            this.floaters.show(stack.x + CW / 2, stack.y - 12, `已收纳至${warehouseDef.name}`, '#4ade80', 20)
            this.hooks.bounce(stack)
          }
          this.hooks.afterChange()
          return
        }

        // 7. 合成配方与同类（资源点、同兵种人口、材料、食物等）宽松收纳校验
        const canStack = this.checkStackCompatibility(stack, target)
        if (!canStack.allowed) {
          this.floaters.show(stack.x + CW / 2, stack.y - 12, canStack.reason, '#ef4444', 18)
          this.bounceBack(stack)
          return
        }

        // batch38/42：连续采集——落点为同类资源点（无任务）时，旧任务（含进度）直接迁到新堆；有同型任务则并入
        let xfer: ActiveTask | null = null
        if (pm) {
          if (!target.task && target.members[0] && target.members[0].cardId === pm.sourceId) {
            xfer = pm.task
          } else {
            this.floaters.show(this.startPos.x, this.startPos.y - 12, '已中断生产', '#ffaa66', 18)
          }
        }
        this.board.mergeStacks(stack, target)
        if (xfer) {
          target.task = xfer
          refreshStackView(target)
          this.floaters.show(target.x + CW / 2, target.y - 12, '★ 连续采集：进度保留', '#38bdf8', 18)
        } else if (sameSourceTask) {
          this.floaters.show(target.x + CW / 2, target.y - 12, '已加入进行中的采集任务', '#38bdf8', 16)
        } else {
          this.hooks.tryStartTask(target)
        }
        this.hooks.bounce(target)
      } else {
        // batch42：连续采集未落到同类资源点 → 明确提示中断（旧任务在抓取时已作废）
        if (pm) {
          this.floaters.show(this.startPos.x, this.startPos.y - 12, '已中断生产', '#ffaa66', 18)
        }
        // 核心落点与操作台禁区校验
        const dropX = p.x - this.offset.x
        const dropY = p.y - this.offset.y

        const minX = CONSOLE_X + 24
        const maxX = CONSOLE_X + CONSOLE_W - CW - 24
        const minY = CONSOLE_Y + CONSOLE_TOP_ZONE // 避开上方商店买卖槽位
        const maxY = CONSOLE_Y + CONSOLE_H - stackVisualHeight(stack) - 24

        // 规则 1：卡牌严禁放置在操作台外部或上方买卖禁区内，非法时平滑回弹
        if (dropX < minX || dropX > maxX || dropY < minY || dropY > maxY) {
          this.floaters.show(this.startPos.x, this.startPos.y - 12, '操作台外部或战备区禁止放置卡牌', '#ef4444', 18)
          this.bounceBack(stack)
          return
        }

        // 规则 2：防两组卡完全上下无缝覆盖重叠
        const safePos = this.board.findNonOverlappingPosition(stack, dropX, dropY)
        this.board.placeStack(stack, safePos.x, safePos.y)
        this.hooks.bounce(stack)
      }

      this.hooks.afterChange()
    }
  }

  private scanRadarTargets(): void {
    this.radarTargets = []
    if (!this.carried || !this.carried.members || this.carried.members.length === 0) return

    const carriedCards = this.carried.members
    const rootCard = carriedCards[0]
    const rootDef = getDef(rootCard.cardId)

    for (const s of this.board.stacks.values()) {
      if (s === this.carried || s.task || !s.members || s.members.length === 0) continue

      const targetRoot = s.members[0]
      const targetDef = getDef(targetRoot.cardId)

      // 0. 帝国什一税军舰雷达高亮
      if (targetRoot.cardId === 'tax_ship') {
        const shipType = targetRoot.taxType
        const isGoldMatch = shipType === 'gold' && carriedCards.every(m => m.cardId === 'coin')
        const isPopMatch = shipType === 'population' && carriedCards.every(m => {
          const d = getDef(m.cardId)
          return d.isOurUnit && m.cardId !== 'baby'
        })
        const isSeedMatch = shipType === 'seed' && carriedCards.every(m => m.cardId === 'gene_seed')

        if (isGoldMatch || isPopMatch || isSeedMatch) {
          this.radarTargets.push({ stack: s, color: 0xf59e0b })
          continue
        }
      }

      // 1. 装备穿戴雷达（绿光）
      if (carriedCards.length === 1 && isWearable(rootCard.cardId)) {
        if (s.members.length === 1 && targetDef.category === 'unit' && canEquip(targetRoot, rootCard.cardId).ok) {
          this.radarTargets.push({ stack: s, color: 0x10b981 })
          continue
        }
      }
      if (carriedCards.length === 1 && rootDef.category === 'unit') {
        if (s.members.length === 1 && isWearable(targetRoot.cardId) && canEquip(rootCard, targetRoot.cardId).ok) {
          this.radarTargets.push({ stack: s, color: 0x10b981 })
          continue
        }
      }

      // batch24：疗伤贴雷达（受伤我方单位绿光）
      if (carriedCards.length === 1 && rootCard.cardId === 'herb_patch') {
        if (targetDef.category === 'unit' && targetDef.isOurUnit && (targetRoot.hp ?? 0) < (targetRoot.maxHp ?? 0)) {
          this.radarTargets.push({ stack: s, color: 0x4ade80 })
          continue
        }
      }

      // 2. 敌对交战突袭雷达（红光）
      if (carriedCards.some(m => getDef(m.cardId).isOurUnit)) {
        if (targetDef.category === 'enemy') {
          this.radarTargets.push({ stack: s, color: 0xf43f5e })
          continue
        }
      }

      // 3. 仓储基建雷达
      if (targetRoot.cardId === 'coin_chest' && carriedCards.every(m => m.cardId === 'coin')) {
        this.radarTargets.push({ stack: s, color: 0xfacc15 })
        continue
      }
      if (targetRoot.cardId === 'mess_hall' && carriedCards.every(m => getDef(m.cardId).category === 'food')) {
        this.radarTargets.push({ stack: s, color: 0x4ade80 })
        continue
      }
      if (targetRoot.cardId === 'shed' || targetRoot.cardId === 'warehouse') {
        const hasLiving = carriedCards.some(m => {
          const c = getDef(m.cardId).category
          return c === 'unit' || c === 'enemy'
        })
        if (!hasLiving) {
          this.radarTargets.push({ stack: s, color: 0x00f0ff })
          continue
        }
      }

      // 4. 合成配方与前缀探针雷达
      const candidateEntities: RecipeCandidate[] = [...s.members, ...carriedCards].map(m => ({
        cardId: m.cardId,
        trait: m.trait || 'none',
        origin: m.originUnit
      }))

      if (matchRecipe(candidateEntities)) {
        this.radarTargets.push({ stack: s, color: 0xf59e0b })
        continue
      }

      const combinedIds = [...s.members, ...carriedCards].map(m => m.cardId)
      if (this.isRecipePrefix(combinedIds)) {
        this.radarTargets.push({ stack: s, color: 0x00f0ff })
        continue
      }

      // 5. 放宽：同类资源点堆叠雷达（蓝绿光）
      if (rootDef.category === 'resource_point' && carriedCards.every(m => m.cardId === rootCard.cardId)) {
        if (s.members.every(m => m.cardId === rootCard.cardId)) {
          this.radarTargets.push({ stack: s, color: 0x2dd4bf })
          continue
        }
      }

      // 6. 放宽：同兵种人口收纳堆叠雷达（绿光）（格罗克斯兽除外：禁互堆）
      if (rootDef.category === 'unit' && rootCard.cardId !== 'grox' && carriedCards.every(m => m.cardId === rootCard.cardId)) {
        if (s.members.every(m => m.cardId === rootCard.cardId)) {
          this.radarTargets.push({ stack: s, color: 0x22c55e })
          continue
        }
      }

      // 7. 货币、食物、装备、材料宽松收纳雷达
      if (rootCard.cardId === 'coin' && carriedCards.every(m => m.cardId === 'coin')) {
        if (s.members.every(m => m.cardId === 'coin')) {
          this.radarTargets.push({ stack: s, color: 0xfacc15 })
          continue
        }
      }
      if (rootDef.category === 'food' && carriedCards.every(m => getDef(m.cardId).category === 'food')) {
        if (s.members.every(m => getDef(m.cardId).category === 'food')) {
          this.radarTargets.push({ stack: s, color: 0x4ade80 })
          continue
        }
      }
      // batch46：材料/主意雷达同样排除金币（金币只吸金币）
      if ((rootDef.category === 'material' || rootDef.category === 'idea') &&
          carriedCards.every(m => m.cardId !== 'coin' && (getDef(m.cardId).category === 'material' || getDef(m.cardId).category === 'idea'))) {
        if (s.members.every(m => m.cardId !== 'coin' && (getDef(m.cardId).category === 'material' || getDef(m.cardId).category === 'idea'))) {
          this.radarTargets.push({ stack: s, color: 0x38bdf8 })
          continue
        }
      }
      if (rootDef.category === 'equipment' && carriedCards.every(m => getDef(m.cardId).category === 'equipment')) {
        if (s.members.every(m => getDef(m.cardId).category === 'equipment')) {
          this.radarTargets.push({ stack: s, color: 0x818cf8 })
          continue
        }
      }
      // batch37：疗伤贴同类堆叠雷达（绿光）
      if (rootDef.category === 'medical' && carriedCards.every(m => getDef(m.cardId).category === 'medical')) {
        if (s.members.every(m => getDef(m.cardId).category === 'medical')) {
          this.radarTargets.push({ stack: s, color: 0x4ade80 })
          continue
        }
      }
    }
  }

  private findMagneticTarget(p: Vec2, exclude: Stack): Stack | null {
    let closest: Stack | null = null
    let minD = 35

    for (const s of this.board.stacks.values()) {
      if (s === exclude || s.task || !s.members || s.members.length === 0 || !s.members[0]) continue

      const left = s.x
      const right = s.x + CW
      const top = s.y
      const bottom = s.y + stackVisualHeight(s)

      const dx = Math.max(left - p.x, 0, p.x - right)
      const dy = Math.max(top - p.y, 0, p.y - bottom)
      const dist = Math.hypot(dx, dy)

      if (dist <= minD) {
        minD = dist
        closest = s
      }
    }
    return closest
  }

  /** 放宽：放行同类可采集点位堆叠，放行同兵种人口自由堆叠收纳 */
  private checkStackCompatibility(moving: Stack, target: Stack): { allowed: boolean; reason: string } {
    if (!target.members || target.members.length === 0 || !moving.members || moving.members.length === 0) {
      return { allowed: true, reason: '' }
    }

    const combinedMembers = [...target.members, ...moving.members]

    // 巢都婴儿独占守卫：巢都内已有婴儿时，成年人口禁止入驻（会被强制弹出）
    if (combinedMembers.some(m => m.cardId === 'hive_city') &&
        combinedMembers.some(m => m.cardId === 'baby') &&
        combinedMembers.some(m => !!getDef(m.cardId).isLabor)) {
      return { allowed: false, reason: '巢都正抚育婴儿，成年人口无法入驻' }
    }

    // 军舰独立隔离保护
    if (combinedMembers.some(m => m.cardId === 'tax_ship')) {
      return { allowed: false, reason: '什一税军舰无法混合堆叠！' }
    }

    const hasAssassinGear = combinedMembers.some(m => m.cardId === 'assassin_gear')
    const hasCivilian = combinedMembers.some(m => m.cardId === 'civilian')
    const hasAuxilia = combinedMembers.some(m => m.cardId === 'auxilia')
    if (hasAssassinGear && hasCivilian && !hasAuxilia) {
      return { allowed: false, reason: '需要太空辅助军' }
    }

    // B3 修复：管棒为普通装备，不阻断转职（armedCivilian 守卫整段移除，装备继承机制已存在）

    // 1. 同兵种人口放行堆叠收纳（如平民+平民、辅助军+辅助军）；仅阻断不同兵种之间的杂乱堆叠
    const firstUnitId = combinedMembers[0].cardId
    // B2 修复：格罗克斯兽互堆不再走同兵种放行（兽+兽→下方混堆拦截块处理）
    const isAllSameUnit = firstUnitId !== 'grox' && combinedMembers.every(m => getDef(m.cardId).category === 'unit' && m.cardId === firstUnitId)
    if (isAllSameUnit) {
      return { allowed: true, reason: '' }
    }

    // B1 修复：宰杀/配方匹配优先于兵种混堆拦截（平民拖格罗克斯兽=宰杀配方需先行命中放行）
    const candidateEntities: RecipeCandidate[] = combinedMembers.map(m => ({
      cardId: m.cardId,
      trait: m.trait || 'none',
      origin: m.originUnit
    }))

    if (matchRecipe(candidateEntities)) {
      return { allowed: true, reason: '' }
    }

    const cardIds = combinedMembers.map(m => m.cardId)
    if (this.isRecipePrefix(cardIds)) {
      return { allowed: true, reason: '' }
    }

    const allAreUnits = combinedMembers.every(m => getDef(m.cardId).category === 'unit')
    if (allAreUnits && combinedMembers.length > 1) {
      return { allowed: false, reason: '不同兵种人口禁止杂乱堆叠' }
    }

    const hasEnemy = combinedMembers.some(m => getDef(m.cardId).category === 'enemy')
    if (hasEnemy) {
      return { allowed: false, reason: '敌对单位无法堆叠收纳' }
    }

    // 2. 同类可采集点位放行堆叠收纳（如废料堆+废料堆、瓦砾堆+瓦砾堆）
    const firstPointId = combinedMembers[0].cardId
    const isAllSamePoint = combinedMembers.every(m => getDef(m.cardId).category === 'resource_point' && m.cardId === firstPointId)
    if (isAllSamePoint) {
      return { allowed: true, reason: '' }
    }

    if (combinedMembers.every(m => m.cardId === 'coin')) {
      return { allowed: true, reason: '' }
    }
    // batch51：恢复全食物组放行（batch35 完美态口径）——同 ID 食物（生奶+生奶/浆果+浆果）靠本组兜底；
    // 不同食物合并后凑齐配方即开火（batch49 已撤自动闸），与备份版行为一致
    if (combinedMembers.every(m => getDef(m.cardId).category === 'food')) {
      return { allowed: true, reason: '' }
    }
    // batch37：疗伤贴允许同类堆叠（仅归拢占位，拖到受伤单位上才触发读条回血）
    if (combinedMembers.every(m => getDef(m.cardId).category === 'medical')) {
      return { allowed: true, reason: '' }
    }
    if (combinedMembers.every(m => getDef(m.cardId).category === 'equipment')) {
      return { allowed: true, reason: '' }
    }
    // batch51：恢复材料/主意组放行（batch35 完美态口径 + batch46 金币排除保留）——
    // 同 ID 材料（石料+石料/零件+零件）靠本组兜底；金币为独立货币类型不入组
    if (combinedMembers.every(m => {
      const cat = getDef(m.cardId).category
      return (cat === 'material' && m.cardId !== 'coin') || cat === 'idea'
    })) {
      return { allowed: true, reason: '' }
    }

    const hasBlackMarket = combinedMembers.some(m => m.cardId === 'black_market')
    if (hasBlackMarket && combinedMembers.length === 2) {
      const other = combinedMembers.find(m => m.cardId !== 'black_market')
      if (other) {
        const od = getDef(other.cardId)
        if (!od.unsellable && od.price > 0 && !od.isOurUnit) {
          return { allowed: true, reason: '' }
        }
      }
    }

    // 格罗克斯兽禁互堆（放在配方判定之后：拖人上去=宰杀配方已先行放行；兽+兽/兽+物资在此拦截，保养殖场圈养价值）
    if (combinedMembers.some(m => m.cardId === 'grox')) {
      return { allowed: false, reason: '格罗克斯兽无法堆叠收纳，请拖入太空养殖场圈养' }
    }

    return { allowed: false, reason: '无法堆叠或不构成已知配方' }
  }

  private isRecipePrefix(currentIds: string[]): boolean {
    const currentCounts: Record<string, number> = {}
    for (const id of currentIds) currentCounts[id] = (currentCounts[id] || 0) + 1

    for (const r of RECIPES) {
      let allCardsBelongToRecipe = true
      for (const cardId in currentCounts) {
        // 冲突A：劳动力卡按 civilian 槽位计（消耗型槽位除外）
        const laborAlias = getDef(cardId).isLabor === true && !(r.consumes && r.consumes['civilian'])
        const effId = laborAlias ? 'civilian' : cardId
        const reqCount = r.inputs[effId] || 0
        const inAny = r.anyInputs?.some(g => g.options.includes(cardId)) ||
          (laborAlias && (r.anyInputs?.some(g => g.options.some(o => !!getDef(o).isLabor)) || false))

        if (reqCount === 0 && !inAny) {
          allCardsBelongToRecipe = false
          break
        }

        if (reqCount > 0 && currentCounts[cardId] > reqCount) {
          const isWorker = effId === 'civilian' || cardId === 'auxilia'
          const consumesWorker = r.consumes && r.consumes[effId]
          if (!isWorker || consumesWorker) {
            allCardsBelongToRecipe = false
            break
          }
        }
      }

      if (allCardsBelongToRecipe) return true
    }
    return false
  }

  private bounceBack(stack: Stack): void {
    const minX = CONSOLE_X + 24
    const maxX = CONSOLE_X + CONSOLE_W - CW - 24
    const minY = CONSOLE_Y + CONSOLE_TOP_ZONE
    const maxY = Math.max(minY, CONSOLE_Y + CONSOLE_H - stackVisualHeight(stack) - 24)

    const origTargetX = this.startPos.x - this.offset.x
    const origTargetY = this.startPos.y - this.offset.y
    const nx = clamp(origTargetX, minX, maxX)
    const ny = clamp(origTargetY, minY, maxY)

    this.board.placeStack(stack, nx, ny)
    this.hooks.bounce(stack)
    this.hooks.afterChange()
  }

  private updateHover(p: Vec2): void {
    this.clearHover()
    if (!this.carried || !this.carried.members || this.carried.members.length === 0 || !this.carried.members[0]) return

    const pIdx = this.getPackAt(p)
    if (pIdx >= 0) {
      this.hoverPackIndex = pIdx
      return
    }

    let target = this.board.findStackAt(p.x, p.y, this.carried)
    if (!target) {
      target = this.findMagneticTarget(p, this.carried)
    }

    if (!target || target.task || !target.members || target.members.length === 0 || !target.members[0]) return

    const targetRootId = target.members[0].cardId
    const tDef = getDef(targetRootId)

    if (targetRootId === 'tax_ship') {
      const shipType = target.members[0].taxType
      const carriedCards = this.carried.members
      let isMatch = false

      if (shipType === 'gold' && carriedCards.every(m => m.cardId === 'coin')) isMatch = true
      else if (shipType === 'population' && carriedCards.every(m => getDef(m.cardId).isOurUnit && m.cardId !== 'baby')) isMatch = true
      else if (shipType === 'seed' && carriedCards.every(m => m.cardId === 'gene_seed')) isMatch = true

      this.hoverTaxShip = target
      this.hoverTarget = target
      this.hoverRecipe = {
        id: 'deposit_tax',
        name: isMatch ? '⚡ 交付什一税额' : '⚠️ 特使不接受此物资！',
        baseTime: 0,
        inputs: {},
        outputs: {}
      }
      this.hoverRecipeUnlocked = isMatch
      return
    }

    const movingIsGear = this.carried.members.length === 1 && isWearable(this.carried.members[0].cardId)
    const targetIsUnit = target.members.length === 1 && tDef.category === 'unit'
    const movingIsUnit = this.carried.members.length === 1 && getDef(this.carried.members[0].cardId).category === 'unit'
    const targetIsGear = target.members.length === 1 && isWearable(targetRootId)

    if (movingIsGear && targetIsUnit) {
      const gearName = getDef(this.carried.members[0].cardId).name
      this.hoverTarget = target
      this.hoverRecipe = { id: 'wear_gear', name: `穿戴装备: ${gearName}`, baseTime: 0, inputs: {}, outputs: {} }
      this.hoverRecipeUnlocked = true
      return
    }

    if (movingIsUnit && targetIsGear) {
      const gearName = getDef(targetRootId).name
      this.hoverTarget = target
      this.hoverRecipe = { id: 'wear_gear', name: `穿戴装备: ${gearName}`, baseTime: 0, inputs: {}, outputs: {} }
      this.hoverRecipeUnlocked = true
      return
    }

    if (tDef.category === 'enemy' && this.carried.members.some(m => getDef(m.cardId).isOurUnit)) {
      this.hoverTarget = target
      this.hoverRecipe = { id: 'engage', name: `交战突袭: ${tDef.name} (先手出招)`, baseTime: 0, inputs: {}, outputs: {} }
      this.hoverRecipeUnlocked = true
      return
    }

    if (targetRootId === 'coin_chest' && this.carried.members.every(m => m.cardId === 'coin')) {
      this.hoverChest = target
      return
    }

    if (targetRootId === 'mess_hall' && this.carried.members.every(m => getDef(m.cardId).category === 'food')) {
      this.hoverTarget = target
      this.hoverRecipe = { id: 'store_mess_hall', name: '存入星际食堂 (免占卡槽)', baseTime: 0, inputs: {}, outputs: {} }
      this.hoverRecipeUnlocked = true
      return
    }

    if (targetRootId === 'shed' || targetRootId === 'warehouse') {
      const hasLiving = this.carried.members.some(m => {
        const cat = getDef(m.cardId).category
        return cat === 'unit' || cat === 'enemy'
      })
      if (!hasLiving) {
        this.hoverTarget = target
        this.hoverRecipe = { id: 'store_warehouse', name: `存入${tDef.name}`, baseTime: 0, inputs: {}, outputs: {} }
        this.hoverRecipeUnlocked = true
        return
      }
    }

    // batch24：疗伤贴悬停提示
    if (this.carried.members.length === 1 && this.carried.members[0].cardId === 'herb_patch' &&
        tDef.category === 'unit' && tDef.isOurUnit) {
      this.hoverTarget = target
      this.hoverRecipe = { id: 'med_patch', name: `使用草本疗伤贴（+${HERB_PATCH_HEAL} HP）`, baseTime: 0, inputs: {}, outputs: {} }
      this.hoverRecipeUnlocked = true
      return
    }

    const candidateEntities: RecipeCandidate[] = [...target.members, ...this.carried.members].map(m => ({
      cardId: m.cardId,
      trait: m.trait || 'none',
      origin: m.originUnit
    }))

    const recipe = matchRecipe(candidateEntities)
    if (recipe) {
      this.hoverTarget = target
      this.hoverRecipe = recipe
      this.hoverRecipeUnlocked = !recipe.needsUnlock || !!this.hooks.isRecipeUnlocked?.(recipe.id)
    }
  }

  private clearHover(): void {
    this.hoverTarget = null
    this.hoverRecipe = null
    this.hoverRecipeUnlocked = false
    this.hoverPackIndex = -1
    this.hoverChest = null
    this.hoverTaxShip = null
  }
}
