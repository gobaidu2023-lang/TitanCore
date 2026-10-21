<template>
  <div class="npc-dialog-root">
    <div class="npc-dialog-inner">
      <!-- 立绘区：税务官居左，指挥官居右；缺失素材自动降级为文字徽章 -->
      <div class="portrait-zone" :class="{ right: current.speaker === 'commander' }">
        <img
          v-if="imgOk"
          :src="portraitSrc"
          class="portrait-img"
          :alt="current.name"
          @error="imgOk = false"
        />
        <div v-else class="portrait-fallback">{{ current.name.slice(0, 1) }}</div>
      </div>

      <!-- 台词区 -->
      <div class="dialog-zone">
        <div class="speaker-name" :class="{ 'demon-name': current.speaker === 'greater_demon' }">{{ current.name }}</div>
        <div class="dialog-text">{{ current.text }}</div>
        <div class="advance-hint">▼ 空格 继续（{{ idx + 1 }}/{{ lines.length }}）</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { DialogLine } from '../../../main/services/badab/game/quests'
import { miniGameAssetBase } from '../../../utils/minigameAssetBase'

const props = defineProps<{ lines: DialogLine[] }>()
const emit = defineEmits<{ done: [] }>()

const idx = ref(0)
const imgOk = ref(true)
const current = computed<DialogLine>(() => props.lines[idx.value])

const baseUrl = miniGameAssetBase

const portraitSrc = computed(() => {
  if (current.value.speaker === 'tax_officer') {
    const emo = current.value.emotion || 'normal'
    return `${baseUrl}/games/badab/npc/tax_officer_${emo}.png`
  }
  // batch16：修女立绘（素材缺失时自动降级为姓名字符徽章）
  if (current.value.speaker === 'battle_sister') {
    return `${baseUrl}/games/badab/npc/sister_normal.png`
  }
  // batch54：大魔立绘（命名约定 demon_normal.png，缺失自动降级徽章）
  if (current.value.speaker === 'greater_demon') {
    return `${baseUrl}/games/badab/npc/demon_normal.png`
  }
  return `${baseUrl}/games/badab/npc/commander_normal.png`
})

// 修复：对话链衔接时（lines 换源但组件实例复用）必须重置进度，否则越界崩溃
watch(() => props.lines, () => {
  idx.value = 0
  imgOk.value = true
})

function advance() {
  if (idx.value < props.lines.length - 1) {
    idx.value++
  } else {
    emit('done')
  }
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    advance()
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
/* 屏幕坐标定位：不随 Pixi 摄像机/滚轮缩放变化 */
.npc-dialog-root {
  position: absolute;
  inset: 0;
  z-index: 50;
  cursor: pointer;
  pointer-events: auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0) 45%);
}

.npc-dialog-inner {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  width: min(920px, 94vw);
  padding-bottom: 1.5vh;
}

.portrait-zone {
  flex-shrink: 0;
  display: flex;
  align-items: flex-end;
}
.portrait-zone.right {
  order: 2;
}

/* 半身立绘：整体放大、向下推出屏幕，下半身由根容器 overflow-hidden 裁掉 */
.portrait-img {
  height: 50vh;
  max-width: 36vw;
  object-fit: contain;
  object-position: bottom;
  transform: translateY(7vh);
  filter: drop-shadow(0 0 28px rgba(0, 0, 0, 0.85));
  user-select: none;
  -webkit-user-drag: none;
}

.portrait-fallback {
  width: 110px;
  height: 110px;
  margin-bottom: 4vh;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50px;
  font-weight: 900;
  color: #00f0ff;
  background: rgba(0, 240, 255, 0.08);
  border: 2px solid rgba(0, 240, 255, 0.5);
}

.dialog-zone {
  flex: 1;
  margin-bottom: 3.5vh;
  background: rgba(5, 8, 16, 0.93);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  padding: 18px 22px 12px;
  backdrop-filter: blur(10px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
}

.speaker-name {
  color: #00f0ff;
  font-weight: 900;
  letter-spacing: 0.25em;
  font-size: 17px;
  margin-bottom: 6px;
}

.demon-name {
  color: #ef4444 !important;
  text-shadow: 0 0 12px rgba(239, 68, 68, 0.8);
}

.dialog-text {
  color: #e4e4e7;
  font-size: 18px;
  line-height: 1.75;
  min-height: 64px;
}

.advance-hint {
  text-align: right;
  color: rgba(255, 255, 255, 0.35);
  font-size: 13px;
  margin-top: 6px;
  animation: npc-dialog-bob 1.1s ease-in-out infinite;
}

@keyframes npc-dialog-bob {
  0%, 100% { transform: translateY(0); opacity: 0.35; }
  50% { transform: translateY(3px); opacity: 0.8; }
}
</style>