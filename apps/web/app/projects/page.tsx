export const dynamic = "force-dynamic"
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"

interface Project {
  id: string; projectCode: string; name: string; department: string
  riskTier: string; status: string; projectType: string; createdAt: string
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [riskFilter, setRiskFilter] = useState("")
  const supabase = createClient()

  useEffect(() => {
    supabase.from("Project").select("*").order("createdAt", { ascending: false })
      .then(({ data }) => { setProjects(data || []); setLoading(false) })
  }, [])

  const filtered = projects.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.projectCode.toLowerCase().includes(q) || (p.department||"").toLowerCase().includes(q)
    const matchR = !riskFilter || p.riskTier === riskFilter
    return matchQ && matchR
  })

  const riskBadge = (t: string) => ({ LOW:"badge-low", MEDIUM:"badge-medium", HIGH:"badge-high", CRITICAL:"badge-critical" }[t] || "badge-pending")
  const statusBadge = (s: string) => ({ REGISTERED:"badge-org", IN_ASSESSMENT:"badge-warn", APPROVED:"badge-ok", BUILDING:"badge-ok", LIVE:"badge-pur" }[s] || "badge-pending")

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>All projects</h1>
          <p>{projects.length} project{projects.length !== 1 ? "s" : ""} registered in the platform</p>
        </div>
        <Link href="/projects/new"><button className="btn btn-org">+ Register project</button></Link>
      </div>

      <div className="card">
        <div className="card-head" style={{gap:8}}>
          <h3>Projects register</h3>
          <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
            <input className="form-input" style={{width:200,padding:"5px 9px",fontSize:11}} placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="form-input" style={{width:130,padding:"5px 8px",fontSize:11}} value={riskFilter} onChange={e => setRiskFilter(e.target.value)}>
              <option value="">All risk tiers</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </div>
        <div className="tbl-head" style={{gridTemplateColumns:"110px 1fr 90px 80px 90px"}}>
          <span>Project ID</span><span>Name</span><span>Department</span><span>Risk</span><span>Status</span>
        </div>
        {loading ? <div className="empty">Loading...</div> : filtered.length === 0 ? (
          <div className="empty">{projects.length ? "No projects match your filter" : "No projects registered yet"}</div>
        ) : filtered.map(p => (
          <div key={p.id} className="tbl-row" style={{gridTemplateColumns:"110px 1fr 90px 80px 90px"}}>
            <span className="proj-id">{p.projectCode}</span>
            <span style={{fontWeight:600,color:"var(--g900)"}}>{p.name}</span>
            <span style={{color:"var(--g500)",fontSize:11}}>{p.department}</span>
            <span>{p.riskTier && <span className={"badge " + riskBadge(p.riskTier)}>{p.riskTier}</span>}</span>
            <span>{p.status && <span className={"badge " + statusBadge(p.status)}>{p.status.replace("_"," ")}</span>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
