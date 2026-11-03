<template>
  <Teleport to="body">
    <Transition name="notice-modal">
      <div 
        v-if="visible" 
        class="fixed inset-0 z-[999] flex items-center justify-center p-4 sm:p-6 md:p-8 select-none overflow-hidden backdrop-blur-md"
        :class="currentTheme === 'anime' 
          ? 'bg-slate-900/40' 
          : currentTheme === 'minimal'
            ? 'bg-[#06080e]/85'
            : 'bg-black/80'"
        @click.self="handleBackdropClick"
      >
        <!-- 弹窗主体卡片 (弹性响应式尺寸：小屏适度收拢，大屏/全屏/2K 舒展大气) -->
        <div 
          class="relative w-[min(94vw,clamp(620px,52vw,860px))] max-h-[86vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl border transition-all duration-300 animate-modal-scale"
          :class="[
            currentTheme === 'anime'
              ? 'bg-white/98 border-[#f5cbdc] text-[#1e192b] shadow-[0_24px_60px_rgba(245,203,220,0.4)]'
              : currentTheme === 'minimal'
                ? 'bg-[#090d16]/96 backdrop-blur-2xl border-[#00f2ff]/30 text-white shadow-[0_0_50px_rgba(0,242,255,0.15)]'
                : 'bg-[#0b0d14]/96 backdrop-blur-2xl border-white/[0.1] text-white shadow-[0_24px_70px_rgba(0,0,0,0.85)]'
          ]"
        >
          <!-- 顶部冷光丝线 -->
          <div 
            class="h-[2px] w-full shrink-0"
            :class="[
              currentTheme === 'anime'
                ? 'bg-gradient-to-r from-transparent via-[#ff85b3]/70 to-transparent'
                : currentTheme === 'minimal'
                  ? 'bg-gradient-to-r from-transparent via-[#00f2ff]/60 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent'
            ]"
          ></div>

          <!-- 关闭按钮 (右上角大触控区悬浮微按键) -->
          <button
            @click="close"
            class="absolute top-5 right-5 sm:top-6 sm:right-6 z-30 p-2.5 rounded-full transition-all duration-200 border cursor-pointer active:scale-95 shadow-sm"
            :class="[
              currentTheme === 'anime'
                ? 'bg-white/90 hover:bg-pink-50 text-[#7a6b8c] hover:text-[#c24b78] border-[#f5cbdc]'
                : 'bg-black/40 hover:bg-white/10 text-zinc-400 hover:text-white border-white/10'
            ]"
            :title="t('detail.closeEsc') || '关闭 (ESC)'"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- 头部信息区：分类标签与自适应发布时间 -->
          <div class="px-8 sm:px-10 pt-7 pb-2.5 shrink-0 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span 
                class="px-3 py-1 text-xs sm:text-[13px] font-bold rounded tracking-wide"
                :class="[
                  currentTheme === 'anime'
                    ? 'bg-[#ffeef5] text-[#c24b78] border border-[#f5cbdc]'
                    : 'bg-[#00f3ff]/10 text-[#00f3ff] border border-[#00f3ff]/30'
                ]"
              >
                {{ categoryTag }}
              </span>

              <span 
                v-if="publishTime" 
                class="text-xs sm:text-[13px] font-mono tracking-wide"
                :class="currentTheme === 'anime' ? 'text-[#8c7e9e]' : 'text-zinc-400'"
              >
                {{ publishTime }}
              </span>
            </div>
          </div>

          <!-- 公告大标题 (大字号、醒目粗体、自适应阶梯) -->
          <div class="px-8 sm:px-10 pb-4 shrink-0 pr-16 sm:pr-20">
            <h2 
              class="text-xl sm:text-2xl lg:text-[25px] font-black tracking-tight leading-snug"
              :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-[#f8fafc]'"
            >
              {{ displayTitle }}
            </h2>
          </div>

          <!-- 公告正文阅读区 (黄金行距 leading-[1.85]、充沛大字号 text-[15.5px]~text-[16.5px]、高对比度) -->
          <div 
            class="flex-1 overflow-y-auto px-8 sm:px-10 py-2 custom-scrollbar space-y-4"
            :class="currentTheme === 'anime' ? 'text-[#382f45]' : 'text-[#e2e8f0]'"
          >
            <div 
              class="text-[15px] sm:text-[16px] lg:text-[16.5px] leading-[1.85] whitespace-pre-wrap font-sans select-text tracking-[0.2px]"
              :class="currentTheme === 'anime' ? 'selection:bg-pink-100' : 'selection:bg-[#00f3ff]/25'"
            >
              {{ displayContent }}
            </div>
          </div>

          <!-- 底部控制台：多源直达通道 / 一键关闭 (大屏幕下舒展大方) -->
          <div 
            class="px-8 sm:px-10 py-5 border-t shrink-0 flex flex-col gap-3.5 transition-colors"
            :class="[
              currentTheme === 'anime'
                ? 'bg-[#fcf8fc] border-[#f5cbdc]'
                : 'bg-[#07090e] border-white/[0.07]'
            ]"
          >
            <!-- 场景 1：如果包含外链或网盘源 -->
            <div v-if="parsedLinks.length > 0" class="space-y-2.5">
              <div class="space-y-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-0.5">
                <div
                  v-for="(link, idx) in parsedLinks"
                  :key="idx"
                  class="p-3.5 sm:p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-4 group"
                  :class="[
                    currentTheme === 'anime'
                      ? 'bg-white hover:bg-[#fff0f5] border-[#f5cbdc] hover:border-[#ff9ec7]'
                      : 'bg-white/[0.025] hover:bg-white/[0.06] border-white/[0.08] hover:border-[#00f3ff]/35'
                  ]"
                >
                  <!-- 左侧：图标与名称 -->
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div 
                      class="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold shadow-sm"
                      :class="[
                        currentTheme === 'anime'
                          ? 'bg-[#ffeef5] text-[#c24b78]'
                          : 'bg-[#00f3ff]/10 text-[#00f3ff]'
                      ]"
                    >
                      <span v-if="link.type === 'cloud'">☁</span>
                      <span v-else>↗</span>
                    </div>

                    <div class="min-w-0">
                      <div 
                        class="text-sm sm:text-[15px] font-bold truncate"
                        :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-zinc-100'"
                      >
                        {{ link.name }}
                      </div>
                    </div>
                  </div>

                  <!-- 右侧：提取码复制 + 直达按键 -->
                  <div class="flex items-center gap-2.5 shrink-0">
                    <!-- 提取码 (若有) -->
                    <button
                      v-if="link.code"
                      @click="copyCode(link.code, idx)"
                      class="px-3 py-1.5 text-xs sm:text-[13px] font-mono font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      :class="copiedIndex === idx
                        ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                        : (currentTheme === 'anime' 
                            ? 'bg-pink-50 text-[#c24b78] border-[#f5cbdc] hover:bg-pink-100'
                            : 'bg-zinc-800/90 text-zinc-200 border-zinc-700 hover:border-zinc-500 hover:text-white')"
                      :title="(t('modal.notice.copyCodeTitle') || '点击复制提取码: ') + link.code"
                    >
                      <span>{{ copiedIndex === idx ? (t('modal.notice.copied') || '已复制') : `${t('modal.notice.copyCodePrefix') || '码: '}${link.code}` }}</span>
                    </button>

                    <!-- 解压码 (若有) -->
                    <button
                      v-if="link.pwd"
                      @click="copyCode(link.pwd, idx + 1000)"
                      class="px-3 py-1.5 text-xs sm:text-[13px] font-mono font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                      :class="copiedIndex === (idx + 1000)
                        ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                        : (currentTheme === 'anime' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                            : 'bg-zinc-800/90 text-zinc-200 border-zinc-700 hover:border-zinc-500 hover:text-white')"
                      :title="(t('modal.notice.copyPwdTitle') || '点击复制解压密码: ') + link.pwd"
                    >
                      <span>{{ copiedIndex === (idx + 1000) ? (t('modal.notice.copied') || '已复制') : `${t('modal.notice.copyPwdPrefix') || '解压: '}${link.pwd}` }}</span>
                    </button>

                    <!-- 浏览器直达打开按钮 -->
                    <button
                      @click="openLink(link.url)"
                      class="px-4 py-2 rounded-lg text-xs sm:text-[13px] font-bold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                      :class="[
                        currentTheme === 'anime'
                          ? 'bg-[#ea8fb4] hover:bg-[#de7ca4] text-white shadow-[0_2px_10px_rgba(234,143,180,0.3)]'
                          : currentTheme === 'minimal'
                            ? 'bg-[#00f2ff] hover:bg-[#33f5ff] text-black font-black shadow-[0_0_15px_rgba(0,242,255,0.25)]'
                            : 'bg-[#00f3ff] hover:bg-[#33f5ff] text-black font-black shadow-[0_0_15px_rgba(0,243,255,0.2)]'
                      ]"
                    >
                      <span>{{ t('modal.notice.directOpen') || '直达' }}</span>
                      <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 底部单行：纯粹利落的关闭按钮 -->
            <div class="flex items-center justify-end pt-1">
              <button
                @click="close"
                class="px-6 py-2 rounded-lg text-xs sm:text-[13px] font-bold tracking-wider transition-all cursor-pointer active:scale-95 border"
                :class="[
                  currentTheme === 'anime'
                    ? 'bg-white hover:bg-pink-50 text-[#443854] border-[#f5cbdc] shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                ]"
              >
                {{ t('detail.btnClose') || '关闭' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { t } from '../../i18n'
import { useTheme } from '../../composables/useTheme'

const { currentTheme } = useTheme()

const props = defineProps<{
  visible: boolean
  noticeItem: any
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const copiedIndex = ref<number | null>(null)

// 安全读取元数据对象
const metaObj = computed(() => {
  if (!props.noticeItem) return {}
  if (props.noticeItem.meta && typeof props.noticeItem.meta === 'object') {
    return props.noticeItem.meta
  }
  if (props.noticeItem.meta_json) {
    try {
      return JSON.parse(props.noticeItem.meta_json)
    } catch {}
  }
  return {}
})

// 公告标题
const displayTitle = computed(() => {
  if (!props.noticeItem) return '公告'
  return props.noticeItem.title || props.noticeItem.basic?.title || metaObj.value.title || '系统公告'
})

// 分类标签
const categoryTag = computed(() => {
  if (!props.noticeItem) return '官方通知'
  const tags = props.noticeItem.tags || props.noticeItem.basic?.tags
  if (Array.isArray(tags) && tags.length > 0) return tags[0]
  if (typeof tags === 'string' && tags.trim()) return tags.split(',')[0].trim()
  return metaObj.value.category || metaObj.value.tag || '官方通知'
})

// 发布时间（自动识别秒/毫秒时间戳与日期字符串）
const publishTime = computed(() => {
  if (!props.noticeItem) return ''
  const raw = props.noticeItem.updated_at || props.noticeItem.created_at || metaObj.value.updated_at || metaObj.value.created_at
  if (!raw) return ''

  // 1. 如果是纯数字或数字字符串（时间戳）
  if (typeof raw === 'number' || /^\d+$/.test(String(raw).trim())) {
    let num = Number(raw)
    if (num <= 0) return ''
    if (num < 10000000000) num *= 1000
    const d = new Date(num)
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }

  // 2. 如果是标准日期字符串（如 "2026-10-30 10:33:27"）
  const str = String(raw).trim()
  const d = new Date(str.replace(/-/g, '/'))
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return str.slice(0, 10)
})

// 正文内容
const displayContent = computed(() => {
  if (!props.noticeItem) return ''
  return props.noticeItem.content || props.noticeItem.desc || props.noticeItem.basic?.desc || metaObj.value.content || metaObj.value.desc || ''
})

// 智能多源与外链解析引擎
interface NoticeLinkItem {
  name: string
  url: string
  type: 'browser' | 'cloud'
  code?: string
  pwd?: string
}

const parsedLinks = computed<NoticeLinkItem[]>(() => {
  if (!props.noticeItem) return []
  const list: NoticeLinkItem[] = []

  // 1. 结构化 mirrors 或 links
  const rawLinks = metaObj.value.links || metaObj.value.download_mirrors || props.noticeItem.links || metaObj.value.mirrors
  let candidates: any[] = []

  if (Array.isArray(rawLinks)) {
    candidates = rawLinks
  } else if (typeof rawLinks === 'string' && rawLinks.trim().startsWith('[')) {
    try {
      candidates = JSON.parse(rawLinks)
    } catch {}
  }

  for (const c of candidates) {
    if (!c) continue
    if (typeof c === 'string' && (c.startsWith('http://') || c.startsWith('https://'))) {
      list.push({
        name: inferLinkName(c),
        url: c,
        type: inferLinkType(c)
      })
    } else if (typeof c === 'object') {
      const u = c.url || c.link || ''
      if (u) {
        list.push({
          name: c.name || inferLinkName(u),
          url: u,
          type: inferLinkType(u),
          code: c.code || c.pwd_code || c.extract_code || '',
          pwd: c.pwd || c.extract_pwd || ''
        })
      }
    }
  }

  // 2. 单一外链
  const singleUrl = props.noticeItem.url || metaObj.value.url || metaObj.value.community_url || metaObj.value.link
  if (singleUrl && typeof singleUrl === 'string' && (singleUrl.startsWith('http://') || singleUrl.startsWith('https://'))) {
    if (!list.some(l => l.url === singleUrl)) {
      list.unshift({
        name: metaObj.value.url_name || inferLinkName(singleUrl),
        url: singleUrl,
        type: inferLinkType(singleUrl),
        code: metaObj.value.code || metaObj.value.extract_code || '',
        pwd: metaObj.value.pwd || ''
      })
    }
  }

  return list
})

function inferLinkType(url: string): 'browser' | 'cloud' {
  const lower = url.toLowerCase()
  if (lower.includes('pan.baidu.com') || lower.includes('123pan.com') || lower.includes('quark.cn') || lower.includes('lanzou') || lower.includes('drive')) {
    return 'cloud'
  }
  return 'browser'
}

function inferLinkName(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('pan.baidu.com')) return '百度网盘分流'
  if (lower.includes('123pan.com')) return '123云盘直达'
  if (lower.includes('quark.cn')) return '夸克网盘下载'
  if (lower.includes('lanzou')) return '蓝奏云备用'
  return '直达链接'
}

const openLink = async (url: string) => {
  if (!url) return
  try {
    if (window.electron?.invoke) {
      await window.electron.invoke('sys:open-external', url)
    } else {
      window.open(url, '_blank')
    }
  } catch (e) {
    console.error('[NoticeArticleModal] 打开外链异常:', e)
  }
}

const copyCode = async (text: string, index: number) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedIndex.value = index
    setTimeout(() => {
      if (copiedIndex.value === index) copiedIndex.value = null
    }, 2000)
  } catch {
    const input = document.createElement('input')
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    copiedIndex.value = index
    setTimeout(() => {
      if (copiedIndex.value === index) copiedIndex.value = null
    }, 2000)
  }
}

const close = () => {
  emit('close')
}

const handleBackdropClick = () => {
  close()
}

// 捕获阶段监听 ESC
const handleEscKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.visible && !e.isComposing) {
    e.preventDefault()
    e.stopPropagation()
    close()
  }
}

watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    window.addEventListener('keydown', handleEscKey, true)
  } else {
    window.removeEventListener('keydown', handleEscKey, true)
  }
}, { immediate: true })

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscKey, true)
})
</script>

<style scoped>
.notice-modal-enter-active,
.notice-modal-leave-active {
  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.notice-modal-enter-from,
.notice-modal-leave-to {
  opacity: 0;
}

@keyframes modalScale {
  0% {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.animate-modal-scale {
  animation: modalScale 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* 极窄优雅滚动条 */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.32);
}
</style>
