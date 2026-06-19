"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"

interface Project {
  id: string; projectCode: string; name: string
  department: string; riskTier: string; status: string
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [repoCount, setRepoCount] = useState(0)
  const [totalSpend, setTotalSpend] = useState(0)
  const [avgCompliance, setAvgCompliance] = useState<number|null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: repos }, { data: costs }, { data: assessments }] = await Promise.all([
        supabase.from("Project").select("id,projectCode,name,department,riskTier,status").order("createdAt", { ascending: false }).limit(6),
        supabase.from("Repository").select("id"),
        supabase.from("CostRecord").select("amountZar"),
        supabase.from("ComplianceAssessment").select("overallScore"),
      ])
      setProjects(proj || [])
      setRepoCount((repos || []).length)
      setTotalSpend((costs || []).reduce((s: number, c: any) => s + Number(c.amountZar), 0))
      if (assessments && assessments.length > 0) {
        setAvgCompliance(Math.round(assessments.reduce((s: number, a: any) => s + Number(a.overallScore), 0) / assessments.length))
      }
      setLoading(false)
    }
    load()
  }, [])

  const riskBadge = (t: string) => ({ LOW:"badge-low", MEDIUM:"badge-medium", HIGH:"badge-high", CRITICAL:"badge-critical" }[t] || "badge-pending")

  const stages = [
    { label:"Intake", status:"REGISTERED", color:"var(--org)" },
    { label:"In review", status:"IN_ASSESSMENT", color:"var(--org)" },
    { label:"Approved", status:"APPROVED", color:"var(--grn)" },
    { label:"Building", status:"BUILDING", color:"var(--grn)" },
    { label:"Live", status:"LIVE", color:"var(--g700)" },
  ]

  const total = projects.length
  const pending = projects.filter(p => p.status === "REGISTERED").length
  const fmt = (n: number) => n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  const riskDist = [
    { tier: "LOW", color: "var(--grn)", count: projects.filter(p => p.riskTier === "LOW").length },
    { tier: "MEDIUM", color: "var(--amb)", count: projects.filter(p => p.riskTier === "MEDIUM").length },
    { tier: "HIGH", color: "var(--red)", count: projects.filter(p => p.riskTier === "HIGH").length },
    { tier: "CRITICAL", color: "var(--red-dk)", count: projects.filter(p => p.riskTier === "CRITICAL").length },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Good morning, Herman</h1>
          <p>AI Build Harness - governance platform</p>
        </div>
        <Link href="/projects/new">
          <button className="btn btn-org">+ Register project</button>
        </Link>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(6,1fr)" }}>
        {[
          { label:"Active projects", value: loading ? "..." : total, sub:"Registered in platform", color:"var(--org)" },
          { label:"Pending approvals", value: loading ? "..." : pending, sub:"Awaiting review", color:"var(--red)" },
          { label:"Repos governed", value: loading ? "..." : repoCount, sub:"Registered and scored", color:"var(--g500)" },
          { label:"Spend MTD", value: loading ? "..." : `R${fmt(totalSpend)}`, sub:"Across all projects", color:"var(--org)" },
          { label:"Compliance score", value: loading ? "..." : avgCompliance !== null ? `${avgCompliance}/100` : "No data", sub:"Portfolio average", color: avgCompliance !== null ? (avgCompliance >= 70 ? "var(--grn)" : avgCompliance >= 50 ? "var(--amb)" : "var(--red)") : "var(--g500)" },
          { label:"Portfolio health", value: loading ? "..." : total === 0 ? "-" : `${Math.round((projects.filter(p => p.riskTier === "LOW" || p.riskTier === "MEDIUM").length / total) * 100)}%`, sub:"Low/medium risk", color:"var(--grn)" },
        ].map(k => (
          <div key={k.label} className="kcard">
            <div className="kcard-accent" style={{ background: k.color }}></div>
            <div className="kcard-label">{k.label}</div>
            <div className="kcard-value" style={{ fontSize: k.label === "Spend MTD" ? 16 : undefined }}>{k.value}</div>
            <div className="kcard-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {!loading && total > 0 && (
        <div className="card">
          <div className="card-head"><h3>Risk distribution</h3></div>
          <div style={{ padding: "12px 16px" }}>
            <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", gap: 2 }}>
              {riskDist.filter(r => r.count > 0).map(r => (
                <div key={r.tier} style={{ flex: r.count, background: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", minWidth: 24 }}>
                  {r.count}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {riskDist.map(r => (
                <div key={r.tier} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--g700)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color }}></div>
                  {r.tier} ({r.count})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card card-last">
          <div className="card-head">
            <h3>Recent projects</h3>
            <Link href="/projects"><button className="btn btn-ghost btn-sm">View all</button></Link>
          </div>
          {loading ? <div className="empty">Loading...</div> : projects.length === 0 ? (
            <div className="empty">
              <div style={{ marginBottom: 12 }}>No projects registered yet</div>
              <Link href="/projects/new"><button className="btn btn-org">Register your first project</button></Link>
            </div>
          ) : projects.map((p, i) => (
            <div key={p.id} className={"row" + (i === projects.length - 1 ? " row-last" : "")} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/projects/detail?id=${p.id}`}>
              <span className="proj-id">{p.projectCode}</span>
              <span className="proj-name">{p.name}</span>
              <span className="proj-dept">{p.department}</span>
              {p.riskTier && <span className={"badge " + riskBadge(p.riskTier)}>{p.riskTier}</span>}
            </div>
          ))}
        </div>

        <div className="card card-last">
          <div className="card-head"><h3>Innovation pipeline</h3></div>
          <div className="card-body">
            <div className="pipe-grid">
              {stages.map(s => (
                <div key={s.status} className="pipe-cell">
                  <span className="pipe-n" style={{ color: s.color }}>{projects.filter(p => p.status === s.status).length}</span>
                  <span className="pipe-l">{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--g500)" }}>{total} total initiative{total !== 1 ? "s" : ""} tracked across all departments</div>
          </div>
        </div>
      </div>
    </div>
  )
}

