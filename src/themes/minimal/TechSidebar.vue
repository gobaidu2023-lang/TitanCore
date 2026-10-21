<!-- 文件名: src/themes/minimal/TechSidebar.vue -->
<!-- 设计稿2（方案B：深空星渊 · 极简未来风）人机工程学舒适版 (Ergonomic Cyber Rail) -->
<!-- 遵照 PC 桌面人机工效学（严密适配 27~32 寸高清大屏）：侧栏适当加宽至 90px，图标放大至 24px，字号字重全面适配 -->
<!-- 全面接驳 i18n 国际化多语言，英文自适应不拉伸变形，兼具卓越的可读性与点击手感 -->
<template>
  <aside class="tech-sidebar-rail w-[90px] h-full flex flex-col items-center select-none contain-layout flex-shrink-0 z-40 bg-[#06080f]/95 border-r border-white/[0.06] py-4 px-1.5 relative backdrop-blur-2xl">
    
    <!-- 顶部星海全息极细反光线 -->
    <div class="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#00f2ff]/40 to-transparent pointer-events-none"></div>

    <!-- 1. 顶部品牌微标：饱满清晰的 40x40px 晶体标志 -->
    <div class="flex items-center justify-center pb-5 pt-1 flex-shrink-0 cursor-default group" title="TitanCore System">
      <div class="relative w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg bg-gradient-to-br from-[#00f2ff] via-[#0099ff] to-[#0055aa] shadow-[0_0_16px_rgba(0,242,255,0.4)] ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
        <span class="tracking-tight">T</span>
      </div>
    </div>

    <!-- 2. 7 个导航菜单列表：饱满 24px 图标 + 舒适字标 + 菲茨定律易点按手感 -->
    <nav class="flex-1 w-full flex flex-col items-center gap-2.5 min-h-0 overflow-y-auto scrollbar-hide py-1 relative z-10 contain-layout">
      <div
        v-for="item in navItems"
        :key="item.id"
        class="relative w-full flex justify-center group flex-shrink-0"
      >
        <button
          type="button"
          @click="goTo(item.id)"
          class="relative w-[76px] h-[64px] rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer select-none active:scale-95"
          :class="activeId === item.id 
            ? 'bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] font-bold' 
            : 'text-[#8295ab] hover:text-white hover:bg-white/[0.05]'"
        >
          <!-- 激活项左侧冷月青微光指示条（3.5px 饱满可见） -->
          <div 
            v-if="activeId === item.id" 
            class="absolute -left-1.5 inset-y-2.5 w-[3.5px] bg-[#00f2ff] rounded-r shadow-[0_0_10px_#00f2ff]"
          ></div>

          <!-- 导航图标 (放大至 24px，在 27~32 寸大屏上一目了然) -->
          <svg 
            width="24" 
            height="24" 
            fill="currentColor" 
            viewBox="0 0 256 256" 
            class="flex-shrink-0 transition-transform duration-150"
            :class="activeId === item.id ? 'text-[#00f2ff] scale-105' : 'group-hover:text-white group-hover:scale-105'"
          >
            <path :d="item.icon"></path>
          </svg>

          <!-- 国际化字标：中文大气舒展、英文自适应单行紧凑不挤爆变形 -->
          <span 
            class="leading-tight text-center truncate max-w-[72px] select-none transition-all duration-150"
            :class="[
              isEnglish ? 'text-[11px] font-bold tracking-tight' : 'text-[12.5px] font-bold tracking-wider'
            ]"
          >
            {{ item.shortLabel }}
          </span>
        </button>

        <!-- 悬停侧向流光 Tooltip 气泡提示 (向右弹出，带快捷键) -->
        <div class="pointer-events-none absolute left-[88px] top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0 hidden md:flex items-center">
          <div class="px-3 py-1.5 rounded-lg bg-[#0e1626] border border-white/10 shadow-[0_6px_20px_rgba(0,0,0,0.7)] text-[12.5px] text-white whitespace-nowrap flex items-center gap-2.5">
            <span class="font-medium text-[#d0e2f5]">{{ item.label }}</span>
            <span class="text-[10px] font-mono text-[#00f2ff] bg-[#00f2ff]/10 px-1.5 py-0.5 rounded border border-[#00f2ff]/20">
              {{ item.shortcutKey }}
            </span>
          </div>
        </div>

      </div>
    </nav>

    <!-- 3. 底部极简在线指示圆点：舒适可见，动态响应网络状态 -->
    <div class="mt-auto pt-3 flex-shrink-0 flex flex-col items-center gap-1.5 cursor-default" :title="statusTooltip">
      <div class="relative flex items-center justify-center w-6 h-6">
        <div class="w-2.5 h-2.5 rounded-full transition-colors duration-300" :class="statusColorClass"></div>
        <div class="absolute w-4 h-4 rounded-full border transition-colors duration-300" :class="statusPingClass"></div>
      </div>
    </div>

  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { t, currentLang } from '../../i18n'
import { useAuthStore } from '../../stores/authStore'

const authStore = useAuthStore()

const props = defineProps<{
  activeView: string
  systemStatus?: 'ready' | 'syncing' | 'offline'
}>()

const emit = defineEmits<{
  (e: 'change-view', viewId: string): void
}>()

const activeId = computed(() => props.activeView)

// 响应系统网络状态 (对齐母本工程)
const status = computed(() => props.systemStatus || 'ready')
const statusColorClass = computed(() => {
  if (status.value === 'offline') return 'bg-[#ef4444] shadow-[0_0_8px_#ef4444]'
  if (status.value === 'syncing') return 'bg-[#eab308] shadow-[0_0_8px_#eab308]'
  return 'bg-[#10b981] shadow-[0_0_8px_#10b981]'
})
const statusPingClass = computed(() => {
  if (status.value === 'offline') return 'border-[#ef4444]/40'
  if (status.value === 'syncing') return 'border-[#eab308]/40 animate-ping'
  return 'border-[#10b981]/30 animate-ping'
})
const statusTooltip = computed(() => {
  if (status.value === 'offline') return `TitanCore: ${t('app.statusOffline')}`
  if (status.value === 'syncing') return `TitanCore: ${t('app.statusSyncing')}`
  return `TitanCore: ${t('app.statusReady')}`
})

const goTo = (id: string) => {
  emit('change-view', id)
}

// 语言判定：英文状态微调字间距与排版
const isEnglish = computed(() => currentLang.value.startsWith('en'))

// 7 项核心菜单：接驳 i18n 多语言 + 完整名称 + 快捷键微标
const CORE_MENU = computed(() => [
  { 
    id: 'discovery', 
    shortLabel: t('nav_short.discovery'), 
    label: t('nav.discovery'), 
    shortcutKey: '1', 
    icon: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm88-88a88,88,0,0,1-16.7,52.3L135.5,100.2a8,8,0,0,0-7.7-7.7L54.3,23.3A88,88,0,0,1,216,128Z' 
  },
  { 
    id: 'library', 
    shortLabel: t('nav_short.library'), 
    label: t('nav.library'), 
    shortcutKey: '2', 
    icon: 'M208,24H48A16,16,0,0,0,32,40V216a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V40A16,16,0,0,0,208,24Zm0,192H48V40H208V216ZM80,72H176V88H80Zm0,48H176v16H80Zm0,48H152v16H80Z' 
  },
  { 
    id: 'transmissions', 
    shortLabel: t('nav_short.transmissions'), 
    label: t('nav.transmissions'), 
    shortcutKey: '3', 
    icon: 'M222.14,105.86l-88-88a8,8,0,0,0-11.32,0l-88,88A8,8,0,0,0,40.49,119.5L88,71.94V184a8,8,0,0,0,16,0V71.94l47.51,47.52a8,8,0,0,0,11.32-11.32ZM216,208H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16Z' 
  },
  { 
    id: 'hajimi_beat', 
    shortLabel: t('nav_short.hajimi_beat'), 
    label: t('nav.hajimi_beat'), 
    shortcutKey: '4', 
    icon: 'M140,32V16a8,8,0,0,0-16,0V32A56.06,56.06,0,0,0,68,88v10.66A40.12,40.12,0,0,0,32,138.66V216a16,16,0,0,0,16,16H88a16,16,0,0,0,16-16V138.66A40.12,40.12,0,0,0,68,98.66V88a40,40,0,0,1,80,0v10.66A40.12,40.12,0,0,0,128,138.66V216a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V138.66a40.12,40.12,0,0,0-36-40V88A56.06,56.06,0,0,0,140,32ZM80,216H48V138.66a24,24,0,0,1,32,0Zm80,0V138.66a24,24,0,0,1,32,0V216Z' 
  },
  { 
    id: 'nexus_gate', 
    shortLabel: t('nav_short.nexus_gate'), 
    label: t('nav.nexus_gate'), 
    shortcutKey: '5', 
    icon: 'M240,112H216.59A88.13,88.13,0,0,0,144,39.41V16a8,8,0,0,0-16,0V39.41A88.13,88.13,0,0,0,55.41,112H32a8,8,0,0,0,0,16H55.41A88.13,88.13,0,0,0,128,200.59V224a8,8,0,0,0,16,0V200.59A88.13,88.13,0,0,0,216.59,128H240a8,8,0,0,0,0-16ZM128,184A72,72,0,1,1,200,112,72.08,72.08,0,0,1,128,184Z' 
  },
  { 
    id: 'uplink', 
    shortLabel: t('nav_short.uplink'), 
    label: t('nav.uplink'), 
    shortcutKey: '6', 
    icon: 'M232,128a104,104,0,1,0-208,0c0-41,23.81-76.41,58.55-92.93a8,8,0,0,1,6.9,14.48C62.09,63.14,44,89.5,44,128a88,88,0,0,0,168,0c0-38.5-18.09-64.86-45.45-78.45a8,8,0,1,1,6.9-14.48C208.19,51.59,232,87,232,128ZM128,64a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V72A8,8,0,0,0,128,64Z' 
  },
  { 
    id: 'settings', 
    shortLabel: t('nav_short.settings'), 
    label: t('nav.settings'), 
    shortcutKey: '7', 
    icon: 'M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm0-144a56,56,0,1,0,56,56A56.06,56.06,0,0,0,128,72Zm0,96a40,40,0,1,1,40-40A40,40,0,0,1,128,168Z' 
  }
])

const LOGIN_REQUIRED = new Set(['uplink', 'hajimi_beat', 'nexus_gate'])

const navItems = computed(() => {
  return CORE_MENU.value.filter(item => !LOGIN_REQUIRED.has(item.id) || authStore.isLoggedIn)
})

// 键盘快捷键支持 (后台逻辑 100% 完整无损)
const DEFAULT_KEYS = ['1', '2', '3', '4', '5', '6', '7']
let keyboardConfig: { enabled: boolean; keys: string[] } | null = null

const loadKeyboardConfig = async () => {
  try {
    const raw = await window.electron.invoke('sys:get-config', 'keyboard_settings')
    if (raw && typeof raw === 'object') {
      keyboardConfig = {
        enabled: raw.enabled !== false,
        keys: Array.isArray(raw.keys) && raw.keys.length === 7 ? raw.keys : DEFAULT_KEYS
      }
    } else {
      keyboardConfig = { enabled: true, keys: DEFAULT_KEYS }
    }
  } catch {
    keyboardConfig = { enabled: true, keys: DEFAULT_KEYS }
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (props.activeView === 'hajimi_beat') return
  if (!keyboardConfig || !keyboardConfig.enabled) return
  if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
  if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return

  const pressedKey = e.key.toUpperCase()
  const idx = keyboardConfig.keys.findIndex(k => k.toUpperCase() === pressedKey)
  if (idx !== -1 && idx < navItems.value.length) {
    const targetItem = navItems.value[idx]
    if (targetItem) {
      goTo(targetItem.id)
      e.preventDefault()
    }
  }
}

const onKeyboardUpdated = () => {
  loadKeyboardConfig()
}

onMounted(async () => {
  await loadKeyboardConfig()
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('titan-keyboard-updated', onKeyboardUpdated)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('titan-keyboard-updated', onKeyboardUpdated)
})
</script>

<style scoped>
.contain-layout { contain: layout style paint; }
</style>
