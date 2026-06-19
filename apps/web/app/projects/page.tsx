"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"

interface Project {
  id: string; projectCode: string; name: string
  department: string; riskTier: string; status: string
  projectType: string; createdAt: string
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("ALL")
  const supabase = createClient()

  useEffect(() => {
    supabase.from("Project").select("id,projectCode,name,department,riskTier,status,projectType,createdAt").order("createdAt", { ascending: false })
      .then(({ data }) => { setProjects(data || []); setLoading(false) })
  }, [])

  const riskBadge = (t: string) => ({ LOW:"badge-low", MEDIUM:"badge-medium", HIGH:"badge-high", CRITICAL:"badge-critical" }[t] || "badge-pending")
  const statusBadge = (s: string) => ({ REGISTERED:"badge-org", IN_ASSESSMENT:"badge-warn", APPROVED:"badge-ok", BUILDING:"badge-pur", LIVE:"badge-ok", REJECTED:"badge-fail" }[s] || "badge-pending")
  const tiers = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
  const filtered = filter === "ALL" ? projects : projects.filter(p => p.riskTier === filter)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>All projects</h1>
          <p>{projects.length} project{projects.length !== 1 ? "s" : ""} registered in the platform</p>
        </div>
        <Link href="/projects/new"><button className="btn btn-org">+ Register project</button></Link>
      </div>
      <div className="card card-last">
        <div className="card-head">
          <h3>Projects register</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {tiers.map(t => (
              <button key={t} onClick={() => setFilter(t)} className={"btn btn-sm " + (filter === t ? "btn-org" : "btn-ghost")}>
                {t === "ALL" ? "All risk tiers" : t}
              </button>
            ))}
          </div>
        </div>
        <div className="tbl-head" style={{ gridTemplateColumns: "100px 1fr 140px 80px 100px 80px" }}>
          <span>Project ID</span><span>Name</span><span>Department</span><span>Risk</span><span>Status</span><span></span>
        </div>
        {loading ? <div className="empty">Loading...</div> : filtered.length === 0 ? <div className="empty">No projects found</div> : filtered.map((p, i) => (
          <div key={p.id} className={"tbl-row" + (i === filtered.length - 1 ? " row-last" : "")} style={{ gridTemplateColumns: "100px 1fr 140px 80px 100px 80px", cursor: "pointer" }} onClick={() => window.location.href = `/projects/detail?id=${p.id}`}>
            <span className="proj-id">{p.projectCode}</span>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--g900)" }}>{p.name}</span>
            <span style={{ color: "var(--g500)", fontSize: 12 }}>{p.department}</span>
            <span>{p.riskTier ? <span className={"badge " + riskBadge(p.riskTier)}>{p.riskTier}</span> : "-"}</span>
            <span><span className={"badge " + statusBadge(p.status)}>{p.status.replace("_", " ")}</span></span>
            <span><Link href={`/projects/detail?id=${p.id}`} onClick={e => e.stopPropagation()}><button className="btn btn-ghost btn-sm">View</button></Link></span>
          </div>
        ))}
      </div>
    </div>
  )
}
