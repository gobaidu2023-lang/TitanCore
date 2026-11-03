<template>
  <BaseModal 
    :visible="visible" 
    @close="close" 
    :show-close="true"
    :container-class="containerClass"
  >
    <!-- 顶部流光细线 -->
    <div class="absolute top-0 left-0 right-0 h-px pointer-events-none" :class="topGlowClass"></div>

    <div class="flex flex-col gap-5">
      <h3 class="text-base font-bold tracking-wide flex items-center gap-2.5" :class="titleTextClass">
        <span class="w-[3px] h-[18px] rounded-sm" :class="accentBarClass"></span>
        {{ t('settings.exp.title') }}
      </h3>

      <div class="flex flex-col gap-3">
        <!-- 开启联机 -->
        <div class="p-4 rounded-lg border flex items-center justify-between transition-colors" :class="cardClass">
          <span class="text-sm font-bold" :class="cardTextClass">🎮 {{ t('settings.exp.onlineLaunch') }}</span>
          <button 
            type="button" 
            role="switch" 
            :aria-checked="prefEnableOnlineLaunch" 
            @click="toggle('pref_enable_online_launch')"
            class="w-10 h-[22px] rounded-full transition-colors relative"
            :class="prefEnableOnlineLaunch ? switchActiveClass : switchInactiveClass"
          >
            <span 
              class="absolute top-[3px] w-4 h-4 rounded-full transition-all" 
              :class="[
                prefEnableOnlineLaunch ? 'left-[21px]' : 'left-[3px]',
                currentTheme === 'anime' ? 'bg-white' : 'bg-black'
              ]"
            ></span>
          </button>
        </div>
        <!-- 导入清单 -->
        <div class="p-4 rounded-lg border flex items-center justify-between transition-colors" :class="cardClass">
          <span class="text-sm font-bold" :class="cardTextClass">📥 {{ t('settings.exp.luaImport') }}</span>
          <button 
            type="button" 
            role="switch" 
            :aria-checked="prefEnableLuaImport" 
            @click="toggle('pref_enable_lua_import')"
            class="w-10 h-[22px] rounded-full transition-colors relative"
            :class="prefEnableLuaImport ? switchActiveClass : switchInactiveClass"
          >
            <span 
              class="absolute top-[3px] w-4 h-4 rounded-full transition-all" 
              :class="[
                prefEnableLuaImport ? 'left-[21px]' : 'left-[3px]',
                currentTheme === 'anime' ? 'bg-white' : 'bg-black'
              ]"
            ></span>
          </button>
        </div>
        <!-- 游戏快捷启动 -->
        <div class="p-4 rounded-lg border flex items-center justify-between transition-colors" :class="cardClass">
          <span class="text-sm font-bold" :class="cardTextClass">⚡ {{ t('settings.exp.gameFastLaunch') }}</span>
          <button 
            type="button" 
            role="switch" 
            :aria-checked="prefEnableGameFastLaunch" 
            @click="toggle('pref_enable_game_fast_launch')"
            class="w-10 h-[22px] rounded-full transition-colors relative cursor-pointer"
            :class="prefEnableGameFastLaunch ? switchActiveClass : switchInactiveClass"
          >
            <span 
              class="absolute top-[3px] w-4 h-4 rounded-full transition-all" 
              :class="[
                prefEnableGameFastLaunch ? 'left-[21px]' : 'left-[3px]',
                currentTheme === 'anime' ? 'bg-white' : 'bg-black'
              ]"
            ></span>
          </button>
        </div>
      </div>

      <!-- fix50: 工具箱(注册表驱动,后续工具零改动本模态框) -->
      <div class="flex flex-col gap-3">
        <h4 class="text-xs font-bold tracking-widest uppercase flex items-center gap-2.5 pt-1" :class="sectionTitleClass">
          <span class="w-[3px] h-[14px] rounded-sm" :class="accentBarClass"></span>
          {{ t('settings.exp.toolsTitle') }}
        </h4>
        <ToolCard v-for="tool in TOOLS" :key="tool.id" :tool="tool" />
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import ToolCard from './ToolCard.vue'
import { TOOLS } from './toolRegistry'
import { t } from '../../i18n'
import { useTheme } from '../../composables/useTheme'
import { useLibraryStore } from '../../stores/libraryStore'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', v: boolean): void; (e: 'close'): void }>()

const { currentTheme } = useTheme()

const containerClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'max-w-sm w-full bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] text-[#1e192b] p-7 relative overflow-hidden'
  }
  if (currentTheme.value === 'minimal') {
    return 'max-w-sm w-full bg-[#0b0e1a]/95 border border-[#00f2ff]/30 shadow-[0_0_40px_rgba(0,242,255,0.18)] text-white backdrop-blur-xl p-7 relative overflow-hidden'
  }
  return 'max-w-sm w-full bg-[#0c0d12]/95 border border-white/10 shadow-[0_16px_48px_rgba(0,0,0,0.85)] text-white p-7 relative overflow-hidden'
})

const topGlowClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-gradient-to-r from-transparent via-[#ff85b3]/70 to-transparent'
  if (currentTheme.value === 'minimal') return 'bg-gradient-to-r from-transparent via-[#00f2ff]/60 to-transparent'
  return 'bg-gradient-to-r from-transparent via-[#00f3ff]/40 to-transparent'
})

const titleTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const accentBarClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-gradient-to-b from-[#ff85b3] to-[#ff9ec7] shadow-[0_0_8px_rgba(255,133,179,0.5)]'
  if (currentTheme.value === 'minimal') return 'bg-gradient-to-b from-[#00f2ff] to-[#7b2cbf] shadow-[0_0_8px_rgba(0,242,255,0.5)]'
  return 'bg-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.5)]'
})

const cardClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-pink-50/40 border-pink-200/70'
  if (currentTheme.value === 'minimal') return 'bg-[#131b2e]/60 border-[#00f2ff]/20'
  return 'bg-white/[0.02] border-white/5'
})

const cardTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const sectionTitleClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#64748b]'
  return 'text-zinc-400'
})

const switchActiveClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-gradient-to-r from-[#ff85b3] to-[#ff9ec7]'
  if (currentTheme.value === 'minimal') return 'bg-[#00f2ff]'
  return 'bg-[#00f3ff]'
})

const switchInactiveClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-slate-200'
  if (currentTheme.value === 'minimal') return 'bg-[#131b2e]'
  return 'bg-white/10'
})

const libraryStore = useLibraryStore()
const prefEnableOnlineLaunch = ref(false)
const prefEnableLuaImport = ref(false)
const prefEnableGameFastLaunch = computed(() => libraryStore.prefEnableGameFastLaunch)

async function loadPrefs() {
  try {
    const [o, l] = await Promise.all([
      window.electron.invoke('sys:get-config', 'pref_enable_online_launch'),
      window.electron.invoke('sys:get-config', 'pref_enable_lua_import')
    ])
    prefEnableOnlineLaunch.value = !!o
    prefEnableLuaImport.value = !!l
    await libraryStore.loadGameFastLaunchPref()
  } catch { /* 读取失败按默认关 */ }
}

async function toggle(key: string) {
  let next = false
  if (key === 'pref_enable_online_launch') next = prefEnableOnlineLaunch.value = !prefEnableOnlineLaunch.value
  else if (key === 'pref_enable_lua_import') next = prefEnableLuaImport.value = !prefEnableLuaImport.value
  else if (key === 'pref_enable_game_fast_launch') {
    await libraryStore.setGameFastLaunchPref(!libraryStore.prefEnableGameFastLaunch)
    return
  }
  try { await window.electron.invoke('sys:set-config', key, next) } catch { /* 持久化失败仅影响重启后 */ }
}

onMounted(loadPrefs)
function close() {
  emit('update:visible', false)
  emit('close')
}
</script>
