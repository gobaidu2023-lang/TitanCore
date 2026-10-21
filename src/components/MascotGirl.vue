<!-- 文件路径: src/components/MascotGirl.vue -->
<template>
  <div 
    class="mascot-container relative select-none flex flex-col items-center justify-end group cursor-pointer"
    @click="handleClick"
    title="戳戳我看板娘~"
  >
    <!-- 头顶与周围闪烁小星光 ✨（还原方案 C 二次元设计图） -->
    <div class="absolute -top-1 -left-2 text-pink-400 opacity-80 animate-twinkle pointer-events-none text-base">✦</div>
    <div class="absolute top-8 -left-4 text-cyan-400 opacity-70 animate-twinkle pointer-events-none text-xs" style="animation-delay: 0.8s;">✧</div>
    <div class="absolute top-1 right-2 text-purple-400 opacity-75 animate-twinkle pointer-events-none text-sm" style="animation-delay: 1.5s;">✦</div>

    <!-- 萌系对话气泡（头顶居中对齐，绝不超出侧栏边界） -->
    <div 
      class="mascot-bubble absolute -top-6 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1 rounded-full bg-white/95 text-slate-800 text-[11px] font-bold font-sans shadow-[0_4px_16px_rgba(255,182,193,0.5)] border border-pink-200/90 flex items-center gap-1.5 backdrop-blur-md transition-all duration-300 pointer-events-none whitespace-nowrap"
      :class="{ 'scale-105 border-pink-400 text-pink-600': isHappy }"
    >
      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>{{ bubbleText }}</span>
      <!-- 气泡小尾巴 (居中) -->
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/95 border-b border-r border-pink-200/90 rotate-45 transform"></div>
    </div>

    <!-- 看板娘主体画布区（尺寸放大，512x512 严丝合缝对齐） -->
    <div 
      class="relative w-full aspect-square overflow-visible flex items-center justify-center transition-transform duration-300"
      :class="{ 'mascot-bounce': isHappy }"
    >
      <!-- 1. 待机完整高清底图（已彻底移除眼球跟随，还原极致清晰度） -->
      <img 
        :src="baseIdleImg" 
        alt="mascot-base" 
        class="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
      />

      <!-- 2. 自然眨眼阶段 1：半闭眼过渡贴片 -->
      <img 
        v-show="blinkStage === 1 && !isHappy" 
        :src="blinkHalfImg" 
        alt="blink-half" 
        class="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
      />

      <!-- 3. 自然眨眼阶段 2：完全闭眼贴片 -->
      <img 
        v-show="blinkStage === 2 && !isHappy" 
        :src="blinkClosedImg" 
        alt="blink-closed" 
        class="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
      />

      <!-- 4. 戳一戳互动：开怀笑脸贴片（点击时呈现，覆盖全身表情） -->
      <img 
        v-show="isHappy" 
        :src="clickHappyImg" 
        alt="happy" 
        class="absolute inset-0 w-full h-full object-contain pointer-events-none z-30 transition-all duration-150"
      />
    </div>

    <!-- 底部微晕 -->
    <div class="absolute -bottom-2 w-28 h-3 bg-pink-300/30 blur-md rounded-full pointer-events-none"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// 引入切图：完整底图 + 自然眨眼 + 点击开怀笑脸
import baseIdleImg from '../assets/kanbanniang/01_base_idle.png'
import blinkHalfImg from '../assets/kanbanniang/04_blink_half.png'
import blinkClosedImg from '../assets/kanbanniang/05_blink_closed.png'
import clickHappyImg from '../assets/kanbanniang/06_click_happy.png'

// 眨眼状态：0 睁眼，1 半闭，2 全闭
const blinkStage = ref<0 | 1 | 2>(0)

// 戳一戳互动状态
const isHappy = ref(false)

// 气泡文本
const bubbleText = ref('在线中~')

// 互动台词库
const HAPPY_QUOTES = [
  '指挥官，今天玩什么呀？(◕ᴗ◕✿)',
  '呜哇！被你戳到了~',
  'TitanCore 绝赞运行中！',
  '别戳啦，痒痒的呢~ (⁄ ⁄•⁄ω⁄•⁄ ⁄)',
  '今天也是元气满满的一天哦！',
  '随时待命中，指挥官！'
]

let blinkTimer: ReturnType<typeof setTimeout> | null = null
let quoteResetTimer: ReturnType<typeof setTimeout> | null = null
let happyResetTimer: ReturnType<typeof setTimeout> | null = null

// -------------------------------------------------------------
// 自然眨眼定时循环
// -------------------------------------------------------------
const scheduleNextBlink = () => {
  const delay = 3500 + Math.random() * 2500
  blinkTimer = setTimeout(() => {
    if (!isHappy.value) {
      triggerBlink()
    } else {
      scheduleNextBlink()
    }
  }, delay)
}

const triggerBlink = () => {
  blinkStage.value = 1
  setTimeout(() => {
    blinkStage.value = 2
    setTimeout(() => {
      blinkStage.value = 1
      setTimeout(() => {
        blinkStage.value = 0
        scheduleNextBlink()
      }, 50)
    }, 90)
  }, 50)
}

// -------------------------------------------------------------
// 戳一戳点击互动
// -------------------------------------------------------------
const handleClick = () => {
  isHappy.value = true
  blinkStage.value = 0

  const randomQuote = HAPPY_QUOTES[Math.floor(Math.random() * HAPPY_QUOTES.length)]
  bubbleText.value = randomQuote

  if (happyResetTimer) clearTimeout(happyResetTimer)
  happyResetTimer = setTimeout(() => {
    isHappy.value = false
  }, 1200)

  if (quoteResetTimer) clearTimeout(quoteResetTimer)
  quoteResetTimer = setTimeout(() => {
    bubbleText.value = '在线中~'
  }, 3200)
}

onMounted(() => {
  scheduleNextBlink()
})

onUnmounted(() => {
  if (blinkTimer) clearTimeout(blinkTimer)
  if (quoteResetTimer) clearTimeout(quoteResetTimer)
  if (happyResetTimer) clearTimeout(happyResetTimer)
})
</script>

<style scoped>
.mascot-container {
  /* 尺寸饱满，自适应侧栏容器，绝不溢出截断 */
  width: 172px;
  max-width: 100%;
}

@media (min-width: 1440px) {
  .mascot-container {
    width: 176px;
  }
}

@media (min-width: 2560px) {
  .mascot-container {
    width: 184px;
  }
}

/* 戳一戳萌动 Q 弹动画 */
@keyframes mascotBounce {
  0% { transform: scale(1) translateY(0); }
  25% { transform: scale(1.08, 0.92) translateY(-8px); }
  50% { transform: scale(0.96, 1.04) translateY(2px); }
  75% { transform: scale(1.02, 0.98) translateY(-2px); }
  100% { transform: scale(1) translateY(0); }
}

.mascot-bounce {
  animation: mascotBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>
