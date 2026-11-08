<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="visible"
        class="fixed inset-0 z-[9999] flex items-center justify-center transition-all"
        :class="[
          currentTheme === 'anime' 
            ? 'bg-slate-900/40 backdrop-blur-sm' 
            : (currentTheme === 'minimal' ? 'bg-[#06080e]/80 backdrop-blur-md' : 'bg-black/60 backdrop-blur-sm'),
          !visible ? 'pointer-events-none' : ''
        ]"
        @click.self="handleMaskClick"
      >
        <div
          class="relative rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
          :class="[
            currentTheme === 'anime' 
              ? 'bg-white/95 border-2 border-[#bce8ff] shadow-[0_20px_60px_rgba(180,150,230,0.25)] text-[#1e192b]' 
              : (currentTheme === 'minimal'
                ? 'bg-[#101623]/95 border border-[#00f2ff]/30 shadow-[0_0_40px_rgba(0,242,255,0.18)] text-white backdrop-blur-xl'
                : 'bg-bg-elevated border border-white/10 text-white'),
            animationClass, 
            containerClass
          ]"
        >
          <button
            v-if="showClose"
            @click="handleClose"
            class="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            :class="currentTheme === 'anime'
              ? 'text-slate-500 hover:text-[#1e192b] hover:bg-pink-100/60'
              : (currentTheme === 'minimal'
                ? 'text-[#8C9BAE] hover:text-[#00F2FF] hover:bg-[#00F2FF]/10'
                : 'text-white/50 hover:text-white hover:bg-red-500/20')"
            :aria-label="t('common.close')"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import { t } from '../../i18n';
import { useTheme } from '../../composables/useTheme';

const { currentTheme } = useTheme();

const props = withDefaults(defineProps<{
  visible: boolean;
  containerClass?: string;
  animationClass?: string;
  showClose?: boolean;
}>(), {
  containerClass: '',
  animationClass: 'animate-scale-in',
  showClose: false,
});

const emit = defineEmits<{
  close: [];
}>();

function handleMaskClick() {
  emit('close');
}

function handleClose() {
  emit('close');
}

function handleEsc(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEsc);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc);
});

watch(() => props.visible, (val) => {
  if (val) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}, { immediate: true });
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  pointer-events: none !important;
}
.modal-fade-leave-active {
  pointer-events: none !important;
}

/* ============================================
   游戏专用分支样式（不动原有代码，仅新增）
   使用方式：<BaseModal containerClass="game-modal" ... />
   ============================================ */

:deep(.game-modal) {
  background: rgba(2, 2, 5, 0.95) !important;
  border: 1px solid rgba(0, 243, 255, 0.25) !important;
  box-shadow: 
    0 0 20px rgba(0, 243, 255, 0.1),
    0 0 60px rgba(0, 243, 255, 0.05),
    inset 0 0 30px rgba(0, 243, 255, 0.02) !important;
  border-radius: 1rem !important;
}

:deep(.game-modal)::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(
    180deg,
    rgba(0, 243, 255, 0.3) 0%,
    transparent 30%,
    transparent 70%,
    rgba(0, 243, 255, 0.15) 100%
  );
  -webkit-mask: 
    linear-gradient(#fff 0 0) content-box, 
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 1;
}

:deep(.game-modal .game-modal-title) {
  color: #00f3ff;
  font-family: 'Courier New', monospace;
  font-weight: 900;
  letter-spacing: 0.15em;
  text-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
}

:deep(.game-modal .game-modal-btn-primary) {
  background: rgba(0, 243, 255, 0.15);
  border: 1px solid rgba(0, 243, 255, 0.4);
  color: #00f3ff;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  letter-spacing: 0.1em;
  transition: all 0.3s ease;
  box-shadow: 0 0 15px rgba(0, 243, 255, 0.1);
}

:deep(.game-modal .game-modal-btn-primary:hover) {
  background: rgba(0, 243, 255, 0.3);
  box-shadow: 0 0 25px rgba(0, 243, 255, 0.3);
  transform: scale(1.02);
}

:deep(.game-modal .game-modal-btn-danger) {
  background: rgba(255, 0, 64, 0.15);
  border: 1px solid rgba(255, 0, 64, 0.4);
  color: #ff0040;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  transition: all 0.3s ease;
}

:deep(.game-modal .game-modal-btn-danger:hover) {
  background: rgba(255, 0, 64, 0.3);
  box-shadow: 0 0 20px rgba(255, 0, 64, 0.2);
}

:deep(.game-modal .game-modal-text) {
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
  line-height: 1.6;
}

:deep(.game-modal .game-modal-glow-text) {
  color: #00f3ff;
  text-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
}

:deep(.game-modal .game-modal-divider) {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(0, 243, 255, 0.3) 50%,
    transparent 100%
  );
}

/* 扫描线背景装饰（可选） */
:deep(.game-modal .game-modal-scanlines) {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 243, 255, 0.015) 2px,
    rgba(0, 243, 255, 0.015) 4px
  );
  pointer-events: none;
  z-index: 0;
}
</style>