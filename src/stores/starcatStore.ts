import { defineStore } from 'pinia'
import { ref } from 'vue'
import { GameScreen } from '../main/services/starcat/types'

export const useStarCatStore = defineStore('starCat', () => {
  // 画面路由
  const screen = ref<GameScreen>('menu')

  // 基础状态与无尽轮回循环数
  const stage = ref(1) // 1: 第一关, 2: 第二关, 3: 决战
  const loop = ref(1)  // 1: 初次探险, 2+: 无尽轮回 (NG+)
  const hp = ref(100)
  const maxHp = ref(100)
  const energy = ref(100)
  const maxEnergy = ref(100) // 封顶 200 (购买装备后提升)
  const isInvulnerable = ref(false)

  // 连击与战术数据
  const combo = ref(0)
  const maxCombo = ref(0)

  // 关卡 3 终极 Boss 专属血条与机制指示
  const boss = ref({
    active: false,
    hp: 75000,
    maxHp: 75000,
    isWeak: false,
    isEnraged: false,
    stateName: 'NORMAL' // 'NORMAL' | 'LASER' | 'SLAM' | 'WEAK' | 'OVERDRIVE'
  })

  // 升级卡与装备
  const upgrades = ref<string[]>([])
  const whiteStars = ref(0)

  // QTE 与滑块 Skill Check 状态
  const qte = ref({
    active: false,
    keys: [] as string[],
    currentIndex: 0,
    isRedMoon: false,
    linesCount: 0,
    skillCheckActive: false,
    sliderPos: 0, // 0 ~ 1
    sweetSpotMin: 0.38,
    sweetSpotMax: 0.62,
    isCharging: false
  })

  function reset(startStage = 1) {
    stage.value = startStage
    hp.value = 100
    maxHp.value = 100
    energy.value = 100
    maxEnergy.value = upgrades.value.includes('energy_expand') ? 200 : 100
    isInvulnerable.value = false
    combo.value = 0
    boss.value = {
      active: false,
      hp: 75000,
      maxHp: 75000,
      isWeak: false,
      isEnraged: false,
      stateName: 'NORMAL'
    }
    qte.value = {
      active: false,
      keys: [],
      currentIndex: 0,
      isRedMoon: false,
      linesCount: 0,
      skillCheckActive: false,
      sliderPos: 0,
      sweetSpotMin: 0.38,
      sweetSpotMax: 0.62,
      isCharging: false
    }
  }

  function resetFull() {
    loop.value = 1
    upgrades.value = []
    whiteStars.value = 0
    maxCombo.value = 0
    reset(1)
    screen.value = 'menu'
  }

  // 跃迁至下一轮回 (Loop N+1)
  function startNextLoop() {
    loop.value++
    stage.value = 1
    hp.value = maxHp.value
    energy.value = maxEnergy.value
    isInvulnerable.value = false
    combo.value = 0
    boss.value = {
      active: false,
      hp: Math.floor(75000 * (1 + (loop.value - 1) * 0.25)),
      maxHp: Math.floor(75000 * (1 + (loop.value - 1) * 0.25)),
      isWeak: false,
      isEnraged: false,
      stateName: 'NORMAL'
    }
    qte.value = {
      active: false,
      keys: [],
      currentIndex: 0,
      isRedMoon: false,
      linesCount: 0,
      skillCheckActive: false,
      sliderPos: 0,
      sweetSpotMin: 0.38,
      sweetSpotMax: 0.62,
      isCharging: false
    }
    screen.value = 'playing'
  }

  function addCombo() {
    combo.value++
    if (combo.value > maxCombo.value) {
      maxCombo.value = combo.value
    }
  }

  function breakCombo() {
    combo.value = 0
  }

  return {
    screen,
    stage,
    loop,
    hp,
    maxHp,
    energy,
    maxEnergy,
    isInvulnerable,
    combo,
    maxCombo,
    boss,
    upgrades,
    whiteStars,
    qte,
    reset,
    resetFull,
    startNextLoop,
    addCombo,
    breakCombo
  }
})