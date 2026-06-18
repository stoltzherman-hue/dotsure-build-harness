"use client"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, FolderOpen, Plus, Database,
  GitBranch, Shield, Rocket, Coins, FileText, Users, ChevronRight
} from "lucide-react"

const nav = [
  { section: "Overview", items: [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
  ]},
  { section: "Projects", items: [
    { href: "/projects", label: "All projects", icon: FolderOpen },
    { href: "/projects/new", label: "Register project", icon: Plus },
  ]},
  { section: "Governance", items: [
    { href: "/catalogue", label: "Tech catalogue", icon: Database },
    { href: "/github", label: "GitHub governance", icon: GitBranch },
    { href: "/compliance", label: "Compliance", icon: Shield },
    { href: "/deployments", label: "Deployments", icon: Rocket },
  ]},
  { section: "Finance", items: [
    { href: "/finops", label: "FinOps", icon: Coins },
  ]},
  { section: "Audit", items: [
    { href: "/audit", label: "Audit log", icon: FileText },
  ]},
  { section: "Admin", items: [
    { href: "/users", label: "Users & roles", icon: Users },
  ]},
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <div className="w-52 min-h-screen flex flex-col" style={{background:"var(--grey-900)"}}>
      <div className="px-4 py-4 border-b border-white/10">
        <div className="text-sm font-bold" style={{color:"var(--orange)"}}>build harness</div>
        <div className="text-xs mt-0.5" style={{color:"rgba(255,255,255,0.3)", letterSpacing:"1.5px"}}>DOTSURE GOVERNANCE</div>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {nav.map(group => (
          <div key={group.section}>
            <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style={{color:"rgba(255,255,255,0.25)", fontSize:"9px"}}>
              {group.section}
            </div>
            {group.items.map(item => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2 px-4 py-1.5 text-xs transition-all"
                  style={{
                    color: active ? "var(--orange)" : "rgba(255,255,255,0.45)",
                    borderLeft: active ? "3px solid var(--orange)" : "3px solid transparent",
                    background: active ? "rgba(255,135,0,0.07)" : "transparent"
                  }}>
                  <Icon size={14} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{background:"var(--orange)"}}>HS</div>
        <div>
          <div className="text-xs font-semibold" style={{color:"rgba(255,255,255,0.8)"}}>Herman Stoltz</div>
          <div style={{color:"rgba(255,255,255,0.3)", fontSize:"9px"}}>General Manager</div>
        </div>
      </div>
    </div>
  )
}