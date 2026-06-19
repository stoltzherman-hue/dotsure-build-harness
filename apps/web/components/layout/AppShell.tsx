"use client"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Sidebar } from "./Sidebar"
import { Concierge } from "@/components/Concierge"
import { NotificationBell } from "@/components/notifications/NotificationBell"

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === "/login"

  useEffect(() => {
    if (!loading && !user && !isLoginPage) router.replace("/login")
  }, [loading, user, isLoginPage])

  if (isLoginPage) return <>{children}</>
  if (loading || !user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 12, color: "var(--g400)" }}>Loading...</div>
    </div>
  )

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div
          style={{
            position: "fixed",
            top: 12,
            right: 16,
            zIndex: 100,
          }}
        >
          <NotificationBell />
        </div>
        {children}
      </div>
      <Concierge />
    </div>
  )
}
