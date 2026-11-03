<!-- 文件名: src/components/AccountMatrixModal.vue -->
<template>
  <BaseModal 
    :visible="visible" 
    @close="$emit('close')" 
    :show-close="true" 
    container-class="max-w-3xl w-[92vw] max-h-[85vh] bg-[#0e0e14] border border-[#00f3ff]/40 shadow-[0_0_60px_rgba(0,243,255,0.2)] rounded-2xl flex flex-col p-0 relative overflow-hidden"
  >
    <!-- 工业科技感顶部流光条 -->
    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00f3ff] to-transparent z-10"></div>

    <!-- 1. 模态框头部：固定高度，不参与滚动 -->
    <div class="px-6 py-5 md:px-8 md:py-6 border-b border-white/10 bg-[#12121a]/90 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl bg-[#00f3ff]/10 border border-[#00f3ff]/40 flex items-center justify-center text-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.25)] shrink-0">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h3 class="text-xl md:text-2xl font-black text-white tracking-widest flex items-center gap-3">
            <span>{{ t('gate.title') }}</span>
            <span class="text-xs px-2.5 py-0.5 rounded bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/40 font-code font-bold">
              GATEWAY MATRIX
            </span>
          </h3>
          <p class="text-xs md:text-sm text-gray-400 font-code tracking-wider mt-1">
            {{ t('gate.subtitle') }}
          </p>
        </div>
      </div>
    </div>

    <!-- 2. 模态框主体：弹性自适应滚动区域 -->
    <div class="px-6 py-5 md:px-8 md:py-6 overflow-y-auto flex-1 space-y-6 scrollbar-hide">
      
      <!-- 隔离总开关面板 -->
      <div class="flex items-center justify-between bg-black/40 border border-white/10 p-5 rounded-xl hover:border-white/20 transition-all">
        <div class="flex flex-col gap-1.5 pr-4">
          <span class="text-base md:text-lg font-bold text-white tracking-wider flex items-center gap-2.5">
            {{ t('gate.enableLabel') }}
            <span v-if="isGateEnabled" class="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_10px_#4ade80] animate-pulse"></span>
          </span>
          <span class="text-xs md:text-sm text-gray-400 font-code leading-relaxed">
            {{ isGateEnabled ? t('gate.modeIsolated') : t('gate.modeGlobal') }}
          </span>
        </div>

        <button 
          type="button"
          @click="isGateEnabled = !isGateEnabled"
          class="w-14 h-7 rounded-full transition-colors relative shrink-0 p-0.5 cursor-pointer"
          :class="isGateEnabled ? 'bg-[#00f3ff]' : 'bg-gray-700'"
        >
          <div 
            class="w-6 h-6 rounded-full bg-white transition-all shadow-md"
            :class="isGateEnabled ? 'translate-x-7' : 'translate-x-0'" 
          />
        </button>
      </div>

      <!-- 账号列表区域 -->
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between px-1">
          <span class="text-xs md:text-sm font-code font-bold tracking-widest text-gray-300 uppercase flex items-center gap-2">
            <span>{{ t('gate.matrixTitle') }}</span>
            <span class="text-[#00f3ff] font-bold">({{ accounts.length }})</span>
          </span>
        </div>
        <div class="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-hide">
          <div 
            v-for="acc in accounts" 
            :key="acc.steamId64"
            @click="toggleAccountSelection(acc.steamId64)"
            class="flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer"
            :class="[
              selectedIds.includes(acc.steamId64) && isGateEnabled
                ? 'bg-[#00f3ff]/10 border-[#00f3ff]/50 shadow-[0_0_15px_rgba(0,243,255,0.15)]'
                : 'bg-black/30 border-white/5 hover:border-white/20'
            ]"
          >
            <!-- 账号信息 -->
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-bold text-gray-300 font-code text-sm">
                {{ (acc.personaName || acc.accountName || '?').substring(0, 2).toUpperCase() }}
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-bold text-white flex items-center gap-2">
                  {{ acc.personaName || acc.accountName || acc.steamId64 }}
                  <span v-if="acc.mostRecent" class="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                    {{ t('gate.current') }}
                  </span>
                </span>
                <span class="text-xs text-gray-500 font-code">SteamID64: {{ acc.steamId64 }}</span>
              </div>
            </div>

            <!-- 复选框 -->
            <div class="p-2">
              <div 
                class="w-6 h-6 rounded-lg border transition-all flex items-center justify-center shadow-inner"
                :class="selectedIds.includes(acc.steamId64) && isGateEnabled ? 'bg-[#00f3ff] border-[#00f3ff] shadow-[0_0_12px_rgba(0,243,255,0.5)]' : 'bg-[#141414] border-white/20'"
              >
                <svg v-if="selectedIds.includes(acc.steamId64) && isGateEnabled" class="w-4 h-4 text-black font-black" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 异常提示条 -->
      <div v-if="saveError" class="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 font-code flex items-center gap-3">
        <svg class="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"/>
        </svg>
        <span>{{ saveError }}</span>
      </div>

      <!-- 零勾选阻断警告 -->
      <div v-if="isGateEnabled && selectedIds.length === 0" class="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-xs md:text-sm text-yellow-300 font-code leading-relaxed flex items-center gap-3">
        <svg class="w-5 h-5 text-yellow-400 shrink-0" fill="currentColor" viewBox="0 0 256 256">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm-8,56a8,8,0,0,1,16,0v56a8,8,0,0,1-16,0Zm8,104a12,12,0,1,1,12-12A12,12,0,0,1,128,184Z"/>
        </svg>
        <span>{{ t('gate.zeroSelectedWarn') }}</span>
      </div>

    </div>

    <!-- 3. 模态框底部：固定在弹窗底部，任何分辨率下清晰可见 -->
    <div class="px-6 py-4 md:px-8 md:py-5 border-t border-white/10 bg-[#12121a]/90 flex items-center justify-between shrink-0">
      <span class="text-xs md:text-sm text-gray-500 font-code hidden sm:inline">
        {{ t('gate.footerNote') }}
      </span>
      <div class="flex items-center gap-4 ml-auto">
        <button 
          type="button" 
          @click="$emit('close')"
          :disabled="isSaving" 
          class="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 font-bold font-code text-sm tracking-wider rounded-xl transition-all cursor-pointer"
        >
          {{ t('common.cancel') }}
        </button>
        <button 
          type="button" 
          @click="handleSave"
          :disabled="isSaving" 
          class="px-8 py-3 bg-[#00f3ff] hover:bg-white text-black font-black font-code text-sm tracking-widest rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.3)] transition-all flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
        >
          <span v-if="isSaving" class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
          <span>{{ isSaving ? t('gate.saving') : t('gate.save') }}</span>
        </button>
      </div>
    </div>

  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import BaseModal from './common/BaseModal.vue'
import { t } from '../i18n'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', activeCount: number): void
}>()
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


interface AccountItem {
  steamId64: string
  accountId: string
  personaName: string
  accountName: string
  mostRecent: boolean
  timestamp: number
}

const accounts = ref<AccountItem[]>([])
const selectedIds = ref<string[]>([])
const isGateEnabled = ref(false)

const isLoading = ref(false)
const isSaving = ref(false)
const saveError = ref('')

// 点击整行切换勾选状态
const toggleAccountSelection = (steamId64: string) => {
  if (!isGateEnabled.value || isSaving.value) return
  const idx = selectedIds.value.indexOf(steamId64)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(steamId64)
  }
}

const fetchAccounts = async () => {
  isLoading.value = true
  saveError.value = ''
  try {
    const accRes = await window.electron.invoke('engine:scan-detailed-accounts')
    if (accRes?.success && Array.isArray(accRes.accounts)) {
      accounts.value = accRes.accounts
    }

    const gateRes = await window.electron.invoke('engine:get-gate-status')
    if (gateRes?.success && gateRes.data) {
      isGateEnabled.value = !!gateRes.data.gateEnabled
      selectedIds.value = Array.isArray(gateRes.data.gateIds) ? [...gateRes.data.gateIds] : []
    }
  } catch (e: any) {
    console.error('[AccountMatrixModal] 读取账号配置失败:', e)
    saveError.value = t('gate.readFail')
  } finally {
    isLoading.value = false
  }
}

const handleSave = async () => {
  if (isSaving.value) return
  isSaving.value = true
  saveError.value = ''

  try {
    // 关键修正：深度序列化切断 Vue 3 Proxy，保证 Electron contextBridge 克隆安全
    const safeIds: string[] = isGateEnabled.value 
      ? JSON.parse(JSON.stringify(selectedIds.value)) 
      : []

    const payload = {
      enabled: isGateEnabled.value,
      ids: safeIds
    }

    const res = await window.electron.invoke('engine:save-account-gate', payload)
    
    if (res?.success) {
      emit('saved', isGateEnabled.value ? safeIds.length : 0)
      emit('close')
    } else {
      saveError.value = res?.msg ? t(res.msg) : t('gate.saveFail')
    }
  } catch (e: any) {
    console.error('[AccountMatrixModal] 保存调度异常:', e)
    saveError.value = e?.message ? t(e.message) : t('gate.saveUnknown')
  } finally {
    isSaving.value = false
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    saveError.value = ''
    fetchAccounts()
  }
})
</script>