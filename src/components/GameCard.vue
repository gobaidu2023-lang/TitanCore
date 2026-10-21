<template>
  <div 
    class="group relative w-full aspect-[2/3] transition-all duration-300 ease-out z-0 select-none hover:-translate-y-2 will-change-transform"
    :class="currentTheme === 'anime' ? 'rounded-2xl' : 'rounded-theme'"
    @click="emit('action')"
    @contextmenu.prevent="emit('contextmenu', { id, x: $event.clientX, y: $event.clientY, title, type, installed: isInstalled, path: '' })"
    role="button"
    tabindex="0"
  >
    <div 
      class="relative h-full w-full overflow-hidden z-10 flex flex-col transition-all duration-500"
      :class="currentTheme === 'anime' 
        ? 'rounded-2xl bg-white border border-pink-200/70 shadow-[0_4px_16px_rgba(244,114,182,0.15)] group-hover:shadow-[0_8px_25px_rgba(244,114,182,0.3)] group-hover:border-pink-300' 
        : 'rounded-theme bg-bg-panel border border-white/5 group-hover:shadow-[0_0_30px_rgba(var(--primary-rgb),0.2)]'"
    >

      <!-- 海报图层 (纯净通透，仅底部文字背后留微弱暗晕，去除发灰与黑幕) -->
      <div class="absolute inset-0 overflow-hidden" :class="currentTheme === 'anime' ? 'bg-slate-100' : 'bg-[#0a0d14]'">
        <TitanImage 
          :id="id" :src="image" 
          class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <!-- 仅底部微弱渐变保护标题可读性 -->
        <div 
          class="absolute inset-0 pointer-events-none"
          :class="currentTheme === 'anime' 
            ? 'bg-gradient-to-t from-white/90 via-transparent to-transparent' 
            : 'bg-gradient-to-t from-black/95 via-black/30 to-transparent'"
        ></div>
      </div>

      <!-- 悬浮操作按钮层 -->
      <div v-if="!hideControls" class="absolute inset-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[1px]">
        <div class="flex items-center gap-2 w-full px-4">
          <button 
            type="button"
            v-if="type !== 'collection'"
            @click.stop="emit('collect')"
            class="flex-1 px-3 py-2 rounded-sm text-[10px] font-black font-code tracking-widest text-center transition-all border cursor-pointer"
            :class="isInLibrary ? 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white hover:border-white/40'"
          >
            <span>{{ isInLibrary ? '★ ' + t('card.collected') : '☆ ' + t('card.collect') }}</span>
          </button>
          <button 
            type="button"
            @click.stop="emit('action')"
            class="px-3 py-2 rounded-sm text-[10px] font-black font-code tracking-widest text-center transition-transform hover:scale-105 shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-pointer"
            :class="[buttonClass, 'flex-1']"
          >
            <span>{{ buttonText }}</span>
          </button>
        </div>
      </div>

      <!-- 底部主标题 -->
      <div class="absolute bottom-0 inset-x-0 p-4 z-20 flex flex-col justify-end pointer-events-none">
        <div class="relative translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
          <h3 
            class="text-base font-black leading-tight tracking-wide line-clamp-2 transition-colors duration-300"
            :class="currentTheme === 'anime' ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)] group-hover:text-pink-300' : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] group-hover:text-primary'"
          >
            {{ title }}
          </h3>

          <!-- 标签流 -->
          <div class="flex flex-wrap items-center gap-1.5 mt-2 overflow-hidden max-h-5">
            <span 
              class="text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase border"
              :class="currentTheme === 'anime' ? animeTypeColor : currentTypeColor"
            >
              {{ currentTypeLabel }}
            </span>
            <span 
              v-for="tag in (tags || []).slice(0, 2)" 
              :key="tag" 
              class="text-[9px] font-mono px-1 py-0.5 rounded border"
              :class="currentTheme === 'anime' 
                ? 'bg-pink-500/80 text-white border-pink-300/40 shadow-sm' 
                : 'bg-black/60 text-white/80 border-white/10'"
            >
              #{{ tag }}
            </span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TitanImage from './TitanImage.vue'
import { t } from '../i18n'

const props = defineProps<{
  id: string | number
  title: string
  image: string
  type: string
  tags?: string[]
  isInstalled?: boolean
  isInLibrary?: boolean
  buttonText: string
  buttonClass?: string
  hideControls?: boolean
}>()

const emit = defineEmits(['action', 'collect', 'contextmenu'])

const typeColorClass: Record<string, string> = {
  titan_module: 'bg-primary/20 text-primary border-primary/30',
  game: 'bg-green-500/20 text-green-400 border-green-500/30',
  wallpaper: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  tool: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  titan_protocol: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  collection: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  unknown: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  patch: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
}

const typeLabelMap: Record<string, string> = {
  titan_module: 'Titan Module',
  game: 'Steam 游戏',
  wallpaper: '壁纸',
  tool: '实用工具',
  titan_protocol: 'Titan 协议',
  collection: '精选合集',
  unknown: '未知类型',
  patch: '游戏补丁'
}

import { useTheme } from '../composables/useTheme'

const { currentTheme } = useTheme()

const animeTypeColorClass: Record<string, string> = {
  titan_module: 'bg-sky-100 text-sky-700 border border-sky-300',
  game: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  wallpaper: 'bg-indigo-100 text-indigo-700 border border-indigo-300',
  tool: 'bg-slate-100 text-slate-700 border border-slate-300',
  titan_protocol: 'bg-blue-100 text-blue-700 border border-blue-300',
  collection: 'bg-pink-100 text-pink-700 border border-pink-300',
  unknown: 'bg-gray-100 text-gray-700 border border-gray-300',
  patch: 'bg-amber-100 text-amber-700 border border-amber-300'
}

const currentTypeLabel = computed(() => typeLabelMap[props.type] || typeLabelMap['unknown'])
const currentTypeColor = computed(() => typeColorClass[props.type] || typeColorClass['unknown'])
const animeTypeColor = computed(() => animeTypeColorClass[props.type] || animeTypeColorClass['unknown'])
</script>
