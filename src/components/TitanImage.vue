<template>
  <img 
    :src="currentSrc" 
    :alt="alt || ''" 
    class="w-full h-full object-cover bg-[#050505] transition-opacity duration-200 select-none"
    :class="show ? 'opacity-100' : 'opacity-0'"
    @load="onLoad"
    @error="handleError" 
    draggable="false"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import defaultCover from '../assets/default_cover.webp'

const props = withDefaults(defineProps<{
  id: string
  src?: string
  alt?: string
  // 仅 LibraryView 开启：true = 首跳 Steam 本地竖图；false/缺省 = 走标准 L1-L2-L3-L4 兜底
  localSteamFirst?: boolean
}>(), {
  src: '',
  alt: '',
  localSteamFirst: false
})

const currentSrc = ref('')
const show = ref(false)
let currentStage = 0
let lastTrackKey = ''

const applyStage = () => {
  const cleanId = props.id ? String(props.id).trim() : ''
  const cleanSrc = props.src ? String(props.src).trim() : ''

  if (!cleanId && !cleanSrc) {
    currentSrc.value = defaultCover
    return
  }

  if (props.localSteamFirst) {
    // 库视图优先模式：Steam 本地(0) -> Titan 缓存(1) -> 网络图(2) -> 默认图(3)
    if (currentStage === 0) {
      currentSrc.value = cleanId ? `titan-img://steam/${cleanId}` : defaultCover
    } else if (currentStage === 1) {
      currentSrc.value = cleanId ? `titan-img://cover/${cleanId}` : defaultCover
    } else if (currentStage === 2) {
      if (cleanSrc && cleanSrc !== defaultCover) {
        currentSrc.value = cleanSrc
      } else {
        currentStage = 3
        currentSrc.value = defaultCover
      }
    } else {
      currentSrc.value = defaultCover
    }
  } else {
    // 标准模式：网络图(0) -> Titan 缓存(1) -> Steam 本地(2) -> 默认图(3)
    if (currentStage === 0) {
      if (cleanSrc && cleanSrc !== defaultCover) {
        currentSrc.value = cleanSrc
      } else {
        currentStage = 1
        currentSrc.value = cleanId ? `titan-img://cover/${cleanId}` : defaultCover
      }
    } else if (currentStage === 1) {
      currentSrc.value = cleanId ? `titan-img://cover/${cleanId}` : defaultCover
    } else if (currentStage === 2) {
      currentSrc.value = cleanId ? `titan-img://steam/${cleanId}` : defaultCover
    } else {
      currentSrc.value = defaultCover
    }
  }
}

const load = () => {
  const trackKey = `${props.id}|${props.src}|${props.localSteamFirst}`
  if (trackKey === lastTrackKey && currentSrc.value) return
  lastTrackKey = trackKey

  show.value = false
  currentStage = 0
  applyStage()
}

const onLoad = () => {
  show.value = true
}

const handleError = () => {
  if (currentStage >= 3 || currentSrc.value === defaultCover) {
    // 已到达终极兜底，彻底终止，绝不重入或振荡
    show.value = true
    return
  }

  currentStage++
  applyStage()
}

watch(() => [props.id, props.src, props.localSteamFirst], load, { immediate: true })
</script>
