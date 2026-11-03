<template>
  <BaseModal
    :visible="visible"
    @close="emitClose"
    :show-close="!isSwitching"
    :container-class="containerClass"
  >
    <!-- 顶部主题流光线 -->
    <div 
      class="absolute top-0 left-0 right-0 h-px pointer-events-none"
      :class="topGlowClass"
    ></div>

    <!-- 弹窗主标题区 -->
    <div class="flex items-center justify-between pb-4" :class="headerBorderClass">
      <div class="flex items-center gap-3">
        <span 
          class="w-[4px] h-[22px] rounded-sm"
          :class="accentBarClass"
        ></span>
        <h3 class="text-lg sm:text-xl font-bold tracking-wide flex items-center gap-2.5" :class="titleTextClass">
          {{ targetMode === 'pure' ? (t('settings.pureModeTitle') || '切换至纯净无感模式') : (t('settings.classicModeTitle') || '切换至经典兼容模式') }}
        </h3>
      </div>
      <span 
        class="text-[11px] font-mono tracking-widest px-2.5 py-1 rounded uppercase font-bold border"
        :class="badgeClass"
      >
        {{ targetMode === 'pure' ? 'PURE MODE' : 'CLASSIC MODE' }}
      </span>
    </div>

    <!-- 纯净模式特色解析大卡片 -->
    <div 
      v-if="targetMode === 'pure'"
      class="rounded-xl p-5 sm:p-6 flex flex-col gap-4 border transition-all"
      :class="pureCardClass"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center border" :class="pureIconBoxClass">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
          <span class="text-sm sm:text-base font-bold" :class="cardTitleClass">{{ t('settings.pureCardTitle') || '纯净模式 · 零文件污染' }}</span>
        </div>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded border" :class="recommendBadgeClass">
          {{ t('settings.pureBadge') || '强烈推荐' }}
        </span>
      </div>

      <p class="text-sm sm:text-base leading-relaxed font-sans" :class="descTextClass">
        {{ t('settings.pureModeDesc') || '通过内存挂起注入与导入表动态代理，实现 Steam 官方安装目录零文件改动、零写入。辅助组件完全独立分流，彻底杜绝网游反作弊误封风险。' }}
      </p>

      <div class="flex flex-wrap gap-2 pt-1 border-t" :class="cardFooterBorderClass">
        <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5" :class="tagPillClass">
          <span class="w-1.5 h-1.5 rounded-full" :class="tagDotClass"></span>
          {{ t('settings.pureTag1') || '不碰 Steam 目录' }}
        </span>
        <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5" :class="tagPillClass">
          <span class="w-1.5 h-1.5 rounded-full" :class="tagDotClass"></span>
          {{ t('settings.pureTag2') || '0 污染 0 写入' }}
        </span>
        <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5" :class="tagPillClass">
          <span class="w-1.5 h-1.5 rounded-full" :class="tagDotClass"></span>
          {{ t('settings.pureTag3') || '必须从 TC 启动生效' }}
        </span>
      </div>
    </div>

    <!-- 经典模式特色解析大卡片 -->
    <div 
      v-else
      class="rounded-xl p-5 sm:p-6 flex flex-col gap-4 border transition-all"
      :class="classicCardClass"
    >
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center border" :class="classicIconBoxClass">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span class="text-sm sm:text-base font-bold" :class="cardTitleClass">{{ t('settings.classicCardTitle') || '经典模式 · 兼容兜底' }}</span>
        </div>
        <span class="text-[11px] font-bold px-2 py-0.5 rounded border" :class="classicBadgeClass">
          {{ t('settings.classicBadge') || '经典方式' }}
        </span>
      </div>

      <p class="text-sm sm:text-base leading-relaxed font-sans" :class="descTextClass">
        {{ t('settings.classicModeDesc') || '将在 Steam 安装根目录下投放代理 DLL（如 xinput1_4.dll）。专治杀毒软件严格拦截注入、拒绝内存挂起的特殊妖机环境。如非纯净模式被杀软拦截，不建议日常开启。' }}
      </p>

      <div class="flex flex-wrap gap-2 pt-1 border-t" :class="cardFooterBorderClass">
        <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5" :class="tagPillClass">
          <span class="w-1.5 h-1.5 rounded-full" :class="classicTagDotClass"></span>
          {{ t('settings.classicTag1') || '部署进 Steam 根目录' }}
        </span>
        <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5" :class="tagPillClass">
          <span class="w-1.5 h-1.5 rounded-full" :class="classicTagDotClass"></span>
          {{ t('settings.classicTag2') || '大家熟悉的经典方式' }}
        </span>
        <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5" :class="tagPillClass">
          <span class="w-1.5 h-1.5 rounded-full" :class="classicTagDotClass"></span>
          {{ t('settings.classicTag3') || '直接开 Steam 也能用' }}
        </span>
      </div>
    </div>

    <!-- 底部操作按钮群 -->
    <div class="flex items-center gap-3 w-full pt-1">
      <button
        type="button"
        @click="emitClose"
        :disabled="isSwitching"
        class="flex-1 h-11 font-medium text-sm sm:text-base transition-all disabled:opacity-40"
        :class="cancelButtonClass"
      >
        {{ t('common.cancel') || '取消' }}
      </button>

      <button
        type="button"
        @click="emitConfirm"
        :disabled="isSwitching"
        class="flex-[1.2] h-11 text-sm sm:text-base transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        :class="confirmButtonClass"
      >
        <span v-if="isSwitching" class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="shrink-0">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>
          {{ isSwitching ? (t('settings.ostModeSwitching') || '正在切换...') : (t('common.confirm') || '确认切换') }}
        </span>
      </button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from '../common/BaseModal.vue'
import { t } from '../../i18n'
import { useTheme } from '../../composables/useTheme'

const props = withDefaults(defineProps<{
  visible: boolean
  isSwitching?: boolean
  targetMode?: 'pure' | 'classic'
}>(), {
  targetMode: 'pure'
})

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'close'): void
  (e: 'confirm'): void
}>()

const { currentTheme } = useTheme()

// 1. 弹窗外壳容器
const containerClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'w-[92vw] max-w-[540px] max-h-[90vh] overflow-y-auto bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] text-[#1e192b] p-6 sm:p-8 relative flex flex-col gap-5 sm:gap-6'
  }
  if (currentTheme.value === 'minimal') {
    return 'w-[92vw] max-w-[540px] max-h-[90vh] overflow-y-auto bg-[#0b0e1a]/95 border border-[#00f2ff]/30 shadow-[0_0_40px_rgba(0,242,255,0.18)] text-white backdrop-blur-xl p-6 sm:p-8 relative flex flex-col gap-5 sm:gap-6'
  }
  // 经典主题 titan
  return 'w-[92vw] max-w-[540px] max-h-[90vh] overflow-y-auto bg-[#0c0d12]/95 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-white p-6 sm:p-8 relative flex flex-col gap-5 sm:gap-6'
})

// 2. 顶部微光线条
const topGlowClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-gradient-to-r from-transparent via-[#ff85b3] via-[#bce8ff] to-transparent'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-gradient-to-r from-transparent via-[#00f2ff]/70 via-[#7b2cbf]/50 to-transparent'
  }
  return 'bg-gradient-to-r from-transparent via-[#00f3ff]/60 to-transparent'
})

// 3. 头部边框与标题文字
const headerBorderClass = computed(() => {
  if (currentTheme.value === 'anime') return 'border-b border-[#e2d4f0]'
  if (currentTheme.value === 'minimal') return 'border-b border-[#00f2ff]/20'
  return 'border-b border-white/[0.08]'
})

const titleTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const accentBarClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-gradient-to-b from-[#ff85b3] to-[#ff9ec7] shadow-[0_0_10px_rgba(255,133,179,0.5)]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-gradient-to-b from-[#00f2ff] to-[#7b2cbf] shadow-[0_0_10px_rgba(0,242,255,0.6)]'
  }
  return 'bg-[#00f3ff] shadow-[0_0_10px_rgba(0,243,255,0.6)]'
})

// 4. 模式 Badge
const badgeClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-pink-50 border-pink-200 text-[#ff66b2]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#00f2ff]/10 border-[#00f2ff]/30 text-[#00f2ff]'
  }
  return 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff]'
})

// 5. 卡片样式与卡片内文字
const pureCardClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-pink-50/40 border-pink-200/80 shadow-[0_4px_20px_rgba(255,133,179,0.08)]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#131b2e]/60 border-[#00f2ff]/30 shadow-[0_0_24px_rgba(0,242,255,0.08)]'
  }
  return 'bg-white/[0.03] border-[#00f3ff]/30 shadow-[0_0_24px_rgba(0,243,255,0.06)]'
})

const classicCardClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-sky-50/40 border-sky-200/80 shadow-[0_4px_20px_rgba(112,214,255,0.08)]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#131b2e]/60 border-[#00f2ff]/30 shadow-[0_0_24px_rgba(0,242,255,0.08)]'
  }
  return 'bg-white/[0.03] border-[#00f3ff]/30 shadow-[0_0_24px_rgba(0,243,255,0.06)]'
})

const pureIconBoxClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-pink-100/80 border-pink-200 text-[#ff66b2]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#00f2ff]/10 border-[#00f2ff]/30 text-[#00f2ff]'
  }
  return 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff]'
})

const classicIconBoxClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-sky-100/80 border-sky-200 text-sky-600'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#00f2ff]/10 border-[#00f2ff]/30 text-[#00f2ff]'
  }
  return 'bg-[#00f3ff]/10 border-[#00f3ff]/30 text-[#00f3ff]'
})

const cardTitleClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#1e192b]'
  return 'text-white'
})

const descTextClass = computed(() => {
  if (currentTheme.value === 'anime') return 'text-[#4a425a]'
  return 'text-zinc-300'
})

const recommendBadgeClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-pink-100 border-pink-200 text-[#ff66b2]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#00f2ff]/15 border-[#00f2ff]/30 text-[#00f2ff]'
  }
  return 'bg-[#00f3ff]/15 border-[#00f3ff]/30 text-[#00f3ff]'
})

const classicBadgeClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-sky-100 border-sky-200 text-sky-600'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#00f2ff]/15 border-[#00f2ff]/30 text-[#00f2ff]'
  }
  return 'bg-[#00f3ff]/15 border-[#00f3ff]/30 text-[#00f3ff]'
})

const cardFooterBorderClass = computed(() => {
  if (currentTheme.value === 'anime') return 'border-pink-100'
  if (currentTheme.value === 'minimal') return 'border-[#00f2ff]/15'
  return 'border-white/[0.06]'
})

const tagPillClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-white/80 border-pink-200/60 text-[#4a425a]'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#0b0e1a]/80 border-[#00f2ff]/20 text-slate-300'
  }
  return 'bg-white/[0.04] border-white/[0.08] text-zinc-300'
})

const tagDotClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-[#ff85b3]'
  if (currentTheme.value === 'minimal') return 'bg-[#00f2ff]'
  return 'bg-[#00f3ff]'
})

const classicTagDotClass = computed(() => {
  if (currentTheme.value === 'anime') return 'bg-sky-400'
  if (currentTheme.value === 'minimal') return 'bg-[#00f2ff]'
  return 'bg-[#00f3ff]'
})

// 6. 底部操作按钮
const cancelButtonClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-[#131b2e] hover:bg-[#1a253e] border border-[#00f2ff]/20 text-[#8C9BAE] hover:text-white rounded-xl'
  }
  return 'bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.2] text-zinc-300 hover:text-white rounded-lg'
})

const confirmButtonClass = computed(() => {
  if (currentTheme.value === 'anime') {
    return 'bg-gradient-to-r from-[#ff85b3] via-[#ff9ec7] to-[#70d6ff] text-white font-bold shadow-[0_6px_20px_rgba(255,133,179,0.35)] hover:opacity-95 rounded-xl'
  }
  if (currentTheme.value === 'minimal') {
    return 'bg-gradient-to-r from-[#00f2ff] to-[#3a7bd5] text-black font-black shadow-[0_0_24px_rgba(0,242,255,0.35)] hover:brightness-110 rounded-xl'
  }
  return 'bg-[#00f3ff] hover:bg-[#33f5ff] active:bg-[#00d0db] text-black font-bold shadow-[0_0_20px_rgba(0,243,255,0.25)] hover:shadow-[0_0_28px_rgba(0,243,255,0.4)] rounded-lg'
})

function emitClose() {
  if (props.isSwitching) return
  emit('update:visible', false)
  emit('close')
}

function emitConfirm() {
  emit('confirm')
}
</script>
