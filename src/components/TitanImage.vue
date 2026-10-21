<template>
  <img 
    :src="currentSrc" 
    :alt="alt || ''" 
    class="w-full h-full object-cover bg-[#050505] transition-opacity duration-200"
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
  src: string
  alt?: string
  // 仅 LibraryView 开启：true = 首跳 Steam 本地竖图；false/缺省 = 跳过 L1 直接从 Titan 缓存起
  localSteamFirst?: boolean
}>(), {
  localSteamFirst: false
})

const currentSrc = ref('')
const show = ref(false)

const load = () => {
  show.value = false
  if (props.localSteamFirst) {
    // L1: 优先 Steam 本地竖图（用户已购/已装游戏的官方封面，零网络、最高清）
    currentSrc.value = `titan-img://steam/${props.id}`
  } else {
    // 默认全局关闭 Steam 本地读取：直接从 L2 Titan 缓存封面起跳，handleError 的 L2->L3->L4 兜底链不变
    currentSrc.value = `titan-img://cover/${props.id}`
  }
}

const onLoad = () => {
  show.value = true
}

const handleError = () => {
  // L1 steam 失败 → L2 Titan 缓存
  if (currentSrc.value.startsWith('titan-img://steam/')) {
    currentSrc.value = `titan-img://cover/${props.id}`
    return
  }
  // L2 cover 失败 → L3 网络 coverurl
  if (currentSrc.value.startsWith('titan-img://cover/')) {
    currentSrc.value = props.src || defaultCover
    return
  }
  // L3 网络失败 → L4 默认兜底
  if (currentSrc.value !== defaultCover) {
    currentSrc.value = defaultCover
  }
}

watch(() => props.id, load, { immediate: true })
</script>