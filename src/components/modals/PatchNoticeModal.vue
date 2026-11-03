<template>
  <BaseModal 
    :visible="visible" 
    @close="handleCancel" 
    :show-close="true"
    container-class="w-[480px] p-6 max-w-[92vw]"
  >
    <div class="flex flex-col gap-4">
      <!-- 弹窗标题 (三主题自适应) -->
      <div class="flex items-center gap-2.5">
        <div 
          class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
          :class="[
            currentTheme === 'anime' 
              ? 'bg-[#ffeef5] text-[#c24b78]' 
              : currentTheme === 'minimal'
                ? 'bg-[#00f2ff]/15 text-[#00f2ff] shadow-[0_0_10px_rgba(0,242,255,0.2)]'
                : 'bg-[#00f3ff]/15 text-[#00f3ff]'
          ]"
        >
          🛡️
        </div>
        <h3 
          class="text-base font-bold tracking-wide" 
          :class="[
            currentTheme === 'anime' 
              ? 'text-[#2b2238]' 
              : currentTheme === 'minimal'
                ? 'text-white font-mono tracking-wider'
                : 'text-white'
          ]"
        >
          {{ t('library.patchNotice.title') || '安全提示' }}
        </h3>
      </div>

      <!-- 杀软提示正文 (三主题自适应字色与排版) -->
      <p 
        class="text-sm leading-relaxed" 
        :class="[
          currentTheme === 'anime' 
            ? 'text-[#554763]' 
            : currentTheme === 'minimal'
              ? 'text-slate-300'
              : 'text-gray-300'
        ]"
      >
        {{ t('library.patchNotice.content') || '游戏补丁会被杀毒软件误报，请提前关闭杀软。如果因杀软误删导致补丁安装失败，请关闭杀软后，重新点击“自动安装补丁”。' }}
      </p>

      <!-- 不再提醒复选框 (三主题适配) -->
      <div 
        class="flex items-center gap-2 pt-1 cursor-pointer select-none" 
        @click="dontRemind = !dontRemind"
      >
        <input 
          type="checkbox" 
          v-model="dontRemind" 
          class="w-4 h-4 rounded cursor-pointer transition-colors"
          :class="currentTheme === 'anime' ? 'accent-[#ff66b2]' : 'accent-[#00f2ff]'"
        />
        <span 
          class="text-xs" 
          :class="[
            currentTheme === 'anime' 
              ? 'text-[#7a6a8c]' 
              : currentTheme === 'minimal'
                ? 'text-slate-400 font-mono'
                : 'text-gray-400'
          ]"
        >
          {{ t('library.patchNotice.dontRemind') || '我知道了 不再提醒' }}
        </span>
      </div>

      <!-- 底部控制按钮 (三主题自适应高质感按键) -->
      <div class="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          @click="handleCancel"
          class="px-4 py-2 text-sm rounded-lg transition-all cursor-pointer border active:scale-95"
          :class="[
            currentTheme === 'anime' 
              ? 'bg-white text-[#554763] border-[#f5cbdc] hover:bg-pink-50 hover:text-[#d6336c] shadow-sm' 
              : currentTheme === 'minimal'
                ? 'bg-[#121824] text-slate-300 border-white/10 hover:border-[#00f2ff]/40 hover:text-white'
                : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/20 hover:text-white'
          ]"
        >
          {{ t('common.cancel') || '取消' }}
        </button>

        <button
          type="button"
          @click="handleConfirm"
          class="px-5 py-2 text-sm font-bold rounded-lg transition-all cursor-pointer active:scale-95 shadow-sm"
          :class="[
            currentTheme === 'anime' 
              ? 'bg-gradient-to-r from-[#ff85b3] to-[#ff66b2] hover:opacity-95 text-white shadow-[0_4px_12px_rgba(255,102,178,0.3)]' 
              : currentTheme === 'minimal'
                ? 'bg-[#00f2ff] hover:bg-[#33f5ff] text-black font-black shadow-[0_0_20px_rgba(0,242,255,0.3)]'
                : 'bg-[#00f3ff] hover:bg-[#33f5ff] text-black font-bold shadow-[0_0_15px_rgba(0,243,255,0.25)]'
          ]"
        >
          {{ t('common.confirm') || '确定' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import { useTheme } from '../../composables/useTheme'
import { t } from '../../i18n'

const { currentTheme } = useTheme()

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const dontRemind = ref(false)

const handleConfirm = () => {
  if (dontRemind.value) {
    localStorage.setItem('tc_pref_patch_notice_dismissed', '1')
  }
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>
