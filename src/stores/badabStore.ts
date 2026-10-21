// badabStore.ts 巴达布前哨 - Pinia 全局状态仓储（HUD 镜像与实体军舰什一税状态机）
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { TaxType } from '../main/services/badab/game/types'

export interface TaxShipStatusPayload {
  cycle: number
  taxType: TaxType
  targetReq: number
  currentPaid: number
  isCompleted: boolean
}

export const useBadabStore = defineStore('badab', () => {
  const month = ref(1) // 当前星际年
  const monthProgress = ref(0)   // 0..1，年倒计时进度条
  const gold = ref(0)
  const corruption = ref(0)      // 0..100，核心腐化指标
  const foodHave = ref(0)        // 场上+食堂食物总饱食度
  const foodNeed = ref(0)        // 所有单位每年总饱食度消耗
  const slotsUsed = ref(0)
  const slotsCap = ref(24)
  const paused = ref(false)

  // ===================== 实体军舰什一税单状态 =====================
  const isTaxDue = ref(false)             // 军舰当前是否停泊在桌面上征税
  const taxCycle = ref(1)                 // 第几届什一税
  const taxType = ref<TaxType>('gold')    // 当前随机抽中的税种：'gold' | 'population' | 'seed'
  const taxReq = ref(50)                  // 目标需求额度
  const taxPaid = ref(0)                  // 当前已吞入数量
  const taxCompleted = ref(false)         // 是否已备齐
  const monthsUntilTax = ref(4)           // 距离下次税舰降临的星际年倒计时（0 表示当年停泊）

  // 年末结算时双倍献赋面板控制
  const showDoubleTaxPrompt = ref(false)  // 年末完税时是否弹出双倍献赋确认窗

  function setTaxShipStatus(payload: TaxShipStatusPayload | null) {
    if (!payload) {
      isTaxDue.value = false
      taxCompleted.value = false
      return
    }
    isTaxDue.value = true
    taxCycle.value = payload.cycle
    taxType.value = payload.taxType
    taxReq.value = payload.targetReq
    taxPaid.value = payload.currentPaid
    taxCompleted.value = payload.isCompleted
  }

  function updateTaxPaid(paid: number, completed: boolean) {
    taxPaid.value = paid
    taxCompleted.value = completed
  }

  function $reset() {
    month.value = 1
    monthProgress.value = 0
    gold.value = 0
    corruption.value = 0
    foodHave.value = 0
    foodNeed.value = 0
    slotsUsed.value = 0
    slotsCap.value = 24
    paused.value = false

    isTaxDue.value = false
    taxCycle.value = 1
    taxType.value = 'gold'
    taxReq.value = 50
    taxPaid.value = 0
    taxCompleted.value = false
    monthsUntilTax.value = 4
    showDoubleTaxPrompt.value = false
  }

  return {
    month,
    monthProgress,
    gold,
    corruption,
    foodHave,
    foodNeed,
    slotsUsed,
    slotsCap,
    paused,

    // 什一税字段
    isTaxDue,
    taxCycle,
    taxType,
    taxReq,
    taxPaid,
    taxCompleted,
    monthsUntilTax,
    showDoubleTaxPrompt,
    setTaxShipStatus,
    updateTaxPaid,

    $reset
  }
})