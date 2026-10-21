<template>
  <div 
    class="relative w-full h-full bg-[#070913] text-white font-sans overflow-hidden select-none flex flex-col justify-between"
    tabindex="0"
    ref="containerRef"
    @keydown="onKeyDown"
    @keyup="onKeyUp"
  >
    <!-- ==================== 1. 全屏沉浸动态舞台背景视频 (静音纯视效) ==================== -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden">
      <!-- 场景 A：主舞台背景 (bg_stage.mp4) -->
      <video
        ref="videoAEl"
        :src="videoAUrl"
        autoplay
        loop
        muted
        playsinline
        class="absolute inset-0 w-full h-full object-cover transition-all duration-700 pointer-events-none"
        :class="toneMode === 'rock_distortion' ? 'opacity-35 scale-105' : 'opacity-70 scale-100'"
      ></video>

      <!-- 场景 B：摇滚过载都市背景 (bg_city.mp4) -->
      <video
        ref="videoBEl"
        :src="videoBUrl"
        autoplay
        loop
        muted
        playsinline
        class="absolute inset-0 w-full h-full object-cover transition-all duration-500 mix-blend-screen pointer-events-none"
        :class="toneMode === 'rock_distortion' ? 'opacity-85 scale-100' : 'opacity-0 scale-110'"
      ></video>

      <!-- 赛博暗角与细微扫描线 -->
      <div class="absolute inset-0 crt-overlay pointer-events-none"></div>

      <!-- 动态氛围呼吸霓虹光边 -->
      <div 
        class="absolute inset-0 pointer-events-none transition-all duration-200"
        :style="{
          boxShadow: toneMode === 'rock_distortion'
            ? 'inset 0 0 80px rgba(244, 63, 94, 0.45), inset 0 0 30px rgba(251, 191, 36, 0.35)'
            : 'inset 0 0 50px rgba(56, 189, 248, 0.25)'
        }"
      ></div>
    </div>

    <!-- ==================== 0. 游戏开始主界面 (Start Menu) ==================== -->
    <transition name="fade">
      <div 
        v-if="screen === 'menu'"
        class="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
      >
        <div class="max-w-xl w-full bg-slate-900/95 border border-cyan-500/40 rounded-3xl p-8 sm:p-10 shadow-[0_0_80px_rgba(6,182,212,0.25)] flex flex-col items-center text-center relative overflow-hidden">
          <!-- 顶部霓虹跑马灯 -->
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500"></div>

          <!-- 徽章标签 -->
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 text-xs font-mono font-bold mb-4 tracking-widest">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            LIVE REMIX · SCALE-LOCKED WORKSTATION
          </div>

          <!-- 主标题 -->
          <h1 class="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-pink-400 to-amber-300 tracking-wider mb-2 drop-shadow-[0_0_20px_rgba(6,182,212,0.6)] font-sans">
            {{ hasPlayedOnce ? '创作暂停 · 额度兑换' : '电音少女' }}
          </h1>
          <div class="text-xs font-mono text-slate-400 tracking-widest mb-5 uppercase">
            {{ hasPlayedOnce ? 'SESSION PAUSED & QUOTA REDEMPTION' : 'CYBER GUITAR & LIVE REMIX STATION' }}
          </div>

          <!-- 模式 A：初次进入（玩法指南引导） -->
          <p v-if="!hasPlayedOnce" class="text-sm text-slate-300 leading-relaxed mb-8 max-w-md">
            你是自由的制作人与电音 DJ！键盘已锁定五声音阶，
            <span class="text-cyan-300 font-bold">闭着眼睛按也绝不走音</span>！
            敲击 
            <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-xs">Q</kbd>
            <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-xs">W</kbd>
            <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-xs">E</kbd>
            <kbd class="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-xs">R</kbd>
            触发多节拍 Riff，配合鼓点与空格爆发扫弦，随时创作专属神曲！
          </p>

          <!-- 模式 B：游戏中暂停（即兴战绩与直接兑换额度面板） -->
          <div v-else class="w-full mb-6">
            <!-- 战绩总览卡片 -->
            <div class="p-4 rounded-2xl bg-slate-950/70 border border-cyan-500/30 mb-4 text-left">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-slate-400 font-mono">CURRENT REMIX SCORE</span>
                <span class="text-xs font-bold text-cyan-300 font-mono">10,000 积分 = 1 配额 (每日上限 3 次)</span>
              </div>
              <div class="flex items-baseline justify-between">
                <div class="text-3xl font-black text-amber-300 font-mono">
                  ⭐ {{ sessionScore.toLocaleString() }}
                  <span class="text-xs font-normal text-slate-400 ml-1">分</span>
                </div>
                <div class="text-sm font-bold font-mono" :class="canRedeemCount > 0 ? 'text-amber-400' : 'text-slate-400'">
                  可兑换: <span class="text-xl font-black">{{ canRedeemCount }}</span> / 3 个额度
                  <span v-if="isDailyLimitReached" class="text-[11px] text-rose-400 block font-normal">(今日兑换已达上限)</span>
                  <span v-else-if="rawCanRedeem > remainingDailyQuota" class="text-[11px] text-amber-400/80 block font-normal">(已达单日上限)</span>
                </div>
              </div>

              <!-- 今日兑换已达上限状态 -->
              <div v-if="isDailyLimitReached" class="mt-4 pt-3 border-t border-slate-800">
                <button
                  disabled
                  class="w-full py-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-slate-400 font-bold text-sm tracking-widest flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                >
                  <span>🛑</span>
                  <span>今日配额兑换已达上限 (3/3)</span>
                </button>
                <div class="mt-2 text-[11px] text-slate-400 font-mono text-center">
                  * 今日云端特权配额已全部兑换完毕，当前积分已为您安全保留
                </div>
              </div>

              <!-- 积分满 10000 触发高亮直兑区 -->
              <div v-else-if="canRedeemCount > 0" class="mt-4 pt-3 border-t border-slate-800">
                <button
                  @click="redeemFromGame"
                  :disabled="isRedeeming"
                  class="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm tracking-widest shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="isRedeeming" class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>
                  <span v-else>⚡</span>
                  <span>{{ isRedeeming ? '正在连线兑换中...' : `立即直兑 ${canRedeemCount} 个额度配额 (消耗 ${(canRedeemCount * 10000).toLocaleString()} 积分)` }}</span>
                </button>
                <div class="mt-2 text-[11px] text-slate-400 font-mono text-center">
                  * 云端特权配额每日最高可兑换 3 次，多余积分仍将安全保留在当前分数中
                </div>
              </div>

              <!-- 积分未满 10000 呈现进度条 -->
              <div v-else class="mt-3">
                <div class="flex justify-between text-[11px] text-slate-400 mb-1">
                  <span>距离下一个额度配额</span>
                  <span>还需 {{ (10000 - (sessionScore % 10000)).toLocaleString() }} 积分</span>
                </div>
                <div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-300"
                    :style="{ width: `${Math.min(100, ((sessionScore % 10000) / 10000) * 100)}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- 兑换反馈提示 -->
            <transition name="fade">
              <div 
                v-if="redeemStatusMsg"
                class="mb-3 px-3.5 py-2 rounded-xl text-xs font-bold font-mono text-center"
                :class="redeemStatusType === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' 
                  : 'bg-red-500/20 text-red-300 border border-red-400/40'"
              >
                {{ redeemStatusMsg }}
              </div>
            </transition>
          </div>

          <!-- 核心按钮组 -->
          <div class="flex flex-col gap-3 w-full max-w-xs">
            <button
              @click="startGame"
              class="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-white font-black text-base tracking-widest shadow-lg shadow-cyan-500/30 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🎸</span>
              <span>{{ hasPlayedOnce ? '继续演奏 (RESUME)' : '开始演奏 (START)' }}</span>
            </button>

            <button
              @click="showGuideModal = true"
              class="w-full py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 hover:border-cyan-400/60 text-slate-200 text-sm font-bold tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>📖</span>
              <span>键位与演奏指南</span>
            </button>

            <button
              @click="exitGame"
              class="w-full py-2.5 rounded-2xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold tracking-wider transition-all cursor-pointer"
            >
              {{ hasPlayedOnce ? '💾 结算积分并退出大厅' : '✕ 退出到大厅' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ==================== 0.1 键位与演奏指南弹窗 ==================== -->
    <transition name="fade">
      <div 
        v-if="showGuideModal"
        class="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/85 backdrop-blur-lg pointer-events-auto"
        @click.self="showGuideModal = false"
      >
        <div class="max-w-2xl w-full bg-slate-900 border border-cyan-400/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_rgba(6,182,212,0.3)] text-left relative overflow-hidden">
          <div class="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div class="flex items-center gap-3">
              <span class="text-2xl">📖</span>
              <div>
                <h3 class="text-lg font-black text-white">电音少女 · 键位与玩法指南</h3>
                <p class="text-xs text-slate-400 font-mono">LIVE REMIX PERFORMANCE CONTROLS</p>
              </div>
            </div>
            <button 
              @click="showGuideModal = false"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>

          <div class="space-y-4 text-xs sm:text-sm text-slate-300">
            <!-- 和弦区 -->
            <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div class="font-bold text-cyan-300 mb-1.5 flex items-center gap-2">
                <span>🎵 智能多节拍和弦 (左手核心)</span>
                <span class="text-[10px] font-normal text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">+500 积分</span>
              </div>
              <div class="grid grid-cols-4 gap-2 font-mono text-center mb-1.5">
                <div class="p-1.5 rounded bg-slate-900 border border-cyan-400/40 text-cyan-300 font-bold">[ Q ] 主和弦</div>
                <div class="p-1.5 rounded bg-slate-900 border border-indigo-400/40 text-indigo-300 font-bold">[ W ] 上扬和弦</div>
                <div class="p-1.5 rounded bg-slate-900 border border-purple-400/40 text-purple-300 font-bold">[ E ] 动力和弦</div>
                <div class="p-1.5 rounded bg-slate-900 border border-pink-400/40 text-pink-300 font-bold">[ R ] 抒情和弦</div>
              </div>
              <div class="text-[11px] text-slate-400">点一下触发整整 4 拍吉他 Riff 与分解琶音，永不走音，怎么组合都好听！</div>
            </div>

            <!-- 节奏与扫弦 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div class="font-bold text-amber-300 mb-1 flex items-center justify-between">
                  <span>⚡ 强力扫弦爆发</span>
                  <span class="text-[10px] font-normal text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">+1500 积分</span>
                </div>
                <div class="font-mono text-xs text-amber-200 mb-1">[ SPACE ] 或 [ ENTER ]</div>
                <div class="text-[11px] text-slate-400">从低音到高音极速扫弦，全和弦琶音轰鸣！</div>
              </div>

              <div class="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div class="font-bold text-pink-300 mb-1 flex items-center justify-between">
                  <span>🥁 电子鼓点打击</span>
                  <span class="text-[10px] font-normal text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">+200 积分</span>
                </div>
                <div class="font-mono text-xs text-pink-200 mb-1">[ A ] 底鼓 · [ S ] 军鼓 · [ D ] 踩镲 · [ F ] 通鼓</div>
                <div class="text-[11px] text-slate-400">随时自由插鼓，自动与背景 BPM 完美贴合。</div>
              </div>
            </div>

            <!-- 鼠标与快捷键 -->
            <div class="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1.5">
              <div>🖱️ <b class="text-white">鼠标玩法</b>：划过琴弦即可发声（+100分）；拖动鼓垫可调整舞台位置；点击空白处发射弹跳能量球（最多3颗）。</div>
              <div>⌨️ <b class="text-white">全局快捷键</b>：<kbd class="px-1 rounded bg-slate-800 border border-slate-700 text-slate-300">T</kbd> 切换空灵原声/摇滚失真音色 · <kbd class="px-1 rounded bg-slate-800 border border-slate-700 text-slate-300">B</kbd> 开关智能伴奏鼓点 · <kbd class="px-1 rounded bg-slate-800 border border-slate-700 text-slate-300">TAB</kbd> 切换官方母带风格 · <kbd class="px-1 rounded bg-slate-800 border border-slate-700 text-slate-300">ESC</kbd> 呼出菜单。</div>
              <div>⭐ <b class="text-amber-300">积分兑换</b>：弹奏自动累加积分，每 10,000 积分退出自动折算 1 个 TitanCore 额度配额！</div>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              @click="showGuideModal = false"
              class="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs tracking-wider transition-all"
            >
              我知道了，开始创作！
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ==================== 2. 核心 60FPS 动力学声学物理 Canvas 画布 ==================== -->
    <canvas
      ref="canvasRef"
      @mousedown="onCanvasMouseDown"
      @mousemove="onCanvasMouseMove"
      @mouseup="onCanvasMouseUp"
      @contextmenu.prevent
      class="absolute inset-0 w-full h-full z-10 cursor-crosshair"
    ></canvas>

    <!-- ==================== 3. 顶部 HUD 控制栏 (编曲风格、伴奏鼓机、音色、系统) ==================== -->
    <header class="relative z-30 flex items-center justify-between gap-4 px-8 py-5 pointer-events-none">
      
      <!-- 左栏：3 套官方母带编曲风格卡片 (参考项目根目录 6 首 MP3) -->
      <div class="pointer-events-auto flex items-center gap-2.5">
        <div class="flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          <button
            v-for="(style, idx) in SMART_STYLES"
            :key="style.id"
            @click="selectStyle(idx)"
            class="cyber-btn px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2.5"
            :class="currentStyleIdx === idx
              ? 'bg-cyan-500/30 border border-cyan-300 text-white shadow-lg shadow-cyan-500/30 ring-1 ring-cyan-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'"
          >
            <span class="text-base">{{ idx === 0 ? '🌿' : idx === 1 ? '🎸' : '✨' }}</span>
            <div class="text-left leading-tight">
              <div>{{ style.name.split(' ')[0] }}</div>
              <div class="text-[9px] font-mono text-slate-400 opacity-80">{{ style.bpm }} BPM</div>
            </div>
          </button>
        </div>

        <!-- 智能伴奏鼓机 (Auto-Drum Beat) 开关 -->
        <button
          @click="toggleDrumAccompaniment"
          class="cyber-btn px-4 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-2.5 shadow-xl transition-all"
          :class="isDrumLoopActive
            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/40 animate-pulse'
            : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'"
          title="快捷键 [B] 开启/暂停智能鼓点伴奏"
        >
          <span class="text-base">{{ isDrumLoopActive ? '🥁' : '⏸️' }}</span>
          <div class="text-left leading-tight">
            <div class="text-[9px] opacity-75 font-mono">DRUM BEAT [B]</div>
            <div>{{ isDrumLoopActive ? '伴奏中 · 节拍已咬合' : '启动智能鼓点伴奏' }}</div>
          </div>
        </button>
      </div>

      <!-- 中栏：音色切换与物理小球控制器 -->
      <div class="pointer-events-auto flex items-center gap-3">
        <!-- 音色双模式大开关 (空灵极光 ⇋ 摇滚失真) -->
        <button
          @click="toggleToneMode"
          class="cyber-btn px-4 py-2 rounded-2xl border text-xs font-black flex items-center gap-2.5 shadow-xl transition-all"
          :class="toneMode === 'rock_distortion'
            ? 'bg-gradient-to-r from-rose-600/40 via-red-500/30 to-amber-500/40 border-rose-400 text-rose-200 shadow-rose-500/40 ring-1 ring-rose-400'
            : 'bg-cyan-500/25 border-cyan-300 text-cyan-200 shadow-cyan-500/30 ring-1 ring-cyan-400'"
          title="快捷键 [T] 切换音色"
        >
          <span class="text-base">{{ toneMode === 'rock_distortion' ? '🎸' : '🌿' }}</span>
          <div class="text-left leading-tight">
            <div class="text-[9px] opacity-75 font-mono">TONE [T]</div>
            <div class="text-xs font-black">{{ toneMode === 'rock_distortion' ? '摇滚失真电吉他' : '空灵极光原声' }}</div>
          </div>
        </button>

        <!-- 物理能量球与清屏 -->
        <div class="flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          <button
            @click="spawnManualOrb"
            class="cyber-btn px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-cyan-400 text-cyan-300 text-xs font-bold transition-all flex items-center gap-1 shadow"
            title="发射一颗能量弹珠 (最多 3 颗，绝不杂乱)"
          >
            <span>⚪</span>
            <span>+ 弹珠 ({{ orbs.length }}/3)</span>
          </button>
          <button
            v-if="orbs.length > 0"
            @click="clearOrbs"
            class="cyber-btn px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-red-400 text-slate-400 hover:text-red-300 text-xs font-bold transition-all"
            title="清空弹跳小球"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- 右栏：实时积分与系统控制 -->
      <div class="pointer-events-auto flex items-center gap-2.5">
        <!-- 实时创作积分显示牌 -->
        <div class="flex items-center gap-2 bg-slate-950/85 backdrop-blur-xl px-3.5 py-1.5 rounded-2xl border border-amber-500/40 shadow-xl">
          <span class="text-amber-400 text-sm">⭐</span>
          <div class="text-left leading-tight">
            <div class="text-[9px] font-mono text-amber-300/80">REMIX 创作积分</div>
            <div class="text-xs font-black text-amber-300 font-mono">
              {{ sessionScore }} <span class="text-[10px] font-normal text-slate-400">({{ Math.floor(sessionScore / 10000) }} 配额)</span>
            </div>
          </div>
        </div>

        <!-- 呼出主菜单按钮 -->
        <button
          @click="openMenu"
          class="cyber-btn px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-cyan-300 hover:border-cyan-400 text-xs font-bold shadow-md"
          title="快捷键 [ESC] 返回主菜单"
        >
          ⏸️ 菜单
        </button>

        <button
          @click="toggleFullscreen"
          class="cyber-btn px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold shadow-md"
        >
          {{ isFullscreen ? '🗗 还原' : '⛶ 全屏' }}
        </button>
        <button
          @click="exitGame"
          class="cyber-btn px-3.5 py-2 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 hover:bg-red-900 text-xs font-bold shadow-md"
        >
          ✕ 退出
        </button>
      </div>

    </header>

    <!-- ==================== 4. 底部智能多节拍和弦演奏台 (按一个键触发完整 4 拍吉他 Riff) ==================== -->
    <footer class="relative z-30 mb-5 px-8 flex justify-center pointer-events-auto">
      <div class="cyber-panel px-6 py-4 rounded-3xl flex items-center gap-4 border border-cyan-400/40 shadow-[0_12px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl max-w-6xl w-full">
        
        <!-- 4 块智能多节拍和弦演奏垫 (按 1/2/3/4 或点击触发多节拍 Riff) -->
        <div class="grid grid-cols-4 gap-3.5 flex-1">
          <div
            v-for="pad in currentStyle.pads"
            :key="pad.key"
            @mousedown="triggerSmartChord(pad)"
            class="cyber-pad cursor-pointer p-3.5 rounded-2xl border transition-all flex flex-col justify-between select-none relative overflow-hidden h-[96px]"
            :class="activeRiffKey === pad.key
              ? 'scale-95 ring-2 ring-white brightness-125'
              : 'bg-slate-900/90 hover:border-cyan-400/80 hover:bg-slate-800/90'"
            :style="{
              borderColor: activeRiffKey === pad.key ? '#ffffff' : `${pad.color}77`,
              boxShadow: activeRiffKey === pad.key ? `0 0 35px ${pad.color}` : 'none'
            }"
          >
            <!-- 激活时内部动态流水跑马灯 -->
            <div 
              v-if="activeRiffKey === pad.key"
              class="absolute inset-0 pointer-events-none opacity-25 bg-white transition-all duration-300"
            ></div>

            <!-- 顶部行：按键徽章 + 和弦级数角标 -->
            <div class="flex items-center justify-between w-full">
              <kbd 
                class="px-2.5 py-1 rounded-lg font-mono font-black text-base shadow border"
                :style="{
                  backgroundColor: activeRiffKey === pad.key ? '#ffffff' : 'rgba(15, 23, 42, 0.95)',
                  color: activeRiffKey === pad.key ? '#05070f' : pad.color,
                  borderColor: `${pad.color}99`
                }"
              >
                {{ pad.key }} 键
              </kbd>
              <span 
                class="text-[11px] font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700/80"
                :style="{ color: pad.color }"
              >
                {{ pad.roman }}
              </span>
            </div>

            <!-- 中部行：和弦名称与多节拍动效 -->
            <div class="flex items-center justify-between mt-1">
              <div class="text-left">
                <div class="text-sm font-black tracking-wide text-white drop-shadow">
                  {{ pad.name }}
                </div>
                <div class="text-[10px] text-slate-400 font-mono">
                  {{ pad.desc }}
                </div>
              </div>
              
              <!-- 4 拍律动指示灯 (显示这组 Riff 正在演奏的节拍) -->
              <div class="flex items-center gap-1">
                <span 
                  v-for="b in 4" 
                  :key="b"
                  class="w-1.5 h-3 rounded-sm transition-all duration-100"
                  :style="{
                    backgroundColor: pad.color,
                    opacity: activeRiffKey === pad.key && currentRiffBeat === (b - 1) ? 1 : 0.25,
                    transform: activeRiffKey === pad.key && currentRiffBeat === (b - 1) ? 'scaleY(1.4)' : 'scaleY(1.0)'
                  }"
                ></span>
              </div>
            </div>
          </div>
        </div>

        <!-- 狂暴扫弦爆发键 (SPACE / ENTER) -->
        <div 
          @mousedown="strumChord(1.2)"
          class="cyber-pad cursor-pointer p-3.5 rounded-2xl border transition-all flex flex-col justify-between select-none relative overflow-hidden min-w-[210px] h-[96px] bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-cyan-500/20 border-amber-400/80 text-amber-200 hover:border-amber-300 shadow-[0_0_25px_rgba(251,191,36,0.4)]"
        >
          <div class="flex items-center justify-between w-full">
            <kbd class="px-3 py-1 rounded-lg bg-slate-950 text-amber-300 font-mono font-black text-sm border border-amber-400/80 shadow">
              SPACE
            </kbd>
            <span class="text-[11px] font-mono font-black tracking-wider px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-amber-400/60">
              STRUM BURST
            </span>
          </div>

          <div class="flex items-center justify-between mt-1">
            <div class="text-left">
              <div class="text-sm font-black text-amber-200">
                强力爆发扫弦
              </div>
              <div class="text-[10px] font-mono text-amber-300/80">
                全和弦琶音轰鸣
              </div>
            </div>
            <span class="text-2xl animate-pulse">⚡</span>
          </div>
        </div>

      </div>
    </footer>

    <!-- 浮动提示 Toast -->
    <transition name="fade">
      <div 
        v-if="toastMessage"
        class="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-slate-900/95 border border-cyan-400 text-cyan-300 text-base font-black shadow-2xl pointer-events-none"
      >
        {{ toastMessage }}
      </div>
    </transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue';
import { miniGameAssetBase } from '../../../utils/minigameAssetBase';
import { 
  KineticAudioEngine, 
  GUITAR_TUNINGS, 
  type GuitarToneMode,
  type StringNote 
} from './CleanBeatInstrumentEngine';
import { 
  SMART_STYLES, 
  type StyleArrangement, 
  type SmartChordPad 
} from './smartChords';
import { useMiniGameStore } from '../../../stores/miniGameStore';
import { useTelemetryStore } from '../../../stores/telemetryStore';

const emit = defineEmits(['exit', 'update:stats']);
const miniGameStore = useMiniGameStore();
const telemetry = useTelemetryStore();
let sessionStartPerf = 0;
const sessionScore = computed(() => miniGameStore.sessionScore);

// ==================== 0. 开始界面与主菜单状态 ====================
const screen = ref<'menu' | 'playing'>('menu');
const hasPlayedOnce = ref(false);
const showGuideModal = ref(false);

function startGame() {
  screen.value = 'playing';
  hasPlayedOnce.value = true;
  showGuideModal.value = false;
  if (isDrumLoopActive.value) {
    restartDrumLoop();
  }
  nextTick(() => {
    containerRef.value?.focus();
  });
}

function openMenu() {
  screen.value = 'menu';
  stopDrumLoop();
  if (riffTimer) clearTimeout(riffTimer);
  activeRiffKey.value = null;
  redeemStatusMsg.value = '';
}

// ==================== 0.1 游戏内即时额度兑换 ====================
const DAILY_REDEEM_KEY = 'tc_daily_redeem_quota';
function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyRedeemState(): { count: number; exhausted: boolean } {
  try {
    const raw = localStorage.getItem(DAILY_REDEEM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.date === getTodayDateStr()) {
        return { count: Number(parsed.count) || 0, exhausted: !!parsed.exhausted };
      }
    }
  } catch {}
  return { count: 0, exhausted: false };
}

function saveDailyRedeemState(count: number, exhausted: boolean) {
  try {
    localStorage.setItem(DAILY_REDEEM_KEY, JSON.stringify({
      date: getTodayDateStr(),
      count,
      exhausted
    }));
  } catch {}
}

const isRedeeming = ref(false);
const redeemStatusMsg = ref('');
const redeemStatusType = ref<'success' | 'error' | ''>('');
const MAX_DAILY_REDEEM = 3;

const dailyRedeemInfo = ref(loadDailyRedeemState());
const isDailyLimitReached = computed(() => {
  return dailyRedeemInfo.value.exhausted || dailyRedeemInfo.value.count >= MAX_DAILY_REDEEM;
});

const remainingDailyQuota = computed(() => {
  if (isDailyLimitReached.value) return 0;
  return Math.max(0, MAX_DAILY_REDEEM - dailyRedeemInfo.value.count);
});

const rawCanRedeem = computed(() => Math.floor(sessionScore.value / 10000));
const canRedeemCount = computed(() => {
  return Math.min(remainingDailyQuota.value, rawCanRedeem.value);
});

async function redeemFromGame() {
  const amount = canRedeemCount.value;
  if (amount <= 0 || isRedeeming.value || isDailyLimitReached.value) return;

  isRedeeming.value = true;
  redeemStatusType.value = '';
  redeemStatusMsg.value = '正在连线云端特权网关并充值额度...';

  try {
    const costScore = amount * 10000;
    const res = await (window as any).electron?.invoke?.('sys:redeem-cores', costScore, amount);

    if (res?.success) {
      // 成功扣减消耗的游戏内积分
      miniGameStore.consumeSessionScore(costScore);
      dailyRedeemInfo.value.count += amount;
      if (dailyRedeemInfo.value.count >= MAX_DAILY_REDEEM) {
        dailyRedeemInfo.value.exhausted = true;
      }
      saveDailyRedeemState(dailyRedeemInfo.value.count, dailyRedeemInfo.value.exhausted);

      redeemStatusType.value = 'success';
      redeemStatusMsg.value = `🎉 兑换成功！已成功为您账号注入 ${amount} 个云端特权配额！`;
      showToast(`⚡ 成功兑换 ${amount} 个额度配额！`);
    } else {
      const errRaw = String(res?.error || '');
      const errLower = errRaw.toLowerCase();
      const isLimit = res?.error === 'QUOTA_EXHAUSTED' ||
                      errLower.includes('quota') ||
                      errLower.includes('limit') ||
                      errLower.includes('上限') ||
                      errLower.includes('429');

      if (isLimit) {
        dailyRedeemInfo.value.exhausted = true;
        dailyRedeemInfo.value.count = MAX_DAILY_REDEEM;
        saveDailyRedeemState(MAX_DAILY_REDEEM, true);
        redeemStatusType.value = 'error';
        redeemStatusMsg.value = '⚠️ 今日兑换次数已达上限（每日限 3 次）';
      } else {
        redeemStatusType.value = 'error';
        redeemStatusMsg.value = `兑换失败: ${errRaw || '网络连接异常'}`;
      }
    }
  } catch (err: any) {
    redeemStatusType.value = 'error';
    redeemStatusMsg.value = '网络异常，未能连接到特权网关';
  } finally {
    isRedeeming.value = false;
  }
}

const assetBase = miniGameAssetBase;
const containerRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const videoAEl = ref<HTMLVideoElement | null>(null);
const videoBEl = ref<HTMLVideoElement | null>(null);

// 视频素材
const videoAUrl = `${assetBase}/games/cyberguitar/video/bg_stage.mp4`;
const videoBUrl = `${assetBase}/games/cyberguitar/video/bg_city.mp4`;

// ==================== 1. 音频引擎与编曲风格状态 ====================
const audioEngine = new KineticAudioEngine();
const toneMode = ref<GuitarToneMode>('ambient');
const currentStyleIdx = ref(0);
const currentStyle = computed(() => SMART_STYLES[currentStyleIdx.value]);
const currentTuning = computed(() => GUITAR_TUNINGS[currentStyleIdx.value] || GUITAR_TUNINGS[0]);

// 智能多节拍和弦 Riff 调度状态
const activeRiffKey = ref<string | null>(null);
const currentRiffBeat = ref(0);
let riffTimer: any = null;

// 智能伴奏鼓点调度状态
const isDrumLoopActive = ref(true);
let drumLoopTimer: any = null;
let currentDrumBeat = 0;

function selectStyle(idx: number) {
  currentStyleIdx.value = idx;
  const style = SMART_STYLES[idx];
  
  // 自动同步音色与调弦
  toneMode.value = style.toneMode;
  audioEngine.setToneMode(style.toneMode);
  setupLayout();

  if (isDrumLoopActive.value) {
    restartDrumLoop();
  }
  showToast(`🎶 风格已切换: 【${style.name}】\n参考母带: ${style.referenceMp3}`);
}

function toggleToneMode() {
  toneMode.value = toneMode.value === 'ambient' ? 'rock_distortion' : 'ambient';
  audioEngine.setToneMode(toneMode.value);
  showToast(toneMode.value === 'rock_distortion' ? '🔥 已切换为: 摇滚失真电吉他!' : '🌿 已切换为: 空灵极光原声!');
}

function toggleDrumAccompaniment() {
  isDrumLoopActive.value = !isDrumLoopActive.value;
  if (isDrumLoopActive.value) {
    restartDrumLoop();
    showToast(`🥁 智能鼓点伴奏已启动: 【${currentStyle.value.bpm} BPM 自动咬合】`);
  } else {
    stopDrumLoop();
    showToast('⏸️ 伴奏鼓机已暂停');
  }
}

function restartDrumLoop() {
  stopDrumLoop();
  currentDrumBeat = 0;
  scheduleDrumLoopStep();
}

function stopDrumLoop() {
  if (drumLoopTimer) {
    clearTimeout(drumLoopTimer);
    drumLoopTimer = null;
  }
}

function scheduleDrumLoopStep() {
  if (!isDrumLoopActive.value) return;
  const style = currentStyle.value;
  const secPerBeat = 60 / style.bpm;
  const stepInterval = secPerBeat * 0.5; // 每半拍扫描一次鼓点

  const beatIndex = currentDrumBeat % 4; // 4 拍循环
  const actions = style.drumLoop.filter(d => Math.abs(d.beat - beatIndex) < 0.2);

  actions.forEach(act => {
    act.drums.forEach(type => {
      const d = drums.find(x => x.type === type);
      if (d) triggerDrum(d, d.x, d.y, 0.95, true);
    });
  });

  currentDrumBeat = (currentDrumBeat + 0.5) % 4;
  drumLoopTimer = setTimeout(scheduleDrumLoopStep, stepInterval * 1000);
}

// 核心：触发智能多节拍和弦 Riff (点一下，弹完整 4 拍华丽吉他)
function triggerSmartChord(pad: SmartChordPad) {
  activeRiffKey.value = pad.key;
  if (riffTimer) clearTimeout(riffTimer);

  miniGameStore.addSessionScore(200); // 和弦 Riff 创作基础分 (原500)

  const style = currentStyle.value;
  const secPerBeat = 60 / style.bpm;
  const beatMs = secPerBeat * 1000;

  triggerGirlReaction(toneMode.value === 'rock_distortion');

  // 按照预置的 4 拍切片，精准调度每个半拍上的拨弦与和声
  pad.notes.forEach(note => {
    const delay = note.offsetBeat * beatMs;
    setTimeout(() => {
      // 只有在当前 Riff 依然是激活状态时才发声
      if (activeRiffKey.value === pad.key) {
        currentRiffBeat.value = Math.floor(note.offsetBeat);

        if (note.strum) {
          strumChord(note.velocity);
        } else if (strings[note.stringIndex]) {
          const s = strings[note.stringIndex];
          const cx = (s.x1 + s.x2) * 0.5 + (Math.random() - 0.5) * 80;
          triggerStringWithFreq(s, cx, note.freq, note.velocity);
        }
      }
    }, delay);
  });

  // 4 拍演奏完毕后重置激活状态
  riffTimer = setTimeout(() => {
    if (activeRiffKey.value === pad.key) {
      activeRiffKey.value = null;
      currentRiffBeat.value = 0;
    }
  }, 4 * beatMs);
}

// 提示 Toast
const toastMessage = ref('');
let toastTimeout: NodeJS.Timeout | null = null;
function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toastMessage.value = ''; }, 2400);
}

// 全屏控制
const isFullscreen = ref(false);
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    containerRef.value?.requestFullscreen().then(() => {
      isFullscreen.value = true;
      showToast('已进入全屏沉浸模式 (可按 F11 或 ESC 退出)');
    }).catch(() => {});
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false;
    }).catch(() => {});
  }
}
function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

// ==================== 2. 24 帧摇滚吉他少女序列帧 ====================
type PoseType = 'idle' | 'attack' | 'victory';
const currentPose = ref<PoseType>('idle');
let poseTimer = 0;
const girlAnim = reactive({ scaleX: 1.0, scaleY: 1.0, slashDir: 1 });

const loadedFrames: Record<PoseType, HTMLImageElement[]> = {
  idle: [],
  attack: [],
  victory: []
};

function preloadGirlFrames() {
  const poses: PoseType[] = ['idle', 'attack', 'victory'];
  poses.forEach((p) => {
    loadedFrames[p] = [];
    for (let i = 1; i <= 8; i++) {
      const img = new Image();
      img.src = `${assetBase}/games/cyberguitar/frames/${p}/cyber_guitar_girl_${p}_${String(i).padStart(2, '0')}.png`;
      loadedFrames[p].push(img);
    }
  });
}

function triggerGirlReaction(isHeavy = false) {
  currentPose.value = isHeavy ? 'victory' : 'attack';
  poseTimer = isHeavy ? 0.65 : 0.30;
  girlAnim.scaleX = isHeavy ? 1.2 : 1.1;
  girlAnim.scaleY = isHeavy ? 0.85 : 0.9;
  girlAnim.slashDir = Math.random() > 0.5 ? 1 : -1;
}

// ==================== 3. 动力学场景实体与小球优化 ====================
const STAFF_AREA_HEIGHT = 175;
const MAX_ORBS = 3; // 严格锁死同屏最多 3 颗小球，绝不杂乱！

interface SceneString {
  index: number;
  x1: number;
  x2: number;
  y: number;
  amp: number;
  pluckX: number;
  note: StringNote;
}

interface SceneDrum {
  type: 'kick' | 'snare' | 'hat' | 'tom';
  label: string;
  shape: 'circle' | 'square' | 'triangle' | 'hexagon';
  x: number;
  y: number;
  r: number;
  color: string;
  pulse: number;
  step: number;
  keyLabel: string;
}

interface SceneOrb {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  bouncesLeft: number; // 剩余寿命 (每次反弹衰减，保证自然优雅消散)
  trail: { x: number; y: number }[];
  cooldowns: Map<string, number>;
}

interface SheetNoteItem {
  x: number;
  step: number;
  label: string;
  accidental: string;
  color: string;
  isDrum: boolean;
  drumType?: string;
  alpha: number;
  born: number;
}

interface RippleEffect {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  alpha: number;
}

let strings: SceneString[] = [];
let drums: SceneDrum[] = [];
let orbs: SceneOrb[] = [];
let ripples: RippleEffect[] = [];
let sheetNotes: SheetNoteItem[] = [];

let lastSpawnOrbTime = 0; // 发射小球防抖冷却

function setupLayout() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const W = canvas.width = window.innerWidth;
  const H = canvas.height = window.innerHeight;
  const playH = H - STAFF_AREA_HEIGHT;

  // 6 根水平吉他琴弦 (位于屏幕宽广中央)
  const tuningNotes = currentTuning.value.notes;
  const strLeft = W * 0.12;
  const strRight = W * 0.88;
  const topY = playH * 0.18;
  const bottomY = playH * 0.82;
  const spacing = (bottomY - topY) / (tuningNotes.length - 1);

  strings = tuningNotes.map((n, i) => ({
    index: i,
    x1: strLeft,
    x2: strRight,
    y: topY + i * spacing,
    amp: 0,
    pluckX: (strLeft + strRight) / 2,
    note: n
  }));

  // 4 个自由摆放的几何打击乐 (底鼓、军鼓、踩镲、通鼓)
  if (drums.length === 0) {
    drums = [
      { type: 'kick',  label: 'KICK [A]',  shape: 'circle',   x: W * 0.22, y: playH * 0.32, r: 32, color: '#f43f5e', pulse: 0, step: -6, keyLabel: 'A' },
      { type: 'snare', label: 'SNARE [S]', shape: 'square',   x: W * 0.44, y: playH * 0.60, r: 30, color: '#10b981', pulse: 0, step: -2, keyLabel: 'S' },
      { type: 'hat',   label: 'HI-HAT [D]',shape: 'triangle', x: W * 0.64, y: playH * 0.28, r: 28, color: '#eab308', pulse: 0, step: 3,  keyLabel: 'D' },
      { type: 'tom',   label: 'TOM [F]',   shape: 'hexagon',  x: W * 0.78, y: playH * 0.65, r: 30, color: '#06b6d4', pulse: 0, step: -4, keyLabel: 'F' }
    ];
  } else {
    drums.forEach(d => {
      d.x = Math.min(W - 60, Math.max(60, d.x));
      d.y = Math.min(playH - 60, Math.max(60, d.y));
    });
  }
}

// 经过深度防杂乱优化的能量球发射器
function spawnOrb(x?: number, y?: number, vx?: number, vy?: number) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const W = canvas.width;
  const H = canvas.height;
  const playH = H - STAFF_AREA_HEIGHT;
  const angle = Math.random() * Math.PI * 2;
  const speed = 2.8 + Math.random() * 2.0;

  // 严格限制最大数量，超额自动淘汰最早的一颗
  if (orbs.length >= MAX_ORBS) {
    orbs.shift();
  }

  orbs.push({
    x: x ?? W * (0.28 + Math.random() * 0.44),
    y: y ?? playH * 0.14,
    px: x ?? W * 0.5,
    py: y ?? playH * 0.14,
    vx: vx ?? Math.cos(angle) * speed,
    vy: vy ?? Math.sin(angle) * speed,
    r: 7,
    bouncesLeft: 10, // 仅允许优雅碰撞 10 次，自然衰减消失
    trail: [],
    cooldowns: new Map()
  });
}

function spawnManualOrb() {
  const now = performance.now();
  if (now - lastSpawnOrbTime < 350) return;
  lastSpawnOrbTime = now;

  const canvas = canvasRef.value;
  const W = canvas ? canvas.width : 1280;
  const H = canvas ? canvas.height : 720;
  spawnOrb(W * (0.32 + Math.random() * 0.36), (H - STAFF_AREA_HEIGHT) * 0.15);
  showToast(`⚪ 发射能量球 (存活: ${orbs.length}/${MAX_ORBS})`);
}

function clearOrbs() {
  orbs = [];
  sheetNotes = [];
  showToast('已清空能量球与乐谱');
}

// 记录音符到五线谱
function recordSheetNote(item: { step: number; label: string; accidental?: string; color: string; type?: string }, isDrum = false) {
  const canvas = canvasRef.value;
  const playheadX = (canvas ? canvas.width : 1280) * 0.88;
  sheetNotes.push({
    x: playheadX,
    step: item.step,
    label: item.label,
    accidental: item.accidental || '',
    color: item.color,
    isDrum,
    drumType: item.type,
    alpha: 1.0,
    born: performance.now()
  });
  if (sheetNotes.length > 130) sheetNotes.shift();
}

// 拨弦触发 (使用弦默认频率)
function triggerString(str: SceneString, pluckX: number, velocity = 0.85) {
  triggerStringWithFreq(str, pluckX, str.note.freq, velocity);
}

// 拨弦触发 (支持多节拍智能和弦指定音高)
function triggerStringWithFreq(str: SceneString, pluckX: number, freq: number, velocity = 0.85) {
  str.amp = 26 * velocity;
  str.pluckX = Math.max(str.x1 + 20, Math.min(str.x2 - 20, pluckX));
  audioEngine.playGuitarString(freq, velocity);
  recordSheetNote(str.note, false);
  triggerGirlReaction(velocity > 1.0);
  miniGameStore.addSessionScore(50); // 单弦发声分 (原100)

  ripples.push({ 
    x: str.pluckX, 
    y: str.y, 
    r: 6, 
    maxR: 55, 
    color: str.note.color, 
    alpha: 0.9 
  });
}

// 击鼓触发
function triggerDrum(drum: SceneDrum, hitX?: number, hitY?: number, velocity = 0.9, isAuto = false) {
  drum.pulse = 1.0;
  audioEngine.playDrum(drum.type, velocity);
  recordSheetNote(drum, true);
  triggerGirlReaction(false);
  miniGameStore.addSessionScore(isAuto ? 80 : 150); // 自动伴奏80分，手动击打150分 (原200)

  ripples.push({ 
    x: drum.x, 
    y: drum.y, 
    r: drum.r * 0.8, 
    maxR: drum.r * 2.8, 
    color: drum.color, 
    alpha: 0.95 
  });
}

// 全和弦琶音扫弦 (Strum Chord)
function strumChord(velocity = 1.0) {
  if (strings.length === 0) return;
  triggerGirlReaction(true);
  miniGameStore.addSessionScore(600); // 扫弦基础分 (原1500)

  // 从低音弦到高音弦快速连续拂扫 (间隔 28ms)
  for (let i = strings.length - 1; i >= 0; i--) {
    const s = strings[i];
    const delay = (strings.length - 1 - i) * 30;
    setTimeout(() => {
      const cx = (s.x1 + s.x2) * 0.5 + (Math.random() - 0.5) * 80;
      triggerString(s, cx, velocity);
    }, delay);
  }
}

// ==================== 4. 鼠标 / 触摸交互 (划弦、拖动鼓、发射小球) ====================
let pointer = { x: 0, y: 0, px: 0, py: 0, down: false, draggingDrum: null as SceneDrum | null, moved: false };

function getPos(e: MouseEvent) {
  return { x: e.clientX, y: e.clientY };
}

function onCanvasMouseDown(e: MouseEvent) {
  containerRef.value?.focus();
  const pos = getPos(e);
  pointer.x = pointer.px = pos.x;
  pointer.y = pointer.py = pos.y;
  pointer.down = true;
  pointer.moved = false;

  // 1. 检查是否点中了几何鼓垫
  for (const d of drums) {
    const dist = Math.hypot(pos.x - d.x, pos.y - d.y);
    if (dist <= d.r + 10) {
      pointer.draggingDrum = d;
      triggerDrum(d, pos.x, pos.y, 0.95);
      return;
    }
  }

  // 2. 检查是否在琴弦附近点按
  for (const s of strings) {
    if (pos.x >= s.x1 && pos.x <= s.x2 && Math.abs(pos.y - s.y) <= 16) {
      triggerString(s, pos.x, 0.9);
      return;
    }
  }
}

function onCanvasMouseMove(e: MouseEvent) {
  const pos = getPos(e);
  pointer.px = pointer.x;
  pointer.py = pointer.y;
  const prevX = pointer.x;
  const prevY = pointer.y;
  pointer.x = pos.x;
  pointer.y = pos.y;

  if (Math.hypot(pointer.x - prevX, pointer.y - prevY) > 3) {
    pointer.moved = true;
  }

  // 拖拽鼓垫
  if (pointer.draggingDrum) {
    const canvas = canvasRef.value;
    const W = canvas ? canvas.width : 1280;
    const playH = canvas ? canvas.height - STAFF_AREA_HEIGHT : 600;
    pointer.draggingDrum.x = Math.max(50, Math.min(W - 50, pointer.x));
    pointer.draggingDrum.y = Math.max(50, Math.min(playH - 50, pointer.y));
    return;
  }

  // 划弦检测 (Swipe Across Strings)
  for (const s of strings) {
    if (pointer.x >= s.x1 && pointer.x <= s.x2) {
      const crossedDown = prevY < s.y && pointer.y >= s.y;
      const crossedUp = prevY > s.y && pointer.y <= s.y;
      if (crossedDown || crossedUp) {
        const speed = Math.min(1.25, Math.max(0.4, Math.abs(pointer.y - prevY) / 16));
        triggerString(s, pointer.x, speed);
      }
    }
  }

  // 划入鼓垫检测
  for (const d of drums) {
    const wasOut = Math.hypot(prevX - d.x, prevY - d.y) > d.r;
    const isIn = Math.hypot(pointer.x - d.x, pointer.y - d.y) <= d.r;
    if (wasOut && isIn) {
      triggerDrum(d, pointer.x, pointer.y, 0.85);
    }
  }
}

function onCanvasMouseUp(e: MouseEvent) {
  const canvas = canvasRef.value;
  const playH = canvas ? canvas.height - STAFF_AREA_HEIGHT : 600;

  // 只有在没有移动拖拽、且点击空白区域时，才发射一颗小球
  if (pointer.down && !pointer.draggingDrum && !pointer.moved && pointer.y < playH - 20) {
    spawnManualOrb();
  }

  pointer.down = false;
  pointer.draggingDrum = null;
}

// ==================== 5. 键盘演奏系统 (1~4 多节拍和弦 / SPACE 扫弦 / A~F 鼓点) ====================
function onKeyDown(e: KeyboardEvent) {
  const k = e.key.toLowerCase();

  if (e.code === 'F11') {
    e.preventDefault();
    toggleFullscreen();
    return;
  }

  // 1. 主菜单状态下的按键拦截
  if (screen.value === 'menu') {
    if (showGuideModal.value) {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        showGuideModal.value = false;
      }
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      startGame();
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        return;
      }
      exitGame();
      return;
    }
    return;
  }

  // 2. 演奏状态下的 ESC 处理：呼出主菜单
  if (e.code === 'Escape') {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    openMenu();
    return;
  }

  if (k === 't') {
    toggleToneMode();
    return;
  }
  if (k === 'b') {
    toggleDrumAccompaniment();
    return;
  }
  if (k === 'tab') {
    e.preventDefault();
    selectStyle((currentStyleIdx.value + 1) % SMART_STYLES.length);
    return;
  }

  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    strumChord(1.15);
    return;
  }

  // 核心！按 Q / W / E / R 触发智能多节拍吉他 Riff 和弦（彻底避开 TC 全局侧栏 1~7 快捷键）！
  if (['q', 'w', 'e', 'r'].includes(k)) {
    const pad = currentStyle.value.pads.find(p => p.key.toLowerCase() === k);
    if (pad) {
      triggerSmartChord(pad);
    }
    return;
  }

  // A / S / D / F 键对应 4 个鼓垫
  if (k === 'a') {
    const d = drums.find(x => x.type === 'kick');
    if (d) triggerDrum(d, d.x, d.y, 1.0);
  } else if (k === 's') {
    const d = drums.find(x => x.type === 'snare');
    if (d) triggerDrum(d, d.x, d.y, 1.0);
  } else if (k === 'd') {
    const d = drums.find(x => x.type === 'hat');
    if (d) triggerDrum(d, d.x, d.y, 0.9);
  } else if (k === 'f') {
    const d = drums.find(x => x.type === 'tom');
    if (d) triggerDrum(d, d.x, d.y, 0.95);
  }
}

function onKeyUp(e: KeyboardEvent) {}

// ==================== 6. Canvas 绘制工具函数 ====================
function drawPolygon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, sides: number, rotation = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rotation + (i * 2 * Math.PI) / sides;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// 绘制底部实时滚动的五线谱乐谱 (Live Scrolling Sheet Music)
function drawSheetMusic(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const top = H - STAFF_AREA_HEIGHT;

  // 半透明乐谱基座
  ctx.fillStyle = 'rgba(7, 10, 18, 0.92)';
  ctx.fillRect(0, top, W, STAFF_AREA_HEIGHT);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(W, top);
  ctx.stroke();

  // 五线谱几何参数: 5 条主线 (高音谱号 E4 到 F5)
  const lineSpacing = 11;
  const halfStep = lineSpacing / 2;
  const bottomLineY = top + 92;

  // 绘制 5 条五线谱横线
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ly = bottomLineY - i * lineSpacing;
    ctx.beginPath();
    ctx.moveTo(40, ly);
    ctx.lineTo(W - 40, ly);
    ctx.stroke();
  }

  // 高音谱号 𝄞
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.font = '40px serif';
  ctx.fillText('𝄞', 46, bottomLineY - 8);

  // 播放头虚线 (Playhead)
  const playheadX = W * 0.88;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(playheadX, top + 15);
  ctx.lineTo(playheadX, H - 15);
  ctx.stroke();
  ctx.setLineDash([]);

  // 更新与绘制向左流动的乐谱音符
  for (let i = sheetNotes.length - 1; i >= 0; i--) {
    const n = sheetNotes[i];
    n.x -= 1.6;

    if (n.x < 85) {
      n.alpha -= 0.04;
      if (n.alpha <= 0) {
        sheetNotes.splice(i, 1);
        continue;
      }
    }

    const ny = bottomLineY - n.step * halfStep;
    ctx.save();
    ctx.globalAlpha = Math.max(0, n.alpha);

    // 下加线 (针对低音吉他弦)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    if (n.step <= -2) {
      for (let s = -2; s >= n.step; s -= 2) {
        const ly = bottomLineY - s * halfStep;
        ctx.beginPath();
        ctx.moveTo(n.x - 10, ly);
        ctx.lineTo(n.x + 10, ly);
        ctx.stroke();
      }
    }

    ctx.fillStyle = n.color;
    ctx.strokeStyle = n.color;

    if (n.isDrum) {
      // 打击乐专用记谱 ('X' 字音符头)
      ctx.lineWidth = 2.2;
      const sz = 5.5;
      ctx.beginPath();
      ctx.moveTo(n.x - sz, ny - sz);
      ctx.lineTo(n.x + sz, ny + sz);
      ctx.moveTo(n.x + sz, ny - sz);
      ctx.lineTo(n.x - sz, ny + sz);
      ctx.stroke();

      // 符干
      ctx.beginPath();
      ctx.moveTo(n.x + sz, ny);
      ctx.lineTo(n.x + sz, ny - 26);
      ctx.stroke();
    } else {
      // 标准吉他旋律音符 (椭圆符头 + 符干)
      ctx.beginPath();
      ctx.ellipse(n.x, ny, 6.4, 4.5, -0.32, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (n.step < 4) {
        ctx.moveTo(n.x + 5.5, ny);
        ctx.lineTo(n.x + 5.5, ny - 28);
      } else {
        ctx.moveTo(n.x - 5.5, ny);
        ctx.lineTo(n.x - 5.5, ny + 28);
      }
      ctx.stroke();

      // 升降号 #
      if (n.accidental) {
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(n.accidental, n.x - 17, ny + 4);
      }
    }

    // 底部微型音名标注
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(n.label, n.x, H - 10);

    ctx.restore();
  }
}

// 绘制赛博吉他少女
function drawGirl(ctx: CanvasRenderingContext2D, cx: number, cy: number, now: number) {
  girlAnim.scaleX += (1.0 - girlAnim.scaleX) * 0.15;
  girlAnim.scaleY += (1.0 - girlAnim.scaleY) * 0.15;

  if (poseTimer > 0) {
    poseTimer -= 0.016;
    if (poseTimer <= 0) currentPose.value = 'idle';
  }

  const frames = loadedFrames[currentPose.value];
  const frameIdx = Math.floor((now * 0.006)) % 8;
  const girlImg = frames[frameIdx] || frames[0];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(girlAnim.scaleX * 0.85, girlAnim.scaleY * 0.85);

  if (girlImg && girlImg.complete && girlImg.naturalWidth > 0) {
    if (toneMode.value === 'rock_distortion') {
      ctx.filter = 'drop-shadow(0 0 25px #f43f5e) hue-rotate(90deg)';
    } else {
      ctx.filter = 'drop-shadow(0 0 18px #22d3ee)';
    }
    ctx.drawImage(girlImg, -140, -140, 280, 280);
    ctx.restore();
    return;
  }

  // 兜底帅气赛博少女剪影
  ctx.beginPath();
  ctx.arc(0, -35, 28, 0, Math.PI * 2);
  ctx.fillStyle = toneMode.value === 'rock_distortion' ? '#f43f5e' : '#38bdf8';
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(-26, 0, 52, 45, 8);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = toneMode.value === 'rock_distortion' ? '#fbbf24' : '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

// ==================== 7. 主 60FPS 动画循环 ====================
let rafId: number | null = null;

function renderLoop(now: number) {
  rafId = requestAnimationFrame(renderLoop);
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
    setupLayout();
  }

  const W = canvas.width;
  const H = canvas.height;
  const playH = H - STAFF_AREA_HEIGHT;

  ctx.clearRect(0, 0, W, H);

  // 1. 绘制中央摇滚吉他少女
  drawGirl(ctx, W * 0.5, playH * 0.50, now);

  // 2. 更新与绘制 6 根动力学吉他琴弦 (Spring Physics)
  for (const s of strings) {
    s.amp *= 0.93;
    const offset = Math.sin(now * 0.055) * s.amp;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y);
    ctx.quadraticCurveTo(s.pluckX, s.y + offset, s.x2, s.y);

    const activeGlow = Math.min(1.0, Math.abs(s.amp) / 14);
    ctx.strokeStyle = activeGlow > 0.05 
      ? s.note.color 
      : toneMode.value === 'rock_distortion' ? 'rgba(251, 113, 133, 0.35)' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.6 + activeGlow * 3.0;

    if (activeGlow > 0.05) {
      ctx.shadowColor = s.note.color;
      ctx.shadowBlur = 18 * activeGlow;
    }
    ctx.stroke();

    // 琴弦两端接线柱与大字音标
    ctx.fillStyle = s.note.color;
    ctx.beginPath();
    ctx.arc(s.x1, s.y, 4, 0, Math.PI * 2);
    ctx.arc(s.x2, s.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // 左侧琴弦序号与音名
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${s.index + 1}弦 [${s.note.label}]`, s.x1 - 16, s.y + 4);

    // 右侧频率标识
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(s.note.freq)}Hz`, s.x2 + 16, s.y + 4);

    ctx.restore();
  }

  // 3. 更新与绘制 4 个几何打击乐鼓垫 (Draggable Drums)
  for (const d of drums) {
    d.pulse *= 0.88;
    const r = d.r + d.pulse * 10;

    ctx.save();
    ctx.strokeStyle = d.color;
    ctx.fillStyle = 'rgba(11, 16, 26, 0.85)';
    ctx.lineWidth = 2.4 + d.pulse * 2.5;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 14 + d.pulse * 25;

    if (d.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    } else if (d.shape === 'square') {
      drawPolygon(ctx, d.x, d.y, r, 4, Math.PI / 4);
    } else if (d.shape === 'triangle') {
      drawPolygon(ctx, d.x, d.y, r + 4, 3, -Math.PI / 2);
    } else {
      drawPolygon(ctx, d.x, d.y, r, 6, 0);
    }
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, d.x, d.y + 4);
    ctx.restore();
  }

  // 4. 更新与绘制动力学能量小球 (寿命衰减 + 干净消散)
  for (let i = orbs.length - 1; i >= 0; i--) {
    const orb = orbs[i];
    orb.px = orb.x;
    orb.py = orb.y;
    orb.x += orb.vx;
    orb.y += orb.vy;

    let didBounce = false;

    // 碰壁反弹 (Bounce Off Boundaries)
    if (orb.x < 16 || orb.x > W - 16) {
      orb.vx *= -1;
      orb.x = Math.max(16, Math.min(W - 16, orb.x));
      didBounce = true;
    }
    if (orb.y < 16 || orb.y > playH - 16) {
      orb.vy *= -1;
      orb.y = Math.max(16, Math.min(playH - 16, orb.y));
      didBounce = true;
    }

    // 小球掠过琴弦触发拨弦 (Crossing Strings, 260ms 冷却)
    for (const s of strings) {
      const key = `str_${s.index}`;
      const lastHit = orb.cooldowns.get(key) || 0;
      if (now - lastHit > 260 && orb.x >= s.x1 && orb.x <= s.x2) {
        const crossedDown = orb.py < s.y && orb.y >= s.y;
        const crossedUp = orb.py > s.y && orb.y <= s.y;
        if (crossedDown || crossedUp) {
          orb.cooldowns.set(key, now);
          triggerString(s, orb.x, 0.85);
          didBounce = true;
        }
      }
    }

    // 小球与几何鼓垫碰撞物理反弹 (Bounce Off Drums, 280ms 冷却)
    for (const d of drums) {
      const key = `drum_${d.type}`;
      const lastHit = orb.cooldowns.get(key) || 0;
      const dist = Math.hypot(orb.x - d.x, orb.y - d.y);
      if (dist <= d.r + orb.r && now - lastHit > 280) {
        orb.cooldowns.set(key, now);
        triggerDrum(d, orb.x, orb.y, 0.9);
        didBounce = true;

        const nx = (orb.x - d.x) / (dist || 1);
        const ny = (orb.y - d.y) / (dist || 1);
        const dot = orb.vx * nx + orb.vy * ny;
        orb.vx = orb.vx - 2 * dot * nx;
        orb.vy = orb.vy - 2 * dot * ny;
      }
    }

    if (didBounce) {
      orb.bouncesLeft--;
    }

    if (orb.bouncesLeft <= 0) {
      ripples.push({
        x: orb.x,
        y: orb.y,
        r: orb.r,
        maxR: 35,
        color: '#38bdf8',
        alpha: 0.6
      });
      orbs.splice(i, 1);
      continue;
    }

    orb.trail.push({ x: orb.x, y: orb.y });
    if (orb.trail.length > 12) orb.trail.shift();

    const lifeRatio = Math.min(1.0, Math.max(0.2, orb.bouncesLeft / 4));
    const renderR = Math.max(4, orb.r * lifeRatio);

    ctx.save();
    ctx.globalAlpha = lifeRatio * 0.7;
    ctx.beginPath();
    for (let t = 0; t < orb.trail.length; t++) {
      const pt = orb.trail[t];
      if (t === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.strokeStyle = toneMode.value === 'rock_distortion' ? 'rgba(244, 63, 94, 0.45)' : 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = toneMode.value === 'rock_distortion' ? '#f43f5e' : '#38bdf8';
    ctx.shadowBlur = 12 * lifeRatio;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, renderR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. 绘制水波涟漪特效 (Ripples)
  for (let i = ripples.length - 1; i >= 0; i--) {
    const rp = ripples[i];
    rp.r += (rp.maxR - rp.r) * 0.15;
    rp.alpha *= 0.91;
    if (rp.alpha < 0.02) {
      ripples.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.strokeStyle = rp.color;
    ctx.globalAlpha = rp.alpha;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. 绘制底部五线谱乐谱
  drawSheetMusic(ctx, W, H);
}

// ==================== 8. 生命周期与退出 ====================
function exitGame() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  stopDrumLoop();
  if (riffTimer) clearTimeout(riffTimer);
  audioEngine.destroy();

  // 退出自动结算本局积分（10000 积分 = 1 CORE 兑换配额）
  const result = miniGameStore.claim();
  if (result.cores > 0) {
    emit('update:stats', { cores: result.cores });
  }

  emit('exit');
}

onMounted(() => {
  sessionStartPerf = performance.now();
  telemetry.trackLobbyEvent('lobby_game_launch', { game_id: 'cyberguitar', game_title: '电音少女', source: 'mini' });
  preloadGirlFrames();
  document.addEventListener('fullscreenchange', onFullscreenChange);
  setupLayout();
  // 初始保持主菜单状态，等待玩家点击开始演奏后启动鼓机

  nextTick(() => {
    rafId = requestAnimationFrame(renderLoop);
    containerRef.value?.focus();
  });
});

onUnmounted(() => {
  if (sessionStartPerf > 0) {
    const elapsedSec = Math.round((performance.now() - sessionStartPerf) / 1000);
    sessionStartPerf = 0;
    if (elapsedSec > 0 && elapsedSec < 7200) {
      telemetry.trackLobbyEvent('lobby_minigame_playtime', { game: 'cyberguitar', duration_sec: elapsedSec, ts: Date.now() });
      telemetry.flushNow();
    }
  }

  document.removeEventListener('fullscreenchange', onFullscreenChange);
  stopDrumLoop();
  if (riffTimer) clearTimeout(riffTimer);
  if (rafId) cancelAnimationFrame(rafId);
  if (toastTimeout) clearTimeout(toastTimeout);
  audioEngine.destroy();

  // 释放动作序列帧图片内存引用
  loadedFrames.idle = [];
  loadedFrames.attack = [];
  loadedFrames.victory = [];

  // 释放双通道背景视频硬解资源
  if (videoAEl.value) {
    try {
      videoAEl.value.pause();
      videoAEl.value.src = '';
      videoAEl.value.load();
    } catch {}
  }
  if (videoBEl.value) {
    try {
      videoBEl.value.pause();
      videoBEl.value.src = '';
      videoBEl.value.load();
    } catch {}
  }
});
</script>

<style scoped>
.cyber-panel {
  background: linear-gradient(135deg, rgba(8, 14, 28, 0.94) 0%, rgba(14, 22, 42, 0.90) 100%);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(34, 211, 238, 0.35);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.75), inset 0 0 15px rgba(34, 211, 238, 0.1);
}

.cyber-btn {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
.cyber-btn:hover {
  transform: translateY(-1px);
}
.cyber-btn:active {
  transform: translateY(1px) scale(0.97);
}

.cyber-pad {
  transition: all 0.12s cubic-bezier(0.4, 0, 0.2, 1);
}
.cyber-pad:hover {
  transform: translateY(-2px);
}
.cyber-pad:active {
  transform: translateY(1px) scale(0.97);
}

.crt-overlay {
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
              radial-gradient(circle at center, transparent 65%, rgba(5, 7, 15, 0.8) 100%);
  background-size: 100% 4px, 100% 100%;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
