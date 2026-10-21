// cycle.ts 巴达布前哨 - 规则层：结算共享类型、延迟队列与喂食优先级（年末结算向导已迁至引擎层实现）
import { CardEntity } from '../engine/Stack'

export interface DelayedEvent {
  at: number
  run: () => void
}

export class DelayedQueue {
  private items: DelayedEvent[] = []

  schedule(delaySeconds: number, run: () => void, now: number): void {
    this.items.push({ at: now + delaySeconds, run })
  }

  process(gameTime: number): void {
    const due = this.items.filter(i => i.at <= gameTime)
    if (!due.length) return
    this.items = this.items.filter(i => i.at > gameTime)
    for (const d of due) d.run()
  }

  clear(): void {
    this.items = []
  }
}

export interface StoredFoodItem {
  cardId: string
  satiety: number
}

export interface TaxYearReport {
  isTaxYear: boolean
  taxCycle: number
  taxType: import('./types').TaxType
  targetReq: number
  currentPaid: number
  isFulfilled: boolean
  missCount?: number // batch36：抗税次数（递增惩罚基数，成功完税清零）
}

export interface MonthSettlementResult {
  month: number
  foodHave: number
  foodNeed: number
  foodConsumed: number
  starvedCount: number
  starvedNames: string[]
  corpsesSpawned: number
  isDefeat: boolean
  taxReport?: TaxYearReport
}

/**
 * 年末喂食优先级（一号裁定：优先级高者先吃，食物耗尽后未吃到的人口自然饿死）
 * 顺序 = 饥饿淘汰序的完全倒转
 */
export const FEED_PRIORITY: string[] = [
  'astartes',
  'battle_sister',
  'private_librarian',
  'private_assassin',
  'auxilia',
  'civilian',
  'cultist',
  'baby'
]

export function getFeedPriority(cardId: string): number {
  const i = FEED_PRIORITY.indexOf(cardId)
  return i === -1 ? FEED_PRIORITY.length : i
}