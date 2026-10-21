<!-- 文件名: src/themes/minimal/TechGameCard.vue -->
<!-- 深空星渊 · 极简未来风 (2026 前沿科技美学版) -->
<!-- 杜绝装饰性英文小标签，纯粹、通透、高质感 -->
<!-- 性能极致优化：零响应式重渲染聚光灯 (Zero Re-render CSS Variable Spotlight) -->
<!-- 状态与接线 100% 严密对齐母本：合集、安装中、启动、详情无缝联动 -->
<template>
  <div 
    ref="cardRootRef"
    class="tech-card-root group relative w-full cursor-pointer select-none z-0"
    @mousemove="handleCardMouseMove"
    @mouseleave="handleCardMouseLeave"
    @click="emit('action')"
    @contextmenu.prevent="emit('contextmenu', { id, x: $event.clientX, y: $event.clientY, title, type, installed: isInstalled, path: '' })"
    role="button"
    tabindex="0"
  >
    <!-- 卡片主体：黑曜石半透微晶体质感 (Deep Obsidian Glass) -->
    <div 
      ref="cardBodyRef"
      class="tech-card-body relative w-full rounded-2xl overflow-hidden flex flex-col transition-all duration-300 ease-out p-3"
      style="
        background: rgba(10, 14, 24, 0.7);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.07);
        box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.6);
      "
      :class="{
        'border-cyan-400/40 shadow-[0_16px_36px_-6px_rgba(0,242,255,0.15)] -translate-y-1': isHovered,
      }"
    >
      <!-- Inspira UI 柔和表面聚光灯微光层 (纯原生 CSS 变量驱动，零 Vue 响应式开销) -->
      <div 
        class="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-300 z-10"
        :class="isHovered ? 'opacity-80' : 'opacity-0'"
        style="background: radial-gradient(circle 140px at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255, 255, 255, 0.08) 0%, transparent 80%);"
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

        <!-- 悬停快捷操作蒙层：舒适宽大热区，极简中文 -->
        <div 
          v-if="!hideControls"
          class="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
        >
          <div class="flex items-center gap-2 w-full">
            <button 
              type="button"
              v-if="type !== 'collection'"
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
      <div class="flex flex-col justify-center px-1 pt-3 pb-0.5 min-w-0 z-20">
        <h3 
          class="text-white/95 font-semibold text-[14.5px] leading-snug truncate tracking-tight font-sans transition-colors duration-150 group-hover:text-white"
          :title="title"
        >
          {{ title }}
        </h3>
        <div class="flex items-center justify-between mt-1 text-[12px] text-[#8295ab]">
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
}>()

const emit = defineEmits<{
  (e: 'action'): void
  (e: 'collect'): void
  (e: 'contextmenu', payload: any): void
}>()

const cardRootRef = ref<HTMLElement | null>(null)
const cardBodyRef = ref<HTMLElement | null>(null)
const isHovered = ref(false)

// 高性能原生 CSS 变量设置：杜绝响应式触发，零重绘抖动
function handleCardMouseMove(e: MouseEvent) {
  isHovered.value = true
  const el = cardBodyRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`)
  el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`)
}

function handleCardMouseLeave() {
  isHovered.value = false
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

// 底部次级信息：中文状态优先，或显示游戏类型
const subMetaText = computed(() => {
  if (props.isInstalled) return t('card.launch')
  if (props.isInLibrary) return t('card.inLibrary')
  if (props.tags && props.tags[1]) return props.tags[1]
  if (props.tags && props.tags[0] && props.tags[0] !== 'TITAN_PROTOCOL' && props.tags[0].toUpperCase() !== 'STEAM') {
    return props.tags[0]
  }
  return ''
})
</script>