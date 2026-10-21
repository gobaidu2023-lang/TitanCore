<template>
  <BaseModal 
    :visible="visible" 
    @close="$emit('close')" 
    :show-close="true" 
    :container-class="containerClass"
  >
    <div class="flex flex-col gap-6">
      <h3 class="text-xl font-black tracking-widest uppercase" :class="titleColorClass">{{ t('app.diagTitle') }}</h3>

      <div class="space-y-3">
        <div v-for="item in results" :key="item.name" class="flex items-start gap-3">
          <span 
            class="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" 
            :class="item.warning 
              ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' 
              : (item.ok ? (currentTheme === 'anime' ? 'bg-[#ff66b2] shadow-[0_0_8px_rgba(255,102,178,0.6)]' : 'bg-[#00f3ff] shadow-[0_0_8px_rgba(0,243,255,0.6)]') : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]')"
          ></span>
          <div class="flex-1">
            <div 
              class="text-sm font-bold" 
              :class="item.warning ? 'text-amber-500' : (item.ok ? itemTitleOkClass : 'text-red-500')"
            >{{ t(item.name) }}</div>
            <div 
              class="text-xs mt-0.5" 
              :class="item.warning ? 'text-amber-600/80' : (item.ok ? itemMsgOkClass : 'text-red-400/80')"
            >{{ t(item.message) }}</div>
          </div>
        </div>
      </div>

      <div class="h-px" :class="dividerClass"></div>

      <div class="flex items-center justify-between">
        <span class="text-xs font-code" :class="statsTextClass">
          {{ t('app.diagPassFail', { pass: passCount, fail: failCount }) }}
        </span>
        <button 
          type="button"
          @click="onActionClick"
          :disabled="isRepairing || actionType === 'none'"
          class="px-6 py-2 rounded-lg font-bold font-code text-sm tracking-widest transition-all disabled:opacity-40"
          :class="buttonClass"
        >
          <span v-if="isRepairing" class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span>
          {{ buttonText }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import BaseModal from './common/BaseModal.vue'
import { t } from '../i18n'
import { useTheme } from '../composables/useTheme'

export interface DiagnosticItem {
  name: string
  ok: boolean
  message: string
  warning?: boolean
}

const props = defineProps<{
  visible: boolean
  results: DiagnosticItem[]
  isRepairing?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'repair-env'): void
  (e: 'repair'): void
  (e: 'migrate-cr'): void
}>()

const { currentTheme } = useTheme()

const containerClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'max-w-lg w-full bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] p-8 text-[#1e192b]'
  }
  if (currentTheme.value === 'minimal') {
    return 'max-w-lg w-full bg-[#0b0e1a]/95 border border-[#00f2ff]/30 shadow-[0_0_40px_rgba(0,242,255,0.18)] text-white backdrop-blur-xl p-8'
  }
  return 'max-w-lg w-full bg-[#0c0d12]/95 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-white p-8'
})

const titleColorClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const itemTitleOkClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const itemMsgOkClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#64748b]'
  return 'text-white/50'
})

const dividerClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-pink-100'
  if (currentTheme.value === 'minimal') return 'bg-[#00f2ff]/15'
  return 'bg-white/5'
})

const statsTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-slate-400'
  return 'text-white/30'
})

const passCount = computed(() => props.results.filter(r => r.ok && !r.warning).length)
const failCount = computed(() => props.results.filter(r => !r.ok).length)

const dllFailed = computed(() => props.results.some(r => (r.name === 'DIAG_OST_DLL' || r.name === 'DIAG_DLL_MISSING') && !r.ok))
const tomlFailed = computed(() => props.results.some(r => (r.name === 'DIAG_TOML_ALIGN' || r.name === 'DIAG_TOML_INVALID') && !r.ok))
const conflictFailed = computed(() => props.results.some(r => r.name === 'DIAG_ENGINE_CONFLICT' && !r.ok))
const watchdogFailed = computed(() => props.results.some(r => r.name === 'DIAG_OST_WATCHDOG' && !r.ok))
const crPending = computed(() => props.results.some(r => r.name === 'DIAG_CR_STORAGE_LEGACY' && !r.ok))
const allOk = computed(() => props.results.length > 0 && props.results.every(r => r.ok || r.warning))

const actionType = computed(() => {
  if (props.isRepairing) return 'repairing'
  if (allOk.value) return 'ok'
  if (dllFailed.value || conflictFailed.value || watchdogFailed.value) return 'env'
  if (tomlFailed.value) return 'repair'
  if (crPending.value) return 'migrate'
  return 'none'
})

const buttonText = computed(() => {
  switch (actionType.value) {
    case 'repairing': return t('app.diagRepairing')
    case 'ok': return t('app.diagEnvOk')
    case 'env': return t('app.diagRepairEnv')
    case 'repair': return t('app.diagRepairToml')
    case 'migrate': return t('app.diagMigrateCr')
    default: return t('app.diagNoAutoFix')
  }
})

const buttonClass = computed(() => {
  if (currentTheme.value === 'anime') {
    switch (actionType.value) {
      case 'repairing': return 'bg-pink-100 text-[#ff66b2] border border-pink-200'
      case 'ok': return 'bg-emerald-50 text-emerald-600 border border-emerald-200'
      case 'env':
      case 'repair':
      case 'migrate': return 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#70d6ff] text-white shadow-md hover:opacity-95'
      default: return 'bg-slate-100 text-slate-400 border border-slate-200'
    }
  }

  if (currentTheme.value === 'minimal') {
    switch (actionType.value) {
      case 'repairing': return 'bg-[#00f2ff]/20 text-[#00f2ff] border border-[#00f2ff]/30'
      case 'ok': return 'bg-green-500/10 text-green-400 border border-green-500/20'
      case 'env':
      case 'repair':
      case 'migrate': return 'bg-gradient-to-r from-[#00f2ff] to-[#3a7bd5] text-black font-black hover:brightness-110 shadow-[0_0_15px_rgba(0,242,255,0.3)]'
      default: return 'bg-[#131b2e] text-slate-500 border border-white/10'
    }
  }

  switch (actionType.value) {
    case 'repairing': return 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/30'
    case 'ok': return 'bg-green-500/10 text-green-400 border border-green-500/20'
    case 'env': return 'bg-[#00f3ff] text-black border border-[#00f3ff] hover:bg-white'
    case 'repair': return 'bg-[#00f3ff] text-black border border-[#00f3ff] hover:bg-white'
    case 'migrate': return 'bg-[#00f3ff] text-black border border-[#00f3ff] hover:bg-white'
    default: return 'bg-white/5 text-white/30 border border-white/10'
  }
})

function onActionClick() {
  if (actionType.value === 'env') {
    emit('repair-env')
  }
  if (actionType.value === 'repair') {
    emit('repair')
  }
  if (actionType.value === 'migrate') {
    emit('migrate-cr')
  }
}
</script>
