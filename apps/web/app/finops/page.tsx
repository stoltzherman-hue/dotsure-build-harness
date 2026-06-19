"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Cost { id:string; projectId:string; vendorName:string; amountZar:number; costCategory:string; createdAt:string }
interface Project { id:string; projectCode:string; name:string }

export default function Finops() {
  const [costs, setCosts] = useState<Cost[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({projectId:"",vendorName:"",amountZar:"",costCategory:"AI API",month:""})
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from("CostRecord").select("*").order("createdAt",{ascending:false}),
      supabase.from("Project").select("id,projectCode,name")
    ]).then(([{data:c},{data:p}]) => { setCosts(c||[]); setProjects(p||[]); setLoading(false) })
  }, [])

  const save = async () => {
    if(!form.projectId||!form.vendorName||!form.amountZar){alert("Project, vendor and amount required");return}
    setSaving(true)
    const {data} = await supabase.from("CostRecord").insert({
      projectId:form.projectId, vendorName:form.vendorName,
      amountZar:parseFloat(form.amountZar), costCategory:form.costCategory,
      source:"MANUAL_ENTRY"
    }).select().single()
    if(data) setCosts(c=>[data,...c])
    setForm(f=>({...f,vendorName:"",amountZar:""}))
    setSaving(false)
  }

  const total = costs.reduce((s,c)=>s+Number(c.amountZar),0)
  const byVendor: Record<string,number> = {}
  costs.forEach(c=>{byVendor[c.vendorName||"Unknown"]=(byVendor[c.vendorName||"Unknown"]||0)+Number(c.amountZar)})
  const maxVendor = Math.max(...Object.values(byVendor),1)
  const proj = (n: number) => n.toLocaleString("en-ZA",{minimumFractionDigits:0,maximumFractionDigits:0})

  return (
    <div className="content">
      <div className="page-head"><div><h1>FinOps &amp; costs</h1><p>Track AI, infrastructure and vendor spend across all projects</p></div></div>

      <div className="kpi-grid" style={{gridTemplateColumns:"repeat(3,1fr)"}}>
        <div className="kcard"><div className="kcard-accent" style={{background:"var(--org)"}}></div><div className="kcard-label">Total spend (MTD)</div><div className="kcard-value">R{proj(total)}</div><div className="kcard-sub">Across all projects</div></div>
        <div className="kcard"><div className="kcard-accent" style={{background:"var(--grn)"}}></div><div className="kcard-label">Budget utilised</div><div className="kcard-value">{Math.round(total/100000*100)}%</div><div className="kcard-sub">vs R100,000 monthly budget</div></div>
        <div className="kcard"><div className="kcard-accent" style={{background:"var(--g500)"}}></div><div className="kcard-label">Projects with costs</div><div className="kcard-value">{[...new Set(costs.map(c=>c.projectId))].length}</div><div className="kcard-sub">Have cost records</div></div>
      </div>

      <div className="two-col">
        <div className="card card-last">
          <div className="card-head"><h3>Log cost</h3></div>
          <div className="card-body">
            <div className="form-group"><label className="form-label">Project</label>
              <select className="form-input" value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))}>
                <option value="">Select project</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.projectCode} - {p.name}</option>)}
              </select>
            </div>
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Vendor / service</label><input className="form-input" placeholder="e.g. Claude API" value={form.vendorName} onChange={e=>setForm(f=>({...f,vendorName:e.target.value}))}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Amount (ZAR)</label><input className="form-input" type="number" placeholder="0" value={form.amountZar} onChange={e=>setForm(f=>({...f,amountZar:e.target.value}))}/></div>
            </div>
            <div className="form-row" style={{marginBottom:14}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Category</label>
                <select className="form-input" value={form.costCategory} onChange={e=>setForm(f=>({...f,costCategory:e.target.value}))}>
                  <option>AI API</option><option>Infrastructure</option><option>SaaS</option><option>Licensing</option><option>Other</option>
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Month</label><input className="form-input" type="month" value={form.month} onChange={e=>setForm(f=>({...f,month:e.target.value}))}/></div>
            </div>
            <button className="btn btn-org" style={{width:"100%",justifyContent:"center"}} onClick={save} disabled={saving}>{saving?"Saving...":"Log cost"}</button>
          </div>
        </div>

        <div className="card card-last">
          <div className="card-head"><h3>Spend by vendor</h3></div>
          <div className="card-body">
            {Object.keys(byVendor).length === 0 ? <div className="empty" style={{padding:20}}>No cost records yet</div> :
              Object.entries(byVendor).sort((a,b)=>b[1]-a[1]).map(([v,a])=>(
                <div key={v} className="vendor-bar">
                  <span className="vendor-bar-name">{v}</span>
                  <div className="vendor-bar-track"><div className="vendor-bar-fill" style={{width:Math.round(a/maxVendor*100)+"%"}}></div></div>
                  <span className="vendor-bar-amt">R{proj(a)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Cost records</h3></div>
        {loading ? <div className="empty">Loading...</div> : costs.length === 0 ? <div className="empty">No cost records logged yet</div> : (
          <>
            <div className="tbl-head" style={{gridTemplateColumns:"1fr 120px 100px 90px 80px"}}>
              <span>Vendor</span><span>Project</span><span>Category</span><span>Date</span><span style={{textAlign:"right"}}>Amount</span>
            </div>
            {costs.map(c => {
              const p = projects.find(pr=>pr.id===c.projectId)
              return (
                <div key={c.id} className="tbl-row" style={{gridTemplateColumns:"1fr 120px 100px 90px 80px"}}>
                  <span style={{fontWeight:600}}>{c.vendorName}</span>
                  <span style={{color:"var(--g500)",fontSize:11}}>{p?.projectCode||"-"}</span>
                  <span><span className="badge badge-pending">{c.costCategory}</span></span>
                  <span style={{color:"var(--g500)",fontSize:11}}>{new Date(c.createdAt).toLocaleDateString("en-ZA")}</span>
                  <span style={{fontWeight:700,color:"var(--org)",textAlign:"right"}}>R{proj(Number(c.amountZar))}</span>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
