// src/composables/useShareBanner.ts
import { ref } from 'vue'

const STORAGE_KEY = 'titan_hide_sharegame_banner'

// 全局响应式状态单例，确保多主题、多组件之间状态毫秒级实时同步
const isShareBannerDismissed = ref(
  typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === '1' : false
)

export function useShareBanner() {
  const dismissBanner = () => {
    isShareBannerDismissed.value = true
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch (e) {
      console.warn('[useShareBanner] Failed to persist hide state to localStorage:', e)
    }
  }

  const resetBanner = () => {
    isShareBannerDismissed.value = false
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('[useShareBanner] Failed to clear hide state from localStorage:', e)
    }
  }

  return {
    isShareBannerDismissed,
    dismissBanner,
    resetBanner
  }
}
