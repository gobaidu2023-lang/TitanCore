<!-- 文件路径: src/components/modals/ShareGameModal.vue -->
<template>
  <Teleport to="body">
    <Transition name="share-modal">
      <div 
        v-if="visible" 
        class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md select-none"
        @click.self="emit('close')"
      >
        <!-- 弹窗主体卡片 (PC 桌面级 3A 视窗 960px，拒绝 WAP 局促小字) -->
        <div 
          class="relative w-full max-w-4xl max-h-[88vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden animate-scale-up"
          :class="currentTheme === 'anime' 
            ? 'bg-gradient-to-b from-white to-[#fff8fb] border-2 border-pink-200/90 shadow-[0_20px_60px_-15px_rgba(255,182,193,0.45)] text-[#1e192b]' 
            : currentTheme === 'minimal'
              ? 'bg-[#0f141d]/95 border border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.12)] text-slate-100'
              : 'bg-[#0e1015] border border-white/10 text-white'"
          style="font-family: 'MiSans', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif;"
        >
          <!-- 顶部标题与关闭控制条 -->
          <div 
            class="px-7 py-5 flex items-center justify-between border-b flex-shrink-0"
            :class="currentTheme === 'anime' 
              ? 'border-pink-100 bg-white/70' 
              : currentTheme === 'minimal'
                ? 'border-white/[0.06] bg-white/[0.02]'
                : 'border-white/5 bg-white/[0.02]'"
          >
            <div class="flex items-center gap-3.5">
              <span class="text-3xl leading-none">🎖️</span>
              <div>
                <div class="flex items-center gap-3 flex-wrap">
                  <h2 
                    class="text-xl md:text-2xl font-black tracking-wide"
                    :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
                  >
                    {{ resolvedTitle }}
                  </h2>
                  <span 
                    class="px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider font-mono select-none flex items-center gap-1.5"
                    :class="currentTheme === 'anime' 
                      ? 'bg-pink-100 text-[#c24b78] border border-pink-200 shadow-sm' 
                      : currentTheme === 'minimal' 
                        ? 'bg-[#00f2ff]/15 text-[#00f2ff] border border-[#00f2ff]/30 shadow-[0_0_12px_rgba(0,242,255,0.15)]' 
                        : 'bg-[#00f3ff]/15 text-[#00f3ff] border border-[#00f3ff]/40 shadow-[0_0_15px_rgba(0,243,255,0.2)]'"
                  >
                    <span>{{ isLotteryMode ? '🎰' : '👑' }}</span>
                    <span>{{ isLotteryMode ? t('shareModal.lotteryBadge') : t('shareModal.badge') }}</span>
                  </span>
                </div>
                <p 
                  class="text-sm mt-1"
                  :class="currentTheme === 'anime' ? 'text-[#7a6b8c]' : 'text-zinc-400'"
                >
                  {{ isLotteryMode ? t('shareModal.lotterySubtitle') : t('shareModal.subtitle') }}
                </p>
              </div>
            </div>
            <button 
              @click="emit('close')" 
              class="w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-xl font-bold"
              :class="currentTheme === 'anime' 
                ? 'text-[#7a6b8c] hover:text-[#c24b78] hover:bg-pink-100/60' 
                : 'text-zinc-400 hover:text-white hover:bg-white/10'"
              :title="t('shareModal.close')"
            >
              ✕
            </button>
          </div>

          <!-- 主体两栏网格区 (左立绘 + 右操作台) -->
          <div class="flex-1 overflow-y-auto custom-scrollbar p-7 flex flex-col md:flex-row gap-7">

            <!-- 左侧：超清 2:3 官方竖版立绘与基本信息 -->
            <div class="w-full md:w-72 flex-shrink-0 flex flex-col gap-4">
              <!-- 2:3 超清官方竖版海报 -->
              <div 
                class="w-full aspect-[2/3] rounded-2xl overflow-hidden relative shadow-xl border"
                :class="currentTheme === 'anime' 
                  ? 'border-pink-200 bg-[#fff5f8]' 
                  : currentTheme === 'minimal'
                    ? 'border-[#00f2ff]/20 bg-black/40'
                    : 'border-white/10 bg-black/40'"
              >
                <img 
                  :src="resolvedCover" 
                  :alt="resolvedTitle" 
                  class="w-full h-full object-cover"
                  onerror="this.src='https://placehold.co/600x900/111827/00f2ff?text=Steam+Cover'"
                />
              </div>

              <!-- 游戏元数据标签 -->
              <div class="space-y-2.5">
                <div 
                  class="flex items-center justify-between font-mono text-sm"
                  :class="currentTheme === 'anime' ? 'text-[#554c66]' : 'text-zinc-400'"
                >
                  <span>{{ t('shareModal.appId') }}</span>
                  <span 
                    class="font-bold tracking-wider"
                    :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
                  >
                    {{ resolvedAppId }}
                  </span>
                </div>
                <div v-if="resolvedTags.length > 0" class="flex flex-wrap gap-1.5 pt-0.5">
                  <span 
                    v-for="tag in resolvedTags" 
                    :key="tag"
                    class="px-2.5 py-1 text-xs font-medium"
                    :class="currentTheme === 'anime' 
                      ? 'rounded-full bg-white border border-pink-200 text-[#7a6b8c] shadow-sm' 
                      : 'rounded bg-white/5 border border-white/10 text-zinc-300'"
                  >
                    {{ tag }}
                  </span>
                </div>
                <!-- 官方简介摘要 -->
                <p 
                  class="text-sm leading-relaxed pt-1 line-clamp-4" 
                  :class="currentTheme === 'anime' ? 'text-[#554c66]' : 'text-zinc-400'"
                  :title="resolvedDesc"
                >
                  {{ resolvedDesc }}
                </p>
              </div>
            </div>

            <!-- 右侧：凭据授权核心工作台 -->
            <div class="flex-1 flex flex-col justify-between gap-5">

              <div class="space-y-4">
                <!-- 1. 顶部：极简单行额度信息卡片 (自适应双轨模式) -->
                <!-- 轮盘号池模式指标卡 (遵循主题配色，清晰展现 4 次轮转与额度) -->
                <div 
                  v-if="isLotteryMode"
                  class="px-5 py-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-3 transition-all"
                  :class="currentTheme === 'anime' 
                    ? 'bg-white/95 border-pink-200/90 shadow-[0_2px_12px_rgba(255,182,193,0.18)] text-[#1e192b]' 
                    : currentTheme === 'minimal'
                      ? 'bg-[#101726]/90 border-[#00f2ff]/25 shadow-[0_0_15px_rgba(0,242,255,0.06)]'
                      : 'bg-white/[0.03] border-white/10'"
                >
                  <div class="flex items-center gap-4 flex-wrap">
                    <!-- 指标 A：单次抽取消耗 -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold" :class="currentTheme === 'anime' ? 'text-[#655877]' : 'text-zinc-400'">
                        {{ t('shareModal.lotteryCostLabel') }}
                      </span>
                      <div class="flex items-baseline gap-1 font-mono">
                        <span 
                          class="text-lg font-black"
                          :class="currentTheme === 'anime' 
                            ? 'text-[#c24b78]' 
                            : currentTheme === 'minimal' 
                              ? 'text-[#00f2ff]' 
                              : 'text-[#00f3ff]'"
                        >
                          {{ lotteryCost }}
                        </span>
                        <span class="text-xs" :class="currentTheme === 'anime' ? 'text-[#8a7a9c]' : 'text-zinc-500'">{{ t('shareModal.lotteryBalanceUnit') }}</span>
                      </div>
                    </div>

                    <!-- 竖向分割细线 -->
                    <div class="w-px h-4" :class="currentTheme === 'anime' ? 'bg-pink-200' : 'bg-white/15'"></div>

                    <!-- 指标 B：我的可用额度 -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold" :class="currentTheme === 'anime' ? 'text-[#655877]' : 'text-zinc-400'">
                        {{ t('shareModal.lotteryMyBalanceLabel') }}
                      </span>
                      <div class="flex items-baseline gap-1 font-mono">
                        <span 
                          class="text-lg font-black"
                          :class="userRemainingQuota >= lotteryCost 
                            ? (currentTheme === 'anime' ? 'text-emerald-600' : 'text-emerald-400') 
                            : 'text-rose-500'"
                        >
                          {{ userRemainingQuota }}
                        </span>
                        <span class="text-xs" :class="currentTheme === 'anime' ? 'text-[#8a7a9c]' : 'text-zinc-500'">{{ t('shareModal.lotteryBalanceUnit') }}</span>
                      </div>
                    </div>

                    <!-- 竖向分割细线 -->
                    <div class="w-px h-4" :class="currentTheme === 'anime' ? 'bg-pink-200' : 'bg-white/15'"></div>

                    <!-- 指标 C：本轮已试手气 (动态次数上限) -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold" :class="currentTheme === 'anime' ? 'text-[#655877]' : 'text-zinc-400'">
                        {{ t('shareModal.lotteryRoundLabel') }}
                      </span>
                      <div class="flex items-baseline gap-0.5 font-mono">
                        <span 
                          class="text-lg font-black"
                          :class="lotteryCdReached 
                            ? 'text-rose-500' 
                            : (currentTheme === 'anime' ? 'text-[#0284c7]' : currentTheme === 'minimal' ? 'text-[#38bdf8]' : 'text-emerald-400')"
                        >
                          {{ lotteryClaimedCount }}
                        </span>
                        <span class="text-xs" :class="currentTheme === 'anime' ? 'text-[#8a7a9c]' : 'text-zinc-500'">
                          {{ t('shareModal.lotteryRoundUnit', { max: lotteryMaxCount }) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- 轮盘号池胶囊状态 -->
                  <div 
                    class="px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 select-none"
                    :class="lotteryCdReached
                      ? (currentTheme === 'anime' 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm' 
                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30')
                      : (currentTheme === 'anime' 
                          ? 'bg-pink-100 text-[#c24b78] border border-pink-200 shadow-sm' 
                          : currentTheme === 'minimal'
                            ? 'bg-[#00f2ff]/15 text-[#00f2ff] border border-[#00f2ff]/30'
                            : 'bg-[#00f3ff]/15 text-[#00f3ff] border border-[#00f3ff]/30')"
                  >
                    <span 
                      class="w-2 h-2 rounded-full"
                      :class="lotteryCdReached 
                        ? 'bg-rose-500' 
                        : (currentTheme === 'anime' ? 'bg-[#c24b78] animate-pulse' : 'bg-[#00f3ff] animate-pulse')"
                    ></span>
                    <span>{{ lotteryCdReached ? t('shareModal.lotteryStatusCd') : t('shareModal.lotteryStatus') }}</span>
                  </div>
                </div>

                <!-- 自购独占模式指标卡 (当前游戏当前剩余 n/5 | 当日可用 n/2) -->
                <div 
                  v-else
                  class="px-5 py-3.5 rounded-xl border flex items-center justify-between flex-wrap gap-3 transition-all"
                  :class="currentTheme === 'anime' 
                    ? 'bg-white/95 border-pink-200/90 shadow-[0_2px_12px_rgba(255,182,193,0.18)]' 
                    : currentTheme === 'minimal'
                      ? 'bg-[#131d2e]/90 border-[#00f2ff]/25 shadow-[0_0_15px_rgba(0,242,255,0.06)]'
                      : 'bg-white/[0.03] border-white/10'"
                >
                  <div class="flex items-center gap-4 flex-wrap">
                    <!-- 指标 A：当前游戏当前剩余 -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold" :class="currentTheme === 'anime' ? 'text-[#655877]' : 'text-zinc-400'">
                        {{ t('shareModal.quotaRemainingLabel') }}
                      </span>
                      <div class="flex items-baseline gap-0.5 font-mono">
                        <span 
                          class="text-lg font-black"
                          :class="currentTheme === 'anime' 
                            ? 'text-[#c24b78]' 
                            : currentTheme === 'minimal' 
                              ? 'text-[#00f2ff]' 
                              : 'text-[#00f3ff]'"
                        >
                          {{ quotaRemaining !== null ? quotaRemaining : '--' }}
                        </span>
                        <span class="text-xs" :class="currentTheme === 'anime' ? 'text-[#8a7a9c]' : 'text-zinc-500'">
                          {{ t('shareModal.quotaSlots') }}
                        </span>
                      </div>
                    </div>

                    <!-- 竖向分割细线 -->
                    <div class="w-px h-4" :class="currentTheme === 'anime' ? 'bg-pink-200' : 'bg-white/15'"></div>

                    <!-- 指标 B：当日可用 -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold" :class="currentTheme === 'anime' ? 'text-[#655877]' : 'text-zinc-400'">
                        {{ t('shareModal.userDailyLabel') }}
                      </span>
                      <div class="flex items-baseline gap-0.5 font-mono">
                        <span 
                          class="text-lg font-black"
                          :class="userRemainingGames > 0 
                            ? (currentTheme === 'anime' ? 'text-[#0284c7]' : currentTheme === 'minimal' ? 'text-[#38bdf8]' : 'text-emerald-400') 
                            : 'text-rose-500'"
                        >
                          {{ userRemainingGames }}
                        </span>
                        <span class="text-xs" :class="currentTheme === 'anime' ? 'text-[#8a7a9c]' : 'text-zinc-500'">
                          {{ t('shareModal.userDailyLimit') }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- 实时状态胶囊 -->
                  <div 
                    class="px-2.5 py-1 text-xs font-bold rounded-full flex items-center gap-1.5 select-none"
                    :class="quotaRemaining !== null && quotaRemaining > 0 
                      ? (currentTheme === 'anime' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' 
                          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30') 
                      : (currentTheme === 'anime' 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' 
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30')"
                  >
                    <span class="w-2 h-2 rounded-full" :class="quotaRemaining !== null && quotaRemaining > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"></span>
                    <span>{{ quotaRemaining !== null && quotaRemaining > 0 ? t('shareModal.statusAvailable') : t('shareModal.statusCooling') }}</span>
                  </div>
                </div>

                <!-- 2. 中间：前置强警示信息卡片 (轮盘模式/独占模式自适应) -->
                <!-- 轮盘盲盒模式强警示卡片 (次时代科技卡片，彻底去除刺眼纯黄) -->
                <div 
                  v-if="isLotteryMode"
                  class="p-4 rounded-xl border flex items-start gap-3.5 shadow-sm transition-all"
                  :class="currentTheme === 'anime' 
                    ? 'bg-[#fff8fa] border border-pink-200/90 shadow-[0_4px_16px_rgba(255,182,193,0.15)] text-[#4a3e56]' 
                    : currentTheme === 'minimal'
                      ? 'bg-[#0c1424]/90 border border-[#00f2ff]/25 shadow-[0_0_20px_rgba(0,242,255,0.06)] text-zinc-300'
                      : 'bg-[#00f3ff]/[0.04] border border-[#00f3ff]/25 shadow-[0_0_20px_rgba(0,243,255,0.06)] text-zinc-200'"
                >
                  <span class="text-2xl leading-none select-none mt-0.5">🎰</span>
                  <div class="space-y-1.5 flex-1">
                    <div 
                      class="font-black tracking-wide text-base flex items-center gap-2 flex-wrap"
                      :class="currentTheme === 'anime' 
                        ? 'text-[#c24b78]' 
                        : currentTheme === 'minimal'
                          ? 'text-[#00f2ff]'
                          : 'text-[#00f3ff]'"
                    >
                      <span>{{ t('shareModal.lotteryNoticeTitle') }}</span>
                      <span 
                        class="text-xs px-2 py-0.5 rounded font-mono"
                        :class="currentTheme === 'anime'
                          ? 'bg-pink-100 text-[#c24b78] border border-pink-200'
                          : currentTheme === 'minimal'
                            ? 'bg-[#00f2ff]/15 text-[#00f2ff] border border-[#00f2ff]/30'
                            : 'bg-[#00f3ff]/15 text-[#00f3ff] border border-[#00f3ff]/40'"
                      >
                        {{ t('shareModal.lotteryNoticeTag', { max: lotteryMaxCount }) }}
                      </span>
                    </div>
                    <div 
                      class="leading-relaxed text-sm font-medium"
                      :class="currentTheme === 'anime' ? 'text-[#6a5b78]' : 'text-zinc-300'"
                    >
                      {{ t('shareModal.lotteryNoticeDesc') }}
                    </div>
                    <div 
                      class="leading-relaxed text-xs font-bold pt-1 border-t"
                      :class="currentTheme === 'anime' 
                        ? 'border-pink-200/70 text-[#b45309]' 
                        : 'border-white/10 text-amber-300/95'"
                    >
                      {{ t('shareModal.lotteryNoticeInstallWarn') }}
                    </div>
                  </div>
                </div>

                <!-- 自购独占模式常规强警示卡片 -->
                <div 
                  v-else
                  class="p-4 rounded-xl border flex items-start gap-3.5 shadow-sm transition-all"
                  :class="currentTheme === 'anime' 
                    ? 'bg-[#fffbeb] border-2 border-[#fcd34d]/90 shadow-[0_4px_16px_rgba(251,191,36,0.15)] text-[#78350f]' 
                    : currentTheme === 'minimal'
                      ? 'bg-amber-500/10 border border-amber-500/30 text-zinc-200'
                      : 'bg-amber-500/10 border border-amber-500/30 text-zinc-200'"
                >
                  <span class="text-2xl leading-none select-none mt-0.5">⚠️</span>
                  <div class="space-y-1 flex-1">
                    <div 
                      class="font-black tracking-wide text-base"
                      :class="currentTheme === 'anime' ? 'text-[#92400e]' : 'text-amber-300'"
                    >
                      {{ t('shareModal.noticeTitle') }}
                    </div>
                    <div 
                      class="leading-relaxed text-sm"
                      :class="currentTheme === 'anime' ? 'text-[#78350f]' : 'text-zinc-200'"
                    >
                      {{ t('shareModal.noticeDesc') }}
                    </div>
                  </div>
                </div>

                <!-- 3. 下方：锁定当前登录账号 -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label 
                      class="text-sm font-bold"
                      :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-zinc-200'"
                    >
                      {{ t('shareModal.targetAccountLabel') }}
                    </label>
                    <button 
                      @click="fetchLocalAccounts" 
                      :disabled="isLoadingAccounts"
                      class="text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      :class="currentTheme === 'anime' 
                        ? 'text-[#7a6b8c] hover:text-[#c24b78]' 
                        : 'text-zinc-400 hover:text-[#00f3ff]'"
                      :title="t('shareModal.refreshAccountTitle')"
                    >
                      <span :class="{ 'animate-spin': isLoadingAccounts }">🔄</span>
                      <span>{{ t('shareModal.refreshAccount') }}</span>
                    </button>
                  </div>

                  <!-- 账号卡片展示 -->
                  <div 
                    class="h-12 rounded-xl px-4 flex items-center justify-between shadow-inner border transition-all"
                    :class="currentTheme === 'anime' 
                      ? 'bg-white/95 border-2 border-pink-200 text-[#1e192b] shadow-sm' 
                      : currentTheme === 'minimal'
                        ? 'bg-[#0a0f18] border-white/15 text-white'
                        : 'bg-zinc-900/90 border-white/15 text-white'"
                  >
                    <div v-if="currentAccount" class="flex items-center gap-2.5 overflow-hidden">
                      <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#4ade80] flex-shrink-0 animate-pulse"></span>
                      <span 
                        class="text-sm font-bold truncate"
                        :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'"
                      >
                        {{ currentAccount.personaName || currentAccount.accountName }}
                      </span>
                      <span 
                        v-if="currentAccount.accountName && currentAccount.accountName !== currentAccount.personaName" 
                        class="text-xs font-mono truncate"
                        :class="currentTheme === 'anime' ? 'text-[#7a6b8c]' : 'text-zinc-400'"
                      >
                        ({{ currentAccount.accountName }})
                      </span>
                    </div>
                    <div 
                      v-else 
                      class="text-sm truncate"
                      :class="currentTheme === 'anime' ? 'text-[#7a6b8c]' : 'text-zinc-400'"
                    >
                      {{ isLoadingAccounts ? t('shareModal.detectingAccount') : t('shareModal.noAccountDetected') }}
                    </div>
                    <span 
                      v-if="currentAccount" 
                      class="text-xs font-bold px-2 py-0.5 rounded-md font-mono flex-shrink-0"
                      :class="currentTheme === 'anime' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'"
                    >
                      {{ t('shareModal.activeBadge') }}
                    </span>
                  </div>

                  <p 
                    class="text-xs"
                    :class="currentTheme === 'anime' ? 'text-[#7a6b8c]' : 'text-zinc-400'"
                  >
                    {{ t('shareModal.accountSwitchHint') }}
                  </p>
                </div>
              </div>

              <!-- 4. 底部主行动区 -->
              <div class="space-y-3 pt-1">
                <!-- 错误回显 -->
                <div v-if="errorMessage" class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm leading-relaxed animate-fade-in flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{{ errorMessage }}</span>
                </div>

                <!-- 授权成功卡片与单按钮 -->
                <div 
                  v-if="isSuccess" 
                  class="p-4 rounded-xl border space-y-3 animate-fade-in"
                  :class="currentTheme === 'anime' 
                    ? 'bg-emerald-50/90 border-2 border-emerald-200 shadow-sm' 
                    : 'bg-emerald-500/10 border border-emerald-500/30'"
                >
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div 
                      class="flex items-center gap-2 font-black text-sm md:text-base"
                      :class="currentTheme === 'anime' ? 'text-emerald-700' : 'text-emerald-400'"
                    >
                      <span class="text-lg">✅</span> {{ t('shareModal.successTitle') }}
                    </div>
                    <div 
                      class="px-3 py-1 rounded-full font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      :class="currentTheme === 'anime' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                        : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'"
                    >
                      <span class="animate-pulse">⏳</span>
                      <span>{{ t('shareModal.expireRemaining') }} {{ ticketExpireStr }}</span>
                    </div>
                  </div>

                  <p 
                    class="text-sm leading-relaxed"
                    :class="currentTheme === 'anime' ? 'text-[#554c66]' : 'text-zinc-300'"
                  >
                    {{ t('shareModal.successDesc') }}
                  </p>

                  <button 
                    @click="handleRestartOrLaunch"
                    :disabled="isLaunching || isSteamLaunching"
                    class="w-full h-12 text-white font-black text-base rounded-xl transition-all shadow-lg flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.98] disabled:opacity-50"
                    :class="currentTheme === 'anime' 
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30' 
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30'"
                  >
                    <span v-if="isLaunching || isSteamLaunching" class="animate-spin text-lg">⟳</span>
                    <span v-else class="text-lg">{{ hasRestartedSteam ? '🚀' : '🔄' }}</span>
                    <span>
                      {{ (isLaunching || isSteamLaunching)
                        ? t('shareModal.launchBtnWorking')
                        : (hasRestartedSteam ? t('shareModal.launchBtn') : t('shareModal.restartSteamBtn'))
                      }}
                    </span>
                  </button>
                </div>

                <!-- 主获取按钮 (统一主题纯粹质感，彻底消除塑料黄色) -->
                <button
                  v-if="!isSuccess"
                  @click="handleAuthorize"
                  :disabled="isAuthorizeDisabled"
                  class="w-full h-12 text-base font-black tracking-wide rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  :class="isAuthorizeDisabled
                    ? (currentTheme === 'anime' 
                        ? 'bg-pink-100 text-[#9584a5] border border-pink-200' 
                        : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50')
                    : (currentTheme === 'anime'
                        ? 'bg-gradient-to-r from-[#ff4d94] to-[#ba43f6] hover:from-[#ff3385] hover:to-[#ad2ceb] text-white shadow-[0_8px_25px_rgba(255,77,148,0.35)]'
                        : currentTheme === 'minimal'
                          ? 'bg-gradient-to-r from-[#00f2ff] to-[#0099ff] hover:brightness-110 text-[#070b12] font-black shadow-[0_0_25px_rgba(0,242,255,0.35)]'
                          : 'bg-[#00f3ff] hover:bg-[#3bf5ff] text-black font-black shadow-[0_0_25px_rgba(0,243,255,0.35)]')"
                >
                  <span v-if="isBusy" class="animate-spin text-lg">⟳</span>
                  <span>
                    {{ actionButtonText }}
                  </span>
                </button>
              </div>

            </div>

          </div>
        </div>

        <!-- 面向 LV0/LV1 用户的真诚自费说明弹窗 (绝无商业套路) -->
        <div 
          v-if="showSponsorModal" 
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          @click.self="showSponsorModal = false"
        >
          <div 
            class="w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 animate-scale-up"
            :class="currentTheme === 'anime' 
              ? 'bg-white border-2 border-pink-200 text-[#1e192b]' 
              : currentTheme === 'minimal' 
                ? 'bg-[#0d1421] border-[#00f2ff]/40 text-white' 
                : 'bg-zinc-900 border-white/15 text-white'"
          >
            <div class="flex items-center gap-3">
              <span class="text-2xl">🎖️</span>
              <h3 
                class="text-base font-black tracking-wide"
                :class="currentTheme === 'anime' ? 'text-[#c24b78]' : 'text-[#00f3ff]'"
              >
                {{ t('shareModal.sponsorModalTitle') }}
              </h3>
            </div>
            <p 
              class="text-sm leading-relaxed"
              :class="currentTheme === 'anime' ? 'text-[#554c66]' : 'text-zinc-300'"
            >
              {{ t('shareModal.sponsorModalP1') }}
            </p>
            <p 
              class="text-xs leading-relaxed"
              :class="currentTheme === 'anime' ? 'text-[#7a6b8c]' : 'text-zinc-400'"
            >
              {{ t('shareModal.sponsorModalP2') }}
            </p>
            <div class="flex justify-end pt-2">
              <button 
                @click="showSponsorModal = false"
                class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                :class="currentTheme === 'anime' 
                  ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm hover:brightness-105' 
                  : 'bg-[#00f3ff] hover:bg-[#3bf5ff] text-black'"
              >
                {{ t('shareModal.gotIt') }}
              </button>
            </div>
          </div>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/authStore'
import { useTheme } from '../../composables/useTheme'
import { useSteamLauncher } from '../../composables/useSteamLauncher'
import { tcToast } from '../../utils/tcToast'
import { t } from '../../i18n'

const props = defineProps<{
  visible: boolean
  item: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { currentTheme } = useTheme()
const authStore = useAuthStore()
const { isSteamLaunching, launchSteamWithGuard } = useSteamLauncher()

// 状态定义
const isBusy = ref(false)
const isSuccess = ref(false)
const isLaunching = ref(false)
const hasRestartedSteam = ref(false)
const errorMessage = ref('')
const showSponsorModal = ref(false)

// 模式与盲盒轮盘状态 (双轨制: exclusive 自购独占 / lottery 平台号池轮盘)
const shareType = ref<'exclusive' | 'lottery'>('exclusive')
const isLotteryMode = computed(() => shareType.value === 'lottery')
const lotteryCost = ref<number>(10)
const lotteryWarningTitle = ref<string>('')
const lotteryWarningDesc = ref<string>('')
const userRemainingQuota = ref<number>(0)

// 轮盘 4 号轮转与 12 小时 CD
const lotteryClaimedCount = ref<number>(0)
const lotteryMaxCount = ref<number>(4)
const lotteryCdReached = ref<boolean>(false)
const lotteryUnlockTime = ref<string>('')
const lotteryRemainingSec = ref<number>(0)

// 30 分钟激活倒计时
const ticketExpireSeconds = ref(1800)
let expireTimer: any = null

const ticketExpireStr = computed(() => {
  const m = Math.floor(ticketExpireSeconds.value / 60)
  const s = ticketExpireSeconds.value % 60
  return t('shareModal.timeFormat', { m, s: s < 10 ? `0${s}` : s })
})

const startExpireCountdown = () => {
  stopExpireCountdown()
  ticketExpireSeconds.value = 1800
  expireTimer = setInterval(() => {
    if (ticketExpireSeconds.value > 0) {
      ticketExpireSeconds.value--
    } else {
      stopExpireCountdown()
    }
  }, 1000)
}

const stopExpireCountdown = () => {
  if (expireTimer) {
    clearInterval(expireTimer)
    expireTimer = null
  }
}

// 配额与额度
const quotaRemaining = ref<number | null>(null)
const quotaLimit = ref<number>(5)
const totalGamesClaimed = ref<number>(0)
const userAlreadyClaimed = ref(false)
const userLimitReached = ref(false)

// 用户今日可用游戏额度 (每日上限 2 款)
const userRemainingGames = computed(() => {
  return Math.max(0, 2 - totalGamesClaimed.value)
})

// 账号精准锁定
const currentAccount = ref<{ steamId64: string; accountName: string; personaName: string } | null>(null)
const isLoadingAccounts = ref(false)
const selectedSteamId = ref<string>('')

// 解析元数据
const resolvedTitle = computed(() => {
  const rawTitle = props.item?.basic?.title || props.item?.title || ''
  if (/[\u4e00-\u9fa5]/.test(rawTitle) && rawTitle.trim()) {
    return rawTitle.trim()
  }
  const desc = props.item?.basic?.desc || props.item?.desc || ''
  const bookMatch = desc.match(/《([^》]+)》/)
  if (bookMatch && bookMatch[1] && bookMatch[1].trim().length >= 2) {
    return bookMatch[1].trim()
  }
  return rawTitle.trim() || t('shareModal.defaultTitle')
})

const resolvedAppId = computed(() => {
  if (!props.item) return ''
  const item = props.item
  let metaObj = item.meta || {}
  if (!item.meta && item.meta_json) {
    try { metaObj = JSON.parse(item.meta_json) } catch {}
  }
  const candidates = [
    item.target_id, item.steam_appid, item.app_id, item.appId,
    item.basic?.app_id, item.basic?.appId,
    metaObj.steam_appid, metaObj.target_id, metaObj.app_id,
    item.id, item.resource_id
  ]
  for (const c of candidates) {
    if (!c) continue
    const s = String(c).replace(/^sharegame_/, '').trim()
    const m = s.match(/(\d{3,10})/)
    if (m) return m[1]
  }
  return ''
})

const resolvedCover = computed(() => {
  const rawCover = props.item?.basic?.cover || props.item?.cover || ''
  if (rawCover && typeof rawCover === 'string' && rawCover.startsWith('http')) {
    return rawCover
      .replace('shared.akamai.steamstatic.com', 'shared.st.dl.eccdnx.com')
      .replace('shared.cloudflare.steamstatic.com', 'shared.st.dl.eccdnx.com')
  }
  if (resolvedAppId.value) {
    return `https://shared.st.dl.eccdnx.com/store_item_assets/steam/apps/${resolvedAppId.value}/library_600x900_2x.jpg`
  }
  return ''
})

const resolvedDesc = computed(() => {
  return props.item?.basic?.desc || props.item?.desc || props.item?.meta?.desc || t('shareModal.defaultDesc')
})

const resolvedTags = computed(() => {
  const tags = props.item?.basic?.tags || props.item?.tags
  if (Array.isArray(tags)) return tags
  if (typeof tags === 'string' && tags.trim()) return tags.split(',').filter(Boolean)
  return [t('shareModal.tagShared'), t('shareModal.tagLegit')]
})

// 主行动按钮状态机文案
const actionButtonText = computed(() => {
  if (isBusy.value) {
    return isLotteryMode.value ? t('shareModal.btnLotteryWorking') : t('shareModal.btnWorking')
  }
  if (!selectedSteamId.value) return t('shareModal.btnNoAccount')

  if (isLotteryMode.value) {
    if (lotteryCdReached.value) {
      return t('shareModal.btnLotteryCd', { max: lotteryMaxCount.value })
    }
    if (userRemainingQuota.value < lotteryCost.value) {
      return t('shareModal.btnLotteryNoQuota')
    }
    return t('shareModal.btnLotteryReady', {
      cost: lotteryCost.value,
      cur: lotteryClaimedCount.value + 1,
      max: lotteryMaxCount.value
    })
  }

  // 自购独占模式
  if (userAlreadyClaimed.value) return t('shareModal.btnClaimed')
  if (userLimitReached.value) return t('shareModal.btnLimitReached')
  if (quotaRemaining.value === 0) return t('shareModal.btnQuotaFull')
  return t('shareModal.btnReady')
})

const isAuthorizeDisabled = computed(() => {
  if (isBusy.value || isLoadingAccounts.value || !selectedSteamId.value || !resolvedAppId.value) {
    return true
  }
  if (isLotteryMode.value) {
    return lotteryCdReached.value || (userRemainingQuota.value < lotteryCost.value)
  }
  return quotaRemaining.value === 0 || userAlreadyClaimed.value || userLimitReached.value
})

// 获取配额与个人额度状态
const fetchQuota = async () => {
  if (!resolvedAppId.value) return
  try {
    if (window.electron?.invoke) {
      const res = await window.electron.invoke('sys:sharegate', {
        action: 'quota',
        app_id: resolvedAppId.value
      })
      if (res?.code === 200 && res.data) {
        shareType.value = res.data.share_type || 'exclusive'
        lotteryCost.value = Number(res.data.cost) || 10
        lotteryWarningTitle.value = res.data.warning_title || ''
        lotteryWarningDesc.value = res.data.warning_desc || ''
        if (res.data.user_quota_remaining !== undefined) {
          userRemainingQuota.value = Number(res.data.user_quota_remaining)
        }
        if (res.data.lottery_claimed_count !== undefined) {
          lotteryClaimedCount.value = Number(res.data.lottery_claimed_count)
        }
        if (res.data.lottery_max_count !== undefined) {
          lotteryMaxCount.value = Number(res.data.lottery_max_count)
        }
        lotteryCdReached.value = !!res.data.lottery_cd_reached
        lotteryUnlockTime.value = res.data.lottery_unlock_time || ''
        lotteryRemainingSec.value = Number(res.data.lottery_remaining_seconds) || 0

        quotaRemaining.value = res.data.remaining ?? 5
        quotaLimit.value = res.data.limit ?? 5
        totalGamesClaimed.value = res.data.total_games_claimed ?? 0
        userAlreadyClaimed.value = !!res.data.user_already_claimed
        userLimitReached.value = !!res.data.user_daily_game_limit_reached
      }
    }
  } catch (e: any) {
    console.warn('[ShareGameModal] 获取配额失败:', e)
  }
}

// 精准锁定本地 Steam 当前登录账号
const fetchLocalAccounts = async () => {
  isLoadingAccounts.value = true
  try {
    if (window.electron?.invoke) {
      const res = await window.electron.invoke('sys:sharegate', { action: 'local-accounts' })
      if (res?.code === 200 && res.data) {
        if (res.data.current?.steamId64) {
          currentAccount.value = res.data.current
          selectedSteamId.value = res.data.current.steamId64
          return
        }
        if (Array.isArray(res.data.accounts) && res.data.accounts.length > 0) {
          const target = res.data.accounts.find((a: any) => a.mostRecent) || res.data.accounts[0]
          currentAccount.value = target
          selectedSteamId.value = target.steamId64
          return
        }
      }

      const engRes = await window.electron.invoke('engine:scan-detailed-accounts')
      if (engRes?.success && Array.isArray(engRes.accounts) && engRes.accounts.length > 0) {
        const target = engRes.accounts.find((a: any) => a.mostRecent) || engRes.accounts[0]
        currentAccount.value = {
          steamId64: String(target.steamId64 || ''),
          accountName: target.accountName || '',
          personaName: target.personaName || ''
        }
        selectedSteamId.value = currentAccount.value.steamId64
      }
    }
  } catch (e: any) {
    console.warn('[ShareGameModal] 精准检测当前 Steam 账号失败:', e)
  } finally {
    isLoadingAccounts.value = false
  }
}

// 执行凭据获取与写入
const handleAuthorize = async () => {
  if (!resolvedAppId.value) return

  if (!authStore.isLoggedIn) {
    tcToast.warn(t('shareModal.toastLoginFirst'))
    window.dispatchEvent(new CustomEvent('titan:open-login'))
    return
  }

  const userLevel = authStore.user?.vipLevel ?? 0
  // 铁律：共享游戏全域功能（包括自购独占与号池轮盘）仅面向 LV2 核心赞助指挥官开放，不向 LV1 开放
  if (userLevel < 2) {
    showSponsorModal.value = true
    return
  }

  // 轮盘盲盒模式校验额度充足 (LV2 每日消耗 10 下载额度)
  if (isLotteryMode.value && userRemainingQuota.value < lotteryCost.value) {
    tcToast.warn(t('shareModal.btnLotteryNoQuota'))
    return
  }

  if (!selectedSteamId.value) {
    errorMessage.value = t('shareModal.noAccountDetected')
    return
  }

  isBusy.value = true
  isSuccess.value = false
  hasRestartedSteam.value = false
  errorMessage.value = ''

  try {
    if (window.electron?.invoke) {
      const res = await window.electron.invoke('sys:sharegate', {
        action: 'authorize',
        app_id: resolvedAppId.value,
        target_steamid64: selectedSteamId.value
      })

      if (res?.code === 200) {
        isSuccess.value = true
        hasRestartedSteam.value = false
        startExpireCountdown()
        tcToast.success(t('shareModal.toastAuthSuccess'))
        if (res.data?.quota_remaining !== undefined) {
          userRemainingQuota.value = Number(res.data.quota_remaining)
        }
        await fetchQuota()
      } else {
        errorMessage.value = res?.msg || t('shareModal.toastAuthFailedDefault')
      }
    }
  } catch (e: any) {
    errorMessage.value = e?.message || t('shareModal.toastNetworkTimeout')
  } finally {
    isBusy.value = false
  }
}

// 两步接力行动器：
// 第一步：100% 复用 App.vue 顶栏的 launchSteamWithGuard() 纯净注入重启 Steam，杜绝 steam://run/ 抢占导致纯净模式失效；
// 第二步：重启完成后按钮原地变为“启动游戏(快去steam启动)”，无论玩家去 Steam 手动点还是点此按钮均可。
const handleRestartOrLaunch = async () => {
  if (isLaunching.value || isSteamLaunching.value || !resolvedAppId.value) return

  // 第一步：尚未重启 Steam -> 执行与顶栏完全同源的纯净重启
  if (!hasRestartedSteam.value) {
    isLaunching.value = true
    try {
      const res = await launchSteamWithGuard({
        onError: (err) => {
          console.error('[ShareGameModal] Steam Restart Failed:', err)
        }
      })
      if (res?.success) {
        hasRestartedSteam.value = true
      }
    } catch (err) {
      console.error('[ShareGameModal] 重启 Steam 异常:', err)
    } finally {
      isLaunching.value = false
    }
    return
  }

  // 第二步：已重启完成 -> 唤起游戏
  isLaunching.value = true
  try {
    if ((window as any).electron?.sys?.launchGame) {
      await (window as any).electron.sys.launchGame(resolvedAppId.value)
    } else if (window.electron?.invoke) {
      await window.electron.invoke('titan:launch-game', resolvedAppId.value)
    }
    tcToast.success(t('shareModal.toastLaunchSuccess'))
  } catch (err: any) {
    console.warn('[ShareGameModal] 唤起游戏异常:', err)
  } finally {
    isLaunching.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    isSuccess.value = false
    hasRestartedSteam.value = false
    errorMessage.value = ''
    fetchQuota()
    fetchLocalAccounts()
  } else {
    stopExpireCountdown()
  }
}, { immediate: true })

watch(() => props.item, () => {
  if (props.visible) {
    isSuccess.value = false
    hasRestartedSteam.value = false
    errorMessage.value = ''
    fetchQuota()
  }
})

// ESC 键关闭弹窗（若二级说明弹窗开启则优先关闭二级弹窗）
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible) {
    if (showSponsorModal.value) {
      showSponsorModal.value = false
    } else {
      emit('close')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopExpireCountdown()
})
</script>

<style scoped>
.share-modal-enter-active, .share-modal-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.share-modal-enter-from, .share-modal-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.animate-scale-up {
  animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes scaleUp {
  0% { transform: scale(0.96) translateY(6px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(180, 160, 190, 0.25); border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(180, 160, 190, 0.45); }
</style>
