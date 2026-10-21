import { defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
import { useTelemetryStore } from './telemetryStore'

export type SearchErrorType = 'NONE' | 'KEYWORD_INVALID' | 'RESOURCE_NOT_FOUND' | 'NETWORK_ERROR' | 'QUOTA_EXHAUSTED'

export const useSearchStore = defineStore('search', () => {
  const telemetryStore = useTelemetryStore()

  const isSearching = ref(false)
  const isWarping = ref(false)
  const hasSearched = ref(false)
  const searchResults = ref<any[]>([])
  const currentError = ref<SearchErrorType>('NONE')
  const radarRules = ref<{ red: string[]; yellow: string[] }>({ red: [], yellow: [] })
  const lastKeyword = ref('')
  const autoOpenItem = ref<any>(null)

  const cachedLinks = ref<{
    protocol: Record<string, { data: any[]; expires: number }>
    direct: Record<string, { data: any[]; expires: number }>
  }>({ protocol: {}, direct: {} })

  const initRadar = async () => {
    try {
      const rules = await window.electron.invoke('sys:get-config', 'radar_denuvo_rules')
      if (rules?.red) radarRules.value = rules
    } catch (e) {
      console.error('[SearchStore] 无法加载雷达规则:', e)
    }
  }

  const clearErrorState = () => {
    currentError.value = 'NONE'
  }

  const clearSearch = () => {
    hasSearched.value = false
    isWarping.value = false
    searchResults.value = []
    clearErrorState()
    lastKeyword.value = ''
    autoOpenItem.value = null
    cachedLinks.value = { protocol: {}, direct: {} }
  }

  const setCachedLinks = (id: string, type: string, links: any[]) => {
    const isProtocol = type === 'titan_protocol'
    const category = isProtocol ? 'protocol' : 'direct'
    const ttlMinutes = isProtocol ? 5 : ['tool', 'patch'].includes(type) ? 15 : 10

    cachedLinks.value[category][id] = {
      data: links,
      expires: Date.now() + ttlMinutes * 60 * 1000
    }
  }

  const getCachedLinks = (id: string, type: string): any[] | null => {
    const category = type === 'titan_protocol' ? 'protocol' : 'direct'
    const cache = cachedLinks.value[category][id]
    if (!cache) return null

    if (Date.now() < cache.expires) {
      return cache.data
    }
    delete cachedLinks.value[category][id]
    return null
  }

  // 统一解析 AppID 辅助函数
  const extractAppId = (item: any): string => {
    if (item.app_id) return String(item.app_id)
    if (item.meta?.target_id) return String(item.meta.target_id)
    if (item.meta_json) {
      try {
        const parsed = typeof item.meta_json === 'string' ? JSON.parse(item.meta_json) : item.meta_json
        if (parsed.target_id) return String(parsed.target_id)
      } catch {}
    }
    if (typeof item.id === 'string' && item.id.startsWith('steam_gate_')) {
      return item.id.replace('steam_gate_', '')
    }
    return ''
  }

  const doSearch = async (keyword: string) => {
    const kw = keyword.trim()
    if (!kw) return

    isWarping.value = true
    isSearching.value = true
    hasSearched.value = true
    searchResults.value = []
    clearErrorState()
    lastKeyword.value = kw
    autoOpenItem.value = null

    await nextTick()

    try {
      const result = await window.electron.invoke('sys:global-search', kw)

      if (result?.success && Array.isArray(result.data) && result.data.length > 0) {
        telemetryStore.trackSearch(kw, result.data.length)

        searchResults.value = result.data.map((item: any) => ({
          ...item,
          app_id: extractAppId(item),
          meta: item.meta || item.meta_json || {}
        }))

        if (result.data.length === 1 || (/^\d+$/.test(kw) && String(result.data[0].id) === kw)) {
          autoOpenItem.value = searchResults.value[0]
        }
      } else {
        currentError.value = result?.error || 'RESOURCE_NOT_FOUND'
      }
    } catch (e) {
      console.error('[SearchStore] 搜索异常:', e)
      currentError.value = 'NETWORK_ERROR'
    } finally {
      isSearching.value = false
      setTimeout(() => {
        isWarping.value = false
      }, 300)
    }
  }

  const checkRadarStatus = (appIdOrId: string | number): 'red' | 'yellow' | 'safe' => {
    const cleanId = String(appIdOrId).replace(/^(steam_gate_|titan_protocol_)/, '')
    if (radarRules.value.red.includes(cleanId)) return 'red'
    if (radarRules.value.yellow.includes(cleanId)) return 'yellow'
    return 'safe'
  }

  return {
    isSearching,
    isWarping,
    hasSearched,
    searchResults,
    currentError,
    lastKeyword,
    autoOpenItem,
    cachedLinks,
    doSearch,
    initRadar,
    checkRadarStatus,
    clearSearch,
    clearErrorState,
    setCachedLinks,
    getCachedLinks
  }
})