<!-- 文件名: src/themes/minimal/TechTopbar.vue -->
<!-- 设计稿2（方案B：深空星渊 · 极简未来风）2026 纯净极简版 -->
<!-- 彻底铲除所有多余的中二英文副标签、伪科幻小码！回归现代前沿桌面软件的纯粹、通透与大气 -->
<!-- 严格锁死原有业务功能：窗口三色控制、反馈通知、Steam重启旋转、音频同步、性能模式 -->
<template>
  <header 
    class="tech-topbar h-16 w-full flex items-center justify-between px-8 z-30 select-none relative flex-shrink-0"
    style="
      -webkit-app-region: drag;
      background: rgba(6, 8, 15, 0.7);
      backdrop-filter: blur(24px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    "
  >
    <!-- 左侧：纯净、有力、零冗余的页面主标题（彻底删除任何伪装饰副标） -->
    <div class="flex items-center gap-3">
      <div class="w-1.5 h-4 rounded-full bg-[#00f2ff] shadow-[0_0_10px_#00f2ff]"></div>
      <h1 class="text-white/95 font-bold tracking-wide text-lg font-sans">
        {{ currentBreadcrumb || t('nav.discovery') }}
      </h1>
    </div>

    <!-- 右侧：现代桌面级极简控制工具组 -->
    <div class="flex items-center gap-2.5" style="-webkit-app-region: no-drag;">
      
      <!-- 反馈通知 -->
      <button 
        type="button"
        @click="$emit('go-feedback')"
        class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative cursor-pointer hover:bg-white/[0.08] text-[#8c9fb5] hover:text-white active:scale-95"
        :title="t('nav.uplink')"
      >
        <span 
          v-if="hasUnreadFeedback" 
          class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#ff5c00] shadow-[0_0_6px_#ff5c00]"
        ></span>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>

      <!-- Steam 重启 -->
      <button 
        type="button"
        @click="$emit('restart-steam')"
        :disabled="isRestartingSteam"
        class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer hover:bg-white/[0.08] text-[#8c9fb5] hover:text-white active:scale-95"
        :title="t('app.steamRestart')"
      >
        <svg width="17" height="17" fill="currentColor" viewBox="0 0 256 256" :class="isRestartingSteam ? 'animate-spin text-[#00F2FF]' : ''">
          <path d="M224,128a96,96,0,1,1-96-96,8,8,0,0,1,0,16,80,80,0,1,0,80,80,8,8,0,0,1,16,0Zm-40-64H136a8,8,0,0,0,0,16h24.69L115,125.66a8,8,0,0,0,11.32,11.32L172,91.31V116a8,8,0,0,0,16,0V68A8,8,0,0,0,184,60Z"></path>
        </svg>
      </button>

      <!-- 音频同步律动 -->
      <button 
        type="button"
        @click="$emit('toggle-audio')"
        class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer active:scale-95"
        :class="audioSyncLevel === 0 ? 'text-[#8c9fb5] hover:bg-white/[0.08] hover:text-white' : 'text-[#00f2ff] bg-[#00f2ff]/20 shadow-[0_0_10px_rgba(0,242,255,0.4)]'"
        :title="audioSyncLevel === 0 ? t('app.audioSyncOff') : t('app.audioSyncOn')"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      </button>

      <!-- 性能模式开关 -->
      <button 
        type="button"
        @click="$emit('toggle-performance')"
        class="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer active:scale-95"
        :class="performanceMode ? 'text-[#00f2ff] bg-[#00f2ff]/20 shadow-[0_0_10px_rgba(0,242,255,0.4)]' : 'text-[#8c9fb5] hover:bg-white/[0.08] hover:text-white'"
        :title="t('app.perfMode')"
      >
        <svg width="17" height="17" fill="currentColor" viewBox="0 0 256 256" class="transition-transform duration-500" :class="performanceMode ? 'rotate-180 text-[#00F2FF]' : ''">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"></path>
        </svg>
      </button>

      <!-- 分隔线 -->
      <div class="w-[1px] h-4 mx-1 bg-white/[0.1]"></div>

      <!-- 窗口控制三色圆点 -->
      <div class="flex items-center gap-2 pl-1">
        <button 
          type="button"
          @click="winControl.min()" 
          class="w-3.5 h-3.5 rounded-full hover:opacity-80 transition-opacity active:scale-90 cursor-pointer bg-[#10B981] shadow-[0_0_6px_rgba(16,185,129,0.4)]"
          title="最小化"
        ></button>
        <button 
          type="button"
          @click="winControl.max()" 
          class="w-3.5 h-3.5 rounded-full hover:opacity-80 transition-opacity active:scale-90 cursor-pointer bg-[#F59E0B] shadow-[0_0_6px_rgba(245,158,11,0.4)]"
          title="最大化"
        ></button>
        <button 
          type="button"
          @click="winControl.close()" 
          class="w-3.5 h-3.5 rounded-full hover:opacity-80 transition-opacity active:scale-90 cursor-pointer bg-[#EF4444] shadow-[0_0_6px_rgba(239,68,68,0.4)]"
          title="关闭"
        ></button>
      </div>

    </div>
  </header>
</template>

<script setup lang="ts">
import { t } from '../../i18n'

defineProps<{
  currentBreadcrumb: string
  hasUnreadFeedback?: boolean
  isRestartingSteam?: boolean
  audioSyncLevel?: number
  performanceMode?: boolean
  winControl: {
    min: () => void
    max: () => void
    close: () => void
  }
}>()

defineEmits<{
  (e: 'go-feedback'): void
  (e: 'restart-steam'): void
  (e: 'toggle-audio'): void
  (e: 'toggle-performance'): void
}>()
</script>
