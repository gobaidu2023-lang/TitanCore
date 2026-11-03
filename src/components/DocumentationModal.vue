<template>
  <BaseModal
    :visible="visible"
    @close="$emit('close')"
    :show-close="true"
    :container-class="containerClass"
  >
    <div 
      class="absolute top-0 left-0 w-full h-0.5" 
      :class="currentTheme === 'anime' ? 'bg-gradient-to-r from-transparent via-[#ff85b3] to-transparent' : 'bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent'"
    ></div>

    <div class="flex items-center gap-3 mb-6 border-b pb-4" :class="currentTheme === 'anime' ? 'border-[#e2d4f0]' : 'border-white/5'">
      <span class="text-sm font-bold tracking-wide" :class="titleTextClass">{{ t('docs.title') }}</span>
    </div>

    <div class="flex items-center gap-2 mb-6">
      <button
        v-for="tab in docTabs"
        :key="tab.id"
        @click="activeDocTab = tab.id"
        class="px-5 py-2.5 rounded-lg text-sm font-bold font-code tracking-widest transition-all border"
        :class="getTabClass(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="max-h-[60vh] overflow-y-auto custom-scrollbar space-y-6">
      <!-- 入库方法 -->
      <div v-if="activeDocTab === 'deploy'" class="space-y-4 animate-fade-in">
        <h3 class="text-base font-bold tracking-wide mb-4" :class="titleTextClass">{{ t('docs.tabs.deploy') }}</h3>
        <div class="space-y-3">
          <div class="rounded-xl p-5" :class="cardBgClass">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-primary/20 text-primary font-black font-code text-sm flex items-center justify-center border border-primary/30">01</span>
              <span class="text-sm font-bold text-primary">{{ t('docs.deploy.step1.title') }}</span>
            </div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.deploy.step1.desc') }}</p>
          </div>
          <div class="rounded-xl p-5" :class="cardBgClass">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-primary/20 text-primary font-black font-code text-sm flex items-center justify-center border border-primary/30">02</span>
              <span class="text-sm font-bold text-primary">{{ t('docs.deploy.step2.title') }}</span>
            </div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.deploy.step2.desc') }}</p>
          </div>
          <div class="rounded-xl p-5" :class="cardBgClass">
            <div class="flex items-center gap-3 mb-3">
              <span class="w-8 h-8 rounded-lg bg-primary/20 text-primary font-black font-code text-sm flex items-center justify-center border border-primary/30">03</span>
              <span class="text-sm font-bold text-primary">{{ t('docs.deploy.step3.title') }}</span>
            </div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.deploy.step3.desc') }}</p>
          </div>
        </div>
      </div>

      <!-- 补丁使用 -->
      <div v-if="activeDocTab === 'patch'" class="space-y-4 animate-fade-in">
        <h3 class="text-base font-bold tracking-wide mb-4" :class="titleTextClass">{{ t('docs.tabs.patch') }}</h3>
        <div class="space-y-3">
          <div class="border-l-2 border-yellow-500 rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-amber-50/60 border-yellow-400' : 'bg-yellow-500/5'">
            <div class="text-yellow-400 font-bold mb-2 text-sm">{{ t('docs.patch.denuvo.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.patch.denuvo.desc') }}</p>
          </div>
          <div class="border-l-2 border-green-500 rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-emerald-50/60 border-green-400' : 'bg-green-500/5'">
            <div class="text-green-400 font-bold mb-2 text-sm">{{ t('docs.patch.movieGame.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.patch.movieGame.desc') }}</p>
          </div>
          <div class="border-l-2 border-primary rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-sky-50/60 border-primary' : 'bg-primary/5'">
            <div class="text-primary font-bold mb-2 text-sm">{{ t('docs.patch.onlineFix.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.patch.onlineFix.desc') }}</p>
          </div>
        </div>
      </div>

      <!-- 联机说明 -->
      <div v-if="activeDocTab === 'multiplayer'" class="space-y-4 animate-fade-in">
        <h3 class="text-base font-bold tracking-wide mb-4" :class="titleTextClass">{{ t('docs.tabs.multiplayer') }}</h3>
        <div class="rounded-xl p-5 mb-4 border" :class="currentTheme === 'anime' ? 'bg-amber-50/80 border-amber-200' : 'bg-yellow-500/5 border-yellow-500/20'">
          <div class="flex items-center gap-2 text-yellow-400 font-bold text-sm mb-3">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 256 256"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z" /></svg>
            <span>{{ t('docs.multiplayer.warningTitle') }}</span>
          </div>
          <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.multiplayer.warningDesc') }}</p>
        </div>
        <ul class="space-y-4">
          <li class="flex items-start gap-3">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 shrink-0 shadow-[0_0_5px_#eab308]"></span>
            <span class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.multiplayer.rule1') }}</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 shrink-0 shadow-[0_0_5px_#eab308]"></span>
            <span class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.multiplayer.rule2') }}</span>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 shrink-0 shadow-[0_0_5px_#eab308]"></span>
            <span class="text-sm leading-relaxed" :class="descTextClass">
              {{ t('docs.multiplayer.rule3Prefix') }}<span class="font-bold text-red-400">{{ t('docs.multiplayer.rule3Highlight') }}</span>{{ t('docs.multiplayer.rule3Suffix') }}
            </span>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-2 shrink-0 shadow-[0_0_5px_#eab308]"></span>
            <span class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.multiplayer.rule4') }}</span>
          </li>
        </ul>
      </div>

      <!-- DLC解锁 -->
      <div v-if="activeDocTab === 'dlc'" class="space-y-4 animate-fade-in">
        <h3 class="text-base font-bold tracking-wide mb-4" :class="titleTextClass">{{ t('docs.tabs.dlc') }}</h3>
        <div class="space-y-3">
          <div class="border-l-2 border-primary rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-sky-50/60' : 'bg-primary/5'">
            <div class="text-primary font-bold mb-2 text-sm">{{ t('docs.dlc.unlock.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.dlc.unlock.desc') }}</p>
          </div>
          <div class="border-l-2 border-yellow-500 rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-amber-50/60' : 'bg-yellow-500/5'">
            <div class="text-yellow-400 font-bold mb-2 text-sm">{{ t('docs.dlc.missing.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.dlc.missing.desc') }}</p>
          </div>
          <div class="border-l-2 border-green-500 rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-emerald-50/60' : 'bg-green-500/5'">
            <div class="text-green-400 font-bold mb-2 text-sm">{{ t('docs.dlc.safety.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.dlc.safety.desc') }}</p>
          </div>
        </div>
      </div>

      <!-- 内置功能 -->
      <div v-if="activeDocTab === 'builtin'" class="space-y-4 animate-fade-in">
        <h3 class="text-base font-bold tracking-wide mb-4" :class="titleTextClass">{{ t('docs.tabs.builtin') }}</h3>
        <div class="space-y-3">
          <div class="border-l-2 border-primary rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-sky-50/60' : 'bg-primary/5'">
            <div class="text-primary font-bold mb-2 text-sm">{{ t('docs.builtin.download.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.builtin.download.desc') }}</p>
          </div>
          <div class="border-l-2 border-blue-400 rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-blue-50/60' : 'bg-blue-400/5'">
            <div class="text-blue-400 font-bold mb-2 text-sm">{{ t('docs.builtin.engine.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.builtin.engine.desc') }}</p>
          </div>
          <div class="border-l-2 border-purple-400 rounded-r-xl p-5" :class="currentTheme === 'anime' ? 'bg-purple-50/60' : 'bg-purple-400/5'">
            <div class="text-purple-400 font-bold mb-2 text-sm">{{ t('docs.builtin.minigame.title') }}</div>
            <p class="text-sm leading-relaxed" :class="descTextClass">{{ t('docs.builtin.minigame.desc') }}</p>
          </div>
        </div>
      </div>

      <!-- 常见问题 -->
      <div v-if="activeDocTab === 'faq'" class="space-y-4 animate-fade-in">
        <h3 class="text-base font-bold tracking-wide mb-4" :class="titleTextClass">{{ t('docs.tabs.faq') }}</h3>
        <div class="space-y-2">
          <div 
            v-for="(item, idx) in faqItems" 
            :key="idx" 
            class="rounded-xl overflow-hidden transition-colors"
            :class="cardBgClass"
          >
            <button
              @click="faqOpen = faqOpen === idx ? -1 : idx"
              class="w-full flex items-center justify-between p-4 text-left transition-colors"
              :class="currentTheme === 'anime' ? 'hover:bg-slate-100 text-[#1e192b]' : 'hover:bg-white/5 text-gray-300'"
            >
              <div class="flex items-center gap-3">
                <span 
                  class="text-[10px] font-code px-1.5 py-0.5 rounded border"
                  :class="currentTheme === 'anime' ? 'text-[#ff66b2] bg-pink-100 border-pink-200' : 'text-primary bg-primary/10 border-primary/20'"
                >{{ item.code }}</span>
                <span class="font-bold text-sm" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-gray-300'">{{ item.q }}</span>
              </div>
              <svg
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                viewBox="0 0 24 24"
                class="transition-transform duration-300 shrink-0"
                :class="[
                  faqOpen === idx ? 'rotate-180' : '',
                  currentTheme === 'anime' ? 'text-slate-400' : 'text-gray-500'
                ]"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-show="faqOpen === idx"
              class="px-4 pb-4 text-sm leading-relaxed animate-slide-in-up"
              :class="descTextClass"
            >
              {{ item.a }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import BaseModal from './common/BaseModal.vue'
import { t } from '../i18n'
import { useTheme } from '../composables/useTheme'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { currentTheme } = useTheme()

const onEsc = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && !e.isComposing) {
    e.stopImmediatePropagation()
    emit('close')
  }
}
watch(() => props.visible, (v) => {
  if (v) window.addEventListener('keydown', onEsc)
  else window.removeEventListener('keydown', onEsc)
}, { immediate: true })
onUnmounted(() => window.removeEventListener('keydown', onEsc))

const activeDocTab = ref('deploy')
const faqOpen = ref(-1)

const containerClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'max-w-4xl w-full bg-white/95 border-2 border-[#bce8ff] p-8 shadow-[0_20px_60px_rgba(180,150,230,0.25)] text-[#1e192b]'
  }
  if (currentTheme.value === 'minimal') {
    return 'max-w-4xl w-full bg-[#0b0e1a]/95 border border-[#00f2ff]/30 p-8 shadow-[0_0_40px_rgba(0,242,255,0.18)] text-white backdrop-blur-xl'
  }
  return 'max-w-4xl w-full bg-[#0e0e14] border border-white/10 p-8 shadow-[0_0_40px_rgba(0,243,255,0.08)] text-white'
})

const getTabClass = (tabId: string) => {
  const isActive = activeDocTab.value === tabId
  if (currentTheme.value === 'anime') {
    return isActive
      ? 'bg-gradient-to-r from-[#ff85b3] to-[#6be5ff] text-white border-transparent shadow-[0_4px_16px_rgba(255,133,179,0.38)]'
      : 'bg-slate-100 text-[#554c66] border-slate-200 hover:text-[#ff66b2] hover:border-pink-200'
  }
  if (currentTheme.value === 'minimal') {
    return isActive
      ? 'bg-[#00f2ff] text-black border-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.3)]'
      : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:border-[#00f2ff]/30'
  }
  return isActive
    ? 'bg-primary text-black border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]'
    : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:border-white/10'
}

const cardBgClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-slate-50 border border-slate-200'
  return 'bg-white/5 border border-white/10'
})

const descTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#554c66]'
  return 'text-gray-400'
})

const titleTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const docTabs = computed(() => [
  { id: 'deploy', label: t('docs.tabs.deploy') },
  { id: 'patch', label: t('docs.tabs.patch') },
  { id: 'multiplayer', label: t('docs.tabs.multiplayer') },
  { id: 'dlc', label: t('docs.tabs.dlc') },
  { id: 'builtin', label: t('docs.tabs.builtin') },
  { id: 'faq', label: t('docs.tabs.faq') }
])

const faqItems = computed(() => [
  { code: 'ERR_NODE_FAIL', q: t('docs.faq.errNodeFail.q'), a: t('docs.faq.errNodeFail.a') },
  { code: 'QUOTA_EXHAUSTED', q: t('docs.faq.quotaExhausted.q'), a: t('docs.faq.quotaExhausted.a') },
  { code: 'ERR_ENGINE_DEPLOY_FAIL', q: t('docs.faq.engineDeployFail.q'), a: t('docs.faq.engineDeployFail.a') },
  { code: 'ERR_STEAM_MISSING', q: t('docs.faq.steamMissing.q'), a: t('docs.faq.steamMissing.a') },
  { code: 'ERR_INVALID_ENTRY', q: t('docs.faq.invalidEntry.q'), a: t('docs.faq.invalidEntry.a') },
  { code: 'ERR_NO_INTERNET', q: t('docs.faq.noInternet.q'), a: t('docs.faq.noInternet.a') },
  { code: 'ERR_GAME_WONT_START', q: t('docs.faq.gameWontStart.q'), a: t('docs.faq.gameWontStart.a') },
  { code: 'ERR_UPDATE_FAIL', q: t('docs.faq.updateFail.q'), a: t('docs.faq.updateFail.a') }
])
</script>
