// 文件名: src/stores/feedbackStore.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from './authStore'
import { t } from '../i18n'

export const useFeedbackStore = defineStore('feedback', () => {
  const authStore = useAuthStore()
  
  const logs = ref<any[]>([])
  const threads = ref<Record<number, any[]>>({})
  const hasUnread = ref(false)
  const activeRootId = ref<number | null>(null)
  const latestBroadcast = ref<{ id: number; title: string; content: string; created_at: number } | null>(null)
  const hasUnreadBroadcast = ref(false)
  const lastReadBroadcastId = ref(0)
  
  let isPolling = false
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  const notifiedAdminCount = new Map<number, number>()

  async function loadLocal() {
    try {
      const saved = await window.electron.invoke('sys:get-config', 'titan_feedback_history_v16_pro')
      // 修复：db.get 已自动解析为对象；防御旧版坏数据（非数组则丢弃）
      if (Array.isArray(saved)) {
        logs.value = saved
      }
      const savedBid = await window.electron.invoke('sys:get-config', 'titan_last_read_broadcast_id')
      if (typeof savedBid === 'number' && !isNaN(savedBid)) {
        lastReadBroadcastId.value = savedBid
      }
      hasUnread.value = logs.value.some((l: any) => l.has_unread) || hasUnreadBroadcast.value
    } catch (e) {
      console.warn('[FeedbackStore] 历史记录读取失败:', e)
    }
  }

  async function saveLocal() {
    await window.electron.invoke('sys:set-config', 'titan_feedback_history_v16_pro', JSON.parse(JSON.stringify(logs.value)))
  }

  function markRead() {
    hasUnread.value = false
  }

  async function markBroadcastRead() {
    if (latestBroadcast.value && latestBroadcast.value.id > lastReadBroadcastId.value) {
      lastReadBroadcastId.value = latestBroadcast.value.id
      await window.electron.invoke('sys:set-config', 'titan_last_read_broadcast_id', lastReadBroadcastId.value)
    }
    hasUnreadBroadcast.value = false
    hasUnread.value = logs.value.some((l: any) => l.has_unread)
  }

  function setActiveRoot(rootId: number | null) {
    activeRootId.value = rootId
  }

  async function markTicketRead(rootId: number) {
    const log = logs.value.find(l => l.id === rootId)
    if (log) {
      log.has_unread = false
      if (typeof log.admin_msg_count === 'number') {
        log.known_admin_count = log.admin_msg_count
      }
      hasUnread.value = logs.value.some((l: any) => l.has_unread)
      await saveLocal()
    }
  }

  async function clearAll() {
    logs.value = []
    threads.value = {}
    hasUnread.value = false
    await saveLocal()
  }

  async function submitRoot(payload: any) {
    const res = await window.electron.sys.proxyPost('/titan/feedback_submit.php', payload)
    if (res?.code === 429) throw new Error(res.msg || t('feedback.errorRateLimit'))
    if (res?.code === 200 || res?.status === 200 || res?.success) {
      const newId = Number(res?.data?.id || res?.id || res?.data)
      if (!newId || isNaN(newId)) throw new Error(t('feedback.errorInvalidId'))
      
      logs.value.unshift({
        ...payload,
        id: newId,
        created_at: Date.now(),
        last_msg_at: Date.now(),
        last_sender: 'user',
        status: 0,
        awaiting_reply: true,
        known_admin_count: 0,
        admin_msg_count: 0,
        has_unread: false
      })
      await saveLocal()
      return newId
    }
    throw new Error(res?.msg || t('feedback.errorServer'))
  }

  async function submitAppend(rootId: number, payload: any) {
    const res = await window.electron.sys.proxyPost('/titan/feedback_submit.php', payload)
    if (res?.code === 429) throw new Error(res.msg || t('feedback.errorRateLimit'))
    if (res?.code === 200 || res?.status === 200 || res?.success) {
      const log = logs.value.find(l => l.id === rootId)
      if (log) {
        log.awaiting_reply = true
        log.last_sender = 'user'
        log.last_msg_at = Date.now()
        log.status = 0
        await saveLocal()
      }
      await fetchThread(rootId)
      return true
    }
    throw new Error(res?.msg || t('feedback.errorAppend'))
  }

  async function fetchThread(rootId: number) {
    if (!rootId) return []
    try {
      const res = await window.electron.sys.proxyPost('/titan/feedback_thread.php', { parent_id: rootId })
      const rawList = Array.isArray(res?.data) ? res.data : []
      
      const subList = rawList.filter((m: any) => Number(m.id) !== rootId).map((m: any) => ({
         id: Number(m.id),
         content: String(m.content || ''),
         created_at: typeof m.created_at === 'number' ? (m.created_at > 1e10 ? m.created_at : m.created_at * 1000) : Date.parse(m.created_at) || Date.now(),
         sender_type: (m.sender_type === 'admin' || m.sender_type === 'hajimi') ? 'admin' : 'user'
      })).sort((a: any, b: any) => a.created_at - b.created_at)

      threads.value[rootId] = subList

      const log = logs.value.find(l => l.id === rootId)
      if (log) {
        const adminMsgs = subList.filter((m: any) => m.sender_type === 'admin')
        const knownCount = log.known_admin_count || 0
        
        const rootNode = rawList.find((m: any) => Number(m.id) === rootId)
        let rootReplyFired = false
        if (rootNode && rootNode.reply_content && rootNode.reply_content !== log.reply) {
           log.reply = rootNode.reply_content
           rootReplyFired = true
        }

        if (adminMsgs.length > knownCount || rootReplyFired) {
           log.admin_msg_count = adminMsgs.length
           log.known_admin_count = adminMsgs.length
           log.awaiting_reply = false
           log.has_unread = activeRootId.value !== rootId
           if (log.has_unread) {
             hasUnread.value = true
             window.dispatchEvent(new CustomEvent('feedback:new-reply', { detail: rootId }))
           }
           await saveLocal()
        }
      }
      return subList
    } catch (e) {
      return []
    }
  }

  async function syncFromServer() {
    if (!authStore.isConnected) return
    try {
      const res = await window.electron.sys.proxyPost('/titan/feedback_sync.php', {})
      if (res?.code !== 200 || !Array.isArray(res.data)) return

      const prevMap = new Map<number, any>(logs.value.map((l: any) => [Number(l.id), l]))
      const nextLogs: any[] = []
      const newReplyIds: number[] = []
      let shouldRefreshActive = false

      for (const s of res.data) {
        const id = Number(s.id)
        const prev = prevMap.get(id)
        const adminCount = Number(s.admin_msg_count || 0)
        const isViewing = activeRootId.value === id

        if (prev) {
          const knownCount = Math.max(Number(prev.known_admin_count || 0), prev.reply ? 1 : 0)
          const hasNewAdmin = adminCount > knownCount || (!!s.reply && s.reply !== prev.reply)
          const prevChildCount = Number(prev.total_child_count || 0)
          const nextChildCount = Number(s.total_child_count || 0)

          if (isViewing && (hasNewAdmin || nextChildCount !== prevChildCount)) {
            shouldRefreshActive = true
          }

          let itemUnread = !!prev.has_unread
          if (hasNewAdmin && !isViewing) {
            itemUnread = true
            const lastNotified = notifiedAdminCount.get(id) ?? knownCount
            if (adminCount > lastNotified || (!!s.reply && s.reply !== prev.reply)) {
              notifiedAdminCount.set(id, adminCount)
              newReplyIds.push(id)
            }
          } else if (isViewing) {
            itemUnread = false
          }

          nextLogs.push({
            ...prev,
            ...s,
            known_admin_count: isViewing ? adminCount : knownCount,
            admin_msg_count: adminCount,
            awaiting_reply: s.last_sender === 'user' && Number(s.status) === 0,
            has_unread: itemUnread
          })
        } else {
          // 跨设备或重装后从服务端恢复工单，不误报历史消息为未读
          notifiedAdminCount.set(id, adminCount)
          nextLogs.push({
            ...s,
            known_admin_count: adminCount,
            admin_msg_count: adminCount,
            awaiting_reply: s.last_sender === 'user' && Number(s.status) === 0,
            has_unread: false
          })
        }
      }

      if (res?.broadcast && res.broadcast.id) {
        latestBroadcast.value = res.broadcast
        hasUnreadBroadcast.value = Number(res.broadcast.id) > lastReadBroadcastId.value
      } else {
        latestBroadcast.value = null
        hasUnreadBroadcast.value = false
      }

      logs.value = nextLogs
      hasUnread.value = logs.value.some((l: any) => l.has_unread) || hasUnreadBroadcast.value
      await saveLocal()

      for (const rid of newReplyIds) {
        window.dispatchEvent(new CustomEvent('feedback:new-reply', { detail: rid }))
      }
      if (shouldRefreshActive && activeRootId.value) {
        await fetchThread(activeRootId.value)
      }
    } catch (e) {
      // 网络波动静默跳过，等待下次轮询
    }
  }

  watch(() => authStore.isConnected, (connected) => {
    if (connected && isPolling) {
      syncFromServer()
    }
  })

  function startPolling() {
    if (isPolling) return
    isPolling = true

    const tick = async () => {
      if (!isPolling) return
      if (authStore.isConnected) {
        await syncFromServer()
      }
      const hasAwaiting = logs.value.some((l: any) => l.awaiting_reply)
      pollTimer = setTimeout(tick, hasAwaiting ? 20000 : 60000)
    }

    pollTimer = setTimeout(tick, 2000)
  }

  function stopPolling() {
    isPolling = false
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  return { logs, threads, hasUnread, activeRootId, latestBroadcast, hasUnreadBroadcast, loadLocal, saveLocal, clearAll, submitRoot, submitAppend, fetchThread, syncFromServer, startPolling, stopPolling, markRead, markBroadcastRead, setActiveRoot, markTicketRead }
})