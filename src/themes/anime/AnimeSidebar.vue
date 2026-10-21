<!-- 文件名: src/themes/anime/AnimeSidebar.vue -->
<!-- Sakura 初樱晨曦 · 现代二次元悬浮磨砂白瓷果冻舱 (Anime Floating Jelly Rail) -->
<!-- 遵照最高指令：218px 专属二次元悬浮舱 + 超大圆弧圆角 (rounded-[32px]) + 果冻弹簧大弹跳手感 (active:scale-[0.88]) -->
<!-- 彻底根治看板娘放不下与被截断问题，看板娘完整舒展落座，全域接通 i18n 国际化，快捷键 1~7 完整保持 -->
<template>
  <aside class="anime-sidebar-rail w-[218px] h-[calc(100%-28px)] my-3.5 ml-3.5 flex flex-col items-center select-none contain-layout flex-shrink-0 z-40 bg-white/75 border border-white/85 rounded-[32px] p-3 relative backdrop-blur-2xl shadow-[0_12px_36px_rgba(200,160,185,0.18)]">
    
    <!-- 顶部樱粉极细微光边缘 -->
    <div class="absolute inset-x-8 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#ea8fb4]/50 to-transparent pointer-events-none"></div>

    <!-- 1. 顶部品牌微标：大大圆弧白瓷果冻徽章 (46x46px) -->
    <div class="flex items-center justify-center pb-3 pt-1 flex-shrink-0 cursor-default group" title="TitanCore 樱花初见版">
      <div class="relative w-11 h-11 rounded-[20px] flex items-center justify-center font-black text-white text-lg bg-gradient-to-br from-[#ea8fb4] via-[#f29ec0] to-[#f472b6] shadow-[0_6px_16px_rgba(234,143,180,0.38)] ring-2 ring-white/90 transition-transform duration-300 group-hover:scale-105 active:scale-95">
        <span class="tracking-tight">T</span>
      </div>
    </div>

    <!-- 2. 7 个导航菜单列表：超大圆弧药丸胶囊 (rounded-[22px]) + Q 弹果冻大弹跳手感 -->
    <nav class="w-full flex flex-col gap-1.5 min-h-0 overflow-y-auto scrollbar-hide py-1 relative z-10 contain-layout">
      <div
        v-for="item in navItems"
        :key="item.id"
        class="relative w-full flex-shrink-0"
      >
        <button
          type="button"
          @click="goTo(item.id)"
          class="anime-bubble-btn relative w-full h-[50px] rounded-[22px] px-4 flex items-center gap-3.5 cursor-pointer select-none border"
          :class="activeId === item.id 
            ? 'bg-gradient-to-r from-[#ffeef5] to-[#fff5f9] text-[#be3b6f] border-[#f5cbdc] shadow-[0_4px_16px_rgba(234,143,180,0.25)] font-black' 
            : 'border-transparent text-[#5d4e70] hover:text-[#d45989] hover:bg-white/85 hover:border-white/80'"
        >
          <!-- 激活项左侧萌系粉色果冻水滴点 -->
          <div 
            v-if="activeId === item.id" 
            class="w-2 h-2 rounded-full bg-[#ea8fb4] shadow-[0_0_8px_#ea8fb4] flex-shrink-0"
          ></div>

          <!-- 导航图标 (饱满 23px) -->
          <svg 
            width="23" 
            height="23" 
            fill="currentColor" 
            viewBox="0 0 256 256" 
            class="flex-shrink-0 transition-transform duration-200"
            :class="activeId === item.id ? 'text-[#be3b6f] scale-105' : 'group-hover:text-[#d45989]'"
          >
            <path :d="item.icon"></path>
          </svg>

          <!-- 桌面标准字标 (16px 加粗，遵照 PC 桌面软件规范，大屏清晰不费眼) -->
          <span class="truncate font-sans tracking-wide leading-none select-none text-[16px] font-bold">
            {{ item.shortLabel }}
          </span>
        </button>

      </div>
    </nav>

    <!-- 3. 底部看板娘豪宅：1:1 还原设计图，在线气泡 + 萌系漂浮星芒 ✨ + READY 胶囊 -->
    <div class="mt-auto pt-2 pb-1 flex-shrink-0 w-full flex flex-col items-center relative z-20">
      
      <!-- 萌系头顶在线果冻气泡 (1:1 还原设计图) -->
      <div class="mb-1 px-3 py-0.5 rounded-full bg-white/90 border border-emerald-200/80 shadow-[0_2px_8px_rgba(16,185,129,0.15)] flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-600 select-none">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 -ml-3"></span>
        <span>在线中~</span>
      </div>

      <!-- 看板娘自然落座：四周环绕 4 颗萌系初樱星芒 (1:1 还原设计图) -->
      <div class="w-full flex justify-center items-end relative min-h-[160px]">
        <!-- 左侧上星芒 -->
        <span class="absolute left-2 top-8 text-base text-pink-400 select-none pointer-events-none animate-sparkle-1">✦</span>
        <!-- 左侧下星芒 -->
        <span class="absolute left-1 bottom-8 text-xs text-purple-400 select-none pointer-events-none animate-sparkle-2">✨</span>
        <!-- 右侧上星芒 -->
        <span class="absolute right-2 top-10 text-xs text-pink-400 select-none pointer-events-none animate-sparkle-2">✨</span>
        <!-- 右侧下星芒 -->
        <span class="absolute right-1 bottom-10 text-base text-purple-400 select-none pointer-events-none animate-sparkle-1">✦</span>

        <MascotGirl class="w-[172px] pointer-events-auto" />
      </div>

      <!-- 底部白瓷 READY 状态胶囊 (1:1 还原设计图) -->
      <div 
        class="flex items-center gap-1.5 mt-1 px-3.5 py-1 rounded-full bg-white/85 border border-[#cbe4ff] shadow-[0_2px_8px_rgba(140,190,240,0.18)] text-[10.5px] font-black tracking-wider transition-all duration-300 cursor-default select-none" 
        :title="statusTooltip"
      >
        <span class="w-2 h-2 rounded-full transition-colors duration-300" :class="statusDotClass"></span>
        <span :class="statusTextClass">{{ statusText }}</span>
      </div>

    </div>

  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { t, currentLang } from '../../i18n'
import { useAuthStore } from '../../stores/authStore'
import MascotGirl from '../../components/MascotGirl.vue'

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
const statusText = computed(() => {
  if (status.value === 'offline') return t('app.statusOffline')
  if (status.value === 'syncing') return t('app.statusSyncing')
  return t('app.statusReady')
})
const statusTextClass = computed(() => {
  if (status.value === 'offline') return 'text-[#ef4444]'
  if (status.value === 'syncing') return 'text-[#d97706]'
  return 'text-[#736384]'
})
const statusDotClass = computed(() => {
  if (status.value === 'offline') return 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.7)]'
  if (status.value === 'syncing') return 'bg-[#eab308] shadow-[0_0_8px_rgba(234,179,8,0.7)] animate-pulse'
  return 'bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.7)] animate-pulse'
})
const statusTooltip = computed(() => `TitanCore: ${statusText.value}`)

const goTo = (id: string) => {
  emit('change-view', id)
}

// 语言判定：英文状态微调字间距与排版
const isEnglish = computed(() => currentLang.value.startsWith('en'))

// 7 项核心菜单：全面接通 i18n 国际化短标 + 完整标题 + 快捷键微标
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

// 键盘快捷键支持 (与原版逻辑 100% 吻合)
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

/* 武器库 03 物理果冻弹簧手感 (Spring Physics) */
.anime-bubble-btn {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.anime-bubble-btn:hover {
  transform: scale(1.03) translateY(-1px);
}
.anime-bubble-btn:active {
  transform: scale(0.88) translateY(2px);
}

@keyframes sparkle1 {
  0%, 100% { opacity: 0.2; transform: scale(0.8) rotate(0deg); }
  50% { opacity: 0.95; transform: scale(1.25) rotate(180deg); }
}

@keyframes sparkle2 {
  0%, 100% { opacity: 0.85; transform: scale(1.2) rotate(180deg); }
  50% { opacity: 0.15; transform: scale(0.7) rotate(0deg); }
}

.animate-sparkle-1 {
  animation: sparkle1 2.4s ease-in-out infinite;
}

.animate-sparkle-2 {
  animation: sparkle2 2.8s ease-in-out infinite 0.6s;
}
</style>