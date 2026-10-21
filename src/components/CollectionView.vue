<template>
  <div 
    class="h-screen w-full flex flex-col overflow-hidden font-sans relative transition-colors duration-300"
    :class="currentTheme === 'anime' 
      ? 'bg-gradient-to-br from-[#ffeef7]/60 via-[#eef7ff]/60 to-[#f3ecff]/60 text-[#1e192b]' 
      : 'bg-[#020204] text-white'"
  >

    <header 
      class="flex-shrink-0 h-16 px-6 lg:px-10 flex items-center justify-between border-b backdrop-blur-xl z-50 transition-colors"
      :class="currentTheme === 'anime' ? 'border-[#bce8ff]/60 bg-white/85 text-[#1e192b]' : 'border-white/[0.05] bg-[#020204]/90 text-white'"
    >
      <div class="flex items-center gap-6">
        <button 
          @click="goBack" 
          class="w-8 h-8 rounded flex items-center justify-center transition-all duration-200 group border"
          :class="currentTheme === 'anime' ? 'bg-pink-50 border-pink-200 text-[#ff66b2] hover:bg-pink-100' : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:text-[#00f3ff] hover:bg-[#00f3ff]/10 hover:border-[#00f3ff]/30'"
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" class="group-hover:-translate-x-0.5 transition-transform"><path d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div class="flex items-center gap-4">
          <div class="flex flex-col">
            <h1 class="text-base font-black tracking-widest uppercase leading-tight" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ collectionTitle }}</h1>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-sm font-mono uppercase tracking-widest" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500'">{{ t('collection.quotaLabel') }}</span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-black" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'">{{ dailyQuota.remaining }}</span>
          <span class="text-xs font-mono" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-600'">/ {{ dailyQuota.limit }}</span>
        </div>
      </div>
    </header>

    <section 
      class="relative shrink-0 h-[38vh] min-h-[340px] max-h-[480px] w-full border-b overflow-hidden z-40 transition-colors"
      :class="currentTheme === 'anime' ? 'bg-white/80 border-[#bce8ff]/60' : 'bg-black border-white/[0.05]'"
    >
      <Transition name="hero-fade" mode="out-in" :duration="performanceMode ? 0 : 600">
        <div :key="activeItem?.id || 'empty'" class="absolute inset-0">
          <TitanImage :id="activeItem?.id || ''" :src="activeItem?.cover || ''" alt="cover_bg" class="w-full h-full object-cover scale-105" :class="currentTheme === 'anime' ? 'opacity-35' : 'opacity-50'" />
          <div 
            class="absolute inset-0 transition-colors"
            :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-white via-white/85 to-transparent' : 'bg-gradient-to-r from-[#020204] via-[#020204]/90 to-transparent'"
          ></div>
          <div 
            class="absolute inset-0 transition-colors"
            :class="currentTheme === 'anime' ? 'bg-gradient-to-t from-white via-transparent to-transparent' : 'bg-gradient-to-t from-[#020204] via-transparent to-transparent'"
          ></div>
        </div>
      </Transition>

      <div class="relative h-full w-full max-w-[1920px] mx-auto px-8 lg:px-16 flex items-center justify-between gap-12">
        <div class="flex-1 max-w-3xl flex flex-col justify-center space-y-5">
          <div class="flex items-center gap-3">
            <span 
              class="px-2 py-0.5 text-[10px] font-black tracking-widest rounded-sm shadow-md uppercase"
              :class="currentTheme === 'anime' ? 'bg-pink-100 border border-pink-300 text-pink-700' : 'bg-purple-600 text-white'"
            >
              {{ activeItem?.typeLabel || t('collection.resourceType') }}
            </span>
          </div>

          <div class="space-y-1">
            <h2 
              class="text-5xl lg:text-6xl font-black tracking-tight uppercase line-clamp-2 leading-tight transition-colors"
              :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white drop-shadow-xl'"
            >{{ activeItem?.title || t('collection.noSelect') }}</h2>
          </div>

          <p 
            class="text-sm lg:text-base leading-relaxed line-clamp-2 max-w-2xl font-medium transition-colors"
            :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-gray-300'"
          >{{ activeItem?.desc || '' }}</p>

          <div class="pt-4 flex items-center gap-4">
            <button 
              @click="activeItem && deploySingle(activeItem)"
              :disabled="!activeItem || activeItem.status === 'deploying' || activeItem.status === 'completed'"
              class="relative px-10 py-3.5 border rounded-lg transition-all duration-300 font-black tracking-widest text-sm overflow-hidden group shadow-md"
              :class="[
                !activeItem ? 'opacity-30 cursor-not-allowed' :
                activeItem.status === 'completed' ? 'border-green-500/30 text-green-600 cursor-not-allowed bg-green-50' : 
                activeItem.status === 'failed' ? 'border-red-500/50 text-red-500 hover:bg-red-50' : 
                (currentTheme === 'anime' 
                  ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white border-transparent shadow-[0_4px_16px_rgba(255,133,179,0.38)] hover:opacity-95' 
                  : 'bg-white/5 border-[#00f3ff]/40 text-[#00f3ff] hover:bg-[#00f3ff]/10 hover:shadow-[0_0_20px_rgba(0,243,255,0.2)] hover:border-[#00f3ff]')
              ]"
            >
              <div class="relative z-10 flex items-center gap-3">
                <span v-if="activeItem?.status === 'deploying'" class="w-3 h-3 rounded-sm" :class="currentTheme === 'anime' ? 'bg-white' : 'bg-[#00f3ff]'" :style="!performanceMode ? 'animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' : ''"></span>
                <span>{{ activeItem ? actionText(activeItem.status) : t('collection.noData') }}</span>
              </div>
            </button>

            <button
              @click="openDeployAllConfirm"
              :disabled="isDeployingAll || allCompleted || collectionItems.length === 0"
              class="relative px-10 py-3.5 border rounded-lg transition-all duration-300 font-black tracking-widest text-sm overflow-hidden group"
              :class="[
                allCompleted ? 'border-green-500/30 text-green-600 cursor-not-allowed bg-green-50' : 
                (currentTheme === 'anime' ? 'bg-white border-pink-200 text-[#4a425a] hover:bg-pink-50 hover:text-pink-600 shadow-sm' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/30')
              ]"
            >
              <div class="relative z-10">{{ allCompleted ? t('collection.allSynced') : (isDeployingAll ? t('collection.deployingAll') : t('collection.deployAll')) }}</div>
            </button>
          </div>
        </div>

        <div class="shrink-0 relative hidden md:block">
          <div 
            class="w-48 lg:w-56 aspect-[2/3] rounded-xl overflow-hidden border-2 shadow-2xl z-10 relative transition-transform duration-500"
            :class="currentTheme === 'anime' ? 'bg-white border-[#f5a3c7] shadow-[0_12px_28px_rgba(175,145,220,0.3)]' : 'bg-black border-white/20'"
          >
            <TitanImage :id="activeItem?.id || ''" :src="activeItem?.cover || ''" :alt="activeItem?.title || ''" class="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </section>

    <section class="flex-1 flex flex-col min-h-0" :class="currentTheme === 'anime' ? 'bg-transparent text-[#1e192b]' : 'bg-[#020204] text-white'">
      <div 
        class="shrink-0 px-6 lg:px-10 py-4 border-b flex items-center justify-between transition-colors"
        :class="currentTheme === 'anime' ? 'bg-white/80 border-[#bce8ff]/60' : 'bg-[#050508]/50 border-white/[0.05]'"
      >
        <div class="flex items-center gap-6">
          <h3 
            class="text-xs font-black tracking-widest uppercase flex items-center gap-2"
            :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white/50'"
          >
            <span class="w-1 h-3 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff85b3]' : 'bg-[#00f3ff]'"></span> {{ t('collection.resourceMatrix') }}
          </h3>
          <div class="hidden sm:flex gap-4 text-xs font-mono font-bold" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500'">
            <span>{{ t('collection.totalLabel') }} <span :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ collectionItems.length }}</span></span>
            <span>{{ t('collection.readyLabel') }} <span class="text-green-500 font-bold">{{ completedCount }}</span></span>
            <span>{{ t('collection.waitingLabel') }} <span>{{ waitingCount }}</span></span>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <span v-if="quotaTip" class="text-xs font-mono text-rose-500 tracking-wider animate-pulse">{{ quotaTip }}</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
        <div v-if="collectionItems.length === 0" class="h-full flex items-center justify-center font-mono text-sm" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-500'">
          <div class="text-center">
            <p class="mb-2 font-bold">{{ t('collection.noSignal') }}</p>
            <p class="text-xs">{{ t('collection.checkMeta') }}</p>
          </div>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 lg:gap-6 max-w-[2000px] mx-auto pb-12">
          <div 
            v-for="(item, index) in collectionItems" :key="item.id"
            @click="selectIndex(index)"
            class="group flex flex-col gap-2 relative transition-all duration-300"
            :class="index === activeIndex ? 'scale-[1.02]' : 'hover:scale-[1.01] opacity-80 hover:opacity-100'"
            role="button"
            tabindex="0"
          >
            <div 
              class="relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all duration-300"
              :class="[
                currentTheme === 'anime' 
                  ? (index === activeIndex ? 'border-[#ff85b3] shadow-[0_8px_20px_rgba(255,133,179,0.35)] bg-white' : 'border-[#f5a3c7] shadow-sm bg-white hover:border-[#ff85b3]') 
                  : (index === activeIndex ? 'border-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.2)] bg-gray-900' : 'border-white/10 group-hover:border-white/30 bg-gray-900'),
                item.status === 'failed' ? 'border-red-500/60 grayscale' : ''
              ]"
            >
              <TitanImage :id="item.id" :src="item.cover" :alt="item.title" class="w-full h-full object-cover" />
              <div 
                class="absolute top-2 left-2 px-1.5 py-0.5 text-[8px] font-black tracking-wider rounded-[3px] shadow uppercase"
                :class="currentTheme === 'anime' ? 'bg-[#ff85b3] text-white' : 'bg-[#5046e5] text-white'"
              >{{ item.typeLabel }}</div>
              <div v-if="item.status === 'deploying'" class="absolute inset-0 z-10 overflow-hidden pointer-events-none border rounded-xl" :class="currentTheme === 'anime' ? 'border-[#ff85b3]/40' : 'border-[#00f3ff]/30'">
                <div class="absolute inset-0 h-full w-full">
                  <div class="h-full w-1/4 bg-gradient-to-r from-transparent via-[#ff85b3]/40 to-transparent" :style="!performanceMode ? 'animation: flow-light 1.5s linear infinite' : ''"></div>
                </div>
              </div>
              <div v-if="item.status === 'completed'" class="absolute bottom-0 left-0 right-0 h-1 bg-green-500 z-10 shadow-[0_0_10px_#00ff00]"></div>
              <div v-if="item.status === 'failed'" class="absolute inset-0 bg-red-900/40 z-10 flex items-center justify-center">
                <svg width="24" height="24" fill="none" stroke="#ff4444" stroke-width="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              <div 
                class="absolute bottom-0 left-0 right-0 h-1/2 pointer-events-none transition-colors"
                :class="currentTheme === 'anime' ? 'bg-gradient-to-t from-white/90 via-white/30 to-transparent' : 'bg-gradient-to-t from-black via-black/40 to-transparent'"
              ></div>
            </div>
            <div class="flex items-start justify-between px-0.5">
              <div class="min-w-0 pr-2">
                <h4 
                  class="text-xs font-bold truncate transition-colors duration-200" 
                  :class="currentTheme === 'anime' 
                    ? (index === activeIndex ? 'text-[#ff66b2] font-black' : 'text-[#1e192b]') 
                    : (index === activeIndex ? 'text-[#00f3ff]' : 'text-white')"
                >{{ item.title }}</h4>
              </div>
              <div class="shrink-0 mt-0.5">
                <span v-if="item.status === 'completed'" class="block w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#00ff00]"></span>
                <span v-else-if="item.status === 'deploying'" class="block w-2 h-2 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff85b3]' : 'bg-[#00f3ff]'" :style="!performanceMode ? 'animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite' : ''"></span>
                <span v-else-if="item.status === 'failed'" class="block w-2 h-2 rounded-full bg-rose-500"></span>
                <span v-else-if="item.status === 'waiting'" class="block w-2 h-2 rounded-sm rotate-45" :class="currentTheme === 'anime' ? 'bg-slate-400' : 'bg-gray-600'"></span>
                <span v-else class="block w-1.5 h-1.5 rounded-full" :class="currentTheme === 'anime' ? 'bg-slate-300' : 'bg-gray-600'"></span>
              </div>
            </div>
            <div v-if="index === activeIndex" class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-0.5 rounded-full" :class="currentTheme === 'anime' ? 'bg-[#ff85b3] shadow-[0_0_8px_#ff85b3]' : 'bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]'"></div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="isDeployingAll" class="absolute bottom-0 left-0 right-0 h-1 z-50 bg-black overflow-hidden">
      <div class="h-full w-1/3 bg-gradient-to-r from-transparent via-[#00f3ff] to-transparent" :class="!performanceMode && 'animate-[global-loading_1.5s_linear_infinite]'"></div>
    </div>

    <div v-if="showSummary" class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in" @click.self="showSummary = false">
      <div 
        class="p-8 max-w-md w-full mx-4 relative rounded-2xl border shadow-2xl transition-all"
        :class="currentTheme === 'anime' ? 'bg-white/95 border-2 border-[#bce8ff] text-[#1e192b]' : 'bg-[#0a0a0f] border-white/10 text-white'"
      >
        <div class="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#ff85b3]/70 to-transparent"></div>
        <h3 class="text-lg font-black tracking-widest mb-1 uppercase" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('collection.summaryTitle') }}</h3>
        <p class="text-xs font-mono tracking-wider mb-6" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-gray-500'">{{ t('collection.summarySub') }}</p>
        <p v-if="summaryStats.interruptReason" class="text-xs font-mono text-rose-500 tracking-wider mb-4 text-center uppercase border border-rose-200 bg-rose-50 py-1.5 rounded-lg">
          {{ t('collection.interruptedWarning') }} {{ summaryStats.interruptReason }}
        </p>
        <div class="space-y-3 font-mono text-sm">
          <div class="flex justify-between items-center border-b pb-2" :class="currentTheme === 'anime' ? 'border-pink-100 text-slate-700' : 'border-white/5 text-gray-400'">
            <span class="text-xs tracking-wider">{{ t('collection.successLabel') }}</span>
            <span class="text-green-500 font-bold text-base">{{ summaryStats.success }}</span>
          </div>
          <div class="flex justify-between items-center border-b pb-2" :class="currentTheme === 'anime' ? 'border-pink-100 text-slate-700' : 'border-white/5 text-gray-400'">
            <span class="text-xs tracking-wider">{{ t('collection.failedLabel') }}</span>
            <span class="text-rose-500 font-bold text-base">{{ summaryStats.failed }}</span>
          </div>
          <div class="flex justify-between items-center border-b pb-2" :class="currentTheme === 'anime' ? 'border-pink-100 text-slate-700' : 'border-white/5 text-gray-400'">
            <span class="text-xs tracking-wider">{{ t('collection.consumedLabel') }}</span>
            <span class="font-bold text-base" :class="currentTheme === 'anime' ? 'text-[#ff66b2]' : 'text-[#00f3ff]'">{{ summaryStats.consumed }}</span>
          </div>
          <div class="flex justify-between items-center pt-1" :class="currentTheme === 'anime' ? 'text-slate-700' : 'text-gray-500'">
            <span class="text-xs tracking-wider">{{ t('collection.remainingLabel') }}</span>
            <span class="font-bold text-base" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ dailyQuota.remaining }}</span>
          </div>
        </div>
        <button 
          @click="showSummary = false" 
          class="mt-8 w-full py-3 font-black tracking-widest text-xs transition-all duration-200 rounded-lg shadow-md"
          :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white hover:opacity-95' : 'bg-white/5 border border-white/10 hover:bg-[#00f3ff]/10 hover:border-[#00f3ff]/30 text-white'"
        >
          {{ t('collection.closeSummaryLabel') }}
        </button>
      </div>
    </div>

    <BaseModal 
      :visible="showConfirm" 
      @close="showConfirm = false" 
      showClose 
      :container-class="currentTheme === 'anime' ? 'bg-white/95 border-2 border-[#bce8ff] max-w-md w-full mx-4 rounded-2xl p-8 text-[#1e192b]' : 'bg-[#0a0a0f] border border-white/10 max-w-md w-full mx-4 p-8 text-white'"
    >
      <div>
        <h3 class="text-base font-black tracking-widest mb-2 uppercase" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">{{ t('collection.deployAllTitle') }}</h3>
        <p class="text-sm mb-6 leading-relaxed" :class="currentTheme === 'anime' ? 'text-[#4a425a]' : 'text-gray-400'">
          {{ t('collection.deployAllDesc', { count: collectionItems.length }) }}
        </p>
        <div class="flex gap-4">
          <button 
            @click="showConfirm = false" 
            class="flex-1 py-3 font-black tracking-widest text-xs transition-all rounded-lg border"
            :class="currentTheme === 'anime' ? 'bg-slate-100 hover:bg-slate-200 text-[#4a425a] border-slate-200' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'"
          >
            {{ t('common.cancel') }}
          </button>
          <button 
            @click="confirmDeployAll" 
            class="flex-1 py-3 font-black tracking-widest text-xs transition-all rounded-lg shadow-md"
            :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white hover:opacity-95' : 'bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] hover:bg-[#00f3ff]/20'"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { t } from '../i18n';
import { useAuthStore } from '../stores/authStore';
import { useLibraryStore } from '../stores/libraryStore';
import { useTheme } from '../composables/useTheme';
import BaseModal from '../components/common/BaseModal.vue';
import TitanImage from './TitanImage.vue';

const { currentTheme } = useTheme();

interface CollectionItem { id: string; title: string; type: string; typeLabel: string; desc: string; cover: string; status: 'idle' | 'waiting' | 'deploying' | 'completed' | 'failed'; }

const authStore = useAuthStore();
const libraryStore = useLibraryStore();
const performanceMode = ref(false);
const updatePerformanceMode = () => performanceMode.value = document.documentElement.classList.contains('performance-mode');

const collectionTitle = ref(t('collection.defaultTitle'));
const dailyQuota = computed(() => authStore.dailyQuota);
const activeIndex = ref(0);
let deployAllController: AbortController | null = null;

const showSummary = ref(false);
const summaryStats = ref({ success: 0, failed: 0, consumed: 0, interrupted: false, interruptReason: '' });
const isDeployingAll = ref(false);
const showConfirm = ref(false);
const quotaTip = ref('');
let quotaTipTimer: ReturnType<typeof setTimeout> | null = null;

const typeLabelMap: Record<string, string> = { titan_protocol: 'STEAM', game: 'GAME', tool: 'TOOL', patch: 'PATCH', wallpaper: 'WALLPAPER', titan_module: 'TITAN', collection: 'COLLECTION', unknown: 'RESOURCE' };
const collectionItems = ref<CollectionItem[]>([]);

const activeItem = computed(() => collectionItems.value[activeIndex.value] || null);
const allCompleted = computed(() => collectionItems.value.length > 0 && collectionItems.value.every(i => i.status === 'completed'));
const completedCount = computed(() => collectionItems.value.filter(i => i.status === 'completed').length);
const waitingCount = computed(() => collectionItems.value.filter(i => i.status === 'waiting').length);

const STATUS_COLORS: Record<string, string> = { completed: 'text-green-400', failed: 'text-red-400', deploying: 'text-[#00f3ff]', waiting: 'text-gray-500', idle: 'text-gray-500' }

const actionText = (s: string) => {
  const map: Record<string, string> = {
    completed: 'READY',
    failed: t('collection.retry'),
    deploying: 'RUNNING',
    waiting: t('collection.queued'),
    idle: t('collection.actionIdle')
  }
  return map[s] || t('collection.actionIdle')
}

const statusColor = (s: string) => STATUS_COLORS[s] || 'text-gray-500'
const selectIndex = (index: number) => { if (index >= 0 && index < collectionItems.value.length) activeIndex.value = index; }
const goBack = () => window.dispatchEvent(new CustomEvent('titan-navigate', { detail: 'discovery' }));

const deploySingleNode = async (item: CollectionItem): Promise<{success: boolean, msg?: string}> => {
    try {
        return await window.electron.invoke('titan:deploy-game', item.id);
    } catch (e: any) { 
        return { success: false, msg: e.message }; 
    }
}

const deploySingle = async (item: CollectionItem) => {
    if (item.status === 'deploying' || item.status === 'completed') return;
    item.status = 'deploying';

    const res = await deploySingleNode(item);

    if (res.success) {
        item.status = 'completed';
        await libraryStore.toggleItem(item.id, { title: item.title, type: item.type, cover: item.cover });
    } else {
        item.status = 'failed';
        if (res.msg?.includes('429') || res.msg?.includes('QUOTA')) {
            summaryStats.value.interrupted = true;
            summaryStats.value.interruptReason = t('collection.quotaExhausted');
            quotaTip.value = t('collection.quotaTip');
            if (quotaTipTimer) clearTimeout(quotaTipTimer);
            quotaTipTimer = setTimeout(() => quotaTip.value = '', 4000);
        }
    }
}

const openDeployAllConfirm = () => {
  if (isDeployingAll.value || allCompleted.value || collectionItems.value.length === 0) return;
  showConfirm.value = true;
};

const confirmDeployAll = () => {
  showConfirm.value = false;
  doDeployAll();
};

const doDeployAll = async () => {
  if (isDeployingAll.value || allCompleted.value || collectionItems.value.length === 0) return;
  isDeployingAll.value = true;
  deployAllController = new AbortController();
  summaryStats.value = { success: 0, failed: 0, consumed: 0, interrupted: false, interruptReason: '' };
  quotaTip.value = '';

  collectionItems.value.forEach(item => { if(item.status !== 'completed') item.status = 'waiting' });

  for (let i = 0; i < collectionItems.value.length; i++) {
    if (deployAllController.signal.aborted) break;

    const item = collectionItems.value[i];
    if (item.status === 'completed') continue;

    activeIndex.value = i;
    item.status = 'deploying';

    const res = await deploySingleNode(item);

    if (res.success) {
        item.status = 'completed';
        summaryStats.value.success++;
        summaryStats.value.consumed++;
        await libraryStore.toggleItem(item.id, { title: item.title, type: item.type, cover: item.cover });
    } else {
        item.status = 'failed';
        summaryStats.value.failed++;
        if (res.msg && (res.msg.includes('429') || res.msg.includes('QUOTA'))) {
            summaryStats.value.interrupted = true;
            summaryStats.value.interruptReason = t('collection.quotaExhausted');
            quotaTip.value = t('collection.quotaTip');
            if (quotaTipTimer) clearTimeout(quotaTipTimer);
            quotaTipTimer = setTimeout(() => quotaTip.value = '', 4000);
            break;
        }
    }

    await new Promise(r => setTimeout(r, 800));
  }

  isDeployingAll.value = false;
  showSummary.value = true;
};

const handleTitanNavigate = (e: any) => {
  const detail = e.detail;
  if (typeof detail === 'object' && detail.view === 'collection' && detail.payload) {
    collectionTitle.value = detail.payload.title || t('collection.defaultTitle');
    const rawData = detail.payload.data || [];
    collectionItems.value = rawData.map((item: any) => ({
      id: item.id || '',
      title: item.title || t('collection.unknownTitle'),
      type: item.type || 'unknown',
      typeLabel: typeLabelMap[item.type] || typeLabelMap['unknown'],
      desc: item.desc || (item.meta_json ? (() => { try { return JSON.parse(item.meta_json).desc || '' } catch { return '' } })() : '') || '',
      cover: item.cover || '',
      status: 'idle' as CollectionItem['status']
    }));
    activeIndex.value = 0;
  }
};

let escHandler: ((e: KeyboardEvent) => void) | null = null;

onMounted(() => {
  updatePerformanceMode();

  const cached = (window as any).__titanCollectionPayload;
  if (cached && cached.data) {
    collectionTitle.value = cached.title || t('collection.defaultTitle');
    const rawData = cached.data || [];
    collectionItems.value = rawData.map((item: any) => ({
      id: item.id || '',
      title: item.title || t('collection.unknownTitle'),
      type: item.type || 'unknown',
      typeLabel: typeLabelMap[item.type] || typeLabelMap['unknown'],
      desc: item.desc || (item.meta_json ? (() => { try { return JSON.parse(item.meta_json).desc || '' } catch { return '' } })() : '') || '',
      cover: item.cover || '',
      status: 'idle' as CollectionItem['status']
    }));
    activeIndex.value = 0;
    (window as any).__titanCollectionPayload = null;
  }

  window.addEventListener('titan-navigate', handleTitanNavigate);

  escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showConfirm.value) { showConfirm.value = false; return; }
      if (showSummary.value) { showSummary.value = false; return; }
      goBack();
    }
  };
  window.addEventListener('keydown', escHandler);
});

onUnmounted(() => { 
  deployAllController?.abort(); 
  if (quotaTipTimer) clearTimeout(quotaTipTimer);
  window.removeEventListener('titan-navigate', handleTitanNavigate);
  if (escHandler) window.removeEventListener('keydown', escHandler);
});
</script>

<style scoped>
@keyframes flow-light {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

/* 修复：补充 hero-fade 过渡类，使 Vue <Transition> 动画时间控制生效 */
.hero-fade-enter-active,
.hero-fade-leave-active {
  transition: opacity 600ms ease;
}

.hero-fade-enter-from,
.hero-fade-leave-to {
  opacity: 0;
}
</style>