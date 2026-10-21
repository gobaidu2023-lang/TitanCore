// 文件名: src/stores/discoveryStore.ts
import { ref, computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { t } from '../i18n'

export const useDiscoveryStore = defineStore('discovery', () => {
  const activeTab = ref('titan_protocol')
  const isFetching = ref(false)
  const rawList = shallowRef<any[]>([])

  const syncPhase = ref<'syncing' | 'ready' | 'error'>('syncing')
  const lastSyncAt = ref(0)

  // ===================== [ 工业级并发与风暴拦截锁 ] =====================
  let inFlightPromise: Promise<void> | null = null
  let lastFetchedTab = ''
  let lastFetchedTime = 0
  const CACHE_TTL_MS = 1500 // 1.5秒内存防抖风暴锁

  const displayList = computed(() => {
    return rawList.value.map((item) => {
      const tagArray = item.tags ? item.tags.split(',').filter(Boolean) : []
      let meta: any = {}
      if (item.meta) {
        meta = item.meta
      } else if (item.meta_json) {
        try { meta = JSON.parse(item.meta_json) } catch {}
      }
      return {
        id: item.id,
        type: item.type,
        meta,
        basic: {
          title: item.title || t('discovery.unknownTitle'),
          tags: tagArray.length > 0 ? tagArray : [item.type.toUpperCase()],
          rating: item.rating || 0,
          cover: item.cover || '',
          desc: item.desc || meta.desc || ''
        }
      }
    })
  })

  const systemStatus = computed(() => {
    if (syncPhase.value === 'error') return 'offline'
    if (syncPhase.value === 'syncing') return 'syncing'
    return 'ready'
  })

  const fetchResources = async (isForceOverride = false): Promise<void> => {
    if (activeTab.value === 'nexus_gate') {
      rawList.value = []
      return
    }

    const now = Date.now()
    const currentTab = activeTab.value

    // 1. 命中内存风暴熔断：同 Tab、内存已有数据、且在 1.5 秒窗口内，非强制调用直接拦截，不走 IPC
    if (
      !isForceOverride &&
      rawList.value.length > 0 &&
      currentTab === lastFetchedTab &&
      now - lastFetchedTime < CACHE_TTL_MS
    ) {
      return
    }

    // 2. 并发合并（In-flight Promise Sharing）：若当前已有相同请求在路上，直接共享该 Promise
    if (inFlightPromise && !isForceOverride) {
      return inFlightPromise
    }

    isFetching.value = true

    inFlightPromise = (async () => {
      try {
        const res = await window.electron.invoke('sys:get-discovery-list', currentTab)
        // 仅当 Tab 未在异步请求期间被用户切走时才应用数据
        if (activeTab.value === currentTab) {
          rawList.value = res || []
          lastFetchedTab = currentTab
          lastFetchedTime = Date.now()
        }
      } catch (err) {
        console.error('[DiscoveryStore] fetchResources error:', err)
        if (activeTab.value === currentTab) {
          rawList.value = []
        }
      } finally {
        isFetching.value = false
        inFlightPromise = null
      }
    })()

    return inFlightPromise
  }

  const setSyncPhase = (phase: 'syncing' | 'ready' | 'error') => {
    syncPhase.value = phase
    if (phase === 'ready') {
      lastSyncAt.value = Date.now()
      // 同步完成置 ready 时重置时间戳，确保后续调用能够拿到刚落库的最新数据
      lastFetchedTime = 0
    }
  }

  const setTab = (tabId: string) => {
    if (activeTab.value === tabId) return
    activeTab.value = tabId
    // 切换 Tab 时强制发起拉取，不受同 Tab 冷却期限制
    fetchResources(true)
  }

  const init = async () => {
    if (activeTab.value !== 'nexus_gate') {
      await fetchResources()
    }
  }

  return {
    activeTab,
    isFetching,
    rawList,
    displayList,
    syncPhase,
    lastSyncAt,
    systemStatus,
    fetchResources,
    setSyncPhase,
    setTab,
    init
  }
})