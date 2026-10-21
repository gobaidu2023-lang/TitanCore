<template>
  <div 
    v-if="visible" 
    class="fixed inset-0 z-50 flex items-center justify-center transition-all animate-fade-in" 
    :class="currentTheme === 'anime' ? 'bg-slate-900/40 backdrop-blur-sm' : (currentTheme === 'minimal' ? 'bg-[#06080e]/80 backdrop-blur-sm' : 'bg-black/80')" 
    @click.self="close"
  >
    <div 
      class="rounded-lg max-h-[82vh] flex flex-col transition-all border" 
      :class="currentTheme === 'anime'
        ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] text-[#1e192b]'
        : (currentTheme === 'minimal'
          ? 'bg-[#101623]/95 border-[#00f2ff]/30 shadow-[0_0_50px_rgba(0,242,255,0.18)] text-white backdrop-blur-xl'
          : 'bg-[#0d0e12] border-white/10 shadow-[0_0_40px_rgba(0,243,255,0.08)]')"
      :style="{ width: modalWidth + 'px', fontFamily: `'MiSans', 'HarmonyOS Sans SC', 'Microsoft YaHei', sans-serif` }"
    >
      <!-- 头部 -->
      <div 
        class="flex items-center justify-between px-6 py-4 border-b shrink-0 transition-colors"
        :class="currentTheme === 'anime' ? 'border-[#bce8ff]/60 bg-white/70' : 'border-white/5'"
      >
        <div class="flex items-center gap-3">
          <h3 
            class="font-black uppercase tracking-wider font-code" 
            :class="[screenWidth >= 3840 ? 'text-base' : 'text-sm', currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white']"
          >{{ t('cloud.title') }}</h3>
          <span class="text-xs font-code font-medium" :class="currentTheme === 'anime' ? 'text-slate-600' : 'text-zinc-500'">
            <template v-if="isVip">{{ t('cloud.slotsUsage', { used: usedSlots, max: maxSlots, usedMb, maxMb }) }}</template>
            <template v-else>{{ t('cloud.localBanner') }}</template>
          </span>
        </div>
        <div class="flex items-center gap-3">
          <select 
            v-if="accounts.length > 0" 
            v-model="selectedAccount" 
            @change="onAccountChange"
            class="text-xs rounded px-3 py-1.5 outline-none font-code border transition-all"
            :class="currentTheme === 'anime'
              ? 'bg-white border-[#e2d4f0] text-[#1e192b] focus:border-[#ff85b3]'
              : 'bg-[#0a0a0a] border-white/10 text-zinc-300 focus:border-[#00f3ff]/40'"
          >
            <option v-for="acc in accounts" :key="acc" :value="acc">Steam Account: {{ acc }}</option>
          </select>
          <button 
            @click="refresh" 
            class="transition-colors p-1 rounded" 
            :class="currentTheme === 'anime' ? 'text-slate-400 hover:text-[#ff66b2] hover:bg-pink-50' : 'text-zinc-500 hover:text-[#00f3ff]'" 
            :title="t('cloud.refresh')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          </button>
          <button 
            @click="close" 
            class="transition-colors p-1 rounded" 
            :class="currentTheme === 'anime' ? 'text-slate-400 hover:text-[#1e192b] hover:bg-pink-50' : 'text-zinc-500 hover:text-white'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <!-- 内容区：虚拟滚动 -->
      <div ref="listRef" class="flex-1 overflow-y-auto relative scrollbar-hide p-6" @scroll="onListScroll">
        <div v-if="loading" class="flex items-center justify-center py-16">
          <div 
            class="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            :class="currentTheme === 'anime' ? 'border-[#ff66b2]' : 'border-[#00f3ff]'"
          ></div>
          <span class="ml-3 text-xs font-code font-bold" :class="currentTheme === 'anime' ? 'text-slate-600' : 'text-zinc-400'">{{ t('cloud.scanning') }}</span>
        </div>

        <div v-else-if="items.length === 0" class="text-center py-16 text-xs" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-zinc-500'">
          <svg class="w-10 h-10 mx-auto mb-3" :class="currentTheme === 'anime' ? 'text-pink-300' : 'text-zinc-600'" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
          <p class="font-bold">{{ t('cloud.emptyTitle') }}</p>
          <p class="mt-1" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-zinc-600'">{{ t('cloud.emptyHint') }}</p>
        </div>

        <div v-else :style="{ height: virtualTotalHeight + 'px' }">
          <div :style="{ transform: `translateY(${virtualOffsetY}px)` }">
            <div 
              v-for="item in virtualVisibleItems" 
              :key="item.appId" 
              class="flex items-center gap-4 rounded-lg transition-all border"
              :class="[
                itemPaddingClass,
                currentTheme === 'anime' 
                  ? 'bg-white border-[#e2d4f0] shadow-sm hover:border-[#ff9ec7]' 
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              ]"
              :style="{ height: itemHeight + 'px' }"
            >
              <!-- 横图 -->
              <div 
                class="rounded overflow-hidden shrink-0 relative" 
                :class="currentTheme === 'anime' ? 'bg-slate-100' : 'bg-[#0a0a0a]'"
                :style="{ width: headerImgWidth + 'px', height: headerImgHeight + 'px' }"
              >
                <img 
                  v-if="item.headerImage" 
                  :src="item.headerImage" 
                  class="w-full h-full object-cover" 
                  draggable="false"
                  @error="item.headerImage = ''" 
                />
                <div v-else class="w-full h-full flex items-center justify-center text-xs" :class="currentTheme === 'anime' ? 'text-slate-400' : 'text-zinc-600'">{{ t('cloud.noCover') }}</div>
              </div>

              <!-- 信息 -->
              <div class="flex-1 min-w-0">
                <div 
                  class="truncate font-black" 
                  :class="[
                    screenWidth >= 3840 ? 'text-base' : 'text-sm',
                    currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'
                  ]"
                >{{ item.gameName || `AppID: ${item.appId}` }}</div>
                <div class="text-xs font-code mt-1" :class="currentTheme === 'anime' ? 'text-slate-500 font-bold' : 'text-zinc-500'">AppID: {{ item.appId }}</div>
                <div class="flex items-center gap-2 mt-2">
                  <span 
                    v-if="item.hasCloud" 
                    class="text-[10px] px-1.5 py-0.5 rounded font-bold border"
                    :class="currentTheme === 'anime' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-[#00f3ff]/10 text-[#00f3ff] border-[#00f3ff]/20'"
                  >
                    {{ t('cloud.syncedAt', { date: item.cloudDate }) }}
                  </span>
                  <span 
                    v-else 
                    class="text-[10px] px-1.5 py-0.5 rounded border"
                    :class="currentTheme === 'anime' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-zinc-800 text-zinc-400 border-white/5'"
                  >{{ t('cloud.notUploaded') }}</span>
                  <span 
                    v-if="!item.hasLocal" 
                    class="text-[10px] px-1.5 py-0.5 rounded border font-bold"
                    :class="currentTheme === 'anime' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-yellow-900/20 text-yellow-500 border border-yellow-700/20'"
                  >{{ t('cloud.cloudOnly') }}</span>
                </div>
              </div>

              <!-- 按钮操作组 -->
              <div class="flex items-center gap-2 shrink-0">
                <!-- 1. 云端功能：仅 VIP 可用 -->
                <button 
                  @click="handleUpload(item)" 
                  :disabled="!isVip || busyAppId === item.appId || !item.hasLocal"
                  :title="!isVip ? t('cloud.vipOnly') : ''"
                  class="rounded font-black transition-all disabled:opacity-20 disabled:cursor-not-allowed border"
                  :class="[
                    btnSizeClass,
                    currentTheme === 'anime'
                      ? 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#6be5ff] text-white border-transparent shadow-sm hover:opacity-90'
                      : 'bg-[#00f3ff]/10 text-[#00f3ff] border-[#00f3ff]/30 hover:bg-[#00f3ff]/20'
                  ]"
                >
                  {{ busyAppId === item.appId && busyAction === 'upload' ? t('cloud.uploadBusy') : t('cloud.upload') }}
                </button>
                <button 
                  @click="handleDownload(item)" 
                  :disabled="!isVip || busyAppId === item.appId || !item.hasCloud"
                  :title="!isVip ? t('cloud.vipOnly') : ''"
                  class="rounded font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed border"
                  :class="[
                    btnSizeClass,
                    currentTheme === 'anime'
                      ? 'bg-pink-50 text-[#ff66b2] border-[#ff9ec7] hover:bg-pink-100'
                      : 'bg-white/[0.04] text-zinc-300 border-white/10 hover:bg-white/[0.08]'
                  ]"
                >
                  {{ busyAppId === item.appId && busyAction === 'download' ? t('cloud.downloadBusy') : t('cloud.download') }}
                </button>

                <!-- 2. 本地工具：全员免费开放（不受 isVip 限制） -->
                <button 
                  @click="handleManualPack(item)" 
                  :disabled="busyAppId === item.appId || !item.hasLocal"
                  class="rounded font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed border"
                  :class="[
                    btnSizeClass,
                    currentTheme === 'anime'
                      ? 'bg-white text-[#4a425a] border-[#e2d4f0] hover:bg-slate-50 hover:text-[#ff66b2]'
                      : 'bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.08]'
                  ]"
                >
                  {{ t('cloud.localBackup') }}
                </button>
                <button 
                  @click="handleOpenLocalFolder(item)" 
                  :disabled="busyAppId === item.appId || !item.hasLocal"
                  class="rounded font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed border"
                  :class="[
                    btnSizeClass,
                    currentTheme === 'anime'
                      ? 'bg-white text-[#4a425a] border-[#e2d4f0] hover:bg-slate-50 hover:text-[#ff66b2]'
                      : 'bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.08]'
                  ]"
                >
                  {{ t('cloud.localOpen') }}
                </button>
                <button 
                  @click="handleManualRestore(item)" 
                  :disabled="busyAppId === item.appId"
                  class="rounded font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed border"
                  :class="[
                    btnSizeClass,
                    currentTheme === 'anime'
                      ? 'bg-white text-[#4a425a] border-[#e2d4f0] hover:bg-slate-50 hover:text-[#ff66b2]'
                      : 'bg-white/[0.04] text-zinc-400 border-white/10 hover:bg-white/[0.08]'
                  ]"
                >
                  {{ t('cloud.localRestore') }}
                </button>

                <!-- 3. 云端功能：仅 VIP 可用 -->
                <button 
                  @click="handleDelete(item)" 
                  :disabled="!isVip || busyAppId === item.appId"
                  :title="!isVip ? t('cloud.vipOnly') : ''"
                  class="rounded font-bold transition-all disabled:opacity-20 disabled:cursor-not-allowed border"
                  :class="[
                    btnSizeClass,
                    currentTheme === 'anime'
                      ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                      : 'bg-red-950/30 text-red-400 border-red-900/30 hover:bg-red-900/50'
                  ]"
                >
                  {{ t('cloud.delete') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from '../composables/useTheme'
import Swal from 'sweetalert2'
import { t } from '../i18n'

const { currentTheme } = useTheme()

interface CloudSaveItem {
  appId: string
  gameName: string
  headerImage: string
  hasLocal: boolean
  hasCloud: boolean
  cloudDate: string
}

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const authStore = useAuthStore()
const isVip = computed(() => authStore.isVip)

const accounts = ref<string[]>([])
const selectedAccount = ref('')
const items = ref<CloudSaveItem[]>([])
const loading = ref(false)
const busyAppId = ref('')
const busyAction = ref('')

const usedSlots = ref(0)
const maxSlots = ref(10)
const usedMb = ref(0)
const maxMb = ref(1024)

const close = () => emit('close')

// ================= 分辨率自适应 =================
const screenWidth = ref(window.innerWidth)
const updateScreenWidth = () => { screenWidth.value = window.innerWidth }

const modalWidth = computed(() => {
  const w = screenWidth.value
  if (w >= 3840) return 1400
  if (w >= 2560) return 1200
  if (w >= 1920) return 960
  return Math.min(Math.round(w * 0.92), 960)
})

const headerImgWidth = computed(() => {
  const w = screenWidth.value
  if (w >= 3840) return 320
  if (w >= 2560) return 280
  if (w >= 1920) return 214
  return 180
})
const headerImgHeight = computed(() => Math.round(headerImgWidth.value / 2.14))

// 列表项自适应高度与内边距
const itemHeight = computed(() => {
  const w = screenWidth.value
  if (w >= 3840) return 180
  if (w >= 2560) return 160
  return 140
})

const itemPaddingClass = computed(() => {
  const w = screenWidth.value
  if (w >= 3840) return 'p-5'
  if (w >= 2560) return 'p-4'
  return 'p-3'
})

const btnSizeClass = computed(() => {
  const w = screenWidth.value
  if (w >= 3840) return 'h-10 px-4 text-sm'
  if (w >= 2560) return 'h-9 px-3 text-xs'
  return 'h-8 px-3 text-xs'
})

// ================= 虚拟滚动 =================
const listRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const listHeight = ref(600)
const BUFFER_COUNT = 4

const virtualTotalHeight = computed(() => items.value.length * itemHeight.value)
const virtualStart = computed(() => Math.max(0, Math.floor(scrollTop.value / itemHeight.value) - BUFFER_COUNT))
const virtualEnd = computed(() => Math.min(items.value.length, Math.ceil((scrollTop.value + listHeight.value) / itemHeight.value) + BUFFER_COUNT))
const virtualVisibleItems = computed(() => {
  return items.value.slice(virtualStart.value, virtualEnd.value).map((item, idx) => ({
    ...item,
    _virtualIndex: virtualStart.value + idx
  }))
})
const virtualOffsetY = computed(() => virtualStart.value * itemHeight.value)

const onListScroll = (e: Event) => {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

let listRO: ResizeObserver | null = null

watch(() => props.visible, (v) => {
  if (v) refresh()
})

async function refresh() {
  loading.value = true
  items.value = []
  try {
    const scanRes = await window.electron.invoke('cloudsave:scan-accounts')
    accounts.value = scanRes.accounts || []
    if (accounts.value.length > 0 && !selectedAccount.value) {
      selectedAccount.value = accounts.value[0]
    }

    if (selectedAccount.value) {
      const localRes = await window.electron.invoke('cloudsave:scan-saves', selectedAccount.value)
      const localItems: CloudSaveItem[] = localRes.items || []

      let cloudItems: any[] = []
      if (isVip.value) {
        try {
          const listRes = await window.electron.invoke('cloudsave:list')
          if (listRes?.data?.apps) {
            cloudItems = listRes.data.apps
            usedSlots.value = listRes.data.quota?.used_slots || 0
            maxSlots.value = listRes.data.quota?.max_slots || 10
            usedMb.value = listRes.data.quota?.used_mb || 0
            maxMb.value = listRes.data.quota?.max_mb || 1024
          }
        } catch (e) {
          console.warn('[CloudSave] 拉取云端列表失败:', e)
        }
      }

      const merged = new Map<string, CloudSaveItem>()
      for (const it of localItems) {
        merged.set(it.appId, { ...it, hasCloud: false, cloudDate: '' })
      }
      for (const c of cloudItems) {
        const appId = String(c.app_id)
        if (merged.has(appId)) {
          const existing = merged.get(appId)!
          existing.hasCloud = c.has_backup
          existing.cloudDate = c.backup_at || ''
          if (c.game_name && !existing.gameName) existing.gameName = c.game_name
        } else {
          merged.set(appId, {
            appId,
            gameName: c.game_name || `AppID: ${appId}`,
            headerImage: `titan-img://steam/steam_gate_${appId}?header=1`,
            hasLocal: false,
            hasCloud: c.has_backup,
            cloudDate: c.backup_at || ''
          })
        }
      }
      items.value = Array.from(merged.values())
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.scanFailed'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  } finally {
    loading.value = false
  }
}

function onAccountChange() {
  refresh()
}

async function handleUpload(item: CloudSaveItem) {
  if (!isVip.value) {
    Swal.fire({
      title: t('cloud.vipTitle'),
      text: t('cloud.vipText'),
      icon: 'info',
      background: '#121212',
      color: '#fff',
      confirmButtonColor: '#00f3ff',
      confirmButtonText: t('cloud.vipConfirm')
    })
    return
  }
  if (!item.hasLocal) return
  busyAppId.value = item.appId
  busyAction.value = 'upload'
  try {
    const result = await window.electron.invoke('cloudsave:upload', selectedAccount.value, item.appId, item.gameName)
    if (result.success) {
      Swal.fire({ title: t('cloud.uploadSuccess'), text: t(result.msg), icon: 'success', background: '#121212', color: '#fff', confirmButtonColor: '#00f3ff' })
      await refresh()
    } else {
      Swal.fire({ title: t('cloud.uploadFailed'), text: t(result.msg), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.uploadError'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  } finally {
    busyAppId.value = ''
    busyAction.value = ''
  }
}

async function handleDownload(item: CloudSaveItem) {
  if (!isVip.value) {
    Swal.fire({
      title: t('cloud.vipTitle'),
      text: t('cloud.vipText'),
      icon: 'info',
      background: '#121212',
      color: '#fff',
      confirmButtonColor: '#00f3ff',
      confirmButtonText: t('cloud.vipConfirm')
    })
    return
  }
  if (!item.hasCloud) return
  const confirm = await Swal.fire({
    title: t('cloud.restoreConfirmTitle'),
    html: t('cloud.restoreConfirmHtml', { game: item.gameName || item.appId }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('cloud.confirmRestore'),
    cancelButtonText: t('common.cancel'),
    background: '#121212',
    color: '#fff',
    confirmButtonColor: '#00f3ff',
    cancelButtonColor: '#333'
  })
  if (!confirm.isConfirmed) return

  busyAppId.value = item.appId
  busyAction.value = 'download'
  try {
    const result = await window.electron.invoke('cloudsave:download', selectedAccount.value, item.appId)
    if (result.success) {
      Swal.fire({ title: t('cloud.restoreDone'), text: result.msg ? t(result.msg) : t('cloud.restoreDoneDefault'), icon: 'success', background: '#121212', color: '#fff', confirmButtonColor: '#00f3ff' })
      await refresh()
    } else {
      Swal.fire({ title: t('cloud.restoreInfo'), text: t(result.msg), icon: 'info', background: '#121212', color: '#fff', confirmButtonColor: '#00f3ff' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.restoreError'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  } finally {
    busyAppId.value = ''
    busyAction.value = ''
  }
}

async function handleManualPack(item: CloudSaveItem) {
  if (!item.hasLocal) return
  busyAppId.value = item.appId
  busyAction.value = 'pack'
  try {
    const result = await window.electron.invoke('cloudsave:manual-pack', selectedAccount.value, item.appId)
    if (result.success) {
      Swal.fire({ title: t('cloud.packDone'), text: t('cloud.packDonePath', { path: result.path }), icon: 'success', background: '#121212', color: '#fff', confirmButtonColor: '#00f3ff' })
    } else if (result.msg !== 'ERR_CANCELLED') {
      Swal.fire({ title: t('cloud.packFailed'), text: t(result.msg), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.packError'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  } finally {
    busyAppId.value = ''
    busyAction.value = ''
  }
}

async function handleOpenLocalFolder(item: CloudSaveItem) {
  try {
    const result = await window.electron.invoke('cloudsave:open-local-folder', selectedAccount.value, item.appId)
    if (!result.success) {
      if (result.notFound) {
        const ask = await Swal.fire({
          title: t('cloud.archiveMissingTitle'),
          html: t('cloud.archiveMissingHtml', { game: item.gameName }),
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: t('cloud.packNow'),
          cancelButtonText: t('cloud.packLater'),
          background: '#121212',
          color: '#fff',
          confirmButtonColor: '#00f3ff',
          cancelButtonColor: '#333'
        })
        if (ask.isConfirmed) {
          await handleManualPack(item)
        }
      } else {
        Swal.fire({ title: t('cloud.openFailed'), text: t(result.msg), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
      }
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.errorGeneric'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  }
}

async function handleManualRestore(item: CloudSaveItem) {
  const confirm = await Swal.fire({
    title: t('cloud.importTitle'),
    html: t('cloud.importHtml', { game: item.gameName || item.appId }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('cloud.chooseFileRestore'),
    cancelButtonText: t('common.cancel'),
    background: '#121212',
    color: '#fff',
    confirmButtonColor: '#00f3ff',
    cancelButtonColor: '#333'
  })
  if (!confirm.isConfirmed) return

  busyAppId.value = item.appId
  busyAction.value = 'restore'
  try {
    const result = await window.electron.invoke('cloudsave:manual-restore', selectedAccount.value, item.appId)
    if (result.success) {
      Swal.fire({ title: t('cloud.importSuccess'), text: t(result.msg), icon: 'success', background: '#121212', color: '#fff', confirmButtonColor: '#00f3ff' })
      await refresh()
    } else if (result.msg !== 'ERR_CANCELLED') {
      Swal.fire({ title: t('cloud.restoreInfo'), text: t(result.msg), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.restoreError'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  } finally {
    busyAppId.value = ''
    busyAction.value = ''
  }
}

async function handleDelete(item: CloudSaveItem) {
  if (!isVip.value) {
    Swal.fire({
      title: t('cloud.vipTitle'),
      text: t('cloud.vipText'),
      icon: 'info',
      background: '#121212',
      color: '#fff',
      confirmButtonColor: '#00f3ff',
      confirmButtonText: t('cloud.vipConfirm')
    })
    return
  }
  const confirm = await Swal.fire({
    title: t('cloud.deleteConfirmTitle'),
    html: t('cloud.deleteConfirmHtml', { game: item.gameName || item.appId }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('cloud.confirmDelete'),
    cancelButtonText: t('common.cancel'),
    background: '#121212',
    color: '#fff',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#333'
  })
  if (!confirm.isConfirmed) return

  busyAppId.value = item.appId
  busyAction.value = 'delete'
  try {
    const result = await window.electron.invoke('cloudsave:delete', item.appId)
    if (result.success) {
      Swal.fire({ title: t('cloud.deleted'), text: t('cloud.deletedText'), icon: 'success', background: '#121212', color: '#fff', confirmButtonColor: '#00f3ff' })
      await refresh()
    } else {
      Swal.fire({ title: t('cloud.deleteFailed'), text: t(result.msg), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
    }
  } catch (e: any) {
    Swal.fire({ title: t('cloud.deleteError'), text: t(e.message), icon: 'error', background: '#121212', color: '#fff', confirmButtonColor: '#ef4444' })
  } finally {
    busyAppId.value = ''
    busyAction.value = ''
  }
}

onMounted(() => {
  window.addEventListener('resize', updateScreenWidth)
  if (props.visible) refresh()
  if (listRef.value) {
    listHeight.value = listRef.value.clientHeight
    listRO = new ResizeObserver(([entry]) => {
      listHeight.value = entry.contentRect.height
    })
    listRO.observe(listRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenWidth)
  listRO?.disconnect()
})
</script>