<template>
  <BaseModal
    :visible="visible"
    @close="emitClose"
    :show-close="true"
    container-class="w-[92vw] max-w-[540px] max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-6 sm:p-8 relative flex flex-col gap-5 sm:gap-6"
  >
    <!-- 顶部赛博青色微光流线 -->
    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent pointer-events-none"></div>

    <!-- 弹窗主标题区 (PC桌面级大字号与双语徽标) -->
    <div class="flex items-center justify-between border-b border-white/[0.06] pb-4">
      <div class="flex items-center gap-3">
        <span class="w-[4px] h-[22px] bg-[#00f3ff] rounded-sm shadow-[0_0_10px_rgba(0,243,255,0.6)]"></span>
        <h3 class="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2.5">
          {{ t('settings.update.appOnlyTitle') || t('settings.update.title') || '主程序版本更新' }}
        </h3>
      </div>
      <span class="text-[11px] font-mono tracking-widest px-2.5 py-1 rounded bg-[#00f3ff]/10 border border-[#00f3ff]/25 text-[#00f3ff] uppercase font-bold">
        CLIENT UPDATE
      </span>
    </div>

    <!-- 版本对比大卡片 -->
    <div class="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4">
      <!-- 当前版本 -->
      <div class="flex flex-col gap-1 min-w-0">
        <span class="text-xs text-zinc-500 font-mono tracking-wider uppercase">CURRENT / 当前</span>
        <span class="text-base sm:text-lg font-mono font-bold text-zinc-400 truncate">
          v{{ currentVersion || '1.0.0' }}
        </span>
      </div>

      <!-- 霓虹动态过渡指示箭头 -->
      <div class="flex items-center justify-center px-2">
        <div class="w-8 h-8 rounded-full bg-[#00f3ff]/10 border border-[#00f3ff]/30 flex items-center justify-center text-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.3)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </div>
      </div>

      <!-- 最新版本 -->
      <div class="flex flex-col gap-1 items-end min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs text-[#00f3ff] font-mono tracking-wider uppercase">LATEST / 最新</span>
          <span class="text-[10px] font-bold px-1.5 py-0.2 bg-[#00f3ff] text-black rounded font-mono">NEW</span>
        </div>
        <span class="text-xl sm:text-2xl font-mono font-black text-[#00f3ff] tracking-tight truncate drop-shadow-[0_0_12px_rgba(0,243,255,0.4)]">
          v{{ latestVersion || '最新版' }}
        </span>
      </div>
    </div>

    <!-- 更新亮点与特性列表 (通用中英文双语高亮兜底) -->
    <div class="bg-[#00f3ff]/[0.03] border border-[#00f3ff]/15 rounded-xl p-4 sm:p-5 flex flex-col gap-3">
      <div class="flex items-center gap-2 text-xs font-bold text-[#00f3ff] tracking-widest uppercase">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span>更新亮点 / Release Highlights</span>
      </div>

      <ul class="flex flex-col gap-2 text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
        <li class="flex items-start gap-2.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[#00f3ff] mt-2 shrink-0 shadow-[0_0_6px_rgba(0,243,255,0.8)]"></span>
          <span>底层运行环境与多源竞速下载链路深度调优</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[#00f3ff] mt-2 shrink-0 shadow-[0_0_6px_rgba(0,243,255,0.8)]"></span>
          <span>外部挂载工具箱生命周期强化与并发任务自愈守护</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="w-1.5 h-1.5 rounded-full bg-[#00f3ff] mt-2 shrink-0 shadow-[0_0_6px_rgba(0,243,255,0.8)]"></span>
          <span>桌面多分辨率视域适配与工控视觉排版升级</span>
        </li>
      </ul>

      <!-- 队列与后台机制说明 -->
      <div class="border-t border-[#00f3ff]/10 pt-2.5 mt-1 flex items-center gap-2 text-xs text-[#00f3ff]/80">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <span>{{ t('settings.update.queueDesc') || t('settings.updateQueueNote') || '确认更新后将在后台静默下载，就绪后提示快速重启生效' }}</span>
      </div>
    </div>

    <!-- 底部操作按钮群 (扩大点击靶区至 h-11，PC 键盘交互友好) -->
    <div class="flex items-center gap-3 w-full pt-1">
      <button
        type="button"
        @click="emitClose"
        class="flex-1 h-11 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.2] text-zinc-300 hover:text-white font-medium text-sm sm:text-base rounded-lg transition-all"
      >
        {{ t('settings.update.later') || t('common.cancel') || '稍后提醒' }}
      </button>

      <button
        type="button"
        @click="emitConfirm"
        class="flex-[1.2] h-11 bg-[#00f3ff] hover:bg-[#2bf5ff] active:bg-[#00d0db] text-black font-bold text-sm sm:text-base rounded-lg transition-all shadow-[0_0_20px_rgba(0,243,255,0.25)] hover:shadow-[0_0_28px_rgba(0,243,255,0.4)] flex items-center justify-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="shrink-0">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>{{ t('settings.update.confirmUpdate') || t('settings.confirmUpdate') || '立即更新' }}</span>
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import BaseModal from '../common/BaseModal.vue'
import { t } from '../../i18n'

const props = defineProps<{
  visible: boolean
  currentVersion?: string
  latestVersion?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'close'): void
  (e: 'confirm'): void
}>()

function emitClose() {
  emit('update:visible', false)
  emit('close')
}

function emitConfirm() {
  emit('confirm')
}
</script>
