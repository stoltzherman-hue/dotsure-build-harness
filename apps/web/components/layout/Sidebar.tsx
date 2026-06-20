"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

const nav = [
  { section: "Overview", items: [{ href: "/", label: "Dashboard", d: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" }]},
  { section: "Build", items: [
    { href: "/pipeline", label: "Build pipeline", d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" },
    { href: "/library", label: "Project library", d: "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V5a2 2 0 012-2h12a2 2 0 012 2v12M4 19.5V21" },
    { href: "/approvals", label: "Approvals", d: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  ]},
  { section: "Projects", items: [
    { href: "/projects", label: "All projects", d: "M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" },
    { href: "/projects/new", label: "Register project", d: "M12 5v14M5 12h14" },
    { href: "/timeline", label: "Timeline", d: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
  ]},
  { section: "Governance", items: [
    { href: "/catalogue", label: "Tech catalogue", d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
    { href: "/github", label: "GitHub governance", d: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.44 5.44 0 0016.5 3c-.98.63-2 1-3 1s-2.01-.37-3-1a5.44 5.44 0 00-3.5 1.77 5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" },
    { href: "/compliance", label: "Compliance", d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
    { href: "/deployments", label: "Deployments", d: "M5 12h14M12 5l7 7-7 7" },
    { href: "/risk", label: "Risk dashboard", d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01" },
    { href: "/frameworks", label: "AI frameworks", d: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
    { href: "/regulatory", label: "Regulatory feed", d: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2zM14 4v6h6M9 14h6M9 18h4" },
  ]},
  { section: "Finance", items: [{ href: "/finops", label: "FinOps", d: "M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" }]},
  { section: "Operations", items: [
    { href: "/observability", label: "LLM observability", d: "M2 12h4l3-9 4 18 3-9h4" },
    { href: "/models", label: "Model inventory", d: "M12 2a2 2 0 012 2v1a2 2 0 01-2 2 2 2 0 01-2-2V4a2 2 0 012-2zM12 17a2 2 0 012 2v1a2 2 0 01-2 2 2 2 0 01-2-2v-1a2 2 0 012-2zM4.22 4.22a2 2 0 012.83 0l.7.7a2 2 0 010 2.83 2 2 0 01-2.83 0l-.7-.7a2 2 0 010-2.83zM16.24 16.24a2 2 0 012.83 0l.7.7a2 2 0 010 2.83 2 2 0 01-2.83 0l-.7-.7a2 2 0 010-2.83zM2 12h1M21 12h1M4.22 19.78l.7-.7M19.07 4.93l.7-.7" },
    { href: "/memory", label: "Knowledge base", d: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 16v-4M12 8h.01" },
    { href: "/debug", label: "Debug log", d: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" },
  ]},
  { section: "Audit", items: [{ href: "/audit", label: "Audit log", d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" }]},
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut } = useAuth()
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"
  const roleLabel = profile?.role === "GM" ? "General Manager" : profile?.role === "APPROVER" ? "Approver" : "Developer"

  return (
    <div className="sidebar">
      <div className="sb-logo">
        <div className="sb-brand">build harness</div>
        <div className="sb-sub">Dotsure governance</div>
      </div>
      <nav className="sb-nav">
        {nav.map(group => (
          <div key={group.section}>
            <div className="nb">{group.section}</div>
            {group.items.map(item => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className={"ni"+(active?" active":"")}>
                  <svg viewBox="0 0 24 24"><path d={item.d}/></svg>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="sb-user" style={{ cursor: "default" }}>
        <div className="sb-av">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sb-un">{profile?.full_name || profile?.email || "User"}</div>
          <div className="sb-ur">{roleLabel}</div>
        </div>
        <button onClick={signOut} title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--g400)", flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}>
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
