// combat.ts 巴达布前哨 - 规则层：战斗、双阈值磁滞碰撞、自卫反击、远征与双线终局管线
import { Board } from '../engine/Board'
import { CardEntity, Stack, refreshStackView, refreshCardBadge, BOARD_W, BOARD_H, CONSOLE_X, CONSOLE_Y, CONSOLE_W, CONSOLE_H, CONSOLE_TOP_ZONE, stackVisualHeight } from '../engine/Stack'
import { CARD_W, CARD_H, getDef } from './cards'
import { CardDef } from './types'
import { Floater } from '../engine/Floater'
import { TweenManager, Easings } from '../engine/Tween'
import { DelayedQueue } from './cycle'
import { getEffectiveStats } from './equipment'

export const ENEMY_SPEED = 70
export const ENEMY_BURST = 0.5
export const ENEMY_PAUSE = 0.3
export const AGGRO_GREENSKIN = 250

// 双阈值磁滞物理判定：相交或间距 <= 20px 接敌；拉开 >= 120px 彻底脱战
// batch39：接敌阈值放大（配合战斗范围，兵海可同时接战）
export const ENGAGE_EDGE_DIST = 60
// batch58：脱战阈值 260→520（须大于弧形站位边缘距，防展开后被误判脱战）
export const DISENGAGE_EDGE_DIST = 520
export const DISENGAGE_COOLDOWN = 1.2

export const CONVERT_RADIUS = 200
export const CONVERT_TIME = 10
// batch55：旗舰召唤提速 15→8 秒
export const FLAGSHIP_SUMMON_INTERVAL = 8
export const FLAGSHIP_SUMMON_CYCLE = 3
export const FLAGSHIP_HEAL = 15
// batch16 绿皮分裂：军阀→小子→鼻涕怪的裂变数量（挂调参器）
export const GREEN_SPLIT_COUNT = 3
// batch65：裂隙刷怪周期（月）与月长（月长与引擎 MONTH_LENGTH=120 同口径，挂 tuner）
export const RIFT_SPAWN_MONTHS = 3
const MONTH_SECONDS = 120

// C1 净化：修女/智库堆到邪教徒上，净化回原本单位所需秒数（挂调参器）
export const PURIFY_TIME = 6
// batch19：出征代价——每名入场单位统一扣 HP（tuner 可调；扣至最低 1 不致死，HP≤代价时拒绝出征）
export const EXPEDITION_HP_COST = 5
// batch58：弧半径 200→340——环形容量扩至约18个位，大军可全向展开围殴
export const LUNGE_DIST = 36
export const ENGAGE_RING_RADIUS = 340
export const ZONE_PAD = 60
export const LIBRARIAN_AURA_RADIUS = 250
export const LIBRARIAN_AURA_HEAL = 1
export const LIBRARIAN_AURA_INTERVAL = 3
export const ASSASSIN_AURA_RADIUS = 250
export const ASSASSIN_CRIT_CHANCE = 0.15
export const ASSASSIN_CRIT_MULT = 2

// A2 掉落表：独立 roll 体系（每条单独掷、可同出）。排他语义（军阀四建材随机其一/敌阿二选一）在 handleEntityDeath 特判。
const ENEMY_LOOT_TABLE: Record<string, { id: string; chance: number }[]> = {
  space_pirate: [{ id: 'coin', chance: 1.0 }, { id: 'scrap_material', chance: 0.5 }],
  corpse_mutant: [{ id: 'corpse', chance: 1.0 }, { id: 'coin', chance: 0.1 }],
  snotling: [{ id: 'squig_meatball', chance: 0.8 }, { id: 'coin', chance: 0.2 }],
  ork_boy: [{ id: 'coin', chance: 1.0 }, { id: 'scrap_club', chance: 0.4 }],
  warboss: [],
  warp_imp: [{ id: 'blackstone', chance: 1.0 }],
  greater_demon: [{ id: 'coin_chest', chance: 1.0 }],
  expedition_trooper: [{ id: 'coin', chance: 1.0 }, { id: 'laser_rifle', chance: 0.4 }],
  enemy_astartes: [{ id: 'coin', chance: 1.0 }, { id: 'coin', chance: 1.0 }],
  imperial_flagship: [{ id: 'coin_chest', chance: 1.0 }],
  cultist: [{ id: 'corpse', chance: 1.0 }]
}

interface EnemyMovementState {
  state: 'burst' | 'pause'
  timer: number
  vx: number
  vy: number
  targetUid: number | null
}

interface FlagshipState {
  timer: number
  cycleCount: number
}

interface CultistPreachState {
  targetUid: number
  timer: number
  lastShownSec: number // batch18：飘字边沿触发用（原每帧判定打爆对象池）
}

interface PurifyState {
  stackId: number
  purifierUid: number
  cultistUid: number
  timer: number
}

interface ExpeditionTask {
  locationEntityUid: number
  explorerEntityUid: number
  secondExplorerUid?: number // batch19：双人对口副本的第 2 名探索者
  locationId: string
  progress: number
  totalTime: number
  x: number
  y: number
}

interface RiftSpawnState {
  lastMonth: number
}

/** batch14存档：战斗侧可持久化状态（战斗群/敌人移动AI/传教/裂隙计时/旗舰节拍不持久化，读档后自然重建） */
interface SerializedCombatState {
  corruptionLineTriggered: boolean
  corruptionCountdownMonths: number
  flagshipPending: boolean
  expeditions: Array<{ keyUid: number } & ExpeditionTask>
  purifyStates: PurifyState[]
}

export interface BattleGroup {
  id: number
  enemies: CardEntity[]
  friendlies: CardEntity[]
  cooldowns: Map<number, number>
  targets: Map<number, number>
}

/** 计算两张卡牌/堆叠之间的 AABB 真实物理边缘欧氏间距 */
export function getStackEdgeDistance(stA: Stack, stB: Stack): number {
  const aLeft = stA.x
  const aRight = stA.x + CARD_W
  const aTop = stA.y
  const aBottom = stA.y + stackVisualHeight(stA)

  const bLeft = stB.x
  const bRight = stB.x + CARD_W
  const bTop = stB.y
  const bBottom = stB.y + stackVisualHeight(stB)

  const dx = Math.max(0, aLeft - bRight, bLeft - aRight)
  const dy = Math.max(0, aTop - bBottom, bTop - aBottom)
  return Math.hypot(dx, dy)
}

export class CombatManager {
  private nextBattleId = 1
  private auraHealTimer = 0
  private battles: BattleGroup[] = []
  private enemyMovement = new Map<number, EnemyMovementState>()
  private flagshipStates = new Map<number, FlagshipState>()
  private cultistPreaching = new Map<number, CultistPreachState>()
  private purifyStates = new Map<number, PurifyState>()

  private carriedCardUids = new Set<number>()
  private disengageCooldowns = new Map<number, number>()
  private activeExpeditions = new Map<number, ExpeditionTask>()
  private riftStates = new Map<number, RiftSpawnState>()

  private corruptionLineTriggered = false
  public corruptionCountdownMonths = 0
  // batch16：旗舰推迟至下个星际年登陆（对话→叛变→翻年落地）
  private flagshipPending = false

  constructor(
    private board: Board,
    private floaters: Floater,
    private tweens: TweenManager,
    private delayedQueue: DelayedQueue,
    private onDefeatCheck: () => void,
    private onCorpseSpawned: (corpse: CardEntity) => void,
    private onChestSpawned: (chest: CardEntity) => void,
    private onVictory: (route: 'justice' | 'corruption', text: string) => void,
    private onCorruptionLineDialog: () => void
  ) {}

  public setCarriedCards(cards: CardEntity[], isCarried: boolean): void {
    for (const c of cards) {
      if (isCarried) {
        this.carriedCardUids.add(c.uid)
        this.disengage(c)
        this.interruptExpeditionByExplorer(c.uid)
      } else {
        this.carriedCardUids.delete(c.uid)
      }
    }
  }

  public tick(dt: number, currentMonth: number, corruption: number): void {
    if (corruption >= 100 && !this.corruptionLineTriggered) {
      this.triggerCorruptionLineStart(currentMonth)
    }

    this.updateCooldowns(dt)
    this.cleanDeadEntities()
    this.handleExpeditions(dt)
    this.handleRifts(currentMonth)
    this.handleEnemyAI(dt)
    this.handleFlagships(dt)
    this.handleCultists(dt)
    this.handlePurify(dt)
    this.handleAuras(dt)
    this.handleBattles(dt)
    this.checkCollisions()
  }

  private updateCooldowns(dt: number): void {
    for (const [uid, cd] of this.disengageCooldowns.entries()) {
      const next = cd - dt
      if (next <= 0) this.disengageCooldowns.delete(uid)
      else this.disengageCooldowns.set(uid, next)
    }
  }

  private triggerCorruptionLineStart(currentMonth: number): void {
    this.corruptionLineTriggered = true
    this.corruptionCountdownMonths = 1
    // batch54：大魔的馈赠——腐化触顶即赠两具尸体（常规尸体、挂尸变计时；corruptionLineTriggered 已持久化，一生一次）
    for (let i = 0; i < 2; i++) {
      const gx = clamp(BOARD_W / 2 + (i === 0 ? -CARD_W - 30 : 30), CONSOLE_X + 24, CONSOLE_X + CONSOLE_W - CARD_W - 24)
      const cs = this.board.spawnCard('corpse', gx, CONSOLE_Y + 340)
      if (cs.members[0]) this.onCorpseSpawned(cs.members[0])
    }
    this.floaters.show(BOARD_W / 2, CONSOLE_Y + 200, '🩸 亚空间大魔的馈赠：两具尸体（70 秒不处理将尸变）', '#c084fc', 24)
    // batch16：腐化触顶不再即时叛变——先弹 NPC 对话（税务官→修女），对话结束后由引擎回调 beginCorruptionPurge
    this.onCorruptionLineDialog?.()
  }

  /** batch16：对话结束回调——修女全体叛变为敌对修女；旗舰推迟到下个星际年登陆 */
  public beginCorruptionPurge(): void {
    for (const c of this.board.allCards()) {
      if (c.cardId === 'battle_sister') {
        const st = this.board.stackOf(c)
        if (st) {
          this.board.transformCard(c, 'enemy_battle_sister')
          this.floaters.show(st.x + CARD_W / 2, st.y - 12, '战斗修女信仰崩溃，堕落叛变！', '#ef4444', 18)
        }
      }
    }
    this.flagshipPending = true
    this.onDefeatCheck()
    this.floaters.show(BOARD_W / 2, 220, '⚠️ 修女已全体叛变！帝国远征军旗舰将于下个星际年登陆！', '#c084fc', 30)
  }

  /** batch16：翻年时引擎调用——旗舰登陆（一次） */
  public consumeFlagshipPending(): boolean {
    if (!this.flagshipPending) return false
    this.flagshipPending = false
    return true
  }

  public spawnImperialFlagshipPublic(): void {
    this.spawnImperialFlagship(true)
  }

  private spawnImperialFlagship(withGuards = true): void {
    this.corruptionCountdownMonths = 0
    // batch14修复：落点移入操作台内右上方（原 BOARD_W 边缘坐标在大世界扩板后已出界）；刷新节奏保持原版不变
    // batch58：落点移至操作台正中——360° 全向弧形战场，大军可全面围殴
    const spawnX = CONSOLE_X + CONSOLE_W / 2 - CARD_W / 2
    const spawnY = CONSOLE_Y + CONSOLE_H / 2 - CARD_H / 2
    this.board.spawnCard('imperial_flagship', spawnX, spawnY)
    // batch55：出场卫队——2 敌对阿斯塔特 + 2 远征军步兵；batch56：仅首次落地携带（读档补刷 false，防翻倍）
    if (withGuards) for (let i = 0; i < 2; i++) {
      this.board.spawnCard('enemy_astartes', clamp(spawnX - 60 + i * 200, 40, BOARD_W - CARD_W - 40), clamp(spawnY + CARD_H + 40, 200, BOARD_H - CARD_H - 20))
      this.board.spawnCard('expedition_trooper', clamp(spawnX + 60 + i * 200, 40, BOARD_W - CARD_W - 40), clamp(spawnY + CARD_H + 110, 200, BOARD_H - CARD_H - 20))
    }
    this.floaters.show(BOARD_W / 2, 220, '★ 帝国远征军旗舰已空降落地，击毁它以达成腐化线结局！', '#00f0ff', 28)
  }

  public tryStartRitual(beaconStack: Stack, riftStack: Stack, corruption: number): boolean {
    if (corruption >= 100) {
      this.floaters.show(beaconStack.x + CARD_W / 2, beaconStack.y - 12, '【腐化已失控，正义线信标无法激活！】', '#ef4444', 22)
      return false
    }

    const hasBeacon = beaconStack.members.some(m => m.cardId === 'rift_beacon')
    if (!hasBeacon) return false
    const batteries = beaconStack.members.filter(m => m.cardId === 'thermonuclear_battery')
    // batch52：电池不足时明示（此前静默 return false，玩家不知缺料）
    if (batteries.length < 5) {
      this.floaters.show(beaconStack.x + CARD_W / 2, beaconStack.y - 12, `仪式供能不足：需要热核电池 ×5（现有 ${batteries.length}）`, '#ffaa66', 18)
      return false
    }

    for (let i = 0; i < 5; i++) {
      const bat = beaconStack.members.find(m => m.cardId === 'thermonuclear_battery')
      if (bat) this.board.removeCard(bat)
    }
    const beaconEntity = beaconStack.members.find(m => m.cardId === 'rift_beacon')
    if (beaconEntity) this.board.removeCard(beaconEntity)

    this.board.mergeStacks(beaconStack, riftStack)
    riftStack.task = {
      recipe: {
        id: 'ritual_boss',
        name: '亚空间大魔降临仪式',
        baseTime: 60,
        inputs: {},
        outputs: {}
      },
      progress: 0,
      workers: 1
    }

    refreshStackView(riftStack)
    this.floaters.show(riftStack.x + CARD_W / 2, riftStack.y - 16, '★ 正义线召唤仪式已启动！', '#00f0ff', 26)
    return true
  }

  public completeRitualBoss(stack: Stack): void {
    const x = stack.x
    const y = stack.y
    stack.task = null
    refreshStackView(stack)

    this.board.spawnCard('greater_demon', x, y - 100)
    // batch55：大魔出场自带 2 只亚空间小恶魔侍从（物免，迫使你带修女/智库）
    this.board.spawnCard('warp_imp', clamp(x - CARD_W - 40, 40, BOARD_W - CARD_W - 40), clamp(y + 40, 200, BOARD_H - CARD_H - 20))
    this.board.spawnCard('warp_imp', clamp(x + CARD_W + 40, 40, BOARD_W - CARD_W - 40), clamp(y + 40, 200, BOARD_H - CARD_H - 20))
    this.floaters.show(BOARD_W / 2, 220, '★ 终局大魔【亚空间大魔】降临！击败它以完成正义结局！', '#ef4444', 32)
  }

  public tryStartExpedition(stack: Stack): boolean {
    // batch36：取消双人对口副本设计——四副本统一"地点卡 + 1 名探索者（任意成年单位均可进入）"
    const isLoc = (m: CardEntity) => m.cardId.startsWith('alien_forest') || m.cardId.startsWith('battlefield_planet') || m.cardId.startsWith('pirate_mothership') || m.cardId.startsWith('underhive_pipes') || m.cardId.startsWith('warp_rift')
    const locationCard = stack.members.find(m => isLoc(m))
    if (!locationCard) return false
    const units = stack.members.filter(m => getDef(m.cardId).isOurUnit)
    if (units.length !== 1) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, '远征：地点卡 + 1 名探索者（任意成年单位均可）', '#ef4444', 18)
      return false
    }
    const explorer = units[0]
    const totalTime = explorer.cardId === 'astartes' ? 40 : 60

    // 出征代价保留（一号裁定）：入场统一 -5 HP（最低留 1）；体力不支拒绝出征
    if ((explorer.hp ?? 1) <= EXPEDITION_HP_COST) {
      this.floaters.show(stack.x + CARD_W / 2, stack.y - 30, `${getDef(explorer.cardId).name} 体力不支（HP≤${EXPEDITION_HP_COST}），无法出征`, '#ef4444', 18)
      return false
    }
    explorer.hp = Math.max(1, explorer.hp - EXPEDITION_HP_COST)
    refreshCardBadge(explorer)
    this.floaters.show(stack.x + CARD_W / 2, stack.y - 12, `-${EXPEDITION_HP_COST} HP 出征代价`, '#fbbf24', 16)

    this.disengage(explorer)
    for (const b of this.battles) {
      for (const [eUid, tUid] of b.targets.entries()) {
        if (tUid === explorer.uid) {
          const newTarget = b.friendlies.find(f => f.uid !== explorer.uid)
          if (newTarget) b.targets.set(eUid, newTarget.uid)
          else b.targets.delete(eUid)
        }
      }
    }

    this.activeExpeditions.set(locationCard.uid, {
      locationEntityUid: locationCard.uid,
      explorerEntityUid: explorer.uid,
      secondExplorerUid: undefined,
      locationId: locationCard.cardId,
      progress: 0,
      totalTime,
      x: stack.x,
      y: stack.y
    })

    this.floaters.show(stack.x + CARD_W / 2, stack.y - 28, `开始远征: ${getDef(locationCard.cardId).name}`, '#00f0ff', 20)
    return true
  }

  private interruptExpeditionByExplorer(explorerUid: number): void {
    let targetLocUid: number | null = null
    for (const [locUid, exp] of this.activeExpeditions.entries()) {
      if (exp.explorerEntityUid === explorerUid || exp.secondExplorerUid === explorerUid) {
        targetLocUid = locUid
        break
      }
    }
    if (targetLocUid !== null) {
      const exp = this.activeExpeditions.get(targetLocUid)!
      this.activeExpeditions.delete(targetLocUid)
      const locCard = this.board.cards.get(exp.locationEntityUid)
      if (locCard) {
        const st = this.board.stackOf(locCard)
        if (st && st.members.length > 1) {
          this.board.grabAt(st, 1)
        }
        // C4：远征中断时清除视觉伪任务，避免锁环残留
        if (st) {
          st.task = null
          refreshStackView(st)
        }
      }
      this.floaters.show(exp.x + CARD_W / 2, exp.y - 12, '远征已被战术打断！', '#ef4444', 18)
    }
  }

  private handleExpeditions(dt: number): void {
    for (const [locUid, exp] of this.activeExpeditions.entries()) {
      const locCard = this.board.cards.get(exp.locationEntityUid)
      const expCard = this.board.cards.get(exp.explorerEntityUid)
      const expCard2 = exp.secondExplorerUid !== undefined ? this.board.cards.get(exp.secondExplorerUid) : undefined

      // batch19：双人副本——任一探索者死亡/失踪即清理（与单人口径一致）
      if (!locCard || !expCard || !this.board.stackOf(locCard) || (exp.secondExplorerUid !== undefined && !expCard2)) {
        // C4 补充：探索者死亡/失踪时清理视觉伪任务，防远征锁环永久残留
        if (locCard) {
          const staleStack = this.board.stackOf(locCard)
          if (staleStack && staleStack.task?.recipe.id === '__expedition__') {
            staleStack.task = null
            refreshStackView(staleStack)
          }
        }
        this.activeExpeditions.delete(locUid)
        continue
      }

      exp.progress += dt

      // C4 远征视觉伪任务：只渲染读条/锁环，不推进不结算（推进与结算在本函数；引擎 processTasks 对 __expedition__ 只刷新）
      const expStack = this.board.stackOf(locCard)
      if (expStack) {
        expStack.task = {
          recipe: { id: '__expedition__', name: '远征中', baseTime: 1, inputs: {}, outputs: {} },
          progress: exp.progress / exp.totalTime,
          workers: 0
        }
        refreshStackView(expStack)
      }

      if (exp.progress >= exp.totalTime) {
        this.completeExpedition(exp)
        this.activeExpeditions.delete(locUid)
      }
    }
  }

  private completeExpedition(exp: ExpeditionTask): void {
    const locCard = this.board.cards.get(exp.locationEntityUid)
    const expCard = this.board.cards.get(exp.explorerEntityUid)
    if (!locCard || !expCard) return

    const st = this.board.stackOf(locCard)
    const cx = st ? st.x : exp.x
    const cy = st ? st.y : exp.y

    // batch19：探索者按实体逐一弹回（地点卡留在原地）；随后清除视觉伪任务
    for (const uid of [exp.explorerEntityUid, exp.secondExplorerUid]) {
      if (uid === undefined) continue
      const c = this.board.cards.get(uid)
      if (!c) continue
      const cst = this.board.stackOf(c)
      if (cst) this.board.grabAt(cst, cst.members.indexOf(c))
    }
    // C4：远征中断/完成时清除视觉伪任务，避免锁环残留
    if (st) {
      st.task = null
      refreshStackView(st)
    }

    if (exp.locationId === 'alien_forest') {
      this.board.spawnCard('bitterroot', cx - 30, cy + 180)
      this.board.spawnCard('arken_berry', cx + 30, cy + 180)
      this.board.spawnCard('bitterroot', cx - 60, cy + 200)
      if (Math.random() < 0.2) this.board.spawnCard('underhive_pipes', cx, cy + 200)
      if (Math.random() < 0.15) this.board.spawnCard('grox', cx + 60, cy + 180)

      if (Math.random() < 0.5) {
        const enemies = ['space_pirate', 'snotling', 'corpse_mutant']
        this.board.spawnCard(enemies[Math.floor(Math.random() * enemies.length)], cx, cy - 100)
        this.floaters.show(cx + CARD_W / 2, cy - 12, '远征遭遇敌袭！', '#ef4444', 22)
      }
    } else if (exp.locationId === 'battlefield_planet') {
      this.board.spawnCard('rubble_pile', cx - 30, cy + 180)
      this.board.spawnCard('scrap_heap', cx + 30, cy + 180)
      this.board.spawnCard('stone', cx, cy + 180)
      if (Math.random() < 0.2) this.board.spawnCard('underhive_pipes', cx, cy + 200)

      if (Math.random() < 0.5) {
        this.board.spawnCard('space_pirate', cx, cy - 100)
        this.floaters.show(cx + CARD_W / 2, cy - 12, '远征遭遇游荡海盗！', '#ef4444', 22)
      }
    } else if (exp.locationId === 'pirate_mothership') {
      this.board.spawnCard('coin', cx - 40, cy + 180)
      this.board.spawnCard('refined_metal', cx, cy + 180)
      this.board.spawnCard('circuit', cx + 40, cy + 180)
      if (Math.random() < 0.1) this.board.spawnCard('gene_seed', cx, cy + 200)
      if (Math.random() < 0.05) this.board.spawnCard('civilian', cx + 30, cy + 200)

      // batch19：伏击概率挂 tuner（默认 100% = 原必出语义，可调低）
      if (Math.random() < 1) {
        this.board.spawnCard('ork_boy', cx, cy - 100)
        this.floaters.show(cx + CARD_W / 2, cy - 12, '海盗母舰警报：遭遇伏击！', '#ef4444', 22)
      }
    } else if (exp.locationId === 'underhive_pipes') {
      this.board.spawnCard('parts', cx - 30, cy + 180)
      this.board.spawnCard('blackstone', cx + 30, cy + 180)
      if (Math.random() < 0.25) this.board.spawnCard('warp_rift', cx, cy + 200)

      if (Math.random() < 0.5) {
        this.board.spawnCard('corpse_mutant', cx, cy - 100)
        this.floaters.show(cx + CARD_W / 2, cy - 12, '管道网深处：遭遇尸变体！', '#ef4444', 22)
      }
    }

    this.floaters.show(cx + CARD_W / 2, cy - 12, '远征胜利归来！', '#22c55e', 24)
  }

  private handleRifts(currentMonth: number): void {
    const rifts = this.board.allCards().filter(c => c.cardId === 'warp_rift')
    for (const rift of rifts) {
      let state = this.riftStates.get(rift.uid)
      if (!state) {
        state = { lastMonth: currentMonth }
        this.riftStates.set(rift.uid, state)
      }

      if (currentMonth - state.lastMonth >= 3) {
        state.lastMonth = currentMonth
        const st = this.board.stackOf(rift)
        const rx = st ? st.x : 960
        const ry = st ? st.y : 400

        const spawnId = Math.random() < 0.5 ? 'warp_imp' : (['ork_boy', 'enemy_astartes', 'warboss'][Math.floor(Math.random() * 3)])
        const sx = clamp(rx + (Math.random() - 0.5) * 140, 40, BOARD_W - CARD_W - 40)
        const sy = clamp(ry + CARD_H + 20, 200, BOARD_H - CARD_H - 20)

        this.board.spawnCard(spawnId, sx, sy)
        this.floaters.show(rx + CARD_W / 2, ry - 16, `★ 亚空间裂隙吐出: ${getDef(spawnId).name}!`, '#c084fc', 22)
      }
    }
  }

  /** batch65：裂隙刷怪倒计时进度（0..1，月级节拍换算秒）——供引擎绘制红色倒计时条 */
  public getRiftProgressList(currentMonth: number, monthElapsedSec: number): Array<{ uid: number; progress: number }> {
    const out: Array<{ uid: number; progress: number }> = []
    for (const rift of this.board.allCards()) {
      if (rift.cardId !== 'warp_rift') continue
      const state = this.riftStates.get(rift.uid)
      const lastMonth = state ? state.lastMonth : currentMonth
      const elapsed = (currentMonth - lastMonth) * MONTH_SECONDS + monthElapsedSec
      out.push({ uid: rift.uid, progress: clamp(elapsed / (RIFT_SPAWN_MONTHS * MONTH_SECONDS), 0, 1) })
    }
    return out
  }

  /** 玩家手操主动将我方卡牌拖到敌方头上交战：享受 0.1s 先手突袭出招特权 */
  public registerManualEngage(friendlyStack: Stack, enemyStack: Stack): void {
    const friendlies = friendlyStack.members.filter(m => getDef(m.cardId).isOurUnit)
    const enemies = enemyStack.members.filter(m => getDef(m.cardId).category === 'enemy')
    if (friendlies.length === 0 || enemies.length === 0) return
    // batch39：交锋安置——我方弧形落位（不堆叠）
    this.arrangeEngage(friendlyStack, enemyStack)

    let battle = this.findBattleWith(enemies[0])
    if (!battle) {
      battle = {
        id: this.nextBattleId++,
        enemies: [...enemies],
        friendlies: [...friendlies],
        cooldowns: new Map(),
        targets: new Map()
      }
      this.battles.push(battle)
    } else {
      for (const f of friendlies) {
        if (!battle.friendlies.includes(f)) battle.friendlies.push(f)
      }
    }

    for (const f of friendlies) {
      battle.cooldowns.set(f.uid, 0.1) // 手操先手突袭极速出招
      this.disengageCooldowns.delete(f.uid)
      battle.targets.set(f.uid, enemies[0].uid)
    }
    // batch18：被先手的敌人 100% 立即还击一刀（0 延时真实结算一次攻击），再进入正常攻速节奏——
    // 杜绝堆平民 0.1s 齐射把敌阿秒掉、敌人满额冷却还不出刀的无伤白嫖
    for (const e of enemies) {
      const def = getDef(e.cardId)
      if (def.id !== 'imperial_flagship' && def.id !== 'cultist') {
        const counterTarget = friendlies[Math.floor(Math.random() * friendlies.length)]
        if (counterTarget) this.executeAttack(e, counterTarget)
      }
      battle.cooldowns.set(e.uid, def.attackInterval ?? 2.0)
    }

    this.floaters.show(enemyStack.x + CARD_W / 2, enemyStack.y - 14, '★ 先手突袭！', '#00f0ff', 20)
  }

  /**
   * 敌人靠近自动接敌触发：
   * 堆叠内所有我方单位自动全体入战，敌人短延时起手出招，友方立刻自动锁定并实施自卫反击
   */
  private triggerAutoEngage(enemyEntity: CardEntity, friendlyStack: Stack): void {
    const friendlies = friendlyStack.members.filter(m => getDef(m.cardId).isOurUnit)
    if (friendlies.length === 0) return
    // batch39：交锋安置——敌方弧形落位（不堆叠）
    const eStack = this.board.stackOf(enemyEntity)
    if (eStack) this.arrangeEngage(eStack, friendlyStack)

    // 如果所有友方都在脱战冷却中，暂不打断
    if (friendlies.every(f => this.disengageCooldowns.has(f.uid))) return

    let battle = this.findBattleWith(enemyEntity)
    if (!battle) {
      battle = {
        id: this.nextBattleId++,
        enemies: [enemyEntity],
        friendlies: [...friendlies],
        cooldowns: new Map(),
        targets: new Map()
      }
      this.battles.push(battle)
    } else {
      for (const f of friendlies) {
        if (!battle.friendlies.includes(f)) battle.friendlies.push(f)
      }
    }

    const eDef = getDef(enemyEntity.cardId)
    // 敌人近身起手：0.3 秒短挥刀延时直接攻击，绝不在脸上傻等满额冷却
    if (!battle.cooldowns.has(enemyEntity.uid)) {
      battle.cooldowns.set(enemyEntity.uid, 0.3)
    }

    // 我方全体自卫反击机制：立刻锁定敌人，按自身武器与攻速自动回击
    for (const f of friendlies) {
      this.disengageCooldowns.delete(f.uid)
      battle.targets.set(f.uid, enemyEntity.uid)
      if (!battle.cooldowns.has(f.uid)) {
        const fDef = getDef(f.cardId)
        // 友方自卫反击起手：0.4 秒即刻回击
        battle.cooldowns.set(f.uid, Math.min(0.4, (fDef.attackInterval ?? 2.0) * 0.5))
      }
    }
  }

  public disengage(card: CardEntity): void {
    this.disengageCooldowns.set(card.uid, DISENGAGE_COOLDOWN)
    for (const b of this.battles) {
      const idx = b.friendlies.findIndex(f => f.uid === card.uid)
      if (idx >= 0) {
        b.friendlies.splice(idx, 1)
        b.cooldowns.delete(card.uid)
        b.targets.delete(card.uid)
      }
    }
  }

  /** batch56：战斗弧形展开——整堆我方单位拖入交战时自动拆成单卡、以敌人为中心弧形铺开再逐张入战。
   * 战斗成员本就按卡计（群殴/集火/光环/脱战/拖拽离场原生兼容）；混装装备/资源的堆走原 registerManualEngage 不拆。 */
  public engageSpread(friendlyStack: Stack, enemyStack: Stack): void {
    const allOur = friendlyStack.members.length > 0 && friendlyStack.members.every(m => getDef(m.cardId).isOurUnit)
    if (!allOur) {
      this.registerManualEngage(friendlyStack, enemyStack)
      return
    }
    const singles: Stack[] = []
    let host = friendlyStack
    while (host.members.length > 1) {
      singles.unshift(this.board.grabAt(host, host.members.length - 1))
    }
    singles.unshift(host)
    for (const st of singles) {
      this.arrangeEngage(st, enemyStack)
      this.registerManualEngage(st, enemyStack)
    }
  }

  /** batch39：交锋弧形安置——以 center 为圆心、ENGAGE_RING_RADIUS 环上取空闲扇区落位（12扇区扫描避障+操作台边界钳制，兜底右侧相邻）；敌我均不堆叠 */
  private arrangeEngage(mover: Stack, center: Stack): void {
    const occupied = [...this.board.stacks.values()].filter(s => s !== mover && s.members.length > 0)
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2
      const cx = center.x + CARD_W / 2 + Math.cos(ang) * ENGAGE_RING_RADIUS - CARD_W / 2
      const cy = center.y + CARD_H / 2 + Math.sin(ang) * ENGAGE_RING_RADIUS - CARD_H / 2
      const bx = clamp(cx, CONSOLE_X + 24, CONSOLE_X + CONSOLE_W - CARD_W - 24)
      const by = clamp(cy, CONSOLE_Y + CONSOLE_TOP_ZONE, CONSOLE_Y + CONSOLE_H - CARD_H - 24)
      const blocked = occupied.some(o => Math.abs(o.x - bx) < CARD_W * 0.7 && Math.abs(o.y - by) < CARD_H * 0.6)
      if (!blocked) {
        this.board.placeStack(mover, bx, by)
        return
      }
    }
    // batch40：扇区全满时兜底同样走防重叠（兵海围殴不再挤同一坐标）
    const fb = this.board.findNonOverlappingPosition(mover, center.x + CARD_W + 24, center.y)
    this.board.placeStack(mover, fb.x, fb.y)
  }

  /** batch39：交战区域圈数据源——每个战斗群取参与者位置的最大包围圆+余量，供引擎 fxLayer 绘制 */
  public getBattleZones(): Array<{ x: number; y: number; r: number }> {
    const zones: Array<{ x: number; y: number; r: number }> = []
    for (const b of this.battles) {
      const pts: Array<{ x: number; y: number }> = []
      for (const c of [...b.enemies, ...b.friendlies]) {
        const st = this.board.stackOf(c)
        if (st) pts.push({ x: st.x + CARD_W / 2, y: st.y + CARD_H / 2 })
      }
      if (pts.length < 2) continue
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
      let r = 0
      for (const p of pts) r = Math.max(r, Math.hypot(p.x - cx, p.y - cy))
      zones.push({ x: cx, y: cy, r: r + ZONE_PAD })
    }
    return zones
  }

  /** batch38：智库治疗光环——每 3 秒治疗半径内友军（含自己）1HP；满血跳过；同 tick 每人限回一次（双智库不叠加） */
  private handleAuras(dt: number): void {
    this.auraHealTimer += dt
    if (this.auraHealTimer < LIBRARIAN_AURA_INTERVAL) return
    this.auraHealTimer = 0
    const librarians = this.board.allCards().filter(c => c.cardId === 'private_librarian' && this.board.stackOf(c))
    if (librarians.length === 0) return
    const healed = new Set<number>()
    for (const lib of librarians) {
      const ls = this.board.stackOf(lib)
      if (!ls) continue
      for (const ally of this.board.allCards()) {
        if (healed.has(ally.uid)) continue
        const def = getDef(ally.cardId)
        if (!def.isOurUnit || ally.maxHp <= 0 || ally.hp >= ally.maxHp) continue
        const as = this.board.stackOf(ally)
        if (!as) continue
        if (Math.hypot(as.x - ls.x, as.y - ls.y) > LIBRARIAN_AURA_RADIUS) continue
        ally.hp = Math.min(ally.maxHp, ally.hp + LIBRARIAN_AURA_HEAL)
        healed.add(ally.uid)
        refreshCardBadge(ally)
        this.floaters.show(as.x + CARD_W / 2, as.y - 12, `+${LIBRARIAN_AURA_HEAL} HP 智库光环`, '#4ade80', 14)
      }
    }
  }

  /** batch38：刺客暴击光环判定（250px，含刺客自己；多刺客不叠加，固定 15%） */
  private isInAssassinAura(st: Stack): boolean {
    for (const c of this.board.allCards()) {
      if (c.cardId !== 'private_assassin') continue
      const as = this.board.stackOf(c)
      if (as && Math.hypot(as.x - st.x, as.y - st.y) <= ASSASSIN_AURA_RADIUS) return true
    }
    return false
  }

  private handleBattles(dt: number): void {
    for (let i = this.battles.length - 1; i >= 0; i--) {
      const b = this.battles[i]
      if (b.enemies.length === 0 || b.friendlies.length === 0) {
        this.battles.splice(i, 1)
        continue
      }

      // 双阈值磁滞检测：仅当边缘距离拉开 >= 120px 时才脱离战斗
      for (let fi = b.friendlies.length - 1; fi >= 0; fi--) {
        const friendly = b.friendlies[fi]
        const fStack = this.board.stackOf(friendly)

        if (!fStack || this.carriedCardUids.has(friendly.uid)) {
          b.friendlies.splice(fi, 1)
          b.cooldowns.delete(friendly.uid)
          continue
        }

        let nearestEdgeDist = Infinity
        for (const enemy of b.enemies) {
          const eStack = this.board.stackOf(enemy)
          if (eStack) {
            const d = getStackEdgeDistance(fStack, eStack)
            if (d < nearestEdgeDist) nearestEdgeDist = d
          }
        }

        if (nearestEdgeDist >= DISENGAGE_EDGE_DIST) {
          b.friendlies.splice(fi, 1)
          b.cooldowns.delete(friendly.uid)
          this.disengageCooldowns.set(friendly.uid, DISENGAGE_COOLDOWN)
          this.floaters.show(fStack.x + CARD_W / 2, fStack.y - 12, '脱离交战', '#38bdf8', 18)
        }
      }

      if (b.friendlies.length === 0) {
        this.battles.splice(i, 1)
        continue
      }

      // 1. 我方单位自动反击出招处理
      for (const friendly of [...b.friendlies]) {
        if (!this.board.cards.has(friendly.uid) || this.carriedCardUids.has(friendly.uid)) continue
        let cd = (b.cooldowns.get(friendly.uid) ?? 1.0) - dt
        if (cd <= 0) {
          const validEnemies = b.enemies.filter(e => this.board.cards.has(e.uid) && this.board.stackOf(e) !== null)
          if (validEnemies.length > 0) {
            let targetUid = b.targets.get(friendly.uid)
            let target = validEnemies.find(e => e.uid === targetUid)
            if (!target) {
              target = validEnemies[Math.floor(Math.random() * validEnemies.length)]
              if (target) b.targets.set(friendly.uid, target.uid)
            }

            if (target) {
              this.executeAttack(friendly, target)
              const def = getDef(friendly.cardId)
              cd = def.attackInterval ?? 2.0
            }
          }
        }
        b.cooldowns.set(friendly.uid, cd)
      }

      // 2. 敌方单位主动出招处理
      for (const enemy of [...b.enemies]) {
        if (!this.board.cards.has(enemy.uid)) continue
        const eDef = getDef(enemy.cardId)
        if (eDef.id === 'imperial_flagship' || eDef.id === 'cultist') continue

        let cd = (b.cooldowns.get(enemy.uid) ?? 2.0) - dt
        if (cd <= 0) {
          const validFriendlies = b.friendlies.filter(f => this.board.cards.has(f.uid) && !this.carriedCardUids.has(f.uid) && this.board.stackOf(f) !== null)
          if (validFriendlies.length > 0) {
            let targetUid = b.targets.get(enemy.uid)
            let target = validFriendlies.find(f => f.uid === targetUid)
            if (!target) {
              target = validFriendlies[Math.floor(Math.random() * validFriendlies.length)]
              if (target) b.targets.set(enemy.uid, target.uid)
            }

            if (target) {
              this.executeAttack(enemy, target)
              cd = eDef.attackInterval ?? 2.0
            }
          }
        }
        b.cooldowns.set(enemy.uid, cd)
      }
    }
  }

  /** 执行伤害结算：攻击力读取穿戴装备后的实时属性（含 scrap_club 物理攻击 +1） */
  private executeAttack(attacker: CardEntity, defender: CardEntity): void {
    if (this.carriedCardUids.has(defender.uid) || this.carriedCardUids.has(attacker.uid)) return
    if (!this.board.cards.has(defender.uid) || !this.board.cards.has(attacker.uid)) return
    const defStack = this.board.stackOf(defender)
    if (!defStack) return

    const aDef = getDef(attacker.cardId)
    const dDef = getDef(defender.cardId)

    const stats = getEffectiveStats(attacker)
    const finalDmgBase = stats.attack
    const dmgType = aDef.damageType ?? 'physical'
    let finalDmg = finalDmgBase

    if (dmgType === 'physical' && dDef.isPhysicalImmune) {
      finalDmg = 0
    } else if (dmgType === 'magic' && dDef.isMagicImmune) {
      finalDmg = 0
    }

    const posX = defStack.x + CARD_W / 2
    const posY = defStack.y + CARD_H / 2

    // batch39：撞击动画——攻击方卡牌朝目标猛扑 LUNGE_DIST 后弹回原位（补间目标取实时堆坐标，防中途中断错位）
    const aStack = this.board.stackOf(attacker)
    const aRoot = aStack && aStack.members[0] ? aStack.members[0].view : null
    if (aRoot && !aRoot.destroyed && aRoot.position) {
      const dx = defStack.x - (aStack ? aStack.x : aRoot.x)
      const dy = defStack.y - (aStack ? aStack.y : aRoot.y)
      const len = Math.hypot(dx, dy) || 1
      const stRef = aStack
      this.tweens.to(aRoot.position, {
        x: aRoot.x + (dx / len) * LUNGE_DIST,
        y: aRoot.y + (dy / len) * LUNGE_DIST
      }, 0.12, Easings.easeOutQuad, () => {
        if (!aRoot.destroyed && aRoot.position && stRef) {
          this.tweens.to(aRoot.position, { x: stRef.x, y: stRef.y }, 0.2, Easings.hydraulicSettle)
        }
      })
    }

    if (finalDmg === 0) {
      this.floaters.show(posX, posY - 20, '免疫', '#9ca3af', 18)
    } else {
      // batch38：刺客暴击光环——我方攻击者在刺客半径内 → 15% 概率双倍伤害
      if (aDef.isOurUnit) {
        const aStack = this.board.stackOf(attacker)
        if (aStack && this.isInAssassinAura(aStack) && Math.random() < ASSASSIN_CRIT_CHANCE) {
          finalDmg *= ASSASSIN_CRIT_MULT
          this.floaters.show(posX, posY - 42, `★ 暴击 -${finalDmg}`, '#f43f5e', 24)
        }
      }
      const currentHp = defender.hp ?? dDef.hp ?? 10
      const nextHp = Math.max(0, currentHp - finalDmg)
      defender.hp = nextHp

      const color = dDef.isOurUnit ? '#ef4444' : '#facc15'
      this.floaters.show(posX, posY - 20, `-${finalDmg}`, color, 22)

      if (nextHp <= 0) {
        this.handleEntityDeath(defender)
      } else {
        this.shakeCard(defender)
        refreshStackView(defStack)
      }
    }
  }

  private shakeCard(card: CardEntity): void {
    if (!card.view || card.view.destroyed) return
    const rv = card.view
    const ox = rv.x
    // batch39：受击震动加强（4→7px）
    this.tweens.to(rv, { x: ox - 7 }, 0.05, Easings.linear, () => {
      if (card.view && !card.view.destroyed) {
        this.tweens.to(rv, { x: ox + 7 }, 0.05, Easings.linear, () => {
          if (card.view && !card.view.destroyed) {
            this.tweens.to(rv, { x: ox }, 0.05, Easings.linear)
          }
        })
      }
    })
  }

  /** 死亡结算：全损销毁装备，我方阵亡或邪教徒阵亡均触发战局与败北判定 */
  private handleEntityDeath(victim: CardEntity): void {
    const d = getDef(victim.cardId)
    const st = this.board.stackOf(victim)
    const x = st ? st.x : 960
    const y = st ? st.y : 540

    for (const b of this.battles) {
      b.enemies = b.enemies.filter(e => e.uid !== victim.uid)
      b.friendlies = b.friendlies.filter(f => f.uid !== victim.uid)
      b.cooldowns.delete(victim.uid)
      b.targets.delete(victim.uid)
    }

    if (d.category === 'enemy') {
      this.board.removeCard(victim)
      this.enemyMovement.delete(victim.uid)
      this.flagshipStates.delete(victim.uid)
      this.cultistPreaching.delete(victim.uid)

      const loots = ENEMY_LOOT_TABLE[victim.cardId] || [{ id: 'coin', chance: 1.0 }]
      // A2：统一掉落出口——独立 roll 每条可同出；尸体挂尸变；金币箱预存 100 枚
      const dropLoot = (lootId: string) => {
        const tx = clamp(x + (Math.random() - 0.5) * 60, 40, BOARD_W - CARD_W - 40)
        const ty = clamp(y + (Math.random() - 0.5) * 60, 200, BOARD_H - CARD_H - 20)
        const spawnedStack = this.board.spawnCard(lootId, tx, ty)
        if (spawnedStack.members.length === 0) return
        // B4 修复：掉落尸体同样挂尸变计时器（被杀死的尸变体/邪教徒掉尸→周期性重复尸变）
        if (lootId === 'corpse') {
          this.onCorpseSpawned(spawnedStack.members[0])
        }
        // A2：金币箱掉落即预装 100 枚（引擎回调写入存量与角标）
        if (lootId === 'coin_chest') {
          this.onChestSpawned(spawnedStack.members[0])
        }
      }
      for (const loot of loots) {
        if (Math.random() <= loot.chance) {
          dropLoot(loot.id)
        }
      }
      // A2 排他特判：军阀=四建材随机其一 + 20%额外处刑大剑；敌阿=10%动力甲或基因种子二选一（不走独立 roll）
      if (victim.cardId === 'warboss') {
        dropLoot(['refined_metal', 'high_alloy', 'plate', 'prefab'][Math.floor(Math.random() * 4)])
        if (Math.random() < 0.2) dropLoot('execution_blade')
      } else if (victim.cardId === 'enemy_astartes') {
        if (Math.random() < 0.1) dropLoot(Math.random() < 0.5 ? 'power_armor' : 'gene_seed')
      }
      // batch16 绿皮分裂：军阀→3小子、小子→3鼻涕怪（鼻涕怪终止）；分裂体尸体附近散开、出生即正常敌人AI
      if (victim.cardId === 'warboss') {
        for (let i = 0; i < GREEN_SPLIT_COUNT; i++) this.spawnSplit('ork_boy', x, y)
        this.floaters.show(x + CARD_W / 2, y - 16, '★ 军阀裂解：绿皮小子蜂拥而出！', '#4ade80', 20)
      } else if (victim.cardId === 'ork_boy') {
        for (let i = 0; i < GREEN_SPLIT_COUNT; i++) this.spawnSplit('snotling', x, y)
        this.floaters.show(x + CARD_W / 2, y - 16, '★ 小子裂解：鼻涕怪四溅！', '#4ade80', 18)
      }
      this.floaters.show(x + CARD_W / 2, y, `消灭 ${d.name}!`, '#22c55e', 22)

      // 严谨修复：邪教徒虽为 enemy 类别，但具有 isOurUnit: true，阵亡必须触发全局败北复查
      if (victim.cardId === 'cultist') {
        this.onDefeatCheck()
      }

      if (victim.cardId === 'greater_demon') {
        this.onVictory('justice', '【正义线达成：亚空间大魔已被放逐，巴达布前哨在忠诚中存续】')
        return
      }

      if (victim.cardId === 'imperial_flagship') {
        this.onVictory('corruption', '【腐化线达成：帝国远征军已被击退，前哨以独立之名存续】')
        return
      }
      return
    }

    if (d.isOurUnit) {
      victim.equippedGears = []
      // batch24：阿斯塔特死亡直接产出独立卡"阿斯塔特尸体"（originUnit 标记机制退役，仅邪教徒转化保留）
      const isAstartes = victim.cardId === 'astartes'
      this.board.removeCard(victim)
      const corpseStack = this.board.spawnCard(isAstartes ? 'astartes_corpse' : 'corpse', x, y)
      this.floaters.show(x + CARD_W / 2, y, `${d.name} 战死牺牲`, '#ef4444', 22)
      if (corpseStack.members.length > 0) {
        if (!isAstartes) corpseStack.members[0].originUnit = victim.cardId
        if (isAstartes) {
          this.floaters.show(x + CARD_W / 2, y + 20, '★ 阿斯塔特遗体：种子封存其中', '#38bdf8', 16)
        }
        this.onCorpseSpawned(corpseStack.members[0])
      }
      this.onDefeatCheck()
    }
  }

  /** batch16：绿皮分裂体出生（尸体附近 ±70px 自动散开，防重叠由后续 AI/拖放体系自然消化） */
  private spawnSplit(cardId: string, x: number, y: number): void {
    const sx = clamp(x + (Math.random() - 0.5) * 140, 40, BOARD_W - CARD_W - 40)
    const sy = clamp(y + (Math.random() - 0.5) * 140, 200, BOARD_H - CARD_H - 20)
    this.board.spawnCard(cardId, sx, sy)
  }

  private handleEnemyAI(dt: number): void {
    const enemyStacks = [...this.board.stacks.values()].filter(st => {
      const root = st.members[0]
      return root && getDef(root.cardId).category === 'enemy'
    })

    for (const st of enemyStacks) {
      const root = st.members[0]
      const def = getDef(root.cardId)

      if (root.cardId === 'imperial_flagship' || this.isInBattle(root)) continue

      let ai = this.enemyMovement.get(root.uid)
      if (!ai) {
        ai = { state: 'pause', timer: ENEMY_PAUSE, vx: 0, vy: 0, targetUid: null }
        this.enemyMovement.set(root.uid, ai)
      }

      ai.timer -= dt

      if (ai.state === 'burst') {
        const nx = clamp(st.x + ai.vx * ENEMY_SPEED * dt, 40, BOARD_W - CARD_W - 40)
        const ny = clamp(st.y + ai.vy * ENEMY_SPEED * dt, 200, BOARD_H - CARD_H - 20)
        this.board.placeStack(st, nx, ny)

        if (ai.timer <= 0) {
          ai.state = 'pause'
          ai.timer = ENEMY_PAUSE
          ai.vx = 0
          ai.vy = 0
        }
      } else {
        if (ai.timer <= 0) {
          ai.state = 'burst'
          ai.timer = ENEMY_BURST
          this.decideEnemyDirection(st, root, def, ai)
        }
      }
    }
  }

  private decideEnemyDirection(st: Stack, root: CardEntity, def: CardDef, ai: EnemyMovementState): void {
    let targetStack: Stack | null = null

    // 绿皮保留原有专属近视眼索敌（250px 视野，且跳过同类与建筑）
    if (def.id === 'snotling' || def.id === 'ork_boy' || def.id === 'warboss') {
      targetStack = this.findNearestTarget(st, AGGRO_GREENSKIN, (otherDef, stack) => {
        const first = stack.members[0]
        if (this.disengageCooldowns.has(first.uid) || this.carriedCardUids.has(first.uid)) return false
        // batch16：绿皮寻敌单独剔除家畜（格罗克斯兽）
        return otherDef.id !== 'snotling' && otherDef.id !== 'ork_boy' && otherDef.id !== 'warboss' && otherDef.id !== 'grox' && otherDef.category !== 'building'
      })
    } else if (def.id !== 'cultist') {
      // 普通敌人索敌全图包含我方单位的堆叠（即使工人在建筑内也索敌锁定）
      targetStack = this.findNearestTarget(st, Infinity, (otherDef, stack) => {
        const hasOur = stack.members.some(m => getDef(m.cardId).isOurUnit)
        if (!hasOur) return false
        const first = stack.members[0]
        if (this.disengageCooldowns.has(first.uid) || this.carriedCardUids.has(first.uid)) return false
        return true
      })
    }

    if (targetStack) {
      const dx = targetStack.x - st.x
      const dy = targetStack.y - st.y
      const dist = Math.hypot(dx, dy)
      if (dist > 1) {
        ai.vx = dx / dist
        ai.vy = dy / dist
      }
    } else {
      const angle = Math.random() * Math.PI * 2
      ai.vx = Math.cos(angle)
      ai.vy = Math.sin(angle)
    }
  }

  private findNearestTarget(origin: Stack, maxDist: number, filter: (def: CardDef, stack: Stack) => boolean): Stack | null {
    let best: Stack | null = null
    let minDist = maxDist
    for (const other of this.board.stacks.values()) {
      if (other.id === origin.id) continue
      const first = other.members[0]
      if (!first) continue
      const d = getDef(first.cardId)
      if (filter(d, other)) {
        const dist = Math.hypot(other.x - origin.x, other.y - origin.y)
        if (dist < minDist) {
          minDist = dist
          best = other
        }
      }
    }
    return best
  }

  private handleFlagships(dt: number): void {
    const flagships = this.board.allCards().filter(c => c.cardId === 'imperial_flagship')
    for (const fs of flagships) {
      let state = this.flagshipStates.get(fs.uid)
      if (!state) {
        state = { timer: FLAGSHIP_SUMMON_INTERVAL, cycleCount: 0 }
        this.flagshipStates.set(fs.uid, state)
      }

      state.timer -= dt
      if (state.timer <= 0) {
        state.timer = FLAGSHIP_SUMMON_INTERVAL
        const st = this.board.stackOf(fs)
        const fx = st ? st.x : 960
        const fy = st ? st.y : 300

        if (state.cycleCount < FLAGSHIP_SUMMON_CYCLE) {
          state.cycleCount++
          // batch55：8 秒循环刷——敌对战斗修女 ×1 + 远征军步兵 ×1（成对空降）
          const sx1 = clamp(fx + (Math.random() - 0.5) * 160, 40, BOARD_W - CARD_W - 40)
          const sy1 = clamp(fy + CARD_H + 30, 200, BOARD_H - CARD_H - 20)
          this.board.spawnCard('enemy_battle_sister', sx1, sy1)
          this.board.spawnCard('expedition_trooper', clamp(sx1 + CARD_W + 30, 40, BOARD_W - CARD_W - 40), sy1)
          this.floaters.show(fx + CARD_W / 2, fy - 16, '空降增援: 敌对修女 + 远征军步兵!', '#ef4444', 20)
        } else {
          state.cycleCount = 0
          const maxHp = getDef('imperial_flagship').hp ?? 120
          fs.hp = Math.min(maxHp, (fs.hp ?? maxHp) + FLAGSHIP_HEAL)
          // batch65：自愈同步刷新角标（同族漏刷修复）
          refreshCardBadge(fs)
          this.floaters.show(fx + CARD_W / 2, fy - 16, `+${FLAGSHIP_HEAL} 旗舰自愈`, '#4ade80', 22)
        }
      }
    }
  }

  /** C1：净化计时推进——到时校验两卡仍同堆，邪教徒 transform 回 originUnit（装备/特质天然保留），净化者不消耗 */
  private handlePurify(dt: number): void {
    for (const [stackId, ps] of this.purifyStates.entries()) {
      const st = this.board.stacks.get(stackId)
      const purifier = this.board.cards.get(ps.purifierUid)
      const cultist = this.board.cards.get(ps.cultistUid)
      const stillTogether = !!st && !!purifier && !!cultist &&
        st.members.includes(purifier) && st.members.includes(cultist) && cultist.cardId === 'cultist'
      if (!stillTogether) {
        this.purifyStates.delete(stackId)
        if (st) this.floaters.show(st.x + CARD_W / 2, st.y - 12, '净化中断', '#94a3b8', 16)
        continue
      }
      ps.timer += dt
      if (ps.timer >= PURIFY_TIME) {
        this.purifyStates.delete(stackId)
        this.board.transformCard(cultist, cultist.originUnit ?? 'civilian')
        this.floaters.show(st.x + CARD_W / 2, st.y - 14, '★ 净化成功！异端重获新生', '#4ade80', 22)
      }
    }
  }

  /** C1：净化匝道入口——净化者并入邪教徒堆并开始计时 */
  public startPurify(purifier: CardEntity, cultistStack: Stack): void {
    const cultist = cultistStack.members.find(m => m.cardId === 'cultist')
    if (!cultist) return
    const purifierStack = this.board.stackOf(purifier)
    if (!purifierStack) return
    this.board.mergeStacks(purifierStack, cultistStack)
    this.purifyStates.set(cultistStack.id, {
      stackId: cultistStack.id,
      purifierUid: purifier.uid,
      cultistUid: cultist.uid,
      timer: 0
    })
    this.floaters.show(cultistStack.x + CARD_W / 2, cultistStack.y - 14, `净化开始 (${PURIFY_TIME}秒)`, '#38bdf8', 20)
  }

  private handleCultists(dt: number): void {
    const cultists = this.board.allCards().filter(c => c.cardId === 'cultist')
    for (const cultist of cultists) {
      let preach = this.cultistPreaching.get(cultist.uid)

      if (!preach) {
        const cStack = this.board.stackOf(cultist)
        if (!cStack) continue
        // 扩展传教名单：包含平民、太空辅助军与私人刺客（修女、智库、阿斯塔特免疫传教）
        const victimStack = this.findNearestTarget(cStack, Infinity, (d) => d.id === 'civilian' || d.id === 'auxilia' || d.id === 'private_assassin')
        if (victimStack && victimStack.members[0]) {
          preach = { targetUid: victimStack.members[0].uid, timer: 0, lastShownSec: -1 }
          this.cultistPreaching.set(cultist.uid, preach)
        }
      } else {
        const victim = this.board.cards.get(preach.targetUid)
        const cStack = this.board.stackOf(cultist)
        const vStack = victim ? this.board.stackOf(victim) : null

        if (!victim || !cStack || !vStack || this.carriedCardUids.has(victim.uid)) {
          this.cultistPreaching.delete(cultist.uid)
          continue
        }

        preach.timer += dt
        // batch18：飘字改 2 秒边沿触发——稳定 2 秒一次，不再每帧轰炸对象池
        const wholeSec = Math.floor(preach.timer)
        if (wholeSec % 2 === 0 && wholeSec !== preach.lastShownSec) {
          preach.lastShownSec = wholeSec
          this.floaters.show(vStack.x + CARD_W / 2, vStack.y - 12, `腐化侵蚀 (${wholeSec}/10s)`, '#c084fc', 16)
        }

        if (preach.timer >= CONVERT_TIME) {
          victim.originUnit = victim.cardId
          this.board.transformCard(victim, 'cultist')
          this.floaters.show(vStack.x + CARD_W / 2, vStack.y - 14, '★ 堕落！转化为了邪教徒！', '#a855f7', 22)
          this.cultistPreaching.delete(cultist.uid)
        }
      }
    }
  }

  /**
   * 碰撞与交战管线检测：
   * 1. 采用 AABB 边缘距离 <= 20px 真实判定接敌。
   * 2. 当敌人撞上正在作业的工作台/建筑时，打断工作并将平民剥离出来迎战。
   */
  private checkCollisions(): void {
    const enemyStacks = [...this.board.stacks.values()].filter(st => st.members[0] && getDef(st.members[0].cardId).category === 'enemy')
    const allStacks = [...this.board.stacks.values()]

    for (const es of enemyStacks) {
      const eRoot = es.members[0]
      if (!eRoot || this.isInBattle(eRoot) || eRoot.cardId === 'cultist' || eRoot.cardId === 'imperial_flagship') continue

      for (const targetStack of allStacks) {
        if (targetStack.id === es.id) continue
        const targetRoot = targetStack.members[0]
        if (!targetRoot || targetRoot.cardId === 'tax_ship') continue // 严禁攻击帝国什一税军舰

        // 检查该堆叠中是否包含任何我方人口
        const hasOurUnit = targetStack.members.some(m => getDef(m.cardId).isOurUnit)
        if (!hasOurUnit) continue

        if (this.carriedCardUids.has(targetRoot.uid) || this.disengageCooldowns.has(targetRoot.uid)) continue

        const edgeDist = getStackEdgeDistance(es, targetStack)
        if (edgeDist <= ENGAGE_EDGE_DIST) {
          // 场景 A：如果目标是工作台、建筑或正在生产的堆叠，打断生产并将工人拽出
          const isBuildingOrTask = targetStack.task !== null || getDef(targetRoot.cardId).category === 'building'
          const workerIndex = targetStack.members.findIndex(m => getDef(m.cardId).isOurUnit)

          if (isBuildingOrTask && workerIndex > 0) {
            targetStack.task = null
            refreshStackView(targetStack)
            const extractedWorkerStack = this.board.grabAt(targetStack, workerIndex)
            this.floaters.show(extractedWorkerStack.x + CARD_W / 2, extractedWorkerStack.y - 12, '作业受袭被打断！', '#ef4444', 18)
            this.triggerAutoEngage(eRoot, extractedWorkerStack)
          } else {
            // 场景 B：普通自由单位或散兵堆叠直接入战
            this.triggerAutoEngage(eRoot, targetStack)
          }
          break
        }
      }
    }
  }

  public isInBattle(card: CardEntity): boolean {
    return this.battles.some(b => b.enemies.some(e => e.uid === card.uid) || b.friendlies.some(f => f.uid === card.uid))
  }

  private findBattleWith(card: CardEntity): BattleGroup | undefined {
    return this.battles.find(b => b.enemies.some(e => e.uid === card.uid) || b.friendlies.some(f => f.uid === card.uid))
  }

  /** batch14存档：导出战斗侧可持久化状态 */
  public serializeCombat(): SerializedCombatState {
    return {
      corruptionLineTriggered: this.corruptionLineTriggered,
      corruptionCountdownMonths: this.corruptionCountdownMonths,
      flagshipPending: this.flagshipPending,
      expeditions: [...this.activeExpeditions.entries()].map(([keyUid, e]) => ({ keyUid, ...e })),
      purifyStates: [...this.purifyStates.values()]
    }
  }

  /** batch14存档：恢复战斗状态（expeditions/purifyStates 的 uid/stackId 已由引擎完成重映射） */
  public restoreCombat(data: SerializedCombatState): void {
    this.corruptionLineTriggered = !!data.corruptionLineTriggered
    this.corruptionCountdownMonths = data.corruptionCountdownMonths ?? 0
    this.flagshipPending = !!data.flagshipPending
    this.activeExpeditions.clear()
    for (const e of data.expeditions || []) {
      const { keyUid, ...exp } = e
      this.activeExpeditions.set(keyUid, exp as ExpeditionTask)
    }
    this.purifyStates.clear()
    for (const ps of data.purifyStates || []) {
      this.purifyStates.set(ps.stackId, { ...ps })
    }
    // 腐化线已触发但旗舰不在场且未在等翻年（延迟队列不持久化）：直接补刷旗舰
    // batch56：读档补刷不带出场卫队——卫队是普通敌人卡已随存档重建，再刷会翻倍
    if (this.corruptionLineTriggered && !this.flagshipPending && !this.board.allCards().some(c => c.cardId === 'imperial_flagship')) {
      this.spawnImperialFlagship(false)
    }
  }

  private cleanDeadEntities(): void {
    for (const b of this.battles) {
      b.enemies = b.enemies.filter(e => this.board.cards.has(e.uid))
      b.friendlies = b.friendlies.filter(f => this.board.cards.has(f.uid))
    }
    this.battles = this.battles.filter(b => b.enemies.length > 0 && b.friendlies.length > 0)
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(v, max))
}