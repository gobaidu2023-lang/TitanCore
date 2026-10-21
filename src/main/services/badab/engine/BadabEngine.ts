// BadabEngine.ts 巴达布前哨 - 引擎主控：2500x1400大世界、真战术摄像机缩放、爆仓硬阻断、自动分垛、防完全重叠与120s生奶
// [新手引导] 本版：任务事件总线 onQuestEvent + grantCards(立绘后飞入) + grantStarterPack(受控发牌) + setPaused(userAction) + tutorialGrace(新手宽限期)
// [新手引导] pack_opened 判定修正：整包拆完（补给包卡消失）才发事件，首次点击仅启动时钟
import 'pixi.js/unsafe-eval'
import { Application, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js'
import { Board } from './Board'
import { miniGameAssetBase } from '../../../../utils/minigameAssetBase'
import { DragDrop } from './DragDrop'
import { TweenManager, Easings } from './Tween'
import { Floater } from './Floater'
import {
  Stack, CardEntity, ActiveTask, refreshStackView, refreshCardBadge, stackVisualHeight, TAX_SHIP_W, TAX_SHIP_H,
  BOARD_W, BOARD_H, CONSOLE_W, CONSOLE_H, CONSOLE_X, CONSOLE_Y, CONSOLE_TOP_ZONE,
  F_PLATE, F_MID, F_SMALL, F_STACK, F_PRICE, F_ICON, F_TAX, PC_FONT_FAMILY
} from './Stack'
import { CARD_W, CARD_H, DEMO_ASSET_IDS, getDef, HERB_PATCH_HEAL, MED_PATCH_TIME, FARMLAND_DOUBLE_CHANCE } from '../game/cards'
import { matchRecipe, RECIPES, RecipeCandidate } from '../game/recipes'
import {
  DelayedQueue,
  MonthSettlementResult,
  StoredFoodItem,
  getFeedPriority
} from '../game/cycle'
import { generatePackCards, PACK_CONFIGS, rollAnyUnownedIdea } from '../game/packs'
import { CombatManager } from '../game/combat'
import { EQUIP_CONFIGS } from '../game/equipment'
import { CardDef, Vec2, TraitType, TaxType } from '../game/types'
import { useBadabStore } from '../../../../stores/badabStore'
import { save as mgSave, load as mgLoad, deleteSave as mgDeleteSave } from '../../miniGameService'

const MONTH_LENGTH = 120
const CORPSE_MUTATE_DELAY = 70
// batch14存档：localStorage 键（复用 miniGameService 的 tc_minigame_ 前缀体系）
const SAVE_KEY = 'badab_save'
const META_KEY = 'badab_meta'
// 基础上限 24（一号裁定：总上限 96 = 24 + 货棚3×4 + 货仓3×20）
// batch52：征税周期（年）——全链路唯一口径，挂 tuner
const TAX_CYCLE_YEARS = 5
const BASE_CARD_CAP = 24
// 劳动力加速上限：单个读条最多计入 2 名劳动力（防无限堆人秒产，一号裁定）
const MAX_TASK_WORKERS = 2
// C3 兽繁殖：场上格罗克斯兽 ≥2 只时的繁殖周期（秒，挂调参器）；任何时刻 <2 只计时清零
const GROX_BREED_TIME = 240
// batch62：高阶包(≥15金)主意保底阈值——连续 8 个高阶包未开出未解锁主意，第 9 个必出（计数随存档持久化）
const IDEA_PITY_LIMIT = 8
// 默认缩放：一号全屏实测 147% 最舒适（2026-09-15 裁定，窗口/全屏一律）；滚轮可微调(1.0~1.8)，minZoom 1.0 可退回铺满
const DEFAULT_ZOOM = 1.47
// 滚轮步进（已挂调参器，按实机手感微调）
const ZOOM_STEP_IN = 1.08
const ZOOM_STEP_OUT = 0.92

// 战术操作台内的相对基准位置
const SELL_X = CONSOLE_X + 40
const SELL_Y = CONSOLE_Y + 16
const SHOP_SLOT_W = 160
const SHOP_SLOT_H = 160
const SHOP_GAP = 120
// 出售槽边长（正方形，等于卡宽；补给包槽仍用 SHOP_SLOT_W/H 保持卡面比例）
const SELL_SLOT_SIZE = 160

const SHOP_PACK_IDS = [
  'pack_pioneer',
  'pack_blueprints',
  'pack_supplies',
  'pack_industry',
  'pack_ruins',
  'pack_armory'
]

const OUTPUT_OFFSETS = [
  { x: -CARD_W - 24, y: 0 }, { x: CARD_W + 24, y: 0 },
  { x: 0, y: CARD_H + 28 }, { x: -CARD_W - 24, y: CARD_H + 28 }, { x: CARD_W + 24, y: CARD_H + 28 }
]

export interface CameraTransform {
  scale: number
  x: number
  y: number
  width: number
  height: number
  zoom: number
  worldX: number
  worldY: number
}

// [新手引导] 任务系统事件总线类型（quests.ts 的 match.event 对应此处）
export type BadabQuestEvent =
  | 'pack_opened'
  | 'harvest_done'
  | 'recipe_done'
  | 'card_sold'
  | 'pack_bought'
  | 'pause_toggled'
  | 'feeding_done'
  | 'year_started'

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

export class BadabEngine {
  private app: Application | null = null
  private containerEl: HTMLElement
  private store = useBadabStore()

  private rootDesignStage = new Container()
  private shopLayer = new Container()
  private cardLayer = new Container()
  private dragLayer = new Container()
  private fxLayer = new Container()
  private hintLayer = new Container()
  private hintG = new Graphics()
  private hintText = new Text({
    text: '',
    style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: Math.round(F_PLATE * 1.4), fill: '#00f0ff', fontWeight: '900', stroke: { color: '#000000', width: 4 } })
  })

  private textures = new Map<string, Texture>()
  // batch39：交战区域圈绘制层（纯表现，零逻辑耦合）
  private battleZoneG = new Graphics()
  // batch28：商店格包图独立加载（不进卡面系统；缺图静默回退色块）
  private packTextures = new Map<string, Texture>()
  public board: Board = null as unknown as Board
  public dragDrop: DragDrop = null as unknown as DragDrop
  private tweens = new TweenManager()
  private floaters: Floater = null as unknown as Floater
  private delayed = new DelayedQueue()
  private combat: CombatManager = null as unknown as CombatManager

  // ================= 战术摄像机缩放与全图漫游 =================
  private zoom = DEFAULT_ZOOM
  private readonly minZoom = 1.0
  private readonly maxZoom = 1.8
  private stageX = 0
  private stageY = 0
  private baseScale = 1
  private currentScale = 1
  private viewportW = 1920
  private viewportH = 1080

  private isPanning = false
  private isPendingPan = false
  private panStart: Vec2 = { x: 0, y: 0 }
  private panStageStart: Vec2 = { x: 0, y: 0 }
  private anchorWorldPos: Vec2 = { x: BOARD_W / 2, y: BOARD_H / 2 }

  private gameTime = 0
  private monthTimer = 0
  private month = 1
  private gold = 0
  private corruption = 0
  private paused = false
  private outputCounter = 0
  private gameOverFired = false
  private isDestroyed = false

  public gameStarted = false
  // [新手引导] 新手宽限期：true 时月份计时不推进（任务链完成前不触发年末；生产/采集正常）
  public tutorialGrace = false
  private pioneerPityCounter = 0
  // batch36：抗税次数——每次抗税 +10×N；任意一次成功完税清零（存档持久化）
  private taxMissCount = 0
  // batch62：高阶包主意保底计数（连续未开出未解锁主意的高阶包数）
  private ideaPityCount = 0
  private packQueues = new Map<string, string[]>()
  private messHallStorages = new Map<string, StoredFoodItem[]>()
  private groxAiStates = new Map<number, { hopTimer: number; milkTimer: number }>()
  private groxBreedTimer = 0
  // batch58：尸变倒计时可视化（秒；作业堆中暂停推进，与 batch18 语义一致）
  private mutateTimers = new Map<number, number>()

  // 工业级硬阻断节流计时器
  private blockFloaterTimer = 0

  public isSettling = false
  public settlementReport: MonthSettlementResult | null = null

  // ================= 年末结算向导（④⑤：分步交互 / 售卡阶段隐UI去模糊） =================
  public settlementPhase: 'feeding' | 'tax' | 'clearance' | 'sell' | 'confirm' | null = null
  public taxNoticePending = false
  public onSettlementPhase: ((phase: 'feeding' | 'tax' | 'clearance' | 'sell' | 'confirm' | null) => void) | null = null
  private feedingRunning = false
  private enforcingNests = false

  public unlockedRecipes = new Set<string>([
    'craft_parts', 'craft_scrap_club', 'build_hive_city', 'build_shed',
    'produce_scrap', 'produce_stone', 'produce_titanium', 'build_rift_beacon'
  ])

  private chestCoins = new Map<string, number>()
  private packDeposited = new Map<number, number>()
  private lastTaxBannerValue = ''
  // batch14存档：Vue 侧附加状态（任务链等）提供者 + 读档后的附加状态缓存
  private saveExtraProvider: (() => Record<string, unknown> | null) | null = null
  private lastLoadedExtra: Record<string, unknown> | null = null

  public onGameOver: (() => void) | null = null
  // batch50：帧守卫错误上报（dist 无 devtools，经 Vue 错误横幅呈现）
  public onError: ((msg: string) => void) | null = null
  private tickErrorSet = new Set<string>()
  public onCardHover: ((card: CardDef | null, entity?: CardEntity | null) => void) | null = null
  public onUnlockRecipe: ((recipeId: string) => void) | null = null
  public onSettlementStart: ((report: MonthSettlementResult) => void) | null = null
  public onSettlementEnd: (() => void) | null = null
  public onVictory: ((route: 'justice' | 'corruption', text: string, elapsedSeconds: number, starYear: number) => void) | null = null
  public onCameraChange: ((trans: CameraTransform) => void) | null = null
  // [新手引导] 任务系统事件总线：Vue 层挂任务进度与年末剧情推进
  public onQuestEvent: ((event: BadabQuestEvent, data?: string) => void) | null = null
  // batch54：新周期开始演出钩子（修女警觉→大魔低语→税务官收税提醒；统一锚定新年开始，免疫腐化跳档）
  public onDemonWhisper: ((band: 1 | 2 | 3) => void) | null = null
  public onSisterWarn: (() => void) | null = null
  public onTaxReminder: ((band: 0 | 1 | 2 | 3) => void) | null = null
  private sisterWarned = false

  private onContextMenu = (e: Event) => e.preventDefault()

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
    this.hintText.visible = false
    // batch14：配方元进度（跨局永久保留）——构造时即并入默认解锁表
    try {
      const meta = mgLoad(META_KEY)
      if (meta && Array.isArray(meta.recipes)) {
        for (const r of meta.recipes) this.unlockedRecipes.add(r)
      }
    } catch (e) {
      console.warn('[badab] 配方元进度读取失败:', e)
    }
  }

  /** batch14存档：是否存在可续局的存档 */
  public hasSave(): boolean {
    try {
      return !!mgLoad(SAVE_KEY)
    } catch (e) {
      return false
    }
  }

  /** batch14存档：对局结束（胜利/败北/重开）时清除 run 存档；配方元进度独立保留 */
  public deleteSave(): void {
    try {
      mgDeleteSave(SAVE_KEY)
    } catch (e) {
      console.warn('[badab] 清除存档失败:', e)
    }
  }

  /** batch19：全新开始——清除已解锁主意元进度（META 删除 + 解锁表回默认 8 个） */
  public wipeMetaProgress(): void {
    try {
      mgDeleteSave(META_KEY)
    } catch (e) {
      console.warn('[badab] 清除配方元进度失败:', e)
    }
    this.unlockedRecipes = new Set([
      'craft_parts', 'craft_scrap_club', 'build_hive_city', 'build_shed',
      'produce_scrap', 'produce_stone', 'produce_titanium', 'build_rift_beacon'
    ])
  }

  public async init(): Promise<void> {
    const w = this.containerEl.clientWidth
    const h = this.containerEl.clientHeight

    this.app = new Application()
    await this.app.init({
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    })

    if (this.isDestroyed) {
      this.app.destroy(true)
      return
    }

    this.app.canvas.style.opacity = '0'
    this.containerEl.appendChild(this.app.canvas)
    this.containerEl.addEventListener('contextmenu', this.onContextMenu)

    this.app.stage.addChild(this.rootDesignStage)
    this.rootDesignStage.addChild(this.shopLayer, this.cardLayer, this.dragLayer, this.fxLayer, this.hintLayer)
    this.hintLayer.addChild(this.hintG, this.hintText)

    this.floaters = new Floater(this.fxLayer)
    this.fxLayer.addChild(this.battleZoneG)
    this.board = new Board(this.cardLayer, this.textures)
    this.board.onChanged = () => this.syncHud()

    this.combat = new CombatManager(
      this.board,
      this.floaters,
      this.tweens,
      this.delayed,
      () => this.checkDefeat(),
      (corpse) => this.scheduleMutate(corpse),
      (chest) => {
        // A2：大魔/旗舰掉落金币箱预装 100 枚（写存量 map + 实体字段 + 刷新角标）
        this.chestCoins.set(chest.uid, 100)
        chest.chestCoins = 100
        refreshCardBadge(chest)
      },
      (route, text) => this.triggerVictory(route, text),
      () => this.startCorruptionDialog()
    )

    this.dragDrop = new DragDrop(
      this.board,
      this.dragLayer,
      {
        tryStartTask: (stack) => this.tryStartTask(stack),
        afterChange: () => this.syncHud(),
        bounce: (stack) => this.bounceStack(stack),
        // R50: 拖拽接管视图前杀其 position/scale 在飞补间(补间目标是点对象, 不是 view 本身)
        cancelViewMotion: (view) => {
          this.tweens.killByTarget(view.position)
          this.tweens.killByTarget(view.scale)
        },
        onChestClick: (stack) => this.spitCoinsFromChest(stack),
        onPackClick: (stack) => this.unpackSingleCard(stack),
        onManualEngage: (fStack, eStack) => this.combat.engageSpread(fStack, eStack),
        onPurifyStart: (purifier, cultistStack) => this.combat.startPurify(purifier, cultistStack),
        onMedPatchStart: (patch, unitStack) => this.startMedPatch(patch, unitStack),
        onCardsCarried: (cards, isCarried) => this.combat.setCarriedCards(cards, isCarried),
        isRecipeUnlocked: (id) => this.unlockedRecipes.has(id),
        onDepositTaxShip: (shipStack, inputStack) => this.depositToTaxShip(shipStack, inputStack)
      },
      this.floaters,
      (p, stack) => this.isInSellSlot(p, stack),
      (stack) => this.sellStack(stack),
      (p, stack) => this.getPackAt(p, stack),
      (packIdx, stack) => this.depositToPack(packIdx, stack),
      (chest, stack) => this.depositToChest(chest, stack),
      (hall, stack) => this.depositToMessHall(hall, stack)
    )

    this.renderShopBar()
    await this.loadAllAssets()
    // [新手引导] 开局不发牌：新手包由开场白结束后 Vue 调 grantStarterPack() 发放
    this.updateDimensions(w, h)
    this.syncHud()

    if (!this.isDestroyed && this.app) this.app.render()
    requestAnimationFrame(() => {
      if (this.app && !this.isDestroyed) this.app.canvas.style.opacity = '1'
    })

    this.app.ticker.add((ticker) => {
      if (this.isDestroyed) return
      this.tick(ticker.deltaMS / 1000)
    })
  }

  private renderShopBar(): void {
    this.shopLayer.removeChildren()

    const bg = new Graphics()
    bg.roundRect(SELL_X - 16, SELL_Y - 8, SELL_SLOT_SIZE + SHOP_GAP + SHOP_PACK_IDS.length * (SHOP_SLOT_W + SHOP_GAP) + 32, SHOP_SLOT_H + 16, 12)
      .fill({ color: 0x070913, alpha: 0.85 })
      .stroke({ width: 1.5, color: 0x2d3748, alpha: 0.7 })
    this.shopLayer.addChild(bg)

    const sellG = new Graphics()
    const isOver = this.store.slotsUsed > this.store.slotsCap
    sellG.roundRect(SELL_X, SELL_Y, SELL_SLOT_SIZE, SELL_SLOT_SIZE, 8)
      .fill({ color: 0x141622, alpha: 0.9 })
      .stroke({ width: isOver ? 3 : 2, color: isOver ? 0xef4444 : 0xffd75e, alpha: 0.95 })
    this.shopLayer.addChild(sellG)

    const sellIcon = new Text({
      text: isOver ? '⚠️\n出售' : '⟲\n出售',
      style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_ICON, fill: isOver ? '#ef4444' : '#ffd75e', fontWeight: '900', align: 'center', stroke: { color: '#000', width: 3 } })
    })
    sellIcon.anchor.set(0.5, 0.5)
    sellIcon.position.set(SELL_X + SELL_SLOT_SIZE / 2, SELL_Y + SELL_SLOT_SIZE / 2)
    this.shopLayer.addChild(sellIcon)

    SHOP_PACK_IDS.forEach((pid, idx) => {
      const pack = PACK_CONFIGS[pid]
      const px = SELL_X + SELL_SLOT_SIZE + SHOP_GAP + idx * (SHOP_SLOT_W + SHOP_GAP)
      const py = SELL_Y
      const dep = this.packDeposited.get(idx) || 0

      const packG = new Graphics()
      packG.roundRect(px, py, SHOP_SLOT_W, SHOP_SLOT_H, 8)
        .fill({ color: pack.color, alpha: 0.95 })
        .stroke({ width: 2, color: pack.borderColor, alpha: 0.9 })
      this.shopLayer.addChild(packG)

      // batch28：商店槽位显示独立加载的包图（仅商店格；缺图保持色块）
      const packTex = this.packTextures.get(pid)
      if (packTex) {
        const packSp = new Sprite(packTex)
        const ps = Math.min((SHOP_SLOT_W - 12) / packTex.width, (SHOP_SLOT_H - 12) / packTex.height)
        packSp.scale.set(ps)
        packSp.anchor.set(0.5, 0.5)
        packSp.position.set(px + SHOP_SLOT_W / 2, py + SHOP_SLOT_H / 2)
        this.shopLayer.addChild(packSp)
      }

      const title = new Text({
        text: pack.name,
        style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_STACK, fill: '#ffffff', fontWeight: 'bold', align: 'center', stroke: { color: '#000', width: 3 } })
      })
      title.anchor.set(0.5, 0)
      title.position.set(px + SHOP_SLOT_W / 2, py + 14)

      const badgeText = dep > 0 ? `还差 ${pack.price - dep} 金` : `${pack.price} 🪙`
      const priceText = new Text({
        text: badgeText,
        style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_PRICE, fill: dep > 0 ? '#facc15' : '#ffd75e', fontWeight: '900', stroke: { color: '#000', width: 3 } })
      })
      priceText.anchor.set(0.5, 1)
      priceText.position.set(px + SHOP_SLOT_W / 2, py + SHOP_SLOT_H - 12)

      this.shopLayer.addChild(title, priceText)
    })

    // batch18：什一税信息卡重做——单卡固定矩形、固定位置，倒计时/征收两态只换内容不换框；
    // 字号全面放大（标题 F_PLATE 起步，需求/倒计时用最大字 F_TAX 并带单位），灰色小字全部消灭
    const muTax = this.store.monthsUntilTax
    const taxShip = this.board.allCards().find(c => c.cardId === 'tax_ship')
    // batch20：A（倒计时卡）与 B（收税信息=实体军舰卡）互斥——军舰在场时 A 整块隐藏；B 落点即 A 原位（见 spawnTaxShip）
    if (!taxShip && muTax > 0) {
      const TAX_TILE_W = 300
      const taxX = CONSOLE_X + CONSOLE_W - TAX_TILE_W - 32
      const taxG = new Graphics()
      taxG.roundRect(taxX, SELL_Y, TAX_TILE_W, SHOP_SLOT_H, 8)
        .fill({ color: 0x1c1206, alpha: 0.95 })
        .stroke({ width: 2, color: 0xf59e0b, alpha: 0.9 })
      this.shopLayer.addChild(taxG)
      let l1: string, l2: string, l2Fill: string
      if (taxShip) {
        const t = taxShip.taxType || 'gold'
        const paid = taxShip.taxPaid ?? 0
        const target = taxShip.taxTarget ?? 0
        const done = paid >= target
        l1 = done ? '★ 什一税已备齐' : '⚡ 什一税征收中'
        if (t === 'gold') l2 = `🪙 金币 × ${target}`
        else if (t === 'population') l2 = `🧑 人口 × ${target}`
        else l2 = `🧬 基因种子 × ${target}`
        l2Fill = done ? '#6ee7b7' : '#fbbf24'
      } else {
        l1 = '⚡ 帝国什一税舰队'
        l2 = `${muTax} 年后抵达`
        l2Fill = '#fbbf24'
      }
      const t1 = new Text({ text: l1, style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_PLATE, fill: '#fcd34d', fontWeight: '900' }) })
      t1.anchor.set(0.5, 0)
      t1.position.set(taxX + TAX_TILE_W / 2, SELL_Y + 20)
      const t2 = new Text({ text: l2, style: new TextStyle({ fontFamily: PC_FONT_FAMILY, fontSize: F_TAX, fill: l2Fill, fontWeight: '900', stroke: { color: '#000', width: 3 } }) })
      t2.anchor.set(0.5, 0.5)
      t2.position.set(taxX + TAX_TILE_W / 2, SELL_Y + 96)
      this.shopLayer.addChild(t1, t2)
    }
  }

  public isInSellSlot(p: Vec2, stack?: Stack): boolean {
    if (p.x >= SELL_X && p.x <= SELL_X + SELL_SLOT_SIZE && p.y >= SELL_Y && p.y <= SELL_Y + SELL_SLOT_SIZE) {
      return true
    }
    if (stack) {
      const cardX = stack.x
      const cardY = stack.y
      const cardW = CARD_W
      const cardH = stackVisualHeight(stack)

      const slotX1 = SELL_X - 16
      const slotY1 = SELL_Y - 16
      const slotX2 = SELL_X + SELL_SLOT_SIZE
      const slotY2 = SELL_Y + SELL_SLOT_SIZE + 32

      return cardX < slotX2 && cardX + cardW > slotX1 && cardY < slotY2 && cardY + cardH > slotY1
    }
    return false
  }

  public getPackAt(p: Vec2, stack?: Stack): number {
    for (let i = 0; i < SHOP_PACK_IDS.length; i++) {
      const px = SELL_X + SELL_SLOT_SIZE + SHOP_GAP + i * (SHOP_SLOT_W + SHOP_GAP)
      const py = SELL_Y
      const pw = SHOP_SLOT_W
      const ph = SHOP_SLOT_H

      if (stack) {
        const cardX = stack.x
        const cardY = stack.y
        const cardW = CARD_W
        const cardH = stackVisualHeight(stack)
        if (cardX < px + pw && cardX + cardW > px && cardY < py + ph && cardY + cardH > py) {
          return i
        }
      } else if (p.x >= px && p.x <= px + pw && p.y >= py && p.y <= py + ph) {
        return i
      }
    }
    return -1
  }

  private depositToPack(packIndex: number, stack: Stack): void {
    const pid = SHOP_PACK_IDS[packIndex]
    const pack = PACK_CONFIGS[pid]
    const coins = stack.members.filter(m => m.cardId === 'coin')

    if (coins.length === 0) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '只能投入金币购买', '#ff5555', 18)
      this.board.placeStack(stack, stack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, stack.y))
      this.bounceStack(stack)
      return
    }

    const currentDep = this.packDeposited.get(packIndex) || 0
    const needed = pack.price - currentDep
    const actualPay = Math.min(needed, coins.length)

    for (let i = 0; i < actualPay; i++) this.board.removeCard(coins[i])
    const newDep = currentDep + actualPay
    this.packDeposited.set(packIndex, newDep)

    if (newDep >= pack.price) {
      this.packDeposited.set(packIndex, 0)
      const spawnX = clampNum(SELL_X + SELL_SLOT_SIZE + SHOP_GAP + packIndex * (SHOP_SLOT_W + SHOP_GAP), CONSOLE_X + 24, CONSOLE_X + CONSOLE_W - CARD_W - 24)
      const spawnY = CONSOLE_Y + CONSOLE_TOP_ZONE + 40 // 商店槽下方安全位
      this.spawnPhysicalPack(pid, spawnX, spawnY)
      this.floaters.show(spawnX + CARD_W / 2, spawnY - 12, `已送达：${pack.name}`, '#00f0ff', 22)
      // [新手引导] 任务事件：卡包购买完成
      this.onQuestEvent?.('pack_bought', pid)
    } else {
      this.floaters.show(SELL_X + SELL_SLOT_SIZE + SHOP_GAP + packIndex * (SHOP_SLOT_W + SHOP_GAP) + SHOP_SLOT_W / 2, SELL_Y + SHOP_SLOT_H / 2, `已投币 (还差 ${pack.price - newDep} 金)`, '#ffd75e', 18)
    }

    if (stack.members.length > 0) this.board.placeStack(stack, stack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, stack.y))
    this.renderShopBar()
    this.syncHud()
  }

  public spawnPhysicalPack(packId: string, x: number, y: number): Stack {
    const breedable = this.board.allCards().filter(c => getDef(c.cardId).canBreed).length
    const ourUnits = this.board.allCards().filter(c => getDef(c.cardId).isOurUnit).length

    const gen = generatePackCards(packId, {
      breedableCount: breedable,
      ourUnitsCount: ourUnits,
      pioneerPityCounter: this.pioneerPityCounter,
      monthsElapsed: this.month,
      unlockedRecipes: this.unlockedRecipes,
      allRecipes: RECIPES
    })

    this.pioneerPityCounter = gen.nextPity

    // batch62：高阶包(≥15金)主意保底——该包内容是否含"未解锁主意"在购买生成时即可判定；
    // 连续 IDEA_PITY_LIMIT 个高阶包无解锁 → 本包强塞一张未解锁主意（替换末位）并重置计数
    const packPrice = PACK_CONFIGS[packId]?.price ?? 0
    if (packPrice >= 15) {
      const willUnlock = gen.cards.some(c => c.startsWith('idea_') && !this.unlockedRecipes.has(c.replace('idea_', '')))
      if (this.ideaPityCount >= IDEA_PITY_LIMIT) {
        if (!willUnlock) {
          const forced = rollAnyUnownedIdea(this.unlockedRecipes)
          if (forced) gen.cards[gen.cards.length - 1] = forced
        }
        this.ideaPityCount = 0
      } else {
        this.ideaPityCount = willUnlock ? 0 : this.ideaPityCount + 1
      }
    }

    const packStack = this.board.spawnCard(packId, x, y)
    const entity = packStack.members[0]
    this.packQueues.set(entity.uid, gen.cards)
    return packStack
  }

  private unpackSingleCard(stack: Stack): void {
    const entity = stack.members[0]
    const queue = this.packQueues.get(entity.uid)
    if (!queue || queue.length === 0) return

    if (!this.gameStarted) {
      this.gameStarted = true
      this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, '★ 时钟启动，第 1 星际年开始运转！', '#00f0ff', 26)
      // 注意：首次点击只启动时钟；"拆开卡包"任务完成事件在整包拆完（补给包卡消失）时发出
    }

    const cardId = queue.shift()!
    // A1 附属（可裁）：卡包开出邪教徒时强飘字警示
    if (cardId === 'cultist') {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 40, '⚠️ 卡包中潜伏着邪教徒！尽快处理', '#c084fc', 22)
    }
    const remainCount = queue.length

    const angle = (remainCount * 2.399963) % (Math.PI * 2)
    const dist = 160 + (remainCount % 3) * 45
    const rawTx = stack.x + Math.cos(angle) * dist
    const rawTy = stack.y + Math.sin(angle) * dist
    const safePos = this.board.findNonOverlappingPosition(stack, rawTx, rawTy)

    if (cardId.startsWith('pack_')) {
      const ns = this.spawnPhysicalPack(cardId, safePos.x, safePos.y)
      this.animatePneumaticPunch(ns, stack.x, stack.y, safePos.x, safePos.y)
    } else {
      this.spawnAndRouteCard(cardId, stack.x, stack.y, safePos.x, safePos.y)
    }

    this.bounceStack(stack)

    if (remainCount > 0) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, `剩余 ${remainCount} 张`, '#ffd75e', 18)
    } else {
      // 整包拆完：补给包卡消失，此时才算"拆开卡包"完成
      this.packQueues.delete(entity.uid)
      this.board.removeCard(entity)
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, `★ 开包完成！`, '#00f0ff', 22)
      // [新手引导] 任务事件：整包拆完（卡包消失）才触发
      this.onQuestEvent?.('pack_opened')
    }

    this.syncHud()
  }

  private depositToChest(chestStack: Stack, coinStack: Stack): void {
    const chestEntity = chestStack.members[0]
    const cur = this.chestCoins.get(chestEntity.uid) || 0
    const coins = coinStack.members.filter(m => m.cardId === 'coin')
    const canTake = Math.min(coins.length, 120 - cur)

    if (canTake <= 0) {
      this.floaters.show(chestStack.x + CARD_W / 2, chestStack.y - 12, '金币箱已存满 (120/120)', '#ffaa66', 16)
      this.board.placeStack(coinStack, coinStack.x, coinStack.y)
      return
    }

    for (let i = 0; i < canTake; i++) this.board.removeCard(coins[i])
    const newTotal = cur + canTake
    this.chestCoins.set(chestEntity.uid, newTotal)
    chestEntity.chestCoins = newTotal
    refreshCardBadge(chestEntity)

    this.floaters.show(chestStack.x + CARD_W / 2, chestStack.y - 12, `已收纳 +${canTake} 金币 (${newTotal}/100)`, '#ffd75e', 20)

    if (coinStack.members.length > 0) this.board.placeStack(coinStack, coinStack.x, coinStack.y)
    this.syncHud()
  }

  private spitCoinsFromChest(chestStack: Stack): void {
    const chestEntity = chestStack.members[0]
    const cur = this.chestCoins.get(chestEntity.uid) || 0
    if (cur <= 0) {
      this.floaters.show(chestStack.x + CARD_W / 2, chestStack.y - 12, '金币箱是空的', '#94a3b8', 16)
      return
    }

    const spitCount = Math.min(5, cur)
    const newRemaining = cur - spitCount
    this.chestCoins.set(chestEntity.uid, newRemaining)
    chestEntity.chestCoins = newRemaining
    refreshCardBadge(chestEntity)

    // 防两组 5 金币上下完全重叠
    const safePos = this.board.findNonOverlappingPosition(chestStack, chestStack.x, chestStack.y + CARD_H + 24)
    const coinStack = this.board.spawnCard('coin', safePos.x, safePos.y)

    for (let i = 1; i < spitCount; i++) {
      const c = this.board.spawnCard('coin', safePos.x, safePos.y)
      this.board.mergeStacks(c, coinStack)
    }

    refreshStackView(coinStack)
    this.animatePneumaticPunch(coinStack, chestStack.x, chestStack.y, safePos.x, safePos.y)
    this.floaters.show(chestStack.x + CARD_W / 2, chestStack.y - 12, `取出 ${spitCount} 金币 (余 ${newRemaining})`, '#ffd75e', 18)
    this.syncHud()
  }

  private depositToMessHall(hallStack: Stack, foodStack: Stack): void {
    const hallEntity = hallStack.members[0]
    let items = this.messHallStorages.get(hallEntity.uid)
    if (!items) {
      items = []
      this.messHallStorages.set(hallEntity.uid, items)
    }

    const canAccept = 10 - items.length
    if (canAccept <= 0) {
      this.floaters.show(hallStack.x + CARD_W / 2, hallStack.y - 12, '星际食堂已存满 (10/10)', '#ffaa66', 16)
      this.board.placeStack(foodStack, foodStack.x, foodStack.y)
      return
    }

    // 只收可食用食物：饱食度 0 的食材（生肉/史古格真菌）拒收，加工后再存
    const foods = foodStack.members.filter(m => {
      const d = getDef(m.cardId)
      return d.category === 'food' && (d.satiety ?? 0) > 0
    })
    if (foods.length === 0) {
      this.floaters.show(hallStack.x + CARD_W / 2, hallStack.y - 12, '星际食堂只收可食用的食物（0饱食食材请加工后再存）', '#ffaa66', 16)
      this.board.placeStack(foodStack, foodStack.x, foodStack.y)
      return
    }

    const toTake = Math.min(foods.length, canAccept)

    for (let i = 0; i < toTake; i++) {
      const m = foods[i]
      const def = getDef(m.cardId)
      items.push({ cardId: m.cardId, satiety: def.satiety ?? 1 })
      this.board.removeCard(m)
    }

    this.floaters.show(hallStack.x + CARD_W / 2, hallStack.y - 12, `已储藏 +${toTake} 份口粮 (${items.length}/10)`, '#4ade80', 20)
    if (foodStack.members.length > 0) this.board.placeStack(foodStack, foodStack.x, foodStack.y)
    this.syncHud()
  }

  /** batch24：草本疗伤贴上单位——并入堆并启动读条，读完消耗贴片回血 */
  public startMedPatch(patch: CardEntity, unitStack: Stack): void {
    const patchStack = this.board.stackOf(patch)
    if (!patchStack) return
    this.board.mergeStacks(patchStack, unitStack)
    unitStack.task = {
      recipe: { id: 'apply_med_patch', name: '使用草本疗伤贴', baseTime: MED_PATCH_TIME, inputs: {}, outputs: {} },
      progress: 0,
      workers: 1
    }
    refreshStackView(unitStack)
    this.floaters.show(unitStack.x + CARD_W / 2, unitStack.y - 14, '疗伤读条开始', '#4ade80', 18)
  }

  public spawnTaxShip(): void {
    const exists = this.board.allCards().some(c => c.cardId === 'tax_ship')
    if (exists) return

    // batch18：cycle 与全链路 5 年税周期对齐（原 /3 为批次异类，store.taxCycle 显示错误）
    const cycle = Math.floor(this.month / TAX_CYCLE_YEARS)
    const rand = Math.random()
    let type: TaxType = 'gold'
    let target = 50

    // batch18：税种权重——金币 55% / 人口 30% / 种子 15%（降低种子税频率）
    if (rand < 0.55) {
      type = 'gold'
      target = 50
    } else if (rand < 0.85) {
      type = 'population'
      target = 3
    } else {
      type = 'seed'
      const astartesCount = this.board.allCards().filter(c => c.cardId === 'astartes').length
      if (astartesCount < 3) target = 1
      else if (astartesCount < 5) target = 2
      else target = 3
    }

    // batch21：B（收税卡）落点 = A 的原位，且同尺寸 300×160 横版（与 A 完全同框，永不侵入操作区）
    const shipX = CONSOLE_X + CONSOLE_W - TAX_SHIP_W - 32
    const shipY = SELL_Y
    const shipStack = this.board.spawnCard('tax_ship', shipX, shipY)
    const entity = shipStack.members[0]
    entity.taxType = type
    entity.taxTarget = target
    entity.taxPaid = 0

    refreshCardBadge(entity)
    refreshStackView(shipStack)

    this.store.setTaxShipStatus({
      cycle,
      taxType: type,
      targetReq: target,
      currentPaid: 0,
      isCompleted: false
    })

    // batch36：入泊即需求大字提示（首次交税不再无声默认抗税）
    const reqName = type === 'gold' ? `金币 × ${target}` : type === 'population' ? `成年人口 × ${target}` : `基因种子 × ${target}`
    this.floaters.show(shipX + TAX_SHIP_W / 2, shipY - 16, `⚡ 什一税特使已入泊：需上缴 ${reqName}！年末前拖卡至军舰，逾期视为抗税`, '#f59e0b', 24)
    this.syncHud()
  }

  public depositToTaxShip(shipStack: Stack, inputStack: Stack): void {
    const shipEntity = shipStack.members[0]
    if (!shipEntity || shipEntity.cardId !== 'tax_ship') return

    const taxType = shipEntity.taxType || 'gold'
    const target = shipEntity.taxTarget || 50
    const currentPaid = shipEntity.taxPaid || 0
    const needed = target - currentPaid

    if (needed <= 0) {
      this.floaters.show(shipStack.x + TAX_SHIP_W / 2, shipStack.y - 12, '税额已备齐，特使不再接收！', '#4ade80', 18)
      this.board.placeStack(inputStack, inputStack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, inputStack.y))
      this.bounceStack(inputStack)
      return
    }

    let matchingCards: CardEntity[] = []
    if (taxType === 'gold') {
      matchingCards = inputStack.members.filter(m => m.cardId === 'coin')
    } else if (taxType === 'population') {
      matchingCards = inputStack.members.filter(m => {
        const d = getDef(m.cardId)
        return d.isOurUnit && m.cardId !== 'baby'
      })
    } else if (taxType === 'seed') {
      matchingCards = inputStack.members.filter(m => m.cardId === 'gene_seed')
    }

    if (matchingCards.length === 0) {
      let reqName = '圣洁金币'
      if (taxType === 'population') reqName = '成年人口'
      else if (taxType === 'seed') reqName = '基因种子'
      this.floaters.show(shipStack.x + TAX_SHIP_W / 2, shipStack.y - 12, `帝国特使只接受【${reqName}】！`, '#ef4444', 18)
      this.board.placeStack(inputStack, inputStack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, inputStack.y))
      this.bounceStack(inputStack)
      return
    }

    const actualPay = Math.min(needed, matchingCards.length)
    for (let i = 0; i < actualPay; i++) {
      this.board.removeCard(matchingCards[i])
    }

    // C2 方案2：人口税上缴名单含邪教徒 → 帝国察觉异端：正常完税的 0 腐化改为 +30 惩罚
    if (taxType === 'population' && matchingCards.slice(0, actualPay).some(m => m.cardId === 'cultist')) {
      this.corruption = clampNum(this.corruption + 30, 0, 100)
      this.floaters.show(shipStack.x + TAX_SHIP_W / 2, shipStack.y - 34, '⚠️ 上缴名单混入异端！帝国震怒：腐化 +30', '#c084fc', 20)
    }

    const newPaid = currentPaid + actualPay
    shipEntity.taxPaid = newPaid
    const isCompleted = newPaid >= target

    refreshCardBadge(shipEntity)
    refreshStackView(shipStack)

    this.store.updateTaxPaid(newPaid, isCompleted)

    if (isCompleted) {
      // batch36：足额完税 → 抗税计数清零
      this.taxMissCount = 0
      this.floaters.show(shipStack.x + TAX_SHIP_W / 2, shipStack.y - 14, `★ 什一税额已全额备齐！年末起航`, '#4ade80', 22)
    } else {
      this.floaters.show(shipStack.x + TAX_SHIP_W / 2, shipStack.y - 14, `已征缴 +${actualPay} (还差 ${target - newPaid})`, '#fde047', 18)
    }

    if (inputStack.members.length > 0) {
      this.board.placeStack(inputStack, inputStack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, inputStack.y))
      this.bounceStack(inputStack)
    }

    this.syncHud()
    this.checkDefeat()
  }

  public handleDoubleTax(selectedUids?: number[]): { success: boolean; msg: string } {
    const shipCard = this.board.allCards().find(c => c.cardId === 'tax_ship')
    if (!shipCard) return { success: false, msg: '军舰已离场或未停泊' }

    const taxType = shipCard.taxType || 'gold'
    const target = shipCard.taxTarget || 50

    // C2 方案2：双倍献赋名单含邪教徒时，-15 腐化改为 +30 惩罚
    let hasCultistInDoubleTax = false

    if (taxType === 'gold') {
      const extraNeeded = target
      if (this.gold < extraNeeded) {
        return { success: false, msg: `金币不足 ${extraNeeded}，无法双倍奉献！` }
      }

      let toDeduct = extraNeeded
      const groundCoins = this.board.allCards().filter(c => c.cardId === 'coin')
      for (const c of groundCoins) {
        if (toDeduct <= 0) break
        this.board.removeCard(c)
        toDeduct--
      }

      if (toDeduct > 0) {
        for (const [uid, count] of this.chestCoins.entries()) {
          if (toDeduct <= 0) break
          const take = Math.min(count, toDeduct)
          const newCnt = count - take
          this.chestCoins.set(uid, newCnt)
          const chestCard = this.board.cards.get(Number(uid))
          if (chestCard) {
            chestCard.chestCoins = newCnt
            refreshCardBadge(chestCard)
          }
          toDeduct -= take
        }
      }
    } else if (taxType === 'seed') {
      const seedCards = this.board.allCards().filter(c => c.cardId === 'gene_seed')
      if (seedCards.length < target) {
        return { success: false, msg: `基因种子不足 ${target} 颗，无法双倍奉献！` }
      }
      for (let i = 0; i < target; i++) {
        this.board.removeCard(seedCards[i])
      }
    } else if (taxType === 'population') {
      if (!selectedUids || selectedUids.length !== target) {
        return { success: false, msg: `请指派足额 ${target} 名成年人口！` }
      }

      for (const uid of selectedUids) {
        const c = this.board.cards.get(uid)
        if (!c || c.cardId === 'baby' || !getDef(c.cardId).isOurUnit) {
          return { success: false, msg: '所选名单中含有无效或未成年单位！' }
        }
      }

      hasCultistInDoubleTax = selectedUids.some(uid => this.board.cards.get(uid)?.cardId === 'cultist')

      for (const uid of selectedUids) {
        const c = this.board.cards.get(uid)
        if (c) this.board.removeCard(c)
      }
    }

    // batch36：双倍献赋属成功完税 → 抗税计数清零
    this.taxMissCount = 0
    // C2 方案2：名单含邪教徒 → +30；否则维持 -15 献赋减免
    if (hasCultistInDoubleTax) {
      this.corruption = clampNum(this.corruption + 30, 0, 100)
    } else {
      this.corruption = clampNum(this.corruption - 15, 0, 100)
    }
    this.board.removeCard(shipCard)
    this.store.setTaxShipStatus(null)
    this.store.showDoubleTaxPrompt = false

    this.floaters.show(
      BOARD_W / 2,
      CONSOLE_Y + 120,
      hasCultistInDoubleTax ? '⚠️ 献赋名单混入异端！帝国震怒：腐化 +30' : '★ 忠诚狂热献赋！帝国极度嘉许 (-15 腐化)',
      hasCultistInDoubleTax ? '#c084fc' : '#00f0ff',
      26
    )
    if (this.settlementPhase === 'tax') this.advanceToClearanceOrConfirm()
    this.syncHud()
    this.checkDefeat()
    return { success: true, msg: '双倍献赋成功！' }
  }

  public cancelDoubleTax(): void {
    // batch36：遵旨完税（0 腐化）→ 抗税计数清零
    this.taxMissCount = 0
    const shipCard = this.board.allCards().find(c => c.cardId === 'tax_ship')
    if (shipCard) {
      this.board.removeCard(shipCard)
    }
    this.store.setTaxShipStatus(null)
    this.store.showDoubleTaxPrompt = false
    this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, '★ 什一税特使军舰起航回京，遵旨完税 (0 腐化)', '#4ade80', 24)
    if (this.settlementPhase === 'tax') this.advanceToClearanceOrConfirm()
    this.syncHud()
  }

  private async loadAllAssets(): Promise<void> {
    const base = miniGameAssetBase
    const loadTex = (src: string): Promise<Texture> => new Promise((res, rej) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { try { res(Texture.from(img)) } catch (e) { rej(e) } }
      img.onerror = () => rej(new Error(`[badab] 资源加载失败: ${src}`))
      img.src = src
    })
    for (const id of DEMO_ASSET_IDS) {
      try {
        this.textures.set(id, await loadTex(`${base}/games/badab/${id}.png`))
      } catch (e) {
        // batch28：缺图静默（占位卡照常绘制）——新卡无美术时不应每启动刷一行警告
      }
    }
    // batch28：6 金币包图独立加载（仅商店格使用；缺图静默，实体卡包不受影响）
    for (const pid of SHOP_PACK_IDS) {
      try {
        this.packTextures.set(pid, await loadTex(`${base}/games/badab/${pid}.png`))
      } catch (e) {
        /* 该包无美术，商店格保持色块 */
      }
    }
  }

  // [新手引导] 受控发牌：由 Vue 在开场白结束时调用（init/reset 均不再自动发牌）
  public grantStarterPack(): void {
    const cx = BOARD_W / 2 - CARD_W / 2
    const cy = BOARD_H / 2 - CARD_H / 2 + 60
    this.spawnPhysicalPack('pack_starter', cx, cy)
  }

  public reset(): void {
    this.board.clearAll()
    this.delayed.clear()
    this.tweens.clear()
    this.floaters.clear()
    this.chestCoins.clear()
    this.messHallStorages.clear()
    this.packDeposited.clear()
    this.lastTaxBannerValue = ''
    this.packQueues.clear()
    this.groxAiStates.clear()
    this.groxBreedTimer = 0
    this.gameTime = 0
    this.monthTimer = 0
    this.month = 1
    this.gold = 0
    this.corruption = 0
    this.paused = false
    this.gameStarted = false
    this.tutorialGrace = false
    this.pioneerPityCounter = 0
    this.isSettling = false
    this.settlementReport = null
    // B2 修复：向导状态机字段一并复位（否则重开后 settlementPhase==='sell' 会把 HUD 永久藏住）
    this.feedingRunning = false
    this.taxNoticePending = false
    this.advanceSettlementPhase(null)
    this.outputCounter = 0
    this.gameOverFired = false
    // [新手引导] 不发牌：由 Vue 重播开场白后调 grantStarterPack()
    this.renderShopBar()
    this.syncHud()
  }

  // [新手引导] userAction=true 时才发 pause_toggled 任务事件（对话框自动暂停为安静暂停，不触发任务9）
  public setPaused(v: boolean, userAction = false): void {
    if (this.isSettling && !v) return
    if (v && !this.paused && userAction) this.onQuestEvent?.('pause_toggled')
    this.paused = v
    this.syncHud()
  }

  public togglePaused(): void {
    if (this.isSettling) return
    this.setPaused(!this.paused, true)
  }

  public isPaused(): boolean {
    return this.paused
  }

  /** batch18：对局是否已终局（胜利/败北）——供 Vue 离场存档守卫判断 */
  public isGameOver(): boolean {
    return this.gameOverFired
  }

  // [新手引导] 任务奖励发放：卡牌从屏幕底部中央（NPC立绘后方）滑入场地，金角螺旋散布落点 + 磁吸归拢
  public grantCards(items: Array<{ cardId: string; count: number }>): void {
    const sx = BOARD_W / 2
    const sy = BOARD_H - 40
    const cx = BOARD_W / 2
    const cy = CONSOLE_Y + 340
    let i = 0
    for (const it of items) {
      for (let k = 0; k < it.count; k++) {
        const angle = (i * 2.399963) % (Math.PI * 2)
        const dist = 150 + (i % 3) * 55
        const tx = clampNum(cx + Math.cos(angle) * dist, CONSOLE_X + 20, CONSOLE_X + CONSOLE_W - CARD_W - 20)
        const ty = clampNum(cy + Math.sin(angle) * dist, CONSOLE_Y + 120, CONSOLE_Y + CONSOLE_H - CARD_H - 20)
        this.spawnAndRouteCard(it.cardId, sx, sy, tx, ty)
        i++
      }
    }
    this.syncHud()
  }

  // ================= 战术摄像机缩放与全图漫游算法 =================

  public handleWheel(e: WheelEvent): void {
    e.preventDefault()

    const zoomStep = e.deltaY < 0 ? ZOOM_STEP_IN : ZOOM_STEP_OUT
    const newZoom = clampNum(this.zoom * zoomStep, this.minZoom, this.maxZoom)
    if (Math.abs(newZoom - this.zoom) < 0.001) return

    const oldScale = this.currentScale
    const newScale = this.baseScale * newZoom

    const anchorScreenX = this.stageX + this.anchorWorldPos.x * oldScale
    const anchorScreenY = this.stageY + this.anchorWorldPos.y * oldScale

    this.zoom = newZoom
    this.currentScale = newScale
    this.stageX = anchorScreenX - this.anchorWorldPos.x * newScale
    this.stageY = anchorScreenY - this.anchorWorldPos.y * newScale

    this.clampStageToBounds()
    this.applyCameraTransform()
  }

  public handleMouseDown(e: MouseEvent): void {
    const p = this.toDesign(e)
    this.anchorWorldPos = { ...p }

    if (e.button === 1 || e.button === 2) {
      this.isPanning = true
      this.isPendingPan = false
      this.panStart = { x: e.clientX, y: e.clientY }
      this.panStageStart = { x: this.stageX, y: this.stageY }
      return
    }

    if (e.button === 0) {
      const hit = this.board.findCardAt(p.x, p.y)
      const inSell = this.isInSellSlot(p)
      const inPack = this.getPackAt(p) >= 0

      if (!hit && !inSell && !inPack) {
        this.isPendingPan = true
        this.isPanning = false
        this.panStart = { x: e.clientX, y: e.clientY }
        this.panStageStart = { x: this.stageX, y: this.stageY }
        return
      }

      this.isPendingPan = false
      this.isPanning = false
      this.dragDrop.pointerDown(p, e.button)
    }
  }

  public handleMouseUp(e: MouseEvent): void {
    this.isPendingPan = false
    if (this.isPanning) {
      this.isPanning = false
      if (e.button !== 0) return
    }

    try {
      this.dragDrop.pointerUp(this.toDesign(e), e.button)
    } catch (err) {
      // batch43：落点处理兜底——异常时强制释放拖拽物并复位拖拽状态，绝不让交互卡死（错误留控制台供根因定位）
      console.error('[badab pointerUp error]', err)
      const dd = this.dragDrop as unknown as { carried: Stack | null; state: string }
      if (dd.carried && dd.carried.members && dd.carried.members[0]) {
        this.board.placeStack(dd.carried, dd.carried.x, dd.carried.y)
        // batch64：兜底释放同样补重链，防成员视图滞留拖拽层
        this.board.relink(dd.carried)
      }
      dd.carried = null
      dd.state = 'idle'
    }
  }

  public handleMouseMove(e: MouseEvent): void {
    if (this.isPendingPan) {
      const dx = e.clientX - this.panStart.x
      const dy = e.clientY - this.panStart.y
      if (Math.hypot(dx, dy) > 6) {
        this.isPanning = true
        this.isPendingPan = false
      }
    }

    if (this.isPanning) {
      const dx = e.clientX - this.panStart.x
      const dy = e.clientY - this.panStart.y
      this.stageX = this.panStageStart.x + dx
      this.stageY = this.panStageStart.y + dy
      this.clampStageToBounds()
      this.applyCameraTransform()
      return
    }

    const p = this.toDesign(e)
    this.anchorWorldPos = { ...p }
    this.dragDrop.pointerMove(p)

    if (!this.dragDrop.isBusy()) {
      const hit = this.board.findCardAt(p.x, p.y)
      if (hit) {
        const entity = hit.stack.members[hit.index]
        this.onCardHover?.(getDef(entity.cardId), entity)
      } else {
        this.onCardHover?.(null, null)
      }
    }
  }

  private recalculateCenterTransform(): void {
    this.baseScale = Math.min(this.viewportW / BOARD_W, this.viewportH / BOARD_H)
    this.currentScale = this.baseScale * this.zoom

    this.stageX = (this.viewportW - BOARD_W * this.currentScale) / 2
    this.stageY = (this.viewportH - BOARD_H * this.currentScale) / 2

    this.clampStageToBounds()
    this.applyCameraTransform()
  }

  private clampStageToBounds(): void {
    const worldW = BOARD_W * this.currentScale
    const worldH = BOARD_H * this.currentScale

    if (worldW <= this.viewportW) {
      this.stageX = (this.viewportW - worldW) / 2
    } else {
      this.stageX = clampNum(this.stageX, this.viewportW - worldW, 0)
    }

    if (worldH <= this.viewportH) {
      this.stageY = (this.viewportH - worldH) / 2
    } else {
      this.stageY = clampNum(this.stageY, this.viewportH - worldH, 0)
    }
  }

  private toDesign(e: MouseEvent): { x: number; y: number } {
    const rect = this.containerEl.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - this.stageX) / this.currentScale,
      y: (e.clientY - rect.top - this.stageY) / this.currentScale
    }
  }

  private applyCameraTransform(): void {
    this.rootDesignStage.scale.set(this.currentScale)
    this.rootDesignStage.position.set(this.stageX, this.stageY)

    this.onCameraChange?.({
      scale: this.currentScale,
      x: this.stageX + CONSOLE_X * this.currentScale,
      y: this.stageY + CONSOLE_Y * this.currentScale,
      width: CONSOLE_W * this.currentScale,
      height: CONSOLE_H * this.currentScale,
      zoom: this.zoom,
      worldX: this.stageX,
      worldY: this.stageY
    })
  }

  public updateDimensions(w: number, h: number): void {
    if (!this.app || !this.app.renderer) return
    this.viewportW = w
    this.viewportH = h
    this.app.renderer.resize(w, h)

    this.recalculateCenterTransform()
  }

  // ================= 生产任务与超额人口自动剥离 =================

  private tryStartTask(stack: Stack, userAction = false): void {
    if (stack.task || this.isSettling) return

    const hasBeacon = stack.members.some(m => m.cardId === 'rift_beacon')
    const hasRift = stack.members.some(m => m.cardId === 'warp_rift')
    if (hasBeacon && hasRift) {
      if (this.combat.tryStartRitual(stack, stack, this.corruption)) {
        refreshStackView(stack)
        return
      }
    }

    const hasLocation = stack.members.some(m => {
      const id = m.cardId
      return id.startsWith('alien_forest') || id.startsWith('battlefield_planet') || id.startsWith('pirate_mothership') || id.startsWith('underhive_pipes')
    })
    // batch19：双人对口副本为 3 卡堆（地点+2人），单人对口维持 2 卡
    if (hasLocation && (stack.members.length === 2 || stack.members.length === 3)) {
      if (this.combat.tryStartExpedition(stack)) {
        refreshStackView(stack)
        return
      }
    }

    const hasBlackMarket = stack.members.some(m => m.cardId === 'black_market')
    if (hasBlackMarket) {
      const toSell = stack.members.filter(m => m.cardId !== 'black_market')
      if (toSell.length === 1) {
        const item = toSell[0]
        const d = getDef(item.cardId)
        if (!d.unsellable && d.price > 0 && !d.isOurUnit) {
          stack.task = {
            recipe: {
              id: `bm_trade_${item.cardId}`,
              name: `黑市交易: ${d.name} (x2金币)`,
              baseTime: 45,
              inputs: { black_market: 1, [item.cardId]: 1 },
              consumes: { [item.cardId]: 1 },
              outputs: { coin: d.price * 2 }
            },
            progress: 0,
            workers: 1
          }
          refreshStackView(stack)
          return
        }
      }
    }

    const candidateEntities: RecipeCandidate[] = stack.members.map(m => ({
      cardId: m.cardId,
      trait: m.trait || 'none',
      origin: m.originUnit
    }))

    const recipe = matchRecipe(candidateEntities)
    if (!recipe) return


    // batch19：活体摘取闸——堆内阿斯塔特若已全部献过身则不启动
    if (recipe.id === 'harvest_gene_seed' && !stack.members.some(m => m.cardId === 'astartes' && !m.geneHarvested)) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '该阿斯塔特已献过身', '#ffaa66', 18)
      return
    }

    // batch35：种植时间已声明式拆分（农田版30秒/基质版60秒配方），删除 batch30 运行时改时间的赋值逻辑（曾致 Assignment to constant）

    // batch59：黑市全局唯一——同时只能存在 1 座（双倍售价无限变现太赖皮；卖掉后可重建）
    if (recipe.outputs['black_market'] && this.board.allCards().some(c => c.cardId === 'black_market')) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '黑市全局唯一，已建成！（出售后方可重建）', '#ef4444', 18)
      return
    }

    // 仓库上限限制：若产出为扩容仓库，对应类别全场最多 3 座（修：此前两种建筑都只查 warehouse 导致货棚无限建）
    if (recipe.outputs['shed'] || recipe.outputs['warehouse']) {
      const whId = recipe.outputs['shed'] ? 'shed' : 'warehouse'
      if (!this.board.canBuildWarehouse(whId)) {
        this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '货棚+货仓全场合计上限 5 座！', '#ef4444', 18)
        return
      }
    }

    // 人口工作位超额剥离机制
    const isPointHarvest = !!recipe.consumeSource
    const workerIndices: number[] = []
    stack.members.forEach((m, idx) => {
      if (getDef(m.cardId).isLabor) workerIndices.push(idx)
    })

    if (isPointHarvest && workerIndices.length > 1) {
      const excessIndex = workerIndices[1]
      const poppedStack = this.board.grabAt(stack, excessIndex)
      const safePos = this.board.findNonOverlappingPosition(poppedStack, stack.x + CARD_W + 20, stack.y)
      this.board.placeStack(poppedStack, safePos.x, safePos.y)
      this.bounceStack(poppedStack)
      this.floaters.show(poppedStack.x + CARD_W / 2, poppedStack.y - 12, '多余劳动力已弹出待命', '#38bdf8', 16)
    }

    const workers = Math.min(MAX_TASK_WORKERS, Math.max(1, stack.members.filter(m => !!getDef(m.cardId).isLabor).length))
    stack.task = { recipe, progress: 0, workers }
    refreshStackView(stack)
  }

  private processTasks(dt: number): void {
    // 方案 1：工业级爆仓硬阻断校验（绝对上限 = 手牌上限 + 10，底线 90 张）
    const hardCap = Math.max(100, this.store.slotsCap + 10)
    const isSpaceBlocked = this.board.countCards() >= hardCap

    if (isSpaceBlocked) {
      this.blockFloaterTimer -= dt
    }

    for (const stack of [...this.board.stacks.values()]) {
      const task = stack.task
      if (!task) continue

      // C4：远征视觉伪任务——只刷新读条显示，不推进不结算（结算在 CombatManager.handleExpeditions）
      if (task.recipe.id === '__expedition__') {
        refreshStackView(stack)
        continue
      }

      if (task.recipe.id === 'ritual_boss') {
        task.progress += dt / task.recipe.baseTime
        if (task.progress >= 1) {
          this.combat.completeRitualBoss(stack)
        }
        refreshStackView(stack)
        continue
      }

      // 爆仓硬阻断生效：暂停生产并变红提示
      if (isSpaceBlocked) {
        stack.taskBar.clear()
        const w = Math.max(2, CARD_W * Math.min(1, task.progress))
        stack.taskBar.rect(0, 0, w, 8).fill({ color: 0xef4444 })
        if (this.blockFloaterTimer <= 0) {
          this.floaters.show(stack.x + CARD_W / 2, stack.y - 32, '空间超限，生产受阻', '#ef4444', 16)
        }
        continue
      }

      task.progress += (dt * task.workers) / task.recipe.baseTime
      if (task.progress >= 1) this.completeCycle(stack)
      if (stack.members.length > 0) refreshStackView(stack)
    }

    if (isSpaceBlocked && this.blockFloaterTimer <= 0) {
      this.blockFloaterTimer = 3.0
    }
  }

  private completeCycle(stack: Stack): void {
    const task = stack.task
    if (!task) return
    const r = task.recipe

    const isSuccess = r.successChance === undefined || Math.random() <= r.successChance
    if (!isSuccess) {
      if (r.failOutputs) {
        for (const [cardId, n] of Object.entries(r.failOutputs)) {
          for (let i = 0; i < n; i++) {
            const off = OUTPUT_OFFSETS[this.outputCounter++ % OUTPUT_OFFSETS.length]
            const rawTx = stack.x + off.x
            const rawTy = stack.y + off.y
            const safePos = this.board.findNonOverlappingPosition(stack, rawTx, rawTy)
            this.spawnAndRouteCard(cardId, stack.x, stack.y, safePos.x, safePos.y)
          }
        }
      }
      if (r.failConsumes) {
        for (const cid of r.failConsumes) {
          const target = stack.members.find(m => m.cardId === cid)
          if (target) this.board.removeCard(target)
        }
      }
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '转化失败！', '#ff5555', 20)
      stack.task = null
      refreshStackView(stack)
      this.syncHud()
      this.checkDefeat()
      return
    }

    if (r.corruptionDelta) {
      this.corruption = clampNum(this.corruption + r.corruptionDelta, 0, 100)
      const sign = r.corruptionDelta > 0 ? `+${r.corruptionDelta}` : `${r.corruptionDelta}`
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 20, `${sign} 腐化`, r.corruptionDelta > 0 ? '#c084fc' : '#4ade80', 20)
    }

    if (r.needsUnlock && !this.unlockedRecipes.has(r.id)) {
      this.unlockRecipe(r.id)
    }

    const consumesUnit = !!((r.consumes && (r.consumes['civilian'] || r.consumes['auxilia'] || r.consumes['baby'])) || r.consumeAnyInputs)
    const consumedUnit = consumesUnit
      ? stack.members.find(m => {
          const cat = getDef(m.cardId).category
          return cat === 'unit' && (m.cardId === 'civilian' || m.cardId === 'auxilia' || m.cardId === 'baby')
        })
      : undefined

    const inheritedGears = consumedUnit?.equippedGears ? [...consumedUnit.equippedGears] : []
    const inheritedTrait = consumedUnit?.trait

    if (r.id === 'breed_baby') {
      // 巢都繁育特殊化（一号裁定⑨）：婴儿直接并入巢都堆，随后巢都人口上限强制弹出成年人口，
      // 巢都仅剩婴儿 → 成长读条自动接续（任务系统一巢一读条天然互斥）
      // batch19：刺客血统——双刺客繁育的婴儿 30% 灵能 / 30% 无魂 / 40% 无（出生即订；阈值挂 tuner）
      const breeders = stack.members.filter(m => !!getDef(m.cardId).isLabor)
      const assassinParents = breeders.filter(m => m.cardId === 'private_assassin').length
      let babyTrait: TraitType | undefined
      if (assassinParents >= 2) {
        const rollT = Math.random()
        if (rollT < 0.3) babyTrait = 'psyker'
        else if (rollT < 0.6) babyTrait = 'untouchable'
      }
      const babyStack = this.board.spawnCard('baby', stack.x, stack.y, babyTrait)
      this.board.mergeStacks(babyStack, stack)
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 14, '★ 新生命诞生！', '#4ade80', 22)

      const ejected = this.board.ejectExcessNestPopulation()
      for (const e of ejected) {
        const st = this.board.stackOf(e)
        if (st) this.floaters.show(st.x + CARD_W / 2, st.y - 12, '成年人口已请出巢都（婴儿独占）', '#38bdf8', 16)
      }
    } else {
      // batch19：智库活体摘取——阿斯塔特不消耗、仅可献身一次；摘取后虚弱（hp 减半、最低留 1、不致死）
      if (r.id === 'harvest_gene_seed') {
        const donor = stack.members.find(m => m.cardId === 'astartes' && !m.geneHarvested)
        if (!donor) {
          this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '该阿斯塔特已献过身', '#ffaa66', 18)
          stack.task = null
          refreshStackView(stack)
          return
        }
        donor.geneHarvested = true
        donor.maxHp = Math.max(1, Math.floor(donor.maxHp / 2))
        donor.hp = Math.max(1, Math.floor(donor.hp / 2))
        refreshCardBadge(donor)
        this.floaters.show(stack.x + CARD_W / 2, stack.y - 30, '★ 基因种子已摘取，阿斯塔特极度虚弱', '#38bdf8', 20)
      }

      // batch24：草本疗伤贴读条完成——消耗贴片，堆内我方单位回血（封顶 maxHp；数值挂 cards.ts 常量）
      if (r.id === 'apply_med_patch') {
        const patch = stack.members.find(m => m.cardId === 'herb_patch')
        if (patch) this.board.removeCard(patch)
        for (const m of stack.members) {
          const md = getDef(m.cardId)
          if (md.isOurUnit && m.maxHp > 0) {
            m.hp = Math.min(m.maxHp, m.hp + HERB_PATCH_HEAL)
            refreshCardBadge(m)
          }
        }
        this.floaters.show(stack.x + CARD_W / 2, stack.y - 14, `+${HERB_PATCH_HEAL} HP 疗伤`, '#4ade80', 22)
        stack.task = null
        refreshStackView(stack)
        this.syncHud()
        return
      }

      // batch24/30：栽培三合一——按所投种子产出对应资源（基质/农田永久耐用、不被消耗）；农田 10% 双倍收获
      // batch35：两个种植配方ID都走种子→产出映射
      if (r.id === 'grow_crop' || r.id === 'grow_crop_farmland') {
        const seed = stack.members.find(m => m.cardId === 'bitterroot' || m.cardId === 'arken_berry' || m.cardId === 'thorn_grain')
        if (seed) {
          const outId = seed.cardId === 'bitterroot' ? 'bitterroot' : seed.cardId === 'arken_berry' ? 'alien_orchard' : 'mutant_farmland'
          let outCount = seed.cardId === 'bitterroot' ? 2 : 1
          this.board.removeCard(seed)
          if (stack.members.some(m => m.cardId === 'aberrant_farmland') && Math.random() < FARMLAND_DOUBLE_CHANCE) {
            outCount *= 2
            this.floaters.show(stack.x + CARD_W / 2, stack.y - 30, '★ 农田丰收：双倍收获！', '#4ade80', 20)
          }
          for (let i = 0; i < outCount; i++) {
            const off = OUTPUT_OFFSETS[this.outputCounter++ % OUTPUT_OFFSETS.length]
            const safePos = this.board.findNonOverlappingPosition(stack, stack.x + off.x, stack.y + off.y)
            this.spawnAndRouteCard(outId, stack.x, stack.y, safePos.x, safePos.y)
          }
        }
      }
      for (const [cardId, n] of Object.entries(r.outputs)) {
        for (let i = 0; i < n; i++) {
          const outDef = getDef(cardId)
          const isPromotedUnit = outDef.category === 'unit' && cardId !== 'baby' && consumedUnit !== undefined
          const outTrait = isPromotedUnit ? inheritedTrait : undefined

          const off = OUTPUT_OFFSETS[this.outputCounter++ % OUTPUT_OFFSETS.length]
          const rawTx = stack.x + off.x
          const rawTy = stack.y + off.y
          const safePos = this.board.findNonOverlappingPosition(stack, rawTx, rawTy)

          this.spawnAndRouteCard(cardId, stack.x, stack.y, safePos.x, safePos.y, outTrait, isPromotedUnit, inheritedGears)
        }
      }
    }

    if (r.bonusOutputs) {
      for (const bonus of r.bonusOutputs) {
        // requiresCard：指定卡牌在场才触发（食品精制厂双份加成）；缺省无条件触发
        if (bonus.requiresCard && !stack.members.some(m => m.cardId === bonus.requiresCard)) continue
        if (Math.random() <= bonus.chance) {
          const off = OUTPUT_OFFSETS[this.outputCounter++ % OUTPUT_OFFSETS.length]
          const rawTx = stack.x + off.x
          const rawTy = stack.y + off.y
          const safePos = this.board.findNonOverlappingPosition(stack, rawTx, rawTy)
          this.spawnAndRouteCard(bonus.cardId, stack.x, stack.y, safePos.x, safePos.y)
          this.floaters.show(stack.x + CARD_W / 2, stack.y - 30, `★ 意外收获: ${getDef(bonus.cardId).name}`, '#ffd75e', 18)
        }
      }
    }

    // 可采集点位开采消耗与连环向下开采
    if (r.consumeSource && r.sourceId) {
      const src = stack.members.find(m => m.cardId === r.sourceId)
      if (src) {
        src.usesLeft--
        if (src.usesLeft <= 0) {
          this.board.removeCard(src)
          this.floaters.show(stack.x + CARD_W / 2, stack.y, `${getDef(r.sourceId).name}已耗尽`, '#ffaa66', 16)
          stack.task = null

          if (stack.members.some(m => m.cardId === r.sourceId)) {
            this.tryStartTask(stack)
          }
        }
      } else {
        stack.task = null
      }
    } else {
      const need: Record<string, number> = r.consumes ? { ...r.consumes } : {}

      if (!r.consumes) {
        for (const [id, count] of Object.entries(r.inputs)) {
          const d = getDef(id)
          if (!d.isVillager && d.category !== 'building') need[id] = count
        }
      }

      const toRemove: CardEntity[] = []
      for (const m of [...stack.members]) {
        if (need[m.cardId] && need[m.cardId] > 0) {
          need[m.cardId]--
          toRemove.push(m)
        }
      }

      if (r.consumeAnyInputs && r.anyInputs) {
        for (const group of r.anyInputs) {
          let left = group.count
          for (const m of [...stack.members]) {
            if (left <= 0) break
            if (!toRemove.includes(m) && group.options.includes(m.cardId)) {
              toRemove.push(m)
              left--
            }
          }
        }
      }

      for (const m of toRemove) this.board.removeCard(m)
      stack.task = null
    }

    // B5 修复：无限工位与婴儿成长完成都会自动续条（巢都内第二个婴儿接着读条）
    if ((r.isInfiniteWorkstation || r.id === 'grow_baby') && stack.members.length > 0) {
      this.tryStartTask(stack)
    }

    if (stack.task) stack.task.progress = 0

    // 繁育落地后：巢都仅剩婴儿 → 立即启动婴儿成长读条
    if (r.id === 'breed_baby' && stack.members.length > 0) {
      this.tryStartTask(stack)
    }

    // [新手引导] 任务事件：采集完成 / 配方完成（baby 诞生走 recipe_done: breed_baby）
    if (r.consumeSource) this.onQuestEvent?.('harvest_done')
    this.onQuestEvent?.('recipe_done', r.id)

    refreshStackView(stack)
    this.syncHud()
    this.checkDefeat()
  }

  public findMagnetTarget(cardId: string, exclude?: Stack): Stack | null {
    const def = getDef(cardId)
    if (def.category === 'unit' || def.category === 'enemy' || def.category === 'resource_point' ||
        def.category === 'building' || def.category === 'corpse') {
      return null
    }

    const isCoin = cardId === 'coin'
    const isIdea = cardId.startsWith('idea_')
    const isFood = def.category === 'food'
    const isMaterial = def.category === 'material' && !isCoin
    const isEquipment = def.category === 'equipment'
    // batch37：疗伤贴产出磁吸归拢
    const isMedical = def.category === 'medical'

    if (!isCoin && !isIdea && !isFood && !isMaterial && !isEquipment && !isMedical) {
      return null
    }

    let bestStack: Stack | null = null
    let maxCount = 0

    for (const s of this.board.stacks.values()) {
      if (s === exclude || s.task || !s.members || s.members.length === 0) continue

      if (isCoin) {
        if (s.members.every(m => m.cardId === 'coin')) {
          if (s.members.length > maxCount) {
            maxCount = s.members.length
            bestStack = s
          }
        }
      } else if (isIdea) {
        if (s.members.every(m => m.cardId.startsWith('idea_'))) {
          if (s.members.length > maxCount) {
            maxCount = s.members.length
            bestStack = s
          }
        }
      } else {
        // batch48：废弃混合堆叠——磁吸恢复"纯同 ID 才吸"（batch38/41 的食物/材料放宽全部回滚）
        if (s.members.every(m => m.cardId === cardId)) {
          if (s.members.length > maxCount) {
            maxCount = s.members.length
            bestStack = s
          }
        }
      }
    }

    return bestStack
  }

  private spawnAndRouteCard(
    cardId: string,
    sx: number,
    sy: number,
    defaultTx: number,
    defaultTy: number,
    trait?: TraitType,
    isPromotedUnit?: boolean,
    inheritedGears?: string[],
    noMagnet = false
  ): Stack {
    // batch46：noMagnet（产奶等）——产物原地落位，不被食物混堆磁吸飞走
    const magnetTarget = noMagnet ? null : this.findMagnetTarget(cardId)
    const destX = magnetTarget ? magnetTarget.x : defaultTx
    const destY = magnetTarget ? magnetTarget.y : defaultTy

    const ns = this.board.spawnCard(cardId, destX, destY, trait)
    const entity = ns.members[0]
    // batch17：配方产出的尸体（培育舱/转化失败）同样挂尸变计时器——只要是尸体都会尸变
    if (cardId === 'corpse' && entity) {
      this.scheduleMutate(entity)
    }

    if (isPromotedUnit && entity && inheritedGears && inheritedGears.length > 0) {
      entity.equippedGears = [...inheritedGears]
      let bonusHp = 0
      for (const gid of inheritedGears) {
        const cfg = EQUIP_CONFIGS[gid]
        if (cfg?.hpBonus) bonusHp += cfg.hpBonus
      }
      entity.maxHp += bonusHp
      entity.hp = entity.maxHp
      refreshCardBadge(entity)
      refreshStackView(ns)
    }

    if (cardId.startsWith('idea_')) {
      const recId = cardId.replace('idea_', '')
      this.unlockRecipe(recId)
      // C1：净化配方主意卡额外提示操作手法（纯引导，不解锁门）
      if (recId === 'purify_cultist') {
        this.floaters.show(BOARD_W / 2, CONSOLE_Y + 160, '💡 手法：将战斗修女或私人智库拖到邪教徒堆上，净化 6 秒', '#38bdf8', 20)
      }
    }

    if (magnetTarget) {
      this.animateMagnetGlide(ns, sx, sy, destX, destY, magnetTarget)
    } else {
      this.animatePneumaticPunch(ns, sx, sy, destX, destY)
    }

    return ns
  }

  public unlockRecipe(recipeId: string): void {
    if (this.unlockedRecipes.has(recipeId)) return
    this.unlockedRecipes.add(recipeId)
    // batch18修复：主意全局持久化——此前 META 只读不写（重开必丢），此后每次解锁立即写 meta，跨局/重开/败北/胜利均保留
    try {
      mgSave(META_KEY, { recipes: [...this.unlockedRecipes] })
    } catch (e) {
      console.warn('[badab] 配方元进度写入失败:', e)
    }
    const def = RECIPES.find(r => r.id === recipeId)
    const name = def ? def.name : recipeId
    this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, `★ 领悟科技：${name}`, '#00f0ff', 24)
    this.onUnlockRecipe?.(recipeId)
    this.syncHud()
  }

  private animatePneumaticPunch(stack: Stack, sx: number, sy: number, tx: number, ty: number): void {
    const entity = stack.members[0]
    if (!entity || !entity.view || entity.view.destroyed) return
    const rv = entity.view
    if (!rv.position || !rv.scale) return

    rv.position.set(sx, sy)
    rv.scale.set(0.75, 0.75)

    this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1.04, y: 1.04 }, 0.18, Easings.easeOutQuad)
    this.tweens.to(rv.position, { x: tx, y: ty }, 0.28, Easings.hydraulicSettle, () => {
      if (rv.destroyed || !rv.position || !rv.scale) return
      rv.position.set(tx, ty)
      this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1, y: 1 }, 0.1, Easings.easeOutQuad)
    })
  }

  private animateMagnetGlide(stack: Stack, sx: number, sy: number, tx: number, ty: number, target: Stack): void {
    const entity = stack.members[0]
    if (!entity || !entity.view || entity.view.destroyed) return
    const rv = entity.view
    if (!rv.position || !rv.scale) return

    rv.position.set(sx, sy)
    rv.scale.set(0.85, 0.85)

    this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1.05, y: 1.05 }, 0.12, Easings.easeOutQuad)
    this.tweens.to(rv.position, { x: tx, y: ty }, 0.25, Easings.hydraulicSettle, () => {
      if (!this.board.stacks.has(stack.id) || !this.board.stacks.has(target.id)) {
        return
      }

      if (this.board.stacks.has(target.id) && !target.task) {
        this.board.mergeStacks(stack, target)
        refreshStackView(target)
        this.bounceStack(target)
      } else {
        if (!rv.destroyed && rv.position && rv.scale) {
          rv.position.set(tx, ty)
          this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1, y: 1 }, 0.1, Easings.easeOutQuad)
          this.bounceStack(stack)
        }
      }
      this.syncHud()
    })
  }

  private bounceStack(stack: Stack): void {
    const entity = stack.members[0]
    if (!entity || !entity.view || entity.view.destroyed || !entity.view.scale) return
    const rv = entity.view
    rv.scale.set(1.06)
    this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1, y: 1 }, 0.16, Easings.easeOutCubic)
  }

  private sellStack(stack: Stack): void {
    const hasUnsellable = stack.members.some(m => getDef(m.cardId).unsellable)
    if (hasUnsellable) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '此卡牌锁定不可出售！', '#ff5555', 18)
      this.board.placeStack(stack, stack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, stack.y))
      return
    }

    // batch18：金币箱内有存币时禁止出售（必须先清空取出），防误吞资产
    const chestWithCoins = stack.members.find(m => m.cardId === 'coin_chest' && (this.chestCoins.get(m.uid) || 0) > 0)
    if (chestWithCoins) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '金币箱内尚有存币，请先取出再出售！', '#ffaa66', 18)
      this.board.placeStack(stack, stack.x, Math.max(CONSOLE_Y + CONSOLE_TOP_ZONE, stack.y))
      return
    }

    let total = 0
    for (const m of stack.members) total += getDef(m.cardId).price
    this.board.removeStack(stack)

    // [新手引导] 任务事件：完成一次出售
    this.onQuestEvent?.('card_sold')

    if (total > 0) {
      this.floaters.show(SELL_X + SELL_SLOT_SIZE / 2, SELL_Y + SELL_SLOT_SIZE + 20, `+${total} 金币`, '#ffd75e', 24)
      const targetX = SELL_X + SELL_SLOT_SIZE / 2 - CARD_W / 2
      const targetY = SELL_Y + SELL_SLOT_SIZE + 30

      const magnetTarget = this.findMagnetTarget('coin')

      if (magnetTarget) {
        const coinStack = this.board.spawnCard('coin', magnetTarget.x, magnetTarget.y)
        for (let i = 1; i < total; i++) {
          const extraCoin = this.board.spawnCard('coin', magnetTarget.x, magnetTarget.y)
          this.board.mergeStacks(extraCoin, coinStack)
        }
        refreshStackView(coinStack)
        this.animateMagnetGlide(coinStack, SELL_X + SHOP_SLOT_W / 2, SELL_Y + SHOP_SLOT_H / 2, magnetTarget.x, magnetTarget.y, magnetTarget)
      } else {
        const coinStack = this.board.spawnCard('coin', targetX, targetY)
        for (let i = 1; i < total; i++) {
          const extraCoin = this.board.spawnCard('coin', targetX, targetY)
          this.board.mergeStacks(extraCoin, coinStack)
        }
        refreshStackView(coinStack)
        this.animatePneumaticPunch(coinStack, SELL_X + SHOP_SLOT_W / 2, SELL_Y + SHOP_SLOT_H / 2, targetX, targetY)
      }
    }

    this.renderShopBar()
    this.syncHud()
    this.checkDefeat()
  }

  public checkDefeat(): void {
    if (this.gameOverFired || !this.gameStarted) return
    const alive = this.board.allCards().some(c => getDef(c.cardId).isOurUnit)
    if (!alive) {
      this.gameOverFired = true
      this.onGameOver?.()
    }
  }

  private advanceSettlementPhase(phase: 'feeding' | 'tax' | 'clearance' | 'sell' | 'confirm' | null): void {
    this.settlementPhase = phase
    this.onSettlementPhase?.(phase)
  }

  /** 年末向导入口：只做账目预算与税单预检，实际结算（吃/饿/税）分步由玩家驱动 */
  private triggerMonthSettlement(): void {
    this.isSettling = true
    this.paused = true
    this.feedingRunning = false
    this.taxNoticePending = false

    let messHallFoodTotal = 0
    for (const items of this.messHallStorages.values()) {
      for (const it of items) messHallFoodTotal += it.satiety
    }
    let groundFood = 0
    let foodNeed = 0
    for (const c of this.board.allCards()) {
      const d = getDef(c.cardId)
      if (d.category === 'food') groundFood += (c.satietyLeft ?? d.satiety) || 0
      if (d.isOurUnit && (d.foodPerMonth || 0) > 0) foodNeed += d.foodPerMonth || 0
    }

    let taxReport: MonthSettlementResult['taxReport'] = undefined
    if (this.month > 0 && this.month % TAX_CYCLE_YEARS === 0) {
      const ship = this.board.allCards().find(c => c.cardId === 'tax_ship')
      if (ship) {
        const targetReq = ship.taxTarget ?? 50
        const currentPaid = ship.taxPaid ?? 0
        // batch36：未缴足 → 抗税次数+1（惩罚基数）；缴足不动，完税后清零
        if (currentPaid < targetReq) this.taxMissCount++
        taxReport = {
          isTaxYear: true,
          taxCycle: Math.floor(this.month / TAX_CYCLE_YEARS),
          taxType: ship.taxType || 'gold',
          targetReq,
          currentPaid,
          isFulfilled: currentPaid >= targetReq,
          missCount: this.taxMissCount
        }
      }
    }

    this.settlementReport = {
      month: this.month,
      foodHave: messHallFoodTotal + groundFood,
      foodNeed,
      foodConsumed: 0,
      starvedCount: 0,
      starvedNames: [],
      corpsesSpawned: 0,
      isDefeat: false,
      taxReport
    }

    this.advanceSettlementPhase('feeding')
    this.renderShopBar()
    this.onSettlementStart?.(this.settlementReport)
    this.syncHud()
  }

  /** 向导①开饭（玩家点击触发）：食物逐张飞向人口，扣完消失、未扣完留存 */
  public startFeeding(): boolean {
    // batch64：返回"进食是否在进行"供 Vue 按钮状态同步（修偶尔点了没反应的UI失步）
    if (this.settlementPhase !== 'feeding' || !this.settlementReport) return false
    if (this.feedingRunning) return true
    this.feedingRunning = true

    const hungry = this.board.allCards()
      .filter(c => getDef(c.cardId).isOurUnit && (getDef(c.cardId).foodPerMonth || 0) > 0)
      .sort((a, b) => getFeedPriority(a.cardId) - getFeedPriority(b.cardId))

    if (hungry.length === 0) {
      this.finishFeeding()
      return true
    }
    this.feedNextUnit(hungry, 0)
    return true
  }

  private feedNextUnit(units: CardEntity[], index: number): void {
    if (index >= units.length) { this.finishFeeding(); return }
    const unit = units[index]
    if (!this.board.cards.has(unit.uid)) { this.feedNextUnit(units, index + 1); return }
    const unitStack = this.board.stackOf(unit)
    if (!unitStack) { this.feedNextUnit(units, index + 1); return }
    this.feedUnitLoop(units, index, unit, unitStack, getDef(unit.cardId).foodPerMonth || 0)
  }

  private feedUnitLoop(units: CardEntity[], index: number, unit: CardEntity, unitStack: Stack, needLeft: number): void {
    if (needLeft <= 0) { this.feedNextUnit(units, index + 1); return }

    // 1. 优先食堂虚拟存粮（幻影飘字，不占实体卡）
    for (const [, items] of this.messHallStorages.entries()) {
      if (needLeft <= 0) break
      if (items.length === 0) continue
      const it = items[items.length - 1]
      const take = Math.min(it.satiety, needLeft)
      it.satiety -= take
      if (it.satiety <= 0) items.pop()
      needLeft -= take
      if (this.settlementReport) this.settlementReport.foodConsumed += take
      this.floaters.show(unitStack.x + CARD_W / 2, unitStack.y - 12, `食堂供餐 -${take} 饱食`, '#4ade80', 16)
    }
    if (needLeft <= 0) { this.feedNextUnit(units, index + 1); return }

    // 2. 桌面食物卡飞行动画（结算期补间由 tick 结算分支推进；排除正被玩家拖拽的卡）
    const carriedUids = new Set((this.dragDrop.carried?.members || []).map(m => m.uid))
    // B5 修复：两轮找食物——第一轮排除正在种植/烹饪的作业堆，第二轮无限制兜底（防开饭吃掉地里作物）
    const isEdible = (c: CardEntity) => {
      const d = getDef(c.cardId)
      return !carriedUids.has(c.uid) && d.category === 'food' && ((c.satietyLeft ?? d.satiety) || 0) > 0
    }
    let food = this.board.allCards().find(c => isEdible(c) && !this.board.stackOf(c)?.task)
    if (!food) {
      food = this.board.allCards().find(c => isEdible(c))
    }
    if (!food) {
      this.starveRemaining(units, index)
      return
    }
    const foodStack = this.board.stackOf(food)
    const rv = food.view
    // [批次四] 守卫补齐：与出卡动画对齐，position/scale 缺失时不得创建补间（防 null 目标入队）
    if (!foodStack || !rv || rv.destroyed || !rv.position || !rv.scale) {
      // 坏卡兜底：视图异常的食物卡无法投喂，移除后重试（防无限重试与软死锁）
      if (this.board.cards.has(food.uid)) {
        this.board.removeCard(food)
      }
      this.feedUnitLoop(units, index, unit, unitStack, needLeft)
      return
    }

    this.tweens.to(rv.position, { x: unitStack.x, y: unitStack.y }, 0.3, Easings.easeOutQuad, () => {
      if (!this.board.cards.has(food.uid)) { this.feedNextUnit(units, index + 1); return }
      const d = getDef(food.cardId)
      const have = (food.satietyLeft ?? d.satiety) || 0
      const take = Math.min(have, needLeft)
      const left = have - take
      needLeft -= take
      if (this.settlementReport) this.settlementReport.foodConsumed += take
      // B5 修复：吃掉作业中的食物（地里作物/烹饪堆）→ 打断该堆任务
      const foodStackNow = this.board.stackOf(food)
      if (foodStackNow && foodStackNow.task) {
        foodStackNow.task = null
        refreshStackView(foodStackNow)
        this.floaters.show(foodStackNow.x + CARD_W / 2, foodStackNow.y - 12, '种植被打断！', '#ef4444', 18)
      }
      // 尸体淀粉被吃下时触发其 +3 腐化特性（batch64：与配方/卡面统一）
      if (food.cardId === 'corpse_starch') {
        this.corruption = clampNum(this.corruption + 3, 0, 100)
      }
      if (left <= 0) {
        this.board.removeCard(food)
      } else {
        food.satietyLeft = left
        refreshCardBadge(food)
        const fs = this.board.stackOf(food)
        if (fs) this.board.placeStack(fs, fs.x, fs.y)
      }
      if (needLeft <= 0) this.feedNextUnit(units, index + 1)
      else this.feedUnitLoop(units, index, unit, unitStack, needLeft)
    })
  }

  /** 食物耗尽：本人口及之后所有未吃到食物的人口按序饿死（婴儿在巢都内饿死→尸体弹出巢都） */
  private starveRemaining(units: CardEntity[], fromIndex: number): void {
    for (let i = fromIndex; i < units.length; i++) {
      const victim = units[i]
      if (!this.board.cards.has(victim.uid)) continue
      const d = getDef(victim.cardId)
      const vStack = this.board.stackOf(victim)
      const px = vStack ? vStack.x : 960
      const py = vStack ? vStack.y : 540
      const inNest = !!(vStack && vStack.members[0] && vStack.members[0].cardId === 'hive_city')

      if (this.settlementReport) {
        this.settlementReport.starvedCount++
        this.settlementReport.starvedNames.push(d.name)
        this.settlementReport.corpsesSpawned++
      }
      this.board.removeCard(victim)

      let cx = px
      let cy = py
      if (inNest && vStack) {
        // 婴儿（或巢都内人口）饿死：尸体直接弹出巢都
        const pos = this.board.findNonOverlappingPosition(vStack, vStack.x + CARD_W + 24, vStack.y + 20)
        cx = pos.x
        cy = pos.y
      }
      const corpseStack = this.board.spawnCard('corpse', cx, cy)
      this.floaters.show(px, py - 12, `${d.name} 饥饿牺牲`, '#ff5555', 20)
      if (corpseStack.members.length > 0) {
        this.scheduleMutate(corpseStack.members[0])
      }
    }
    this.finishFeeding()
  }

  /** 喂食收尾：幸存者满血、败北复查、税阶段预置（B1：非税年跳过税收空站直接进售卡） */
  private finishFeeding(): void {
    for (const survivor of this.board.allCards()) {
      const d = getDef(survivor.cardId)
      if (d.isOurUnit) {
        survivor.hp = survivor.maxHp
        // batch65：满血重置同步刷新角标（修新周期人物血量显示未重置、战斗后才恢复的UI BUG）
        refreshCardBadge(survivor)
      }
    }
    this.checkDefeat()
    const alive = this.board.allCards().some(c => getDef(c.cardId).isOurUnit)
    if (this.settlementReport) this.settlementReport.isDefeat = !alive

    const tax = this.settlementReport?.taxReport
    if (tax && !tax.isFulfilled) {
      // batch36：抗税惩罚按"抗税次数"递增（第 N 次 +10×N；届数不再参与）
      this.corruption = clampNum(this.corruption + 10 * (tax.missCount || 1), 0, 100)
      const ship = this.board.allCards().find(c => c.cardId === 'tax_ship')
      if (ship) this.board.removeCard(ship)
      this.store.setTaxShipStatus(null)
      this.taxNoticePending = true
      this.feedingRunning = false
      this.advanceSettlementPhase('tax')
    } else if (tax && tax.isFulfilled) {
      // 足额：弹双倍献赋窗口（献赋/放弃两个出口都在税阶段）
      this.store.showDoubleTaxPrompt = true
      this.feedingRunning = false
      this.advanceSettlementPhase('tax')
    } else {
      // B1 修复：非税年税收阶段为空站（无任何出口），跳过税收直接进清理/确认
      this.feedingRunning = false
      this.advanceToClearanceOrConfirm()
    }
    this.syncHud()

    // [新手引导] 任务事件：喂食演示结束（年末剧情②的挂载点；此时阶段已推进到 tax/clearance/confirm）
    this.onQuestEvent?.('feeding_done')
  }

  /** 进入卖卡段前的知悉闸：超容 → 先弹"库存超上限"知悉页；未超容 → 直达确认页 */
  private advanceToClearanceOrConfirm(): void {
    if (this.store.slotsUsed > this.store.slotsCap) {
      this.advanceSettlementPhase('clearance')
    } else {
      this.advanceSettlementPhase('confirm')
    }
    this.syncHud()
  }

  /** 向导③清理知悉：玩家点击"我已知悉"后进入实际售卡阶段 */
  public acknowledgeClearance(): void {
    if (this.settlementPhase !== 'clearance') return
    this.advanceSettlementPhase('sell')
    this.syncHud()
  }

  /** 向导②税：玩家手动确认知悉抗税惩罚（B3：必须补 syncHud 触发不超容自动进阶） */
  public acknowledgeTaxNotice(): void {
    if (this.settlementPhase !== 'tax') return
    this.taxNoticePending = false
    this.advanceToClearanceOrConfirm()
    this.syncHud()
  }

  public confirmNextMonth(): boolean {
    const isOver = this.store.slotsUsed > this.store.slotsCap

    // B4 修复：沿用旧版闸门语义——超容且仍有可售卡才拦截；若超容部分全是尸体等不可售卡则放行
    // （结算期任务冻结无法火葬腾槽，此处是唯一出口，防止软死锁）
    const sellableCount = this.board.allCards().filter(c => {
      const d = getDef(c.cardId)
      return c.cardId !== 'coin' && !d.isOurUnit && !d.unsellable && c.cardId !== 'tax_ship'
    }).length

    if (isOver && sellableCount > 0) {
      this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, '仓储依然溢出，请先出售卡牌！', '#ef4444', 22)
      return false
    }

    if (this.store.isTaxDue && this.store.taxCompleted) {
      this.cancelDoubleTax()
    }

    this.isSettling = false
    // batch64：结算售卡阶段防御性全量重链——修复偶发成员视图失步（20张只显示几张，拖拽才恢复）
    this.board.relinkAllStacks()
    this.settlementReport = null
    this.advanceSettlementPhase(null)
    this.month++
    // batch16：腐化线旗舰推迟登陆——翻年时若挂起则落地
    if (this.combat.consumeFlagshipPending()) this.combat.spawnImperialFlagshipPublic()
    this.monthTimer = 0
    this.paused = false

    // [新手引导] 任务事件：新星际年开启（data = 新年份）
    this.onQuestEvent?.('year_started', String(this.month))

    this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, `第 ${this.month} 星际年开始了`, '#00f0ff', 30)

    if (this.month % TAX_CYCLE_YEARS === 0) {
      this.spawnTaxShip()
    }

    // batch54：新周期开始演出——修女警觉(>60一次性) 先于 大魔低语(>20/>40/>60三档)；
    // 税务官收税提醒每税年必弹（0次抗税=正常开征提醒，防遗忘本体；1/2/≥3次逐级升级）
    if (this.corruption > 60 && !this.sisterWarned) {
      this.sisterWarned = true
      this.onSisterWarn?.()
    }
    const whisperBand: 0 | 1 | 2 | 3 = this.corruption > 60 ? 3 : this.corruption > 40 ? 2 : this.corruption > 20 ? 1 : 0
    if (whisperBand > 0) this.onDemonWhisper?.(whisperBand)
    if (this.month % TAX_CYCLE_YEARS === 0) {
      this.onTaxReminder?.(Math.min(this.taxMissCount, 3) as 0 | 1 | 2 | 3)
    }

    this.onSettlementEnd?.()
    this.renderShopBar()
    this.syncHud()
    return true
  }

  /** batch16：腐化线对话回调与叛变入口 */
  public onCorruptionDialog: (() => void) | null = null

  private startCorruptionDialog(): void {
    this.onCorruptionDialog?.()
  }

  /** batch16：对话结束——修女全体叛变，旗舰推迟至下个星际年登陆 */
  public combatCorruptionPurge(): void {
    this.combat.beginCorruptionPurge()
  }

  /** batch14存档：全量序列化当前对局（延迟队列/战斗群/敌人移动AI不持久化，读档后自然重建） */
  public saveGame(): void {
    try {
      const stacks = [...this.board.stacks.values()]
        .filter(st => st.members.length > 0)
        .map(st => ({
          sid: st.id,
          x: st.x,
          y: st.y,
          task: st.task
            ? { id: st.task.recipe.id, progress: st.task.progress, workers: st.task.workers }
            : null,
          members: st.members.map(m => ({
            uid: m.uid,
            cardId: m.cardId,
            trait: m.trait ?? 'none',
            hp: m.hp,
            maxHp: m.maxHp,
            usesLeft: m.usesLeft,
            equippedGears: m.equippedGears ? [...m.equippedGears] : [],
            originUnit: m.originUnit,
            geneHarvested: m.geneHarvested,
            satietyLeft: m.satietyLeft,
            chestCoins: m.chestCoins,
            taxType: m.taxType,
            taxTarget: m.taxTarget,
            taxPaid: m.taxPaid
          }))
        }))
      mgSave(SAVE_KEY, {
        version: 1,
        savedAt: new Date().toISOString(),
        run: {
          month: this.month,
          monthTimer: this.monthTimer,
          corruption: this.corruption,
          gameStarted: this.gameStarted,
          pioneerPityCounter: this.pioneerPityCounter,
          taxMissCount: this.taxMissCount,
          ideaPityCount: this.ideaPityCount,
          groxBreedTimer: this.groxBreedTimer,
          unlockedRecipes: [...this.unlockedRecipes],
          packQueues: [...this.packQueues.entries()],
          chestCoins: [...this.chestCoins.entries()],
          messHallStorages: [...this.messHallStorages.entries()],
          packDeposited: [...this.packDeposited.entries()],
          combat: this.combat.serializeCombat(),
          stacks,
          vue: this.saveExtraProvider ? this.saveExtraProvider() : null
        }
      })
      this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, '💾 已保存', '#4ade80', 22)
    } catch (e) {
      console.error('[badab] 存档失败:', e)
      this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, '⚠️ 存档失败（详见控制台）', '#ef4444', 22)
    }
  }

  /** batch14存档：Vue 侧注册附加状态提供者（任务链状态随每次存档持久化） */
  public setSaveExtraProvider(fn: (() => Record<string, unknown> | null) | null): void {
    this.saveExtraProvider = fn
  }

  /** batch14存档：读档后取出 Vue 侧附加状态（无存档或未写入则为 null） */
  public getSaveExtra(): Record<string, unknown> | null {
    return this.lastLoadedExtra
  }

  /** batch14存档：读档重建任务对象（普通配方查表 / 仪式与黑市为动态配方重建 / 远征伪任务由 combat 下一拍自动渲染） */
  private rebuildTask(t: { id: string; progress: number; workers: number }): ActiveTask | null {
    if (t.id === '__expedition__') return null
    if (t.id === 'ritual_boss') {
      return {
        recipe: { id: 'ritual_boss', name: '亚空间大魔降临仪式', baseTime: 60, inputs: {}, outputs: {} },
        progress: t.progress,
        workers: t.workers
      }
    }
    if (t.id.startsWith('bm_trade_')) {
      const itemId = t.id.replace('bm_trade_', '')
      const d = getDef(itemId)
      return {
        recipe: {
          id: t.id,
          name: `黑市交易: ${d.name} (x2金币)`,
          baseTime: 45,
          inputs: { black_market: 1, [itemId]: 1 },
          consumes: { [itemId]: 1 },
          outputs: { coin: d.price * 2 }
        },
        progress: t.progress,
        workers: t.workers
      }
    }
    const r = RECIPES.find(x => x.id === t.id)
    return r ? { recipe: r, progress: t.progress, workers: t.workers } : null
  }

  /** batch14存档：读档重建对局；返回 false 表示无存档/损坏（调用方走新流程） */
  public loadGame(): boolean {
    let data: any = null
    try {
      data = mgLoad(SAVE_KEY)
    } catch (e) {
      console.warn('[badab] 读档失败:', e)
    }
    if (!data || !data.run || !Array.isArray(data.run.stacks)) return false

    try {
      this.board.clearAll()
      const run = data.run
      this.lastLoadedExtra = run.vue ?? null
      const uidMap = new Map<number, number>()
      const stackIdMap = new Map<number, number>()
      let maxUid = 0
      let maxStackId = 0

      for (const ss of run.stacks) {
        let target: Stack | null = null
        for (const ms of ss.members) {
          const spawned = this.board.spawnCard(ms.cardId, ss.x, ss.y, ms.trait as TraitType)
          const ent = spawned.members[0]
          uidMap.set(ms.uid, ent.uid)
          maxUid = Math.max(maxUid, ent.uid)
          maxStackId = Math.max(maxStackId, spawned.id)
          ent.hp = ms.hp
          ent.maxHp = ms.maxHp
          ent.usesLeft = ms.usesLeft
          ent.equippedGears = ms.equippedGears || []
          ent.originUnit = ms.originUnit
          ent.geneHarvested = ms.geneHarvested
          ent.satietyLeft = ms.satietyLeft
          ent.chestCoins = ms.chestCoins
          ent.taxType = ms.taxType
          ent.taxTarget = ms.taxTarget
          ent.taxPaid = ms.taxPaid
          // batch58：读档的尸体补挂全新尸变倒计时（顺带修复读档尸体永不尸变的旧暗坑；阿斯塔特尸体不尸变不入表）
          if (ms.cardId === 'corpse') this.mutateTimers.set(ent.uid, CORPSE_MUTATE_DELAY)
          refreshCardBadge(ent)
          if (!target) {
            target = spawned
            this.board.placeStack(spawned, ss.x, ss.y)
            stackIdMap.set(ss.sid ?? spawned.id, spawned.id)
          } else {
            this.board.mergeStacks(spawned, target)
          }
        }
        if (target && ss.task) {
          const t = this.rebuildTask(ss.task)
          if (t) {
            target.task = t
            refreshStackView(target)
          }
        }
      }
      this.board.restoreCounters(maxUid + 1, maxStackId + 1)

      this.month = run.month ?? 1
      this.monthTimer = run.monthTimer ?? 0
      this.corruption = run.corruption ?? 0
      this.gameStarted = run.gameStarted !== false
      this.paused = false
      this.pioneerPityCounter = run.pioneerPityCounter ?? 0
      this.taxMissCount = run.taxMissCount ?? 0
      this.ideaPityCount = run.ideaPityCount ?? 0
      this.groxBreedTimer = run.groxBreedTimer ?? 0
      this.unlockedRecipes = new Set(run.unlockedRecipes || [...this.unlockedRecipes])

      this.packQueues.clear()
      for (const [uid, cards] of run.packQueues || []) this.packQueues.set(uidMap.get(uid) ?? uid, cards)
      this.chestCoins.clear()
      for (const [uid, n] of run.chestCoins || []) this.chestCoins.set(uidMap.get(uid) ?? uid, n)
      this.messHallStorages.clear()
      for (const [uid, items] of run.messHallStorages || []) this.messHallStorages.set(uidMap.get(uid) ?? uid, items)
      this.packDeposited.clear()
      for (const [idx, n] of run.packDeposited || []) this.packDeposited.set(idx, n)

      const combatData = run.combat || { expeditions: [], purifyStates: [] }
      const remappedExpeditions = (combatData.expeditions || []).map((e: any) => ({
        ...e,
        locationEntityUid: uidMap.get(e.locationEntityUid) ?? e.locationEntityUid,
        explorerEntityUid: uidMap.get(e.explorerEntityUid) ?? e.explorerEntityUid
      }))
      const remappedPurify = (combatData.purifyStates || []).map((p: any) => ({
        ...p,
        stackId: stackIdMap.get(p.stackId) ?? p.stackId,
        purifierUid: uidMap.get(p.purifierUid) ?? p.purifierUid,
        cultistUid: uidMap.get(p.cultistUid) ?? p.cultistUid
      }))
      this.combat.restoreCombat({
        corruptionLineTriggered: combatData.corruptionLineTriggered,
        corruptionCountdownMonths: combatData.corruptionCountdownMonths ?? 0,
        expeditions: remappedExpeditions,
        purifyStates: remappedPurify
      })

      const ship = this.board.allCards().find(c => c.cardId === 'tax_ship')
      if (ship) {
        this.store.setTaxShipStatus({
          cycle: Math.floor(this.month / TAX_CYCLE_YEARS),
          taxType: ship.taxType || 'gold',
          targetReq: ship.taxTarget ?? 50,
          currentPaid: ship.taxPaid ?? 0,
          isCompleted: (ship.taxPaid ?? 0) >= (ship.taxTarget ?? 50)
        })
      } else {
        this.store.setTaxShipStatus(null)
      }

      this.renderShopBar()
      this.syncHud()
      this.floaters.show(BOARD_W / 2, CONSOLE_Y + 120, `💾 已恢复第 ${this.month} 星际年的对局`, '#4ade80', 26)
      return true
    } catch (e) {
      console.error('[badab] 读档重建失败，回退新游戏:', e)
      this.board.clearAll()
      return false
    }
  }

  private scheduleMutate(corpse: CardEntity): void {
    const uid = corpse.uid
    // batch64：尸变统一由 tick 内 mutateTimers 单系统驱动（原 DelayedQueue 回调体系删除，
    // 根除双系统竞态 + 读档尸体回调缺失永不尸变两个问题）；已存在则保留剩余量
    if (!this.mutateTimers.has(uid)) this.mutateTimers.set(uid, CORPSE_MUTATE_DELAY)
  }

  private triggerVictory(route: 'justice' | 'corruption', text: string): void {
    this.paused = true
    const elapsed = Math.max(Math.round(this.gameTime), (this.month - 1) * 120 + Math.round(this.monthTimer))
    this.onVictory?.(route, text, elapsed, this.month)
  }

  /** C3：格罗克斯兽繁殖——场上 ≥2 只累计计时，到点在随机成兽附近产幼崽；<2 只计时清零；不设总数上限 */
  private updateGroxBreeding(dt: number): void {
    const groxes = this.board.allCards().filter(c => c.cardId === 'grox')
    if (groxes.length < 2) {
      this.groxBreedTimer = 0
      return
    }
    this.groxBreedTimer += dt
    if (this.groxBreedTimer >= GROX_BREED_TIME) {
      this.groxBreedTimer = 0
      const parent = groxes[Math.floor(Math.random() * groxes.length)]
      const pStack = this.board.stackOf(parent)
      if (!pStack) return
      const safePos = this.board.findNonOverlappingPosition(pStack, pStack.x + CARD_W + 30, pStack.y + 20)
      this.board.spawnCard('grox', safePos.x, safePos.y)
      this.floaters.show(safePos.x + CARD_W / 2, safePos.y - 12, '★ 格罗克斯兽繁育了新幼崽！', '#4ade80', 20)
    }
  }

  /** batch39：交战区域圈——红虚线圆+呼吸闪烁，每帧由 combat.getBattleZones 数据源重绘，战斗解散即消失 */
  private renderBattleZones(): void {
    this.battleZoneG.clear()
    for (const z of this.combat.getBattleZones()) {
      const pulse = 0.45 + Math.sin(this.gameTime * 5) * 0.2
      const segs = 24
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2
        const a1 = ((i + 0.6) / segs) * Math.PI * 2
        this.battleZoneG.moveTo(z.x + Math.cos(a0) * z.r, z.y + Math.sin(a0) * z.r)
        this.battleZoneG.lineTo(z.x + Math.cos(a1) * z.r, z.y + Math.sin(a1) * z.r)
      }
      this.battleZoneG.stroke({ width: 2.5, color: 0xef4444, alpha: pulse })
    }
  }

  private updateGroxAI(dt: number): void {
    for (const stack of [...this.board.stacks.values()]) {
      if (stack.members.length === 0) continue

      // batch14修复：删除"圈养即整堆跳过"（产奶被误杀，卡面承诺"稳定产奶"）；圈养堆的蹦跳本就被下方 stack.members.length === 1 条件天然禁止

      for (const member of stack.members) {
        if (member.cardId !== 'grox') continue

        let state = this.groxAiStates.get(member.uid)
        if (!state) {
          // 需求对齐：格罗克斯兽产奶周期修正为 120 秒/次
          state = { hopTimer: 4 + Math.random() * 2, milkTimer: 120 }
          this.groxAiStates.set(member.uid, state)
        }

        state.milkTimer -= dt
        if (state.milkTimer <= 0) {
          state.milkTimer = 120
          if (!this.dragDrop.isBusy()) {
            const rawTx = stack.x + (Math.random() > 0.5 ? 130 : -130)
            const rawTy = stack.y + (Math.random() > 0.5 ? 40 : -40)
            const safePos = this.board.findNonOverlappingPosition(stack, rawTx, rawTy)
            // batch52：恢复产奶磁吸归拢（磁吸已回滚纯同 ID，奶只进奶堆，不会飞混堆）
            this.spawnAndRouteCard('grox_milk', stack.x, stack.y, safePos.x, safePos.y)
            this.floaters.show(stack.x + CARD_W / 2, stack.y - 14, '+🥛 格罗克斯生奶', '#ffd75e', 20)
          }
        }

        state.hopTimer -= dt
        if (state.hopTimer <= 0) {
          state.hopTimer = 4 + Math.random() * 2

          if (stack.members.length === 1 && !stack.task && !this.dragDrop.isBusy()) {
            const angle = Math.random() * Math.PI * 2
            const dist = 60 + Math.random() * 60
            const rawTx = stack.x + Math.cos(angle) * dist
            const rawTy = stack.y + Math.sin(angle) * dist
            const safePos = this.board.findNonOverlappingPosition(stack, rawTx, rawTy)

            const rv = stack.members[0].view
            if (rv && !rv.destroyed && rv.scale && rv.position) {
              this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1.08, y: 0.92 }, 0.15, Easings.easeOutQuad, () => {
                if (!rv.destroyed && rv.scale) {
                  this.tweens.to(rv.scale as unknown as Record<string, number>, { x: 1, y: 1 }, 0.2, Easings.easeOutQuad)
                }
              })

              this.tweens.to(rv.position, { x: safePos.x, y: safePos.y }, 0.35, Easings.easeOutQuad, () => {
                stack.x = safePos.x
                stack.y = safePos.y
              })
            }
          }
        }
      }
    }
  }

  /** batch65：特殊倒计时红条统一驱动——尸变倒计时 + 亚空间裂隙刷怪倒计时（卡牌上方同车道，红色） */
  private updateSpecialBars(): void {
    const riftMap = new Map<number, number>()
    for (const r of this.combat.getRiftProgressList(this.month, this.monthTimer)) {
      riftMap.set(r.uid, r.progress)
    }
    for (const card of this.board.allCards()) {
      if (card.mutateBar) {
        const t = this.mutateTimers.get(card.uid)
        if (card.cardId === 'corpse' && t !== undefined) {
          const ratio = Math.max(0, Math.min(1, t / CORPSE_MUTATE_DELAY))
          card.mutateBar.clear()
          card.mutateBar.rect(0, 0, Math.max(2, (CARD_W - 8) * ratio), 6).fill({ color: 0xef4444, alpha: 0.9 })
          card.mutateBar.visible = true
        } else {
          card.mutateBar.visible = false
        }
      }
      if (card.riftBar) {
        const rp = riftMap.get(card.uid)
        if (card.cardId === 'warp_rift' && rp !== undefined) {
          card.riftBar.clear()
          card.riftBar.rect(0, 0, Math.max(2, (CARD_W - 8) * rp), 6).fill({ color: 0xef4444, alpha: 0.9 })
          card.riftBar.visible = true
        } else {
          card.riftBar.visible = false
        }
      }
    }
  }

  private updateGlowPulse(): void {
    const pulseAlpha = 0.55 + Math.sin(this.gameTime * 3) * 0.25
    for (const card of this.board.allCards()) {
      if (card.glowRing && card.glowRing.visible) {
        card.glowRing.alpha = pulseAlpha
      }
    }
  }

  private syncHud(): void {
    // 巢都人口上限强制执行（婴儿独占巢都；重入锁防止弹出流程内的 emitChanged 递归）
    if (!this.enforcingNests) {
      this.enforcingNests = true
      const ejected = this.board.ejectExcessNestPopulation()
      for (const e of ejected) {
        const st = this.board.stackOf(e)
        if (st) this.floaters.show(st.x + CARD_W / 2, st.y - 12, '成年人口已请出巢都（婴儿独占）', '#38bdf8', 16)
      }
      this.enforcingNests = false
    }

    let groundFood = 0
    let need = 0
    let groundCoins = 0
    let usedSlots = 0
    let bonusSlots = 0

    for (const c of this.board.allCards()) {
      const d = getDef(c.cardId)
      if (d.category === 'food') groundFood += (c.satietyLeft ?? d.satiety) || 0
      if (d.foodPerMonth) need += d.foodPerMonth
      if (c.cardId === 'coin') groundCoins++
      if (d.capacityBonus) bonusSlots += d.capacityBonus

      // 金币箱存量角标实时动态响应
      if (c.cardId === 'coin_chest') {
        const chestCount = this.chestCoins.get(c.uid) || 0
        if (c.chestCoins !== chestCount) {
          c.chestCoins = chestCount
          refreshCardBadge(c)
        }
      }

      if (c.cardId !== 'coin' && !d.isOurUnit && !d.isPack && c.cardId !== 'tax_ship') {
        usedSlots++
      }
    }

    let messHallFoodTotal = 0
    for (const items of this.messHallStorages.values()) {
      for (const it of items) messHallFoodTotal += it.satiety
    }

    let chestTotal = 0
    for (const count of this.chestCoins.values()) chestTotal += count

    this.gold = groundCoins + chestTotal
    this.store.month = this.month
    this.store.monthProgress = this.isSettling ? 1 : (!this.gameStarted ? 0 : this.monthTimer / MONTH_LENGTH)
    this.store.gold = this.gold
    this.store.corruption = this.corruption
    this.store.foodHave = groundFood + messHallFoodTotal
    this.store.foodNeed = need
    this.store.slotsUsed = usedSlots
    this.store.slotsCap = BASE_CARD_CAP + bonusSlots
    this.store.paused = this.paused || !this.gameStarted

    const mod5 = this.month % TAX_CYCLE_YEARS
    this.store.monthsUntilTax = mod5 === 0 ? 0 : TAX_CYCLE_YEARS - mod5

    // 向导售卡阶段：仓储回落至上限内 → 自动进阶到确认阶段（UI 随相位回归）
    // F1 修复：超载但已无可售卡（剩余占槽全是尸体等不可售卡）→ 同样放行进阶，拆除隐形牢笼
    if (this.settlementPhase === 'sell' && this.store.slotsUsed <= this.store.slotsCap) {
      this.advanceSettlementPhase('confirm')
    } else if (this.settlementPhase === 'sell') {
      const hasSellableLeft = this.board.allCards().some(c => {
        const d = getDef(c.cardId)
        return c.cardId !== 'coin' && !d.isOurUnit && !d.unsellable && c.cardId !== 'tax_ship'
      })
      if (!hasSellableLeft) this.advanceSettlementPhase('confirm')
    }

    // 什一税信息块：倒计时/税舰在场/缴纳进度任一变化才重绘（避免每帧重建图形）
    const muTaxShown = this.store.monthsUntilTax
    const shipNow = this.board.allCards().find(c => c.cardId === 'tax_ship')
    const taxKey = `${muTaxShown}|${shipNow ? (shipNow.taxPaid ?? 0) : -1}`
    if (taxKey !== this.lastTaxBannerValue) {
      this.lastTaxBannerValue = taxKey
      this.renderShopBar()
    }
  }

  private tick(dt: number): void {
    this.renderHints()

    if (this.isSettling) {
      // batch18：结算全程推进补间与飘字——售卡阶段卖卡吐金币动画/卖卡飘字同样依赖；游戏逻辑仍冻结
      this.tweens.update(dt)
      this.floaters.update(dt)
      return
    }

    if (this.paused || !this.gameStarted) return

    this.gameTime += dt
    // [新手引导改版] 时间闸门已删除：年份从拆包起正常推进，任务为纯指导（一号裁定 2026-09-15）
    this.monthTimer += dt
    if (this.monthTimer >= MONTH_LENGTH) {
      // batch14：翻年进入结算前自动存档（结算向导状态不入档）
      this.saveGame()
      this.triggerMonthSettlement()
      return
    }

    try {
      this.delayed.process(this.gameTime)
      this.processTasks(dt)
    } catch (e) {
      // batch43：生产任务逐帧守卫——单次异常不再打死整个 ticker
      console.error('[badab processTasks error]', e)
    }

    try {
      this.combat.tick(dt, this.month, this.corruption)
    } catch (e) {
      console.error('[badab combat tick error]', e)
    }
    try {
      this.renderBattleZones()
    } catch (e) {
      // batch43：交战圈逐帧守卫（纯表现层，异常静默降级）
      console.error('[badab zones error]', e)
    }

    try {
      this.updateGroxAI(dt)
      this.updateGroxBreeding(dt)
      this.updateGlowPulse()

      // batch64：尸变倒计时推进（作业堆中暂停）+ 归零变身（统一唯一出口，含内嵌敌卡拆堆）
      for (const [uid, left] of this.mutateTimers.entries()) {
        const c = this.board.cards.get(uid)
        if (!c || c.cardId !== 'corpse') { this.mutateTimers.delete(uid); continue }
        const st = this.board.stackOf(c)
        if (st && st.task) continue
        const nl = left - dt
        if (nl <= 0) {
          this.mutateTimers.delete(uid)
          this.board.transformCard(c, 'corpse_mutant')
          if (st) {
            this.floaters.show(st.x + CARD_W / 2, st.y - 12, '尸变！', '#ff5555', 22)
            // batch64：变身成敌卡后若内嵌在非敌root堆（如熔炉堆）→ 自动拆堆弹出，
            // 杜绝敌卡拖不出/敌人AI只认root导致永久卡死+熔炉配方被顶死
            if (st.members[0] !== c) {
              const idx = st.members.indexOf(c)
              if (idx > 0) {
                const freed = this.board.grabAt(st, idx)
                const pos = this.board.findNonOverlappingPosition(freed, st.x + CARD_W + 24, st.y)
                this.board.placeStack(freed, pos.x, pos.y)
              }
            }
          }
        } else {
          this.mutateTimers.set(uid, nl)
        }
      }
      this.updateSpecialBars()

      this.tweens.update(dt)
      this.floaters.update(dt)
      this.syncHud()
    } catch (e) {
      // batch50：逐帧守卫——任何残余异常降级为跳过当帧并上报，绝不再冻结整个游戏
      this.reportFrameError('tick', e)
    }
  }

  /** batch50：帧级错误上报（同一错误仅记一次，防止刷屏） */
  private reportFrameError(scope: string, e: unknown): void {
    const msg = `[badab ${scope}] ${e instanceof Error ? e.message : String(e)}`
    if (!this.tickErrorSet.has(msg)) {
      this.tickErrorSet.add(msg)
      console.error(msg, e)
      this.onError?.(msg)
    }
  }

  private renderHints(): void {
    this.hintG.clear()
    this.hintText.visible = false

    if (!this.dragDrop.isBusy()) return

    const p = this.dragDrop.lastPos

    // ⑦ 拖动金币时：出售槽与卡包槽虚线提示框（只画提示线，无文字）
    const carriedStack = this.dragDrop.carried
    if (carriedStack && carriedStack.members && carriedStack.members.some(m => m.cardId === 'coin')) {
      const dashAlpha = 0.55 + Math.sin(this.gameTime * 6) * 0.35
      this.drawDashedRect(this.hintG, SELL_X - 4, SELL_Y - 4, SELL_SLOT_SIZE + 8, SELL_SLOT_SIZE + 8, 0xffd75e, dashAlpha)
      for (let i = 0; i < SHOP_PACK_IDS.length; i++) {
        const px = SELL_X + SELL_SLOT_SIZE + SHOP_GAP + i * (SHOP_SLOT_W + SHOP_GAP)
        this.drawDashedRect(this.hintG, px - 4, SELL_Y - 4, SHOP_SLOT_W + 8, SHOP_SLOT_H + 8, 0x00f0ff, dashAlpha)
      }
    }

    const pulseAlpha = 0.55 + Math.sin(this.gameTime * 6) * 0.35
    const currentHoverTarget = this.dragDrop.hoverTarget

    for (const targetInfo of this.dragDrop.radarTargets) {
      const s = targetInfo.stack
      if (!this.board.stacks.has(s.id) || s.members.length === 0) continue
      if (s === currentHoverTarget) continue

      const h = stackVisualHeight(s)
      this.hintG.roundRect(s.x - 4, s.y - 4, CARD_W + 8, h + 8, 8)
        .stroke({ width: 2.5, color: targetInfo.color, alpha: pulseAlpha })
    }

    if (this.isInSellSlot(p, this.dragDrop.carried || undefined)) {
      this.hintText.text = '松开出售（按价值吐出金币）'
      this.hintText.position.set(SELL_X, SELL_Y + SELL_SLOT_SIZE + 8)
      this.hintText.visible = true
      return
    }

    if (this.dragDrop.hoverPackIndex >= 0) {
      const pid = SHOP_PACK_IDS[this.dragDrop.hoverPackIndex]
      const pk = PACK_CONFIGS[pid]
      const dep = this.packDeposited.get(this.dragDrop.hoverPackIndex) || 0
      this.hintText.text = `投入金币 (还差 ${pk.price - dep} 金)`
      this.hintText.position.set(p.x - 60, p.y - 30)
      this.hintText.visible = true
      return
    }

    if (this.dragDrop.hoverTaxShip) {
      const ship = this.dragDrop.hoverTaxShip.members[0]
      const isFull = (ship.taxPaid || 0) >= (ship.taxTarget || 50)
      this.hintG.roundRect(this.dragDrop.hoverTaxShip.x - 5, this.dragDrop.hoverTaxShip.y - 5, TAX_SHIP_W + 10, TAX_SHIP_H + 10, 8)
        .stroke({ width: 3.5, color: 0xf59e0b, alpha: 0.95 })

      this.hintText.text = isFull ? '什一税款已备齐' : (this.dragDrop.hoverRecipeUnlocked ? '投入并上缴什一税' : '特使不接受此物资！')
      this.hintText.position.set(p.x - 50, p.y - CARD_H / 2 - 16)
      this.hintText.visible = true
      return
    }

    const target = this.dragDrop.hoverTarget
    const recipe = this.dragDrop.hoverRecipe
    if (target && recipe) {
      this.hintG.roundRect(target.x - 5, target.y - 5, CARD_W + 10, stackVisualHeight(target) + 10, 8)
        .stroke({ width: 3.5, color: 0x00f0ff, alpha: 0.95 })

      const title = this.dragDrop.hoverRecipeUnlocked ? recipe.name : '？？？ 神秘配方'
      this.hintText.text = title
      this.hintText.position.set(p.x, p.y - CARD_H / 2 - 16)
      this.hintText.visible = true
    }
  }

  /** 虚线矩形绘制：8px 实线段 + 6px 间隙，四边环绕 */
  private drawDashedRect(g: Graphics, x: number, y: number, w: number, h: number, color: number, alpha: number): void {
    const dash = 8
    const gap = 6
    const edges: Array<[number, number, number, number]> = [
      [x, y, x + w, y],
      [x + w, y, x + w, y + h],
      [x + w, y + h, x, y + h],
      [x, y + h, x, y]
    ]
    for (const [x1, y1, x2, y2] of edges) {
      const len = Math.hypot(x2 - x1, y2 - y1)
      const dx = (x2 - x1) / len
      const dy = (y2 - y1) / len
      let cur = 0
      while (cur < len) {
        const segEnd = Math.min(cur + dash, len)
        g.moveTo(x1 + dx * cur, y1 + dy * cur)
        g.lineTo(x1 + dx * segEnd, y1 + dy * segEnd)
        g.stroke({ width: 2, color, alpha })
        cur = segEnd + gap
      }
    }
  }

  public destroy(): void {
    this.isDestroyed = true
    this.containerEl.removeEventListener('contextmenu', this.onContextMenu)

    // 显式释放所有 GPU 纹理显存，防止多次进出小游戏显存泄漏
    for (const tex of this.textures.values()) {
      try { tex.destroy(true) } catch {}
    }
    this.textures.clear()

    for (const tex of this.packTextures.values()) {
      try { tex.destroy(true) } catch {}
    }
    this.packTextures.clear()

    if (this.app) {
      this.app.destroy(true, { children: true })
      this.app = null
    }
    this.delayed.clear()
    this.tweens.clear()
  }
}