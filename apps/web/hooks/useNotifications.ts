/*
  Run this SQL once in your Supabase SQL editor to create the Notification table
  (skip if the table already exists):

  CREATE TABLE IF NOT EXISTS "Notification" (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'info',
    title       TEXT NOT NULL,
    body        TEXT,
    entity_type TEXT,
    entity_id   UUID,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- Index for fast per-user queries
  CREATE INDEX IF NOT EXISTS notification_user_id_idx ON "Notification" (user_id, created_at DESC);

  -- Enable Row Level Security
  ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

  -- Users can only read their own notifications
  CREATE POLICY "users_read_own_notifications"
    ON "Notification" FOR SELECT
    USING (auth.uid() = user_id);

  -- Users can update read_at on their own notifications
  CREATE POLICY "users_update_own_notifications"
    ON "Notification" FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Enable Realtime for this table (run in SQL editor)
  ALTER PUBLICATION supabase_realtime ADD TABLE "Notification";
*/

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  read_at: string | null
  created_at: string
}

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const supabase = useRef(createClient())

  const fetchNotifications = useCallback(async (userId: string) => {
    const { data, error } = await supabase.current
      .from("Notification")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotifications(data as Notification[])
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      return
    }

    const userId = user.id
    fetchNotifications(userId)

    const channel = supabase.current
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Notification",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      supabase.current.removeChannel(channel)
    }
  }, [user?.id, fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString()
    const { error } = await supabase.current
      .from("Notification")
      .update({ read_at: now })
      .eq("id", id)

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: now } : n))
      )
    }
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    const now = new Date().toISOString()
    const { error } = await supabase.current
      .from("Notification")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null)

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
    }
  }, [user?.id])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, markRead, markAllRead }
}
