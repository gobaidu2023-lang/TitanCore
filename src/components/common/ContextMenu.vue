// 文件名: src/components/common/ContextMenu.vue
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      :class="menuClass"
      :style="{ left: x + 'px', top: y + 'px' }"
      @click.stop
    >
      <div v-if="title" :class="titleClass">
        <span>{{ title }}</span>
        <span class="w-1.5 h-1.5 rounded-full" :class="currentTheme === 'anime' ? 'bg-pink-500 shadow-[0_0_6px_#f472b6]' : 'bg-[#00f3ff] shadow-[0_0_6px_#00f3ff]'"></span>
      </div>
      <div class="py-1">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from '../../composables/useTheme'

const { currentTheme } = useTheme()

const props = defineProps<{
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  variant?: 'default' | 'library'
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

// Esc 关闭（与 BaseModal 对齐）：仅当前可见时响应
const handleEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) emit('close')
}
onMounted(() => document.addEventListener('keydown', handleEsc))
onUnmounted(() => document.removeEventListener('keydown', handleEsc))

const menuClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'fixed z-[9999] w-64 bg-white/98 border-2 border-[#bce8ff] ring-2 ring-white/90 rounded-2xl shadow-[0_16px_40px_rgba(215,165,235,0.32)] overflow-hidden font-sans select-none text-[#1e192b] backdrop-blur-xl transition-all'
  }
  if (props.variant === 'library') {
    return 'fixed z-[9999] w-64 bg-[#0a0a0a] border border-[#00f3ff]/30 rounded-lg shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden font-sans select-none'
  }
  return 'fixed z-[9999] bg-bg-elevated border border-primary/30 rounded-theme shadow-[0_15px_40px_rgba(0,0,0,0.8)] overflow-hidden font-sans select-none'
})

const titleClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'px-4 py-2.5 text-[11px] font-black text-[#d6336c] uppercase tracking-wider border-b border-pink-100 bg-gradient-to-r from-pink-50/90 via-white/80 to-sky-50/90 flex items-center justify-between'
  }
  if (props.variant === 'library') {
    return 'px-4 py-2 text-[9px] font-black text-[#00f3ff] uppercase tracking-[0.2em] border-b border-white/5 mb-1 flex items-center justify-between'
  }
  return 'px-4 py-2 text-[10px] font-black text-primary uppercase tracking-widest border-b border-white/5 bg-black/20 flex items-center justify-between'
})
</script>