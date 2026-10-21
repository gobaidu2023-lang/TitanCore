<!-- 文件名: src/themes/anime/AnimeGameGrid.vue -->
<!-- Sakura 初樱晨曦 · 现代二次元通用资产流矩阵 (Universal Anime Grid) -->
<!-- 遵照最高指令：超大圆弧药丸气泡 (rounded-full) + 饱满 3:4 大画幅自适应网格 (区别于常规瘦长卡片) + 果冻弹簧大弹跳手感 -->
<!-- 完美支撑发现大厅 (Discovery) 与 游戏仓库 (Library) 共同复用 -->
<template>
  <div class="anime-game-grid h-full flex flex-col relative overflow-hidden select-none">
    
    <!-- 顶部极淡晨曦微晕漫反射 (护眼自然柔光) -->
    <div class="pointer-events-none absolute -top-12 left-1/4 w-[540px] h-[160px] bg-gradient-to-r from-[#ffeef5]/30 via-[#f0f6ff]/25 to-transparent blur-[80px] z-0"></div>

    <!-- 1. 顶部分类气泡胶囊栏 / 管理条 (彻底移除生硬横线，悬浮白瓷奶糖胶囊) -->
    <div class="px-8 pt-4 pb-2 flex items-center justify-between flex-shrink-0 z-20">
      
      <!-- 管理模式条插槽优先（仓库批量管理时展示） -->
      <div v-if="$slots['manage-bar']" class="w-full">
        <slot name="manage-bar" />
      </div>

      <!-- 常规顶栏：充气气泡药丸胶囊组 + 右侧操作区插槽 -->
      <template v-else>
        <div class="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="$emit('select-tab', tab.id)"
            :disabled="isFetching"
            class="anime-tab-bubble relative rounded-full font-sans font-bold text-[13px] tracking-wide cursor-pointer disabled:opacity-40 select-none whitespace-nowrap px-6 py-2 shadow-sm transition-all"
            :class="activeTab === tab.id
              ? 'bg-white text-[#1e192b] border-2 border-[#00e5ff] shadow-[0_0_16px_rgba(0,229,255,0.32)] font-black scale-[1.02]'
              : 'bg-white/70 border border-white/90 text-[#655877] hover:bg-white hover:text-[#c24b78] shadow-[0_2px_8px_rgba(200,180,210,0.08)]'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- 右侧专属操作区插槽 (如仓库的云存档、批量管理、检索) -->
        <div class="flex items-center gap-2.5 flex-shrink-0 ml-4">
          <slot name="actions" />
        </div>
      </template>

    </div>

    <!-- 2. 全屏二次元游戏资产流：超大圆弧大画幅专属网格 (区别于常规界面的紧凑 6 列) -->
    <div class="flex-1 relative overflow-y-auto px-8 pt-4 pb-20 custom-scrollbar z-10">
      
      <!-- 加载中状态 (温和护眼初樱呼吸动画) -->
      <div v-if="isFetching" class="py-24 flex flex-col items-center justify-center gap-3">
        <div class="w-10 h-10 border-4 border-[#f5cbdc] border-t-[#ea8fb4] rounded-full animate-spin"></div>
        <span class="text-xs font-sans font-medium text-[#7a6b8c] tracking-wider animate-pulse">
          正在载入精选画卷...
        </span>
      </div>

      <!-- 游戏海报网格 (大画幅超大圆角自适应网格，间距更宽更舒展) -->
      <div 
        v-else-if="items.length > 0" 
        class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-7 w-full pt-2"
      >
        <div 
          v-for="item in items" 
          :key="item.id"
          class="relative rounded-[36px] transition-all duration-200"
          :class="{ 'ring-3 ring-[#ea8fb4] shadow-[0_0_24px_rgba(234,143,180,0.4)]': manageMode && selectedIds?.has(item.id) }"
          @click="manageMode && $emit('toggle-select', item.id)"
        >
          <!-- 管理模式下的萌系白瓷勾选框 -->
          <div 
            v-if="manageMode"
            class="absolute top-4 left-4 z-40 w-5 h-5 rounded-full border flex items-center justify-center cursor-pointer transition-all backdrop-blur-md shadow-sm"
            :class="selectedIds?.has(item.id) 
              ? 'bg-[#ea8fb4] border-[#ea8fb4] text-white shadow-[0_0_8px_rgba(234,143,180,0.6)]' 
              : 'bg-white/90 border-[#f5cbdc] hover:border-[#ea8fb4] text-transparent'"
            @click.stop="$emit('toggle-select', item.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <AnimeGameCard 
            :id="item.id" 
            :title="item.basic?.title || item.title" 
            :tags="item.basic?.tags || item.tags || [item.type ? item.type.toUpperCase() : '']" 
            :image="item.basic?.cover || item.cover" 
            :type="item.type"
            :is-in-library="isLibraryView || (librarySet ? (librarySet.has(String(item.id)) || (!!item.resource_id && librarySet.has(String(item.resource_id)))) : true)"
            :is-installed="isLibraryView ? true : (item.isInstalled ?? false)"
            :is-installing="item.isInstalling ?? false"
            :hide-controls="hideControls ?? false"
            :local-steam-first="localSteamFirst ?? false"
            @action="$emit('card-action', item)"
            @collect="$emit('card-collect', item)"
            @contextmenu="(payload) => $emit('card-contextmenu', payload)"
          />
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="h-full min-h-[300px] flex flex-col items-center justify-center text-[#7a6b8c] gap-3">
        <div class="w-16 h-16 rounded-full bg-[#fdeef5] border border-[#f5cbdc] flex items-center justify-center text-2xl shadow-sm">
          🌸
        </div>
        <p class="font-sans font-bold text-sm text-[#473957]">
          {{ emptyText || '当前分类暂无可探索的画卷哦~' }}
        </p>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import AnimeGameCard from './AnimeGameCard.vue'

defineProps<{
  tabs: Array<{ id: string; label: string }>
  activeTab: string
  items: any[]
  isFetching?: boolean
  librarySet?: Set<string>
  isLibraryView?: boolean
  hideControls?: boolean
  localSteamFirst?: boolean
  manageMode?: boolean
  selectedIds?: Set<string>
  emptyText?: string
}>()

defineEmits<{
  (e: 'select-tab', tabId: string): void
  (e: 'card-action', item: any): void
  (e: 'card-collect', item: any): void
  (e: 'card-contextmenu', payload: any): void
  (e: 'toggle-select', id: string): void
}>()
</script>

<style scoped>
/* 武器库 03 果冻气泡大弹跳 */
.anime-tab-bubble {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.anime-tab-bubble:hover {
  transform: scale(1.04) translateY(-1px);
}
.anime-tab-bubble:active {
  transform: scale(0.88) translateY(2px);
}
</style>