<template>
  <button
    type="button"
    class="titan-launch-btn"
    :class="[
      `is-${status}`,
      `theme-${resolvedTheme}`,
      { 'force-hover': forceHover }
    ]"
    :disabled="status === 'running'"
    @click.stop="handleClick"
  >
    <!-- 顶部环境高光反射层 -->
    <span class="btn-gloss"></span>

    <!-- 左侧：图标 + 主文案 -->
    <span class="btn-main">
      <svg
        v-if="status !== 'running'"
        class="play-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M7 5.5v13l11-6.5-11-6.5z" />
      </svg>
      <span v-else class="running-indicator"></span>
      <span class="main-text">
        {{ displayText }}
      </span>
    </span>

    <!-- 右侧：协议/状态副标签 -->
    <span class="btn-sub">
      {{ displaySubText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme, type ThemeName } from '../composables/useTheme'
import { t } from '../i18n'

interface Props {
  /** 按钮状态: 'ready' (默认就绪) | 'running' (运行中) */
  status?: 'ready' | 'running'
  /** 显式指定主题，未传入时自动同步全局 useTheme */
  theme?: ThemeName
  /** 仅用于UI展板调试或父卡片联动：强制锁定 Hover 亮起效果 */
  forceHover?: boolean
  /** 自定义主标题文案（覆盖默认） */
  text?: string
  /** 自定义副标签文案（覆盖默认） */
  subText?: string
}

const props = withDefaults(defineProps<Props>(), {
  status: 'ready',
  forceHover: false
})

const emit = defineEmits<{
  (e: 'launch'): void
}>()

const { currentTheme } = useTheme()

// 映射为 titan / minimal / anime 三大核心主题体系
const resolvedTheme = computed(() => {
  if (props.theme) {
    if (props.theme === 'anime' || props.theme === 'pink') return 'anime'
    if (props.theme === 'minimal') return 'minimal'
    return 'titan'
  }
  const theme = currentTheme.value
  if (theme === 'anime' || theme === 'pink') return 'anime'
  if (theme === 'minimal') return 'minimal'
  return 'titan'
})

const displayText = computed(() => {
  if (props.text) return props.text
  if (props.status === 'running') {
    return t('library.launch.inGame') || '游戏中'
  }
  return t('library.launch.launchGame') || '启动游戏'
})

const displaySubText = computed(() => {
  if (props.subText) return props.subText
  return props.status === 'running' ? 'RUNNING' : 'READY'
})

const handleClick = () => {
  if (props.status === 'running') return
  emit('launch')
}
</script>

<style scoped>
/* ==========================================================
   基础骨架与工业级物理过渡 (严格按规范 Round corner: 6px)
   ========================================================== */
.titan-launch-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 36px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  outline: none;
  font-family: 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  transition: 
    background 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.1s ease;
  backdrop-filter: blur(8px);
}

/* 顶部微弱玻璃高光带 */
.btn-gloss {
  position: absolute;
  top: 0;
  left: 6%;
  right: 6%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.22s ease;
}

/* 左侧主视觉区 (▶ 启动游戏) */
.btn-main {
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 1;
  min-width: 0;
}

.play-icon {
  width: 13.5px;
  height: 13.5px;
  flex-shrink: 0;
  transition: all 0.22s ease;
}

.main-text {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.22s ease;
}

/* 右侧副标签区 (READY / RUNNING) - 战术仪表等宽字阶 */
.btn-sub {
  z-index: 1;
  font-family: 'JetBrains Mono', 'Rajdhani', 'Consolas', monospace;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  flex-shrink: 0;
  margin-left: 6px;
  transition: all 0.22s ease;
}

/* 点击下压物理反馈 (阻尼回弹) */
.titan-launch-btn.is-ready:active {
  transform: scale(0.982);
}

/* 运行中呼吸指示点 */
.running-indicator {
  width: 6.5px;
  height: 6.5px;
  border-radius: 50%;
  flex-shrink: 0;
  animation: titan-pulse 1.6s infinite ease-in-out;
}

@keyframes titan-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.82); }
}

/* ==========================================================
   主题一：TITAN (赛博工业 / 经典电光青)
   ========================================================== */
.titan-launch-btn.theme-titan {
  /* 常规/未悬停状态 (idle) */
  background: linear-gradient(180deg, rgba(14, 38, 46, 0.88) 0%, rgba(8, 22, 28, 0.96) 100%);
  border: 1px solid rgba(0, 216, 214, 0.35);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 10px rgba(0, 216, 214, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.6);
}

.titan-launch-btn.theme-titan .play-icon {
  color: #20e3e3;
  filter: drop-shadow(0 0 4px rgba(32, 227, 227, 0.4));
}

.titan-launch-btn.theme-titan .main-text {
  color: #2ce0e0;
  text-shadow: 0 0 8px rgba(44, 224, 224, 0.25);
}

.titan-launch-btn.theme-titan .btn-sub {
  color: rgba(44, 224, 224, 0.7);
}

/* Titan: 悬停/就绪状态 (hover) */
.titan-launch-btn.theme-titan.is-ready:hover,
.titan-launch-btn.theme-titan.is-ready.force-hover {
  background: linear-gradient(90deg, #00d8d6 0%, #0097e6 55%, #0052d4 100%);
  border-color: #7ef9ff;
  box-shadow: 
    0 0 16px rgba(0, 216, 214, 0.55),
    0 0 4px rgba(126, 249, 255, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.55),
    inset 0 -1px 2px rgba(0, 30, 80, 0.5);
}

.titan-launch-btn.theme-titan.is-ready:hover .btn-gloss,
.titan-launch-btn.theme-titan.is-ready.force-hover .btn-gloss {
  opacity: 0.95;
}

.titan-launch-btn.theme-titan.is-ready:hover .play-icon,
.titan-launch-btn.theme-titan.is-ready.force-hover .play-icon {
  color: #ffffff;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.9));
  transform: translateX(1px);
}

.titan-launch-btn.theme-titan.is-ready:hover .main-text,
.titan-launch-btn.theme-titan.is-ready.force-hover .main-text {
  color: #ffffff;
  text-shadow: 0 1px 6px rgba(0, 40, 80, 0.65), 0 0 10px rgba(255, 255, 255, 0.5);
}

.titan-launch-btn.theme-titan.is-ready:hover .btn-sub,
.titan-launch-btn.theme-titan.is-ready.force-hover .btn-sub {
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 4px rgba(0, 30, 70, 0.6);
}

.titan-launch-btn.theme-titan.is-ready:active {
  box-shadow: 
    0 0 10px rgba(0, 216, 214, 0.4),
    inset 0 2px 4px rgba(0, 0, 0, 0.35);
}

/* Titan: 运行中状态 (running) */
.titan-launch-btn.theme-titan.is-running {
  cursor: default;
  background: linear-gradient(90deg, #88b01b 0%, #3d8b37 58%, #195427 100%);
  border-color: #b8e944;
  box-shadow: 
    0 0 14px rgba(136, 176, 27, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.45);
}

.titan-launch-btn.theme-titan.is-running .main-text {
  color: #f4ff81;
  text-shadow: 0 1px 4px rgba(0, 30, 0, 0.6), 0 0 8px rgba(244, 255, 129, 0.35);
}

.titan-launch-btn.theme-titan.is-running .btn-sub {
  color: #a5d6a7;
  text-shadow: 0 1px 2px rgba(0, 20, 0, 0.5);
}

.titan-launch-btn.theme-titan.is-running .running-indicator {
  background-color: #f4ff81;
  box-shadow: 0 0 6px #f4ff81;
}

/* ==========================================================
   主题二：MINIMAL / TECH (深空黑曜石 / 极简冷蓝未来)
   ========================================================== */
.titan-launch-btn.theme-minimal {
  /* 常规/未悬停状态 (idle) */
  background: linear-gradient(180deg, rgba(10, 16, 28, 0.88) 0%, rgba(6, 10, 18, 0.96) 100%);
  border: 1px solid rgba(0, 242, 255, 0.28);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.7);
}

.titan-launch-btn.theme-minimal .play-icon {
  color: #00f2ff;
  filter: drop-shadow(0 0 4px rgba(0, 242, 255, 0.35));
}

.titan-launch-btn.theme-minimal .main-text {
  color: #00f2ff;
  text-shadow: 0 0 8px rgba(0, 242, 255, 0.2);
}

.titan-launch-btn.theme-minimal .btn-sub {
  color: rgba(0, 242, 255, 0.65);
}

/* Minimal: 悬停/就绪状态 (hover) */
.titan-launch-btn.theme-minimal.is-ready:hover,
.titan-launch-btn.theme-minimal.is-ready.force-hover {
  background: linear-gradient(90deg, #00f2ff 0%, #0284c7 55%, #1e1b4b 100%);
  border-color: #a5f3fc;
  box-shadow: 
    0 0 16px rgba(0, 242, 255, 0.5),
    0 0 4px rgba(165, 243, 252, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.6),
    inset 0 -1px 2px rgba(2, 44, 76, 0.5);
}

.titan-launch-btn.theme-minimal.is-ready:hover .btn-gloss,
.titan-launch-btn.theme-minimal.is-ready.force-hover .btn-gloss {
  opacity: 0.95;
}

.titan-launch-btn.theme-minimal.is-ready:hover .play-icon,
.titan-launch-btn.theme-minimal.is-ready.force-hover .play-icon {
  color: #ffffff;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.95));
  transform: translateX(1px);
}

.titan-launch-btn.theme-minimal.is-ready:hover .main-text,
.titan-launch-btn.theme-minimal.is-ready.force-hover .main-text {
  color: #ffffff;
  text-shadow: 0 1px 6px rgba(0, 30, 60, 0.7), 0 0 8px rgba(255, 255, 255, 0.5);
}

.titan-launch-btn.theme-minimal.is-ready:hover .btn-sub,
.titan-launch-btn.theme-minimal.is-ready.force-hover .btn-sub {
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 4px rgba(0, 20, 50, 0.6);
}

.titan-launch-btn.theme-minimal.is-ready:active {
  box-shadow: 
    0 0 10px rgba(0, 242, 255, 0.4),
    inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

/* Minimal: 运行中状态 (running) */
.titan-launch-btn.theme-minimal.is-running {
  cursor: default;
  background: linear-gradient(90deg, #059669 0%, #047857 58%, #064e3b 100%);
  border-color: #34d399;
  box-shadow: 
    0 0 14px rgba(52, 211, 153, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.45);
}

.titan-launch-btn.theme-minimal.is-running .main-text {
  color: #a7f3d0;
  text-shadow: 0 1px 4px rgba(0, 30, 20, 0.6), 0 0 8px rgba(167, 243, 208, 0.35);
}

.titan-launch-btn.theme-minimal.is-running .btn-sub {
  color: #6ee7b7;
  text-shadow: 0 1px 2px rgba(0, 20, 10, 0.5);
}

.titan-launch-btn.theme-minimal.is-running .running-indicator {
  background-color: #34d399;
  box-shadow: 0 0 6px #34d399;
}

/* ==========================================================
   主题三：ANIME (初樱晨曦 / 二次元晶莹粉桃)
   ========================================================== */
.titan-launch-btn.theme-anime {
  /* 常规/未悬停状态 (idle) - 晶莹柔粉卡砖质感 */
  background: linear-gradient(180deg, rgba(255, 245, 249, 0.9) 0%, rgba(254, 226, 238, 0.96) 100%);
  border: 1px solid rgba(234, 143, 180, 0.5);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 2px 6px rgba(234, 143, 180, 0.2);
}

.titan-launch-btn.theme-anime .play-icon {
  color: #c24b78;
  filter: drop-shadow(0 0 4px rgba(194, 75, 120, 0.3));
}

.titan-launch-btn.theme-anime .main-text {
  color: #be3b6f;
  text-shadow: 0 0 6px rgba(190, 59, 111, 0.15);
}

.titan-launch-btn.theme-anime .btn-sub {
  color: rgba(190, 59, 111, 0.75);
}

/* Anime: 悬停/就绪状态 (hover) */
.titan-launch-btn.theme-anime.is-ready:hover,
.titan-launch-btn.theme-anime.is-ready.force-hover {
  background: linear-gradient(90deg, #f472b6 0%, #fb7185 55%, #ec4899 100%);
  border-color: #fbcfe8;
  box-shadow: 
    0 0 16px rgba(244, 114, 182, 0.6),
    0 0 6px rgba(251, 113, 133, 0.45),
    inset 0 1px 1px rgba(255, 255, 255, 0.65),
    inset 0 -1px 2px rgba(131, 24, 67, 0.4);
}

.titan-launch-btn.theme-anime.is-ready:hover .btn-gloss,
.titan-launch-btn.theme-anime.is-ready.force-hover .btn-gloss {
  opacity: 0.95;
}

.titan-launch-btn.theme-anime.is-ready:hover .play-icon,
.titan-launch-btn.theme-anime.is-ready.force-hover .play-icon {
  color: #ffffff;
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.95));
  transform: translateX(1px);
}

.titan-launch-btn.theme-anime.is-ready:hover .main-text,
.titan-launch-btn.theme-anime.is-ready.force-hover .main-text {
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(80, 7, 36, 0.6), 0 0 8px rgba(255, 255, 255, 0.5);
}

.titan-launch-btn.theme-anime.is-ready:hover .btn-sub,
.titan-launch-btn.theme-anime.is-ready.force-hover .btn-sub {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(80, 7, 36, 0.5);
}

.titan-launch-btn.theme-anime.is-ready:active {
  box-shadow: 
    0 0 10px rgba(244, 114, 182, 0.4),
    inset 0 2px 4px rgba(157, 23, 77, 0.25);
}

/* Anime: 运行中状态 (running) */
.titan-launch-btn.theme-anime.is-running {
  cursor: default;
  background: linear-gradient(90deg, #10b981 0%, #059669 55%, #047857 100%);
  border-color: #6ee7b7;
  box-shadow: 
    0 0 14px rgba(16, 185, 129, 0.4),
    inset 0 1px 1px rgba(255, 255, 255, 0.5);
}

.titan-launch-btn.theme-anime.is-running .main-text {
  color: #d1fae5;
  text-shadow: 0 1px 4px rgba(6, 78, 59, 0.6), 0 0 8px rgba(209, 250, 229, 0.35);
}

.titan-launch-btn.theme-anime.is-running .btn-sub {
  color: #a7f3d0;
  text-shadow: 0 1px 2px rgba(6, 78, 59, 0.5);
}

.titan-launch-btn.theme-anime.is-running .running-indicator {
  background-color: #34d399;
  box-shadow: 0 0 6px #34d399;
}

/* ==========================================================
   多分辨率多尺寸显示器自适应规则 (Micro-Responsive)
   ========================================================== */
@media (max-width: 1366px) {
  .titan-launch-btn {
    height: 34px;
    padding: 0 10px;
  }
  .main-text {
    font-size: 12px;
  }
  .btn-sub {
    font-size: 9.5px;
    letter-spacing: 0.5px;
  }
}
</style>
