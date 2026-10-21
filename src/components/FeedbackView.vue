// 文件名: src/components/FeedbackView.vue
<template>
  <div 
    class="w-full h-full relative overflow-hidden flex flex-col items-center justify-center select-none perspective-container font-sans transition-colors duration-500"
    :class="currentTheme === 'anime' ? 'bg-gradient-to-br from-[#f8f6fc] via-[#f1f5fc] to-[#eaf0fb] text-slate-800' : 'bg-[#050505] text-slate-200'"
    @mousemove="handleMouseMove"
  >

    <div class="absolute inset-0 pointer-events-none z-0">
        <div 
          class="absolute inset-0 transition-opacity duration-500"
          :class="currentTheme === 'anime' 
            ? 'bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.08)_0%,transparent_100%)]' 
            : 'bg-[radial-gradient(circle_at_center,#121225_0%,#000000_100%)]'"
        ></div>
        <div v-for="star in stars" :key="star.id" class="absolute rounded-full animate-twinkle"
             :style="{ top: star.top + '%', left: star.left + '%', width: star.size + 'px', height: star.size + 'px', backgroundColor: currentTheme === 'anime' ? (star.size > 2 ? '#f472b6' : '#38bdf8') : star.color, animationDelay: star.delay + 's' }">
        </div>
        <div 
          class="absolute top-[-10%] left-[-10%] w-[1000px] h-[1000px] blur-[80px] animate-pulse-slow"
          :class="currentTheme === 'anime' ? 'bg-[#38bdf8]/10' : 'bg-[#00f3ff]/5'"
        ></div>
        <div 
          class="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] blur-[80px] animate-pulse-slow delay-1000"
          :class="currentTheme === 'anime' ? 'bg-[#f472b6]/10' : 'bg-[#ff00aa]/5'"
        ></div>
        <div class="grid-bg absolute inset-0" :class="currentTheme === 'anime' ? 'opacity-15' : 'opacity-10'"></div>
    </div>

    <div class="relative z-10 w-full max-w-[1600px] h-full max-h-[900px] grid grid-cols-12 gap-6 p-8 items-center">

        <div class="col-span-5 flex flex-col justify-center animate-slide-in-left h-full">
            <div class="mb-6 flex-shrink-0">
                <h2 
                  class="text-6xl font-black text-transparent bg-clip-text tracking-tighter drop-shadow-md transition-all duration-500"
                  :class="currentTheme === 'anime' 
                    ? 'bg-gradient-to-r from-[#ff6b9d] via-[#a855f7] to-[#5ce1e6]' 
                    : 'bg-gradient-to-r from-white via-cyan-100 to-white/30'"
                >
                    {{ t('feedback.pageTitle') }}
                </h2>
                <div class="flex items-center gap-4 mt-4">
                    <div 
                      class="h-[3px] w-16 transition-colors duration-500"
                      :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff6b9d] to-[#5ce1e6] shadow-[0_0_10px_#ff6b9d]' : 'bg-primary shadow-[0_0_10px_#00f3ff]'"
                    ></div>
                    <span 
                      class="font-code tracking-[0.5em] text-xs font-bold uppercase transition-colors duration-500"
                      :class="currentTheme === 'anime' ? 'text-[#ff6b9d] opacity-90' : 'text-primary opacity-80'"
                    >
                      TITANCORE // SOUL_ETERNAL
                    </span>
                </div>
            </div>

            <!-- 心愿发送卡片 (1:1 复刻 3.html uplink-form-box) -->
            <div 
              class="backdrop-blur-xl rounded-3xl p-8 relative group overflow-hidden flex flex-col transition-all duration-500"
              :class="currentTheme === 'anime' 
                ? 'bg-white/95 border-2 border-[#f5a3c7] shadow-[0_12px_28px_rgba(180,150,230,0.22)] text-[#1e192b]' 
                : 'bg-[#0a0a10]/80 border border-white/10 shadow-2xl border-t-white/20 text-slate-200'"
            >
                <div 
                  class="absolute top-0 left-0 w-full h-[2px] animate-scan"
                  :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-pink-400 to-transparent' : 'bg-gradient-to-r from-transparent via-primary to-transparent'"
                ></div>

                <div class="flex gap-4 mb-6 flex-shrink-0">
                    <button @click="feedbackType = 'bug'" 
                        class="flex-1 py-4 border rounded-xl transition-all font-bold text-base tracking-widest relative overflow-hidden"
                        :class="[
                          currentTheme === 'anime' ? 'border-pink-200/80 hover:bg-pink-50/50' : 'border-white/10 hover:bg-white/5',
                          feedbackType === 'bug' 
                            ? (currentTheme === 'anime' ? 'text-red-500 border-red-300 bg-red-50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'text-red-400 border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(220,38,38,0.15)]') 
                            : (currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500')
                        ]">
                        <span class="relative z-10 flex items-center justify-center gap-2">{{ t('feedback.bugBtnExact') }}</span>
                    </button>
                    <button @click="feedbackType = 'suggest'" 
                        class="flex-1 py-4 border rounded-xl transition-all font-bold text-base tracking-widest relative overflow-hidden"
                        :class="[
                          currentTheme === 'anime' ? 'border-pink-200/80 hover:bg-pink-50/50' : 'border-white/10 hover:bg-white/5',
                          feedbackType === 'suggest' 
                            ? (currentTheme === 'anime' ? 'text-pink-600 border-pink-300 bg-pink-50 shadow-[0_0_15px_rgba(244,114,182,0.25)]' : 'text-primary border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(0,243,255,0.15)]') 
                            : (currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500')
                        ]">
                        <span class="relative z-10 flex items-center justify-center gap-2">{{ t('feedback.suggestBtnExact') }}</span>
                    </button>
                </div>

                <div class="space-y-5 flex-1 flex flex-col">
                    <div class="relative flex-shrink-0">
                        <label class="block text-[10px] font-bold mb-2 tracking-[0.2em] ml-1 font-code uppercase" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500'">{{ t('feedback.idLabel') }}</label>
                        <input v-model="contact" type="text" maxlength="50" :placeholder="t('feedback.contactPhExact')" 
                            class="w-full p-4 rounded-xl font-sans text-base transition-all shadow-inner focus:outline-none"
                            :class="currentTheme === 'anime' 
                              ? 'bg-white/95 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-pink-400 focus:bg-white' 
                              : 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-primary/5'" />
                    </div>

                    <div class="relative flex-col flex">
                         <label class="block text-[10px] font-bold mb-2 tracking-[0.2em] ml-1 font-code uppercase" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500'">{{ t('feedback.payloadLabelExact') }}</label>
                        <textarea v-model="content" maxlength="2000" :placeholder="t('feedback.contentPhExact')" 
                            class="w-full h-[180px] p-4 rounded-xl font-sans text-base resize-none leading-relaxed custom-scrollbar shadow-inner whitespace-pre-wrap focus:outline-none transition-all"
                            :class="currentTheme === 'anime' 
                              ? 'bg-white/95 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-pink-400 focus:bg-white' 
                              : 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-primary/5'"></textarea>
                        <div class="text-right text-[10px] font-code mt-1" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-600'">{{ content.length }}/2000</div>
                    </div>
                </div>

                <div class="mt-8 relative flex-shrink-0">
                    <button @click="initiateLaunch" :disabled="gateState !== 'idle' || cooldown > 0" 
                        class="w-full h-[70px] relative overflow-hidden rounded-xl transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        :class="currentTheme === 'anime' 
                          ? 'bg-gradient-to-r from-sky-400 via-pink-400 to-purple-400 text-white shadow-[0_4px_25px_rgba(244,114,182,0.35)] hover:brightness-105 border border-pink-200' 
                          : 'bg-white/5 border border-white/10 hover:border-primary hover:bg-primary/10'">
                        <div v-if="gateState === 'idle' && cooldown === 0 && currentTheme !== 'anime'" class="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent translate-x-[-100%] group-hover:animate-scan"></div>
                        <div class="relative z-10 flex items-center justify-center gap-4 h-full">
                            <span 
                              class="font-black font-code tracking-[0.4em] text-lg transition-transform" 
                              :class="[
                                {'group-hover:scale-105': gateState === 'idle' && cooldown === 0},
                                currentTheme === 'anime' ? 'text-white drop-shadow-sm' : 'text-primary'
                              ]"
                            >
                                {{ gateState === 'idle' ? (cooldown > 0 ? t('feedback.cooldown', { s: cooldown }) : t('feedback.launch')) : t('feedback.transmitting') }}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </div>

        <div class="col-span-7 relative flex flex-col items-center justify-center h-full">
            <div class="absolute inset-0 z-20 pointer-events-none overflow-visible">
                <div v-if="particleActive" class="absolute w-8 h-8 rounded-full bg-white shadow-[0_0_30px_white] z-50 transition-all duration-[1500ms] ease-in-out" :class="particleClass"></div>
            </div>

            <!-- 星环与经典 hajimi 猫动画（100% 保留原始动画，仅接入二次元主题色热切换） -->
            <div class="relative w-[600px] h-[600px] flex items-center justify-center transition-all duration-1000 mb-10" :class="gateState === 'transmitting' ? 'brightness-125 scale-105' : 'brightness-100 scale-100'">
                <div 
                  class="absolute inset-[40px] rounded-full backdrop-blur-md border transition-all duration-500"
                  :class="currentTheme === 'anime' 
                    ? 'bg-gradient-to-tr from-white/90 via-pink-50/70 to-white/90 border-pink-200/80 shadow-[0_0_80px_rgba(244,114,182,0.2)]' 
                    : 'bg-gradient-to-tr from-[#0a0a15]/80 via-[#15152a]/50 to-[#0a0a15]/80 border-white/5 shadow-[0_0_100px_rgba(0,243,255,0.05)]'"
                ></div>
                <div class="absolute inset-0 z-10 pointer-events-none">
                    <svg class="w-full h-full" viewBox="0 0 400 400">
                        <defs>
                          <linearGradient id="haloGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" :stop-color="currentTheme === 'anime' ? '#38bdf8' : '#00f3ff'" stop-opacity="0" />
                            <stop offset="50%" :stop-color="currentTheme === 'anime' ? '#f472b6' : '#00f3ff'" stop-opacity="0.8"/>
                            <stop offset="100%" :stop-color="currentTheme === 'anime' ? '#ec4899' : '#ffffff'" stop-opacity="1"/>
                          </linearGradient>
                          <linearGradient id="catFace" x1="50%" y1="0%" x2="50%" y2="100%">
                            <stop offset="0%" stop-color="#ffffff" />
                            <stop offset="100%" :stop-color="currentTheme === 'anime' ? '#fff0f6' : '#e0f5ff'" />
                          </linearGradient>
                        </defs>
                        <g class="animate-spin-slow origin-center opacity-30"><circle cx="200" cy="200" r="190" fill="none" stroke="#fff" stroke-width="0.5" stroke-dasharray="1 10"/><path d="M 200 10 L 200 30 M 200 370 L 200 390 M 10 200 L 30 200 M 370 200 L 390 200" :stroke="currentTheme === 'anime' ? '#f472b6' : '#00f3ff'" stroke-width="2"/></g>
                        <g class="animate-spin-reverse-medium origin-center"><circle cx="200" cy="200" r="160" fill="none" stroke="url(#haloGradient)" stroke-width="2" stroke-dasharray="80 200" stroke-linecap="round" /></g>
                        <g class="animate-orbit origin-center"><circle cx="200" cy="40" r="4" fill="#fff" /><circle cx="200" cy="360" r="3" :fill="currentTheme === 'anime' ? '#f472b6' : '#00f3ff'" opacity="0.8"/></g>
                    </svg>
                </div>

                <div class="absolute inset-[130px] rounded-full flex items-center justify-center z-20">
                     <div 
                       class="absolute inset-[-10px] rounded-full blur-xl z-0 pointer-events-none transition-colors duration-500"
                       :class="currentTheme === 'anime' ? 'bg-pink-300/30' : 'bg-primary/20'"
                     ></div>
                     <div 
                       class="absolute inset-0 rounded-full blur-xl z-10 transition-colors duration-500"
                       :class="currentTheme === 'anime' ? 'bg-white/60' : 'bg-[#000000]/60'"
                     ></div>
                     <div 
                       class="absolute bottom-[40px] w-[120px] h-[20px] blur-lg rounded-[100%] animate-pulse z-10 transition-colors duration-500"
                       :class="currentTheme === 'anime' ? 'bg-pink-400/30' : 'bg-primary/20'"
                     ></div>

                    <div class="relative w-[320px] h-[320px] cursor-pointer group z-30" @click="triggerCatAction">
                        <div class="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full blur-2xl z-20 pointer-events-none"></div>
                        <svg viewBox="0 0 300 300" class="w-full h-full transition-transform duration-500 z-30 relative" :class="[gateState === 'transmitting' ? 'scale-110 animate-shake' : 'scale-100', catActionState === 'jump' ? 'animate-bounce-happy' : 'animate-float-gentle']">
                            <!-- 二次元专属：环绕四角星芒 (100% 对齐 3.html 规范) -->
                            <g v-if="currentTheme === 'anime'" class="transition-opacity duration-500">
                                <path d="M 40 70 L 45 84 L 59 90 L 45 96 L 40 110 L 35 96 L 21 90 L 35 84 Z" fill="#ff85b3" />
                                <path d="M 260 60 L 264 72 L 276 76 L 264 80 L 260 92 L 256 80 L 244 76 L 256 72 Z" fill="#4deeea" />
                            </g>

                            <!-- 右侧招手猫爪/尾巴 (严格对齐 3.html：鲜明深粉立体轮廓与柔粉爪芯，彻底根除浅白底同色不可见缺陷) -->
                            <g class="animate-tail-sway origin-bottom-left" :style="currentTheme === 'anime' ? 'filter: drop-shadow(0 4px 10px rgba(214, 51, 108, 0.35))' : ''">
                              <path d="M 210 220 Q 250 200 240 140" fill="none" :stroke="currentTheme === 'anime' ? '#d6336c' : '#e0f5ff'" :stroke-width="currentTheme === 'anime' ? 24 : 18" stroke-linecap="round" />
                              <path v-if="currentTheme === 'anime'" d="M 210 220 Q 250 200 240 140" fill="none" stroke="#ff9ec7" stroke-width="18" stroke-linecap="round" />
                              <path v-if="currentTheme === 'anime'" d="M 210 220 Q 250 200 240 140" fill="none" stroke="#fff0f6" stroke-width="8" stroke-linecap="round" />
                            </g>

                            <!-- 身体底座 (添加高对比度粉紫描边轮廓) -->
                            <path d="M 100 220 C 90 260, 210 260, 200 220 L 190 180 L 110 180 Z" :fill="currentTheme === 'anime' ? '#ffe0f0' : '#e0f5ff'" :stroke="currentTheme === 'anime' ? '#ff85b3' : 'transparent'" stroke-width="3" />
                            <!-- 项圈与铃铛 -->
                            <path d="M 110 220 Q 150 235 190 220" fill="none" :stroke="currentTheme === 'anime' ? '#ff85b3' : '#1a1a2e'" stroke-width="8" stroke-linecap="round"/>
                            <circle cx="150" cy="228" r="8" :fill="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" :stroke="currentTheme === 'anime' ? '#ffe66d' : '#00f3ff'" stroke-width="2"/>
                            <circle cx="150" cy="228" r="4" :fill="currentTheme === 'anime' ? '#ffe66d' : '#00f3ff'" class="animate-bell-glow"/>

                            <!-- 圆润猫头主体与耳朵 -->
                            <ellipse cx="150" cy="150" rx="90" ry="75" fill="url(#catFace)" :stroke="currentTheme === 'anime' ? '#ff9ec7' : '#d1eeff'" stroke-width="3" />
                            <g class="animate-ear-twitch">
                                <path d="M 90 100 L 60 40 L 130 80 Z" fill="#ffffff" :stroke="currentTheme === 'anime' ? '#ff85b3' : '#d1eeff'" stroke-width="3" stroke-linejoin="round"/>
                                <path d="M 88 90 L 70 55 L 115 80 Z" :fill="currentTheme === 'anime' ? '#ff85b3' : '#ffb7d6'" opacity="0.85"/>
                                <path d="M 210 100 L 240 40 L 170 80 Z" fill="#ffffff" :stroke="currentTheme === 'anime' ? '#ff85b3' : '#d1eeff'" stroke-width="3" stroke-linejoin="round"/>
                                <path d="M 212 90 L 230 55 L 185 80 Z" :fill="currentTheme === 'anime' ? '#ff85b3' : '#ffb7d6'" opacity="0.85"/>
                            </g>
                            <g transform="translate(150, 150)">
                                <ellipse cx="-55" cy="15" rx="14" ry="10" :fill="currentTheme === 'anime' ? 'rgba(255, 117, 168, 0.65)' : '#ff9ec6'" :opacity="currentTheme === 'anime' ? 0.7 : 0.4" />
                                <ellipse cx="55" cy="15" rx="14" ry="10" :fill="currentTheme === 'anime' ? 'rgba(255, 117, 168, 0.65)' : '#ff9ec6'" :opacity="currentTheme === 'anime' ? 0.7 : 0.4" />
                                <g id="eyes">
                                    <template v-if="currentExpression === 'happy' || catActionState === 'jump'">
                                        <path d="M -50 -5 Q -35 -20 -20 -5" fill="none" :stroke="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" stroke-width="6" stroke-linecap="round"/>
                                        <path d="M 20 -5 Q 35 -20 50 -5" fill="none" :stroke="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" stroke-width="6" stroke-linecap="round"/>
                                    </template>
                                    <template v-else-if="currentExpression === 'wink'">
                                        <path d="M -50 -5 L -35 5 L -20 -5" fill="none" :stroke="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                                        <g class="eye-right">
                                            <ellipse cx="35" cy="0" rx="18" ry="22" :fill="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" />
                                            <circle cx="42" cy="-6" r="6" fill="white" />
                                        </g>
                                    </template>
                                    <template v-else>
                                        <ellipse cx="-35" cy="0" rx="18" ry="24" :fill="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" />
                                        <ellipse cx="35" cy="0" rx="18" ry="24" :fill="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" />
                                        <g :style="{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }" class="transition-transform duration-100 ease-out">
                                            <ellipse cx="-35" cy="0" rx="12" ry="16" :fill="currentTheme === 'anime' ? '#4deeea' : '#00f3ff'" opacity="0.9" />
                                            <ellipse cx="35" cy="0" rx="12" ry="16" :fill="currentTheme === 'anime' ? '#4deeea' : '#00f3ff'" opacity="0.9" />
                                            <circle cx="-28" cy="-8" r="6" fill="white" />
                                            <circle cx="42" cy="-8" r="6" fill="white" />
                                        </g>
                                    </template>
                                </g>
                                <path d="M -12 25 Q -6 32 0 25 Q 6 32 12 25" fill="none" :stroke="currentTheme === 'anime' ? '#321d47' : '#1a1a2e'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                            </g>
                            <g transform="translate(150, 30)" class="animate-float-gentle" style="animation-delay: -1.5s">
                                <circle cx="0" cy="0" r="2" :fill="currentTheme === 'anime' ? '#f472b6' : '#00f3ff'" class="animate-ping" />
                            </g>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="absolute bottom-4 right-4 z-20">
                <button 
                  @click="showHistoryModal = true" 
                  class="group flex items-center gap-4 px-6 py-3 rounded-full transition-all shadow-lg backdrop-blur-md"
                  :class="currentTheme === 'anime' 
                    ? 'bg-white/90 border border-pink-200/90 hover:border-pink-400 hover:bg-white text-slate-800' 
                    : 'bg-[#0a0a10]/90 border border-white/10 hover:border-primary/50 hover:bg-white/5 text-white'"
                >
                    <div class="flex flex-col items-end">
                        
                        <span class="text-xs font-bold tracking-wider" :class="currentTheme === 'anime' ? 'text-slate-800' : 'text-white'">{{ t('feedback.history', { count: totalLogs }) }}</span>
                    </div>
                    <div 
                      class="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform relative overflow-hidden"
                      :class="currentTheme === 'anime' ? 'bg-pink-100 border border-pink-300 text-pink-500' : 'bg-primary/10 border border-primary/30 text-primary'"
                    >
                        <div class="absolute inset-0 animate-ping opacity-20" :class="currentTheme === 'anime' ? 'bg-pink-400' : 'bg-primary'"></div>
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                </button>
            </div>
        </div>
    </div>

    <div v-if="showHistoryModal || selectedLog" class="fixed inset-0 z-[100] flex items-center justify-center animate-fade-in p-8" :class="currentTheme === 'anime' ? 'bg-slate-900/30 backdrop-blur-xl' : 'bg-black/95 backdrop-blur-2xl'" @click="closeModal">
        <div class="w-full max-w-[1200px] h-[90vh] rounded-3xl flex overflow-hidden relative transition-all duration-500 shadow-2xl"
             :class="currentTheme === 'anime' 
               ? 'bg-white/95 border border-pink-200/90 shadow-[0_20px_60px_rgba(244,114,182,0.2)] text-slate-800' 
               : 'bg-[#0a0a0a] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] border-t-white/20 text-white'"
             @click.stop>

            <button @click="closeModal" class="absolute top-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full transition-all border"
                    :class="currentTheme === 'anime' ? 'bg-pink-50 hover:bg-pink-100 text-slate-500 hover:text-pink-600 border-pink-200' : 'bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border-white/5'">✕</button>

            <div class="w-[350px] flex flex-col shrink-0 border-r"
                 :class="currentTheme === 'anime' ? 'border-pink-100 bg-pink-50/30' : 'border-white/10 bg-white/2'">
                <div class="p-8 border-b"
                     :class="currentTheme === 'anime' ? 'border-pink-100 bg-pink-50/50' : 'border-white/10 bg-black/20'">
                    <h3 class="font-code font-black tracking-widest text-lg" :class="currentTheme === 'anime' ? 'text-pink-600' : 'text-primary'">SIGNAL LOGS</h3>
                    <p class="text-xs mt-1 uppercase font-bold" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500'">{{ t('feedback.logs', { count: totalLogs }) }}</p>
                </div>
                <div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
                    <div v-for="log in allLogs" :key="log.id" @click="openThread(log)" 
                         class="p-5 rounded-2xl cursor-pointer transition-all border flex flex-col gap-2"
                         :class="selectedLog?.id === log.id 
                           ? (currentTheme === 'anime' ? 'bg-pink-100/70 border-pink-300 shadow-md shadow-pink-200/50' : 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5') 
                           : (currentTheme === 'anime' ? 'border-transparent hover:bg-pink-50/60' : 'border-transparent hover:bg-white/5')">
                         <div class="flex justify-between items-center">
                             <span class="text-xs font-black uppercase tracking-tighter" :class="log.type === 'bug' ? 'text-red-500' : (currentTheme === 'anime' ? 'text-pink-600' : 'text-primary')">{{ log.type }}</span>
                             <span class="text-[10px] font-code font-bold" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-500'">{{ formatTime(log.created_at) }}</span>
                         </div>
                         <div class="text-sm truncate font-medium break-all flex justify-between items-center gap-2" :class="currentTheme === 'anime' ? 'text-slate-700' : 'text-gray-300'">
                            <span>{{ log.content }}</span>
                            <span v-if="log.awaiting_reply" class="text-[10px] text-amber-500 animate-pulse border border-amber-500/50 px-1 rounded-sm shrink-0">WAIT</span>
                         </div>
                    </div>
                     <div v-if="allLogs.length > 0" class="pt-4 mt-2 border-t" :class="currentTheme === 'anime' ? 'border-pink-100' : 'border-white/5'">
                        <button @click="clearHistory" class="w-full text-xs py-2 border border-dashed rounded-lg transition-all"
                                :class="currentTheme === 'anime' ? 'text-slate-500 hover:text-red-500 border-pink-200 hover:border-red-300' : 'text-gray-600 hover:text-red-400 border-white/10 hover:border-red-400/30'">
                            {{ t('feedback.clearHistory') }}
                        </button>
                    </div>
                </div>
            </div>

            <div class="flex-1 flex flex-col relative h-full overflow-hidden"
                 :class="currentTheme === 'anime' ? 'bg-[#faf8fd]' : 'bg-black/40'">
                <div class="absolute inset-0 grid-bg opacity-5 pointer-events-none"></div>

                <div class="px-10 py-6 border-b flex justify-between items-center backdrop-blur-sm relative z-10 shrink-0"
                     :class="currentTheme === 'anime' ? 'border-pink-100 bg-white/70' : 'border-white/10 bg-white/2'">
                    <div class="flex items-center gap-3">
                        <span class="w-2.5 h-2.5 rounded-full animate-ping" :class="currentTheme === 'anime' ? 'bg-pink-500' : 'bg-primary'"></span>
                        <span class="font-code tracking-[0.2em] text-base font-bold uppercase" :class="currentTheme === 'anime' ? 'text-slate-800' : 'text-white'">{{ t('feedback.uplinkChannel') }}</span>
                    </div>
                    <span v-if="selectedLog" class="font-code text-xs" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-500'">Root ID: #{{ selectedLog.id }}</span>
                </div>

                <div class="flex-1 overflow-y-auto p-10 custom-scrollbar relative z-10 space-y-6">
                    <div v-if="selectedLog" class="max-w-4xl mx-auto space-y-6">
                        <div v-for="msg in conversationStream" :key="msg.id || msg.created_at" 
                             class="flex gap-4 items-start animate-slide-in-up"
                             :class="msg.sender_type === 'admin' ? 'flex-row-reverse' : ''">

                            <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-[10px] font-black shrink-0 border shadow-lg font-code"
                                 :class="msg.sender_type === 'admin' 
                                   ? (currentTheme === 'anime' ? 'bg-pink-100 text-pink-600 border-pink-300 shadow-[0_0_15px_rgba(244,114,182,0.3)]' : 'bg-primary/20 text-primary border-primary/50 shadow-[0_0_15px_rgba(0,243,255,0.2)]') 
                                   : (currentTheme === 'anime' ? 'bg-white text-slate-700 border-pink-100' : 'bg-white/10 text-white border-white/10')">
                                {{ msg.sender_type === 'admin' ? 'HAJIMI' : 'USER' }}
                            </div>

                            <div class="p-5 rounded-3xl text-sm leading-6 max-w-[75%] break-words whitespace-pre-wrap shadow-md transition-all"
                                 :class="msg.sender_type === 'admin' 
                                   ? (currentTheme === 'anime' ? 'bg-pink-50 border border-pink-200 text-slate-800 text-right rounded-tr-none shadow-[0_4px_15px_rgba(244,114,182,0.1)]' : 'bg-primary/10 border border-primary/30 text-primary/95 text-right rounded-tr-none shadow-[0_5px_20px_rgba(0,243,255,0.05)]') 
                                   : (currentTheme === 'anime' ? 'bg-white border border-pink-100 text-slate-800 rounded-tl-none' : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-none')">
                                <div class="text-[11px] font-code mb-2 opacity-60 flex items-center gap-2"
                                     :class="msg.sender_type === 'admin' ? (currentTheme === 'anime' ? 'justify-end text-pink-600' : 'justify-end text-primary') : (currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-400')">
                                    <span>{{ formatFullTime(msg.created_at) }}</span>
                                    <span v-if="msg.id === selectedLog.id" class="px-1.5 py-0.2 rounded text-[9px]" :class="currentTheme === 'anime' ? 'bg-pink-100 text-pink-600' : 'bg-white/10'">ROOT</span>
                                </div>
                                {{ msg.content }}
                            </div>
                        </div>

                        <div v-if="conversationStream.length === 1 && !selectedLog.reply" class="flex justify-center pt-4">
                            <div class="px-6 py-2 rounded-full border text-xs font-code tracking-widest animate-pulse"
                                 :class="currentTheme === 'anime' ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white/5 border border-white/10 text-gray-500'">
                                正在等待客服专员回复...
                            </div>
                        </div>
                    </div>

                    <div v-else class="h-full flex flex-col items-center justify-center gap-4 opacity-50" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-600'">
                        <svg class="w-24 h-24 stroke-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span class="text-sm font-medium tracking-wide">请在左侧选择反馈记录</span>
                    </div>
                </div>

                <div v-if="selectedLog" class="p-6 border-t relative z-10 shrink-0"
                     :class="currentTheme === 'anime' ? 'border-pink-100 bg-white/70' : 'border-white/10 bg-black/40'">
                    <div class="max-w-4xl mx-auto flex gap-4 items-center">
                        <textarea v-model="appendContent" maxlength="2000" :placeholder="t('feedback.appendPh')" 
                            class="flex-1 h-14 px-4 py-3 rounded-2xl text-sm focus:outline-none resize-none leading-relaxed custom-scrollbar shadow-inner transition-all"
                            :class="currentTheme === 'anime' 
                              ? 'bg-white border border-pink-200 text-slate-800 placeholder-slate-400 focus:border-pink-400 focus:ring-1 focus:ring-pink-300' 
                              : 'bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-primary/5'"></textarea>
                        <button @click="submitAppendData(selectedLog.id)" :disabled="!appendContent.trim() || isAppending"
                            class="px-8 h-14 rounded-2xl font-code font-bold tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                            :class="currentTheme === 'anime' 
                              ? 'bg-gradient-to-r from-sky-400 to-pink-500 text-white hover:brightness-105 shadow-[0_4px_15px_rgba(244,114,182,0.3)]' 
                              : 'bg-primary/20 border border-primary/50 text-primary hover:bg-primary hover:text-black shadow-[0_0_15px_rgba(0,243,255,0.1)]'">
                            {{ isAppending ? 'SENDING...' : 'TRANSMIT' }}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import Swal from 'sweetalert2';
import { tcToast } from '../utils/tcToast'
import { t } from '../i18n'
import { useTheme } from '../composables/useTheme'

const { currentTheme } = useTheme()

const feedbackStore = useFeedbackStore();
const allLogs = computed(() => feedbackStore.logs);
const totalLogs = computed(() => allLogs.value.length);

type GateState = 'idle' | 'charging' | 'transmitting' | 'error';

const gateState = ref<GateState>('idle');
const feedbackType = ref<'bug' | 'suggest'> ('bug');
const contact = ref('');
const content = ref('');
const particleActive = ref(false);
const particleClass = ref('top-[50%] left-[5%] opacity-0');
const cooldown = ref(0);
const showHistoryModal = ref(false);
const selectedLog = ref<any>(null);
const appendContent = ref('');
const isAppending = ref(false);
const currentExpression = ref<'normal' | 'wink' | 'happy'> ('normal');
const catActionState = ref<'idle' | 'jump'> ('idle');
const eyeOffset = ref({ x: 0, y: 0 });
const stars = ref<Array<{id: number, top: number, left: number, size: number, color: string, delay: number}>>([]);

let cdIntervalTimer: number | null = null;
let isDestroyed = false;
let lastMouseTime = 0;
const THROTTLE_MS = 50;
let activeTimers: ReturnType<typeof setTimeout>[] = [];

function handleMouseMove(e: MouseEvent) {
    if (currentExpression.value !== 'normal') return;
    const now = Date.now();
    if (now - lastMouseTime < THROTTLE_MS) return;
    lastMouseTime = now;

    const limitX = 8; 
    const limitY = 6;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const x = (e.clientX / windowWidth) * 2 - 1;
    const y = (e.clientY / windowHeight) * 2 - 1;
    eyeOffset.value = { x: x * limitX, y: y * limitY };
}

let expressionTimer: number;

function startExpressionLoop() {
    expressionTimer = window.setInterval(() => {
        if (gateState.value === 'transmitting' || isDestroyed) return;
        const rand = Math.random();
        if (rand > 0.6) {
            const type = Math.random() > 0.5 ? 'wink' : 'happy';
            currentExpression.value = type;
            const t = setTimeout(() => {
                const idx = activeTimers.indexOf(t);
                if (idx > -1) activeTimers.splice(idx, 1);
                if (isDestroyed) return;
                if (catActionState.value === 'idle') currentExpression.value = 'normal';
            }, 1800);
            activeTimers.push(t);
        }
    }, 8000);
}

function triggerCatAction() {
    if (catActionState.value === 'jump') return;
    catActionState.value = 'jump';
    const prevExpr = currentExpression.value;
    currentExpression.value = 'happy';
    const t = setTimeout(() => {
        const idx = activeTimers.indexOf(t);
        if (idx > -1) activeTimers.splice(idx, 1);
        if (isDestroyed) return;
        catActionState.value = 'idle';
        currentExpression.value = prevExpr === 'happy' ? 'normal' : prevExpr;
    }, 800);
    activeTimers.push(t);
}

function generateStars() {
    const starCount = 12; 
    const colors = ['#ffffff', '#00f3ff', '#a78bfa', '#ffffff'];
    const newStars = [];
    for (let i = 0; i < starCount; i++) {
        newStars.push({
            id: i,
            top: Math.random() * 100,
            left: Math.random() * 100,
            size: Math.random() * 2 + 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 5
        });
    }
    stars.value = newStars;
}

const conversationStream = computed(() => {
    if (!selectedLog.value) return [];
    const stream: any[] = [];
    
    stream.push({
        id: selectedLog.value.id,
        content: selectedLog.value.content,
        created_at: selectedLog.value.created_at,
        sender_type: 'user'
    });

    const threadMsgs = feedbackStore.threads[selectedLog.value.id] || [];

    if (selectedLog.value.reply && !threadMsgs.some((m: any) => m.sender_type === 'admin')) {
        stream.push({
            id: 'legacy_reply_' + selectedLog.value.id,
            content: selectedLog.value.reply,
            created_at: selectedLog.value.created_at + 1000,
            sender_type: 'admin'
        });
    }

    threadMsgs.forEach((m: any) => {
        stream.push(m);
    });

    return stream.sort((a, b) => a.created_at - b.created_at);
});

async function openThread(log: any) {
    selectedLog.value = log;
    await feedbackStore.fetchThread(log.id);
}

function clearHistory() {
    const isAnime = currentTheme.value === 'anime';
    Swal.fire({
        title: t('feedback.clearTitle'),
        text: t('feedback.clearDesc'),
        icon: 'warning', showCancelButton: true, confirmButtonText: t('feedback.clearConfirm'), cancelButtonText: t('common.cancel'),
        background: isAnime ? '#ffffff' : '#0a0a0a', color: isAnime ? '#1e293b' : '#fff', confirmButtonColor: '#dc2626'
    }).then(async (res) => {
        if (res.isConfirmed) {
            await feedbackStore.clearAll();
            closeModal();
        }
    });
}

function startCooldown() {
    cooldown.value = 30;
    if (cdIntervalTimer) clearInterval(cdIntervalTimer);
    cdIntervalTimer = window.setInterval(() => {
        cooldown.value--;
        if (cooldown.value <= 0) {
            if (cdIntervalTimer) clearInterval(cdIntervalTimer);
            cdIntervalTimer = null;
        }
    }, 1000);
}

async function initiateLaunch() {
    if (totalLogs.value >= 20) {
        tcToast(t('feedback.limitTitle'), t('feedback.limitDesc'), 'warning');
        return;
    }
    if (!content.value.trim()) {
        tcToast(t('feedback.emptyTitle'), '', 'warning');
        return;
    }

    const authStore = useAuthStore();
    gateState.value = 'transmitting';
    triggerCatAction(); 
    particleActive.value = true;
    particleClass.value = 'top-[50%] left-[5%] opacity-100 scale-100 bg-white'; 
    const t1 = setTimeout(() => {
        const idx = activeTimers.indexOf(t1);
        if (idx > -1) activeTimers.splice(idx, 1);
        if (!isDestroyed) particleClass.value = 'top-[50%] left-[75%] opacity-0 scale-50 bg-primary shadow-[0_0_80px_#00f3ff]';
    }, 50);
    activeTimers.push(t1);
    
    const t2 = setTimeout(async () => {
        const idx = activeTimers.indexOf(t2);
        if (idx > -1) activeTimers.splice(idx, 1);
        if (isDestroyed) return;
        try {
            const payload = { type: feedbackType.value, contact: contact.value, content: content.value.trim(), uid: authStore.user?.id || 0, parent_id: 0 };
            await feedbackStore.submitRoot(payload);

            tcToast(t('feedback.hajimiOkTitle'), t('feedback.hajimiOkText'), 'success');
            content.value = ''; 
            startCooldown();
        } catch (e: any) {
            gateState.value = 'error';
            tcToast(e.message && e.message.includes('频率') ? t('feedback.rateLimitTitle') : t('feedback.crashTitle'), e.message || t('feedback.hajimiCatchFail'), e.message && e.message.includes('频率') ? 'warning' : 'error');
        } finally {
            const t3 = setTimeout(() => {
                const idx2 = activeTimers.indexOf(t3);
                if (idx2 > -1) activeTimers.splice(idx2, 1);
                if (!isDestroyed) { gateState.value = 'idle'; particleActive.value = false; }
            }, 1000);
            activeTimers.push(t3);
        }
    }, 1500); 
    activeTimers.push(t2);
}

async function submitAppendData(rootId: number) {
    if (!appendContent.value.trim() || isAppending.value) return;
    isAppending.value = true;
    const authStore = useAuthStore();
    try {
        const payload = { type: selectedLog.value?.type || 'general', contact: selectedLog.value?.contact || contact.value || 'N/A', content: appendContent.value.trim(), uid: authStore.user?.id || 0, parent_id: rootId };
        await feedbackStore.submitAppend(rootId, payload);
        
        appendContent.value = '';
        tcToast(t('feedback.sendOkTitle'), '', 'success');
    } catch (e: any) {
        tcToast(e.message && e.message.includes('频率') ? t('feedback.rateLimitTitle') : t('feedback.appendFailTitle'), e.message || t('feedback.netOrApiAbnormal'), 'error');
    } finally {
        isAppending.value = false;
    }
}

function closeModal() { showHistoryModal.value = false; selectedLog.value = null; }
function formatTime(ts: number) { const d = new Date(ts); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; }
function formatFullTime(ts: number) { const d = new Date(ts); return isNaN(d.getTime()) ? t('feedback.recentLaunch') : d.toLocaleString(); }

onMounted(() => {
    generateStars();
    startExpressionLoop();
});

onUnmounted(() => {
    isDestroyed = true;
    clearInterval(expressionTimer);
    if (cdIntervalTimer) clearInterval(cdIntervalTimer);
    activeTimers.forEach(clearTimeout);
    activeTimers = [];
});
</script>

<style scoped>
.perspective-container { perspective: 1500px; }

.grid-bg {
    background-size: 50px 50px;
    background-image: linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    mask-image: radial-gradient(circle at center, black 40%, transparent 80%);
}

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 243, 255, 0.3); border-radius: 10px; }

@keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes spin-reverse-medium { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
@keyframes scan { 0% { transform: translateX(-100%); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(100%); opacity: 0; } }
@keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 0.8; } 50% { opacity: 0.4; } }
@keyframes twinkle { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.5); opacity: 1; } }
@keyframes floatGentle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes bounceHappy { 0%, 100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-20px) scale(1.05); } 50% { transform: translateY(-15px) scale(1.05); } 80% { transform: translateY(0) scale(0.95); } }
@keyframes earTwitch { 0%, 90%, 100% { transform: rotate(0deg); } 92% { transform: rotate(-4deg); } 94% { transform: rotate(4deg); } 96% { transform: rotate(-4deg); } }
@keyframes bellGlow { 0%, 100% { opacity: 0.6; fill: #00f3ff; } 50% { opacity: 1; fill: #fff; } }
@keyframes tailSway { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(10deg); } }
@keyframes shake { 0%, 100% { transform: translate(0, 0) scale(1.1); } 25% { transform: translate(-2px, 2px) scale(1.1); } 75% { transform: translate(2px, -2px) scale(1.1); } }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
@keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInLeft { 0% { opacity: 0; transform: translateX(-80px); } 100% { opacity: 1; transform: translateX(0); } }

.animate-spin-slow { animation: spin-slow 120s linear infinite; }
.animate-spin-reverse-medium { animation: spin-reverse-medium 100s linear infinite; }
.animate-scan { animation: scan 8s linear infinite; }
.animate-orbit { animation: orbit 80s linear infinite; }
.animate-pulse-slow { animation: pulse 16s ease-in-out infinite; }
.animate-twinkle { animation: twinkle 10s ease-in-out infinite; }
.animate-float-gentle { animation: floatGentle 8s ease-in-out infinite; }
.animate-bounce-happy { animation: bounceHappy 1.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.animate-ear-twitch { animation: earTwitch 10s infinite; transform-origin: center 100px; }
.animate-bell-glow { animation: bellGlow 4s infinite; }
.animate-tail-sway { animation: tailSway 6s ease-in-out infinite; transform-origin: 210px 220px; }
.animate-shake { animation: shake 0.8s linear infinite; }
.animate-fade-in { animation: fadeIn 0.8s ease-out forwards; }
.animate-slide-in-up { animation: slideInUp 1s ease-out forwards; }
.animate-slide-in-left { animation: slideInLeft 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
</style>