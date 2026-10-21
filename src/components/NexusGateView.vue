// 文件名: src/components/NexusGateView.vue
<template>
  <div 
    class="h-full flex flex-col relative overflow-hidden animate-fade-in transition-colors duration-300"
    :class="currentTheme === 'anime' ? 'bg-transparent text-[#1e192b]' : (currentTheme === 'minimal' ? 'bg-transparent text-white' : 'bg-bg-main')"
  >

    <Transition name="warp-fade">
      <div 
        v-if="searchStore.isWarping" 
        class="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center"
        :class="currentTheme === 'anime' ? 'bg-white/90 backdrop-blur-md' : (currentTheme === 'minimal' ? 'bg-[#06080e]/95 backdrop-blur-md' : 'bg-[#020204]/95')"
      >
        <div 
          class="absolute inset-0 animate-scan-beam"
          :class="currentTheme === 'anime' 
            ? 'bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,133,179,0.2)_50%,transparent_100%)]' 
            : 'bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,243,255,0.15)_50%,transparent_100%)]'"
        ></div>
        <div class="relative flex flex-col items-center gap-4">
          <div 
            class="w-16 h-16 border-2 rounded-full flex items-center justify-center"
            :class="currentTheme === 'anime' 
              ? 'border-[#ff85b3] shadow-[0_0_30px_rgba(255,133,179,0.6)]' 
              : 'border-[#00f3ff] shadow-[0_0_30px_rgba(0,243,255,0.6)]'"
          >
             <div 
               class="w-8 h-8 rounded-full animate-ping opacity-75"
               :class="currentTheme === 'anime' ? 'bg-[#ff85b3]' : 'bg-[#00f3ff]'"
             ></div>
          </div>
          <div 
            class="font-code text-xs tracking-[0.4em] uppercase font-bold"
            :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'"
          >
            UPLINKING MATRIX...
          </div>
        </div>
      </div>
    </Transition>

    <div v-if="!searchStore.hasSearched" class="h-full flex flex-col relative overflow-hidden">
        <div 
          class="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2"
          :class="currentTheme === 'anime' 
            ? 'bg-[radial-gradient(circle_at_center,_rgba(255,148,200,0.18)_0%,_transparent_60%)]' 
            : 'bg-[radial-gradient(circle_at_center,_rgba(0,243,255,0.08)_0%,_transparent_60%)]'"
        ></div>
        <div 
          class="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full pointer-events-none translate-x-1/2 translate-y-1/2"
          :class="currentTheme === 'anime' 
            ? 'bg-[radial-gradient(circle_at_center,_rgba(124,231,255,0.18)_0%,_transparent_60%)]' 
            : 'bg-[radial-gradient(circle_at_center,_rgba(234,179,8,0.05)_0%,_transparent_60%)]'"
        ></div>

        <div class="relative z-10 flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
            <div class="mb-12 transition-all duration-500">
                 <h1 class="text-6xl font-black tracking-tighter mb-4 uppercase transition-all duration-500 font-sans" 
                     :class="currentTheme === 'anime'
                       ? (searchMode === 'LOCAL' 
                           ? 'text-[#00b4d8] drop-shadow-[0_4px_16px_rgba(0,180,216,0.35)]' 
                           : 'bg-gradient-to-r from-[#ff6b9d] via-[#a855f7] to-[#4deeea] bg-clip-text text-transparent drop-shadow-[0_4px_18px_rgba(255,107,157,0.35)]')
                       : (searchMode === 'LOCAL' ? 'text-transparent [-webkit-text-stroke:1px_#00f3ff] opacity-60' : 'text-[#00f3ff]')"
                     :style="currentTheme !== 'anime' ? 'text-shadow: 0 0 30px rgba(0,243,255,0.4);' : ''">
                     {{ searchMode === 'LOCAL' ? t('nexus.localVaultTitle') : t('nexus.globalSearchTitle') }}
                 </h1>
            </div>

            <div class="w-full max-w-3xl relative group">
                <div 
                  class="relative flex items-center rounded-full p-2.5 transition-all duration-300"
                  :class="currentTheme === 'anime'
                    ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_12px_36px_rgba(180,150,230,0.22)] ring-4 ring-pink-50/50 hover:border-[#ff85b3] focus-within:border-[#ff85b3] focus-within:ring-pink-100/60'
                    : (currentTheme === 'minimal'
                      ? 'bg-[#101624]/90 border border-[#00f2ff]/40 shadow-[0_0_30px_rgba(0,242,255,0.18)] ring-2 ring-[#00f2ff]/10 focus-within:border-[#00f2ff] focus-within:ring-[#00f2ff]/25 backdrop-blur-xl'
                      : 'bg-black/80 border border-white/20 shadow-[0_0_30px_rgba(0,243,255,0.1)] group-hover:shadow-[0_0_50px_rgba(0,243,255,0.3)]')"
                >
                    <input 
                        id="global-search-input"
                        ref="searchInputRef"
                        v-model="searchQuery" 
                        @keyup.enter.prevent="handleSearchAction"
                        type="text" 
                        :placeholder="searchMode === 'LOCAL' 
                            ? t('nexus.localPlaceholder') 
                            : t('nexus.globalPlaceholder')" 
                        class="flex-1 bg-transparent border-none text-xl px-8 py-3.5 focus:outline-none transition-all" 
                        :class="currentTheme === 'anime'
                          ? 'font-bold text-[#1e192b] placeholder:text-[#94a3b8] font-sans'
                          : 'font-bold text-white placeholder:text-white/20 font-code'"
                    />
                    <button 
                        type="button"
                        @click.prevent="handleSearchAction" 
                        @contextmenu.prevent="toggleSearchMode"
                        :class="currentTheme === 'anime'
                          ? (searchMode === 'LOCAL' 
                              ? 'bg-gradient-to-r from-[#7ce7ff] to-[#4deeea] text-[#1a2f3a] border border-white/60 shadow-[0_6px_20px_rgba(77,238,234,0.45)] font-black'
                              : 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white border border-white/60 shadow-[0_6px_20px_rgba(255,133,179,0.45)] hover:shadow-[0_8px_25px_rgba(255,133,179,0.6)] font-black')
                          : (searchMode === 'LOCAL' 
                              ? 'bg-[#00f3ff]/10 border-2 border-[#00f3ff] text-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.2)] font-black' 
                              : 'bg-[#00f3ff] border-2 border-[#00f3ff] text-black shadow-[0_0_15px_rgba(0,243,255,0.4)] font-black')"
                        class="px-10 py-4 rounded-full hover:scale-105 transition-all duration-300 text-lg tracking-widest relative overflow-hidden cursor-pointer"
                    >
                        <span :key="searchMode" :class="{'animate-pulse': searchMode === 'LOCAL'}" class="block">
                            {{ searchMode === 'LOCAL' ? t('nexus.localBtn') : t('nexus.searchBtn') }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div v-else class="h-full w-full absolute inset-0 z-20 flex flex-col" :class="currentTheme === 'anime' || currentTheme === 'minimal' ? 'bg-transparent text-white' : 'bg-bg-main'">
        <SearchResult />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSearchStore } from '../stores/searchStore';
import { useTheme } from '../composables/useTheme';
import { t } from '../i18n';
import SearchResult from './SearchResult.vue'; 

const { currentTheme } = useTheme();
const searchStore = useSearchStore();
const searchQuery = ref('')
const searchMode = ref<'GLOBAL' | 'LOCAL'>('GLOBAL');
const searchInputRef = ref<HTMLInputElement | null>(null);

const toggleSearchMode = () => (searchMode.value = searchMode.value === 'GLOBAL' ? 'LOCAL' : 'GLOBAL');

const focusInput = () => {
  setTimeout(() => {
    searchInputRef.value?.focus()
  }, 50)
};

const handleSearchAction = () => {
    const kw = searchQuery.value.trim();
    if (kw) {
        searchStore.doSearch(kw);
    }
};

onMounted(() => {
    window.addEventListener('titan-navigate-search', focusInput);
});

onUnmounted(() => {
    window.removeEventListener('titan-navigate-search', focusInput);
    searchStore.clearSearch();
});
</script>

<style scoped>
.warp-fade-enter-active,
.warp-fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.warp-fade-enter-from,
.warp-fade-leave-to {
  opacity: 0;
}

@keyframes scan-beam {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

.animate-scan-beam {
  animation: scan-beam 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
</style>