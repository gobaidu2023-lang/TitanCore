<!-- 文件名: src/themes/minimal/TechGameGrid.vue -->
<!-- 设计稿2（方案B：深空星渊 · 极简未来风）统一游戏资产矩阵 (Universal Game Grid) -->
<!-- 完美支撑发现大厅 (Discovery) 与 游戏仓库 (Library) 共同复用，布局 100% 统一 -->
<!-- 适配 27~32 寸高清大屏：极简无界流式 2~6 列响应，零代码视觉冗余 -->
<template>
  <div class="tech-game-grid h-full flex flex-col relative overflow-hidden select-none">
    
    <!-- 顶部深空极轻微光晕环境 -->
    <div class="pointer-events-none absolute -top-10 left-1/4 w-[500px] h-[180px] bg-[#00f2ff]/5 blur-[90px] z-0"></div>

    <!-- 1. 顶部分类标签栏 / 管理条 -->
    <div class="px-8 pt-5 pb-3.5 flex items-center justify-between flex-shrink-0 z-10 border-b border-white/[0.04]">
      
      <!-- 管理模式条插槽优先（仓库批量管理时展示） -->
      <div v-if="$slots['manage-bar']" class="w-full">
        <slot name="manage-bar" />
      </div>

      <!-- 常规顶栏：分类标签组 + 右侧操作区插槽 -->
      <template v-else>
        <div class="flex items-center gap-2.5 overflow-x-auto scrollbar-hide py-1">
          <button 
            v-for="tab in tabs" 
            :key="tab.id"
            @click="$emit('select-tab', tab.id)"
            :disabled="isFetching"
            class="relative px-5 py-2 rounded-xl text-[13.5px] font-medium tracking-wide transition-all duration-150 cursor-pointer disabled:opacity-40 select-none whitespace-nowrap"
            :class="activeTab === tab.id 
              ? 'text-white bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] font-bold' 
              : 'text-[#8295ab] hover:text-[#d0e0f2] hover:bg-white/[0.04]'"
          >
            <!-- 激活项底部极细微光条 -->
            <div 
              v-if="activeTab === tab.id"
              class="absolute bottom-0 inset-x-2.5 h-[2.5px] bg-[#00f2ff] rounded-full shadow-[0_0_8px_#00f2ff]"
            ></div>
            {{ tab.label }}
          </button>
        </div>

        <!-- 右侧专属操作区插槽 (如仓库的云存档、批量管理、检索) -->
        <div class="flex items-center gap-2.5 flex-shrink-0 ml-4">
          <slot name="actions" />
        </div>
      </template>

    </div>

    <!-- 2. 全屏游戏资产流：严格维持多屏幕多分辨率自适应网格 -->
    <div class="flex-1 relative overflow-y-auto px-8 pt-5 pb-20 custom-scrollbar z-10">
      
      <!-- 加载状态 -->
      <div v-if="isFetching" class="py-32 flex flex-col items-center justify-center gap-3">
        <div class="w-9 h-9 border-2 border-white/10 border-t-[#00f2ff] rounded-full animate-spin"></div>
        <span class="text-xs text-[#8295ab] tracking-wider">
          正在加载游戏列表...
        </span>
      </div>

      <!-- 游戏卡片网格：严守多端多分辨率自适应，2~6 列流式响应 -->
      <div 
        v-else-if="items.length > 0" 
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-5 w-full"
      >
        <div 
          v-for="item in items" 
          :key="item.id"
          class="relative rounded-2xl transition-all duration-200"
          :class="{ 'ring-2 ring-[#00f2ff] shadow-[0_0_20px_rgba(0,242,255,0.25)]': manageMode && selectedIds?.has(item.id) }"
          @click="manageMode && $emit('toggle-select', item.id)"
        >
          <!-- 管理模式下的高阶微晶体多选框 -->
          <div 
            v-if="manageMode"
            class="absolute top-4 left-4 z-40 w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer transition-all backdrop-blur-md"
            :class="selectedIds?.has(item.id) 
              ? 'bg-[#00f2ff] border-[#00f2ff] text-[#06080e] shadow-[0_0_10px_#00f2ff]' 
              : 'bg-black/60 border-white/30 hover:border-[#00f2ff] text-transparent'"
            @click.stop="$emit('toggle-select', item.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <TechGameCard 
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
      <div v-else class="h-full min-h-[300px] flex flex-col items-center justify-center text-[#526478] gap-3 font-mono">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white/20 border border-white/5 bg-white/[0.02]">
          ◇
        </div>
        <p class="text-xs tracking-wider text-[#62768c]">
          {{ emptyText || '暂无游戏内容' }}
        </p>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import TechGameCard from './TechGameCard.vue'

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