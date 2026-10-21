<template>
  <div 
    class="h-full w-full relative overflow-hidden select-none flex flex-col animate-fade-in transition-colors duration-300"
    :class="currentTheme === 'anime' ? 'bg-transparent text-[#1e192b]' : (currentTheme === 'minimal' ? 'bg-transparent text-white' : 'bg-[#020205] text-white')"
  >
    <!-- 顶栏 -->
    <div class="shrink-0 flex items-center justify-between px-8 py-5 z-20">
      <!-- 左侧：标题 + TAB -->
      <div class="flex items-center gap-6">
        <div 
          class="font-black text-xl tracking-[0.15em] transition-all"
          :class="currentTheme === 'anime' 
            ? 'text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b9d] to-[#5ce1e6] drop-shadow-[0_2px_8px_rgba(255,107,157,0.3)]' 
            : 'text-[#00f3ff]'" 
          :style="currentTheme !== 'anime' ? 'text-shadow:0 0 12px rgba(0,243,255,0.4)' : ''"
        >
          ARCADE
        </div>

        <!-- TAB 切换 -->
        <div 
          class="flex items-center rounded-xl p-1 border transition-all"
          :class="currentTheme === 'anime' 
            ? 'bg-white/80 border-[#bce8ff]/60 shadow-sm' 
            : (currentTheme === 'minimal'
              ? 'bg-[#101623]/80 border-[#00f2ff]/25 shadow-md backdrop-blur-md'
              : 'bg-white/[0.03] border-white/[0.08]')"
        >
          <button 
            @click="activeTab = 'mini'"
            class="px-4 py-1.5 rounded-lg text-sm font-bold tracking-wider transition-all duration-200"
            :class="activeTab === 'mini' 
              ? (currentTheme === 'anime' ? 'bg-gradient-to-r from-sky-400 to-pink-500 text-white shadow-sm' : 'bg-[#00f3ff]/15 text-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.1)]') 
              : (currentTheme === 'anime' ? 'text-slate-500 hover:text-pink-600' : 'text-zinc-500 hover:text-zinc-300')"
          >
            {{ t('lobby.tabMini') }}
          </button>
          <button 
            @click="activeTab = 'indie'"
            class="px-4 py-1.5 rounded-lg text-sm font-bold tracking-wider transition-all duration-200"
            :class="activeTab === 'indie' 
              ? (currentTheme === 'anime' ? 'bg-gradient-to-r from-sky-400 to-pink-500 text-white shadow-sm' : 'bg-[#00f3ff]/15 text-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.1)]') 
              : (currentTheme === 'anime' ? 'text-slate-500 hover:text-pink-600' : 'text-zinc-500 hover:text-zinc-300')"
          >
            {{ t('lobby.tabIndie') }}
          </button>
        </div>
      </div>

      <!-- 右侧：仅兑换按钮（尺寸缩小） -->
      <button 
        @click="showRedeemModal = true"
        class="flex items-center gap-2 border rounded-xl px-4 py-2 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
        :class="currentTheme === 'anime' ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100' : 'bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30 text-yellow-300'"
      >
        <svg class="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <span class="text-sm font-bold tracking-wider">{{ t('lobby.redeemQuota') }}</span>
      </button>
    </div>

    <!-- 内容区 -->
    <div class="flex-1 overflow-y-auto scrollbar-hide px-8 pb-8 relative z-10">

      <!-- ========== 小游戏 Tab ========== -->
      <div v-if="activeTab === 'mini'" class="animate-fade-in pt-2">
        <!-- 网格：默认 3 列，xl 以上 4 列 -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 max-w-6xl">
          <!-- 巴达布前哨 -->
          <div 
            class="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
            :class="currentTheme === 'anime' 
              ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_8px_20px_rgba(180,150,230,0.15)] hover:border-[#ff85b3] hover:shadow-[0_12px_28px_rgba(180,150,230,0.25)]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/90 border border-[#00f2ff]/20 hover:border-[#00f2ff]/50 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md'
                : 'bg-[#0a0a12] border border-white/[0.08] hover:border-[#00f3ff]/40')"
            @contextmenu.prevent="onCardContextMenu('badab', $event, 'mini')"
          >
            <div 
              class="relative w-full aspect-[3/2] overflow-hidden"
              :class="currentTheme === 'anime' ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-pink-50' : 'bg-black/60'"
            >
              <div 
                v-if="currentTheme !== 'anime'" 
                class="absolute inset-0 bg-gradient-to-br from-[#2b8a3e]/10 via-transparent to-[#00f3ff]/10 group-hover:from-[#2b8a3e]/20 group-hover:to-[#00f3ff]/20 transition-all duration-500" 
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <svg 
                  class="w-24 h-24 transition-all duration-300 group-hover:scale-110" 
                  :class="currentTheme === 'anime' ? 'text-emerald-500/70 group-hover:text-emerald-600' : 'text-[#2b8a3e]/50 group-hover:text-[#2b8a3e]/70'"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div 
                class="absolute bottom-0 left-0 right-0 h-px transition-opacity opacity-0 group-hover:opacity-100" 
                :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3] to-transparent' : 'bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent'"
              />
            </div>
            <div class="p-5">
              <div class="flex items-center justify-between mb-2">
                <h3 
                  class="font-bold text-lg tracking-wide transition-colors font-sans"
                  :class="currentTheme === 'anime' ? 'text-[#1e192b] group-hover:text-[#ff66b2]' : 'text-white group-hover:text-[#00f0ff]'"
                >
                  {{ t('lobby.badabTitle') }}
                </h3>
                <span 
                  class="text-xs font-bold px-2 py-0.5 rounded font-mono"
                  :class="currentTheme === 'anime' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-zinc-500 border border-white/10'"
                >
                  CARD
                </span>
              </div>
              <p 
                class="text-base mb-5 leading-relaxed"
                :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-zinc-400'"
              >
                {{ t('lobby.badabDesc') }}
              </p>
              <div class="flex gap-2">
                <!-- R37b 安装态机：安装中 > 失败重试 > 未安装安装 > 已安装原按钮组 -->
                <button
                  v-if="miniGameInstalling['badab']"
                  disabled
                  class="flex-1 py-2.5 rounded-lg text-base font-bold tracking-wider cursor-wait overflow-hidden relative"
                  :class="currentTheme === 'anime' ? 'bg-slate-100 border border-slate-300 text-slate-500' : 'bg-white/5 border border-white/20 text-white/50'"
                >
                  {{ t('lobby.installingBtn') }}
                  <span class="indet-track"><span class="indet-bar" /></span>
                </button>
                <button
                  v-else-if="miniGameError['badab']"
                  @click.stop="installMiniGame('badab')"
                  class="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-500 text-base font-bold tracking-wider transition-all"
                >
                  {{ t('lobby.installRetry') }}
                </button>
                <button
                  v-else-if="!miniGameInstalled['badab']"
                  @click.stop="installMiniGame('badab')"
                  class="flex-1 py-2.5 rounded-lg text-base font-bold tracking-wider transition-all"
                  :class="currentTheme === 'anime' 
                    ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-sm border border-white/60' 
                    : 'bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 border border-[#00f3ff]/30 text-[#00f3ff]'"
                >
                  {{ t('lobby.installGame') }}
                </button>
                <template v-else>
                <button 
                  v-if="hasBadabSave"
                  @click.stop="launchVueGame('badab', true)" 
                  class="flex-1 py-2.5 rounded-lg text-base font-bold tracking-wider transition-all"
                  :class="currentTheme === 'anime'
                    ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white shadow-sm border border-white/60'
                    : 'bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 border border-[#00f3ff]/30 text-[#00f3ff]'"
                >
                  {{ t('lobby.continueBtn') }}
                </button>
                <button 
                  @click.stop="launchVueGame('badab', false)" 
                  class="flex-1 py-2.5 rounded-lg text-base font-bold tracking-wider transition-all"
                  :class="[
                    !hasBadabSave ? 'w-full' : '',
                    currentTheme === 'anime'
                      ? 'bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#d6336c]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/20 text-white'
                  ]"
                >
                  {{ hasBadabSave ? t('lobby.newGame') : t('lobby.playBtn') }}
                </button>
                </template>
              </div>
              <div v-if="miniGameError['badab']" class="mt-2 text-xs text-red-500 font-code tracking-wider break-all">{{ miniGameErrorMsg['badab'] }}</div>
            </div>
          </div>

          <!-- 太空猫 -->
          <div 
            class="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
            :class="currentTheme === 'anime' 
              ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_8px_20px_rgba(180,150,230,0.15)] hover:border-[#ff85b3] hover:shadow-[0_12px_28px_rgba(180,150,230,0.25)]' 
              : 'bg-[#0a0a12] border border-white/[0.08] hover:border-[#fbbf24]/40'"
            @click="launchVueGame('starcat')"
            @contextmenu.prevent="onCardContextMenu('starcat', $event, 'mini')"
          >
            <div 
              class="relative w-full aspect-[3/2] overflow-hidden"
              :class="currentTheme === 'anime' ? 'bg-gradient-to-br from-amber-50 via-pink-50 to-sky-50' : 'bg-black/60'"
            >
              <div 
                v-if="currentTheme !== 'anime'"
                class="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/10 via-transparent to-[#f472b6]/10 group-hover:from-[#fbbf24]/20 group-hover:to-[#f472b6]/20 transition-all duration-500" 
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <svg 
                  class="w-24 h-24 transition-all duration-300 group-hover:scale-110" 
                  :class="currentTheme === 'anime' ? 'text-amber-500/70 group-hover:text-amber-600' : 'text-[#fbbf24]/40 group-hover:text-[#fbbf24]/60'"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div 
                class="absolute bottom-0 left-0 right-0 h-px transition-opacity opacity-0 group-hover:opacity-100" 
                :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3] to-transparent' : 'bg-gradient-to-r from-transparent via-[#fbbf24]/50 to-transparent'"
              />
            </div>
            <div class="p-5">
              <div class="flex items-center justify-between mb-2">
                <h3 
                  class="font-bold text-lg tracking-wide transition-colors font-sans"
                  :class="currentTheme === 'anime' ? 'text-[#1e192b] group-hover:text-[#ff66b2]' : 'text-white group-hover:text-[#fbbf24]'"
                >
                  {{ t('lobby.starcatTitle') }}
                </h3>
                <span 
                  class="text-xs font-bold px-2 py-0.5 rounded font-mono"
                  :class="currentTheme === 'anime' ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-zinc-500 border border-white/10'"
                >
                  STAR
                </span>
              </div>
              <p 
                class="text-base mb-5 leading-relaxed"
                :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-zinc-400'"
              >
                {{ t('lobby.starcatDesc') }}
              </p>
              <button
                v-if="miniGameInstalling['starcat']"
                disabled
                class="w-full py-2.5 rounded-lg text-base font-bold tracking-wider cursor-wait overflow-hidden relative"
                :class="currentTheme === 'anime' ? 'bg-slate-100 border border-slate-300 text-slate-500' : 'bg-white/5 border border-white/20 text-white/50'"
              >
                {{ t('lobby.installingBtn') }}
                <span class="indet-track"><span class="indet-bar" /></span>
              </button>
              <button
                v-else-if="miniGameError['starcat']"
                @click.stop="installMiniGame('starcat')"
                class="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-500 text-base font-bold tracking-wider transition-all"
              >
                {{ t('lobby.installRetry') }}
              </button>
              <button
                v-else-if="!miniGameInstalled['starcat']"
                @click.stop="installMiniGame('starcat')"
                class="w-full py-2.5 rounded-lg text-base font-bold tracking-wider transition-all"
                :class="currentTheme === 'anime'
                  ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-sm border border-white/60'
                  : 'bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/30 text-[#fbbf24]'"
              >
                {{ t('lobby.installGame') }}
              </button>
              <button
                v-else
                @click.stop="launchVueGame('starcat')"
                class="w-full py-2.5 rounded-lg text-base font-bold tracking-wider transition-all"
                :class="currentTheme === 'anime'
                  ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-sm border border-white/60'
                  : 'bg-[#fbbf24]/10 hover:bg-[#fbbf24]/20 border border-[#fbbf24]/30 text-[#fbbf24] group-hover:shadow-[0_0_12px_rgba(251,191,36,0.1)]'"
              >
                {{ t('lobby.playBtn') }}
              </button>
              <div v-if="miniGameError['starcat']" class="mt-2 text-xs text-red-500 font-code tracking-wider break-all">{{ miniGameErrorMsg['starcat'] }}</div>
            </div>
          </div>

          <!-- 赛博电音少女 (Cyber Guitar) -->
          <div 
            class="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
            :class="currentTheme === 'anime' 
              ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_8px_20px_rgba(180,150,230,0.15)] hover:border-[#ff00a0] hover:shadow-[0_12px_28px_rgba(255,0,160,0.25)]' 
              : 'bg-[#0a0a12] border border-white/[0.08] hover:border-[#00f3ff]/50 shadow-lg hover:shadow-[0_0_20px_rgba(0,243,255,0.15)]'"
            @click="miniGameInstalled['cyberguitar'] ? launchVueGame('cyberguitar') : null"
            @contextmenu.prevent="onCardContextMenu('cyberguitar', $event, 'mini')"
          >
            <div 
              class="relative w-full aspect-[3/2] overflow-hidden"
              :class="currentTheme === 'anime' ? 'bg-gradient-to-br from-pink-50 via-purple-50 to-cyan-50' : 'bg-black/60'"
            >
              <div 
                v-if="currentTheme !== 'anime'"
                class="absolute inset-0 bg-gradient-to-br from-[#00f3ff]/20 via-transparent to-[#ff00a0]/20 group-hover:from-[#00f3ff]/30 group-hover:to-[#ff00a0]/30 transition-all duration-500" 
              />
              <div class="absolute inset-0 flex items-center justify-center">
                <svg 
                  class="w-24 h-24 transition-all duration-300 group-hover:scale-110 text-cyan-400 group-hover:text-pink-400 filter drop-shadow-[0_0_12px_rgba(0,243,255,0.5)]" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
                </svg>
              </div>
              <div 
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <div class="p-5">
              <div class="flex items-center justify-between mb-2">
                <h3 
                  class="font-bold text-lg tracking-wide transition-colors font-sans"
                  :class="currentTheme === 'anime' ? 'text-[#1e192b] group-hover:text-[#ff00a0]' : 'text-white group-hover:text-[#00f3ff]'"
                >
                  电音少女
                </h3>
                <span 
                  class="text-xs font-bold px-2 py-0.5 rounded font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30"
                >
                  RHYTHM
                </span>
              </div>
              <p 
                class="text-base mb-5 leading-relaxed"
                :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-zinc-400'"
              >
                赛博霓虹律动，键盘扫弦对决与自由电音创作
              </p>
              <button
                v-if="miniGameInstalling['cyberguitar']"
                disabled
                class="w-full py-2.5 rounded-lg text-base font-bold tracking-wider cursor-wait overflow-hidden relative"
                :class="currentTheme === 'anime' ? 'bg-slate-100 border border-slate-300 text-slate-500' : 'bg-white/5 border border-white/20 text-white/50'"
              >
                {{ t('lobby.installingBtn') }}
                <span class="indet-track"><span class="indet-bar" /></span>
              </button>
              <button
                v-else-if="miniGameError['cyberguitar']"
                @click.stop="installMiniGame('cyberguitar')"
                class="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-red-500 text-base font-bold tracking-wider transition-all"
              >
                {{ t('lobby.installRetry') }}
              </button>
              <button
                v-else-if="!miniGameInstalled['cyberguitar']"
                @click.stop="installMiniGame('cyberguitar')"
                class="w-full py-2.5 rounded-lg text-base font-bold tracking-wider transition-all bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02]"
              >
                {{ t('lobby.installGame') }}
              </button>
              <button
                v-else
                @click.stop="launchVueGame('cyberguitar')"
                class="w-full py-2.5 rounded-lg text-base font-bold tracking-wider transition-all bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-cyan-500/20 hover:scale-[1.02]"
              >
                开始演奏 (PLAY)
              </button>
              <div v-if="miniGameError['cyberguitar']" class="mt-2 text-xs text-red-500 font-code tracking-wider break-all">{{ miniGameErrorMsg['cyberguitar'] }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ========== 独立游戏 Tab ========== -->
      <div v-else class="animate-fade-in">
        <!-- 加载中 -->
        <div v-if="indieLoading" class="h-64 flex items-center justify-center">
          <div class="w-10 h-10 border-4 border-[#00f3ff]/20 border-t-[#00f3ff] rounded-full animate-spin" />
        </div>

        <!-- 有数据 -->
        <div v-else-if="indieGames.length > 0" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          <div 
            v-for="g in indieGames" 
            :key="g.appid" 
            @contextmenu.prevent="onCardContextMenu(g, $event, 'indie')"
            class="group relative rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
            :class="currentTheme === 'anime' 
              ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_6px_20px_rgba(180,150,230,0.18)] hover:border-[#ff85b3] hover:shadow-[0_10px_26px_rgba(180,150,230,0.28)]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/90 border border-[#00f2ff]/20 hover:border-[#00f2ff]/50 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-md'
                : 'bg-[#0a0a12] border border-white/[0.08] hover:border-[#00f3ff]/40')"
          >
            <!-- 封面 2:3 -->
            <div 
              class="relative w-full aspect-[2/3] overflow-hidden"
              :class="currentTheme === 'anime' ? 'bg-pink-50/50' : 'bg-black/60'"
            >
              <img 
                :src="g.cover_url" 
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                loading="lazy"
                @error="onImgError"
              />
              <div 
                class="absolute inset-0"
                :class="currentTheme === 'anime' ? 'bg-gradient-to-t from-white via-white/20 to-transparent' : 'bg-gradient-to-t from-[#0a0a12] via-transparent to-transparent'" 
              />

              <!-- 安装中遮罩 -->
              <div 
                v-if="g.status === 'installing'" 
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
                :class="currentTheme === 'anime' ? 'bg-white/80' : 'bg-black/80'"
              >
                <div 
                  class="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  :class="currentTheme === 'anime' ? 'border-[#ff85b3]' : 'border-[#00f3ff]'" 
                />
                <span 
                  class="font-bold text-base font-mono"
                  :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'"
                >
                  {{ t('lobby.installingBtn') }}
                </span>
              </div>

              <!-- 已安装角标 (浅色毛玻璃底) -->
              <div 
                v-if="g.status === 'installed'" 
                class="absolute top-2 right-2 text-sm font-black px-2 py-0.5 rounded font-mono shadow-sm"
                :class="currentTheme === 'anime' ? 'bg-white/70 backdrop-blur-md border border-white/80 text-[#1e192b]' : 'bg-[#00f3ff]/20 backdrop-blur border border-[#00f3ff]/40 text-[#00f3ff]'"
              >
                READY
              </div>
            </div>

            <!-- 信息区 -->
            <div class="p-4">
              <h3 
                class="font-bold text-base mb-1 truncate transition-colors font-sans"
                :class="currentTheme === 'anime' ? 'text-[#1e192b] group-hover:text-[#ff66b2]' : 'text-white group-hover:text-[#00f3ff]'"
              >
                {{ g.title }}
              </h3>
              <p 
                class="text-base mb-3 line-clamp-2 h-12 leading-relaxed"
                :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-zinc-400'"
              >
                {{ g.desc }}
              </p>

              <!-- 安装进度条 -->
              <div 
                v-if="g.status === 'installing'" 
                class="w-full h-1 rounded-full overflow-hidden mb-3 relative"
                :class="currentTheme === 'anime' ? 'bg-pink-100' : 'bg-white/10'"
              >
                <div 
                  style="position:absolute; top:0; bottom:0; width:40%; animation:indetFlow 1.1s ease-in-out infinite;" 
                  :style="currentTheme === 'anime' 
                    ? 'background:linear-gradient(90deg, transparent, #ff85b3, transparent); box-shadow:0 0 8px rgba(255,133,179,0.8);' 
                    : 'background:linear-gradient(90deg, transparent, #00f3ff, transparent); box-shadow:0 0 8px rgba(0,243,255,0.8);'"
                />
              </div>

              <!-- 按钮 -->
              <button 
                v-if="g.status === 'not_installed'"
                @click="installGame(g)"
                class="w-full py-2.5 rounded-lg text-base font-bold transition-all"
                :class="currentTheme === 'anime'
                  ? 'bg-pink-50 hover:bg-pink-100 border border-pink-200 text-[#d6336c]'
                  : 'bg-white/5 hover:bg-white/10 border border-white/15 text-zinc-300 hover:text-white hover:border-white/30'"
              >
                {{ t('lobby.installBtn', { size: g.size }) }}
              </button>
              <button 
                v-else-if="g.status === 'update'"
                @click="installGame(g)"
                class="w-full py-2.5 rounded-lg text-base font-bold transition-all animate-pulse"
                :class="currentTheme === 'anime'
                  ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white shadow-sm border border-white/60'
                  : 'bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff]'"
              >
                {{ t('lobby.updateBtn') }}
              </button>
              <button 
                v-else-if="g.status === 'installed'"
                @click="launchGame(g)"
                class="w-full py-2.5 rounded-lg text-base font-bold transition-all shadow-sm"
                :class="currentTheme === 'anime'
                  ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white border border-white/60'
                  : 'bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 border border-[#00f3ff]/30 text-[#00f3ff] hover:shadow-[0_0_12px_rgba(0,243,255,0.1)]'"
              >
                {{ t('lobby.launchBtn') }}
              </button>
              <button 
                v-else-if="g.status === 'installing'"
                disabled
                class="w-full py-2.5 rounded-lg text-base font-bold cursor-not-allowed"
                :class="currentTheme === 'anime' ? 'bg-slate-100 border border-slate-200 text-slate-400' : 'bg-white/5 border border-white/10 text-zinc-600'"
              >
                {{ t('lobby.installingBtn') }}
              </button>
            </div>

            <!-- 悬停光效 -->
            <div 
              class="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" 
              :style="currentTheme === 'anime' ? 'box-shadow: inset 0 0 20px rgba(255,133,179,0.06)' : 'box-shadow: inset 0 0 40px rgba(0,243,255,0.03)'" 
            />
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="h-64 flex flex-col items-center justify-center text-zinc-600 gap-4">
          <svg class="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span class="text-base font-bold tracking-widest uppercase">{{ t('lobby.emptyTitle') }}</span>
          <span class="text-zinc-700 text-base">{{ t('lobby.emptyDesc') }}</span>
        </div>
      </div>
    </div>

    <!-- ========== 右键卸载菜单 ========== -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.show"
        class="fixed inset-0 z-[9998]"
        @click="closeCtxMenu"
        @contextmenu.prevent="closeCtxMenu"
      />
    </Teleport>
    <ContextMenu
      :visible="ctxMenu.show"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :title="ctxMenu.game?.title || ''"
      variant="library"
      @close="closeCtxMenu"
    >
      <button
        class="w-full text-left px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors"
        @click="confirmUninstall"
      >
        {{ t('modal.uninstall') }}
      </button>
    </ContextMenu>

    <!-- ========== Vue 小游戏内嵌容器 ========== -->
    <div v-if="currentVueGame" class="absolute inset-0 z-50 bg-black">
      <component
        :is="vueGameComponents[currentVueGame]"
        :continue-game="shouldContinue"
        @exit="exitVueGame"
        @update:stats="updateGameStats"
      />
    </div>

    <!-- ========== 兑换弹窗 ========== -->
    <div 
      v-if="showRedeemModal" 
      class="absolute inset-0 z-50 backdrop-blur-sm flex items-center justify-center animate-fade-in" 
      :class="currentTheme === 'anime' ? 'bg-black/30' : 'bg-black/80'"
      @click.self="showRedeemModal = false"
    >
      <div 
        class="rounded-2xl p-8 max-w-md w-full mx-4 transition-all"
        :class="currentTheme === 'anime' 
          ? 'bg-white/98 border-2 border-amber-300 text-[#1e192b] shadow-[0_16px_40px_rgba(251,191,36,0.2)]' 
          : 'bg-[#0a0a12] border border-yellow-500/20 text-white shadow-[0_0_60px_rgba(234,179,8,0.08)]'" 
        @click.stop
      >
        <div class="flex items-center gap-3 mb-2">
          <svg class="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <h2 class="font-black text-xl tracking-wide font-sans" :class="currentTheme === 'anime' ? 'text-amber-600' : 'text-yellow-400'">{{ t('lobby.redeemTitle') }}</h2>
        </div>

        <p class="text-base mb-6 leading-relaxed" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-zinc-400'">
          {{ t('lobby.redeemDesc') }}
        </p>

        <div 
          class="flex items-center justify-between mb-6 rounded-xl p-4 border"
          :class="currentTheme === 'anime' ? 'bg-amber-50/70 border-amber-200' : 'bg-white/[0.02] border border-white/[0.06]'"
        >
          <span class="text-base" :class="currentTheme === 'anime' ? 'text-[#4a425a] font-bold' : 'text-zinc-400'">{{ t('lobby.currentHold') }}</span>
          <div class="flex items-center gap-2">
            <span class="font-bold text-xl font-mono" :class="currentTheme === 'anime' ? 'text-amber-600' : 'text-yellow-400'">{{ player.cores }}</span>
            <span class="text-base font-bold" :class="currentTheme === 'anime' ? 'text-amber-700' : 'text-yellow-500/60'">CORE</span>
          </div>
        </div>

        <div class="space-y-2 mb-6">
          <div 
            v-for="n in [1, 2, 3]" 
            :key="n"
            @click="redeemAmount = n"
            class="flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer"
            :class="redeemAmount === n 
              ? (currentTheme === 'anime' ? 'border-amber-400 bg-amber-100/70 shadow-sm' : 'border-yellow-500/40 bg-yellow-500/[0.06]') 
              : (currentTheme === 'anime' ? 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40' : 'border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02]')"
          >
            <div class="flex items-center gap-3">
              <div 
                class="w-7 h-7 rounded-full border flex items-center justify-center font-bold text-sm"
                :class="currentTheme === 'anime' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'"
              >
                {{ n }}
              </div>
              <span class="text-base font-medium" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-zinc-300'">{{ t('lobby.redeemN', { n }) }}</span>
            </div>
            <span class="font-mono text-base font-bold" :class="currentTheme === 'anime' ? 'text-amber-600' : 'text-yellow-400'">{{ n }} CORE</span>
          </div>
        </div>

        <div v-if="redeemError" class="text-red-500 text-base mb-4 text-center font-mono bg-red-500/10 border border-red-500/30 rounded-lg py-2">
          {{ redeemError }}
        </div>
        <div v-if="redeemSuccess" class="text-emerald-600 text-base mb-4 text-center font-mono bg-emerald-50 border border-emerald-300 rounded-lg py-2 animate-pulse font-bold">
          {{ t('lobby.redeemOk') }}
        </div>

        <div class="flex gap-3">
          <button 
            @click="showRedeemModal = false"
            class="flex-1 py-2.5 rounded-xl transition-all text-base font-bold tracking-wider border cursor-pointer"
            :class="currentTheme === 'anime' ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200' : 'border-white/15 text-zinc-400 hover:text-white hover:border-white/30'"
          >
            {{ t('common.cancel') }}
          </button>
          <button 
            @click="doRedeem"
            :disabled="redeeming || player.cores < redeemAmount || redeemAmount <= 0"
            class="flex-1 py-2.5 rounded-xl transition-all text-base font-bold tracking-wider border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            :class="currentTheme === 'anime'
              ? 'bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-amber-950 border-amber-300'
              : 'bg-yellow-500/15 hover:bg-yellow-500/25 border-yellow-500/40 text-yellow-300'"
          >
            {{ redeeming ? t('lobby.processing') : t('lobby.confirmRedeem') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, markRaw, watch } from 'vue';
import { usePlayerStore } from '../stores/playerStore';
import { useTelemetryStore } from '../stores/telemetryStore';
import { useMiniGameStore } from '../stores/miniGameStore';
import * as MiniGameService from '../main/services/miniGameService';
import BadabGame from './games/badab/BadabGame.vue';
import StarCatGame from './games/StarCat/StarCatGame.vue';
import CyberGuitarGame from './games/CyberGuitar/CyberGuitarGame.vue';
import { t } from '../i18n';
import Swal from 'sweetalert2';
import { tcToast } from '../utils/tcToast';
import ContextMenu from './common/ContextMenu.vue';
import { useTheme } from '../composables/useTheme';

const { currentTheme } = useTheme();
const player = usePlayerStore();
const telemetryStore = useTelemetryStore();
const miniGameStore = useMiniGameStore();

// TAB 状态
const activeTab = ref<'mini' | 'indie'>('mini');

// Vue 小游戏状态
const currentVueGame = ref<string | null>(null);
const shouldContinue = ref(false);
const hasBadabSave = ref(false);

const vueGameComponents: Record<string, any> = {
  badab: markRaw(BadabGame),
  starcat: markRaw(StarCatGame),
  cyberguitar: markRaw(CyberGuitarGame)
};

// ===== 小游戏素材安装状态机（任务B R37a） =====
const miniGameInstalled = ref<Record<string, boolean>>({});
const miniGameInstalling = ref<Record<string, boolean>>({});
const miniGameError = ref<Record<string, boolean>>({});
const miniGameErrorMsg = ref<Record<string, string>>({});
const miniGameLinks = ref<Record<string, string | string[]>>({});
let unsubMiniProgress: (() => void) | null = null;
let unsubMiniDone: (() => void) | null = null;

async function refreshMiniGameState() {
  try {
    const st = await window.electron.minigame.getState();
    const map: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(st || {})) {
      map[k] = !!(v as any)?.installed;
    }
    miniGameInstalled.value = map;
  } catch { /* 静默：读不到按未安装处理 */ }
}

async function ensureMiniGameLinks() {
  if (Object.keys(miniGameLinks.value).length > 0) return;
  const res = await window.electron.minigame.fetchLinks();
  if (res?.success && Array.isArray(res.data)) {
    const map: Record<string, string> = {};
    for (const g of res.data) {
      const urlOrUrls = Array.isArray(g?.download_urls) && g.download_urls.length ? g.download_urls : g?.download_url;
      if (g?.id && urlOrUrls) map[g.id] = urlOrUrls;
    }
    miniGameLinks.value = map;
  }
}

async function installMiniGame(id: string) {
  if (miniGameInstalling.value[id]) return;
  miniGameError.value = { ...miniGameError.value, [id]: false };
  try {
    await ensureMiniGameLinks();
    const urls = miniGameLinks.value[id];
    if (!urls || (Array.isArray(urls) && urls.length === 0)) throw new Error('ERR_DOWNLOAD_URL_MISSING');
    miniGameInstalling.value = { ...miniGameInstalling.value, [id]: true };
    // R57: 镜像数组全量透传, aria2 原生多源竞速；脱敏转纯原生对象防克隆阻断
    const rawUrls = typeof urls === 'string' ? urls : JSON.parse(JSON.stringify(urls));
    const res = await window.electron.minigame.install(id, rawUrls);
    if (!res?.success) throw new Error(res?.error || 'ERR_INSTALL_FAIL');
    // 事件可能因窗口重载等丢失，成功后以主进程 meta.json 为准回读一次状态
    await refreshMiniGameState();
  } catch (e: any) {
    const msg = String(e?.message || e || 'ERR_UNKNOWN');
    miniGameInstalling.value = { ...miniGameInstalling.value, [id]: false };
    miniGameError.value = { ...miniGameError.value, [id]: true };
    miniGameErrorMsg.value = { ...miniGameErrorMsg.value, [id]: t(msg) };
  }
}

// 独立游戏列表（状态直接内联在组件中）
const indieGames = ref<any[]>([]);
const indieLoading = ref(false);

// 兑换弹窗状态
const showRedeemModal = ref(false);
const redeemAmount = ref(1);
const redeeming = ref(false);
const redeemSuccess = ref(false);
const redeemError = ref('');

function launchVueGame(id: string, continueGame = false) {
  // 未安装的小游戏禁止启动（R37a）
  if ((id === 'badab' || id === 'starcat' || id === 'cyberguitar') && !miniGameInstalled.value[id]) return;
  // 🟢 埋点：小游戏启动
  telemetryStore.trackLobbyEvent('lobby_game_launch', { game_id: id, game_title: id, source: 'mini' });
  if (id === 'badab' && !continueGame) {
    MiniGameService.deleteSave('badab');
  }
  shouldContinue.value = continueGame;
  currentVueGame.value = id;
}

function exitVueGame() {
  currentVueGame.value = null;
  shouldContinue.value = false;
  hasBadabSave.value = !!MiniGameService.load('badab');
}

function updateGameStats(stats: { scrap?: number; cores?: number }) {
  if (stats.scrap) player.scrap += stats.scrap;
  if (stats.cores) player.cores += stats.cores;
}

// 拉取独立游戏列表并合并本地安装状态
async function loadIndieGames() {
  indieLoading.value = true;
  try {
    const [listRes, libRes] = await Promise.all([
      window.electron.invoke('tcgame:fetch-list'),
      window.electron.invoke('tcgame:get-library')
    ]);
    if (listRes?.success && Array.isArray(listRes.data)) {
      const lib = libRes || {};
      indieGames.value = listRes.data.map((g: any) => ({
        appid: g.appid,
        title: g.title,
        desc: g.desc || g.description || '',
        version: g.version,
        size: g.size,
        cover_url: g.cover_url || g.cover,
        exe_name: g.exe_name || g.entry_exe || 'game.exe',
        download_url: g.download_url || (Array.isArray(g.download_urls) ? g.download_urls[0] : ''),
        status: !lib[g.appid] ? 'not_installed' : (String((lib[g.appid] as any)?.version || '') !== String(g.version || '') ? 'update' : 'installed'),
      }));
    }
  } catch (e) {
    console.error('[Arcade] 拉取独立游戏列表失败:', e);
  } finally {
    indieLoading.value = false;
  }
}


// ========== 右键卸载（小游戏 / 独立游戏） ==========
const ctxMenu = ref({ show: false, x: 0, y: 0, game: null as any, type: '' as 'mini' | 'indie' | '' });
const uninstalling = ref(false);

function closeCtxMenu() {
  ctxMenu.value.show = false;
}

function clampCtxMenuPos() {
  ctxMenu.value.x = Math.max(10, Math.min(ctxMenu.value.x, window.innerWidth - 266));
  ctxMenu.value.y = Math.max(10, Math.min(ctxMenu.value.y, window.innerHeight - 300));
}

function onCardContextMenu(target: any, e: MouseEvent, type: 'mini' | 'indie') {
  if (type === 'mini') {
    const id = target as string;
    if (!miniGameInstalled.value[id] || miniGameInstalling.value[id] || currentVueGame.value) return;
    const titleMap: Record<string, string> = {
      badab: t('lobby.badabTitle'),
      starcat: t('lobby.starcatTitle'),
      cyberguitar: '电音少女'
    };
    ctxMenu.value = { show: true, x: e.clientX, y: e.clientY, game: { id, title: titleMap[id] || id }, type };
    clampCtxMenuPos();
    return;
  }
  const g = target as any;
  if (g.status !== 'installed' && g.status !== 'update') return;
  ctxMenu.value = { show: true, x: e.clientX, y: e.clientY, game: g, type };
  clampCtxMenuPos();
}

function titanAlert(title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') {
  tcToast(title, text, icon);
}

async function confirmUninstall() {
  const m = ctxMenu.value;
  if (!m.game || uninstalling.value) return;
  closeCtxMenu();

  // 统一二次确认（小游戏与独立游戏一致）
  const confirmed = await Swal.fire({
    icon: 'warning',
    title: t('common.warning'),
    text: `${t('library.uninstall.title')} (${m.game.title})`,
    showCancelButton: true,
    confirmButtonText: t('modal.uninstall'),
    cancelButtonText: t('common.cancel'),
    background: '#121212',
    color: '#fff',
    confirmButtonColor: '#ef4444',
  });
  if (!confirmed.isConfirmed) return;

  uninstalling.value = true;
  try {
    if (m.type === 'mini') {
      telemetryStore.trackLobbyEvent('lobby_uninstall_click', { game_id: m.game.id, game_title: m.game.title, source: 'minigame' });
      const res = await window.electron.invoke('minigame:uninstall', m.game.id);
      if (!res?.success) throw new Error(res?.error || 'ERR_UNKNOWN');
      miniGameInstalled.value[m.game.id] = false;
      miniGameError.value[m.game.id] = false;
      miniGameErrorMsg.value[m.game.id] = '';
      titanAlert(t('modal.uninstall'), t('common.success'), 'success');
    } else {
      telemetryStore.trackLobbyEvent('lobby_uninstall_click', { game_id: m.game.appid, game_title: m.game.title, source: 'indie' });
      const res = await window.electron.invoke('tcgame:uninstall', m.game.appid, m.game.exe_name);
      if (!res?.success) throw new Error(res?.error || 'ERR_UNKNOWN');
      m.game.status = 'not_installed';
      titanAlert(t('modal.uninstall'), t('common.success'), 'success');
    }
  } catch (e: any) {
    titanAlert(t('modal.uninstall'), e?.message ? t(e.message) : t('common.error'), 'error');
  } finally {
    uninstalling.value = false;
  }
}

// 安装独立游戏
async function installGame(g: any) {
  if (g.status === 'installing') return;
  // 🟢 埋点：独立游戏安装点击
  telemetryStore.trackLobbyEvent('lobby_install_click', { game_id: g.appid, game_title: g.title, source: 'indie' });
  g.status = 'installing';
    try {
    const meta = {
      title: g.title,
      version: g.version,
      exe_name: g.exe_name,
      download_urls: Array.isArray(g.download_urls) && g.download_urls.length ? g.download_urls : (g.download_url ? [g.download_url] : []),
      cover_url: g.cover_url
    };
    const res = await window.electron.invoke('tcgame:install', g.appid, meta);
    if (!res?.success) throw new Error(res?.error || 'ERR_INSTALL_FAIL');
  } catch (e: any) {
    g.status = 'not_installed';
    // fix42(A6): surface install failure - this catch used to swallow everything.
    // Aligned with the confirmUninstall pattern: t() translates error codes,
    // already-translated text passes through untouched.
    titanAlert(t('lobby.installFailed'), e?.message ? t(e.message) : t('common.error'), 'error');
  }
}

// 启动独立游戏
async function launchGame(g: any) {
  // 🟢 埋点：独立游戏启动
  telemetryStore.trackLobbyEvent('lobby_game_launch', { game_id: g.appid, game_title: g.title, source: 'indie' });
  try {
    const res = await window.electron.invoke('tcgame:launch', g.appid, g.exe_name);
    if (!res?.success) throw new Error(res?.error || t('lobby.launchFailed'));
  } catch (e: any) {
    alert(t('lobby.launchFailedMsg', { msg: t(e.message) }));
  }
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22900%22%3E%3Crect fill=%22%230a0a12%22 width=%22600%22 height=%22900%22/%3E%3Ctext fill=%22%23333%22 font-family=%22sans-serif%22 font-size=%2240%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22%3ENO COVER%3C/text%3E%3C/svg%3E';
}

async function doRedeem() {
  if (redeeming.value || player.cores < redeemAmount.value || redeemAmount.value <= 0) return;

  redeeming.value = true;
  redeemError.value = '';
  redeemSuccess.value = false;

  try {
    const score = redeemAmount.value * 10000;
    const res = await window.electron.invoke('sys:redeem-cores', score, redeemAmount.value);

    if (res?.success && res.data) {
      // 🟢 埋点：额度兑换成功
      telemetryStore.trackLobbyEvent('lobby_redeem', { amount: redeemAmount.value, cost: score });
      player.cores -= redeemAmount.value;
      redeemSuccess.value = true;
      setTimeout(() => { redeemSuccess.value = false; }, 3000);
    } else {
      redeemError.value = res?.error === 'QUOTA_EXHAUSTED' 
        ? t('lobby.redeemLimit') 
        : (res?.error || t('lobby.redeemFailed'));
    }
  } catch (e: any) {
    redeemError.value = t('lobby.redeemNetError');
    console.error('[Arcade] 兑换失败:', e);
  } finally {
    redeeming.value = false;
  }
}

// 独立游戏事件监听清理函数
let unsubProgress: (() => void) | null = null;
let unsubDone: (() => void) | null = null;

watch(activeTab, (tab) => {
  if (tab === 'indie') loadIndieGames();
});

onMounted(() => {
  // 初始化积分 Store（检查每日清空）
  miniGameStore.init();

  // 侦测巴达布前哨是否存在本地存档
  hasBadabSave.value = !!MiniGameService.load('badab');

  // 小游戏素材安装状态机（R37a）
  refreshMiniGameState();
  unsubMiniProgress = window.electron.minigame.onProgress((data: any) => {
    if (!data?.gameId) return;
    miniGameInstalling.value = { ...miniGameInstalling.value, [data.gameId]: true };
  });
  unsubMiniDone = window.electron.minigame.onInstallDone((data: any) => {
    if (!data?.gameId) return;
    miniGameInstalling.value = { ...miniGameInstalling.value, [data.gameId]: false };
    if (data.success) {
      miniGameInstalled.value = { ...miniGameInstalled.value, [data.gameId]: true };
    } else {
      miniGameError.value = { ...miniGameError.value, [data.gameId]: true };
      miniGameErrorMsg.value = { ...miniGameErrorMsg.value, [data.gameId]: t(String(data.error || 'ERR_UNKNOWN')) };
    }
  });

  // 独立游戏进度事件监听
  unsubProgress = window.electron.on('tcgame:install-progress', (data: any) => {
    const g = indieGames.value.find((x: any) => x.appid === data.appid);
    if (g) {
      g.status = 'installing';
    }
  });

  unsubDone = window.electron.on('tcgame:install-done', (data: any) => {
    const g = indieGames.value.find((x: any) => x.appid === data.appid);
    if (g) {
      if (data.success) {
        g.status = 'installed';
        } else {
        g.status = 'not_installed';
                alert(t('errors.installFailTpl', { msg: t(String(data.error || 'ERR_UNKNOWN')) }));
      }
    }
  });

  // 如果当前在独立游戏 Tab，立即加载列表
  if (activeTab.value === 'indie') {
    loadIndieGames();
  }
});

onUnmounted(() => {
  // 清理独立游戏事件监听
  unsubProgress?.();
  unsubDone?.();
  unsubMiniProgress?.();
  unsubMiniDone?.();
});
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
/* R64: 不确定进度 = 赛博青流动动画, 全程零数字 */
.indet-track { position: absolute; left: 14px; right: 14px; bottom: 7px; height: 3px; background: rgba(0,243,255,0.10); border-radius: 2px; overflow: hidden; }
.indet-bar { position: absolute; top: 0; bottom: 0; width: 40%; border-radius: 2px; background: linear-gradient(90deg, transparent, #00f3ff, transparent); box-shadow: 0 0 8px rgba(0,243,255,0.8); animation: indetFlow 1.1s ease-in-out infinite; }
@keyframes indetFlow { 0% { left: -40%; } 100% { left: 100%; } }
</style>