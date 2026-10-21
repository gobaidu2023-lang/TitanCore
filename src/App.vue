<template>
  <Transition name="splash-fade">
    <div v-if="showBootSplash" class="fixed inset-0 z-[9999] bg-[#000000] flex items-center justify-center boot-splash select-none overflow-hidden">
      <div class="relative flex items-center justify-center">
        <h1 class="tc-pure-logo font-black font-code select-none">
          T
        </h1>
      </div>
    </div>
  </Transition>

  <div v-if="showInitError" class="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-md flex items-center justify-center">
    <div class="text-center max-w-lg p-10 border border-red-500/30 rounded-theme bg-bg-panel">
      <h2 class="text-2xl font-bold text-red-500 mb-4 tracking-wider">{{ t('app.initFail') }}</h2>
      <p class="text-gray-400 mb-6 font-code text-sm">{{ initErrorMsg }}</p>
      <button class="px-6 py-2 bg-primary text-black font-bold rounded hover:scale-105 transition-all">{{ t('app.retry') }}</button>
    </div>
  </div>

  <div 
    class="flex h-screen w-screen font-sans selection:bg-[#00F2FF] selection:text-black overflow-hidden relative transition-colors duration-300"
    :class="{
      'text-[#2b2238] border-[#f0e4ee] border': currentTheme === 'anime',
      'border border-white/5 bg-black text-white': currentTheme !== 'anime' && currentTheme !== 'minimal'
    }"
    :style="currentTheme === 'anime' ? {
      background: 'radial-gradient(circle at 12% 18%, rgba(240, 190, 210, 0.22) 0%, transparent 45%), radial-gradient(circle at 88% 82%, rgba(195, 215, 240, 0.25) 0%, transparent 50%), linear-gradient(145deg, #ece5eb 0%, #e5dee4 50%, #e9e2e8 100%)',
      color: '#2d2438'
    } : (currentTheme === 'minimal' ? {
      background: 'radial-gradient(circle at 50% 0%, rgba(0, 242, 255, 0.08) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(0, 102, 255, 0.06) 0%, transparent 50%), linear-gradient(180deg, #070b14 0%, #04060b 100%)',
      color: '#FFFFFF',
      boxShadow: '0 0 45px rgba(0, 242, 255, 0.16), inset 0 0 1px rgba(255,255,255,0.08)',
      border: '1px solid rgba(0, 242, 255, 0.26)'
    } : {})"
  >
    <!-- 侧栏：独立主题包多态分发 -->
    <AnimeSidebar 
      v-if="currentTheme === 'anime'" 
      :active-view="currentView" 
      :system-status="systemStatus"
      @change-view="(id) => currentView = id" 
    />
    <TechSidebar
      v-else-if="currentTheme === 'minimal'"
      :active-view="currentView"
      :system-status="systemStatus"
      @change-view="(id) => currentView = id"
    />
    <Sidebar 
      v-else 
      @change-view="(id) => currentView = id" 
      :system-status="systemStatus" 
      :active-view="currentView" 
    />

    <div 
      v-show="audioSyncLevel === 1 && !performanceMode" 
      class="absolute inset-0 pointer-events-none z-[40] will-change-opacity transform-gpu"
      style="opacity: var(--halo-opacity, 0); background: radial-gradient(circle at center, transparent 40%, hsla(var(--mid-hue, 183), 100%, 50%, 0.15) 100%)"
    ></div>

    <main ref="mainContainer" class="flex-1 flex flex-col min-w-0 relative">
      <div class="absolute left-[-30px] top-0 bottom-0 w-[60px] z-50 pointer-events-none">
        <div 
          v-show="audioSyncLevel === 1 && !performanceMode" 
          class="quantum-pillar will-change-transform transform-gpu"
          :style="{ transform: `translateY(-50%) scaleY(var(--bass-scale, 0))` }"
        ></div>
      </div>

      <!-- 顶栏：独立主题包多态分发 -->
      <AnimeTopbar
        v-if="currentTheme === 'anime'"
        :current-breadcrumb="currentBreadcrumb"
        :has-unread-feedback="feedbackStore.hasUnread"
        :is-restarting-steam="isRestartingSteam"
        :audio-sync-level="audioSyncLevel"
        :performance-mode="performanceMode"
        :win-control="winControl"
        @go-feedback="goToFeedback"
        @restart-steam="handleRestartSteam"
        @toggle-audio="toggleAudioSync"
        @toggle-performance="togglePerformanceMode"
      />
      <TechTopbar
        v-else-if="currentTheme === 'minimal'"
        :current-breadcrumb="currentBreadcrumb"
        :has-unread-feedback="feedbackStore.hasUnread"
        :is-restarting-steam="isRestartingSteam"
        :audio-sync-level="audioSyncLevel"
        :performance-mode="performanceMode"
        :win-control="winControl"
        @go-feedback="goToFeedback"
        @restart-steam="handleRestartSteam"
        @toggle-audio="toggleAudioSync"
        @toggle-performance="togglePerformanceMode"
      />

      <!-- 原版经典工业暗黑顶栏 (1:1 像素级对齐图2原版母本) -->
      <header 
        v-else
        class="h-20 w-full flex items-center px-8 border-b z-20 backdrop-blur-sm sticky top-0 select-none bg-black/50 border-white/5" 
        style="-webkit-app-region: drag;"
      >
        <div class="flex-1">
          <h2 class="font-code tracking-[0.2em] font-black uppercase flex items-center gap-2 text-xs text-primary font-bold opacity-80">
            {{ currentBreadcrumb }}
          </h2>
        </div>

        <div class="flex-1 flex justify-end gap-6 items-center h-full">
          <div class="flex items-center gap-4" style="-webkit-app-region: no-drag;">
            <!-- 反馈按钮 -->
            <div class="steam-restart-container relative group">
              <div class="flowing-light-ring" :class="{ 'stop-animation': performanceMode, 'active': feedbackStore.hasUnread }" style="background: conic-gradient(from 180deg, #ff00aa 0%, transparent 60%);"></div>
              <button @click="goToFeedback" class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 cursor-pointer" :class="feedbackStore.hasUnread ? 'bg-[#ff00aa]/20 text-[#ff00aa] shadow-[0_0_15px_rgba(255,0,170,0.5)]' : 'text-text-muted hover:bg-white/10 hover:text-[#ff00aa]'" :title="t('nav.uplink')">
                <div v-if="feedbackStore.hasUnread" class="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ff00aa] animate-ping"></div>
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
              </button>
            </div>

            <!-- Steam 重启 -->
            <div class="steam-restart-container relative group">
              <div class="flowing-light-ring" :class="{ 'stop-animation': performanceMode, 'active': isRestartingSteam }"></div>
              <button 
                @click="handleRestartSteam" 
                :disabled="isRestartingSteam" 
                class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 cursor-pointer" 
                :class="isRestartingSteam ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]' : 'text-text-muted hover:bg-white/10 hover:text-primary'" 
                :title="t('app.steamRestart')"
              >
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 256 256" :class="isRestartingSteam ? 'animate-spin' : ''">
                  <path d="M224,128a96,96,0,1,1-96-96,8,8,0,0,1,0,16,80,80,0,1,0,80,80,8,8,0,0,1,16,0Zm-40-64H136a8,8,0,0,0,0,16h24.69L115,125.66a8,8,0,0,0,11.32,11.32L172,91.31V116a8,8,0,0,0,16,0V68A8,8,0,0,0,184,60Z"></path>
                </svg>
              </button>
            </div>

            <!-- 音频同步 -->
            <button @click="toggleAudioSync" class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 relative group cursor-pointer" :class="audioSyncLevel === 0 ? 'text-text-muted hover:bg-white/10 hover:text-[#00f3ff]' : 'bg-[#00f3ff]/20 text-[#00f3ff] shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]'" :title="audioSyncLevel === 0 ? t('app.audioSyncOff') : t('app.audioSyncOn')">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'animate-pulse': audioSyncLevel === 1 && !performanceMode }"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </button>

            <!-- 性能模式 -->
            <button @click="togglePerformanceMode" class="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer" :class="performanceMode ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]' : 'text-text-muted hover:bg-white/10 hover:text-primary'" :title="t('app.perfMode')">
              <svg width="22" height="22" fill="currentColor" viewBox="0 0 256 256" class="transition-transform duration-500" :class="performanceMode ? 'rotate-180' : ''"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z"></path></svg>
            </button>

            <div class="w-[1px] h-8 bg-white/10"></div>

            <!-- 窗口控制 -->
            <div class="flex items-center gap-3">
              <button @click="winControl.min()" class="w-4 h-4 rounded-full bg-green-500/80 hover:bg-green-400 transition-all hover:scale-110 shadow-lg shadow-green-500/20 cursor-pointer"></button>
              <button @click="winControl.max()" class="w-4 h-4 rounded-full bg-yellow-500/80 hover:bg-yellow-400 transition-all hover:scale-110 shadow-lg shadow-yellow-500/20 cursor-pointer"></button>
              <button @click="winControl.close()" class="w-4 h-4 rounded-full bg-red-500/80 hover:bg-red-400 transition-all hover:scale-110 shadow-lg shadow-red-500/20 cursor-pointer"></button>
            </div>
          </div>
        </div>
      </header>

      <!-- 全局进度条 -->
      <div 
        v-if="globalBusy" 
        :class="currentTheme === 'minimal' || currentTheme === 'anime' ? 'top-[calc(4rem_-_1px)]' : 'top-[calc(5rem_-_1px)]'" class="absolute left-0 w-full h-1 z-50 overflow-hidden bg-black/50 pointer-events-none"
      >
        <div class="h-full transition-colors duration-300 ease-out" :class="[topBarColorClass, performanceMode ? 'w-full' : 'w-1/2 animate-progress-gpu']"></div>
      </div>

      <!-- 核心视图插槽 -->
      <div class="flex-1 overflow-y-auto scrollbar-hide relative view-container">
        <LibraryView v-show="currentView === 'library'" :active="currentView === 'library'" class="h-full" />
        <TransmissionsView v-show="currentView === 'transmissions'" class="h-full" />
        <DiscoveryView v-if="currentView === 'discovery'" class="h-full" />
        <CollectionView v-if="currentView === 'collection'" class="h-full" />
        <SettingsView v-if="currentView === 'settings'" class="h-full" />
        <NexusGateView v-if="currentView === 'nexus_gate'" class="h-full" />
        <FeedbackView v-if="currentView === 'uplink'" class="h-full" />
        <HajimiBeat v-if="currentView === 'hajimi_beat'" class="h-full" />
      </div>
    </main>
  </div>

  <!-- 欢迎引导弹窗 -->
  <BaseModal :visible="showWelcomeModal" @close="handleWelcomeComplete">
    <div 
      class="welcome-modal-content relative w-full max-w-xl rounded-xl overflow-hidden flex flex-col transition-all"
      :class="currentTheme === 'minimal' 
        ? 'bg-[#101623]/95 border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.2)] text-white' 
        : 'bg-[#0a0a0a] border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.8)] text-white'"
    >
      <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00f3ff]/40 to-transparent pointer-events-none"></div>

      <div class="relative p-9 flex flex-col items-center text-center gap-6">
        <div class="w-16 h-16 rounded-lg border-2 border-[#00f3ff]/30 flex items-center justify-center text-[#00f3ff] text-2xl font-black font-code shadow-[0_0_24px_rgba(0,243,255,0.15)]">
          TC
        </div>

        <div class="space-y-1.5">
          <h2 class="text-xl font-black tracking-wide text-white">TitanCore</h2>
          <p class="text-zinc-500 font-code text-xs tracking-[0.2em]">NEURAL LINK READY</p>
        </div>

        <div class="w-12 h-px bg-[#00f3ff]/30"></div>

        <div class="w-full rounded-lg bg-white/[0.02] border border-white/[0.06] p-4 text-left space-y-2.5">
          <p class="text-sm text-zinc-400 flex items-center gap-2.5">
            <span class="w-[5px] h-[5px] rounded-full bg-[#00f3ff] shadow-[0_0_6px_rgba(0,243,255,0.5)]"></span>
            {{ t('welcome.firstLogin') }}
          </p>
          <p class="text-sm text-zinc-400 flex items-center gap-2.5">
            <span class="w-[5px] h-[5px] rounded-full bg-[#00f3ff] shadow-[0_0_6px_rgba(0,243,255,0.5)]"></span>
            {{ t('welcome.switchSettings') }}
          </p>
          <p class="text-sm text-zinc-400 flex items-center gap-2.5">
            <span class="w-[5px] h-[5px] rounded-full bg-[#00f3ff] shadow-[0_0_6px_rgba(0,243,255,0.5)]"></span>
            {{ t('welcome.browseDiscovery') }}
          </p>
        </div>

        <button
          @click="handleWelcomeComplete"
          class="w-full h-11 bg-[#00f3ff]/[0.08] hover:bg-[#00f3ff]/[0.15] text-[#00f3ff] border border-[#00f3ff]/30 font-medium text-sm tracking-[0.15em] rounded-lg transition-all hover:shadow-[0_0_24px_rgba(0,243,255,0.15)]"
        >
          {{ t('welcome.initNeuralLink') }}
        </button>
      </div>
    </div>
  </BaseModal>

  <!-- 引擎更新弹窗 -->
  <BaseModal :visible="showEngineUpdateModal" @close="showEngineUpdateModal = false">
    <div 
      class="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col shadow-2xl transition-all"
      :class="currentTheme === 'anime' 
        ? 'bg-white/98 border-2 border-[#bce8ff] text-[#1e192b]' 
        : (currentTheme === 'minimal' 
          ? 'bg-[#101623]/95 border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.2)] text-white' 
          : 'bg-[#0a0a0a] border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.8)] text-white')"
    >
      <div 
        class="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
        :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3] to-transparent' : 'bg-gradient-to-r from-transparent via-[#00f3ff]/40 to-transparent'"
      ></div>

      <div class="p-7 flex flex-col gap-5">
        <h2 
          class="text-base font-bold tracking-wide flex items-center gap-2.5"
          :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
        >
          <span class="w-[3px] h-[18px] rounded-sm shadow-sm" :class="currentTheme === 'anime' ? 'bg-[#ff85b3] shadow-[0_0_8px_#ff85b3]' : 'bg-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.5)]'"></span>
          {{ t('settings.engine.updateTitle') }}
        </h2>

        <div 
          class="rounded-xl p-4 space-y-2.5 border transition-colors"
          :class="currentTheme === 'anime' 
            ? 'bg-pink-50/50 border-pink-200 text-[#4a425a]' 
            : (currentTheme === 'minimal' 
              ? 'bg-[#0b0f17]/80 border-[#00f2ff]/15 text-zinc-300' 
              : 'bg-white/[0.03] border-white/[0.06] text-zinc-300')"
        >
          <p class="text-sm font-code leading-relaxed" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-zinc-300'" v-html="t('settings.engine.updateDesc', { engine: engineUpdateInfo.engine.toUpperCase(), version: engineUpdateInfo.version })"></p>
          <p class="text-xs font-code" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-zinc-500'">{{ t('settings.engine.updateDetail') }}</p>
          <div class="w-full h-px my-1" :class="currentTheme === 'anime' ? 'bg-pink-200' : 'bg-white/[0.06]'"></div>
          <p class="text-xs font-semibold text-rose-500">{{ t('settings.engine.updateWarning') }}</p>
        </div>

        <div class="flex gap-3 pt-1">
          <button 
            @click="showEngineUpdateModal = false" 
            :disabled="isUpdatingEngine" 
            class="flex-1 h-10 border rounded-xl font-medium text-sm transition-all disabled:opacity-50"
            :class="currentTheme === 'anime' ? 'bg-white border-[#e2d4f0] text-[#4a425a] hover:bg-slate-50 hover:text-[#ff66b2]' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-zinc-200'"
          >
            {{ t('settings.engine.updateBtnCancel') }}
          </button>
          <button 
            @click="executeEngineUpdate" 
            :disabled="isUpdatingEngine" 
            class="flex-[1.5] h-10 rounded-xl font-bold text-sm transition-all flex justify-center items-center gap-2 disabled:opacity-50 shadow-md"
            :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white hover:opacity-95 shadow-[0_4px_16px_rgba(255,133,179,0.38)]' : 'bg-[#00f3ff] hover:bg-[#2bf5ff] text-black shadow-[0_0_16px_rgba(0,243,255,0.2)]'"
          >
            <span v-if="isUpdatingEngine" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            {{ isUpdatingEngine ? t('settings.engine.updatingText') : t('settings.engine.updateBtnConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </BaseModal>

  <!-- 单独主程序更新弹窗 -->
  <BaseModal
    :visible="showAppUpdateModal"
    @close="handleAppUpdateModalClose"
    :show-close="true"
    :container-class="currentTheme === 'anime'
      ? 'max-w-md w-full bg-white/98 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] p-7 relative rounded-2xl overflow-hidden text-[#1e192b]'
      : (currentTheme === 'minimal' 
        ? 'max-w-md w-full bg-[#101623]/95 border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.2)] p-7 relative overflow-hidden text-white' 
        : 'max-w-md w-full bg-[#0a0a0a] border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.8)] p-7 relative overflow-hidden')"
  >
    <div 
      class="absolute top-0 left-0 right-0 h-0.5 pointer-events-none"
      :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3] to-transparent' : 'bg-gradient-to-r from-transparent via-[#00f3ff]/40 to-transparent'"
    ></div>
    <div class="flex flex-col gap-4">
      <div>
        <h3 
          class="text-base font-bold tracking-wide flex items-center gap-2.5"
          :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
        >
          <span class="w-[3px] h-[18px] rounded-sm shadow-sm" :class="currentTheme === 'anime' ? 'bg-[#ff85b3] shadow-[0_0_8px_#ff85b3]' : 'bg-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.5)]'"></span>
          {{ t('settings.update.appOnlyTitle') }}
        </h3>
        <p class="text-xs font-code mt-1.5 pl-3.5 font-bold" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-zinc-500'">v{{ appUpdateInfo.currentVersion }} → v{{ appUpdateInfo.latestVersion }}</p>
      </div>
      <div 
        class="w-full rounded-xl p-3.5 border transition-colors"
        :class="currentTheme === 'anime' ? 'bg-sky-50 border-sky-200' : 'bg-[#00f3ff]/[0.04] border-[#00f3ff]/20'"
      >
        <p class="text-sm font-medium leading-relaxed" :class="currentTheme === 'anime' ? 'text-sky-800' : 'text-[#00f3ff]'">{{ t('settings.update.queueDesc') }}</p>
      </div>
      <div class="flex items-center gap-3 w-full pt-2">
        <button 
          type="button" 
          @click="handleAppUpdateModalClose" 
          class="flex-1 h-10 border font-medium text-sm rounded-xl transition-all"
          :class="currentTheme === 'anime' ? 'bg-white border-[#e2d4f0] text-[#4a425a] hover:bg-slate-50' : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-zinc-400 hover:text-zinc-200'"
        >
          {{ t('settings.update.later') }}
        </button>
        <button 
          type="button" 
          @click="startAppUpdate" 
          class="flex-1 h-10 font-bold text-sm rounded-xl transition-all shadow-md"
          :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white hover:opacity-95 shadow-[0_4px_16px_rgba(255,133,179,0.38)]' : 'bg-[#00f3ff] hover:bg-[#2bf5ff] text-black shadow-[0_0_16px_rgba(0,243,255,0.2)]'"
        >
          {{ t('settings.update.confirmUpdate') }}
        </button>
      </div>
    </div>
  </BaseModal>

<!-- 全局更新就绪倒计时弹窗 -->
  <BaseModal
    :visible="showUpdateCountdown"
    :show-close="false"
    :container-class="currentTheme === 'anime'
      ? 'max-w-sm w-full bg-white/98 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] p-8 text-center rounded-2xl text-[#1e192b]'
      : (currentTheme === 'minimal' 
        ? 'max-w-sm w-full bg-[#101623]/95 border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.2)] p-8 text-center text-white rounded-2xl' 
        : 'max-w-sm w-full bg-[#0e0e14] border border-[#00f3ff]/30 shadow-[0_0_50px_rgba(0,243,255,0.15)] p-8 text-center')"
  >
    <div class="flex flex-col items-center text-center">
      <div 
        class="w-16 h-16 rounded-full border-4 flex items-center justify-center mb-6 shadow-md"
        :class="currentTheme === 'anime' ? 'border-[#ff85b3] shadow-[0_0_20px_rgba(255,133,179,0.5)]' : 'border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.5)]'"
      >
        <span class="text-3xl font-black font-code" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'">{{ updateCountdown }}</span>
      </div>
      <h3 class="text-xl font-black tracking-widest mb-2" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('settings.update.countdownTitle') }}</h3>
      <p class="text-sm font-code leading-relaxed whitespace-pre-line" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-gray-400'">{{ t('settings.update.countdownDesc') }}</p>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from './stores/authStore'
import { useDiscoveryStore } from './stores/discoveryStore'
import { useLibraryStore } from './stores/libraryStore'
import { useTransmissionStore } from './stores/transmissionStore'
import { useFeedbackStore } from './stores/feedbackStore'
import { useTelemetryStore } from './stores/telemetryStore'
import Sidebar from './components/Sidebar.vue'
import AnimeSidebar from './themes/anime/AnimeSidebar.vue'
import AnimeTopbar from './themes/anime/AnimeTopbar.vue'
import TechSidebar from './themes/minimal/TechSidebar.vue'
import TechTopbar from './themes/minimal/TechTopbar.vue'
import DiscoveryView from './components/DiscoveryView.vue'
import TransmissionsView from './components/TransmissionsView.vue'
import SettingsView from './components/SettingsView.vue'
import LibraryView from './components/LibraryView.vue'
import NexusGateView from './components/NexusGateView.vue'
import FeedbackView from './components/FeedbackView.vue'
import CollectionView from './components/CollectionView.vue'
import HajimiBeat from './components/HajimiBeat.vue'
import BaseModal from './components/common/BaseModal.vue'
import { useSteamLauncher } from './composables/useSteamLauncher'
import Swal from 'sweetalert2'
import { t, initLang } from './i18n'
import { useTheme } from './composables/useTheme'

const { currentTheme } = useTheme()
const authStore = useAuthStore()
const discoveryStore = useDiscoveryStore()
const libraryStore = useLibraryStore()
const transmissionStore = useTransmissionStore()
const feedbackStore = useFeedbackStore()
const telemetryStore = useTelemetryStore()

const mainContainer = ref<HTMLElement | null>(null)
const currentView = ref('discovery')

// 页面切换埋点
let pageEnterTime = 0
let currentPageId = ''
watch(
  currentView,
  (newView, oldView) => {
    if (oldView && currentPageId) {
      telemetryStore.exitPage(currentPageId, Date.now() - pageEnterTime)
    }
    currentPageId = newView
    pageEnterTime = Date.now()
    telemetryStore.enterPage(newView)
  },
  { immediate: true }
)

const isRestartingSteam = ref(false)
const performanceMode = ref(false)
const showWelcomeModal = ref(false)

const handleWelcomeComplete = () => {
  showWelcomeModal.value = false
  currentView.value = 'settings'
}

const showInitError = ref(false)
const initErrorMsg = ref('')

const showUpdateCountdown = ref(false)
const updateCountdown = ref(5)
let updateCountdownTimer: ReturnType<typeof setInterval> | null = null

const showAppUpdateModal = ref(false)
const appUpdateInfo = ref({ latestVersion: '', currentVersion: '' })
const hasCheckedUpdate = ref(false)
const isFirstLaunchFlag = ref(false)

const showBootSplash = ref(true)
const showEngineUpdateModal = ref(false)
const isUpdatingEngine = ref(false)
const engineUpdateInfo = ref({ version: 0, engine: '' })

// 顶栏任务状态
const latestActiveTask = computed(() => {
  const list = transmissionStore.tasks
  return list.findLast(t => ['active', 'error', 'paused', 'waiting'].includes(t.status))
})

const globalBusy = computed(() => !!latestActiveTask.value)

const topBarColorClass = computed(() => {
  const task = latestActiveTask.value
  if (!task) return 'bg-primary'
  if (task.status === 'error') return 'bg-red-500 shadow-[0_0_15px_red]'
  if (task.status === 'paused') return 'bg-yellow-500/50'
  return 'bg-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.8)]'
})

let unsubLoginSuccess: (() => void) | null = null
let unsubTriggerUpdate: (() => void) | null = null
let unsubLibUpdated: (() => void) | null = null
let unsubSyncComplete: (() => void) | null = null
let unsubUpdateReady: (() => void) | null = null
let unsubUpdateError: (() => void) | null = null
let bootSplashTimer: ReturnType<typeof setTimeout> | null = null
let welcomeModalTimer: ReturnType<typeof setTimeout> | null = null

const systemStatus = computed(() => {
  if (authStore.connectionError) return 'offline'
  if (authStore.isConnected && discoveryStore.syncPhase === 'ready') return 'ready'
  return 'syncing'
})

const winControl = {
  min: () => window.electron?.window?.min?.(),
  max: () => window.electron?.window?.max?.(),
  close: () => window.electron?.window?.close?.()
}

const BREADCRUMB_EN_MAP: Record<string, string> = {
  discovery: 'DISCOVERY',
  library: 'LIBRARY',
  transmissions: 'TRANSMISSIONS',
  hajimi_beat: 'HAJIMI BEAT',
  nexus_gate: 'NEXUS GATE',
  uplink: 'UPLINK',
  settings: 'SETTINGS'
}

const currentBreadcrumb = computed(() => {
  return BREADCRUMB_EN_MAP[currentView.value] || currentView.value.toUpperCase()
})

const {
  isSteamLaunching,
  launchSteamWithGuard
} = useSteamLauncher()

const handleRestartSteam = async () => {
  if (isRestartingSteam.value || isSteamLaunching.value) return
  isRestartingSteam.value = true
  try {
    await launchSteamWithGuard({
      onError: (err) => {
        console.error('[TitanCore] Steam Restart Failed:', err)
      }
    })
  } catch (err) {
    console.error('[TitanCore] Steam Restart Failed:', err)
  } finally {
    isRestartingSteam.value = false
  }
}

const togglePerformanceMode = async () => {
  performanceMode.value = !performanceMode.value
  document.documentElement.classList.toggle('performance-mode', performanceMode.value)
  if (performanceMode.value) cleanupAudioSync()
}

// ======================= 工业级真实音频物理映射 =======================
const audioSyncLevel = ref(0)
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let audioStream: MediaStream | null = null
let audioSource: MediaStreamAudioSourceNode | null = null
let audioAnimFrame = 0
let isAudioInitializing = false
let isRendering = false
let syncTimeout: ReturnType<typeof setTimeout> | null = null

let currentScale = 0.02
let currentOpacity = 0

const cleanupAudioSync = async () => {
  isRendering = false
  if (syncTimeout) clearTimeout(syncTimeout)
  if (audioAnimFrame) cancelAnimationFrame(audioAnimFrame)

  if (mainContainer.value) {
    mainContainer.value.style.setProperty('--halo-opacity', '0')
    mainContainer.value.style.setProperty('--bass-scale', '0')
    mainContainer.value.style.setProperty('--high-glow', '0')
  }

  audioSource?.disconnect()
  audioStream?.getTracks().forEach(t => t.stop())
  if (audioCtx && audioCtx.state !== 'closed') {
    try { await audioCtx.close() } catch {}
  }

  audioCtx = null
  analyser = null
  audioSource = null
  audioStream = null
  isAudioInitializing = false
  currentScale = 0.02
  currentOpacity = 0
}

const handleVisibilityChange = () => {
  if (audioSyncLevel.value !== 1 || performanceMode.value) return
  if (document.hidden) {
    cleanupAudioSync()
  } else {
    if (syncTimeout) clearTimeout(syncTimeout)
    syncTimeout = setTimeout(startAudioSync, 300)
  }
}

const toggleAudioSync = async () => {
  audioSyncLevel.value = audioSyncLevel.value === 1 ? 0 : 1
  await cleanupAudioSync()
  if (audioSyncLevel.value === 1 && !performanceMode.value) {
    syncTimeout = setTimeout(startAudioSync, 300)
  }
}

const startAudioSync = async () => {
  if (audioStream || isAudioInitializing) return
  isAudioInitializing = true
  try {
    let sourceId = ''
    if (window.electron?.sys?.getDesktopAudioSource) {
      sourceId = await Promise.race([
        window.electron.sys.getDesktopAudioSource(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Audio timeout')), 5000))
      ])
    }

    const constraints: any = sourceId
      ? {
          audio: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, maxWidth: 64, maxHeight: 64 } }
        }
      : { audio: true, video: false }

    const rawStream = await navigator.mediaDevices.getUserMedia(constraints)
    if (!isAudioInitializing || audioSyncLevel.value !== 1) {
      rawStream.getTracks().forEach(t => t.stop())
      return
    }

    if (sourceId) {
      rawStream.getVideoTracks().forEach(track => {
        track.stop()
        rawStream.removeTrack(track)
      })
    }

    audioStream = rawStream
    audioCtx = new window.AudioContext()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.2 // 降低平滑，提升瞬态响应
    audioSource = audioCtx.createMediaStreamSource(audioStream)
    audioSource.connect(analyser)

    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    isRendering = true

    const renderLoop = () => {
      if (!isRendering || performanceMode.value || audioSyncLevel.value !== 1 || !analyser || !mainContainer.value) return

      analyser.getByteFrequencyData(dataArray)

      // 1. 暴力提取底鼓与低音 (0, 1, 2 频段)
      // 放大低频权重，确保鼓点清晰
      const subBassRaw = (dataArray[0] * 1.2 + dataArray[1] * 0.8 + dataArray[2] * 0.5) / 2.5
      const normBass = Math.min(1, subBassRaw / 255)

      // 2. 中高频提取
      let midSum = 0
      for (let i = 3; i < 9; i++) midSum += dataArray[i]
      const midAvg = midSum / 6 / 255

      let highSum = 0
      for (let i = 9; i < 24; i++) highSum += dataArray[i]
      const highAvg = highSum / 15 / 255

      // 3. 纯粹映射目标值 (有声音就起，没声音就趴)
      // Math.pow(normBass, 1.5) 用曲线压制小杂音，让真正的重音爆发拉满
      const targetScale = 0.015 + Math.pow(normBass, 1.5) * 0.85 
      const targetOpacity = normBass * 0.6 // 亮度直接挂钩低频力量

      // 4. 真实物理回弹计算：极速爆发，干脆回落
      if (targetScale > currentScale) {
        currentScale += (targetScale - currentScale) * 0.80 // 80% 的速度冲刺上升 (Attack)
      } else {
        currentScale += (targetScale - currentScale) * 0.15 // 15% 的速率干净下坠 (Release)
      }

      if (targetOpacity > currentOpacity) {
        currentOpacity += (targetOpacity - currentOpacity) * 0.70
      } else {
        currentOpacity += (targetOpacity - currentOpacity) * 0.15
      }

      // 5. 防御性触底边界
      if (currentScale < 0.015) currentScale = 0.015
      if (currentOpacity < 0) currentOpacity = 0

      // 6. 注入渲染变量
      mainContainer.value.style.setProperty('--bass-scale', currentScale.toFixed(3))
      mainContainer.value.style.setProperty('--halo-opacity', currentOpacity.toFixed(3))
      mainContainer.value.style.setProperty('--mid-hue', (183 + midAvg * 8).toFixed(0)) // 赛博青基值183，漂移±8°不越界
      mainContainer.value.style.setProperty('--high-glow', (0.3 + highAvg * 0.7).toFixed(3)) // 边缘光晕随高频变亮

      if (isRendering) audioAnimFrame = requestAnimationFrame(renderLoop)
    }
    renderLoop()
  } catch (e) {
    console.warn('[TitanCore] 音频矩阵同步未就绪:', e)
    audioSyncLevel.value = 0
    await cleanupAudioSync()
  } finally {
    isAudioInitializing = false
  }
}

const executeEngineUpdate = async () => {
  isUpdatingEngine.value = true
  try {
    const res = await window.electron.invoke('engine:apply-latest-update')
    if (res?.success) {
      showEngineUpdateModal.value = false
      Swal.fire({ title: t('app.engineUpdateSuccess'), text: t(res.msg), icon: 'success', background: '#121212', color: '#00f3ff', timer: 3000, showConfirmButton: false })
    } else {
      Swal.fire({ title: t('app.overwriteFailed'), text: res?.msg || t('app.unknownBlock'), icon: 'error', background: '#121212', color: '#fff' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('app.systemError'), text: e.message, icon: 'error', background: '#121212', color: '#fff' })
  } finally {
    isUpdatingEngine.value = false
  }
}

const checkAppUpdate = async () => {
  try {
    const res = await window.electron.sys.checkUpdate()
    if (res?.hasUpdate) {
      appUpdateInfo.value = { latestVersion: res.latestVersion, currentVersion: res.currentVersion }
      return true
    }
  } catch (e) {
    console.warn('[App] 主程序更新检查失败:', e)
  }
  return false
}

const startAppUpdate = async () => {
  try {
    const res = await window.electron.sys.startUpdate()
    showAppUpdateModal.value = false
    if (res?.success) {
      Swal.fire({ title: t('app.appUpdateStarted'), text: t('app.appUpdateAutoInstall'), icon: 'success', background: '#121212', color: '#00f3ff', timer: 3000, showConfirmButton: false })
    } else {
      Swal.fire({ title: t('app.appUpdateStartFailed'), text: res?.msg || t('app.unknownError'), icon: 'error', background: '#121212', color: '#fff' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('app.systemError'), text: e.message, icon: 'error', background: '#121212', color: '#fff' })
  }
}

const handleAppUpdateModalClose = () => {
  showAppUpdateModal.value = false
  // 主程序弹窗处理完毕（关闭/稍后）后，继续触发引擎更新弹窗
  checkEngineUpdate()
}

const checkEngineUpdate = async () => {
  try {
    let currentEngine = (await window.electron.invoke('sys:get-config', 'unlock_engine')) || 'ost'
    if (currentEngine !== 'ost') {
      await window.electron.invoke('sys:set-config', 'unlock_engine', 'ost')
      currentEngine = 'ost'
    }

    const engineUpdateCheck = await window.electron.invoke('engine:silent-check', currentEngine).catch(() => ({ hasUpdate: false }))
    if (engineUpdateCheck?.hasUpdate) {
      engineUpdateInfo.value = {
        version: engineUpdateCheck.version,
        engine: currentEngine
      }
      showEngineUpdateModal.value = true
    }
  } catch (e) {
    console.warn('[App] 引擎更新检测失败:', e)
  }
}

const runUpdateCheck = async () => {
  if (hasCheckedUpdate.value) return
  hasCheckedUpdate.value = true

  try {
    const appHasUpdate = await checkAppUpdate()
    if (appHasUpdate) {
      // 主程序有更新：先展示主程序弹窗（关闭或处理后无缝接力引擎检测）
      showAppUpdateModal.value = true
    } else {
      // 主程序无更新：立即独立检测引擎更新
      await checkEngineUpdate()
    }
  } catch (e) {
    console.warn('[App] 更新检测失败:', e)
    // 即使主程序检测异常，引擎检测依然独立运行
    await checkEngineUpdate()
  }
}

const handleNavigationBroadcast = (e: any) => {
  const detail = e?.detail
  if (!detail) return
  if (typeof detail === 'string') {
    currentView.value = detail
  } else if (detail.view) {
    if (detail.payload) {
      ;(window as any).__titanCollectionPayload = detail.payload
    }
    currentView.value = detail.view
  }
}

const handleFeedbackReply = () => {
  if (currentView.value !== 'uplink') {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: t('app.hajimiReply'),
      background: '#0a0a15',
      color: '#00f3ff',
      timer: 4000,
      showConfirmButton: false
    })
  }
}

const goToFeedback = () => {
  feedbackStore.markRead()
  currentView.value = 'uplink'
}

const startUpdateCountdown = () => {
  if (updateCountdownTimer) clearInterval(updateCountdownTimer)
  showUpdateCountdown.value = true
  updateCountdown.value = 5
  updateCountdownTimer = setInterval(() => {
    updateCountdown.value--
    if (updateCountdown.value <= 0) {
      if (updateCountdownTimer) clearInterval(updateCountdownTimer)
      updateCountdownTimer = null
      window.electron.invoke('app:execute-update')
    }
  }, 1000)
}

onMounted(async () => {
  // 1. 监听置顶（保住侧边栏状态不会漏）
  unsubLoginSuccess = window.electron.on('auth:login-success', async () => {
    // 【架构解耦】严禁在此触发公共库同步！公共库由主进程生命周期单向驱动
    // 登录成功只拉取用户个人的云端收藏与进度
    libraryStore.pullCloud().catch(() => {})
  })

  unsubTriggerUpdate = window.electron.on('app:trigger-update-check', () => {
    if (!isFirstLaunchFlag.value) runUpdateCheck()
  })

  // 2. 状态机闭环：公共库同步完毕（无论是增量还是 304 还是首发全量），统一在此置 ready
  unsubLibUpdated = window.electron.on('titan:library-updated', (payload: any) => {
    discoveryStore.setSyncPhase('ready')
    discoveryStore.fetchResources(false)
  })

  unsubSyncComplete = window.electron.on('lifecycle:sync-complete', () => {
    discoveryStore.setSyncPhase('ready')
    discoveryStore.fetchResources(false)
  })

  unsubUpdateReady = window.electron.on('app:update-ready', () => {
    startUpdateCountdown()
  })

  unsubUpdateError = window.electron.on('app:update-error', (errMsg: string) => {
    Swal.fire({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 5000,
      title: t('app.updateSystemError'),
      text: t(errMsg),
      icon: 'error',
      background: '#0a0f16',
      color: '#ff4444'
    })
  })

  // 3. 防丢失兜底回查（如果同步极快在监听前就结束了，补偿置 ready）
  window.electron.invoke('sys:get-sync-state').then((s: any) => {
    if (s && !s.running && s.lastSyncAt) discoveryStore.setSyncPhase('ready')
  }).catch(() => {})

  await initLang()

  window.addEventListener('titan-navigate', handleNavigationBroadcast)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // 客户端就绪握手（主进程 0ms 返回首发标记）
  const res = await window.electron.invoke('sys:client-ready')
  const isFirstLaunch = res?.isFirstLaunch ?? false
  isFirstLaunchFlag.value = isFirstLaunch

  if (isFirstLaunch) {
    // 首发仪式感：1800ms 完整 Logo 扫光动画屏障
    await new Promise(resolve => setTimeout(resolve, 1800))
    currentView.value = 'settings'
    showBootSplash.value = false
    welcomeModalTimer = setTimeout(() => {
      showWelcomeModal.value = true
      discoveryStore.fetchResources(false)
    }, 300)
  } else {
    // 日常冷启：300ms 动态时钟，极速开屏（告别 ~2.1s 呆滞等待）
    // 【时序修复】不再盲目置 ready：首屏查库可能早于后台同步落库(日志中"返回0条"即此)，
    // 统一由 titan:library-updated 事件驱动 ready+刷新，304无变化也会触发该事件
    discoveryStore.init()
    bootSplashTimer = setTimeout(() => {
      showBootSplash.value = false
    }, 300)
  }

  try {
    const savedPerfMode = await window.electron.invoke('sys:get-config', 'performanceMode')
    performanceMode.value = !!savedPerfMode
  } catch {
    performanceMode.value = false
  }

  if (performanceMode.value) {
    document.documentElement.classList.add('performance-mode')
  }

  await feedbackStore.loadLocal()
  feedbackStore.startPolling()

  window.addEventListener('feedback:new-reply', handleFeedbackReply)
})

onUnmounted(() => {
  window.removeEventListener('titan-navigate', handleNavigationBroadcast)
  window.removeEventListener('feedback:new-reply', handleFeedbackReply)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  unsubLoginSuccess?.()
  unsubTriggerUpdate?.()
  unsubLibUpdated?.()
  unsubSyncComplete?.()
  unsubUpdateReady?.()
  unsubUpdateError?.()
  if (bootSplashTimer) clearTimeout(bootSplashTimer)
  if (welcomeModalTimer) clearTimeout(welcomeModalTimer)
  if (updateCountdownTimer) clearTimeout(updateCountdownTimer)
  cleanupAudioSync()
  feedbackStore.stopPolling()
})
</script>

<style scoped>
.steam-restart-container { display: flex; align-items: center; justify-content: center; }

.flowing-light-ring {
  position: absolute; inset: -2px; border-radius: 50%;
  background: conic-gradient(from 180deg, var(--primary) 0%, transparent 60%);
  mask-image: radial-gradient(transparent 60%, black 61%); -webkit-mask-image: radial-gradient(transparent 60%, black 61%);
  opacity: 0; transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; z-index: 5;
}
.flowing-light-ring.active { opacity: 1; animation: flow-spin 2s linear infinite; }
@keyframes flow-spin { to { transform: rotate(360deg); } }
.steam-restart-container:hover .flowing-light-ring:not(.active) { opacity: 0.5; }
.flowing-light-ring.stop-animation { animation: none !important; }

.quantum-pillar {
  position: absolute; left: 50%; top: 50%; width: 2px; height: 100vh; margin-left: -1px;
  background: linear-gradient(to bottom, transparent, hsl(var(--mid-hue, 183), 100%, 50%), transparent);
  opacity: var(--high-glow, 0.5); filter: drop-shadow(0 0 12px hsl(var(--mid-hue, 183), 100%, 60%));
  transform-origin: center; pointer-events: none;
}

.welcome-modal-content {
  animation: modal-fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
@keyframes modal-fade-up {
  0% { transform: translateY(20px) scale(0.98); opacity: 0; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}
</style>

<style>
/* ========== 全新完美级简大厂风 T 启动动画规范 ========== */
.boot-splash { contain: layout style paint; }

.tc-pure-logo {
  font-size: clamp(90px, 12vw, 180px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.05em;
  color: #00f3ff;
  background: linear-gradient(
    90deg,
    #00b4d8 0%,
    #00f3ff 35%,
    #ffffff 50%,
    #00f3ff 65%,
    #00b4d8 100%
  );
  background-size: 300% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 35px rgba(0, 243, 255, 0.35));
  animation: tc-logo-cinematic-sweep 1.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes tc-logo-cinematic-sweep {
  0% {
    opacity: 0;
    transform: scale(0.94);
    background-position: 250% center;
    filter: drop-shadow(0 0 0px rgba(0, 243, 255, 0));
  }
  25% {
    opacity: 1;
    transform: scale(1);
    filter: drop-shadow(0 0 40px rgba(0, 243, 255, 0.45));
  }
  100% {
    opacity: 1;
    transform: scale(1);
    background-position: -150% center;
    filter: drop-shadow(0 0 20px rgba(0, 243, 255, 0.2));
  }
}

.splash-fade-leave-active {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.splash-fade-leave-to {
  opacity: 0;
}

/* ========== 性能模式降级与穿透规则 ========== */
.performance-mode .animate-fade-in, 
.performance-mode .animate-fade-in-up,
.performance-mode .animate-scale-in,
.performance-mode .welcome-modal-content { 
  animation: none !important; 
  opacity: 1 !important; 
  transform: none !important; 
}

.performance-mode .animate-pulse, 
.performance-mode .animate-spin, 
.performance-mode .animate-bounce,
.performance-mode .animate-progress-gpu, 
.performance-mode .animate-flow, 
.performance-mode .cyber-breathe,
.performance-mode .rgb-glow, 
.performance-mode .slider-thumb-cyber::-webkit-slider-thumb, 
.performance-mode .vip-avatar-frame, 
.performance-mode .vip-flow-line, 
.performance-mode .vip-flow-line::before,
.performance-mode .animate-breathe,
.performance-mode .animate-scan-beam,
.performance-mode [class*="shimmer"],
.performance-mode .tc-light-sweep { 
  animation-play-state: paused !important; 
}

.performance-mode .animate-breathe {
  opacity: 0.4 !important;
}

.performance-mode [class*="backdrop-blur"] {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

.performance-mode .will-change-transform,
.performance-mode [style*="will-change"] {
  will-change: auto !important;
}

.performance-mode .blur-xl {
  filter: none !important;
}
.performance-mode .group:hover .blur-xl {
  opacity: 0 !important;
}

.performance-mode .search-enter,
.performance-mode .tc-warp-enter {
  animation: none !important;
}
.performance-mode .search-exit,
.performance-mode .tc-warp-exit {
  animation-play-state: paused !important;
}
</style>