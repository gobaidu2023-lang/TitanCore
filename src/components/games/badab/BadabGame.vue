<template>
  <div
    :class="[
      'overflow-hidden select-none font-badab-pc bg-[#05060a]',
      isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : 'relative w-full h-full'
    ]"
  >
    <!-- 0. 宇宙星空背景：世界层，与 Pixi 画布共享同一摄像机矩阵（缩放/平移焊死同步） -->
    <video
      ref="videoRef"
      :src="videoSrc"
      autoplay
      loop
      muted
      playsinline
      class="absolute object-cover pointer-events-none"
      :style="worldVideoStyle"
    />

    <!-- 宇宙背景全局暗角与微噪点膜 -->
    <div class="absolute inset-0 bg-black/25 pointer-events-none" />

    <!-- 1. 黑玻璃战术操作台（大世界居中战术台，由摄像机统御映射） -->
    <div
      v-if="cameraTransform"
      class="absolute pointer-events-none rounded-2xl overflow-hidden border border-[#00f0ff]/30 shadow-2xl backdrop-blur-md bg-black/65 transition-[border-color] duration-200"
      :style="{
        left: `${cameraTransform.x}px`,
        top: `${cameraTransform.y}px`,
        width: `${cameraTransform.width}px`,
        height: `${cameraTransform.height}px`,
        boxShadow: '0 0 60px rgba(0, 0, 0, 0.85), inset 0 0 40px rgba(0, 240, 255, 0.04)'
      }"
    >
      <div class="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#00f0ff]/60" />
      <div class="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#00f0ff]/60" />
      <div class="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#00f0ff]/60" />
      <div class="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#00f0ff]/60" />

      <div
        class="absolute left-0 right-0 top-0 bg-gradient-to-b from-white/[0.04] to-transparent border-b border-[#00f0ff]/20"
        :style="{ height: `${192 * cameraTransform.scale}px` }"
      />

      <div class="absolute bottom-3 right-6 flex items-center gap-2 text-sm tracking-widest text-white/30 font-mono select-none">
        <span>OUTPOST OPERATIONS GRID // 前哨作业码牌区</span>
        <span class="text-[#00f0ff]/60 font-bold">[{{ Math.round(cameraTransform.zoom * 100) }}%]</span>
      </div>
    </div>

    <!-- 2. PixiJS 交互画布 -->
    <div ref="pixiContainer" class="absolute inset-0 w-full h-full" />

    <!-- 年末向导暗幕：售卡阶段（⑤）不显示暗幕与模糊；税阶段献赋窗自带背景 -->
    <div
      v-if="(settlementReport && (settlementPhase === 'tax' || settlementPhase === 'clearance' || settlementPhase === 'confirm')) || victoryRoute || (store.showDoubleTaxPrompt && settlementPhase !== 'tax')"
      class="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-10 pointer-events-none transition-all duration-500"
    />

    <!-- 顶栏右侧 HUD：提层至 z-[60]，NPC对话框存活时仍可全屏/音乐/退出 -->
    <div class="absolute top-0 right-0 p-3 flex items-center gap-3 z-[60] pointer-events-none">
      <div class="flex items-center gap-4 bg-black/75 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 text-sm font-bold shadow-2xl">
        <div class="flex items-center gap-2">
          <span class="text-zinc-400">星际年</span>
          <span class="text-[#00f0ff] font-mono text-base">{{ store.month }}</span>
          <div class="w-16 h-1.5 bg-white/10 rounded overflow-hidden">
            <div class="h-full bg-[#00f0ff]/80 transition-all duration-300" :style="{ width: `${store.monthProgress * 100}%` }" />
          </div>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-zinc-400">金币</span>
          <span class="text-yellow-300 font-mono text-base font-black">{{ store.gold }}</span>
          <span class="text-yellow-500">🪙</span>
        </div>

        <div>
          <span class="text-zinc-400">饱食 </span>
          <span class="font-mono text-base" :class="store.foodHave >= store.foodNeed ? 'text-green-400' : 'text-red-400'">
            {{ store.foodHave }}/{{ store.foodNeed }}
          </span>
        </div>

        <div>
          <span class="text-zinc-400">卡槽 </span>
          <span
            class="font-mono text-base transition-all"
            :class="store.slotsUsed > store.slotsCap ? 'text-red-400 font-black animate-pulse' : 'text-zinc-200'"
          >
            {{ store.slotsUsed }}/{{ store.slotsCap }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-zinc-400">腐化</span>
          <div class="w-20 h-2 bg-white/10 rounded overflow-hidden border border-purple-500/30">
            <div class="h-full bg-gradient-to-r from-purple-600 to-fuchsia-500" :style="{ width: `${store.corruption}%` }" />
          </div>
          <span class="text-purple-300 font-mono text-base">{{ store.corruption }}/100</span>
        </div>

        <!-- batch18：顶栏税倒计时删除——税信息收口到操作台税卡（单卡固定矩形两态大字版，位置 100% 对齐） -->
      </div>

      <button
        @click.stop="togglePause"
        class="pointer-events-auto px-4 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-lg"
        :class="store.paused
          ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-300 animate-pulse'
          : 'bg-black/75 backdrop-blur-md border-white/15 text-zinc-300 hover:bg-white/10'"
      >
        {{ store.paused ? '▶ 继续 (P)' : '⏸ 暂停 (P)' }}
      </button>

      <div class="flex items-center gap-2 pointer-events-auto">
        <button
          @click.stop="toggleBgm"
          class="p-2.5 bg-black/75 backdrop-blur-md hover:bg-white/15 border border-white/15 rounded-xl text-zinc-300 hover:text-[#00f0ff] transition-all"
          :title="isMuted ? '开启音乐 (M)' : '静音音乐 (M)'"
        >
          <span class="text-sm">{{ isMuted ? '🔇' : '🔊' }}</span>
        </button>

        <button
          @click.stop="toggleFullscreen"
          class="p-2.5 bg-black/75 backdrop-blur-md hover:bg-white/15 border border-white/15 rounded-xl text-zinc-300 hover:text-[#00f0ff] transition-all"
          :title="isFullscreen ? '窗口化 (F11)' : '全屏 (F11)'"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <button
          @click.stop="exitToLobby"
          class="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-xl text-red-400 text-sm font-bold transition-all"
          title="退出到大厅 (ESC)"
        >
          退出
        </button>
      </div>
    </div>

    <!-- 年终结算向导（④：开饭 -> 税收 -> 售卡 -> 开启新星际年） -->
    <transition name="pop-down">
      <div
        v-if="settlementReport && settlementPhase && settlementPhase !== 'sell' && !(settlementPhase === 'tax' && store.showDoubleTaxPrompt)"
        class="absolute top-24 left-1/2 -translate-x-1/2 z-30 w-[560px] bg-zinc-950/90 border border-white/20 rounded-2xl p-5 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center pointer-events-auto"
      >
        <div class="text-[#00f0ff] font-black text-base tracking-widest mb-1">
          周期结算 · 第 {{ settlementReport.month }} 星际年末
        </div>

        <!-- 阶段①：开饭 -->
        <template v-if="settlementPhase === 'feeding'">
          <div class="text-zinc-400 text-sm mb-4">帝国前哨站年度供给仪式</div>
          <div class="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-sm space-y-2 text-left">
            <div class="flex items-center justify-between">
              <span class="text-zinc-400">全体人口年需口粮</span>
              <span class="text-zinc-200 font-mono">{{ settlementReport.foodNeed }} 饱食</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-zinc-400">仓储可供饱食</span>
              <span class="font-mono" :class="settlementReport.foodHave >= settlementReport.foodNeed ? 'text-green-400' : 'text-red-400'">
                {{ settlementReport.foodHave }} 饱食
              </span>
            </div>
            <div class="text-zinc-500 text-sm pt-1 border-t border-white/10">
              优先级高者先吃；食物耗尽后，未吃到的人口将饥饿牺牲。
            </div>
          </div>
          <button
            @click.stop="startFeeding"
            :disabled="feedingStarted"
            class="w-full py-2.5 rounded-xl font-bold text-sm tracking-wider transition-all shadow-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 hover:scale-[1.02] active:scale-95"
            :class="feedingStarted ? 'opacity-60 animate-pulse' : ''"
          >
            {{ feedingStarted ? '🍖 进食中，请稍候…' : '🍖 开饭！（按优先级投喂）' }}
          </button>
        </template>

        <!-- 阶段②：税收知悉（未缴纳情形） -->
        <template v-else-if="settlementPhase === 'tax' && engineTaxNoticePending">
          <div class="w-full mt-2 mb-3 p-3 rounded-xl border bg-red-950/30 border-red-500/50 text-red-300 text-sm text-left">
            <div class="font-bold mb-1">⚡ 第 {{ settlementReport.taxReport?.taxCycle }} 届什一税年度审计</div>
            <div class="text-red-300">
              未交足税款已判定抗税叛离！前哨站腐化值大幅上升 <span class="font-black">+{{ (settlementReport.taxReport?.missCount || 1) * 10 }} 点</span>（按抗税次数递增，成功完税清零），税单作废，征税军舰已离境。
            </div>
          </div>
          <button
            @click.stop="acknowledgeTaxNotice"
            class="w-full py-2.5 rounded-xl font-bold text-sm tracking-wider transition-all shadow-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/60 hover:scale-[1.02] active:scale-95"
          >
            我已知悉（进入清理阶段）
          </button>
        </template>

        <!-- 阶段③：库存清理知悉（超容才出现，点击"我已知悉"进入实际卖卡阶段） -->
        <template v-else-if="settlementPhase === 'clearance'">
          <div class="text-zinc-400 text-sm mb-4">年末仓储盘点</div>
          <div class="w-full mb-3 p-3 rounded-xl border bg-amber-950/30 border-amber-500/50 text-amber-200 text-sm text-left">
            <div class="font-bold mb-1">⚠️ 库存超上限（{{ store.slotsUsed }} / {{ store.slotsCap }}）</div>
            <div class="text-zinc-300 leading-relaxed">
              指挥官请清理库存：将多余卡牌拖至顶部【出售槽】变卖换金，或拖入配方/仓库消化。清理达标后"开启新星际年"按钮将出现。
            </div>
          </div>
          <button
            @click.stop="acknowledgeClearance"
            class="w-full py-2.5 rounded-xl font-bold text-sm tracking-wider transition-all shadow-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/60 hover:scale-[1.02] active:scale-95"
          >
            我已知悉，开始清理
          </button>
        </template>

        <!-- 阶段④：确认翻年 -->
        <template v-else-if="settlementPhase === 'confirm'">
          <div class="text-zinc-400 text-sm mb-4">年度生死与仓储盘点完毕</div>
          <div class="w-full bg-black/50 border border-white/10 rounded-xl p-3 mb-3 text-sm space-y-2 text-left">
            <div class="flex items-center justify-between">
              <span class="text-zinc-400">口粮消耗</span>
              <span class="text-zinc-200 font-mono">{{ settlementReport.foodConsumed }} / {{ settlementReport.foodNeed }} 饱食</span>
            </div>
            <div v-if="settlementReport.starvedCount > 0" class="flex items-center justify-between text-red-400 font-bold">
              <span>饥饿牺牲</span>
              <span>{{ settlementReport.starvedCount }} 名人口 (已转为尸体)</span>
            </div>
            <div v-else class="flex items-center justify-between text-green-400">
              <span>口粮补给</span>
              <span>全员饱腹，无人员伤亡</span>
            </div>
            <div v-if="settlementReport.taxReport" class="pt-1 border-t border-white/10 text-amber-200">
              ⚡ 什一税审计：{{ settlementReport.taxReport.isFulfilled ? '已足额备齐（腐化 0 变化）' : '违期抗税（腐化 +' + (settlementReport.taxReport.taxCycle || 1) * 10 + '）' }}
            </div>
          </div>

          <div
            class="w-full rounded-xl p-3 mb-4 text-sm flex flex-col items-center"
            :class="isSlotOver ? 'bg-red-500/15 border border-red-500/40 text-red-300' : 'bg-green-500/10 border border-green-500/30 text-green-300'"
          >
            <div class="flex items-center justify-between w-full font-bold mb-1">
              <span>仓储占用</span>
              <span class="font-mono text-sm">{{ store.slotsUsed }} / {{ store.slotsCap }}</span>
            </div>
            <div v-if="isSlotOver" class="text-sm text-red-400 font-bold animate-pulse">
              ⚠️ 超载 {{ store.slotsUsed - store.slotsCap }} 张，回到上一步出售
            </div>
            <div v-else class="text-sm text-green-400">✓ 仓储规模达标，前哨站运转良好</div>
          </div>

          <button
            @click.stop="confirmNextMonth"
            class="w-full py-2.5 rounded-xl font-bold text-sm tracking-wider transition-all shadow-lg bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 text-[#00f0ff] border border-[#00f0ff]/60 hover:scale-[1.02] active:scale-95 animate-pulse"
          >
            开启第 {{ settlementReport.month + 1 }} 星际年 (空格 / 点击)
          </button>
        </template>
      </div>
    </transition>

    <!-- 阶段③售卡：无任何面板（UI 已隐藏、无模糊），玩家自由清理后在确认阶段回归 -->

    <!-- 年末完税：忠诚双倍狂热献赋确认窗 -->
    <transition name="pop-down">
      <div
        v-if="store.showDoubleTaxPrompt && settlementPhase === 'tax'"
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-[680px] bg-zinc-950/95 border-2 border-amber-500/80 rounded-2xl p-8 shadow-2xl backdrop-blur-2xl flex flex-col items-center pointer-events-auto"
      >
        <div class="text-amber-400 font-black text-2xl tracking-widest mb-2 flex items-center gap-2">
          <span>⚡</span>
          <span>帝国什一税足额纳贡完成</span>
          <span>⚡</span>
        </div>
        <div class="text-zinc-400 text-sm mb-3 font-mono">特使军舰启航前夕 · 帝国国教神圣嘉奖询问</div>

        <div class="w-full bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 mb-4 text-sm leading-relaxed text-zinc-300">
          <p class="mb-2 text-amber-200 font-bold">
            “【前哨站总督亲启】你部已全额备齐本届什一税（腐化值不增不减）。在特使离开前，你部是否自愿加倍纳贡以证明绝对纯洁与狂热忠诚？”
          </p>
          <div class="text-cyan-300 font-bold">
            ★ 双倍献赋收益：前哨站腐化值直接清减 -15 点！
          </div>
        </div>

        <div v-if="doubleTaxActionMsg" class="w-full text-center text-sm font-bold text-red-400 mb-3 animate-pulse">
          {{ doubleTaxActionMsg }}
        </div>

        <div v-if="isPopSelecting" class="w-full bg-black/60 border border-white/10 rounded-xl p-3 mb-4 text-sm">
          <div class="flex items-center justify-between mb-2 pb-1 border-b border-white/10">
            <span class="text-zinc-200 font-bold">自选献给帝国的 3 名成年单位殉道：</span>
            <span class="font-mono text-cyan-300 font-bold">已选 {{ selectedPopUids.length }} / 3</span>
          </div>

          <div class="max-h-48 overflow-y-auto space-y-1 pr-1 badab-sidebar-scroll">
            <div
              v-for="unit in livingAdultUnits"
              :key="unit.uid"
              @click.stop="toggleSelectUnit(unit.uid)"
              class="flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border"
              :class="selectedPopUids.includes(unit.uid) ? 'bg-amber-500/20 border-amber-500/60 text-amber-300' : 'bg-white/5 border-white/5 text-zinc-300 hover:bg-white/10'"
            >
              <div class="flex items-center gap-2">
                <input type="checkbox" :checked="selectedPopUids.includes(unit.uid)" class="pointer-events-none" />
                <span class="font-bold">{{ getDef(unit.cardId).name }}</span>
                <span v-if="unit.trait && unit.trait !== 'none'" class="text-sm text-cyan-400">[{{ unit.trait }}]</span>
              </div>
              <span class="font-mono text-sm text-zinc-400">HP {{ unit.hp }}/{{ unit.maxHp }}</span>
            </div>
          </div>

          <div class="flex gap-2 mt-3 pt-2 border-t border-white/10">
            <button
              @click.stop="submitDoubleTaxPopulation"
              :disabled="selectedPopUids.length !== 3"
              class="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
              :class="selectedPopUids.length === 3 ? 'bg-amber-500/30 text-amber-300 border border-amber-500/60 hover:scale-[1.01]' : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed'"
            >
              确认指派 3 人献贡 (-15 腐化)
            </button>
            <button
              @click.stop="isPopSelecting = false"
              class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg text-zinc-300 text-sm font-bold transition-all"
            >
              返回
            </button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-2.5 w-full">
          <button
            @click.stop="onStartDoubleTax"
            class="w-full py-2.5 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/60 rounded-xl text-[#00f0ff] font-bold text-sm tracking-wider transition-all hover:scale-[1.01] flex items-center justify-between px-4"
          >
            <span>【狂热献赋】双倍加纳 {{ getDoubleTaxDesc() }}</span>
            <span class="text-cyan-300 font-mono">-15 腐化 ★</span>
          </button>

          <button
            @click.stop="onCancelDoubleTax"
            class="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-zinc-300 font-bold text-sm tracking-wider transition-all hover:scale-[1.01] flex items-center justify-between px-4"
          >
            <span>【恪尽职守】遵旨完税，特使离境</span>
            <span class="text-zinc-400 font-mono">0 腐化</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 双线胜利结算浮窗 -->
    <transition name="pop-down">
      <div
        v-if="victoryRoute"
        class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] bg-zinc-950/95 border-2 border-[#00f0ff]/80 rounded-2xl p-6 shadow-2xl backdrop-blur-2xl flex flex-col items-center text-center pointer-events-auto shadow-cyan-950/50"
      >
        <div class="text-[#00f0ff] font-black text-xl tracking-widest mb-2 animate-pulse">
          {{ victoryRoute === 'justice' ? '★ 正义线通关胜利 ★' : '★ 腐化线通关胜利 ★' }}
        </div>
        <div class="text-zinc-200 text-sm font-bold leading-relaxed mb-6 bg-black/40 border border-white/10 p-3 rounded-xl">
          {{ victoryText }}
        </div>

        <div class="w-full grid grid-cols-2 gap-3 mb-4 text-sm bg-cyan-950/20 border border-cyan-500/20 rounded-xl p-3">
          <div class="text-left text-zinc-400">存活星际年：<span class="text-cyan-300 font-mono font-bold">{{ store.month }} 年</span></div>
          <div class="text-left text-zinc-400">最终腐化值：<span class="text-purple-300 font-mono font-bold">{{ store.corruption }}/100</span></div>
        </div>

        <!-- 巴达布通关天卡特权激励反馈卡片 -->
        <div 
          v-if="rewardClaimStatus !== 'idle'" 
          class="w-full mb-6 p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all"
          :class="rewardClaimStatus === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
            : (rewardClaimStatus === 'already_claimed'
              ? 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
              : (rewardClaimStatus === 'loading'
                ? 'bg-zinc-900 border-zinc-700 text-zinc-300'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-300'))"
        >
          <div class="text-xs font-bold tracking-wider flex items-center gap-2">
            <span v-if="rewardClaimStatus === 'loading'" class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span>{{ rewardClaimMsg }}</span>
          </div>
          <div v-if="rewardExpireDate" class="text-[11px] font-mono text-zinc-400">
            特权已顺延至：<span class="text-emerald-400 font-bold">{{ rewardExpireDate }}</span>
          </div>
        </div>

        <div class="flex gap-4 w-full">
          <button
            @click.stop="restart"
            class="flex-1 py-3 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/60 rounded-xl text-[#00f0ff] font-bold text-sm tracking-wider transition-all hover:scale-105"
          >
            重新部署
          </button>
          <button
            @click.stop="exitToLobby"
            class="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-zinc-200 font-bold text-sm tracking-wider transition-all hover:scale-105"
          >
            返回大厅
          </button>
        </div>
        <!-- batch19：通关媒体入口（通关时引擎已暂停；ESC/关闭退出覆盖层） -->
        <div class="flex flex-col gap-2.5 w-full mt-1">
          <!-- batch57：正义线有 CG，歌词按钮裁减；反叛线保留 -->
          <button
            v-if="victoryRoute === 'corruption'"
            @click.stop="playVictoryBgm(victoryRoute)"
            class="w-full py-2.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 rounded-xl text-purple-300 font-bold text-sm tracking-wider transition-all hover:scale-[1.01]"
          >
            ♪ 播放通关 BGM（歌词）
          </button>
          <!-- batch57：反叛线 CG 未制作，按钮裁减；正义线保留 -->
          <button
            v-if="victoryRoute === 'justice'"
            @click.stop="playVictoryCg(victoryRoute)"
            class="w-full py-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 rounded-xl text-cyan-300 font-bold text-sm tracking-wider transition-all hover:scale-[1.01]"
          >
            ▶ 播放通关 CG
          </button>
        </div>
      </div>
    </transition>

    <!-- 左上角侧边栏按钮 -->
    <button
      @click.stop="isSidebarOpen = !isSidebarOpen"
      class="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-3.5 py-2 bg-black/85 hover:bg-black border border-white/20 rounded-xl text-zinc-100 text-sm font-bold backdrop-blur-md transition-all shadow-2xl hover:scale-105 pointer-events-auto"
    >
      <span>{{ isSidebarOpen ? '◀ 收起百科' : '▶ 打开百科' }}</span>
      <span v-if="hasNewUnlock && !isSidebarOpen" class="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
    </button>

    <!-- 百科与任务侧边栏 -->
    <transition name="slide-sidebar">
      <div
        v-if="isSidebarOpen"
        class="absolute top-14 left-3 z-20 w-88 md:w-96 bottom-80 bg-zinc-950/95 border border-white/10 rounded-2xl flex flex-col p-4 backdrop-blur-xl shadow-2xl overflow-hidden pointer-events-auto"
      >
        <div class="flex border-b border-white/10 pb-2 mb-3 gap-2 flex-shrink-0">
          <button
            @click.stop="activeTab = 'ideas'"
            class="flex-1 py-1.5 rounded-lg text-sm font-bold transition-all"
            :class="activeTab === 'ideas' ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40' : 'text-zinc-400 hover:text-white'"
          >
            主意百科
          </button>
          <button
            @click.stop="activeTab = 'tasks'"
            class="flex-1 py-1.5 rounded-lg text-sm font-bold transition-all"
            :class="activeTab === 'tasks' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'text-zinc-400 hover:text-white'"
          >
            任务指引
          </button>
        </div>

        <div v-if="activeTab === 'ideas'" class="flex-1 flex flex-col min-h-0 overflow-hidden">
          <input
            v-model="searchQuery"
            placeholder="搜索配方或材料..."
            class="w-full flex-shrink-0 bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00f0ff]/60 mb-3"
          />

          <div class="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 text-sm badab-sidebar-scroll">
            <div v-for="(recipes, group) in filteredGroups" :key="group" class="border border-white/5 rounded-lg overflow-hidden">
              <button
                @click.stop="toggleGroup(group)"
                class="w-full flex items-center justify-between p-2 bg-white/5 hover:bg-white/10 font-bold text-zinc-300"
              >
                <span>{{ group }} ({{ recipes.length }})</span>
                <span class="text-zinc-500">{{ expandedGroups[group] ? '−' : '+' }}</span>
              </button>
              <div v-show="expandedGroups[group]" class="p-2 space-y-1 bg-black/30">
                <div
                  v-for="r in recipes"
                  :key="r.id"
                  @click.stop="selectRecipe(r)"
                  class="p-1.5 rounded cursor-pointer transition-all flex items-center justify-between"
                  :class="selectedRecipe?.id === r.id ? 'bg-[#00f0ff]/20 text-[#00f0ff]' : 'hover:bg-white/5 text-zinc-300'"
                >
                  <span>{{ isRecipeUnlocked(r.id) ? r.name : '？？？' }}</span>
                  <span v-if="isRecipeUnlocked(r.id)" class="text-sm text-green-400 font-semibold">已掌握</span>
                  <span v-else class="text-sm text-zinc-600">未解锁</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- 【新手引导】任务指引面板：当前任务高亮、已完成打勾、未解锁显示？？？ -->
        <div v-else class="flex-1 min-h-0 overflow-y-auto pr-1 badab-sidebar-scroll text-sm space-y-1.5">
          <div
            v-for="q in UPPER_QUESTS"
            :key="q.id"
            class="p-2 rounded-lg border transition-all"
            :class="questRowClass(q)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">{{ isQuestVisibleRow(q) ? `【${q.npc === 'tax_officer' ? '税务官' : '指挥官'}】${q.title}` : '？？？' }}</span>
              <span v-if="questDoneMap[q.id]" class="text-green-400 font-bold">✓ 已完成</span>
            </div>
            <div v-if="currentQuest?.id === q.id && !questDoneMap[q.id]" class="mt-1 text-zinc-400 leading-relaxed">
              {{ q.instruction }}
            </div>
          </div>

          <div
            v-if="upperAllDone"
            class="p-2 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 leading-relaxed"
          >
            {{ settlementReport ? '✦ 跟随年末引导，完成第一年的洗礼。' : '✦ 新星域十项任务全部完成！等待第一个星际年结束。' }}
          </div>
        </div>
      </div>
    </transition>

    <!-- 常驻左下角信息卡：悬停卡牌优先（方案A）；无悬停时回显选中的主意配方详情 -->
    <transition name="pop-down">
      <div
        v-if="hoveredCard || selectedRecipe"
        class="absolute bottom-5 left-4 z-20 w-88 md:w-96 bg-zinc-950/95 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-2xl pointer-events-auto select-none min-h-[220px]"
      >
        <template v-if="hoveredCard && !hoveredRecipe">
        <div class="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
          <span class="text-lg md:text-xl font-black text-white tracking-wide">{{ hoveredCard.name }}</span>
          <div class="flex items-center gap-1.5">
            <span
              v-if="hoveredEntity?.trait === 'untouchable'"
              class="text-sm md:text-sm px-2.5 py-0.5 rounded bg-cyan-950/90 border border-cyan-400/60 text-cyan-300 font-bold"
            >
              无魂者
            </span>
            <span
              v-else-if="hoveredEntity?.trait === 'psyker'"
              class="text-sm md:text-sm px-2.5 py-0.5 rounded bg-purple-950/90 border border-purple-400/60 text-fuchsia-300 font-bold"
            >
              灵能者
            </span>
            <span class="text-sm md:text-sm px-2.5 py-0.5 rounded bg-white/10 text-zinc-300 font-medium">
              {{ getCategoryLabel(hoveredCard.category) }}
            </span>
          </div>
        </div>

        <!-- 详细功能说明栏 (问题 10) -->
        <div v-if="hoveredCard.desc" class="p-2.5 mb-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-300 leading-relaxed">
          <div class="text-[#00f0ff] font-bold mb-1 flex items-center gap-1">
            <span>ℹ️ 功能说明</span>
          </div>
          <div>{{ hoveredCard.desc }}</div>
        </div>

        <div class="space-y-2 text-zinc-200 text-sm md:text-base mb-3.5 leading-relaxed">
          <div v-if="hoveredEntity && hoveredEntity.maxHp > 0" class="flex items-center justify-between">
            <span class="text-zinc-400">当前生命</span>
            <div>
              <span class="text-green-400 font-mono font-bold">{{ hoveredEntity.hp }}</span>
              <span class="text-zinc-500 font-mono"> / </span>
              <span class="text-zinc-200 font-mono font-bold">{{ hoveredEntity.maxHp }}</span>
              <span v-if="unitStats && unitStats.hpBonus > 0" class="text-cyan-300 font-bold ml-1"> (+{{ unitStats.hpBonus }})</span>
            </div>
          </div>
          <div v-else-if="hoveredCard.hp" class="flex items-center justify-between">
            <span class="text-zinc-400">生命上限</span>
            <span class="text-zinc-200 font-mono font-bold">{{ hoveredCard.hp }}</span>
          </div>

          <div v-if="hoveredCard.attack !== undefined || (unitStats && unitStats.attack > 0)" class="flex items-center justify-between">
            <span class="text-zinc-400">攻击能力</span>
            <div>
              <span class="text-amber-300 font-mono font-black">{{ unitStats ? unitStats.attack : (hoveredCard.attack ?? 0) }}</span>
              <span v-if="unitStats && unitStats.attackBonus > 0" class="text-amber-400 font-bold ml-1"> (+{{ unitStats.attackBonus }})</span>
              <span class="text-zinc-500 text-sm ml-1 font-sans">({{ getDmgTypeLabel(hoveredCard.damageType) }})</span>
              <span v-if="hoveredCard.attackInterval" class="text-zinc-500 text-sm font-sans"> · {{ hoveredCard.attackInterval }}s出招</span>
            </div>
          </div>

          <div v-if="unitStats && (unitStats.weapons.length > 0 || unitStats.armors.length > 0)" class="pt-2 pb-1 border-t border-white/10 flex flex-wrap gap-1.5">
            <span v-for="w in unitStats.weapons" :key="w" class="px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 text-sm font-bold">
              ⚔️ {{ w }} (+1攻)
            </span>
            <span v-for="a in unitStats.armors" :key="a" class="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 text-sm font-bold">
              🛡️ {{ a }} (+6血)
            </span>
          </div>

          <div v-if="hoveredCard.isMagicImmune" class="text-purple-300 text-sm md:text-sm font-semibold">★ 法术与精神绝对免疫</div>
          <div v-if="hoveredCard.isPhysicalImmune" class="text-cyan-300 text-sm md:text-sm font-semibold">★ 物理伤害绝对免疫</div>

          <div v-if="hoveredCard.foodPerMonth" class="flex items-center justify-between">
            <span class="text-zinc-400">每年口粮消耗</span>
            <span class="text-zinc-200 font-mono font-bold">{{ hoveredCard.foodPerMonth }}</span>
          </div>
          <div v-if="hoveredCard.satiety" class="flex items-center justify-between">
            <span class="text-zinc-400">提供饱食度</span>
            <span class="text-green-400 font-mono font-bold">+{{ hoveredCard.satiety }}</span>
          </div>
          <div v-if="hoveredCard.capacityBonus" class="flex items-center justify-between">
            <span class="text-zinc-400">卡牌容量加成</span>
            <span class="text-cyan-400 font-mono font-bold">+{{ hoveredCard.capacityBonus }}</span>
          </div>
          <div v-if="hoveredCard.uses" class="flex items-center justify-between">
            <span class="text-zinc-400">可采集次数</span>
            <span class="text-yellow-400 font-mono font-bold">{{ hoveredCard.uses }}</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-white/10 text-sm">
          <span class="text-zinc-400">基础价值</span>
          <span v-if="hoveredCard.unsellable" class="text-red-400 font-bold">不可出售</span>
          <span v-else class="text-yellow-300 font-mono font-black">{{ hoveredCard.price }} 金币 🪙</span>
        </div>
        </template>

        <template v-else-if="activeRecipe">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
            <span
              class="text-lg md:text-xl font-black tracking-wide"
              :class="isRecipeUnlocked(activeRecipe.id) ? 'text-[#00f0ff]' : 'text-zinc-400'"
            >
              {{ isRecipeUnlocked(activeRecipe.id) ? activeRecipe.name : '？？？（神秘配方）' }}
            </span>
            <span class="text-sm md:text-sm px-2.5 py-0.5 rounded bg-white/10 text-zinc-300 font-medium">主意配方</span>
          </div>

          <div class="text-zinc-400 text-sm mb-2">
            制作用时：{{ activeRecipe.baseTime }} 秒
          </div>

          <div v-if="getRecipeOutputDesc(activeRecipe)" class="p-2.5 mb-3 bg-white/5 border border-white/10 rounded-xl text-sm text-zinc-300 leading-relaxed">
            <span class="text-amber-300 font-bold">★ 功能说明：</span>{{ getRecipeOutputDesc(activeRecipe) }}
          </div>

          <div class="space-y-1">
            <div class="text-zinc-400 font-bold text-sm">所需投入材料：</div>
            <div v-if="isRecipeUnlocked(activeRecipe.id)" class="flex flex-wrap gap-1">
              <span
                v-for="(num, matId) in activeRecipe.inputs"
                :key="matId"
                class="px-2 py-0.5 bg-white/10 rounded text-zinc-200"
              >
                {{ getMatName(matId, activeRecipe) }} × {{ num }}
              </span>
            </div>
            <div v-if="isRecipeUnlocked(activeRecipe.id) && activeRecipe.requiredOrigin === 'astartes'" class="pt-1 text-amber-300 font-bold text-sm">
              ⚠ 仅限阿斯塔特遗体（普通尸体不适用）
            </div>
            <!-- 任意人口/探索者槽（anyInputs）展示：火葬人口、转化志愿者、建信标劳力、远征探索者 -->
            <div v-if="isRecipeUnlocked(activeRecipe.id) && activeRecipe.anyInputs && activeRecipe.anyInputs.length > 0" class="flex flex-wrap items-center gap-1 pt-1 mt-1 border-t border-white/10">
              <!-- batch61：前缀中性化（该槽位不一定是人口） -->
              <span class="text-zinc-400 font-bold text-sm">所需：</span>
              <span
                v-for="(group, gi) in activeRecipe.anyInputs"
                :key="gi"
                class="px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/40 rounded text-cyan-300"
              >
                {{ getAnyInputLabel(activeRecipe, group) }}
              </span>
            </div>
            <!-- 消耗型人口槽风险警示：转化志愿者失败即死 -->
            <div v-if="isRecipeUnlocked(activeRecipe.id) && activeRecipe.consumeAnyInputs" class="pt-1 text-amber-300/90 text-sm">
              ⚠ 转化志愿者：失败将死亡（动力甲与基因种子保留）
            </div>
            <!-- batch19：活体摘取说明 -->
            <div v-if="isRecipeUnlocked(activeRecipe.id) && activeRecipe.id === 'harvest_gene_seed'" class="pt-1 text-amber-300/90 text-sm">
              ⚠ 每具阿斯塔特仅可献身一次（摘取后极度虚弱，不致死）
            </div>
            <!-- batch52：锚定召唤说明（outputs 为空导致功能说明栏空白，此处补齐） -->
            <div v-if="isRecipeUnlocked(activeRecipe.id) && activeRecipe.id === 'summon_greater_demon_boss'" class="pt-1 text-amber-300/90 text-sm">
              ⚠ 需 5 块热核电池供能；腐化值 100 时信标无法激活（正义线封闭，仅可讨伐帝国旗舰）
            </div>
            <!-- batch30：栽培三合一产出说明（基质或农田均可种植；农田更快且有10%双倍） -->
            <div v-if="isRecipeUnlocked(activeRecipe.id) && activeRecipe.id === 'grow_crop'" class="pt-1 text-green-300/90 text-sm">
              ★ 产出随种子：苦根→苦根块×2 / 阿肯浆果→阿肯果丛 / 棘刺谷穗→棘穗丛；基质或农田均可种植（永久耐用），农田读条 30 秒且 10% 双倍收获
            </div>
            <div v-else class="text-zinc-600 italic">
              尚未解锁科技蓝图，可通过试错堆叠探索
            </div>
          </div>
        </template>
      </div>
    </transition>

    <!-- batch14 启动菜单：继续游戏 / 重新开始（含跳过引导子选择） / 退出 -->
    <div
      v-if="showStartMenu"
      class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-50 pointer-events-auto"
    >
      <div class="text-[#00f0ff] font-black text-4xl tracking-widest mb-2">巴达布前哨</div>
      <div class="flex flex-col gap-3 w-72">
        <template v-if="!startChoice">
          <button
            v-if="hasExistingSave"
            @click.stop="onContinueGame"
            class="px-8 py-3 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/60 rounded-xl text-[#00f0ff] font-bold tracking-wider transition-all hover:scale-105"
          >
            ▶ 继续游戏
          </button>
          <button
            @click.stop="onStartNewGame"
            class="px-8 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl text-zinc-200 font-bold tracking-wider transition-all hover:scale-105"
          >
            {{ hasExistingSave ? '重新开始' : '开始游戏' }}
          </button>
          <button
            @click.stop="exitToLobby"
            class="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-zinc-400 font-bold tracking-wider transition-all hover:scale-105"
          >
            退出
          </button>
          <button
            v-if="hasExistingSave"
            @click.stop="confirmWipeStart"
            class="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 font-bold tracking-wider transition-all hover:scale-105"
          >
            ☠ 全新开始（清空已解锁主意）
          </button>
        </template>
        <template v-else>
          <button
            @click.stop="startFullTutorial"
            class="px-8 py-3 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/60 rounded-xl text-[#00f0ff] font-bold tracking-wider transition-all hover:scale-105"
          >
            📖 完整新手引导
          </button>
          <button
            @click.stop="startSkippedGame"
            class="px-8 py-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl text-amber-300 font-bold tracking-wider transition-all hover:scale-105"
          >
            ⚡ 跳过引导（发放全部奖励）
          </button>
          <button
            @click.stop="startChoice = false"
            class="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-xl text-zinc-400 font-bold tracking-wider transition-all hover:scale-105"
          >
            ← 返回
          </button>
        </template>
      </div>
    </div>

    <!-- batch56：开始界面基础操作说明（显式告知，防智障） -->
    <div
      v-if="showStartMenu"
      class="absolute bottom-6 left-1/2 -translate-x-1/2 z-[55] text-zinc-300 text-base font-bold leading-loose tracking-wide text-center font-mono pointer-events-none"
    >
      左键拖动卡牌 · 滚轮缩放 · 空白处拖拽平移视图<br>F11 全屏 · P 暂停 · ESC 暂停菜单 · 空格 / 点击 推进对话
    </div>

    <!-- 游戏暂停遮罩（ESC / P / 暂停按钮触发；含继续游戏与退出通道） -->
    <div
      v-if="showPauseOverlay"
      class="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-6 z-40 pointer-events-auto"
    >
      <div class="text-[#00f0ff] font-black text-3xl tracking-widest animate-pulse">
        ⏸ 游戏已暂停
      </div>
      <div class="text-zinc-400 text-sm">前哨站时间已冻结，卡牌与生产全部停摆。</div>
      <div class="flex gap-4">
        <button
          @click.stop="resumeGame"
          class="px-8 py-3 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/60 rounded-xl text-[#00f0ff] font-bold tracking-wider transition-all hover:scale-105"
        >
          ▶ 继续游戏 (P)
        </button>
        <button
          @click.stop="saveGameManual"
          class="px-8 py-3 bg-green-500/15 hover:bg-green-500/25 border border-green-500/40 rounded-xl text-green-300 font-bold tracking-wider transition-all hover:scale-105"
        >
          💾 保存游戏
        </button>
        <button
          @click.stop="restart"
          class="px-8 py-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-xl text-amber-300 font-bold tracking-wider transition-all hover:scale-105"
        >
          ↺ 重新开始
        </button>
        <button
          @click.stop="exitToLobby"
          class="px-8 py-3 border border-white/15 text-zinc-400 rounded-xl hover:text-white transition-all"
        >
          退出到大厅
        </button>
      </div>
    </div>

    <!-- 败北结算全屏遮罩 -->
    <div
      v-if="showDefeat"
      class="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-50"
    >
      <div class="text-red-500 font-black text-4xl tracking-widest animate-pulse">
        人类一败涂地
      </div>
      <div class="text-zinc-400 text-sm">前哨站的所有己方作战与平民单位已全部覆灭。</div>
      <div class="flex gap-4">
        <button
          @click.stop="restart"
          class="px-7 py-2.5 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff]/40 rounded-lg text-[#00f0ff] font-bold tracking-wider"
        >
          重新开始
        </button>
        <button
          @click.stop="exitToLobby"
          class="px-7 py-2.5 border border-white/15 text-zinc-400 rounded-lg hover:text-white"
        >
          返回大厅
        </button>
      </div>
    </div>

    <!-- batch54：大魔低语浮层（新周期开始按腐化档触发；底部居中偏上、自动消隐、不打断操作；z-[60] 可浮于对话层之上） -->
    <transition name="pop-down">
      <div
        v-if="demonWhisper"
        class="absolute bottom-36 left-1/2 -translate-x-1/2 z-[60] pointer-events-none text-xl font-black tracking-widest text-red-400/95"
        style="text-shadow: 0 0 14px rgba(239, 68, 68, 0.9), 0 0 4px #000"
      >
        “{{ demonWhisper }}”
      </div>
    </transition>

    <!-- batch54：前言页（第四面墙旁白；背景复用 beijing.mp4，无需新素材） -->
    <div
      v-if="showLore"
      class="absolute inset-0 z-[75] flex flex-col items-center justify-center bg-black/95 pointer-events-auto"
      @click.stop
    >
      <video :src="videoSrc" autoplay loop muted playsinline class="absolute inset-0 w-full h-full object-cover opacity-35" />
      <div class="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/95" />
      <!-- batch57：容器放宽+行距舒展，消除段落末行 2-3 字孤行缩进 -->
      <div class="relative max-w-3xl px-12 text-center space-y-6 leading-loose">
        <div class="text-[#00f0ff] font-black text-3xl tracking-[0.4em] mb-2">巴达布前哨</div>
        <div class="text-amber-200/90 font-bold tracking-widest text-sm mb-6">—— 前 言 ——</div>
        <p
          v-for="(line, i) in LORE_TEXT"
          :key="i"
          class="text-zinc-200 leading-loose"
          :class="i === 2 ? 'text-lg text-amber-100 font-bold' : 'text-base'"
        >{{ line }}</p>
        <div class="pt-6 flex items-center justify-center gap-6">
          <button
            @click.stop="closeLore()"
            class="px-10 py-3 bg-[#00f0ff]/20 hover:bg-[#00f0ff]/30 border border-[#00f0ff]/60 rounded-xl text-[#00f0ff] font-bold tracking-widest transition-all hover:scale-105"
          >
            进入巴达布
          </button>
          <button
            @click.stop="closeLore()"
            class="text-zinc-500 hover:text-zinc-300 text-sm transition-all"
          >
            跳过 ›
          </button>
        </div>
      </div>
    </div>

    <!-- batch50：引擎帧错误横幅（dist 无 devtools 的现场定位手段） -->
    <div
      v-if="engineErrors.length"
      class="absolute top-14 right-3 z-[65] max-w-md bg-red-950/90 border border-red-500/60 rounded-xl p-3 text-xs text-red-200 font-mono pointer-events-auto"
    >
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold">⚠️ 引擎错误（请截图反馈）</span>
        <button @click.stop="engineErrors = []" class="text-red-400 hover:text-red-200 font-bold">✕</button>
      </div>
      <div v-for="(m, i) in engineErrors" :key="i" class="leading-relaxed break-all">{{ m }}</div>
    </div>

    <!-- batch19：通关媒体覆盖层——BGM 为底部居中单行 LRC 歌词（现代播放器样式）；CG 全屏 video（自带音频，不叠 MP3/歌词） -->
    <div
      v-if="showVictoryMedia"
      class="absolute inset-0 z-[70] bg-black flex flex-col items-center justify-center pointer-events-auto"
      @click.stop
    >
      <template v-if="showVictoryMedia === 'cg'">
        <video
          ref="vmVideo"
          :src="victoryRoute ? `${baseUrl}/games/badab/audio/${victoryRoute === 'justice' ? 'zyx' : 'fpx'}.mp4` : ''"
          controls
          playsinline
          class="max-w-full max-h-full"
          @canplay="onCgReady"
          @click="onCgClick"
          @error="onCgError"
          @ended="stopVictoryMedia"
        />
      </template>
      <template v-else>
        <div class="text-zinc-500 text-sm tracking-widest mb-4">♪ 通关 BGM 播放中</div>
        <div class="absolute bottom-24 left-0 right-0 px-8 text-center">
          <div class="text-3xl font-black leading-relaxed" :class="vmLrcIndex >= 0 ? 'text-[#00f0ff]' : 'text-zinc-600'">
            {{ vmLrcIndex >= 0 && vmLrcLines[vmLrcIndex] ? vmLrcLines[vmLrcIndex].text : '……' }}
          </div>
        </div>
      </template>
      <div v-if="vmMediaError" class="text-red-400 text-sm mt-6">{{ vmMediaError }}</div>
      <button
        @click.stop="stopVictoryMedia"
        class="absolute bottom-6 px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-zinc-200 font-bold transition-all"
      >
        ✕ 关闭 (ESC)
      </button>
    </div>

    <!-- 【新手引导】NPC 立绘对话框：屏幕坐标置顶；存活时自动安静暂停；右上角全屏等按钮仍可点击 -->
    <NpcDialog v-if="dialogLines" :lines="dialogLines" @done="onDialogDone" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useBadabStore } from '../../../stores/badabStore'
import { miniGameAssetBase } from '../../../utils/minigameAssetBase'
import { BadabEngine, CameraTransform } from '../../../main/services/badab/engine/BadabEngine'
import { CardEntity, BOARD_W, BOARD_H } from '../../../main/services/badab/engine/Stack'
import { RECIPES } from '../../../main/services/badab/game/recipes'
import { getDef } from '../../../main/services/badab/game/cards'
import { CardDef, RecipeDef, DamageType, TaxType } from '../../../main/services/badab/game/types'
import { MonthSettlementResult } from '../../../main/services/badab/game/cycle'
import { getEffectiveStats } from '../../../main/services/badab/game/equipment'
// 【新手引导】NPC 对话框组件 + 任务链与台词数据
import NpcDialog from './NpcDialog.vue'
import { UPPER_QUESTS, DIALOGS, LORE_TEXT, DEMON_WHISPERS, TAX_REMINDS, SISTER_WARN, DEMON_GIFT, type DialogLine, type QuestDef } from '../../../main/services/badab/game/quests'
import { useTelemetryStore } from '../../../stores/telemetryStore'
import { useAuthStore } from '../../../stores/authStore'
const telemetry = useTelemetryStore()
const authStore = useAuthStore()
let sessionStartPerf = 0

defineProps<{ continueGame?: boolean }>()
const emit = defineEmits<{
  exit: []
  'update:stats': [stats: { scrap?: number; cores?: number }]
}>()

const store = useBadabStore()
const pixiContainer = ref<HTMLDivElement>()
const videoRef = ref<HTMLVideoElement>()
const showDefeat = ref(false)
const isFullscreen = ref(false)

const baseUrl = miniGameAssetBase
const videoSrc = `${baseUrl}/games/badab/beijing.mp4`
const bgmSrc = `${baseUrl}/games/badab/audio/bgm_daily.mp3`

const isMuted = ref(false)
let bgmAudio: HTMLAudioElement | null = null

const cameraTransform = ref<CameraTransform | null>(null)

const worldVideoStyle = computed(() => {
  const trans = cameraTransform.value
  if (!trans) {
    return { left: '0px', top: '0px', width: '100%', height: '100%' }
  }
  return {
    left: `${trans.worldX}px`,
    top: `${trans.worldY}px`,
    width: `${BOARD_W * trans.scale}px`,
    height: `${BOARD_H * trans.scale}px`
  }
})



const settlementReport = ref<MonthSettlementResult | null>(null)
const isSlotOver = computed(() => store.slotsUsed > store.slotsCap)
const settlementPhase = ref<'feeding' | 'tax' | 'clearance' | 'sell' | 'confirm' | null>(null)
const engineTaxNoticePending = ref(false)
const feedingStarted = ref(false)

// 悬停蓝图实体卡：解析其 unlocksRecipe 指向的配方（左下角改为展示配方详情）
const hoveredRecipe = computed<RecipeDef | null>(() => {
  const rid = hoveredCard.value?.unlocksRecipe
  if (!rid) return null
  return RECIPES.find(r => r.id === rid) || null
})

// 左下角配方详情数据源：悬停的蓝图配方优先，其次侧栏选中的配方（方案A）
const activeRecipe = computed<RecipeDef | null>(() => hoveredRecipe.value || selectedRecipe.value)

// 暂停遮罩可见性：游戏已开始且处于暂停态，且没有任何其他弹窗/结算/结局面板时展示
const showPauseOverlay = computed(() => {
  return !!engine?.gameStarted
    && store.paused
    && !settlementReport.value
    && !victoryRoute.value
    && !showDefeat.value
    && !store.showDoubleTaxPrompt
    && !hasActiveDialog()
})

const victoryRoute = ref<'justice' | 'corruption' | null>(null)
const victoryText = ref('')

// ================= 巴达布通关天卡特权激励状态机 =================
const rewardClaimStatus = ref<'idle' | 'loading' | 'success' | 'already_claimed' | 'failed' | 'not_logged_in' | 'too_short'>('idle')
const rewardClaimMsg = ref('')
const rewardExpireDate = ref('')

async function handleClaimVictoryReward(route: 'justice' | 'corruption', elapsedSec: number, starYear: number) {
  if (!authStore.isLoggedIn) {
    rewardClaimStatus.value = 'not_logged_in'
    rewardClaimMsg.value = '💡 提示：登录 Titan 账号后通关可自动获赠 1 天畅享天卡特权'
    return
  }

  // 客户端前置时长校验（防刷防作弊硬门槛 35 分钟）
  if (elapsedSec < 2100) {
    rewardClaimStatus.value = 'too_short'
    rewardClaimMsg.value = `⚠️ 战役历程仅 ${Math.floor(elapsedSec / 60)} 分钟，未满 35 分钟安全审核门槛`
    return
  }

  rewardClaimStatus.value = 'loading'
  rewardClaimMsg.value = '正在核验通关成就并直充 1 天天卡特权...'

  try {
    const res = await (window as any).electron?.invoke?.('badab:claim-victory', route, elapsedSec, starYear)
    if (res?.success) {
      if (res.data?.status === 'ALREADY_CLAIMED') {
        rewardClaimStatus.value = 'already_claimed'
        rewardClaimMsg.value = res.data?.msg || '该账号已领取过巴达布通关专属天卡'
      } else {
        rewardClaimStatus.value = 'success'
        rewardClaimMsg.value = res.data?.msg || '🎉 恭喜总督！1 天天卡特权已成功注入您的账户！'
        rewardExpireDate.value = res.data?.expire_date || ''
      }
    } else {
      rewardClaimStatus.value = 'failed'
      rewardClaimMsg.value = res?.error || '领取失败，请稍后重试'
    }
  } catch (err: any) {
    rewardClaimStatus.value = 'failed'
    rewardClaimMsg.value = '网络异常，未能连接到特权网关'
  }
}

// ================= batch19：通关 BGM（LRC 歌词）/ CG 视频 =================
const showVictoryMedia = ref<'bgm' | 'cg' | null>(null)
const vmVideo = ref<HTMLVideoElement | null>(null)
const vmLrcLines = ref<Array<{ t: number; text: string }>>([])
const vmLrcIndex = ref(-1)
const vmMediaError = ref('')
let vmAudio: HTMLAudioElement | null = null

function vmMediaBase(route: 'justice' | 'corruption'): string {
  return `${baseUrl}/games/badab/audio/${route === 'justice' ? 'zyx' : 'fpx'}`
}

function parseLrc(raw: string): Array<{ t: number; text: string }> {
  const out: Array<{ t: number; text: string }> = []
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/)
    if (m) out.push({ t: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() })
  }
  return out.sort((a, b) => a.t - b.t)
}

async function playVictoryBgm(route: 'justice' | 'corruption') {
  stopVictoryMedia()
  // batch50：通关媒体播放期间背景 BGM 让位
  if (bgmAudio) bgmAudio.pause()
  showVictoryMedia.value = 'bgm'
  vmMediaError.value = ''
  try {
    // batch29：.lrc 扩展名在本机无法通过 Vite 打包拷贝（EPERM），歌词文件改 .txt 纯文本（LRC 解析只认时间标签不认后缀）
    const res = await fetch(`${vmMediaBase(route)}.txt`)
    const raw = res.ok ? await res.text() : ''
    vmLrcLines.value = parseLrc(raw)
  } catch {
    vmLrcLines.value = []
  }
  const audio = new Audio(`${vmMediaBase(route)}.mp3`)
  vmAudio = audio
  audio.addEventListener('timeupdate', () => {
    const t = audio.currentTime
    let idx = -1
    for (let i = 0; i < vmLrcLines.value.length; i++) {
      if (vmLrcLines.value[i].t <= t) idx = i
      else break
    }
    vmLrcIndex.value = idx
  })
  audio.play().catch(() => { vmMediaError.value = 'BGM 播放失败（浏览器拦截或素材缺失）' })
}

function playVictoryCg(route: 'justice' | 'corruption') {
  stopVictoryMedia()
  // batch64：CG 自带音轨，开始前显式保持日常BGM暂停（stopVictoryMedia 的 victory守卫双保险）
  if (bgmAudio) bgmAudio.pause()
  showVictoryMedia.value = 'cg'
  vmMediaError.value = ''
  void route
}

function onCgReady() {
  // batch50：CG 就绪即自动播放并请求全屏（部分 Electron 构建拦截 autoplay 属性，canplay 后主动 play 更稳）
  const v = vmVideo.value
  if (!v) return
  v.play().catch(() => { vmMediaError.value = 'CG 播放被拦截，请点击画面' })
  const vf = v as HTMLVideoElement & { requestFullscreen?: () => Promise<void> }
  vf.requestFullscreen?.().catch(() => {})
}

function onCgClick() {
  // batch50：点击画面兜底播放（应对自动播放策略拦截）
  const v = vmVideo.value
  if (v && v.paused) v.play().catch(() => {})
}

function onCgError() {
  vmMediaError.value = 'CG 素材缺失（反叛线 fpx.mp4 待补）'
}

function stopVictoryMedia() {
  if (vmAudio) { vmAudio.pause(); vmAudio.src = ''; vmAudio = null }
  if (vmVideo.value) { vmVideo.value.pause(); vmVideo.value.src = ''; vmVideo.value = null }
  vmLrcLines.value = []
  vmLrcIndex.value = -1
  showVictoryMedia.value = null
  // batch50/64：通关媒体结束 → 恢复背景 BGM（未静音时）；batch64：胜利结算界面常驻静音，
  // 防恢复BGM与CG音轨/通关BGM叠放（B3根因：stopVictoryMedia 无条件恢复）
  if (bgmAudio && !isMuted.value && !victoryRoute.value) bgmAudio.play().catch(() => {})
}

const isSidebarOpen = ref(true)
const hasNewUnlock = ref(false)
const activeTab = ref<'ideas' | 'tasks'>('ideas')
const searchQuery = ref('')
const selectedRecipe = ref<RecipeDef | null>(null)
const hoveredCard = ref<CardDef | null>(null)
const hoveredEntity = ref<CardEntity | null>(null)

const doubleTaxActionMsg = ref('')

// batch50：dist 无 devtools——引擎帧守卫错误经此横幅呈现，便于现场抄报
const engineErrors = ref<string[]>([])

// ================= batch54：前言页 / 大魔低语浮层 =================
const showLore = ref(false)
let loreDoneCb: (() => void) | null = null
const demonWhisper = ref('')
let whisperTimer: number | null = null

function openLore(onDone: () => void) {
  loreDoneCb = onDone
  showLore.value = true
}

function closeLore() {
  showLore.value = false
  const cb = loreDoneCb
  loreDoneCb = null
  // batch55：跳过与进入等效——回调必须执行，否则开场白/发牌链断掉（batch54 软锁修复）
  cb?.()
}

function showDemonWhisper(band: 1 | 2 | 3) {
  const pool = DEMON_WHISPERS[band] || []
  if (!pool.length) return
  demonWhisper.value = pool[Math.floor(Math.random() * pool.length)]
  if (whisperTimer) window.clearTimeout(whisperTimer)
  whisperTimer = window.setTimeout(() => { demonWhisper.value = '' }, 2600)
}

// batch14存档：启动菜单状态
const showStartMenu = ref(false)
const hasExistingSave = ref(false)
// batch14：新局子选择（完整引导 / 跳过引导）
const startChoice = ref(false)

function onContinueGame() {
  if (!engine) return
  if (engine.loadGame()) {
    unlockedSet.value = new Set(engine.unlockedRecipes)
    // batch14：恢复任务链状态（无存档槽位的旧档则保持全新状态）
    const extra = engine.getSaveExtra() as any
    if (extra) {
      questDoneMap.value = { ...(extra.questDoneMap || {}) }
      introShownMap.value = { ...(extra.introShownMap || {}) }
      foodStoryShown.value = !!extra.foodStoryShown
      corpseStoryShown.value = !!extra.corpseStoryShown
      seedGranted.value = !!extra.seedGranted
    }
    showStartMenu.value = false
  } else {
    hasExistingSave.value = false
  }
}

function onStartNewGame() {
  // batch14：进入子选择（完整引导 / 跳过引导）
  startChoice.value = true
}

function startFullTutorial() {
  startChoice.value = false
  showStartMenu.value = false
  // batch54：完整引导先进前言页（背景故事），确认后再播开场白
  openLore(() => startWelcomeFlow())
}

/** batch19：全新开始——清空已解锁主意（META+内存表），其他流程与重开一致，跳过引导子选择仍可用 */
function confirmWipeStart() {
  if (!engine) return
  engine.wipeMetaProgress()
  unlockedSet.value = new Set(engine.unlockedRecipes)
  engine.deleteSave()
  hasExistingSave.value = false
  startChoice.value = false
  showStartMenu.value = false
  engine.reset()
  startWelcomeFlow()
}

/** batch14：跳过新手引导开局——全部任务奖励 + 剧情奖励（2主意卡+基因种子）一次性发放，任务全置完成防重复结算 */
function startSkippedGame() {
  if (!engine) return
  for (const q of UPPER_QUESTS) {
    questDoneMap.value[q.id] = true
    introShownMap.value[q.id] = true
  }
  const cards: Array<{ cardId: string; count: number }> = []
  let goldTotal = 0
  for (const q of UPPER_QUESTS) {
    if (q.reward.gold) goldTotal += q.reward.gold
    if (q.reward.cards) cards.push(...q.reward.cards)
  }
  // 剧情奖励必发：尸体讲解主意卡 ×2 + 第2年基因种子（无种子无法通关）
  cards.push({ cardId: 'idea_cremate_corpse', count: 1 })
  cards.push({ cardId: 'idea_cook_corpse_starch', count: 1 })
  cards.push({ cardId: 'gene_seed', count: 1 })
  if (goldTotal > 0) cards.push({ cardId: 'coin', count: goldTotal })
  foodStoryShown.value = true
  corpseStoryShown.value = true
  seedGranted.value = true
  startChoice.value = false
  showStartMenu.value = false
  // batch54：跳过引导同样先过前言页
  openLore(() => {
    engine?.grantStarterPack()
    engine?.grantCards(cards)
  })
}

function saveGameManual() {
  engine?.saveGame()
}
const isPopSelecting = ref(false)
const selectedPopUids = ref<number[]>([])

const unitStats = computed(() => {
  if (!hoveredEntity.value) return null
  return getEffectiveStats(hoveredEntity.value)
})

const livingAdultUnits = computed(() => {
  if (!engine) return []
  return engine.board.allCards().filter(c => {
    const d = getDef(c.cardId)
    return d.isOurUnit && c.cardId !== 'baby'
  })
})

const unlockedSet = ref<Set<string>>(new Set([
  'craft_parts', 'craft_scrap_club', 'build_hive_city', 'build_shed',
  'produce_scrap', 'produce_stone', 'produce_titanium', 'build_rift_beacon'
]))

// 分类体系：重构为 6 大类别，新增【特殊转化】，默认折叠保持界面规整
const expandedGroups = ref<Record<string, boolean>>({
  '基础与材料': true,
  '建筑设施': true,
  '武器装备': false,
  '食品烹饪': false,
  '特殊转化': false,
  '特殊互动': false
})

let engine: BadabEngine | null = null
let resizeObserver: ResizeObserver | null = null

// ================= 【新手引导】NPC 对话框状态机（自动安静暂停） =================
// batch18：对话框改队列制——showDialog 只入队，当前对话播完自动出队接续下一条；
// 杜绝"后一条顶掉前一条"导致 onDone 奖励回调丢失（onSettlementStart 的 prevCb 补丁手法随之删除）
interface DialogItem {
  lines: DialogLine[]
  onDone?: () => void
}
const dialogQueue: DialogItem[] = []
const dialogLines = ref<DialogLine[] | null>(null)
let currentDialogOnDone: (() => void) | undefined
let dialogPausedByUs = false

function hasActiveDialog(): boolean {
  return dialogLines.value !== null || dialogQueue.length > 0
}

function pumpDialog(): void {
  if (dialogLines.value || dialogQueue.length === 0) return
  const item = dialogQueue.shift()!
  // 对话期间自动暂停（安静暂停：userAction=false，不触发"喘口气"任务）
  if (engine && !engine.isSettling && !engine.isPaused()) {
    engine.setPaused(true)
    dialogPausedByUs = true
  }
  currentDialogOnDone = item.onDone
  dialogLines.value = item.lines
}

function showDialog(lines: DialogLine[], onDone?: () => void) {
  dialogQueue.push({ lines, onDone })
  pumpDialog()
}

function onDialogDone() {
  const cb = currentDialogOnDone
  currentDialogOnDone = undefined
  dialogLines.value = null
  if (dialogQueue.length === 0 && dialogPausedByUs) {
    dialogPausedByUs = false
    engine?.setPaused(false)
  }
  // 先触发本条回调（回调内可能再入队新对话），再 pump 下一条
  cb?.()
  pumpDialog()
}

// ================= 【新手引导】第一年任务链状态 =================
const questDoneMap = ref<Record<string, boolean>>({})
const introShownMap = ref<Record<string, boolean>>({})
const foodStoryShown = ref(false)
const corpseStoryShown = ref(false)
const seedGranted = ref(false)
let graceActive = false

const currentQuest = computed<QuestDef | null>(() => UPPER_QUESTS.find(q => !questDoneMap.value[q.id]) || null)
const upperAllDone = computed(() => UPPER_QUESTS.every(q => questDoneMap.value[q.id]))

function isQuestVisibleRow(q: QuestDef): boolean {
  return !!questDoneMap.value[q.id] || currentQuest.value?.id === q.id
}
function questRowClass(q: QuestDef): string {
  if (questDoneMap.value[q.id]) return 'border-green-500/25 bg-green-500/5 text-zinc-400'
  if (currentQuest.value?.id === q.id) return 'border-[#00f0ff]/50 bg-[#00f0ff]/10 text-zinc-100'
  return 'border-white/5 bg-black/30 text-zinc-600'
}

/** 任务奖励发放：卡牌从 NPC 立绘后方滑入场地（引擎 grantCards），金币/主意卡磁吸归拢 */
function grantQuestReward(q: QuestDef) {
  const cards: Array<{ cardId: string; count: number }> = []
  if (q.reward.gold && q.reward.gold > 0) cards.push({ cardId: 'coin', count: q.reward.gold })
  if (q.reward.cards) cards.push(...q.reward.cards)
  if (cards.length > 0) engine?.grantCards(cards)
}

/** 推进到下一个未完成任务并播上半台词（已播过/已完成的自动跳过；空 before 的任务直接等待操作） */
function advanceQuestFlow() {
  const q = currentQuest.value
  if (!q) return
  if (introShownMap.value[q.id]) return
  introShownMap.value[q.id] = true
  if (q.before.length === 0) return
  if (q.id === 'q_stockpile') {
    // 囤粮：听完上半台词即完成（不校验饱食，防软锁）
    showDialog(q.before, () => completeQuest(q))
    return
  }
  showDialog(q.before)
}

function completeQuest(q: QuestDef) {
  if (questDoneMap.value[q.id]) return
  questDoneMap.value[q.id] = true
  const finish = () => {
    grantQuestReward(q)
    // 奖励飞入场后留约 1 秒缓冲，再接下一条上半台词
    window.setTimeout(() => advanceQuestFlow(), 900)
  }
  if (q.after && q.after.length > 0) {
    showDialog(q.after, finish)
  } else {
    finish()
  }
}

/** 引擎事件总线入口：任务进度推进 + 年末剧情挂载 */
function handleQuestEvent(event: string, data?: string) {
  // 上半·十任务（允许乱序完成：事件匹配即结算，防止玩家提前操作导致卡任务）
  for (const q of UPPER_QUESTS) {
    if (questDoneMap.value[q.id]) continue
    if (q.match.event === event && (!q.match.data || q.match.data === data)) {
      completeQuest(q)
      break
    }
  }

  // 下半·年末引导②：喂食演示结束 → 发放两张主意卡 + 尸体讲解 → 库存 → 腐化 → 告别 → 指挥官
  if (event === 'feeding_done' && store.month === 1 && !corpseStoryShown.value) {
    corpseStoryShown.value = true
    engine?.grantCards([
      { cardId: 'idea_cremate_corpse', count: 1 },
      { cardId: 'idea_cook_corpse_starch', count: 1 }
    ])
    const stockLines = isSlotOver.value ? DIALOGS.stockOver : DIALOGS.stockSafe
    showDialog(DIALOGS.corpse, () => {
      showDialog(stockLines, () => {
        showDialog(DIALOGS.corruption, () => {
          showDialog(DIALOGS.farewell, () => {
            showDialog(DIALOGS.commanderFinal)
          })
        })
      })
    })
  }

  // 下半奖励：进入第 2 星际年 → 发放基因种子 + 指挥官赠言
  if (event === 'year_started' && data === '2' && !seedGranted.value) {
    seedGranted.value = true
    engine?.grantCards([{ cardId: 'gene_seed', count: 1 }])
    showDialog(DIALOGS.seed)
  }
}

/** 开局/重开统一入口：宽限 + 开场白 → 发新手包 → 任务链 */
function startWelcomeFlow() {
  if (!engine) return
  // [新手引导改版] 时间闸门已删除：年份计时从拆包起正常推进，任务纯指导（一号裁定 2026-09-15）
  showDialog(DIALOGS.welcome, () => {
    engine?.grantStarterPack()
    advanceQuestFlow()
  })
}

function togglePause() {
  // 对话框存活期间禁用暂停按钮（防 userAction 暂停误触发"喘口气"任务）
  if (hasActiveDialog()) return
  engine?.togglePaused()
}

/** 暂停遮罩【继续游戏】：仅非结算态可恢复 */
function resumeGame() {
  if (settlementReport.value) return
  engine?.setPaused(false)
}

/** ESC 统一入口：先退全屏（若在），再暂停并弹出暂停遮罩（退出大厅改由遮罩按钮触发，防误触） */
async function handleEsc() {
  if (isFullscreen.value) {
    try {
      await (window as any).electron?.window?.exitFullScreen?.()
    } catch (e) {}
    isFullscreen.value = false
    setTimeout(() => { resizeHandler() }, 60)
  }
  engine?.setPaused(true, true)
}

function toggleBgm() {
  if (!bgmAudio) return
  isMuted.value = !isMuted.value
  if (isMuted.value) {
    bgmAudio.pause()
  } else if (!victoryRoute.value) {
    // batch56：胜利结算界面保持安静——取消静音不再漏播日常 BGM
    bgmAudio.play().catch(() => {})
  }
}

function confirmNextMonth() {
  if (engine?.confirmNextMonth()) {
    settlementReport.value = null
  }
}

/** 向导①：点击开饭，触发食物飞行投喂动画 */
function startFeeding() {
  // batch64：按钮状态以引擎实态为准（自动开饭/重复点击/对话框拦截均不失步）
  feedingStarted.value = engine?.startFeeding() ?? false
}

/** 向导②：抗税惩罚手动知悉 */
function acknowledgeTaxNotice() {
  engine?.acknowledgeTaxNotice()
}

/** 向导③：库存超上限知悉，点击进入实际卖卡阶段 */
function acknowledgeClearance() {
  engine?.acknowledgeClearance()
}

function getTaxTypeName(t: TaxType): string {
  if (t === 'gold') return '什一黄金'
  if (t === 'population') return '征调壮丁'
  return '基因种子'
}

function getDoubleTaxDesc(): string {
  if (store.taxType === 'gold') return `50 金币`
  if (store.taxType === 'population') return `3 名成年壮丁`
  return `${store.taxReq} 颗基因种子`
}

function onStartDoubleTax() {
  doubleTaxActionMsg.value = ''
  if (store.taxType === 'population') {
    selectedPopUids.value = []
    isPopSelecting.value = true
    return
  }
  if (!engine) return
  const res = engine.handleDoubleTax()
  if (!res.success) {
    doubleTaxActionMsg.value = res.msg
  }
}

function toggleSelectUnit(uid: number) {
  const idx = selectedPopUids.value.indexOf(uid)
  if (idx >= 0) {
    selectedPopUids.value.splice(idx, 1)
  } else {
    if (selectedPopUids.value.length < 3) {
      selectedPopUids.value.push(uid)
    }
  }
}

function submitDoubleTaxPopulation() {
  doubleTaxActionMsg.value = ''
  if (!engine) return
  const res = engine.handleDoubleTax(selectedPopUids.value)
  if (res.success) {
    isPopSelecting.value = false
    selectedPopUids.value = []
  } else {
    doubleTaxActionMsg.value = res.msg
  }
}

function onCancelDoubleTax() {
  isPopSelecting.value = false
  selectedPopUids.value = []
  engine?.cancelDoubleTax()
}

function toggleGroup(group: string) {
  expandedGroups.value[group] = !expandedGroups.value[group]
}

function isRecipeUnlocked(recipeId: string): boolean {
  return unlockedSet.value.has(recipeId)
}

function getMatName(cardId: string, recipe?: RecipeDef | null): string {
  if (cardId === 'civilian') return '人口'
  // batch18：遗体限定配方投入栏如实显示"阿斯塔特尸体"，杜绝误导
  if (cardId === 'corpse' && recipe?.requiredOrigin === 'astartes') return '阿斯塔特尸体'
  try {
    return getDef(cardId).name
  } catch {
    return cardId
  }
}

/** batch61：anyInputs 组中文标签三分支——全劳动力→人口；全建筑→工位；其余→实际选项名单（不再出现"指定单位"糊话）；远征→探索者 */
function getAnyInputLabel(recipe: RecipeDef, group: { options: string[]; count: number }): string {
  if (recipe.id.startsWith('explore_')) return `任意探索者 × ${group.count}`
  try {
    const allLabor = group.options.every(o => !!getDef(o).isLabor)
    if (allLabor) {
      const label = group.options.length === 6 ? '人口（任意成年单位）' : group.options.map(o => getDef(o).name).join(' / ')
      return `${label} × ${group.count}`
    }
    const allBuilding = group.options.every(o => getDef(o).category === 'building')
    if (allBuilding) {
      return `工位（${group.options.map(o => getDef(o).name).join(' / ')}） × ${group.count}`
    }
    return `任意（${group.options.map(o => getDef(o).name).join(' / ')}） × ${group.count}`
  } catch {}
  return `指定材料 × ${group.count}`
}

function getCategoryLabel(cat: string): string {
  const map: Record<string, string> = {
    unit: '人口单位',
    resource_point: '资源点位',
    material: '材料',
    food: '食物',
    building: '建筑设施',
    equipment: '武器装备',
    location: '探索地点',
    medical: '医疗用品',
    idea: '科技蓝图'
  }
  return map[cat] || cat
}

function getDmgTypeLabel(t?: DamageType): string {
  if (t === 'magic') return '法术'
  if (t === 'true') return '真实'
  return '物理'
}

/** 选中/取消选中主意配方（再次点击同一配方取消）；悬停卡牌优先展示，移开后左下角回显选中配方（方案A） */
function selectRecipe(r: RecipeDef) {
  if (selectedRecipe.value?.id === r.id) {
    selectedRecipe.value = null
    return
  }
  selectedRecipe.value = r
}

/** 获取选中配方产物的中文功能说明 (问题 10) */
function getRecipeOutputDesc(recipe: RecipeDef): string {
  if (!isRecipeUnlocked(recipe.id)) return ''
  for (const outCardId of Object.keys(recipe.outputs)) {
    try {
      const d = getDef(outCardId)
      if (d.desc) return d.desc
    } catch {}
  }
  return ''
}

/** 侧边栏“主意”全量过滤与归类重构 (问题 9) */
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const groups: Record<string, RecipeDef[]> = {
    '基础与材料': [],
    '建筑设施': [],
    '武器装备': [],
    '食品烹饪': [],
    '特殊转化': [],
    '特殊互动': []
  }

  // 移出主意栏的远征与无限工位引导类配方（问题 9 要求）
  const HIDDEN_RECIPE_IDS = new Set([
    'explore_alien_forest',
    'explore_battlefield',
    'explore_mothership',
    'explore_pipes',
    'produce_scrap',
    'produce_stone',
    'produce_titanium',
    // batch35：农田版种植配方藏入隐藏清单——百科只显示一条「种植」（文案由负责人后期润色）
    'grow_crop_farmland'
  ])

  // 明确归属于武器与装备锻造的配方集合（问题 8 & 9 要求）
  const GEAR_RECIPE_IDS = new Set([
    'craft_scrap_club',
    'craft_void_suit',
    'craft_laser_rifle',
    'craft_execution_blade',
    'craft_diagnostor',
    'craft_assassin_gear',
    'craft_power_armor'
  ])

  for (const r of RECIPES) {
    if (r.consumeSource) continue
    if (HIDDEN_RECIPE_IDS.has(r.id)) continue

    let grp = '特殊互动'

    if (GEAR_RECIPE_IDS.has(r.id)) {
      grp = '武器装备'
    } else if (r.id.startsWith('build_')) {
      grp = '建筑设施'
    } else if (r.id.startsWith('cook_')) {
      grp = '食品烹饪'
    } else if (
      r.id.startsWith('promote_') ||
      r.id === 'transform_astartes' ||
      r.id === 'breed_baby' ||
      r.id === 'clone_gene_seed' ||
      r.id === 'salvage_astartes' ||
      r.id === 'harvest_gene_seed' ||
      r.id === 'cremate_corpse' ||
      r.id === 'make_pipes'
    ) {
      grp = '特殊转化'
    } else if (
      r.id.startsWith('craft_') ||
      r.id.startsWith('smelt_') ||
      r.id.startsWith('factory_') ||
      r.id.startsWith('grow_')
    ) {
      grp = '基础与材料'
    }

    if (q) {
      const matchName = r.name.toLowerCase().includes(q)
      const matchInputs = Object.keys(r.inputs).some(k => getMatName(k).toLowerCase().includes(q))
      if (!matchName && !matchInputs) continue
    }

    if (groups[grp]) {
      groups[grp].push(r)
    }
  }

  return groups
})

async function toggleFullscreen(e?: MouseEvent) {
  e?.stopPropagation()
  try {
    if ((window as any).electron?.window?.toggleFullScreen) {
      await (window as any).electron.window.toggleFullScreen()
    }
  } catch (err) {
    console.warn('[badab] toggleFullScreen error:', err)
  }
  isFullscreen.value = !isFullscreen.value
  setTimeout(() => { resizeHandler() }, 60)
}

function restart() {
  // batch55：重开对局 → 日常 BGM 恢复（胜利/败北时曾被强制静音）
  if (bgmAudio && !isMuted.value) bgmAudio.play().catch(() => {})
  showDefeat.value = false
  settlementReport.value = null
  victoryRoute.value = null
  victoryText.value = ''
  doubleTaxActionMsg.value = ''
  isPopSelecting.value = false
  selectedPopUids.value = []
  // 【新手引导】任务与剧情状态一并复位（否则重开后任务全灰、剧情不再触发）
  questDoneMap.value = {}
  introShownMap.value = {}
  foodStoryShown.value = false
  corpseStoryShown.value = false
  seedGranted.value = false
  graceActive = false
  // batch18：连队列表格一并清空，防重开后弹出旧对话
  dialogQueue.length = 0
  dialogLines.value = null
  currentDialogOnDone = undefined
  dialogPausedByUs = false
  engine?.deleteSave()
  engine?.reset()
  // batch54：重开同样先过前言页，再重播开场白（结束时重新发新手包，不会软锁）
  openLore(() => startWelcomeFlow())
}

const resizeHandler = () => {
  if (!pixiContainer.value || !engine) return
  const p = pixiContainer.value.parentElement
  if (!p) return
  engine.updateDimensions(p.clientWidth, p.clientHeight)
}

function onMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target && target.closest('button, input, .badab-sidebar-scroll')) return
  engine?.handleMouseDown(e)
}

function onMouseUp(e: MouseEvent) { engine?.handleMouseUp(e) }
function onMouseMove(e: MouseEvent) { engine?.handleMouseMove(e) }

function onWheel(e: WheelEvent) {
  const target = e.target as HTMLElement
  if (target && target.closest('.badab-sidebar-scroll')) return
  e.preventDefault()
  engine?.handleWheel(e)
}

function onKeyDown(e: KeyboardEvent) {
  // 【新手引导】对话框存活期间仅放行 F11（全屏）与 M（音乐），其余按键由对话框组件接管
  if (hasActiveDialog()) {
    if (e.code === 'F11') {
      e.preventDefault()
      toggleFullscreen()
    } else if (e.code === 'KeyM') {
      toggleBgm()
    }
    return
  }
  if (e.code === 'Escape') {
    e.preventDefault()
    // batch19：通关媒体覆盖层存活时 ESC 优先关闭媒体
    if (showVictoryMedia.value) { stopVictoryMedia(); return }
    handleEsc()
    return
  }
  if (e.code === 'F11') {
    e.preventDefault()
    toggleFullscreen()
    return
  }
  if (e.code === 'KeyP') {
    engine?.togglePaused()
    return
  }
  if (e.code === 'KeyM') {
    toggleBgm()
    return
  }
  if (e.code === 'Space') {
    if (settlementReport.value && settlementPhase.value === 'confirm' && !isSlotOver.value && !store.showDoubleTaxPrompt) {
      e.preventDefault()
      confirmNextMonth()
    }
  }
}

function onWindowBlur() {
  if (bgmAudio && !isMuted.value) bgmAudio.pause()
}

function onWindowFocus() {
  // batch57：结算态守卫——播放CG/胜利界面时窗口切回不复活日常BGM（播放CG仍听到BGM的根因）
  if (bgmAudio && !isMuted.value && !victoryRoute.value) bgmAudio.play().catch(() => {})
}

async function exitToLobby() {
  // batch18：尚未开局或已终局（胜利/败北）时不写档——避免重建已删除的终局存档/空档软锁
  if (engine && engine.gameStarted && !engine.isGameOver()) {
    try { engine.saveGame() } catch (e) {}
  }
  if (isFullscreen.value) {
    try {
      await (window as any).electron?.window?.exitFullScreen?.()
    } catch (e) {}
    isFullscreen.value = false
  }
  emit('exit')
}

onMounted(async () => {
  store.$reset()
  sessionStartPerf = performance.now()
  if (!pixiContainer.value) return

  try {
    if ((window as any).electron?.window?.isFullScreen) {
      const fsState = await (window as any).electron.window.isFullScreen()
      isFullscreen.value = !!fsState
    }
  } catch (e) {}

  try {
    bgmAudio = new Audio(bgmSrc)
    bgmAudio.loop = true
    bgmAudio.volume = 0.45
    const playPromise = bgmAudio.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const onFirstInteract = () => {
          // batch57：结算态守卫（同聚焦出口）
          if (bgmAudio && !isMuted.value && !victoryRoute.value) bgmAudio.play().catch(() => {})
          window.removeEventListener('click', onFirstInteract)
          window.removeEventListener('keydown', onFirstInteract)
        }
        window.addEventListener('click', onFirstInteract)
        window.addEventListener('keydown', onFirstInteract)
      })
    }
  } catch (err) {
    console.warn('[badab] BGM 初始化失败:', err)
  }

  engine = new BadabEngine(pixiContainer.value)
  // batch25：引擎创建即同步主意镜像——此前组件重建后 unlockedSet 只有默认8个，主菜单「重新开始」会丢失已解锁主意的显示
  unlockedSet.value = new Set(engine.unlockedRecipes)
  // batch14：注册 Vue 侧附加状态提供者——任务链状态随每次存档（手动/年末/退出）持久化
  engine.setSaveExtraProvider(() => ({
    questDoneMap: { ...questDoneMap.value },
    introShownMap: { ...introShownMap.value },
    foodStoryShown: foodStoryShown.value,
    corpseStoryShown: corpseStoryShown.value,
    seedGranted: seedGranted.value
  }))
  engine.onGameOver = () => {
    showDefeat.value = true
    // batch14：败北即对局终结，清 run 存档（配方元进度保留）
    engine?.deleteSave()
  }
  engine.onCardHover = (c, entity) => {
    hoveredCard.value = c
    hoveredEntity.value = entity || null
  }
  engine.onUnlockRecipe = (recId) => {
    unlockedSet.value.add(recId)
    hasNewUnlock.value = true
  }

  // 【新手引导】任务系统事件总线：任务推进 + 年末剧情挂载 + 进二年发种子
  engine.onQuestEvent = (event, data) => handleQuestEvent(event, data)

  engine.onSettlementStart = (report) => {
    settlementReport.value = report
    feedingStarted.value = false
    // 下半·年末引导①：第一年先播税务官结算日开场，说完自动开饭
    if (store.month === 1 && !foodStoryShown.value) {
      foodStoryShown.value = true
      // batch18：对话框队列制——任务台词播完自动接续年末剧情，prevCb 补丁删除
      showDialog(DIALOGS.settlementFood, () => startFeeding())
    }
  }
  engine.onSettlementEnd = () => { settlementReport.value = null }
  engine.onSettlementPhase = (phase) => {
    settlementPhase.value = phase
  }
  Object.defineProperty(engineTaxNoticePending, 'value', {
    get: () => !!(engine && (engine as any).taxNoticePending)
  })

  engine.onError = (msg) => {
    engineErrors.value = [...engineErrors.value.slice(-2), msg]
  }
  // batch54：新周期开始演出接线（修女警觉走对话队列 → 大魔低语浮层；收税提醒 4 档全弹）
  engine.onDemonWhisper = (band) => showDemonWhisper(band)
  engine.onSisterWarn = () => showDialog(SISTER_WARN)
  engine.onTaxReminder = (band) => showDialog(TAX_REMINDS[band] || TAX_REMINDS[0])
  engine.onVictory = async (route, text, elapsedSec, starYear) => {
    victoryRoute.value = route
    victoryText.value = text
    // batch55：结算界面出现即强制静音日常 BGM（引擎已暂停游戏本体；此前要等玩家点通关媒体才停）
    if (bgmAudio) bgmAudio.pause()
    // batch14：胜利即对局终结，清 run 存档（配方元进度保留）
    engine?.deleteSave()
    // 触发通关天卡特权激励核验与充值
    await handleClaimVictoryReward(route, elapsedSec, starYear)
  }

  // batch16：腐化线提醒——税务官预警 → 修女誓言 → 对话结束修女叛变、旗舰推迟至下个星际年
  engine.onCorruptionDialog = () => {
    showDialog(DIALOGS.corruptionWarn, () => {
      // batch54：大魔馈赠对话插在税务官预警与修女誓言之间（立绘 demon_normal.png，缺失自动降级徽章）
      showDialog(DEMON_GIFT, () => {
        showDialog(DIALOGS.corruptionSister, () => {
          engine?.combatCorruptionPurge()
        })
      })
    })
  }

  engine.onCameraChange = (trans) => {
    cameraTransform.value = trans
  }

  await engine.init()
  resizeHandler()

  resizeObserver = new ResizeObserver(() => { resizeHandler() })
  resizeObserver.observe(pixiContainer.value)

  window.addEventListener('resize', resizeHandler)
  window.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('blur', onWindowBlur)
  window.addEventListener('focus', onWindowFocus)

  // batch14：改为启动菜单（继续游戏/重新开始含跳过引导子选择/退出），由玩家选择后进入对应流程
  hasExistingSave.value = engine ? engine.hasSave() : false
  showStartMenu.value = true
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  if (sessionStartPerf > 0) {
    const elapsedSec = Math.round((performance.now() - sessionStartPerf) / 1000)
    sessionStartPerf = 0
    if (elapsedSec > 0 && elapsedSec < 7200) {
      telemetry.trackLobbyEvent('lobby_minigame_playtime', { game: 'badab', duration_sec: elapsedSec, ts: Date.now() })
      telemetry.flushNow()
    }
  }

  resizeObserver = null

  if (bgmAudio) {
    bgmAudio.pause()
    bgmAudio.src = ''
    bgmAudio = null
  }

  if (isFullscreen.value) {
    try {
      (window as any).electron?.window?.exitFullScreen?.()
    } catch (e) {}
    isFullscreen.value = false
  }

  window.removeEventListener('resize', resizeHandler)
  window.removeEventListener('mousedown', onMouseDown)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('wheel', onWheel)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('blur', onWindowBlur)
  window.removeEventListener('focus', onWindowFocus)

  stopVictoryMedia()
  if (videoRef.value) {
    try {
      videoRef.value.pause()
      videoRef.value.src = ''
      videoRef.value.load()
    } catch {}
  }
  engine?.destroy()
  engine = null
})
</script>

<style scoped>
.font-badab-pc {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.slide-sidebar-enter-active,
.slide-sidebar-leave-active {
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
}
.slide-sidebar-enter-from,
.slide-sidebar-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.pop-down-enter-active,
.pop-down-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.pop-down-enter-from,
.pop-down-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.96);
}
</style>