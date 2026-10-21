import { ref, watch } from 'vue'

export type ThemeName = 'titan' | 'minimal' | 'anime' | 'warning' | 'pink'

const currentTheme = ref<ThemeName>('titan')

watch(currentTheme, (theme) => {
  document.documentElement.setAttribute('data-theme', theme)
}, { immediate: true })

export function setTheme(name: ThemeName) {
  currentTheme.value = name
  document.documentElement.setAttribute('data-theme', name)
  localStorage.setItem('titan-theme', name)
}

export function initTheme() {
  const saved = localStorage.getItem('titan-theme') as ThemeName | null
  if (saved && ['titan', 'minimal', 'anime', 'warning', 'pink'].includes(saved)) {
    setTheme(saved)
  } else {
    setTheme('titan')
  }
}

export function useTheme() {
  return {
    currentTheme,
    setTheme,
    initTheme
  }
}
