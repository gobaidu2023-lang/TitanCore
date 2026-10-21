<template>
  <div class="p-4 rounded-lg border flex flex-col gap-3 transition-colors"
    :class="currentTheme === 'anime' 
      ? 'bg-pink-50/40 border-pink-200/70 text-[#1e192b]' 
      : (currentTheme === 'minimal' ? 'bg-[#131b2e]/60 border-[#00f2ff]/20 text-white' : 'bg-white/[0.02] border-white/5 text-white')"
  >
    <div class="flex items-center justify-between">
      <span class="text-sm font-bold flex items-center gap-2" :class="currentTheme === 'anime' ? 'text-[#1e192b]' : 'text-white'">
        {{ tool.icon }} {{ t(tool.nameKey) }}
      </span>
      <span class="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded border"
        :class="installed 
          ? (currentTheme === 'anime' ? 'text-pink-600 border-pink-300 bg-pink-100' : (currentTheme === 'minimal' ? 'text-[#00f2ff] border-[#00f2ff]/30 bg-[#00f2ff]/10' : 'text-[#00f3ff] border-[#00f3ff]/30 bg-[#00f3ff]/5'))
          : (currentTheme === 'anime' ? 'text-slate-400 border-slate-200 bg-slate-50' : 'text-zinc-500 border-white/10 bg-white/5')">
        {{ installed ? t('settings.exp.tools.installed') : t('settings.exp.tools.notInstalled') }}
      </span>
    </div>

    <!-- fix50: 显示/隐藏 —— 仅当工具定义了 prefKey 时渲染 (DLC 管理需要，ASF 挂卡仅在实验功能内运行故隐藏此行) -->
    <div v-if="tool.prefKey" class="flex items-center justify-between">
      <span class="text-xs" :class="currentTheme === 'anime' ? 'text-slate-500' : 'text-zinc-400'">{{ visible ? t('settings.exp.tools.show') : t('settings.exp.tools.hide') }}</span>
      <button type="button" role="switch" :aria-checked="visible" @click="toggleVisible" :disabled="busy"
        class="w-10 h-[22px] rounded-full transition-colors relative disabled:opacity-40"
        :class="visible 
          ? (currentTheme === 'anime' ? 'bg-gradient-to-r from-[#ff85b3] to-[#ff9ec7]' : (currentTheme === 'minimal' ? 'bg-[#00f2ff]' : 'bg-[#00f3ff]')) 
          : (currentTheme === 'anime' ? 'bg-slate-200' : 'bg-white/10')">
        <span class="absolute top-[3px] w-4 h-4 rounded-full transition-all" 
          :class="[
            visible ? 'left-[21px]' : 'left-[3px]',
            currentTheme === 'anime' ? 'bg-white' : 'bg-black'
          ]"></span>
      </button>
    </div>

    <div class="grid grid-cols-3 gap-2">
      <button type="button" @click="doLaunch" :disabled="busy || !installed"
        class="h-8 rounded text-xs font-bold tracking-wider border transition-all disabled:opacity-40"
        :class="currentTheme === 'anime' 
          ? 'text-slate-700 border-slate-200 hover:bg-slate-100' 
          : 'text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'">
        {{ t('settings.exp.tools.launch') }}
      </button>
      <button type="button" @click="doInstall" :disabled="busy || installed"
        class="h-8 rounded text-xs font-bold tracking-wider border transition-all disabled:opacity-40"
        :class="currentTheme === 'anime'
          ? 'text-[#ff66b2] border-pink-300 hover:bg-[#ff66b2] hover:text-white'
          : (currentTheme === 'minimal' ? 'text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff] hover:text-black' : 'text-[#00f3ff] border-[#00f3ff]/30 hover:bg-[#00f3ff] hover:text-black')">
        {{ busy && busyKind === 'install' ? t('settings.exp.tools.installing') : t('settings.exp.tools.install') }}
      </button>
      <button type="button" @click="doUninstall" :disabled="busy || !installed"
        class="h-8 rounded text-xs font-bold tracking-wider border transition-all disabled:opacity-40"
        :class="currentTheme === 'anime'
          ? 'text-red-500 border-red-200 hover:bg-red-50'
          : 'text-red-400 border-red-500/30 hover:bg-red-900/50 hover:text-white'">
        {{ busy && busyKind === 'uninstall' ? t('settings.exp.tools.uninstalling') : t('settings.exp.tools.uninstall') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Swal from 'sweetalert2'
import { t } from '../../i18n'
import { tcToast } from '../../utils/tcToast'
import { useTheme } from '../../composables/useTheme'
import type { ToolDef } from './toolRegistry'

const { currentTheme } = useTheme()

const props = defineProps<{ tool: ToolDef }>()

const visible = ref(false)
const installed = ref(false)
const busy = ref(false)
const busyKind = ref<'install' | 'uninstall' | ''>('')
let offChanged: (() => void) | null = null

// 状态自愈探测: 即使关闭弹窗再重开，也能实时获取主进程中的进行中任务状态，绝不重复触发下载
async function refreshStatus() {
  try {
    const st = await window.electron.invoke('tools:status', props.tool.id) as {
      installed?: boolean
      installing?: boolean
      uninstalling?: boolean
    }
    installed.value = !!st?.installed
    if (st?.installing) {
      busy.value = true
      busyKind.value = 'install'
    } else if (st?.uninstalling) {
      busy.value = true
      busyKind.value = 'uninstall'
    } else {
      busy.value = false
      busyKind.value = ''
    }
  } catch {
    installed.value = false
    busy.value = false
    busyKind.value = ''
  }
}

async function toggleVisible() {
  if (!props.tool.prefKey) return
  visible.value = !visible.value
  try {
    await window.electron.invoke('sys:set-config', props.tool.prefKey, visible.value)
  } catch { /* 持久化异常兜底 */ }
}

async function doLaunch() {
  const res = await window.electron.invoke('tools:launch', props.tool.id) as { success?: boolean; error?: string }
  if (!res?.success) tcToast(t('settings.exp.tools.launchFail', { error: res?.error || 'UNKNOWN' }), '', 'error')
}

async function doInstall() {
  busy.value = true
  busyKind.value = 'install'
  try {
    const res = await window.electron.invoke('tools:install', props.tool.id) as { success?: boolean; error?: string }
    if (!res?.success) tcToast(t('settings.exp.tools.installFail', { error: res?.error || 'UNKNOWN' }), '', 'error')
  } finally {
    await refreshStatus()
  }
}

async function doUninstall() {
  const confirm = await Swal.fire({
    title: t('settings.exp.tools.confirmUninstallTitle'),
    text: t('settings.exp.tools.confirmUninstallDesc', { name: t(props.tool.nameKey) }),
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: t('settings.exp.tools.uninstall'),
    cancelButtonText: t('common.cancel'),
    background: '#121212',
    color: '#fff'
  })
  if (!confirm.isConfirmed) return
  busy.value = true
  busyKind.value = 'uninstall'
  try {
    const res = await window.electron.invoke('tools:uninstall', props.tool.id) as { success?: boolean; error?: string }
    if (!res?.success) tcToast(t('settings.exp.tools.uninstallFail', { error: res?.error || 'UNKNOWN' }), '', 'error')
  } finally {
    await refreshStatus()
  }
}

onMounted(async () => {
  if (props.tool.prefKey) {
    try {
      visible.value = !!(await window.electron.invoke('sys:get-config', props.tool.prefKey))
    } catch { /* 默认关 */ }
  }
  await refreshStatus()

  // 跨组件事件广播联动: 主进程完成下载或卸载时主动通知恢复组件
  offChanged = window.electron.on('tools:changed', (payload: { toolId?: string; installed?: boolean }) => {
    if (payload?.toolId === props.tool.id) {
      installed.value = !!payload?.installed
      busy.value = false
      busyKind.value = ''
    }
  })
})

onUnmounted(() => {
  if (offChanged) {
    offChanged()
    offChanged = null
  }
})
</script>
