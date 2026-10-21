<!-- 文件名: src/themes/anime/AnimeTopbar.vue -->
<!-- Sakura 初樱晨曦 · 现代二次元悬浮磨砂白瓷顶栏 (Modern Anime Floating Topbar) -->
<!-- 遵照最高指令：超大圆角悬浮白瓷胶囊 (rounded-[24px]) + 柔和护眼莫兰迪柔粉 + 彻底消除英文大写标签 -->
<!-- 融入 Q 弹果冻弹簧大弹跳手感 (active:scale-[0.88])，严格锁死窗口控制与原有所有业务功能 -->
<template>
  <header 
    class="anime-topbar mx-3.5 mt-3.5 mb-1 h-[56px] rounded-[24px] flex items-center justify-between px-6 border border-white/85 bg-white/75 backdrop-blur-xl shadow-[0_6px_25px_rgba(200,160,185,0.12)] z-30 select-none relative flex-shrink-0"
    style="-webkit-app-region: drag;"
  >
    <!-- 左侧：纯净温润的二次元主标题 (初樱徽标 + 深墨紫中文) -->
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-[#fdeef5] border border-[#f5cbdc] flex items-center justify-center text-sm shadow-sm select-none">
        🌸
      </div>
      <h1 class="text-[#2d2438] font-black tracking-wide text-base font-sans">
        {{ currentBreadcrumb || t('nav.discovery') }}
      </h1>
    </div>

    <!-- 右侧：全药丸马卡龙微按键组 + 窗口三色控制 -->
    <div class="flex items-center gap-2.5" style="-webkit-app-region: no-drag;">
      
      <!-- 反馈心愿小铃铛 -->
      <button 
        type="button"
        @click="$emit('go-feedback')"
        class="w-8 h-8 rounded-full flex items-center justify-center text-[#554766] hover:text-[#c24b78] bg-white/85 hover:bg-white border border-[#f0e4ee] hover:border-[#f5cbdc] shadow-sm hover:shadow-[0_4px_12px_rgba(234,143,180,0.2)] transition-all duration-300 relative cursor-pointer active:scale-[0.88] hover:scale-110"
        :title="t('nav.uplink')"
      >
        <span 
          v-if="hasUnreadFeedback" 
          class="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ea8fb4] shadow-[0_0_6px_#ea8fb4] animate-ping"
        ></span>
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </button>

      <!-- Steam 重启 -->
      <button 
        type="button"
        @click="$emit('restart-steam')"
        :disabled="isRestartingSteam"
        class="w-8 h-8 rounded-full flex items-center justify-center text-[#554766] hover:text-[#c24b78] bg-white/85 hover:bg-white border border-[#f0e4ee] hover:border-[#f5cbdc] shadow-sm hover:shadow-[0_4px_12px_rgba(234,143,180,0.2)] transition-all duration-300 disabled:opacity-40 cursor-pointer active:scale-[0.88] hover:scale-110"
        :title="t('app.steamRestart')"
      >
        <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" :class="isRestartingSteam ? 'animate-spin text-[#ea8fb4]' : ''">
          <path d="M224,128a96,96,0,1,1-96-96,8,8,0,0,1,0,16,80,80,0,1,0,80,80,8,8,0,0,1,16,0Zm-40-64H136a8,8,0,0,0,0,16h24.69L115,125.66a8,8,0,0,0,11.32,11.32L172,91.31V116a8,8,0,0,0,16,0V68A8,8,0,0,0,184,60Z"></path>
        </svg>
      </button>

      <!-- 音频同步律动 -->
      <button 
        type="button"
        @click="$emit('toggle-audio')"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-[0.88] hover:scale-110"
        :class="audioSyncLevel === 0 
          ? 'text-[#554766] hover:text-[#0284c7] bg-white/85 hover:bg-white border border-[#f0e4ee] shadow-sm' 
          : 'bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd] shadow-[0_0_12px_rgba(56,189,248,0.25)]'"
        :title="audioSyncLevel === 0 ? t('app.audioSyncOff') : t('app.audioSyncOn')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      </button>

      <!-- 性能模式开关 -->
      <button 
        type="button"
        @click="$emit('toggle-performance')"
        class="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer active:scale-[0.88] hover:scale-110"
        :class="performanceMode 
          ? 'bg-[#fdeef5] text-[#c24b78] border border-[#f5cbdc] shadow-[0_0_12px_rgba(234,143,180,0.3)]' 
          : 'text-[#554766] hover:text-[#c24b78] bg-white/85 hover:bg-white border border-[#f0e4ee] shadow-sm'"
        :title="t('app.perfMode')"
      >
        <svg width="15" height="15" fill="currentColor" viewBox="0 0 256 256" class="transition-transform duration-500" :class="performanceMode ? 'rotate-180 text-[#ea8fb4]' : ''">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"></path>
        </svg>
      </button>

      <!-- 分隔线 -->
      <div class="w-[1px] h-4 mx-1 bg-[#eadfe8]"></div>

      <!-- 窗口控制三色圆点 (柔和护眼马卡龙) -->
      <div class="flex items-center gap-2 pl-0.5">
        <button 
          type="button"
          @click="winControl.min()" 
          class="w-3.5 h-3.5 rounded-full bg-[#86efac] hover:opacity-80 transition-all duration-200 active:scale-75 hover:scale-110 shadow-sm cursor-pointer"
          title="最小化"
        ></button>
        <button 
          type="button"
          @click="winControl.max()" 
          class="w-3.5 h-3.5 rounded-full bg-[#fde047] hover:opacity-80 transition-all duration-200 active:scale-75 hover:scale-110 shadow-sm cursor-pointer"
          title="最大化"
        ></button>
        <button 
          type="button"
          @click="winControl.close()" 
          class="w-3.5 h-3.5 rounded-full bg-[#fca5a5] hover:opacity-80 transition-all duration-200 active:scale-75 hover:scale-110 shadow-sm cursor-pointer"
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