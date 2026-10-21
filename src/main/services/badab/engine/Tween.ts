// Tween.ts 巴达布前哨 - 引擎：补间动画管理器（含工业液压钝挫曲线）
// 本次改造：update 增加目标空值防御——target 为 null/undefined 的补间直接丢弃，
//          杜绝 "Cannot set properties of null (setting 'x')" 崩溃（含 destroyed 容器 setter 路径）；
//          from 值缺失时按 0 兜底，杜绝 NaN 污染。
export type EaseFn = (t: number) => number

export const Easings = {
  linear: (t: number) => t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeOutQuad: (t: number) => 1 - (1 - t) * (1 - t),
  easeInQuad: (t: number) => t * t,
  easeOutBack: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  /** 重工业液压减震钝挫：高速砸落并产生微小超调与金属机械停稳 */
  hydraulicSettle: (t: number) => {
    if (t >= 1) return 1
    const p = t - 1
    return p * p * (1.8 * p + 0.8) + 1
  }
}

interface TweenItem {
  target: Record<string, number>
  props: Record<string, number>
  from: Record<string, number>
  duration: number
  elapsed: number
  ease: EaseFn
  onComplete?: () => void
}

export class TweenManager {
  private items: TweenItem[] = []

  to(
    target: Record<string, number>,
    props: Record<string, number>,
    duration: number,
    ease: EaseFn = Easings.easeOutCubic,
    onComplete?: () => void
  ): void {
    // 防御：拒绝空目标/已销毁目标入列；警告打印便于抓捕根因（批次四 + 批次十二补充 destroyed 层）
    const tweenTarget = target as unknown as { destroyed?: boolean } | null
    if (!tweenTarget || tweenTarget.destroyed === true) {
      console.warn('[badab tween] 空目标/已销毁补间被丢弃(to)', props)
      return
    }
    const from: Record<string, number> = {}
    for (const k in props) from[k] = target[k]
    this.items.push({ target, props, from, duration: Math.max(0.01, duration), elapsed: 0, ease, onComplete })
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]

      // 防御：目标已被销毁/置空的补间直接丢弃，绝不对 null 写属性。
      // 注意：Pixi 容器 destroy 后对象本体非 null 但内部 transform 为 null，
      // 对其写 x/scale 会在 setter 内部抛 "Cannot set properties of null"——必须看 destroyed 标记。
      const tweenTarget = it.target as unknown as { destroyed?: boolean } | null
      if (!tweenTarget || tweenTarget.destroyed === true) {
        this.items.splice(i, 1)
        continue
      }

      it.elapsed += dt
      const t = Math.min(1, it.elapsed / it.duration)
      const e = it.ease(t)
      for (const k in it.props) {
        const from = it.from[k] ?? 0
        it.target[k] = from + (it.props[k] - from) * e
      }
      if (t >= 1) {
        this.items.splice(i, 1)
        it.onComplete?.()
      }
    }
  }

  clear(): void {
    this.items = []
  }

  /** R50: 按目标精确清除在飞补间。拖拽接管视图前必调——否则旧补间会把视图逐帧写回入队时的旧绝对坐标，
   *  视图被钉在原地形成"尸体卡"（状态已走、视图不归 relink 管，重启才清）。 */
  killByTarget(target: Record<string, number>): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      if (this.items[i].target === target) this.items.splice(i, 1)
    }
  }
}