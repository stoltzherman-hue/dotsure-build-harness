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
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: proj }, { data: repos }] = await Promise.all([
        supabase.from("Project").select("id,projectCode,name,department,riskTier,status").order("createdAt", { ascending: false }).limit(6),
        supabase.from("Repository").select("id")
      ])
      setProjects(proj || [])
      setRepoCount((repos || []).length)
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
  const compliant = projects.filter(p => p.riskTier === "LOW" || p.riskTier === "MEDIUM").length
  const pending = projects.filter(p => p.status === "REGISTERED").length

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Good morning, Herman</h1>
          <p>AI Build Harness — governance platform</p>
        </div>
        <Link href="/projects/new">
          <button className="btn btn-org">+ Register project</button>
        </Link>
      </div>

      <div className="kpi-grid">
        {[
          { label:"Active projects", value:total, sub:"Registered in platform", color:"var(--org)" },
          { label:"Compliant", value:compliant, sub:"Pass risk threshold", color:"var(--grn)" },
          { label:"Pending approvals", value:pending, sub:"Awaiting review", color:"var(--red)" },
          { label:"Repos governed", value:repoCount, sub:"Registered and scored", color:"var(--g500)" },
        ].map(k => (
          <div key={k.label} className="kcard">
            <div className="kcard-accent" style={{background:k.color}}></div>
            <div className="kcard-label">{k.label}</div>
            <div className="kcard-value">{loading ? "ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â" : k.value}</div>
            <div className="kcard-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="two-col">
        <div className="card card-last">
          <div className="card-head">
            <h3>Recent projects</h3>
            <Link href="/projects"><button className="btn btn-ghost btn-sm">View all</button></Link>
          </div>
          {loading ? <div className="empty">Loading...</div> : projects.length === 0 ? (
            <div className="empty">
              <div style={{marginBottom:12}}>No projects registered yet</div>
              <Link href="/projects/new"><button className="btn btn-org">Register your first project</button></Link>
            </div>
          ) : projects.map((p, i) => (
            <div key={p.id} className={"row" + (i === projects.length-1 ? " row-last" : "")}>
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
                  <span className="pipe-n" style={{color:s.color}}>{projects.filter(p => p.status === s.status).length}</span>
                  <span className="pipe-l">{s.label}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,fontSize:11,color:"var(--g500)"}}>{total} total initiative{total !== 1 ? "s" : ""} tracked across all departments</div>
          </div>
        </div>
      </div>
    </div>
  )
}
