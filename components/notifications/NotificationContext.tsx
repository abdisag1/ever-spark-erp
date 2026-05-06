'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types'

interface NotificationCtx {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  loading: boolean
}

const Ctx = createContext<NotificationCtx>({
  notifications: [],
  unreadCount: 0,
  markRead: async () => {},
  markAllRead: async () => {},
  loading: true,
})

export function NotificationProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // Fetch + deadline check on mount
  useEffect(() => {
    if (!userId) return

    async function init() {
      await fetch('/api/notifications/check-deadlines', { method: 'POST' })
      const res = await fetch('/api/notifications')
      if (res.ok) setNotifications(await res.json())
      setLoading(false)
    }
    init()
  }, [userId])

  // Single Realtime subscription for the whole app
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-provider:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
  }, [])

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Ctx.Provider value={{ notifications, unreadCount, markRead, markAllRead, loading }}>
      {children}
    </Ctx.Provider>
  )
}

export const useNotifications = () => useContext(Ctx)
