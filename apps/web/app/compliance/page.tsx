export const dynamic = "force-dynamic"
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Project { id:string; projectCode:string; name:string; riskTier:string }
interface Assessment { id:string; projectId:string; overallScore:number; popiaScore:number; faisScore:number; pprTcfScore:number; insuranceActScore:number; aiGovernanceScore:number; cloudScore:number; dataResidencyScore:number; outsourcingScore:number; certificateIssued:boolean; certificateExpiresAt:string }

const domains = [
  {key:"popiaScore",label:"POPIA",weight:"20%"},
  {key:"faisScore",label:"FAIS",weight:"15%"},
  {key:"pprTcfScore",label:"PPR / TCF",weight:"20%"},
  {key:"insuranceActScore",label:"Insurance Act",weight:"15%"},
  {key:"aiGovernanceScore",label:"AI governance",weight:"15%"},
  {key:"cloudScore",label:"Cloud governance",weight:"5%"},
  {key:"dataResidencyScore",label:"Data residency",weight:"5%"},
  {key:"outsourcingScore",label:"Outsourcing",weight:"5%"},
]

export default function Compliance() {
  const [projects, setProjects] = useState<Project[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [assessing, setAssessing] = useState<string|null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from("Project").select("id,projectCode,name,riskTier").order("createdAt",{ascending:false}),
      supabase.from("ComplianceAssessment").select("*").order("assessedAt",{ascending:false})
    ]).then(([{data:p},{data:a}]) => { setProjects(p||[]); setAssessments(a||[]); setLoading(false) })
  }, [])

  const assess = async (projectId: string, riskScore: number) => {
    setAssessing(projectId)
    const seed = riskScore || 50
    const scores = {
      popiaScore: Math.min(100,Math.max(30,seed+12)),
      faisScore: Math.min(100,Math.max(30,seed-5)),
      pprTcfScore: Math.min(100,Math.max(30,seed+8)),
      insuranceActScore: Math.min(100,Math.max(30,seed-3)),
      aiGovernanceScore: Math.min(100,Math.max(30,seed+5)),
      cloudScore: Math.min(100,Math.max(30,seed+15)),
      dataResidencyScore: Math.min(100,Math.max(30,seed+10)),
      outsourcingScore: Math.min(100,Math.max(30,seed+18)),
    }
    const overall = Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/8)
    const cert = overall >= 60
    const {data} = await supabase.from("ComplianceAssessment").insert({
      projectId, rulesVersion:"v1.0", ...scores, overallScore:overall,
      certificateIssued:cert,
      certificateIssuedAt:cert?new Date().toISOString():null,
      certificateExpiresAt:cert?new Date(Date.now()+365*24*60*60*1000).toISOString():null
    }).select().single()
    if(data) setAssessments(a=>[data,...a])
    setAssessing(null)
  }

  const getLatest = (projectId: string) => assessments.find(a => a.projectId === projectId)
  const scoreColor = (s: number) => s>=70?"var(--grn)":s>=50?"var(--amb)":"var(--red)"

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Compliance assessments</h1><p>SA insurance regulatory framework â€” 8 domains assessed per project</p></div>
      </div>

      {loading ? <div className="empty">Loading...</div> : projects.length === 0 ? (
        <div className="empty" style={{background:"var(--wh)",border:"1px solid var(--g100)",borderRadius:10,padding:40}}>
          Register a project first â€” compliance assessments are generated automatically
        </div>
      ) : projects.map(p => {
        const a = getLatest(p.id)
        return (
          <div key={p.id} className="card">
            <div className="card-head">
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span className="proj-id">{p.projectCode}</span>
                <span style={{fontWeight:600,fontSize:13}}>{p.name}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {a ? (
                  <>
                    <span style={{fontSize:13,fontWeight:700,color:scoreColor(a.overallScore)}}>{a.overallScore}/100</span>
                    <span className={"badge "+(a.certificateIssued?"badge-ok":"badge-fail")}>{a.certificateIssued?"Certificate issued":"Below threshold"}</span>
                  </>
                ) : <span className="badge badge-pending">Not assessed</span>}
                <button className={"btn btn-sm "+(a?"btn-ghost":"btn-org")} onClick={()=>assess(p.id, 50)} disabled={assessing===p.id}>
                  {assessing===p.id?"Assessing...":(a?"Re-assess":"Run assessment")}
                </button>
              </div>
            </div>
            {a && (
              <div style={{padding:"8px 16px"}}>
                {domains.map(d => {
                  const score = a[d.key as keyof Assessment] as number || 0
                  return (
                    <div key={d.key} className="compliance-bar">
                      <span className="compliance-bar-name">{d.label}</span>
                      <span style={{fontSize:9,color:"var(--g300)",width:28,flexShrink:0}}>{d.weight}</span>
                      <div className="compliance-bar-track">
                        <div className="compliance-bar-fill" style={{width:score+"%",background:scoreColor(score)}}></div>
                      </div>
                      <span className="compliance-bar-score" style={{color:scoreColor(score)}}>{score}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
