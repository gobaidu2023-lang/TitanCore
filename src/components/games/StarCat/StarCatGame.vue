<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div
      :class="[
        'bg-[#020205] overflow-hidden select-none cursor-crosshair font-mono',
        isFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : 'relative h-full w-full'
      ]"
    >
      <!-- Pixi 根画布 (全分辨率 Letterbox 等比定标自适应) -->
      <div ref="pixiContainer" class="absolute inset-0 w-full h-full" />

      <!-- 常驻右上角功能条 (全屏/退出) -->
      <div class="absolute top-4 right-4 z-[60] flex items-center gap-2 pointer-events-auto">
        <button
          @click="toggleFullscreen"
          class="p-2 bg-black/60 hover:bg-white/15 border border-white/20 rounded-lg text-zinc-300 hover:text-[#00f3ff] transition-all hover:scale-105"
          :title="isFullscreen ? '窗口化 (F11)' : '全屏沉浸 (F11)'"
        >
          <!-- 全屏图标 -->
          <svg v-if="!isFullscreen" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <!-- 窗口化图标 -->
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 4H5a1 1 0 00-1 1v4m1-5l5 5M15 4h4a1 1 0 011 1v4m-1-5l-5 5M9 20H5a1 1 0 01-1-1v-4m1 5l5-5m5 5l5-5m-5 5h4a1 1 0 001-1v-4" />
          </svg>
        </button>

        <button
          v-if="store.screen === 'playing'"
          @click="isPaused ? resumeGame() : pauseGame()"
          class="px-3 py-1.5 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 rounded-lg text-yellow-400 text-xs font-bold transition-all hover:scale-105"
          :title="isPaused ? '继续远征 (ESC)' : '战术暂停 (ESC)'"
        >
          {{ isPaused ? '继续' : '暂停' }}
        </button>

        <button
          @click="exitToLobby"
          class="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold transition-all hover:scale-105"
          title="退出到大厅"
        >
          退出
        </button>
      </div>

      <!-- 死亡之眼慢动作视效暗角 -->
      <div
        v-if="store.qte.active"
        class="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
        style="box-shadow: inset 0 0 100px rgba(255, 0, 0, 0.35);"
      />

      <!-- 受伤无敌帧红芒 -->
      <div
        v-if="store.isInvulnerable"
        class="absolute inset-0 pointer-events-none transition-opacity duration-150 z-10"
        style="box-shadow: inset 0 0 50px rgba(255, 42, 72, 0.45);"
      />

      <!-- ==================== 主菜单 ==================== -->
      <div
        v-if="store.screen === 'menu'"
        class="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-8 z-50"
      >
        <div class="text-[#00f3ff] font-black text-5xl tracking-widest mb-4" style="text-shadow: 0 0 30px rgba(0,243,255,0.6)">
          STAR CAT · 星际猫咪
        </div>
        <div class="flex flex-col gap-4 w-72">
          <button
            @click="startNewGame"
            class="px-8 py-4 bg-[#00f3ff]/20 border-2 border-[#00f3ff]/60 text-[#00f3ff] font-bold text-xl rounded-xl hover:bg-[#00f3ff]/30 transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,243,255,0.3)]"
          >
            🚀 开始远征
          </button>
        </div>
      </div>

      <!-- ==================== HUD 战术仪表盘 ==================== -->
      <div v-if="store.screen === 'playing' || store.screen === 'supply1' || store.screen === 'supply2'" class="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 pointer-events-none">
        <div class="flex flex-col gap-3 w-80 pointer-events-auto">
          <!-- HP 条 -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between items-center text-xs font-black tracking-wider">
              <span class="text-red-400 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                INTEGRITY [HP]
              </span>
              <span class="text-red-300">{{ store.hp }} / {{ store.maxHp }}</span>
            </div>
            <div class="h-3.5 bg-black/60 border border-white/20 p-0.5 relative overflow-hidden clip-slanted">
              <div
                class="h-full transition-all duration-150 relative overflow-hidden"
                :class="store.hp < 30 ? 'bg-red-600 animate-pulse' : 'bg-gradient-to-r from-red-700 via-red-500 to-rose-400'"
                :style="{ width: `${(store.hp / store.maxHp) * 100}%` }"
              >
                <div class="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.35)_4px,rgba(0,0,0,0.35)_8px)]" />
              </div>
            </div>
          </div>

          <!-- EN 能量条 (封顶 200) -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between items-center text-xs font-black tracking-wider">
              <span class="text-[#00f3ff]">ION BATTERY [EN]</span>
              <span class="text-[#00f3ff]">{{ Math.floor(store.energy) }} / {{ store.maxEnergy }}</span>
            </div>
            <div class="h-3 bg-black/60 border border-white/15 p-0.5">
              <div
                class="h-full bg-gradient-to-r from-[#0088ff] to-[#00f3ff] transition-all duration-100"
                :style="{ width: `${(store.energy / store.maxEnergy) * 100}%` }"
              />
            </div>
          </div>

          <!-- 战术提示与 Q 键动态激活 -->
          <div class="text-[11px] text-zinc-400 select-none flex items-center gap-2">
            <span>自动速射 · W跳跃/S下砸 ·</span>
            <span
              v-if="store.upgrades.includes('star_cannon')"
              class="font-black px-2 py-0.5 rounded transition-all duration-200"
              :class="store.energy >= 80 ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/50 shadow-[0_0_10px_rgba(250,204,21,0.5)] animate-pulse' : 'text-zinc-500 border border-zinc-700'"
            >
              Q: 歼星炮 (80 EN)
            </span>
            <span v-else class="text-zinc-600">
              歼星炮 (未安装)
            </span>
          </div>
        </div>

        <!-- 中间：关卡 3 终极 Boss 动态血条与机制指示 -->
        <div v-if="store.boss.active" class="flex flex-col items-center w-96 gap-1 pointer-events-none">
          <div class="flex justify-between w-full text-xs font-black tracking-widest">
            <span :class="store.boss.isWeak ? 'text-yellow-400 animate-bounce' : (store.boss.isEnraged ? 'text-red-500 animate-pulse' : 'text-[#00f3ff]')">
              {{ store.boss.isWeak ? '⚡ WEAKNESS EXPOSED [核心破绽 300% 易伤]!' : (store.boss.isEnraged ? '⚠ OVERDRIVE [终极狂暴]' : '🛡️ VOID ARMOR [虚空霸体 60% 减伤]') }}
            </span>
            <span class="text-zinc-300">
              {{ store.boss.hp }} / {{ store.boss.maxHp }}
            </span>
          </div>
          <div class="w-full h-4 bg-black/80 border-2 rounded-full p-0.5 shadow-[0_0_20px_rgba(239,68,68,0.5)] overflow-hidden transition-colors" :class="store.boss.isWeak ? 'border-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.7)]' : 'border-red-500/60'">
            <div
              class="h-full rounded-full transition-all duration-100"
              :class="store.boss.isWeak ? 'bg-gradient-to-r from-yellow-500 via-amber-300 to-yellow-400' : (store.boss.isEnraged ? 'bg-gradient-to-r from-red-600 to-yellow-500 animate-pulse' : 'bg-gradient-to-r from-red-800 to-rose-500')"
              :style="{ width: `${(store.boss.hp / store.boss.maxHp) * 100}%` }"
            />
          </div>
        </div>

        <!-- 右上角：COMBO 连击、无尽轮回数与战术积分 -->
        <div class="flex flex-col items-end pointer-events-none gap-2">
          <div class="flex items-center gap-4">
            <div
              v-if="store.combo > 1"
              class="flex flex-col items-end animate-bounce"
            >
              <div class="text-yellow-400 font-black text-2xl tracking-tighter" style="text-shadow: 0 0 15px rgba(250,204,21,0.6)">
                {{ store.combo }} <span class="text-xs">HIT</span>
              </div>
              <div class="text-[9px] text-yellow-300/80 tracking-widest font-bold">COMBO!</div>
            </div>

            <div class="bg-black/40 border border-white/10 px-4 py-2 rounded-lg backdrop-blur-sm flex flex-col items-end">
              <div class="text-[#00f3ff] font-black text-3xl tracking-widest" style="text-shadow: 0 0 15px rgba(0,243,255,0.5)">
                {{ String(miniGameStore.sessionScore).padStart(6, '0') }}
              </div>
              <div class="text-zinc-500 font-bold text-[11px] tracking-wider flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-sm bg-[#00f3ff]/40" />
                STAGE {{ store.stage }} // LOOP {{ store.loop }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== QTE 面板 (断路防幽灵锁) ==================== -->
      <div
        v-if="store.screen === 'playing' && store.qte.active"
        class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 z-30 pointer-events-none"
      >
        <div class="flex items-center gap-3">
          <div
            v-for="(k, idx) in store.qte.keys"
            :key="idx"
            class="w-14 h-14 rounded-xl flex items-center justify-center font-black text-2xl font-mono border-2 transition-all duration-150"
            :class="[
              idx < store.qte.currentIndex
                ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff] scale-95 shadow-[0_0_15px_rgba(0,243,255,0.5)]'
                : idx === store.qte.currentIndex
                ? (store.qte.isRedMoon ? 'bg-red-600/40 border-red-500 text-white scale-110 animate-bounce shadow-[0_0_20px_rgba(239,68,68,0.7)]' : 'bg-purple-600/40 border-purple-400 text-white scale-110 animate-bounce')
                : 'bg-black/80 border-white/20 text-zinc-600'
            ]"
          >
            {{ k }}
          </div>
        </div>

        <div v-if="!store.qte.skillCheckActive" class="text-red-400 text-xs font-bold tracking-widest animate-pulse">
          ⚠ 死亡之眼已锁定：按错键将遭受 50% 核心反噬创伤！
        </div>

        <div v-if="store.qte.skillCheckActive" class="flex flex-col items-center gap-2">
          <div class="text-yellow-300 text-sm font-bold animate-pulse">
            🎯 滑块到达中间高亮区 按 空格 或 左键 释放歼星炮！
          </div>
          <div class="w-80 h-8 bg-black/80 border-2 border-white/30 rounded-full relative overflow-hidden p-1 shadow-[0_0_25px_rgba(0,0,0,0.8)]">
            <div
              class="absolute top-1 bottom-1 bg-yellow-400/40 border-x-2 border-yellow-300 rounded"
              :style="{ left: `${store.qte.sweetSpotMin * 100}%`, width: `${(store.qte.sweetSpotMax - store.qte.sweetSpotMin) * 100}%` }"
            />
            <div
              class="absolute top-0 bottom-0 w-3 bg-[#00f3ff] rounded shadow-[0_0_12px_#00f3ff]"
              :style="{ left: `calc(${store.qte.sliderPos * 100}% - 6px)` }"
            />
          </div>
        </div>
      </div>

      <!-- ==================== 第一关过场：NPC 气泡 ==================== -->
      <div v-if="store.screen === 'supply1'" class="absolute inset-0 pointer-events-none z-50">
        <div
          v-if="!showCardsStage1"
          class="absolute bg-black/90 border-2 border-[#00f3ff] rounded-2xl p-5 pointer-events-auto shadow-[0_0_30px_rgba(0,243,255,0.3)] animate-pop-in"
          style="right: 259px; bottom: 558px; width: 347px;"
        >
          <div class="text-yellow-400 font-black text-sm mb-2 flex items-center gap-2">
            <span>🤖</span> 机械游侠
          </div>
          <div class="text-white text-sm leading-relaxed font-bold mb-4">
            你为什么在打星星，星星是我们的朋友...算了，我给你带了点大家伙，选一个你喜欢的吧！
          </div>
          <button
            @click="showCardsStage1 = true"
            class="w-full py-2.5 bg-[#00f3ff]/20 border border-[#00f3ff] text-[#00f3ff] font-bold text-base rounded-xl hover:bg-[#00f3ff]/30 transition-all hover:scale-105 shadow-[0_0_15px_rgba(0,243,255,0.4)]"
          >
            打开武器库 ⚙️
          </button>
          <div class="absolute -bottom-2.5 right-10 w-5 h-5 bg-black/90 border-r-2 border-b-2 border-[#00f3ff] rotate-45" />
        </div>

        <div v-else class="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-8 pointer-events-auto p-6">
          <div class="text-[#00f3ff] font-black text-2xl tracking-wider">
            选购武器升级 (每张 1000 积分)
          </div>
          <div class="flex gap-6 justify-center max-w-4xl w-full">
            <div
              v-for="card in upgradeCardsStage1"
              :key="card.id"
              class="w-72 p-6 bg-white/5 border-2 rounded-2xl flex flex-col justify-between transition-all"
              :class="store.upgrades.includes(card.id) ? 'border-green-500/60 bg-green-500/10' : 'border-white/20 hover:border-[#00f3ff]/60'"
            >
              <div>
                <div class="text-[#00f3ff] font-black text-xl mb-2">{{ card.name }}</div>
                <div class="text-zinc-400 text-sm leading-relaxed mb-4">{{ card.desc }}</div>
              </div>
              <button
                @click="buyCardStage1(card)"
                :disabled="store.upgrades.includes(card.id) || miniGameStore.sessionScore < card.cost"
                class="w-full py-2.5 rounded-lg font-bold text-sm transition-all"
                :class="[
                  store.upgrades.includes(card.id)
                    ? 'bg-green-600/30 text-green-400 cursor-default border border-green-500/40'
                    : miniGameStore.sessionScore >= card.cost
                    ? 'bg-[#00f3ff]/20 border border-[#00f3ff]/60 text-[#00f3ff] hover:bg-[#00f3ff]/30'
                    : 'bg-white/5 text-zinc-600 border border-white/10 cursor-not-allowed'
                ]"
              >
                {{ store.upgrades.includes(card.id) ? '✓ 已装备' : `购买 (${card.cost} 积分)` }}
              </button>
            </div>
          </div>

          <div class="flex gap-6">
            <button
              @click="continueToStage2"
              class="px-10 py-3.5 bg-gradient-to-r from-[#0088ff] to-[#00f3ff] text-black font-black text-lg rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,243,255,0.4)]"
            >
              继续远征 🚀
            </button>
            <button
              @click="exitToLobby"
              class="px-8 py-3.5 bg-white/10 border border-white/20 text-zinc-300 font-bold text-lg rounded-xl hover:bg-white/20 transition-all"
            >
              返回大厅
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== 第二关过场：见好就收 VS 秘密整备 ==================== -->
      <div v-if="store.screen === 'supply2'" class="absolute inset-0 pointer-events-none z-50">
        <div
          v-if="!showSecretShop"
          class="absolute bg-black/90 border-2 border-yellow-500/70 rounded-2xl p-5 pointer-events-auto shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-pop-in"
          style="right: 259px; bottom: 558px; width: 347px;"
        >
          <div class="text-yellow-400 font-black text-sm mb-2">🤖 机械游侠</div>
          <div class="text-white text-sm leading-relaxed font-bold mb-4">
            你做的还不错，看起来这件事只有你能帮我了。如果你能解决后面那个大家伙，作为报答，我会给你 3 个 CORE 核心，当然你也可以选择见好就收。
          </div>
          <div class="flex gap-2">
            <button
              @click="claimAndExitLobby(1)"
              class="flex-1 py-2.5 bg-yellow-500/20 border border-yellow-500/60 text-yellow-300 font-bold text-xs rounded-xl hover:bg-yellow-500/30 transition-all"
            >
              💰 领1 CORE
            </button>
            <button
              @click="showSecretShop = true"
              class="flex-1 py-2.5 bg-[#00f3ff]/20 border border-[#00f3ff]/60 text-[#00f3ff] font-bold text-xs rounded-xl hover:bg-[#00f3ff]/30 transition-all"
            >
              🔥 我来帮你！
            </button>
          </div>
          <div class="absolute -bottom-2.5 right-10 w-5 h-5 bg-black/90 border-r-2 border-b-2 border-yellow-500/70 rotate-45" />
        </div>

        <div v-else class="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-6 pointer-events-auto p-6">
          <div class="bg-black/90 border border-[#00f3ff]/50 rounded-2xl p-8 max-w-2xl w-full flex flex-col items-center gap-6 text-center shadow-[0_0_40px_rgba(0,243,255,0.2)]">
            <div class="text-[#00f3ff] font-black text-2xl">⚡ 绝密武装整备</div>
            <div class="text-zinc-300 text-sm leading-relaxed">
              我就知道你是个好人！为了帮你干掉它，我给你准备了一些秘密装备：
            </div>
            <div class="grid grid-cols-3 gap-4 w-full text-left my-1">
              <div
                v-for="item in secretShopItems"
                :key="item.id"
                class="p-4 bg-white/5 border border-white/20 rounded-xl"
              >
                <div class="text-yellow-400 font-bold text-sm mb-1">{{ item.name }}</div>
                <div class="text-zinc-400 text-xs leading-relaxed">{{ item.desc }}</div>
              </div>
            </div>
            <div class="text-white font-bold text-base">只需 10000 积分即可全部打包带走！</div>
            <div class="flex gap-4">
              <button
                @click="buyAllSecretItems"
                :disabled="miniGameStore.sessionScore < 10000 || boughtSecretBundle"
                class="px-8 py-3.5 bg-gradient-to-r from-yellow-500 to-amber-400 text-black font-black text-base rounded-xl hover:scale-105 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {{ boughtSecretBundle ? '✓ 准备迎战中...' : '全部购买 (10000 积分) 并出征 ⚔️' }}
              </button>
              <button
                @click="startFinalBossStage"
                class="px-8 py-3.5 bg-white/10 border border-white/20 text-white font-bold text-base rounded-xl hover:bg-white/20 transition-all"
              >
                我是大佬 (直接迎战) →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== 终极胜利结算 (含无尽轮回选项) ==================== -->
      <div
        v-if="store.screen === 'stageClear'"
        class="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center gap-8 z-50 p-6 animate-pop-in pointer-events-auto"
      >
        <div class="text-yellow-400 font-black text-5xl tracking-widest animate-pulse flex items-center gap-4" style="text-shadow: 0 0 30px rgba(250,204,21,0.6)">
          <span>🏆</span> MISSION ACCOMPLISHED · 远征胜利
        </div>

        <div class="bg-black/90 border-2 border-yellow-500/80 rounded-2xl p-8 max-w-xl w-full flex flex-col items-center gap-6 text-center shadow-[0_0_50px_rgba(234,179,8,0.4)]">
          <div class="text-sm text-zinc-300 leading-relaxed">
            <span class="text-yellow-400 font-bold">🤖 机械游侠：</span> 太不可思议了！你竟然真的把那个毁灭星球的核心给撕碎了！信守诺言，这是属于你的 3 颗最高纯度 CORE 能源核心！
          </div>

          <div class="flex gap-6 my-2">
            <div
              v-for="c in 3"
              :key="c"
              class="w-20 h-24 rounded-xl border-2 border-yellow-400 bg-yellow-500/20 flex flex-col items-center justify-center gap-2 shadow-[0_0_20px_rgba(250,204,21,0.5)] animate-bounce"
              :style="{ animationDelay: `${c * 0.15}s` }"
            >
              <div class="text-3xl">💠</div>
              <div class="text-[10px] text-yellow-300 font-black tracking-widest">CORE #{{ c }}</div>
            </div>
          </div>

          <div class="flex justify-around w-full border-t border-b border-white/10 py-3 text-xs">
            <div>
              <div class="text-zinc-500">最终战术积分</div>
              <div class="text-2xl font-black text-[#00f3ff]">{{ miniGameStore.sessionScore }}</div>
            </div>
            <div>
              <div class="text-zinc-500">最高连击数</div>
              <div class="text-2xl font-black text-yellow-400">{{ store.maxCombo }} HIT</div>
            </div>
          </div>

          <div class="flex flex-col gap-3 w-full">
            <button
              @click="enterNextLoop"
              class="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-500 to-[#00f3ff] text-white font-black text-lg rounded-xl hover:scale-105 transition-all shadow-[0_0_25px_rgba(168,85,247,0.6)]"
            >
              🚀 跃迁深空无尽虫洞 (LOOP {{ store.loop + 1 }})
            </button>
            <button
              @click="claimAndExitLobby(3)"
              class="w-full py-3 bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-black font-black text-base rounded-xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(250,204,21,0.5)]"
            >
              领取 3 CORE 并凯旋大厅
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== 远征失败 ==================== -->
      <div
        v-if="store.screen === 'gameOver'"
        class="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-50"
      >
        <div class="text-red-500 font-black text-4xl tracking-widest animate-pulse">
          SYSTEM CRITICAL · 远征终结
        </div>
        <div class="flex gap-4">
          <button
            @click="startNewGame"
            class="px-7 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-bold tracking-wider"
          >
            重新挑战
          </button>
          <button
            @click="exitToLobby"
            class="px-7 py-2.5 border border-white/15 text-zinc-400 rounded-lg hover:text-white"
          >
            返回大厅
          </button>
        </div>
      </div>

      <!-- ==================== 战术暂停弹窗 ==================== -->
      <div
        v-if="isPaused && store.screen === 'playing'"
        class="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 z-50 animate-pop-in"
      >
        <div class="flex flex-col items-center gap-2">
          <div class="text-[#00f3ff] font-black text-3xl tracking-[0.2em] drop-shadow-[0_0_20px_rgba(0,243,255,0.6)]">
            TACTICAL PAUSE · 战术暂停
          </div>
          <div class="text-zinc-400 text-xs tracking-wider font-mono">
            PRESS [ESC] TO RESUME EXPEDITION
          </div>
        </div>

        <div class="flex flex-col gap-3 w-64 mt-2">
          <button
            @click="resumeGame"
            class="px-6 py-3 bg-[#00f3ff]/20 hover:bg-[#00f3ff]/30 border border-[#00f3ff]/60 rounded-xl text-[#00f3ff] font-bold text-sm tracking-widest transition-all hover:scale-105 shadow-[0_0_15px_rgba(0,243,255,0.2)]"
          >
            ▶ 继续远征 (ESC)
          </button>

          <button
            @click="toggleFullscreen"
            class="px-6 py-2.5 bg-white/5 hover:bg-white/15 border border-white/20 rounded-xl text-zinc-300 font-bold text-sm tracking-wider transition-all hover:scale-105"
          >
            {{ isFullscreen ? '⛶ 窗口化 (F11)' : '⛶ 全屏沉浸 (F11)' }}
          </button>

          <button
            @click="exitToLobby"
            class="px-6 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 font-bold text-sm tracking-wider transition-all hover:scale-105"
          >
            ⏏ 放弃并返回大厅
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useStarCatStore } from '../../../stores/starcatStore'
import { useMiniGameStore } from '../../../stores/miniGameStore'
import { StarCatEngine } from '../../../main/services/starcat/engine'
import { UPGRADE_CARDS_STAGE_1, SECRET_SHOP_ITEMS, SECRET_SHOP_BUNDLE_COST } from '../../../main/services/starcat/config'
import * as MiniGameAudio from '../../../main/services/miniGameAudio'
import * as AudioSynth from '../../../main/services/starcat/audioSynth'
import { useTelemetryStore } from '../../../stores/telemetryStore'
const telemetry = useTelemetryStore()
let sessionStartPerf = 0

const emit = defineEmits<{
  exit: []
  'update:stats': [stats: { scrap?: number; cores?: number }]
}>()

const store = useStarCatStore()
const miniGameStore = useMiniGameStore()
const pixiContainer = ref<HTMLDivElement>()

const isFullscreen = ref(false)
const isPaused = ref(false)
let engine: StarCatEngine | null = null
let resizeObserver: ResizeObserver | null = null

function pauseGame() {
  if (store.screen !== 'playing') return
  isPaused.value = true
  engine?.pause()
  AudioSynth.stopSynthBGM()
}

function resumeGame() {
  isPaused.value = false
  engine?.resume()
  AudioSynth.startSynthBGM()
}

const showCardsStage1 = ref(false)
const upgradeCardsStage1 = UPGRADE_CARDS_STAGE_1

const showSecretShop = ref(false)
const secretShopItems = SECRET_SHOP_ITEMS
const boughtSecretBundle = ref(false)

async function toggleFullscreen() {
  try {
    if ((window as any).electron?.window?.toggleFullScreen) {
      const res = await (window as any).electron.window.toggleFullScreen()
      isFullscreen.value = !!res
    } else {
      isFullscreen.value = !isFullscreen.value
    }
  } catch (e) {
    isFullscreen.value = !isFullscreen.value
  }
  setTimeout(() => {
    resizeHandler()
  }, 60)
}

function buyCardStage1(card: any) {
  if (miniGameStore.sessionScore < card.cost || store.upgrades.includes(card.id)) return
  miniGameStore.addSessionScore(-card.cost)
  store.upgrades.push(card.id)
}

function continueToStage2() {
  showCardsStage1.value = false
  if (!engine) return
  engine.exitSupplyToRight(() => {
    store.screen = 'playing'
    engine?.startStage2()
  })
}

function claimAndExitLobby(cores = 1) {
  isPaused.value = false
  miniGameStore.claim()
  emit('update:stats', { cores })
  exitToLobby()
}

function buyAllSecretItems() {
  if (miniGameStore.sessionScore < SECRET_SHOP_BUNDLE_COST || boughtSecretBundle.value) return
  miniGameStore.addSessionScore(-SECRET_SHOP_BUNDLE_COST)
  store.upgrades.push('energy_recycle', 'energy_expand', 'weapon_boost')
  store.maxEnergy = 200
  store.energy = 200
  boughtSecretBundle.value = true

  setTimeout(() => {
    startFinalBossStage()
  }, 400)
}

function startFinalBossStage() {
  if (!engine) return
  engine.exitSupplyToRight(() => {
    store.screen = 'playing'
    store.stage = 3
    engine?.startStage3()
  })
}

function enterNextLoop() {
  store.startNextLoop()
  if (!engine) return
  engine.exitSupplyToRight(() => {
    engine?.startNextLoop()
  })
}

function startNewGame() {
  isPaused.value = false
  store.resetFull()
  miniGameStore.resetSession()
  store.screen = 'playing'
  initEngine()
}

function initEngine(onReady?: () => void) {
  if (!pixiContainer.value) return
  engine?.destroy()
  engine = new StarCatEngine(pixiContainer.value)
  engine.onEnterSupply1 = () => {
    showCardsStage1.value = false
  }
  engine.onEnterSupply2 = () => {
    showSecretShop.value = false
  }
  engine.onStageClear = () => {
    isPaused.value = false
    store.screen = 'stageClear'
  }
  engine.onGameOver = () => {
    isPaused.value = false
    store.screen = 'gameOver'
  }

  engine.init().then(() => {
    resizeHandler()
    onReady?.()
  })
}

const resizeHandler = () => {
  if (!pixiContainer.value || !engine) return
  const p = pixiContainer.value.parentElement
  if (!p) return
  engine.updateDimensions(p.clientWidth, p.clientHeight)
}

function onMouseMove(e: MouseEvent) {
  if (isPaused.value) return
  engine?.handleMouseMove(e)
}
function onMouseDown(e: MouseEvent) {
  if (isPaused.value) return
  engine?.handleMouseDown(e)
}
function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Escape') {
    e.preventDefault()
    if (isPaused.value) {
      resumeGame()
      return
    }
    if (store.screen === 'playing') {
      pauseGame()
      return
    }
    exitToLobby()
    return
  }
  if (isPaused.value) {
    return
  }
  if (e.code === 'F11') {
    e.preventDefault()
    toggleFullscreen()
    return
  }
  engine?.handleKeyDown(e.code)
}
function onKeyUp(e: KeyboardEvent) {
  if (isPaused.value) return
  engine?.handleKeyUp(e.code)
}

async function exitToLobby() {
  isPaused.value = false
  if (isFullscreen.value) {
    try {
      await (window as any).electron?.window?.exitFullScreen?.()
    } catch (e) {}
    isFullscreen.value = false
  }
  await MiniGameAudio.stopCapture().catch(() => {})
  await AudioSynth.stopSynthAudio()
  emit('exit')
}

onMounted(async () => {
  store.screen = 'menu'
  sessionStartPerf = performance.now()
  store.resetFull()
  miniGameStore.resetSession()

  try {
    if ((window as any).electron?.window?.isFullScreen) {
      const fsState = await (window as any).electron.window.isFullScreen()
      isFullscreen.value = !!fsState
    }
  } catch (e) {}

  await MiniGameAudio.startCapture().catch(() => {})

  if (pixiContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      resizeHandler()
    })
    resizeObserver.observe(pixiContainer.value)
  }

  window.addEventListener('resize', resizeHandler)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mousedown', onMouseDown)
})

onUnmounted(async () => {
  resizeObserver?.disconnect()
  if (sessionStartPerf > 0) {
    const elapsedSec = Math.round((performance.now() - sessionStartPerf) / 1000)
    sessionStartPerf = 0
    if (elapsedSec > 0 && elapsedSec < 7200) {
      telemetry.trackLobbyEvent('lobby_minigame_playtime', { game: 'starcat', duration_sec: elapsedSec, ts: Date.now() })
      telemetry.flushNow()
    }
  }

  resizeObserver = null

  if (isFullscreen.value) {
    try {
      (window as any).electron?.window?.exitFullScreen?.()
    } catch (e) {}
    isFullscreen.value = false
  }

  window.removeEventListener('resize', resizeHandler)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mousedown', onMouseDown)

  engine?.destroy()
  engine = null

  await MiniGameAudio.stopCapture().catch(() => {})
  await AudioSynth.stopSynthAudio()
})
</script>

<style scoped>
.clip-slanted {
  clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 100%, 0 100%);
}
@keyframes popIn {
  from { opacity: 0; transform: scale(0.9) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.animate-pop-in {
  animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>