<!-- 文件名: src/themes/minimal/TechGameCard.vue -->
<!-- 深空星渊 · macOS 级极简科幻玻璃壳 (Liquid Obsidian Glass 2026 美学版) -->
<!-- 杜绝装饰性英文小标签，纯粹、通透、高质感 -->
<!-- 性能极致优化：零强制重排 (Zero Forced-Reflow)、VirtualList 深度适配、GPU 独立合成加速 -->
<!-- 状态与接线 100% 严密对齐母本：合集、安装中、启动、详情无缝联动 -->
<template>
  <div 
    ref="cardRootRef"
    class="tech-card-root group relative w-full cursor-pointer select-none z-0 will-change-transform"
    @mouseenter="handleCardMouseEnter"
    @mousemove="handleCardMouseMove"
    @mouseleave="handleCardMouseLeave"
    @click="emit('action')"
    @contextmenu.prevent="emit('contextmenu', { id, x: $event.clientX, y: $event.clientY, title, type, installed: isInstalled, path: '' })"
    role="button"
    tabindex="0"
  >
    <!-- 卡片主体：macOS 级黑曜石液体玻璃质感 (Liquid Obsidian Glass) -->
    <div 
      ref="cardBodyRef"
      class="tech-card-body relative w-full rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out p-3"
      :style="{
        background: isHovered 
          ? 'linear-gradient(145deg, rgba(18, 28, 46, 0.82) 0%, rgba(10, 16, 26, 0.92) 100%)' 
          : 'linear-gradient(145deg, rgba(14, 22, 36, 0.72) 0%, rgba(8, 12, 20, 0.86) 100%)',
        backdropFilter: 'blur(12px)',
        border: isHovered ? '1px solid rgba(0, 242, 255, 0.55)' : '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: isHovered
          ? 'inset 0 1px 1px rgba(255, 255, 255, 0.4), 0 16px 36px -6px rgba(0, 242, 255, 0.22), 0 0 12px rgba(0, 242, 255, 0.15)'
          : 'inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 8px 24px -6px rgba(0, 0, 0, 0.55)',
        transform: isHovered ? 'translateY(-6px)' : 'translateY(0px)'
      }"
    >
      <!-- Inspira UI 柔和表面聚光灯微光层 (纯原生 CSS 变量驱动，零 Vue 响应式开销) -->
      <div 
        class="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 z-10"
        :class="isHovered ? 'opacity-80' : 'opacity-0'"
        style="background: radial-gradient(circle 140px at var(--spot-x, 50%) var(--spot-y, 50%), rgba(0, 242, 255, 0.12) 0%, transparent 80%);"
      ></div>

      <!-- 1. 封面图片容器：2:3 经典竖版比例，圆角 12px -->
      <div 
        class="relative w-full overflow-hidden rounded-xl bg-[#080b12] z-20"
        style="aspect-ratio: 2 / 3;"
      >
        <TitanImage 
          :id="id" 
          :src="image" 
          :local-steam-first="localSteamFirst"
          class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 opacity-90 group-hover:opacity-100"
        />

        <!-- 右上角徽章 (仅在合集或特殊独立品类时展示，拒绝无脑同质化) -->
        <div 
          v-if="badgeText"
          class="absolute top-2.5 right-2.5 z-30 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide backdrop-blur-md"
          :style="badgeStyle"
        >
          {{ badgeText }}
        </div>

        <!-- 仓库专属：仅开启实验功能 titan_protocol 游戏卡片【极简黑曜石悬停浮现发射台】平时纯净无遮挡 -->
        <div 
          v-if="canShowLaunchButton"
          class="absolute inset-0 z-30 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 flex items-end p-2.5 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-auto"
        >
          <TitanLaunchButton 
            :status="resolvedLaunchStatus"
            theme="minimal"
            @launch="emit('launch', id)"
          />
        </div>

        <!-- 悬停快捷操作蒙层：舒适宽大热区，极简中文 -->
        <div 
          v-if="!hideControls"
          class="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
        >
          <div class="flex items-center gap-2 w-full">
            <button 
              type="button"
              v-if="type !== 'collection' && type !== 'sharegame'"
              @click.stop="emit('collect')"
              class="flex-1 py-2 px-1 rounded-lg text-[12px] font-medium tracking-wide text-center transition-all cursor-pointer active:scale-95"
              :class="isInLibrary 
                ? 'bg-[#00f2ff]/20 text-[#00f2ff] border border-[#00f2ff]/50' 
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'"
            >
              {{ isInLibrary ? t('card.inLibrary') : `+ ${t('card.collect')}` }}
            </button>
            <button 
              type="button"
              @click.stop="emit('action')"
              class="flex-1 py-2 px-1 rounded-lg text-[12px] font-bold tracking-wide text-center transition-all cursor-pointer active:scale-95 shadow-md"
              :class="isInstalling ? 'bg-amber-400 text-black animate-pulse' : 'bg-[#00f2ff] text-[#06080e]'"
            >
              {{ primaryButtonText }}
            </button>
          </div>
        </div>
      </div>

      <!-- 2. 信息区域：100% 优雅纯中文，字号 14.5px/12px 舒适舒展 -->
      <div class="flex flex-col justify-center px-1 pt-2.5 pb-0.5 min-w-0 z-20">
        <div class="flex items-center justify-between gap-2">
          <h3 
            class="text-white/95 font-bold text-[16.5px] leading-snug truncate tracking-tight font-sans transition-colors duration-150 group-hover:text-white flex-1"
            :title="title"
          >
            {{ title }}
          </h3>
          <!-- 微型状态光珠：已安装(蓝) / 已在库(青)，无次级标签时与标题同行对齐，利落紧凑 -->
          <span 
            v-if="!subMetaText"
            class="w-2 h-2 rounded-full transition-colors flex-shrink-0"
            :class="isInstalled ? 'bg-[#00f2ff] shadow-[0_0_6px_#00f2ff]' : (isInLibrary ? 'bg-[#38bdf8]' : 'bg-[#334155]')"
            :title="isInstalled ? '已安装' : (isInLibrary ? '已入库' : '')"
          ></span>
        </div>

        <!-- 仅当存在有价值的真实游戏标签（如 #动作、#RPG）时才展示次级信息行，杜绝无意义底层协议装饰 -->
        <div v-if="subMetaText" class="flex items-center justify-between mt-1 text-[12px] text-[#8295ab]">
          <span class="truncate tracking-wide font-medium">
            {{ subMetaText }}
          </span>
          <span 
            class="w-2 h-2 rounded-full transition-colors flex-shrink-0 ml-1.5"
            :class="isInstalled ? 'bg-[#00f2ff] shadow-[0_0_6px_#00f2ff]' : (isInLibrary ? 'bg-[#38bdf8]' : 'bg-[#334155]')"
            :title="isInstalled ? '已安装' : (isInLibrary ? '已入库' : '')"
          ></span>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import TitanImage from '../../components/TitanImage.vue'
import TitanLaunchButton from '../../components/TitanLaunchButton.vue'
import { useLibraryStore } from '../../stores/libraryStore'
import { t } from '../../i18n'

const props = defineProps<{
  id: string
  title: string
  tags?: string[]
  image: string
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
let cachedRect: DOMRect | null = null

const libraryStore = useLibraryStore()
const resolvedLaunchStatus = computed<'ready' | 'running'>(() => {
  if (props.launchStatus) return props.launchStatus
  return libraryStore.isAppRunning(props.id) ? 'running' : 'ready'
})

const canShowLaunchButton = computed(() => {
  return props.showLaunchButton && props.type === 'titan_protocol' && (libraryStore.prefEnableGameFastLaunch ?? libraryStore.prefEnableCardLaunch)
})

// 零强制重排：仅在鼠标进入瞬间缓存一次 rect，杜绝在 mousemove 中疯狂触发 getBoundingClientRect()
function handleCardMouseEnter() {
  isHovered.value = true
  if (cardBodyRef.value) {
    cachedRect = cardBodyRef.value.getBoundingClientRect()
  }
}

function handleCardMouseMove(e: MouseEvent) {
  if (!isHovered.value) isHovered.value = true
  const el = cardBodyRef.value
  if (!el) return
  if (!cachedRect) cachedRect = el.getBoundingClientRect()
  el.style.setProperty('--spot-x', `${e.clientX - cachedRect.left}px`)
  el.style.setProperty('--spot-y', `${e.clientY - cachedRect.top}px`)
}

function handleCardMouseLeave() {
  isHovered.value = false
  cachedRect = null
}

// 主按钮文案：标准化接入 i18n
const primaryButtonText = computed(() => {
  if (props.isInstalling) return t('card.syncing')
  if (props.type === 'collection') return t('card.viewCollection')
  return props.isInstalled ? t('card.launch') : t('card.view')
})

// 标签徽章：仅在合集或有独立品类名时展示
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
      background: 'rgba(255, 92, 0, 0.25)',
      border: '1px solid rgba(255, 92, 0, 0.55)',
      color: '#ff8547'
    }
  }
  return {
    background: 'rgba(0, 242, 255, 0.15)',
    border: '1px solid rgba(0, 242, 255, 0.4)',
    color: '#00F2FF'
  }
})

// 底部次级信息：仅显示有意义的真实游戏标签（如 #动作、#RPG），彻底删除无意义的“Titan协议”装饰
const subMetaText = computed(() => {
  const validTags = (props.tags || []).filter(t => {
    if (!t) return false
    const upper = String(t).trim().toUpperCase()
    return upper !== 'TITAN_PROTOCOL' && upper !== 'TITAN PROTOCOL' && upper !== 'STEAM' && upper !== 'GAME'
  })
  if (validTags.length > 0) return validTags[0]
  if (props.type === 'collection') return t('nav.collection')
  return ''
})
</script>
