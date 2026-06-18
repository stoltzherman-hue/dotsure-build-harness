"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Log { id:string; actionType:string; entityType:string; entityId:string; userId:string; loggedAt:string; source:string }

export default function Audit() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const supabase = createClient()

  useEffect(() => {
    supabase.from("AuditLog").select("*").order("loggedAt",{ascending:false}).limit(200)
      .then(({data}) => { setLogs(data||[]); setLoading(false) })
  }, [])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    const m = !q || l.actionType.toLowerCase().includes(q) || l.entityType.toLowerCase().includes(q)
    const t = !typeFilter || l.actionType.includes(typeFilter)
    return m && t
  })

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Audit log</h1><p>{logs.length} entries — immutable record of all platform actions</p></div>
      </div>

      <div className="card">
        <div className="card-head" style={{gap:8}}>
          <h3>Audit log</h3>
          <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
            <input className="form-input" style={{width:220,padding:"5px 9px",fontSize:11}} placeholder="Search actions, entities..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select className="form-input" style={{width:140,padding:"5px 8px",fontSize:11}} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}>
              <option value="">All actions</option>
              <option value="project">Projects</option>
              <option value="repository">Repositories</option>
              <option value="deployment">Deployments</option>
              <option value="cost">Costs</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
        </div>
        <div className="tbl-head" style={{gridTemplateColumns:"1fr 140px 110px 80px"}}>
          <span>Action</span><span>Entity</span><span>User</span><span style={{textAlign:"right"}}>Time</span>
        </div>
        {loading ? <div className="empty">Loading...</div> : filtered.length === 0 ? (
          <div className="empty">{logs.length?"No entries match your filter":"No audit events yet — actions you take will appear here"}</div>
        ) : filtered.map(l => (
          <div key={l.id} className="audit-row">
            <span className="audit-action">{l.actionType}</span>
            <span className="audit-entity">{l.entityType} · {l.entityId.slice(0,8)}...</span>
            <span className="audit-user">{l.userId||"system"}</span>
            <span className="audit-time">{new Date(l.loggedAt).toLocaleTimeString("en-ZA",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
