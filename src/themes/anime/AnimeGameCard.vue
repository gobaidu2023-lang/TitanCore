<!-- 文件名: src/themes/anime/AnimeGameCard.vue -->
<!-- Sakura 初樱晨曦 · 现代二次元全画幅晶莹卡砖 (Acrylic Art Card) -->
<!-- 遵照最高指令：封面视觉权重 100% 释放，彻底消灭遮挡立绘的厚白底舱与硬编码废话，全域接入 card i18n 规范 -->
<template>
  <div 
    ref="cardRootRef"
    class="anime-card-root group relative w-full cursor-pointer select-none z-0 will-change-transform"
    @click="emit('action')"
    @mouseenter="handleMouseEnter"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    @contextmenu.prevent="emit('contextmenu', { id, x: $event.clientX, y: $event.clientY, title, type, installed: isInstalled, path: '' })"
    role="button"
    tabindex="0"
  >
    <!-- 1. 卡片主体：32px 超大圆弧晶体卡砖 (带 3D 浮雕视差倾斜与 Inspira UI 聚光灯) -->
    <div 
      ref="cardBodyRef"
      class="anime-card-body relative w-full rounded-[32px] overflow-hidden flex flex-col justify-end transition-all duration-300 ease-out"
      :style="{
        aspectRatio: '3 / 4',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        border: isHovered ? '2px solid rgba(234, 143, 180, 0.8)' : '2px solid rgba(255, 255, 255, 0.95)',
        boxShadow: isHovered 
          ? '0 20px 40px -8px rgba(234, 143, 180, 0.35), 0 0 20px rgba(255, 182, 218, 0.25)' 
          : '0 8px 24px -4px rgba(200, 160, 185, 0.14), 0 2px 8px rgba(0, 0, 0, 0.02)',
        transform: isHovered 
          ? `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px) scale(1.02)` 
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)'
      }"
    >
      <!-- 2. 全画幅立绘海报：充满整个 32px 超大圆角卡砖 -->
      <div class="absolute inset-0 rounded-[30px] overflow-hidden bg-[#faf5f8]">
        <TitanImage 
          :id="id" 
          :src="image" 
          :local-steam-first="localSteamFirst"
          class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108"
        />
        <!-- 底部轻盈渐层暗影：微型遮罩仅保护文字清晰度，绝不遮挡立绘艺术主体 -->
        <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none"></div>
      </div>

      <!-- 3. Inspira UI Card Spotlight 柔粉流光聚光灯 (跟随鼠标游走的光晕，零响应式 Diff 开销) -->
      <div 
        class="pointer-events-none absolute inset-0 rounded-[30px] z-20 transition-opacity duration-300"
        :class="isHovered ? 'opacity-100' : 'opacity-0'"
        style="background: radial-gradient(280px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255, 182, 218, 0.35), transparent 70%);"
      ></div>

      <!-- 4. 左上角：分类徽标 (仅合集或特殊分类时轻量展示) -->
      <div 
        v-if="badgeText"
        class="absolute top-3.5 left-3.5 z-30 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wide backdrop-blur-md shadow-sm flex items-center gap-1.5 select-none"
        :style="badgeStyle"
      >
        <span class="text-xs">🌸</span>
        <span>{{ badgeText }}</span>
      </div>

      <!-- 5. 底部纯净大字标题与战术发射台：1:1 保护立绘艺术主体，绝不遮挡角色核心 -->
      <div class="relative z-20 px-3.5 pb-3 pt-2 flex flex-col justify-end pointer-events-none">
        <div class="flex items-center justify-between gap-2">
          <h3 
            class="text-white font-black text-[17px] leading-tight truncate tracking-wide drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] font-sans transition-colors duration-250 group-hover:text-pink-200"
            :title="title"
          >
            {{ title }}
          </h3>
          
          <!-- 微型状态光珠：已安装(蓝) / 已在库(粉)，精致不喧宾夺主 -->
          <span 
            v-if="isInstalled || isInLibrary"
            class="w-2 h-2 rounded-full flex-shrink-0 shadow-sm transition-transform group-hover:scale-110"
            :class="isInstalled ? 'bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.9)]' : 'bg-[#ea8fb4] shadow-[0_0_8px_rgba(234,143,180,0.9)]'"
            :title="isInstalled ? t('card.launch') : t('card.inLibrary')"
          ></span>
        </div>

        <!-- 仓库专属：仅开启实验功能 titan_protocol 游戏卡片【悬停才浮现初樱晶莹启动台】平时纯净无遮挡 -->
        <div 
          v-if="canShowLaunchButton"
          class="h-0 opacity-0 translate-y-2 group-hover:h-9 group-hover:opacity-100 group-hover:translate-y-0 group-hover:mt-2 transition-all duration-300 ease-out pointer-events-auto"
        >
          <TitanLaunchButton 
            :status="resolvedLaunchStatus"
            theme="anime"
            @launch="emit('launch', id)"
          />
        </div>
      </div>

      <!-- 6. 悬停快捷行动层：Q 弹果冻弹簧手感 (肉垫回弹) -->
      <div 
        v-if="!hideControls"
        class="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 transition-all duration-250 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      >
        <div class="flex flex-col gap-2.5 w-full max-w-[160px] animate-fade-in">
          <button 
            type="button"
            @click.stop="emit('action')"
            class="w-full py-2.5 px-3 rounded-full text-[12.5px] font-black tracking-wide text-center cursor-pointer text-white shadow-lg bg-gradient-to-r from-[#e592b0] to-[#eba3be] hover:opacity-95 active:scale-[0.90] transition-all duration-200"
          >
            {{ primaryButtonText }}
          </button>
          <button 
            type="button"
            v-if="type !== 'collection' && type !== 'sharegame'"
            @click.stop="emit('collect')"
            class="w-full py-2 px-3 rounded-full text-[12px] font-bold tracking-wide text-center cursor-pointer shadow-md active:scale-[0.90] transition-all duration-200"
            :class="isInLibrary 
              ? 'bg-[#fdeef5] border border-[#f5cbdc] text-[#be3b6f]' 
              : 'bg-white/95 border border-white text-[#473957] hover:bg-white hover:text-[#d45989]'"
          >
            {{ isInLibrary ? t('card.inLibrary') : `+ ${t('card.collect')}` }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import TitanImage from '../../components/TitanImage.vue'
import TitanLaunchButton from '../../components/TitanLaunchButton.vue'
import { useLibraryStore } from '../../stores/libraryStore'
import { t } from '../../i18n'

const props = defineProps<{
  id: string | number
  title: string
  tags?: string[]
  image?: string
  type?: string
  isInLibrary?: boolean
  isInstalled?: boolean
  isInstalling?: boolean
  hideControls?: boolean
  localSteamFirst?: boolean
  showLaunchButton?: boolean
  launchStatus?: 'ready' | 'running'
}>()

const emit = defineEmits<{
  (e: 'action'): void
  (e: 'collect'): void
  (e: 'launch', id: string | number): void
  (e: 'contextmenu', payload: any): void
}>()

const cardRootRef = ref<HTMLElement | null>(null)
const cardBodyRef = ref<HTMLElement | null>(null)
const isHovered = ref(false)
const rotateX = ref(0)
const rotateY = ref(0)
let cachedRect: DOMRect | null = null
let rafId: number | null = null

const libraryStore = useLibraryStore()
const resolvedLaunchStatus = computed<'ready' | 'running'>(() => {
  if (props.launchStatus) return props.launchStatus
  return libraryStore.isAppRunning(props.id) ? 'running' : 'ready'
})

const canShowLaunchButton = computed(() => {
  return props.showLaunchButton && props.type === 'titan_protocol' && (libraryStore.prefEnableGameFastLaunch ?? libraryStore.prefEnableCardLaunch)
})

// Inspira UI: 零强制重排 (Zero Forced-Reflow) + rAF 帧合并节流
const handleMouseEnter = () => {
  isHovered.value = true
  if (cardRootRef.value) {
    cachedRect = cardRootRef.value.getBoundingClientRect()
  }
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isHovered.value) isHovered.value = true
  const root = cardRootRef.value
  if (!root) return
  if (!cachedRect) {
    cachedRect = root.getBoundingClientRect()
  }
  const x = e.clientX - cachedRect.left
  const y = e.clientY - cachedRect.top
  root.style.setProperty('--spot-x', `${x}px`)
  root.style.setProperty('--spot-y', `${y}px`)

  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (!cachedRect) return
    const centerX = cachedRect.width / 2
    const centerY = cachedRect.height / 2
    rotateX.value = -((y - centerY) / centerY) * 3
    rotateY.value = ((x - centerX) / centerX) * 3
  })
}

const handleMouseLeave = () => {
  isHovered.value = false
  cachedRect = null
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  rotateX.value = 0
  rotateY.value = 0
}

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

// 按钮文本接入标准化 i18n
const primaryButtonText = computed(() => {
  if (props.isInstalling) return t('card.syncing')
  if (props.type === 'collection') return t('card.viewCollection')
  return props.isInstalled ? t('card.launch') : t('card.view')
})

// 分类微标 (仅在合集或有独立品类时展示)
const badgeText = computed(() => {
  if (props.type === 'collection') return t('nav.collection')
  const raw = props.tags && props.tags[0] ? props.tags[0] : ''
  if (!raw) return ''
  const upper = raw.toUpperCase()
  if (upper === 'STEAM' || upper === 'TITAN_PROTOCOL' || upper === 'TITAN PROTOCOL') {
    return ''
  }
  return raw
})

const isCollection = computed(() => props.type === 'collection' || badgeText.value === t('nav.collection'))

const badgeStyle = computed(() => {
  if (isCollection.value) {
    return {
      background: 'rgba(255, 245, 235, 0.95)',
      border: '1px solid rgba(251, 146, 60, 0.5)',
      color: '#ea580c'
    }
  }
  return {
    background: 'rgba(255, 240, 246, 0.95)',
    border: '1px solid rgba(245, 203, 220, 0.8)',
    color: '#c24b78'
  }
})
</script>

<style scoped>
.ease-spring {
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}
</style>
