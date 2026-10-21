<!-- 文件名: src/components/DiscoveryView.vue -->
<template>
  <div 
    class="h-full flex flex-col relative overflow-hidden animate-fade-in select-none transition-colors duration-300"
    :class="currentTheme === 'anime' 
      ? 'bg-transparent text-[#2d2438]' 
      : currentTheme === 'minimal'
        ? 'bg-transparent'
        : 'bg-[#08080a]'"
    style="font-family: 'MiSans', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif;"
  >
    <!-- 二次元独立主题模式：1:1 像素级复刻 3.html 方案 C -->
    <AnimeGameGrid
      v-if="currentTheme === 'anime'"
      :tabs="staticTabs"
      :active-tab="discoveryStore.activeTab"
      :items="filteredDisplayList"
      :is-fetching="discoveryStore.isFetching"
      :library-set="userLibrarySet"
      @select-tab="(id) => discoveryStore.setTab(id)"
      @card-action="onCardAction"
      @card-collect="onCollect"
    />

    <!-- 极简科技独立主题模式：1:1 像素级复刻设计稿2 方案 B -->
    <TechGameGrid
      v-else-if="currentTheme === 'minimal'"
      :tabs="staticTabs"
      :active-tab="discoveryStore.activeTab"
      :items="filteredDisplayList"
      :is-fetching="discoveryStore.isFetching"
      :library-set="userLibrarySet"
      @select-tab="(id) => discoveryStore.setTab(id)"
      @card-action="onCardAction"
      @card-collect="onCollect"
    />

    <!-- 原版经典工业暗黑主题模式：100% 还原图2母本原生工控流 -->
    <template v-else>
      <!-- 顶部工业频段导轨 -->
      <div class="px-8 pt-5 pb-3 flex-shrink-0 z-20">
        <div class="w-full overflow-x-auto scrollbar-hide py-1">
          <div class="flex items-center gap-3 min-w-max">
            <button 
              v-for="tab in staticTabs" 
              :key="tab.id"
              @click="discoveryStore.setTab(tab.id)"
              :disabled="discoveryStore.isFetching"
              class="relative h-10 px-6 text-xs font-bold tracking-wider transition-all duration-300 flex items-center border uppercase disabled:opacity-40 overflow-hidden group rounded-[4px] cursor-pointer"
              :class="discoveryStore.activeTab === tab.id 
                ? 'bg-[#00f3ff]/15 text-[#00f3ff] border-[#00f3ff]/50 shadow-[0_0_12px_rgba(0,243,255,0.15)] tab-active-glow' 
                : 'bg-white/[0.02] text-zinc-400 border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-white/[0.04]'"
            >
              <span v-if="discoveryStore.activeTab === tab.id" class="absolute inset-0 pointer-events-none sweep-animation bg-gradient-to-r from-transparent via-white/40 to-transparent"></span>
              <span class="relative z-10">{{ tab.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 资产海报流容器 -->
      <div class="flex-1 relative overflow-hidden px-8 pb-20">
        <div v-if="discoveryStore.isFetching" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#090b10]/60 backdrop-blur-sm">
          <div class="w-8 h-8 border-2 border-white/10 border-t-white rounded-full animate-spin mb-3"></div>
          <span class="text-white/60 text-xs font-medium tracking-wider">{{ t('discovery.loading') || 'Loading...' }}</span>
        </div>

        <VirtualList 
          v-if="filteredDisplayList.length > 0"
          :items="filteredDisplayList"
          :columns="currentColumns"
          :aspectRatio="0.75" 
        >
          <template #default="{ items }">
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
              @action="onCardAction(item)"
              @collect="onCollect(item)"
              @cancel="() => {}"
            />
          </template>
        </VirtualList>

        <div v-else-if="!discoveryStore.isFetching" class="h-full flex items-center justify-center text-white/30 font-sans flex-col gap-3">
          <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" class="opacity-30">
            <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7m16 0v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5m16 0h-2.586a1 1 0 0 0-.707.293l-2.414 2.414a1 1 0 0 1-.707.293h-3.172a1 1 0 0 1-.707-.293l-2.414-2.414A1 1 0 0 0 6.586 13H4"/>
          </svg>
          <span class="tracking-wider text-xs">{{ t('discovery.empty') }}</span>
        </div>
      </div>
    </template>

    <!-- 资产详情弹窗 -->
    <GameDetailModal 
      v-if="isDetailVisible"
      :visible="isDetailVisible"
      :gameId="selectedItem?.id || ''"
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
import AnimeGameGrid from '../themes/anime/AnimeGameGrid.vue'
import TechGameGrid from '../themes/minimal/TechGameGrid.vue'
import VirtualList from './VirtualList.vue'
import GameDetailModal from './GameDetailModal.vue'
import { useDiscoveryStore } from '../stores/discoveryStore'
import { useLibraryStore } from '../stores/libraryStore'
import { useTheme } from '../composables/useTheme'

const { currentTheme } = useTheme()

const props = defineProps<{ searchQuery?: string }>()

const discoveryStore = useDiscoveryStore()
const libraryStore = useLibraryStore()
const currentColumns = ref(5)

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
  { id: 'game', label: t('discovery.tabGame') },
  { id: 'tool', label: t('discovery.tabTool') },
  { id: 'patch', label: t('discovery.tabPatch') }
])

const isDetailVisible = ref(false)
const selectedItem = ref<any>(null)

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
  return result
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