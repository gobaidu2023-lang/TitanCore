<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen && resource" class="fixed inset-0 z-[999] flex items-center justify-center p-4 backdrop-blur-md" :class="currentTheme === 'anime' ? 'bg-slate-900/40' : (currentTheme === 'minimal' ? 'bg-[#06080e]/80' : 'bg-black/80')" @click.self="handleBackdropClick">
        <div 
          class="w-[min(94vw,max(62rem,46vw),78rem)] h-[86vh] max-h-[920px] rounded-xl flex flex-col overflow-hidden relative animate-scale-in transition-all duration-300"
          :class="currentTheme === 'anime' 
            ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] text-[#1e192b]' 
            : (currentTheme === 'minimal'
              ? 'bg-[#101623]/95 backdrop-blur-xl border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.2)] text-white'
              : 'bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.8)] text-white')"
        >
          <!-- 顶部冷光/粉蓝丝线 -->
          <div 
            class="absolute inset-x-0 top-0 h-[2px] pointer-events-none z-50 transition-all duration-300"
            :class="currentTheme === 'anime'
              ? 'bg-gradient-to-r from-transparent via-[#ff85b3]/70 to-transparent'
              : 'bg-gradient-to-r from-transparent via-[#00f3ff]/40 to-transparent'"
          ></div>

          <!-- 关闭按钮（部署中禁用关闭） -->
          <button 
            @click="close" 
            :disabled="deployState === 'deploying'"
            :class="[
              deployState === 'deploying' ? 'opacity-20 cursor-not-allowed' : (currentTheme === 'anime' ? 'hover:bg-pink-100 text-[#1e192b]' : 'hover:bg-white/10 text-white/40 hover:text-white'),
              currentTheme === 'anime' ? 'bg-white/90 border-[#ff9ec7]' : 'bg-black/40 border-white/[0.06]'
            ]"
            class="absolute top-5 right-5 z-50 p-2.5 rounded-full transition-all border shadow-sm" 
            :title="deployState === 'deploying' ? t('detail.deployingNoClose') : t('detail.closeEsc')"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>

          <!-- 顶部封面与横幅信息 (优化高度 clamp 防挤压) -->
          <div class="relative h-[clamp(14rem,20vh,18rem)] shrink-0 overflow-hidden group" :class="currentTheme === 'anime' ? 'bg-[#f0f4fa]' : 'bg-[#050508]'">
            <TitanImage
              :id="gameId || ''"
              :src="coverUrl"
              class="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
              :class="currentTheme === 'anime' ? 'opacity-90' : 'opacity-85'"
              alt="cover"
            />
            <div 
              class="absolute inset-0 transition-colors duration-300"
              :class="currentTheme === 'anime' 
                ? 'bg-gradient-to-t from-white via-white/60 to-transparent' 
                : 'bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/50 to-transparent'"
            ></div>

            <div class="absolute bottom-6 left-10 right-10 flex items-end justify-between z-10">
              <div>
                <div class="flex items-center gap-2.5 mb-3">
                  <span 
                    class="text-xs font-mono tracking-wider px-3 py-1 rounded border transition-colors"
                    :class="currentTheme === 'anime' 
                      ? 'text-[#ff66b2] bg-pink-50 border-pink-200 font-bold' 
                      : 'text-[#00f3ff] bg-[#00f3ff]/10 border-[#00f3ff]/30'"
                  >
                    {{ resource.type?.toUpperCase() || 'TITAN_PROTOCOL' }}
                  </span>
                  <span v-if="radarStatus === 'red'" class="text-xs font-mono tracking-wider text-rose-500 bg-rose-50 px-3 py-1 rounded border border-rose-200 font-bold">
                    DENUVO PROTECTED
                  </span>
                </div>
                <h1 
                  class="text-3xl md:text-4xl lg:text-[2.5rem] font-black tracking-tight leading-tight transition-colors"
                  :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white drop-shadow-md'"
                >
                  {{ resource.basic?.title || t('detail.unknownResource') }}
                </h1>
              </div>
            </div>
          </div>

          <!-- 主内容区域：左侧元数据，右侧行动舱 -->
          <div class="flex flex-1 overflow-hidden relative z-10 transition-colors" :class="currentTheme === 'anime' ? 'bg-white' : 'bg-[#0a0a0f]'">
            <!-- 左侧：详情描述与状态 (2/3) -->
            <div 
              class="w-2/3 p-8 lg:p-10 overflow-y-auto custom-scrollbar border-r flex flex-col justify-between transition-colors"
              :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/[0.05]'"
            >
              <div>
                <!-- 头部：资源信息标题 + 投票胶囊 -->
                <div class="flex items-center justify-between mb-6">
                  <h3 
                    class="font-bold flex items-center gap-2.5 text-lg my-0 transition-colors"
                    :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
                  >
                    <span class="w-1.5 h-5 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff85b3]' : 'bg-[#00f3ff]'"></span>
                    {{ t('detail.resourceInfo') }}
                  </h3>

                  <!-- 社区可用性投票 -->
                  <div 
                    class="flex items-center rounded-md overflow-hidden border transition-colors"
                    :class="currentTheme === 'anime' ? 'bg-pink-50/50 border-pink-200' : 'bg-white/[0.03] border-white/[0.08]'"
                  >
                    <button
                      @click="castVote('up')"
                      :disabled="hasVoted"
                      :class="[
                        hasVoted ? 'opacity-70 cursor-default' : (currentTheme === 'anime' ? 'hover:bg-pink-100 active:scale-95' : 'hover:bg-[#00f3ff]/15 active:scale-95')
                      ]"
                      class="flex items-center gap-2 px-3.5 py-2 transition-all"
                      :title="t('detail.voteUpTitle')"
                    >
                      <span class="w-2 h-2 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff85b3] shadow-[0_0_8px_#ff85b3]' : 'bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]'"></span>
                      <span class="text-sm font-mono font-bold" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white/90'">{{ upVotes }}</span>
                    </button>
                    <div class="w-px h-4" :class="currentTheme === 'anime' ? 'bg-pink-200' : 'bg-white/10'"></div>
                    <button
                      @click="castVote('down')"
                      :disabled="hasVoted"
                      :class="[
                        hasVoted ? 'opacity-70 cursor-default' : (currentTheme === 'anime' ? 'hover:bg-rose-100 active:scale-95' : 'hover:bg-rose-500/15 active:scale-95')
                      ]"
                      class="flex items-center gap-2 px-3.5 py-2 transition-all"
                      :title="t('detail.voteDownTitle')"
                    >
                      <span class="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#f43f5e]"></span>
                      <span class="text-sm font-mono font-bold" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white/90'">{{ downVotes }}</span>
                    </button>
                  </div>
                </div>

                <!-- 资源存量指示器 -->
                <div v-if="fromSearch && stock === 'hit'" class="mb-5 flex items-center gap-2.5 text-sm font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-lg">
                  <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                  <span>{{ t('detail.stockHit') }}</span>
                </div>
                <div v-else-if="fromSearch && stock === 'restocking'" class="mb-5 flex items-center gap-2.5 text-sm font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-lg">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span>{{ t('detail.stockRestocking') }}</span>
                </div>
                <div v-else-if="fromSearch && (stock === 'miss' || stock === 'dead')" class="mb-5 flex items-center gap-2.5 text-sm font-semibold text-zinc-500 bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-lg">
                  <span class="w-2.5 h-2.5 rounded-full bg-zinc-400"></span>
                  <span>{{ t('detail.stockMiss') }}</span>
                </div>

                <!-- 雷达排障警示 - 红 -->
                <div v-if="radarStatus === 'red'" class="mb-6 p-5 rounded-lg" :class="currentTheme === 'anime' ? 'bg-rose-50 border border-rose-200' : 'bg-rose-500/10 border border-rose-500/25'">
                  <div class="text-rose-500 text-base font-bold flex items-center gap-2.5 mb-1.5">
                    <span class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    {{ t('detail.radarDenuvoTitle') }}
                  </div>
                  <div class="text-sm leading-relaxed" :class="currentTheme === 'anime' ? 'text-rose-700' : 'text-rose-300/80'">{{ t('detail.radarDenuvoDesc') }}</div>
                </div>

                <!-- 雷达排障警示 - 黄 -->
                <div v-else-if="radarStatus === 'yellow'" class="mb-6 p-5 rounded-lg" :class="currentTheme === 'anime' ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/25'">
                  <div class="text-amber-500 text-base font-bold flex items-center gap-2.5 mb-1.5">
                    <span class="w-3 h-3 rounded bg-amber-500 border border-black shadow-[0_0_6px_#eab308]"></span>
                    {{ t('detail.radarDependencyTitle') }}
                  </div>
                  <div class="text-sm leading-relaxed" :class="currentTheme === 'anime' ? 'text-amber-700' : 'text-amber-300/80'">{{ t('detail.radarDependencyDesc') }}</div>
                </div>

                <!-- 描述正文 (绝对高对比度：二次元下使用 #4a425a，彻底根除物理不可见缺陷) -->
                <p 
                  class="leading-relaxed text-base whitespace-pre-wrap font-sans transition-colors"
                  :class="currentTheme === 'anime' ? 'text-[#4a425a] selection:bg-pink-100' : 'text-[#94a3b8] selection:bg-[#00f3ff]/20'"
                >
                  {{ resource.basic?.desc || resource.meta?.description || t('detail.unknown') }}
                </p>

                <!-- 服务端广播 -->
                <div v-if="displayNotice" class="mt-6 p-4 rounded-lg flex items-center gap-3" :class="currentTheme === 'anime' ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/25'">
                  <span class="text-sm font-bold tracking-wide shrink-0" :class="currentTheme === 'anime' ? 'text-amber-600' : 'text-amber-400'">公告</span>
                  <span class="text-sm font-medium leading-relaxed" :class="currentTheme === 'anime' ? 'text-amber-800' : 'text-amber-200'">{{ displayNotice }}</span>
                </div>
              </div>

              <!-- 底部标签列表 (二次元下浅紫粉底黑字高对比度) -->
              <div 
                class="mt-8 pt-5 border-t flex flex-wrap gap-2.5 transition-colors"
                :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/[0.04]'"
              >
                <span 
                  v-for="tag in (resource.basic?.tags || [])" 
                  :key="tag" 
                  class="px-3 py-1.5 rounded text-sm transition-colors font-mono"
                  :class="currentTheme === 'anime'
                    ? 'bg-[#f8f5ff] border border-[#e2d4f0] text-[#554c66] hover:text-[#ff66b2] hover:border-[#ff9ec7]'
                    : 'bg-white/[0.02] border border-white/[0.06] text-[#64748b] hover:text-[#00f3ff] hover:border-[#00f3ff]/30'"
                >
                  #{{ tag }}
                </span>
              </div>
            </div>

            <!-- 右侧：行动控制台与原位状态机 (带滚动保护) -->
            <div 
              class="w-1/3 p-6 lg:p-8 flex flex-col justify-between border-l relative overflow-y-auto custom-scrollbar transition-colors"
              :class="currentTheme === 'anime' ? 'bg-[#f8faff] border-pink-100' : 'bg-[#0d0e15]/80 border-white/[0.03]'"
            >
              <!-- 上半部分：额度与操作区 -->
              <div class="space-y-6">
                <!-- 每日配额胶囊 -->
                <div 
                  v-if="authStore.isLoggedIn" 
                  class="flex items-center justify-between p-4 rounded-lg border transition-colors"
                  :class="[
                    currentTheme === 'anime' ? 'bg-white border-[#bce8ff] shadow-sm' : 'bg-white/[0.02] border-white/[0.06]',
                    { 'border-rose-500/30 bg-rose-500/5': safeRemaining <= 0 && safeExtraRemaining <= 0 }
                  ]"
                >
                  <div class="flex items-center gap-2.5 text-sm" :class="currentTheme === 'anime' ? 'text-[#64748b]' : 'text-[#94a3b8]'">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" :class="quotaColorClass">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                    <span>{{ t('detail.dailyQuota') }}</span>
                  </div>
                  <div class="text-base font-mono font-bold" :class="quotaColorClass">
                    <template v-if="quotaLoaded">
                      {{ safeRemaining }}/{{ safeLimit }}
                      <span v-if="safeExtraRemaining > 0" :class="currentTheme === 'anime' ? 'text-amber-600' : 'text-amber-400'">+{{ safeExtraRemaining }}</span>
                    </template>
                    <template v-else>--/--</template>
                  </div>
                </div>

                <div v-else class="flex items-center justify-between p-3.5 rounded-lg" :class="currentTheme === 'anime' ? 'bg-sky-50 border border-sky-200' : 'bg-blue-500/10 border border-blue-500/20'">
                  <span class="text-sm" :class="currentTheme === 'anime' ? 'text-sky-800' : 'text-blue-300'">{{ t('detail.loginToDownload') }}</span>
                  <button @click="showLoginToast" class="text-sm font-bold hover:underline" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'">{{ t('detail.goLogin') }}</button>
                </div>

                <!-- 状态机：原位卡片流转 -->
                <div class="min-h-[260px] flex flex-col justify-center">
                  <!-- 1. 部署进行中状态 (Deploying) -->
                  <div 
                    v-if="deployState === 'deploying'" 
                    class="p-6 rounded-lg flex flex-col gap-5 animate-fade-in border"
                    :class="currentTheme === 'anime' ? 'bg-pink-50/60 border-pink-200' : 'bg-[#00f3ff]/[0.03] border-[#00f3ff]/30'"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="w-3 h-3 rounded-full animate-ping" :class="currentTheme === 'anime' ? 'bg-[#ff85b3]' : 'bg-[#00f3ff] shadow-[0_0_12px_#00f3ff]'"></span>
                        <span class="text-sm font-mono font-bold tracking-wider uppercase" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'">{{ t('detail.processing') }}</span>
                      </div>
                      <span class="text-sm font-mono" :class="currentTheme === 'anime' ? 'text-[#1e192b] font-bold' : 'text-white/70'">{{ localProgressPercent }}%</span>
                    </div>

                    <!-- 精度微光进度条 -->
                    <div class="h-2 w-full rounded-full overflow-hidden" :class="currentTheme === 'anime' ? 'bg-pink-100' : 'bg-white/[0.08]'">
                      <div 
                        class="h-full transition-all duration-300"
                        :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff]' : 'bg-[#00f3ff] shadow-[0_0_10px_#00f3ff]'"
                        :style="{ width: `${localProgressPercent}%` }"
                      ></div>
                    </div>

                    <div class="text-sm font-sans leading-relaxed min-h-[40px]" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-[#94a3b8]'">
                      {{ currentStatusText || t('detail.syncingRepo') }}
                    </div>

                    <div 
                      class="text-xs font-mono flex items-center justify-between border-t pt-3"
                      :class="currentTheme === 'anime' ? 'border-pink-100 text-[#64748b]' : 'border-white/[0.06] text-white/30'"
                    >
                      <span>APPID: {{ effectiveAppId }}</span>
                      <span class="font-bold" :class="currentTheme === 'anime' ? 'text-amber-600' : 'text-amber-400/80'">{{ t('detail.doNotInterrupt') }}</span>
                    </div>
                  </div>

                  <!-- 2. 部署成功就绪状态 (Success) -->
                  <div 
                    v-else-if="deployState === 'success'" 
                    class="p-6 rounded-lg flex flex-col gap-5 animate-fade-in border"
                    :class="currentTheme === 'anime' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-500/[0.05] border-emerald-500/30'"
                  >
                    <div class="flex items-center gap-2.5 font-bold text-base" :class="currentTheme === 'anime' ? 'text-emerald-700' : 'text-emerald-400'">
                      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                      <span>{{ t('detail.terminalDone') }}</span>
                    </div>

                    <!-- 重启 Steam 醒目提示条（仅当部署时 Steam 已在运行中、错过初次加载生效时机时出现） -->
                    <div 
                      v-if="needRestartSteam" 
                      class="rounded-lg p-3.5 border flex items-start gap-3"
                      :class="currentTheme === 'anime' 
                        ? 'bg-amber-50 border-amber-200 text-amber-800 shadow-sm' 
                        : 'bg-amber-400/10 border-amber-400/30 text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.1)]'"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="shrink-0 mt-0.5 text-amber-400">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                      <div class="flex flex-col gap-0.5">
                        <span class="text-xs font-bold">{{ t('detail.restartSteamTitle') || '请退出并重启 Steam 客户端' }}</span>
                        <span class="text-xs opacity-90 leading-relaxed">{{ t('detail.stRestartSteamHint') }}</span>
                      </div>
                    </div>

                    <!-- 新手指南步骤 -->
                    <div class="rounded-lg p-4 border space-y-2.5" :class="currentTheme === 'anime' ? 'bg-white border-emerald-100 shadow-sm' : 'bg-black/40 border-white/[0.04]'">
                      <div class="text-sm font-semibold flex items-center gap-2" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white/90'">
                        <span>💡</span>
                        <span>{{ copyGuide?.title || '快速运行指引' }}</span>
                      </div>
                      <ol class="text-xs space-y-2 pl-5 list-decimal leading-relaxed" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-[#94a3b8]'">
                        <li v-for="(step, idx) in displayGuideSteps" :key="idx">{{ step }}</li>
                      </ol>
                    </div>

                    <button
                      @click="close"
                      class="w-full py-3 font-bold text-sm rounded-lg transition-all"
                      :class="currentTheme === 'anime' 
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-white shadow-md hover:brightness-105' 
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_16px_rgba(16,185,129,0.25)]'"
                    >
                      {{ t('detail.finishClose') }}
                    </button>
                  </div>

                  <!-- 3. 部署拦截与报错状态 (Error - 带重试与诊断复制) -->
                  <div 
                    v-else-if="deployState === 'error'" 
                    class="p-6 rounded-lg flex flex-col gap-4 animate-fade-in border"
                    :class="currentTheme === 'anime' ? 'bg-rose-50 border-rose-200' : 'bg-rose-500/[0.05] border-rose-500/30'"
                  >
                    <div class="flex items-center gap-2.5 font-bold text-base" :class="currentTheme === 'anime' ? 'text-rose-600' : 'text-rose-400'">
                      <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                      <span>{{ t('detail.terminalFailed') }}</span>
                    </div>

                    <div 
                      class="text-sm leading-relaxed p-4 rounded-lg border max-h-[140px] overflow-y-auto custom-scrollbar"
                      :class="currentTheme === 'anime' ? 'bg-white border-rose-200 text-rose-800' : 'bg-black/40 border-rose-500/20 text-rose-200/90'"
                    >
                      {{ lastErrorLog || t('detail.unknownComm') }}
                      <div v-if="lastErrorCode" class="font-mono text-xs mt-1.5" :class="currentTheme === 'anime' ? 'text-rose-600' : 'text-rose-400/60'">CODE: {{ lastErrorCode }}</div>
                    </div>

                    <div class="flex gap-2.5">
                      <button
                        @click="handleDeploy"
                        class="flex-1 py-3 font-bold text-sm rounded-lg transition-all border"
                        :class="currentTheme === 'anime' 
                          ? 'bg-rose-500 text-white hover:bg-rose-600 border-rose-500' 
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/10'"
                      >
                        {{ t('collection.retry') }}
                      </button>
                      <button
                        @click="copyDiagnosticReport"
                        class="px-4 py-3 font-bold text-sm rounded-lg transition-all border"
                        :class="currentTheme === 'anime'
                          ? 'bg-white text-rose-600 hover:bg-rose-50 border-rose-200'
                          : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'"
                        :title="t('detail.copyDiagTitle')"
                      >
                        {{ t('detail.copyDiag') }}
                      </button>
                    </div>
                  </div>

                  <!-- 4. 默认待命状态 (Idle) -->
                  <div v-else class="space-y-4">
                    <div v-if="quotaError" class="p-3.5 rounded-lg text-center" :class="currentTheme === 'anime' ? 'bg-rose-50 border border-rose-200' : 'bg-rose-500/10 border border-rose-500/30'">
                      <span class="text-sm font-bold" :class="currentTheme === 'anime' ? 'text-rose-600' : 'text-rose-400'">{{ quotaError }}</span>
                    </div>

                    <!-- 协议单主按钮 (二次元浅色模式标准渐变 1:1 对标 3.html) -->
                    <div v-if="displayMirrors.length === 0 && !isFetching">
                      <button
                        @click="isProtocol ? handleDeploy() : fetchLinks()"
                        :disabled="isDeployBtnDisabled"
                        class="w-full py-4 disabled:cursor-not-allowed font-black text-base tracking-wide rounded-lg transition-all hover:scale-[1.01] active:scale-[0.99]"
                        :class="[
                          currentTheme === 'anime'
                            ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white shadow-[0_6px_20px_rgba(255,133,179,0.38)] hover:brightness-105 disabled:opacity-40 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-500'
                            : 'bg-[#00f3ff] hover:bg-[#2bf5ff] text-black shadow-[0_0_24px_rgba(0,243,255,0.2)] hover:shadow-[0_0_32px_rgba(0,243,255,0.35)] disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border disabled:border-zinc-700/50'
                        ]"
                      >
                        {{ deployBtnText }}
                      </button>
                      <p v-if="!authStore.isLoggedIn" class="text-xs text-center mt-3" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-zinc-500'">{{ t('detail.needLogin') }}</p>
                    </div>

                    <!-- 载入节点 Spinner -->
                    <div v-else-if="isFetching" class="py-10 flex flex-col items-center justify-center" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-zinc-500'">
                      <div class="w-8 h-8 border-2 rounded-full animate-spin mb-4" :class="currentTheme === 'anime' ? 'border-pink-200 border-t-[#ff85b3]' : 'border-zinc-700 border-t-[#00f3ff]'"></div>
                      <span class="text-sm font-mono">{{ t('detail.fetchingLinks') }}</span>
                    </div>

                    <!-- 节点下载列表 -->
                    <div v-else class="space-y-2.5 max-h-[240px] overflow-y-auto custom-scrollbar pr-1">
                      <div class="text-xs font-bold uppercase tracking-wider mb-2.5" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-[#64748b]'">{{ t('detail.availableNodes') }}</div>
                      <button
                        v-for="m in displayMirrors"
                        :key="m.id || m.url"
                        @click="triggerDownload(m)"
                        :disabled="isProcessingMirror(m.id || m.url)"
                        class="w-full text-left p-3.5 rounded-lg border transition-all flex items-center justify-between"
                        :class="currentTheme === 'anime'
                          ? 'bg-white hover:bg-pink-50/50 border-[#e2d4f0] hover:border-[#bce8ff]'
                          : 'bg-white/[0.02] hover:bg-white/[0.06] border-white/[0.06] hover:border-[#00f3ff]/40'"
                      >
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded flex items-center justify-center text-sm" :class="currentTheme === 'anime' ? 'bg-pink-100 text-[#ff66b2]' : 'bg-black/40 text-[#00f3ff]'">
                            <span v-if="isProcessingMirror(m.id || m.url)" class="animate-spin">⟳</span>
                            <span v-else>{{ m.type === 'cloud_drive' ? '☁' : '↓' }}</span>
                          </div>
                          <div>
                            <div class="text-sm font-bold" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white/90'">{{ m.name || t('detail.mirrorDefaultName') }}</div>
                            <div class="text-xs font-mono" :class="currentTheme === 'anime' ? 'text-[#64748b]' : 'text-zinc-500'">{{ m.type?.toUpperCase() || t('detail.mirrorDirect') }}</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 底部资产规格标签 -->
              <div 
                class="pt-5 border-t text-xs font-mono space-y-1.5 shrink-0 transition-colors"
                :class="currentTheme === 'anime' ? 'border-pink-100 text-[#64748b]' : 'border-white/[0.04] text-[#64748b]'"
              >
                <div class="flex justify-between">
                  <span>{{ t('detail.resourceId') }}</span>
                  <span :class="currentTheme === 'anime' ? 'text-[#1e192b] font-medium' : 'text-white/60'">{{ resource.id }}</span>
                </div>
                <div class="flex justify-between">
                  <span>{{ t('detail.appId') }}</span>
                  <span :class="currentTheme === 'anime' ? 'text-[#1e192b] font-medium' : 'text-white/60'">{{ effectiveAppId }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { tcToast } from '../utils/tcToast'
import { useAuthStore } from '../stores/authStore'
import { useSearchStore } from '../stores/searchStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useTransmissionStore } from '../stores/transmissionStore'
import { t } from '../i18n'
import TitanImage from './TitanImage.vue'
import { useTheme } from '../composables/useTheme'

const { currentTheme } = useTheme()

const props = defineProps<{
  visible: boolean
  gameId: string
  appId?: string
  cover?: string
  title?: string
  tags?: string[]
  rating?: number
  description?: string
  isInstalled?: boolean
  isInLibrary?: boolean
  isDownloading?: boolean
  isInstalling?: boolean
  progress?: number
  statusText?: string
  downloadText?: string
  installPath?: string
  idShort?: string
  type?: string
  stock?: string
  fromSearch?: boolean
  votes?: { up: number; down: number }
  notice?: { text: string; level?: string } | string
}>()

const emit = defineEmits(['close'])

const handleEscKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) {
    if (deployState.value === 'deploying') return // 部署中拦截 ESC
    e.preventDefault()
    close()
  }
}

const handleBackdropClick = () => {
  if (deployState.value === 'deploying') return // 部署中拦截遮罩点击
  close()
}

let unsubProtocolLog: (() => void) | null = null

const authStore = useAuthStore()
const searchStore = useSearchStore()
const libraryStore = useLibraryStore()
const transmissionStore = useTransmissionStore()

const safeGameId = computed(() => props.gameId || '')
const effectiveAppId = computed(() => props.appId || safeGameId.value.replace(/^steam_gate_/, ''))
const isProtocol = computed(() => props.type === 'titan_protocol')
const radarStatus = computed(() => searchStore.checkRadarStatus(effectiveAppId.value))

const isOpen = computed(() => props.visible)
const resource = computed(() => {
  let desc = props.description || ''
  if (safeGameId.value.startsWith('steam_gate_') && !desc) {
    desc = t('detail.steamProtocolDesc', { appId: effectiveAppId.value })
  }
  return {
    id: safeGameId.value,
    type: props.type || 'unknown',
    basic: { title: props.title || t('detail.unnamed'), desc: desc, tags: props.tags || [] },
    meta: { description: desc, target_id: effectiveAppId.value }
  }
})

const coverUrl = computed(() => props.cover || '')

// 动态通知
const displayNotice = computed(() => {
  if (typeof props.notice === 'string' && props.notice.trim()) return props.notice.trim()
  if (props.notice && typeof props.notice === 'object' && props.notice.text) return props.notice.text.trim()
  return ''
})

// 社区投票
const upVotes = ref(props.votes?.up ?? 0)
const downVotes = ref(props.votes?.down ?? 0)
const hasVoted = ref(false)

const checkVotedStatus = () => {
  if (!effectiveAppId.value) return
  hasVoted.value = !!localStorage.getItem(`tc_voted_${effectiveAppId.value}`)
}

const loadVotesFromServer = async () => {
  if (!effectiveAppId.value) return
  checkVotedStatus()
  if (props.votes) {
    upVotes.value = props.votes.up ?? 0
    downVotes.value = props.votes.down ?? 0
  }
  try {
    if (window.electron?.invoke) {
      const res = await window.electron.invoke('sys:get-votes', effectiveAppId.value)
      if (res?.success && res.votes) {
        upVotes.value = res.votes.up ?? 0
        downVotes.value = res.votes.down ?? 0
      }
    }
  } catch {}
}

const castVote = async (type: 'up' | 'down') => {
  if (hasVoted.value || !effectiveAppId.value) return
  if (type === 'up') upVotes.value++
  else downVotes.value++
  hasVoted.value = true
  localStorage.setItem(`tc_voted_${effectiveAppId.value}`, type)

  try {
    if (window.electron?.invoke) {
      const res = await window.electron.invoke('sys:vote-game', { appId: effectiveAppId.value, type })
      if (res?.success && res.data?.votes) {
        upVotes.value = res.data.votes.up ?? upVotes.value
        downVotes.value = res.data.votes.down ?? downVotes.value
      }
    }
  } catch {}
}

// 部署按钮文案与自愈型置灰逻辑
const isDeployBtnDisabled = computed(() => {
  if (!authStore.isLoggedIn) return true
  if (deployState.value === 'deploying') return true
  if (isFetching.value && !isProtocol.value) return true
  if (!!quotaError.value && (safeRemaining.value + safeExtraRemaining.value) < quotaCost.value) return true
  if (props.stock === 'dead' || props.stock === 'miss') return true
  if (props.stock === 'restocking') return true
  return false
})

const deployBtnText = computed(() => {
  if (quotaError.value && (safeRemaining.value + safeExtraRemaining.value) < quotaCost.value) return t('detail.quotaExhausted')
  if (props.stock === 'dead' || props.stock === 'miss') return t('detail.resNotListed')
  if (props.stock === 'restocking') return t('detail.resRestocking')
  return isProtocol.value ? t('detail.deployNow') : t('detail.fetchLink')
})

const localMirrors = ref<any[]>([])
const isFetching = ref(false)
const processingMirrors = ref<Set<string>>(new Set())

// ===== 原位状态机核心 =====
type DeployState = 'idle' | 'deploying' | 'success' | 'error'
const deployState = ref<DeployState>('idle')
const localProgressPercent = ref(0)
const currentStatusText = ref('')
const lastErrorCode = ref('')
const lastErrorLog = ref('')
const rawLogsHistory = ref<Array<{ ts: string; msg: string; type: string }>>([])
const needRestartSteam = ref(false)

const copyGuide = ref<{ title: string; intro: string; steps: string[] } | null>(null)
const FALLBACK_GUIDE_STEPS = [
  '请在 Steam 客户端左侧游戏库中找到本作。',
  '点击绿色「开始游戏」按钮即可直接运行。',
  '若遇到启动无响应，重启一次 Steam 客户端即可自愈。'
]
const displayGuideSteps = computed(() =>
  (Array.isArray(copyGuide.value?.steps) && copyGuide.value!.steps.length > 0) ? copyGuide.value!.steps : FALLBACK_GUIDE_STEPS
)

const quotaError = ref('')
const quotaCost = computed(() => (isProtocol.value ? 1 : 3))

const safeRemaining = computed(() => Math.max(0, authStore.dailyQuota?.remaining ?? 0))
const safeLimit = computed(() => authStore.dailyQuota?.limit ?? 0)
const safeExtraRemaining = computed(() => Math.max(0, authStore.dailyQuota?.extraRemaining ?? 0))
const quotaLoaded = computed(() => !!authStore.dailyQuota?.limit)
const quotaColorClass = computed(() => (safeRemaining.value <= 0 ? 'text-rose-500' : 'text-emerald-400'))

const displayMirrors = computed(() => {
  if (!resource.value) return []
  if (localMirrors.value.length > 0) return localMirrors.value
  return resource.value.meta?.download_mirrors || []
})

const close = () => {
  if (deployState.value === 'deploying') return
  emit('close')
}

// 统一状态清理函数
const resetDeploymentState = () => {
  deployState.value = 'idle'
  localProgressPercent.value = 0
  currentStatusText.value = ''
  lastErrorCode.value = ''
  lastErrorLog.value = ''
  rawLogsHistory.value = []
  needRestartSteam.value = false
  quotaError.value = ''
  processingMirrors.value.clear()
  localMirrors.value = []
  isFetching.value = false
}

// 格式化后端日志为口语人话
function formatProtocolMsg(rawMsg: any): string {
  if (!rawMsg) return ''
  let key = ''
  let params: Record<string, any> = {}

  if (typeof rawMsg === 'object' && rawMsg !== null) {
    key = rawMsg.key || ''
    params = rawMsg.params || {}
  } else if (typeof rawMsg === 'string') {
    const trimmed = rawMsg.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed)
        key = parsed.key || ''
        params = parsed.params || {}
      } catch {
        key = trimmed
      }
    } else if (trimmed.includes(':') && trimmed.startsWith('protocol.STATUS_')) {
      const colonIdx = trimmed.indexOf(':')
      key = trimmed.substring(0, colonIdx)
      const val = trimmed.substring(colonIdx + 1)
      params = { value: val, count: val, appId: val, engine: val, msg: val, node: val }
    } else {
      key = trimmed
    }
  }

  if (key) {
    try {
      const translated = t(key, params)
      if (translated && translated !== key && !translated.startsWith('protocol.STATUS_')) {
        return translated
      }
    } catch {}
  }

  const fallbackMap: Record<string, string | ((p: any) => string)> = {
    'protocol.STATUS_CHECK_ENV': t('detail.stCheckEnv'),
    'protocol.STATUS_ENV_GREEN': t('detail.stEnvGreen'),
    'protocol.STATUS_DOWNLOAD_NODE': (p) => t('detail.stDownloadNode', { node: p.node || t('detail.mainNode') }),
    'protocol.STATUS_EXTRACT_MANIFEST': t('detail.stExtractManifest'),
    'protocol.STATUS_DEPLOY_DONE': t('detail.stDeployDone'),
    'protocol.STATUS_CLEAN_COMPONENTS': (p) => t('detail.stCleanComponents', { count: p.count || p.value || '' }),
    'protocol.STATUS_CLEAN_MANIFEST': (p) => t('detail.stCleanManifest', { count: p.count || p.value || '' }),
    'protocol.STATUS_MIGRATE_LUA': t('detail.stMigrateLua'),
    'protocol.STATUS_UNINSTALL_INIT': t('detail.stUninstallInit'),
    'protocol.STATUS_CLEAN_LUA': t('detail.stCleanLua'),
    'protocol.STATUS_DEPLOY_ENGINE_DONE': (p) => t('detail.stEngineDone', { engine: p.engine || p.value || 'OK' }),
    'protocol.STATUS_HEAL_PATTERN': t('detail.stHealPattern'),
    'protocol.STATUS_RESTART_STEAM_HINT': t('detail.stRestartSteamHint'),
  }

  if (fallbackMap[key]) {
    const handler = fallbackMap[key]
    return typeof handler === 'function' ? handler(params) : handler
  }

  return key || String(rawMsg)
}

function showToast(title: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') {
  tcToast(title, '', icon)
}

function showLoginToast() {
  showToast(t('detail.loginFirst'), 'warning')
}

const isProcessingMirror = (mirrorId: string | undefined): boolean => {
  const id = mirrorId || ''
  return processingMirrors.value.has(id)
}

// 🟢 执行部署（防状态泄漏）
async function handleDeploy() {
  if (!resource.value) return
  if (!authStore.isLoggedIn) return showLoginToast()
  if (deployState.value === 'deploying') return

  const appId = effectiveAppId.value
  if (!appId) {
    deployState.value = 'error'
    lastErrorLog.value = t('detail.appidMissing')
    return
  }

  // 初始化执行态
  deployState.value = 'deploying'
  localProgressPercent.value = 10
  currentStatusText.value = t('detail.syncingRepo')
  lastErrorCode.value = ''
  lastErrorLog.value = ''
  quotaError.value = ''
  rawLogsHistory.value = []

  let rollbackNeeded = false
  if (!props.isInLibrary) {
    try {
      await libraryStore.toggleItem(safeGameId.value, {
        title: props.title || '',
        type: 'titan_protocol',
        cover: props.cover || ''
      })
      rollbackNeeded = true
    } catch {}
  }

  try {
    const res = await window.electron.invoke('titan:deploy-game', appId)

    // 关键拦截：如果此时用户已经不在该弹窗，强行掐断后续状态赋值，杜绝跨游戏污染
    if (!isOpen.value || effectiveAppId.value !== appId) return

    if (res?.success) {
      needRestartSteam.value = !!res?.needRestartSteam
      localProgressPercent.value = 100
      libraryStore.updateItem(safeGameId.value, { installed: true, isDownloading: false })

      // 更新配额
      const dq = (res as any)?.quota
      if (dq && authStore.updateDailyQuota) {
        authStore.updateDailyQuota({
          remaining: dq.remaining ?? 0,
          limit: dq.limit ?? 0,
          used: dq.used ?? 0
        })
      }

      deployState.value = 'success'
      if (needRestartSteam.value) {
        showToast(t('detail.deployDoneRestartSteam') || t('detail.deployDone'), 'info')
      } else {
        showToast(t('detail.deployDone'), 'success')
      }
    } else {
      const err = String(res?.msg || 'ERR_DEPLOY_UNKNOWN')
      const errUpper = err.toUpperCase()
      lastErrorCode.value = errUpper.slice(0, 30)

      if (errUpper.includes('RESOURCE_NOT_FOUND') || errUpper.includes('404')) {
        lastErrorLog.value = t('detail.logNoStock')
      } else if (errUpper.includes('RESTOCKING') || errUpper.includes('503')) {
        lastErrorLog.value = t('detail.logRestocking')
      } else if (errUpper.includes('EBUSY') || errUpper.includes('BUSY') || errUpper.includes('LOCKED')) {
        lastErrorLog.value = t('detail.logFileLocked')
      } else if (errUpper.includes('QUOTA') || errUpper.includes('429')) {
        lastErrorLog.value = t('detail.logQuotaGone')
        const remaining = safeRemaining.value + safeExtraRemaining.value
        quotaError.value = t('detail.quotaShort', { cost: quotaCost.value, remaining })
      } else if (errUpper.includes('TIMEOUT') || errUpper.includes('NETWORK') || errUpper.includes('ETIMEDOUT')) {
        lastErrorLog.value = t('detail.logNetDown')
      } else if (errUpper.includes('401') || errUpper.includes('403') || errUpper.includes('UNAUTHORIZED')) {
        lastErrorLog.value = t('detail.logSessionExpired')
      } else {
        lastErrorLog.value = t('detail.logDeployErr', { err })
      }

      deployState.value = 'error'
      if (rollbackNeeded) {
        try { await libraryStore.removeItem(safeGameId.value) } catch {}
      }
    }
  } catch (e: any) {
    if (!isOpen.value || effectiveAppId.value !== appId) return
    deployState.value = 'error'
    lastErrorCode.value = String((e && e.message) || 'ERR_DEPLOY_UNKNOWN').toUpperCase().slice(0, 30)
    lastErrorLog.value = t('detail.logSysErr', { msg: e.message || t('detail.unknownComm') })
    if (rollbackNeeded) {
      try { await libraryStore.removeItem(safeGameId.value) } catch {}
    }
  }
}

// 复制诊断报告（纯文本结构化，售后秒查）
async function copyDiagnosticReport() {
  const report = [
    `=== ${t('app.diagTitle')} ===`,
    `Time: ${new Date().toLocaleString()}`,
    `AppID: ${effectiveAppId.value}`,
    `ResourceID: ${resource.value.id}`,
    `Error Code: ${lastErrorCode.value || 'N/A'}`,
    `Error Message: ${lastErrorLog.value || 'N/A'}`,
    `Logs Trail:`,
    ...rawLogsHistory.value.map(l => `[${l.ts}] [${l.type}] ${l.msg}`),
    `========================================`
  ].join('\n')

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(report)
      showToast(t('hints.copySuccess'), 'success')
    } else {
      throw new Error('Clipboard API unavailable')
    }
  } catch {
    showToast(t('hints.copyFail'), 'warning')
  }
}

async function fetchLinks() {
  if (!resource.value) return
  if (!authStore.isLoggedIn) return showLoginToast()
  if (isFetching.value) return

  const cached = transmissionStore.getLinkCache(resource.value.id)
  if (cached) {
    localMirrors.value = cached
    return
  }

  isFetching.value = true
  try {
    const result = await window.electron.invoke('sys:fetch-secure-link', resource.value.id)
    if (result?.success) {
      localMirrors.value = result.mirrors?.length > 0 ? result.mirrors : []
      if (result.mirrors?.length > 0) {
        transmissionStore.setLinkCache(resource.value.id, result.mirrors)
      }
      const rawQuota = (result.quota || {}) as any
      if (authStore.updateDailyQuota) {
        authStore.updateDailyQuota({
          remaining: rawQuota.remaining ?? rawQuota.quota_remaining,
          limit: rawQuota.limit ?? rawQuota.quota_limit,
          used: Math.max(0, (rawQuota.limit ?? rawQuota.quota_limit) - (rawQuota.remaining ?? rawQuota.quota_remaining))
        })
      }
    } else {
      showToast(result?.msg ? t(result?.msg) : t('detail.fetchLinkFailed'), 'error')
    }
  } catch (error: any) {
    showToast(error.message || t('app.unknownError'), 'error')
  } finally {
    isFetching.value = false
  }
}

async function triggerDownload(mirror: any) {
  if (!resource.value) return
  if (!authStore.isLoggedIn) return showLoginToast()

  const mirrorId = mirror.id || mirror.url || ''
  if (processingMirrors.value.has(mirrorId)) return

  processingMirrors.value.add(mirrorId)
  try {
    const url = mirror.url || mirror
    if (mirror.type === 'cloud_drive') {
      await window.electron.invoke('sys:open-external', url)
      showToast(t('detail.driveOpened'), 'success')
      close()
      return
    }

    let downloadDir = ''
    try {
      const savedPath = await window.electron.invoke('sys:get-config', 'download_path')
      if (savedPath) downloadDir = savedPath
    } catch {}

    await libraryStore.toggleItem(resource.value.id, {
      title: props.title || '',
      type: props.type || 'game',
      cover: props.cover || '',
      desc: resource.value.basic?.desc || ''
    })

    await transmissionStore.addTask(url, downloadDir, resource.value.id, props.title || '')
    showToast(t('detail.taskQueued', { title: props.title || '' }))
    close()
  } catch (e: any) {
    showToast(e.message || t('app.unknownError'), 'error')
  } finally {
    setTimeout(() => processingMirrors.value.delete(mirrorId), 1000)
  }
}

onMounted(() => {
  loadVotesFromServer()
  window.electron.invoke('sys:get-config', 'copy_guide').then((g: any) => {
    if (g && typeof g === 'object' && g.title) copyGuide.value = g
  }).catch(() => {})
  window.addEventListener('keydown', handleEscKey)

  // 接收原生执行流，原位更新状态
  if (window.electron?.on) {
    unsubProtocolLog = window.electron.on('titan:protocol-log', (data: any) => {
      if (deployState.value === 'deploying') {
        if (data.progress >= 0) localProgressPercent.value = data.progress
        const text = formatProtocolMsg(data.msg)
        currentStatusText.value = text
        rawLogsHistory.value.push({
          ts: new Date().toLocaleTimeString(),
          msg: text,
          type: data.step || 'info'
        })
        if (rawLogsHistory.value.length > 200) {
          rawLogsHistory.value = rawLogsHistory.value.slice(-200)
        }
      }
    })
  }
})

// 🟢 弹窗开关状态同步（无论打开还是关闭，全部重置部署状态，防止状态幽灵残留）
watch(isOpen, (val) => {
  resetDeploymentState()
  if (val) {
    loadVotesFromServer()
  }
})

// 🟢 切换游戏（即使弹窗保持开启，也立刻清空上一款游戏的状态）
watch(effectiveAppId, () => {
  resetDeploymentState()
  loadVotesFromServer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey)
  unsubProtocolLog?.()
})
</script>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; }

.animate-scale-in { animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes scaleIn {
  0% { transform: scale(0.97) translateY(8px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.animate-fade-in { animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes fadeIn {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
</style>