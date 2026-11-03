<template>
  <div 
    class="h-full flex flex-col relative overflow-hidden select-none font-sans"
    :class="[
      { 'tc-warp-exit': isExiting, 'tc-warp-enter': !isExiting },
      currentTheme === 'anime' || currentTheme === 'minimal' ? 'bg-transparent text-white' : 'bg-[#020204] text-white'
    ]"
  >
    <!-- 背景：重工业科幻战术网格与环境辉光 -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div class="absolute inset-0 tc-grid-bg opacity-20"></div>
      <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[55vw] h-[55vw] bg-[radial-gradient(circle,rgba(0,243,255,0.06)_0%,transparent_65%)] rounded-full tc-pulse-glow"></div>
      <div v-if="currentTheme !== 'minimal' && currentTheme !== 'anime'" class="absolute inset-0 bg-gradient-to-t from-[#020204] via-transparent to-[#020204]/90 opacity-90"></div>
      <div class="tc-laser-sweep"></div>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar relative z-10 scroll-smooth flex flex-col">
      <!-- 🟢 重构：吃豆人光球巡航三行动画 (3秒极低开销纯 CSS 硬件加速) -->
      <div v-if="searchStore.isSearching" class="flex-1 flex flex-col items-center justify-center p-8 min-h-[480px]">
        <div class="relative w-[340px] h-[160px] flex flex-col justify-between py-2 select-none">
          <!-- 第一行轨道：从左至右 -->
          <div class="relative h-6 flex items-center justify-between px-3">
            <span v-for="d in 7" :key="'r1-'+d" :class="'pac-dot r1-d'+d"></span>
          </div>
          <!-- 第二行轨道：从右至左 (反向排列) -->
          <div class="relative h-6 flex items-center justify-between px-3 flex-row-reverse">
            <span v-for="d in 7" :key="'r2-'+d" :class="'pac-dot r2-d'+d"></span>
          </div>
          <!-- 第三行轨道：从左至右 -->
          <div class="relative h-6 flex items-center justify-between px-3">
            <span v-for="d in 7" :key="'r3-'+d" :class="'pac-dot r3-d'+d"></span>
          </div>
          <!-- 巡航光球实体 -->
          <div class="pac-orb"></div>
        </div>
        
        <div class="mt-8 flex flex-col items-center gap-2">
          <div class="font-code text-xs tracking-[0.3em] text-[#00f3ff] uppercase font-bold flex items-center gap-2">
            <span class="inline-block w-2 h-2 bg-[#00f3ff] animate-ping rounded-full"></span>
            UPLINKING MATRIX // HARVESTING DATA
          </div>
          <div class="text-[11px] text-gray-500 font-mono">
            {{ t('search.deploying') }}
          </div>
        </div>
      </div>

      <!-- 搜索结果实体 -->
      <div v-else class="flex-1 flex flex-col p-8 pt-10 max-w-[1800px] mx-auto w-full pb-24">
        <!-- 云端矩阵板块 -->
        <section v-if="matrixItems.length > 0" class="space-y-6">
          <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-6 bg-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.8)]"></div>
              <h3 class="text-2xl font-black tracking-wider text-white flex items-center gap-2">
                {{ t('search.cloudMatrix') }}
                <span class="text-xs font-medium text-[#00f3ff] px-2 py-0.5 rounded bg-[#00f3ff]/10 border border-[#00f3ff]/30">已同步</span>
              </h3>
            </div>
            <button 
              @click="executeTacticalAbort" 
              type="button" 
              class="group flex items-center gap-2.5 px-4 py-2 rounded bg-[#0a0a0f] border border-white/10 hover:border-[#00f3ff]/60 transition-all duration-300 active:scale-95 shadow-md hover:shadow-[0_0_15px_rgba(0,243,255,0.2)]" 
              :title="t('search.escMapTitle')"
            >
              <span class="px-1.5 py-0.5 rounded bg-white/10 group-hover:bg-[#00f3ff] text-white group-hover:text-black font-black font-code text-xs transition-colors">ESC</span>
              <span class="text-xs text-gray-400 group-hover:text-white transition-colors font-bold tracking-wider">{{ t('search.returnNexus') }}</span>
            </button>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8">
            <div 
              v-for="(item, index) in matrixItems" 
              :key="item.id" 
              class="relative group tc-card-entry" 
              :style="{ animationDelay: `${index * 35}ms` }"
            >
              <div class="absolute -inset-1 bg-[#00f3ff]/0 rounded-xl blur-lg transition-all duration-300 group-hover:bg-[#00f3ff]/15"></div>
              <div 
                class="relative z-10 rounded-xl overflow-hidden backdrop-blur-sm border transition-all duration-300 shadow-lg group-hover:-translate-y-1"
                :class="currentTheme === 'minimal' ? 'bg-[#101624]/90 border-[#00f2ff]/25 group-hover:border-[#00f2ff]/60 shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : 'bg-[#0a0a0f]/90 border-white/[0.06] group-hover:border-[#00f3ff]/50'"
              >
                <GameCard 
                  :id="item.id" 
                  :title="item.title" 
                  :tags="parseTags(item.tags)" 
                  :rating="item.rating || 9.9" 
                  :image="item.cover" 
                  :type="item.type" 
                  :isInLibrary="false" 
                  :isInstalled="false" 
                  @action="handleCardAction(item)" 
                  @collect="onCollect(item)" 
                />
              </div>

              <!-- 库存状态角标：三态精准覆盖 -->
              <div 
                v-if="item.stock === 'miss' || item.stock === 'dead'" 
                class="absolute -top-2 -left-2 z-30 px-2 py-0.5 rounded bg-zinc-800/90 text-zinc-400 text-[10px] font-bold border border-zinc-700 shadow"
              >
                {{ t('search.stockMiss') }}
              </div>
              <div 
                v-else-if="item.stock === 'restocking'" 
                class="absolute -top-2 -left-2 z-30 px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[10px] font-bold border border-yellow-500/40 shadow-[0_0_10px_rgba(234,179,8,0.2)] animate-pulse"
              >
                {{ t('search.stockDeploying') }}
              </div>
              <div 
                v-else-if="item.stock === 'hit'" 
                class="absolute -top-2 -left-2 z-30 px-2 py-0.5 rounded bg-[#00f3ff]/20 text-[#00f3ff] text-[10px] font-bold border border-[#00f3ff]/40 shadow-[0_0_8px_rgba(0,243,255,0.2)]"
              >
                {{ t('search.stockReady') }}
              </div>

              <div 
                v-if="searchStore.checkRadarStatus(item.app_id || item.id) === 'red'" 
                class="absolute -top-2 -right-2 z-30 w-5 h-5 bg-red-500 rounded-full border-2 border-[#020204] shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse" 
                :title="t('search.denuvoDesc')"
              ></div>
              <div 
                v-else-if="searchStore.checkRadarStatus(item.app_id || item.id) === 'yellow'" 
                class="absolute -top-2 -right-2 z-30 w-5 h-5 bg-yellow-500 rounded-full border-2 border-[#020204] shadow-[0_0_15px_rgba(234,179,8,0.8)]" 
                :title="t('search.dependencyDesc')"
              ></div>
            </div>
          </div>
        </section>

        <!-- 本地资产与工具板块 -->
        <section v-if="toolItems.length > 0" class="space-y-6 mt-16">
          <div class="flex items-center justify-between border-b border-white/10 pb-4 mb-8">
            <div class="flex items-center gap-3">
              <div class="w-1.5 h-6 bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.8)]"></div>
              <h3 class="text-2xl font-black tracking-wide text-gray-200">{{ t('search.localAssetsSub') }}</h3>
            </div>
            <button 
              v-if="matrixItems.length === 0" 
              @click="executeTacticalAbort" 
              type="button" 
              class="group flex items-center gap-2.5 px-4 py-2 rounded bg-[#0a0a0f] border border-white/10 hover:border-yellow-500/60 transition-all duration-300 active:scale-95 shadow-md hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]" 
              :title="t('search.escMapTitle')"
            >
              <span class="px-1.5 py-0.5 rounded bg-white/10 group-hover:bg-yellow-500 text-white group-hover:text-black font-black font-code text-xs transition-colors">ESC</span>
              <span class="text-xs text-gray-400 group-hover:text-white transition-colors font-bold tracking-wider">{{ t('search.returnNexus') }}</span>
            </button>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8 opacity-95">
            <div 
              v-for="(item, index) in toolItems" 
              :key="item.id" 
              class="relative group tc-card-entry" 
              :style="{ animationDelay: `${index * 35}ms` }"
            >
              <div class="absolute -inset-1 bg-yellow-500/0 rounded-xl blur-lg transition-all duration-300 group-hover:bg-yellow-500/10"></div>
              <div class="relative z-10 bg-[#0c0d12]/90 rounded-xl overflow-hidden backdrop-blur-sm border border-white/[0.06] group-hover:border-yellow-500/50 transition-all duration-300 shadow-lg group-hover:-translate-y-1">
                <GameCard 
                  :id="item.id" 
                  :title="item.title" 
                  :tags="parseTags(item.tags)" 
                  :rating="item.rating || 5.0" 
                  :image="item.cover" 
                  :type="item.type" 
                  :isInLibrary="false" 
                  :isInstalled="false" 
                  @action="handleCardAction(item)" 
                  @collect="onCollect(item)" 
                />
              </div>
            </div>
          </div>
        </section>

        <!-- 未命中/错误兜底 -->
        <section v-if="matrixItems.length === 0 && toolItems.length === 0" class="flex-1 flex flex-col items-center justify-center text-center px-8 py-12 relative tc-card-entry">
          <div class="relative mb-6 mt-6">
            <h1 class="text-6xl md:text-8xl font-black tracking-[0.25em] uppercase text-[#00f3ff] font-code" style="text-shadow: 0 0 35px rgba(0,243,255,0.5), 0 0 70px rgba(0,243,255,0.2);">
              {{ errorState.code }}
            </h1>
          </div>

          <div class="w-80 border-b border-[#00f3ff]/30 mb-6"></div>

          <p class="text-base text-gray-300 font-medium tracking-wide mb-12 max-w-xl leading-relaxed">
            {{ errorState.message }}
          </p>

          <div class="w-full max-w-xl mb-16 relative group">
            <div class="relative flex items-center bg-black/90 border border-white/20 rounded-full p-1.5 shadow-[0_0_30px_rgba(0,243,255,0.12)] group-hover:border-[#00f3ff]/60 transition-all duration-300">
              <input 
                v-model="searchQuery" 
                @keyup.enter.prevent="handleSearchAction" 
                type="text" 
                :placeholder="t('search.placeholder')" 
                class="flex-1 bg-transparent border-none text-base font-bold text-white px-6 py-3 focus:outline-none placeholder:text-white/20 font-code" 
              />
              <button 
                type="button" 
                @click.prevent="handleSearchAction" 
                class="px-8 py-3 bg-[#00f3ff] hover:bg-white text-black font-black rounded-full transition-all duration-300 text-sm tracking-widest uppercase shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:shadow-[0_0_25px_rgba(255,255,255,0.6)]"
              >
                {{ t('search.btnSearch') }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <ShareGameModal 
      v-if="isShareModalVisible" 
      :visible="isShareModalVisible" 
      :item="selectedItem" 
      @close="isShareModalVisible = false" 
    />

    <GameDetailModal 
      v-if="isDetailVisible" 
      :visible="isDetailVisible" 
      :gameId="selectedItem?.id || ''" 
      :appId="selectedItem?.app_id || ''" 
      :stock="selectedItem?.stock || ''" 
      :votes="selectedItem?.votes" 
      :notice="searchStore.searchNotice || selectedItem?.notice" 
      :from-search="true" 
      :cover="selectedItem?.cover || ''" 
      :title="selectedItem?.title || ''" 
      :tags="parseTags(selectedItem?.tags)" 
      :rating="selectedItem?.rating || 9.9" 
      :description="selectedItem?.desc || ''" 
      :isInstalled="false" 
      :isInLibrary="false" 
      :isDownloading="false" 
      :isInstalling="false" 
      :progress="0" 
      statusText="READY" 
      downloadText="" 
      :type="selectedItem?.type || ''" 
      @close="onDetailClose" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSearchStore } from '../stores/searchStore'
import { t } from '../i18n'
import { tcToast } from '../utils/tcToast'
import GameCard from './GameCard.vue'
import GameDetailModal from './GameDetailModal.vue'
import ShareGameModal from './modals/ShareGameModal.vue'
import { useTheme } from '../composables/useTheme'

const { currentTheme } = useTheme()

const searchStore = useSearchStore()
const searchQuery = ref('')
const isExiting = ref(false)
let exitTimer: ReturnType<typeof setTimeout> | null = null

const isDetailVisible = ref(false)
const isShareModalVisible = ref(false)
const selectedItem = ref<any>(null)

const parseTags = (tags: string | undefined) => (tags || '').split(',').filter(Boolean)

const matrixItems = computed(() => searchStore.searchResults.filter(i => ['titan_protocol', 'collection'].includes(i.type)))
const toolItems = computed(() => searchStore.searchResults.filter(i => ['game', 'patch', 'tool', 'wallpaper'].includes(i.type)))

const executeTacticalAbort = () => {
  if (isExiting.value) return
  isExiting.value = true
  if (exitTimer) clearTimeout(exitTimer)
  exitTimer = setTimeout(() => {
    exitTimer = null
    searchStore.clearSearch()
    isExiting.value = false
  }, 160)
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (isDetailVisible.value) {
      isDetailVisible.value = false
      return
    }
    executeTacticalAbort()
  }
}

const handleSearchAction = () => {
  const kw = searchQuery.value.trim()
  if (kw) {
    searchStore.doSearch(kw)
    searchQuery.value = ''
  }
}

const errorState = computed(() => {
  const err = searchStore.currentError
  const kw = searchStore.lastKeyword

  switch (err) {
    case 'QUOTA_EXHAUSTED':
      return { code: 'QUOTA EXHAUSTED', message: t('search.quotaExhausted') }
    case 'NETWORK_ERROR':
      return { code: 'CONNECTION LOST', message: t('search.connLost') }
    case 'KEYWORD_INVALID':
      return { code: 'INVALID QUERY', message: t('search.invalidQuery') }
    case 'RESOURCE_NOT_FOUND':
    default:
      return { code: 'NO SIGNAL', message: t('search.noSignal', { kw }) }
  }
})

const handleCardAction = async (item: any) => {
  if (item.type === 'collection') {
    try {
      const childrenRes = await window.electron.invoke('sys:get-collection-children', item.id)
      if (childrenRes?.length > 0) {
        window.dispatchEvent(
          new CustomEvent('titan-navigate', {
            detail: {
              view: 'collection',
              payload: { title: item.title, cover: item.cover, data: childrenRes }
            }
          })
        )
      }
    } catch (e) {
      console.error('[Search] 合集加载失败:', e)
    }
  } else {
    if (item.type === 'sharegame') {
      selectedItem.value = item
      isShareModalVisible.value = true
      return
    }
    selectedItem.value = item
    isDetailVisible.value = true
  }
}

watch(
  () => searchStore.autoOpenItem,
  (newItem) => {
    if (newItem) handleCardAction(newItem)
  },
  { immediate: true }
)

const onDetailClose = () => {
  isDetailVisible.value = false
  if (searchStore.searchResults.length === 1) {
    window.dispatchEvent(new CustomEvent('titan-navigate', { detail: 'nexus_gate' }))
  }
}

const onCollect = async (item: any) => {
  try {
    await window.electron.invoke('sys:toggle-library', item.id, {
      title: item.title || '',
      type: item.type || '',
      cover: item.cover || ''
    })
    tcToast(t('search.favOk'), '', 'success')
  } catch (e) {
    tcToast(t('search.favFail'), '', 'error')
  }
}

onMounted(() => {
  searchStore.initRadar()
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  if (exitTimer) clearTimeout(exitTimer)
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 5px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,243,255,0.4); }

.tc-grid-bg {
  background-image: 
    linear-gradient(to right, rgba(0, 243, 255, 0.05) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0, 243, 255, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
}

@keyframes tc-enter {
  0% { opacity: 0; transform: scale(0.98) translateY(8px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
.tc-warp-enter {
  animation: tc-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes tc-exit {
  0% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.97) translateY(-4px); }
}
.tc-warp-exit {
  animation: tc-exit 0.15s cubic-bezier(0.4, 0, 1, 1) forwards;
  pointer-events: none;
}

@keyframes laser-sweep {
  0% { transform: translateY(-100vh); opacity: 0; }
  30% { opacity: 0.8; }
  100% { transform: translateY(100vh); opacity: 0; }
}
.tc-laser-sweep {
  position: absolute;
  inset-x: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, #00f3ff, #fff, #00f3ff, transparent);
  box-shadow: 0 0 15px #00f3ff, 0 0 30px #00f3ff;
  animation: laser-sweep 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  pointer-events: none;
}

@keyframes card-materialize {
  0% { opacity: 0; transform: translateY(14px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.tc-card-entry {
  animation: card-materialize 0.28s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.tc-pulse-glow {
  animation: pulse-ambient 6s ease-in-out infinite;
}
@keyframes pulse-ambient {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.7; transform: translate(-50%, -50%) scale(1.08); }
}

/* 🟢 吃豆人 3 秒巡航纯 CSS 硬件加速动效 */
.pac-dot {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  background: rgba(0, 243, 255, 0.35);
  box-shadow: 0 0 6px rgba(0, 243, 255, 0.2);
  display: inline-block;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

/* 第一行吃豆点延迟消失 */
.r1-d1 { animation: dotFade1 3s infinite; animation-delay: 0.05s; }
.r1-d2 { animation: dotFade1 3s infinite; animation-delay: 0.15s; }
.r1-d3 { animation: dotFade1 3s infinite; animation-delay: 0.28s; }
.r1-d4 { animation: dotFade1 3s infinite; animation-delay: 0.42s; }
.r1-d5 { animation: dotFade1 3s infinite; animation-delay: 0.58s; }
.r1-d6 { animation: dotFade1 3s infinite; animation-delay: 0.72s; }
.r1-d7 { animation: dotFade1 3s infinite; animation-delay: 0.88s; }

/* 第二行吃豆点延迟消失 */
.r2-d1 { animation: dotFade2 3s infinite; animation-delay: 1.05s; }
.r2-d2 { animation: dotFade2 3s infinite; animation-delay: 1.18s; }
.r2-d3 { animation: dotFade2 3s infinite; animation-delay: 1.32s; }
.r2-d4 { animation: dotFade2 3s infinite; animation-delay: 1.48s; }
.r2-d5 { animation: dotFade2 3s infinite; animation-delay: 1.62s; }
.r2-d6 { animation: dotFade2 3s infinite; animation-delay: 1.76s; }
.r2-d7 { animation: dotFade2 3s infinite; animation-delay: 1.90s; }

/* 第三行吃豆点延迟消失 */
.r3-d1 { animation: dotFade3 3s infinite; animation-delay: 2.05s; }
.r3-d2 { animation: dotFade3 3s infinite; animation-delay: 2.18s; }
.r3-d3 { animation: dotFade3 3s infinite; animation-delay: 2.32s; }
.r3-d4 { animation: dotFade3 3s infinite; animation-delay: 2.48s; }
.r3-d5 { animation: dotFade3 3s infinite; animation-delay: 2.62s; }
.r3-d6 { animation: dotFade3 3s infinite; animation-delay: 2.76s; }
.r3-d7 { animation: dotFade3 3s infinite; animation-delay: 2.90s; }

@keyframes dotFade1 {
  0% { opacity: 1; transform: scale(1); }
  28% { opacity: 0; transform: scale(0); }
  98% { opacity: 0; }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes dotFade2 {
  0%, 33% { opacity: 1; transform: scale(1); }
  62% { opacity: 0; transform: scale(0); }
  98% { opacity: 0; }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes dotFade3 {
  0%, 66% { opacity: 1; transform: scale(1); }
  94% { opacity: 0; transform: scale(0); }
  98% { opacity: 0; }
  100% { opacity: 1; transform: scale(1); }
}

.pac-orb {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #00f3ff;
  box-shadow: 0 0 15px #00f3ff, 0 0 30px rgba(0, 243, 255, 0.8);
  animation: pacOrbTrack 3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  pointer-events: none;
}

@keyframes pacOrbTrack {
  0% {
    top: 13px;
    left: 12px;
    transform: translate(-50%, -50%) scale(1);
  }
  30% {
    top: 13px;
    left: 328px;
    transform: translate(-50%, -50%) scale(1.25);
  }
  33% {
    top: 80px;
    left: 328px;
    transform: translate(-50%, -50%) scale(1.25);
  }
  63% {
    top: 80px;
    left: 12px;
    transform: translate(-50%, -50%) scale(1.5);
  }
  66% {
    top: 147px;
    left: 12px;
    transform: translate(-50%, -50%) scale(1.5);
  }
  96% {
    top: 147px;
    left: 328px;
    transform: translate(-50%, -50%) scale(1.85);
    box-shadow: 0 0 25px #00f3ff, 0 0 50px #00f3ff;
  }
  100% {
    top: 147px;
    left: 328px;
    transform: translate(-50%, -50%) scale(2.2);
    opacity: 0;
  }
}
</style>