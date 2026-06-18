"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Tech { id:string; name:string; vendor:string; category:string; lifecycleStatus:string; costTier:string; popiaCompliant:boolean; dataResidencyCompliant:boolean; approvedUseCases:string[]; description:string }

const categories = ["All","AI platform","Database","Hosting","Authentication","Monitoring","Dev platform","Analytics","Source control"]

export default function Catalogue() {
  const [techs, setTechs] = useState<Tech[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState("All")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({name:"",vendor:"",category:"AI platform",lifecycleStatus:"Approved",costTier:"Low",popiaCompliant:true,dataResidencyCompliant:true,description:"",approvedUseCases:""})
  const supabase = createClient()

  useEffect(() => {
    supabase.from("Technology").select("*").order("name").then(({data})=>{setTechs(data||[]);setLoading(false)})
  }, [])

  const filtered = cat === "All" ? techs : techs.filter(t => t.category === cat)

  const save = async () => {
    if(!form.name||!form.category){alert("Name and category required");return}
    const {data} = await supabase.from("Technology").insert({
      ...form, approvedUseCases:form.approvedUseCases.split(",").map(s=>s.trim()).filter(Boolean),
      approvedAt:new Date().toISOString()
    }).select().single()
    if(data){setTechs(t=>[...t,data]);setShowForm(false);setForm({name:"",vendor:"",category:"AI platform",lifecycleStatus:"Approved",costTier:"Low",popiaCompliant:true,dataResidencyCompliant:true,description:"",approvedUseCases:""})}
  }

  const statusBadge = (s: string) => ({Approved:"badge-ok","Under review":"badge-warn",Deprecated:"badge-fail",Retired:"badge-pending"}[s]||"badge-pending")

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Technology catalogue</h1><p>Approved technologies for use across all Dotsure projects</p></div>
        <button className="btn btn-org" onClick={()=>setShowForm(s=>!s)}>+ Add technology</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-head"><h3>Add technology</h3><button className="btn btn-ghost btn-sm" onClick={()=>setShowForm(false)}>Cancel</button></div>
          <div className="card-body">
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Name *</label><input className="form-input" placeholder="e.g. Claude API" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Vendor</label><input className="form-input" placeholder="e.g. Anthropic" value={form.vendor} onChange={e=>setForm(f=>({...f,vendor:e.target.value}))}/></div>
            </div>
            <div className="form-row-3" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Category *</label>
                <select className="form-input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {categories.filter(c=>c!=="All").map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Status</label>
                <select className="form-input" value={form.lifecycleStatus} onChange={e=>setForm(f=>({...f,lifecycleStatus:e.target.value}))}>
                  <option>Approved</option><option>Under review</option><option>Deprecated</option>
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Cost tier</label>
                <select className="form-input" value={form.costTier} onChange={e=>setForm(f=>({...f,costTier:e.target.value}))}>
                  <option>Free</option><option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
            </div>
            <div className="form-row" style={{marginBottom:12}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,color:"var(--g700)"}}>
                <input type="checkbox" style={{accentColor:"var(--org)"}} checked={form.popiaCompliant} onChange={e=>setForm(f=>({...f,popiaCompliant:e.target.checked}))}/>POPIA compliant
              </label>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,color:"var(--g700)"}}>
                <input type="checkbox" style={{accentColor:"var(--org)"}} checked={form.dataResidencyCompliant} onChange={e=>setForm(f=>({...f,dataResidencyCompliant:e.target.checked}))}/>SA data residency
              </label>
            </div>
            <div className="form-group"><label className="form-label">Approved use cases (comma separated)</label><input className="form-input" placeholder="e.g. AI assistant, content generation, summarisation" value={form.approvedUseCases} onChange={e=>setForm(f=>({...f,approvedUseCases:e.target.value}))}/></div>
            <div style={{display:"flex",justifyContent:"flex-end"}}><button className="btn btn-org" onClick={save}>Add to catalogue</button></div>
          </div>
        </div>
      )}

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
        {categories.map(c=>(
          <button key={c} className={"btn btn-sm "+(cat===c?"btn-org":"btn-ghost")} onClick={()=>setCat(c)}>{c}</button>
        ))}
      </div>

      {loading ? <div className="empty">Loading...</div> : filtered.length === 0 ? (
        <div className="empty" style={{background:"var(--wh)",border:"1px solid var(--g100)",borderRadius:10,padding:40}}>
          {techs.length ? "No technologies in this category" : "No technologies in catalogue yet — add the first one"}
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {filtered.map(t=>(
            <div key={t.id} className="tech-card">
              <div className="tech-card-name">{t.name}</div>
              <div className="tech-card-vendor">{t.vendor} · {t.category}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                <span className={"badge "+statusBadge(t.lifecycleStatus)}>{t.lifecycleStatus}</span>
                <span className="badge badge-pending">{t.costTier} cost</span>
                {t.popiaCompliant && <span className="badge badge-ok">POPIA</span>}
                {t.dataResidencyCompliant && <span className="badge badge-ok">SA data</span>}
              </div>
              {t.approvedUseCases?.length > 0 && <div style={{fontSize:10,color:"var(--g500)",marginTop:6}}>{t.approvedUseCases.slice(0,3).join(", ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
