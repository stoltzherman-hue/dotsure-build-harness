"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications, Notification } from "@/hooks/useNotifications"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function truncate(text: string | null, max = 90): string {
  if (!text) return ""
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text
}

// ---------------------------------------------------------------------------
// Type icon
// ---------------------------------------------------------------------------

function TypeIcon({ type }: { type: string }) {
  const size = { width: 14, height: 14, flexShrink: 0 }
  const base = { fill: "none", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

  if (type === "error") {
    return (
      <svg viewBox="0 0 24 24" style={{ ...size, stroke: "var(--red)" }} {...base}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    )
  }
  if (type === "success") {
    return (
      <svg viewBox="0 0 24 24" style={{ ...size, stroke: "var(--grn)" }} {...base}>
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  }
  if (type === "warning") {
    return (
      <svg viewBox="0 0 24 24" style={{ ...size, stroke: "var(--org)" }} {...base}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }
  // default: info
  return (
    <svg viewBox="0 0 24 24" style={{ ...size, stroke: "var(--g400)" }} {...base}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Single row
// ---------------------------------------------------------------------------

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  const unread = !notification.read_at

  return (
    <button
      onClick={() => { if (unread) onMarkRead(notification.id) }}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: "100%",
        padding: "10px 14px",
        background: "none",
        border: "none",
        borderLeft: unread ? "3px solid var(--org)" : "3px solid transparent",
        borderBottom: "1px solid var(--g100)",
        cursor: unread ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      <span style={{ paddingTop: 2 }}>
        <TypeIcon type={notification.type} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: unread ? 600 : 400,
            color: "var(--g900)",
            lineHeight: 1.4,
          }}
        >
          {notification.title}
        </span>
        {notification.body && (
          <span
            style={{
              display: "block",
              fontSize: 11,
              color: "var(--g500)",
              lineHeight: 1.4,
              marginTop: 2,
            }}
          >
            {truncate(notification.body)}
          </span>
        )}
        <span style={{ display: "block", fontSize: 10, color: "var(--g400)", marginTop: 4 }}>
          {relativeTime(notification.created_at)}
        </span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Bell button + dropdown
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const { user } = useAuth()
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  if (!user) return null

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
        style={{ position: "relative", padding: "4px 6px", display: "flex", alignItems: "center" }}
      >
        <svg
          viewBox="0 0 24 24"
          style={{ width: 16, height: 16, stroke: "var(--g800)", fill: "none", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}
        >
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              padding: "0 3px",
              borderRadius: 8,
              background: "var(--org)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            maxHeight: 460,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            zIndex: 9999,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--g100)",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--g900)" }}>
              Notifications
              {unreadCount > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "var(--org)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={markAllRead}
                style={{ fontSize: 11 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Feed */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: "32px 14px",
                  textAlign: "center",
                  fontSize: 12,
                  color: "var(--g400)",
                }}
              >
                No notifications
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
