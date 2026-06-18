"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Deployment { id:string; projectId:string; environment:string; versionTag:string; status:string; requestedAt:string; rollbackPlan:string; documentationComplete:boolean; monitoringConfigured:boolean; uatSignedOff:boolean; complianceApproved:boolean; securityApproved:boolean; architectureApproved:boolean }
interface Project { id:string; projectCode:string; name:string }

export default function Deployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({projectId:"",environment:"Development",versionTag:"",rollbackPlan:"",documentationComplete:false,monitoringConfigured:false,uatSignedOff:false})
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from("Deployment").select("*").order("requestedAt",{ascending:false}),
      supabase.from("Project").select("id,projectCode,name")
    ]).then(([{data:d},{data:p}])=>{setDeployments(d||[]);setProjects(p||[]);setLoading(false)})
  }, [])

  const save = async () => {
    if(!form.projectId){alert("Select a project");return}
    if(!form.rollbackPlan){alert("Rollback plan is required");return}
    setSaving(true)
    const {data} = await supabase.from("Deployment").insert({...form,status:"PENDING",requestedAt:new Date().toISOString()}).select().single()
    if(data){setDeployments(d=>[data,...d]);setShowForm(false);setForm({projectId:"",environment:"Development",versionTag:"",rollbackPlan:"",documentationComplete:false,monitoringConfigured:false,uatSignedOff:false})}
    setSaving(false)
  }

  const approve = async (id: string, gate: string) => {
    const field = gate+"Approved"
    await supabase.from("Deployment").update({[field]:true}).eq("id",id)
    setDeployments(d=>d.map(dep=>dep.id===id?{...dep,[field]:true}:dep))
  }

  const envBadge = (e: string) => ({Development:"badge-pending",Testing:"badge-org",UAT:"badge-warn",Production:"badge-pur"}[e]||"badge-pending")
  const statusBadge = (s: string) => ({PENDING:"badge-org",APPROVED:"badge-ok",BLOCKED:"badge-fail",DEPLOYED:"badge-ok",REJECTED:"badge-fail"}[s]||"badge-pending")

  const gates = [
    {key:"compliance",label:"Compliance"},
    {key:"security",label:"Security"},
    {key:"architecture",label:"Architecture"},
    {key:"uat",label:"UAT sign-off"},
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Deployment governance</h1><p>All production deployments require 4-gate approval</p></div>
        <button className="btn btn-org" onClick={()=>setShowForm(s=>!s)}>+ Request deployment</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-head"><h3>Deployment request</h3><button className="btn btn-ghost btn-sm" onClick={()=>setShowForm(false)}>Cancel</button></div>
          <div className="card-body">
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Project *</label>
                <select className="form-input" value={form.projectId} onChange={e=>setForm(f=>({...f,projectId:e.target.value}))}>
                  <option value="">Select project</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.projectCode} ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {p.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Target environment *</label>
                <select className="form-input" value={form.environment} onChange={e=>setForm(f=>({...f,environment:e.target.value}))}>
                  <option>Development</option><option>Testing</option><option>UAT</option><option>Production</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Version / release tag</label><input className="form-input" placeholder="e.g. v1.0.0" value={form.versionTag} onChange={e=>setForm(f=>({...f,versionTag:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Rollback plan *</label><textarea className="form-input" placeholder="Describe the rollback procedure if this deployment fails..." value={form.rollbackPlan} onChange={e=>setForm(f=>({...f,rollbackPlan:e.target.value}))}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {[{k:"documentationComplete",l:"Documentation complete"},{k:"monitoringConfigured",l:"Monitoring configured (Grafana)"},{k:"uatSignedOff",l:"UAT sign-off obtained"}].map(c=>(
                <label key={c.k} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,color:"var(--g700)"}}>
                  <input type="checkbox" style={{accentColor:"var(--org)"}} checked={!!(form as any)[c.k]} onChange={e=>setForm(f=>({...f,[c.k]:e.target.checked}))}/>{c.l}
                </label>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button className="btn btn-org" onClick={save} disabled={saving}>{saving?"Saving...":"Submit for approval"}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="empty">Loading...</div> : deployments.length === 0 ? (
        <div className="empty" style={{background:"var(--wh)",border:"1px solid var(--g100)",borderRadius:10,padding:40}}>No deployment requests yet</div>
      ) : deployments.map(d => {
        const p = projects.find(pr=>pr.id===d.projectId)
        const allApproved = d.complianceApproved && d.securityApproved && d.architectureApproved && d.uatSignedOff
        return (
          <div key={d.id} className="card">
            <div className="card-head">
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span className="proj-id">{p?.projectCode||"ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â"}</span>
                <span style={{fontWeight:600,fontSize:13}}>{p?.name||"Unknown project"}</span>
                <span className={"badge "+envBadge(d.environment)}>{d.environment}</span>
                {d.versionTag && <span className="badge badge-pending">{d.versionTag}</span>}
              </div>
              <span className={"badge "+statusBadge(d.status)}>{d.status}</span>
            </div>
            <div style={{padding:"12px 16px"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                {gates.map(g => {
                  const approved = (d as any)[g.key+"Approved"]
                  return (
                    <div key={g.key} className="deploy-gate">
                      <svg viewBox="0 0 24 24" style={{width:14,height:14,stroke:approved?"var(--grn)":"var(--g300)",fill:"none",strokeWidth:2.5,strokeLinecap:"round",flexShrink:0}}>
                        {approved ? <polyline points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="10"/>}
                      </svg>
                      <span className="deploy-gate-label" style={{color:approved?"var(--grn)":"var(--g700)"}}>{g.label}</span>
                      {!approved && d.status==="PENDING" && (
                        <button className="btn btn-sm btn-green" onClick={()=>approve(d.id,g.key)}>Approve</button>
                      )}
                    </div>
                  )
                })}
              </div>
              {allApproved && d.status==="PENDING" && (
                <div style={{background:"var(--grn-lt)",borderRadius:7,padding:"8px 12px",fontSize:11,color:"var(--grn-dk)",fontWeight:600}}>
                  All gates approved ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â deployment may proceed
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
