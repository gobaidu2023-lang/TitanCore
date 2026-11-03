<!-- 文件名: src/components/DiscoveryView.vue -->
<template>
  <div 
    class="h-full flex flex-col relative overflow-hidden animate-fade-in select-none transition-colors duration-300"
    :class="currentTheme === 'anime' 
      ? 'bg-transparent text-[#2d2438]' 
      : currentTheme === 'minimal'
        ? 'bg-transparent text-slate-200'
        : 'bg-[#08080a] text-white'"
    style="font-family: 'MiSans', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif;"
  >
    <!-- 背景微光氛围层 (按主题自适应，低算力漫反射) -->
    <div 
      v-if="currentTheme === 'minimal'" 
      class="pointer-events-none absolute -top-10 left-1/4 w-[500px] h-[180px] bg-[#00f2ff]/5 blur-[90px] z-0"
    ></div>
    <div 
      v-else-if="currentTheme === 'anime'" 
      class="pointer-events-none absolute -top-12 left-1/4 w-[540px] h-[160px] bg-gradient-to-r from-[#ffeef5]/30 via-[#f0f6ff]/25 to-transparent blur-[80px] z-0"
    ></div>

    <!-- 顶部频段导轨 / 分类标签 -->
    <div 
      class="px-8 pt-5 pb-3 flex-shrink-0 z-20"
      :class="currentTheme === 'minimal' ? 'border-b border-white/[0.04]' : ''"
    >
      <div class="w-full overflow-x-auto scrollbar-hide py-1">
        <div class="flex items-center gap-3 min-w-max">
          <button 
            v-for="tab in staticTabs" 
            :key="tab.id"
            @click="discoveryStore.setTab(tab.id)"
            :disabled="discoveryStore.isFetching"
            class="relative transition-all duration-300 flex items-center cursor-pointer disabled:opacity-40 select-none whitespace-nowrap"
            :class="[
              currentTheme === 'anime'
                ? 'rounded-full font-sans font-bold text-[13px] tracking-wide px-6 py-2 shadow-sm'
                : currentTheme === 'minimal'
                  ? 'px-5 py-2 rounded-xl text-[13.5px] font-medium tracking-wide'
                  : 'h-10 px-6 text-xs font-bold tracking-wider border uppercase rounded-[4px] overflow-hidden group',
              discoveryStore.activeTab === tab.id
                ? (currentTheme === 'anime'
                    ? 'bg-white text-[#1e192b] border-2 border-[#00e5ff] shadow-[0_0_16px_rgba(0,229,255,0.32)] font-black scale-[1.02]'
                    : currentTheme === 'minimal'
                      ? 'text-white bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] font-bold'
                      : 'bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/50 shadow-[0_0_12px_rgba(0,243,255,0.15)] tab-active-glow')
                : (currentTheme === 'anime'
                    ? 'bg-white/70 border border-white/90 text-[#655877] hover:bg-white hover:text-[#c24b78] shadow-[0_2px_8px_rgba(200,180,210,0.08)]'
                    : currentTheme === 'minimal'
                      ? 'text-[#8295ab] hover:text-[#d0e0f2] hover:bg-white/[0.04]'
                      : 'bg-white/[0.02] text-zinc-400 border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-white/[0.04]')
            ]"
          >
            <!-- 经典主题横扫流光 -->
            <span 
              v-if="currentTheme !== 'anime' && currentTheme !== 'minimal' && discoveryStore.activeTab === tab.id" 
              class="absolute inset-0 pointer-events-none sweep-animation bg-gradient-to-r from-transparent via-white/40 to-transparent"
            ></span>
            <!-- 未来科技主题底部微晶细光条 -->
            <div 
              v-if="currentTheme === 'minimal' && discoveryStore.activeTab === tab.id" 
              class="absolute bottom-0 inset-x-2.5 h-[2.5px] bg-[#00f2ff] rounded-full shadow-[0_0_8px_#00f2ff]"
            ></div>
            <span class="relative z-10">{{ tab.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 资产海报流容器 -->
    <div class="flex-1 relative overflow-hidden px-8 pb-20 z-10">
      <!-- 指挥官专属共享游戏库温情横幅 (字号饱满标准，禁用 WAP 蚂蚁字) -->
      <div 
        v-if="discoveryStore.activeTab === 'sharegame' && !isShareBannerDismissed" 
        class="mb-6 p-6 transition-all animate-fade-in flex flex-col gap-2 relative"
        :class="currentTheme === 'anime' 
          ? 'rounded-[24px] bg-gradient-to-r from-pink-50/90 via-purple-50/80 to-white/95 border-2 border-pink-200/90 shadow-[0_4px_20px_rgba(255,182,193,0.18)]' 
          : currentTheme === 'minimal'
            ? 'rounded-xl bg-[#101623]/80 backdrop-blur-xl border border-[#00f2ff]/30 shadow-[0_0_24px_rgba(0,242,255,0.08)]'
            : 'rounded-xl bg-gradient-to-r from-[#00f3ff]/10 via-[#00f3ff]/5 to-transparent border border-[#00f3ff]/20 shadow-[0_0_20px_rgba(0,243,255,0.06)]'"
      >
        <!-- 关闭按钮 -->
        <div class="absolute top-5 right-5 z-10">
          <button
            @click="dismissBanner"
            class="px-3.5 py-1.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border select-none"
            :class="currentTheme === 'anime'
              ? 'rounded-full bg-white/90 hover:bg-white text-pink-600 border-pink-200 shadow-sm'
              : currentTheme === 'minimal'
                ? 'rounded-lg text-[#8295ab] hover:text-[#00f2ff] bg-white/[0.04] hover:bg-[#00f2ff]/10 border-white/10 hover:border-[#00f2ff]/40'
                : 'rounded bg-white/[0.04] hover:bg-[#00f3ff]/15 text-zinc-400 hover:text-[#00f3ff] border-white/10 hover:border-[#00f3ff]/40'"
            :title="t('discovery.dontShowAgain')"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
            <span>{{ t('discovery.dontShowAgain') }}</span>
          </button>
        </div>

        <div class="flex items-center gap-3 pr-32">
          <span class="text-2xl">🎖️</span>
          <h2 
            class="text-xl font-black tracking-wide" 
            :class="currentTheme === 'anime' ? 'text-pink-600' : 'text-white'"
          >
            {{ t('discovery.shareBannerTitle') }}
          </h2>
          <span 
            class="px-2.5 py-1 text-xs font-bold tracking-wider"
            :class="currentTheme === 'anime' 
              ? 'rounded-full bg-pink-100 text-pink-600 border border-pink-200' 
              : currentTheme === 'minimal'
                ? 'rounded-md bg-[#00f2ff]/15 text-[#00f2ff] border border-[#00f2ff]/30'
                : 'rounded uppercase bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/30'"
          >
            {{ t('discovery.shareBannerBadge') }}
          </span>
        </div>
        <p 
          class="text-sm leading-relaxed max-w-4xl" 
          :class="currentTheme === 'anime' ? 'text-[#554c66]' : currentTheme === 'minimal' ? 'text-[#94a3b8]' : 'text-zinc-300'"
        >
          {{ t('discovery.shareBannerDesc') }}
        </p>
      </div>

      <!-- 加载状态指示器 -->
      <div 
        v-if="discoveryStore.isFetching" 
        class="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-sm"
        :class="currentTheme === 'anime' ? 'bg-[#fff5f8]/60' : 'bg-[#090b10]/60'"
      >
        <div 
          class="w-9 h-9 border-2 rounded-full animate-spin mb-3"
          :class="currentTheme === 'anime' 
            ? 'border-[#f5cbdc] border-t-[#ea8fb4]' 
            : currentTheme === 'minimal' 
              ? 'border-white/10 border-t-[#00f2ff]' 
              : 'border-white/10 border-t-white'"
        ></div>
        <span 
          class="text-xs font-medium tracking-wider"
          :class="currentTheme === 'anime' ? 'text-[#7a6b8c]' : 'text-white/60'"
        >
          {{ t('discovery.loading') || 'Loading...' }}
        </span>
      </div>

      <!-- 核心 VirtualList 虚拟列表驱动海量卡片 -->
      <VirtualList 
        v-if="filteredDisplayList.length > 0"
        :items="filteredDisplayList"
        :columns="currentColumns"
        :aspectRatio="themeAspectRatio" 
      >
        <template #default="{ items }">
          <template v-if="currentTheme === 'minimal'">
            <TechGameCard 
              v-for="item in items" 
              :key="item.id"
              :id="String(item.id)" 
              :title="item.basic?.title || item.title" 
              :tags="item.basic?.tags || item.tags || [item.type ? item.type.toUpperCase() : '']" 
              :image="item.basic?.cover || item.cover" 
              :type="item.type"
              :isInLibrary="userLibrarySet.has(resolveContractKey(item))"
              :isInstalled="false"
              :isInstalling="false" 
              :hideControls="false"
              @action="onCardAction(item)"
              @collect="onCollect(item)"
            />
          </template>
          <template v-else-if="currentTheme === 'anime'">
            <AnimeGameCard 
              v-for="item in items" 
              :key="item.id"
              :id="String(item.id)" 
              :title="item.basic?.title || item.title" 
              :tags="item.basic?.tags || item.tags || [item.type ? item.type.toUpperCase() : '']" 
              :image="item.basic?.cover || item.cover" 
              :type="item.type"
              :isInLibrary="userLibrarySet.has(resolveContractKey(item))"
              :isInstalled="false"
              :isInstalling="false" 
              :hideControls="false"
              @action="onCardAction(item)"
              @collect="onCollect(item)"
            />
          </template>
          <template v-else>
            <GameCard 
              v-for="item in items" 
              :key="item.id"
              :id="item.id" 
              :title="item.basic.title" 
              :tags="item.basic.tags || []" 
              :image="item.basic.cover" 
              :type="item.type"
              :isInLibrary="userLibrarySet.has(resolveContractKey(item))"
              :isInstalled="false"
              :isInstalling="false" 
              :hideControls="false"
              :buttonText="t('card.view')"
              @action="onCardAction(item)"
              @collect="onCollect(item)"
              @cancel="() => {}"
            />
          </template>
        </template>
      </VirtualList>

      <!-- 空列表状态 -->
      <div 
        v-else-if="!discoveryStore.isFetching" 
        class="h-full flex items-center justify-center font-sans flex-col gap-3"
        :class="currentTheme === 'anime' ? 'text-[#8a7a9c]' : 'text-white/30'"
      >
        <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="opacity-30">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4"/>
        </svg>
        <span class="tracking-wider text-xs">{{ t('discovery.empty') }}</span>
      </div>
    </div>

    <!-- 独立公告阅读与外链弹窗 -->
    <NoticeArticleModal
      v-if="isNoticeModalVisible"
      :visible="isNoticeModalVisible"
      :noticeItem="selectedNoticeItem"
      @close="isNoticeModalVisible = false"
    />

    <!-- 独立专属：指挥官自费共享游戏正版凭据授权枢纽 -->
    <ShareGameModal
      v-if="isShareGameModalVisible"
      :visible="isShareGameModalVisible"
      :item="selectedShareGameItem"
      @close="isShareGameModalVisible = false"
    />

    <!-- 资产详情弹窗 -->
    <GameDetailModal 
      v-if="isDetailVisible"
      :visible="isDetailVisible"
      :gameId="selectedItem?.id || ''"
      :appId="detailAppId"
      :notice="detailNotice"
      :cover="selectedItem?.basic?.cover || ''"
      :title="selectedItem?.basic?.title || ''"
      :tags="selectedItem?.basic?.tags || []"
      :rating="selectedItem?.basic?.rating || 9.9"
      :description="selectedItem?.desc || selectedItem?.meta_json?.desc || t('discovery.noDesc')"
      :isInstalled="false"
      :isInLibrary="userLibrarySet.has(resolveContractKey(selectedItem))"
      :isDownloading="false"
      :isInstalling="false"
      :progress="0"
      statusText="READY"
      downloadText=""
      :type="selectedItem?.type || ''"
      @close="isDetailVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { t } from '../i18n'
import GameCard from './GameCard.vue'
import AnimeGameCard from '../themes/anime/AnimeGameCard.vue'
import TechGameCard from '../themes/minimal/TechGameCard.vue'
import VirtualList from './VirtualList.vue'
import GameDetailModal from './GameDetailModal.vue'
import ShareGameModal from './modals/ShareGameModal.vue'
import NoticeArticleModal from './modals/NoticeArticleModal.vue'
import { useDiscoveryStore } from '../stores/discoveryStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useSearchStore } from '../stores/searchStore'
import { useTheme } from '../composables/useTheme'
import { useShareBanner } from '../composables/useShareBanner'

const { currentTheme } = useTheme()
const { isShareBannerDismissed, dismissBanner } = useShareBanner()

const props = defineProps<{ searchQuery?: string }>()

const discoveryStore = useDiscoveryStore()
const libraryStore = useLibraryStore()
const searchStore = useSearchStore()
const currentColumns = ref(5)
const themeAspectRatio = computed(() => {
  if (currentTheme.value === 'anime') return 0.75
  return 0.68
})

const isNoticeModalVisible = ref(false)
const selectedNoticeItem = ref<any>(null)

const isShareGameModalVisible = ref(false)
const selectedShareGameItem = ref<any>(null)

const userLibrarySet = ref<Set<string>>(new Set())

const resolveContractKey = (item: any): string => {
  if (!item) return ''
  if (item.type === 'titan_protocol' || item.resource_id?.startsWith('steam_gate_')) {
    const coreId = item.meta?.target_id || item.meta?.steam_appid ||
                   item.basic?.app_id || item.basic?.appId ||
                   item.meta?.app_id || item.meta?.appId ||
                   item.meta?.steam_id || item.basic?.steam_id ||
                   item.id || item.resource_id
    const m = String(coreId).match(/(\d+)$/)
    return m ? m[1] : String(coreId)
  }
  return item.resource_id || item.id
}

const staticTabs = computed(() => [
  { id: 'titan_protocol', label: t('discovery.tabSteam') },
  { id: 'collection', label: t('discovery.tabCollection') },
  { id: 'sharegame', label: t('discovery.tabShare') || '共享游戏' },
])

const isDetailVisible = ref(false)
const selectedItem = ref<any>(null)

// 提取精准 Steam AppID（支持运维手动发布的各层元数据提取），确保红黄牌与补丁提示 100% 触发
const detailAppId = computed(() => {
  if (!selectedItem.value) return ''
  const item = selectedItem.value
  let metaObj = item.meta || {}
  if (!item.meta && item.meta_json) {
    try { metaObj = JSON.parse(item.meta_json) } catch {}
  }
  const candidates = [
    item.app_id, item.appId, item.steam_appid, item.steam_id, item.target_id,
    item.basic?.app_id, item.basic?.appId, item.basic?.steam_id,
    metaObj.steam_appid, metaObj.target_id, metaObj.app_id, metaObj.appId, metaObj.steam_id,
    resolveContractKey(item), item.id, item.resource_id
  ]
  for (const cid of candidates) {
    if (!cid) continue
    const s = String(cid).replace(/^(steam_gate_|titan_protocol_|game_|patch_)/, '').trim()
    const m = s.match(/(\d{3,10})/)
    if (m) return m[1]
  }
  const title = item.basic?.title || item.title || ''
  const titleMatch = String(title).match(/(\d{4,8})/)
  if (titleMatch) return titleMatch[1]
  return ''
})

const detailNotice = computed(() => {
  if (!selectedItem.value) return ''
  const item = selectedItem.value
  return item.notice || item.meta?.notice || item.meta_json?.notice || ''
})

const syncUserLibraryState = async () => {
  try {
    const lib = await window.electron.sys.getUserLibrary()
    if (Array.isArray(lib)) {
      userLibrarySet.value = new Set(lib.map(item => resolveContractKey(item)))
    }
  } catch (e) {
  }
}

const filteredDisplayList = computed(() => {
  const result = discoveryStore.displayList.filter(item => !userLibrarySet.value.has(resolveContractKey(item)))
  // 公告数据卡片默认置顶排列在橱窗前列
  return [...result].sort((a, b) => {
    const isNoticeA = a.type === 'notice' || a.type === 'announcement' || !!a.meta?.pinned
    const isNoticeB = b.type === 'notice' || b.type === 'announcement' || !!b.meta?.pinned
    if (isNoticeA && !isNoticeB) return -1
    if (!isNoticeA && isNoticeB) return 1
    return 0
  })
})

watch(() => discoveryStore.displayList, (val) => {
}, { immediate: true })

const onCardAction = async (item: any) => {
  const rawItem = discoveryStore.rawList.find(r => r.id === item.id) || item

  if (rawItem.type === 'collection') {
    try {
      const childrenRes = await window.electron.invoke('sys:get-collection-children', rawItem.id)
      if (childrenRes && childrenRes.length > 0) {
        window.dispatchEvent(new CustomEvent('titan-navigate', { 
          detail: { view: 'collection', payload: { title: rawItem.title || item.basic?.title, cover: rawItem.cover || item.basic?.cover, data: childrenRes } } 
        }))
      }
    } catch(e) { }
  } else if (rawItem.type === 'notice' || rawItem.type === 'announcement' || item.type === 'notice' || item.type === 'announcement' || rawItem.meta?.type === 'notice') {
    selectedNoticeItem.value = { 
      ...rawItem, 
      basic: item.basic, 
      meta: item.meta || rawItem.meta,
      updated_at: rawItem.updated_at || item.updated_at || rawItem.created_at
    }
    isNoticeModalVisible.value = true
  } else if (rawItem.type === 'sharegame' || item.type === 'sharegame') {
    selectedShareGameItem.value = { ...rawItem, basic: item.basic }
    isShareGameModalVisible.value = true
  } else {
    selectedItem.value = { ...rawItem, basic: item.basic }
    isDetailVisible.value = true
  }
}

const onCollect = async (item: any) => {
  const contractKey = resolveContractKey(item)
  const next = new Set(userLibrarySet.value)
  next.add(contractKey)
  userLibrarySet.value = next

  try {
    await libraryStore.toggleItem(item.id, {
      title: item.basic?.title || '',
      type: item.type || '',
      cover: item.basic?.cover || '',
      desc: item.basic?.desc || item.meta?.desc || ''
    })
  } catch (e) {
    const rollback = new Set(userLibrarySet.value)
    rollback.delete(contractKey)
    userLibrarySet.value = rollback
  }
}

// 网格断点：默认窗口 1440 → 5 列；1080P/2K 全屏 → 6 列
const updateColumns = () => {
  const w = window.innerWidth
  if (w < 1024) currentColumns.value = 3        // 小窗
  else if (w < 1280) currentColumns.value = 4   // 窄屏笔记本
  else if (w < 1600) currentColumns.value = 5   // 默认窗口 (1440) → 5
  else if (w < 2560) currentColumns.value = 6   // 1080P/2K 全屏 → 6
  else if (w < 3840) currentColumns.value = 7   // 准 4K / 超宽
  else currentColumns.value = 8                 // 4K
}

let unsubLibUpdate: (() => void) | null = null

onMounted(async () => {
  searchStore.initRadar().catch(() => {})
  updateColumns()
  window.addEventListener('resize', updateColumns)
  await syncUserLibraryState()

  unsubLibUpdate = window.electron.on('titan:library-updated', () => {
    syncUserLibraryState()
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns)
  unsubLibUpdate?.()
})
</script>

<style scoped>
@keyframes lightSweep {
  0% { transform: translateX(-100%); opacity: 0.8; }
  100% { transform: translateX(100%); opacity: 0; }
}
.sweep-animation {
  animation: lightSweep 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
</style>