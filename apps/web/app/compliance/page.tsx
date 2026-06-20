"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Project { id:string; projectCode:string; name:string; riskTier:string; projectType:string; department:string; businessProblem:string; riskScore:number }
interface Assessment { id:string; projectId:string; overallScore:number; popiaScore:number; faisScore:number; pprTcfScore:number; insuranceActScore:number; aiGovernanceScore:number; cloudScore:number; dataResidencyScore:number; outsourcingScore:number; certificateIssued:boolean; findings:string }

const domains = [
  { key:"popiaScore", label:"POPIA", weight:"20%" },
  { key:"faisScore", label:"FAIS", weight:"15%" },
  { key:"pprTcfScore", label:"PPR / TCF", weight:"20%" },
  { key:"insuranceActScore", label:"Insurance Act", weight:"15%" },
  { key:"aiGovernanceScore", label:"AI governance", weight:"15%" },
  { key:"cloudScore", label:"Cloud governance", weight:"5%" },
  { key:"dataResidencyScore", label:"Data residency", weight:"5%" },
  { key:"outsourcingScore", label:"Outsourcing", weight:"5%" },
]

export default function Compliance() {
  const [projects, setProjects] = useState<Project[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [assessing, setAssessing] = useState<string|null>(null)
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from("Project").select("id,projectCode,name,riskTier,projectType,department,businessProblem,riskScore").order("createdAt", { ascending: false }),
      supabase.from("ComplianceAssessment").select("*").order("assessedAt", { ascending: false })
    ]).then(([{ data: p }, { data: a }]) => { setProjects(p || []); setAssessments(a || []); setLoading(false) })
  }, [])

  const runAssessment = async (projectId: string) => {
    setAssessing(projectId)
    const project = projects.find(p => p.id === projectId)
    if (!project) { setAssessing(null); return }
    try {
      const prompt = `You are a South African insurance regulatory compliance expert. Assess the following project against SA insurance regulations and return ONLY a JSON object with no markdown, no explanation.

PROJECT:
- Name: ${project.name}
- Type: ${project.projectType || "Not specified"}
- Department: ${project.department || "Not specified"}
- Business problem: ${project.businessProblem || "Not specified"}
- Risk tier: ${project.riskTier}
- Risk score: ${project.riskScore}/100

Score each domain 0-100. Higher risk projects and AI/customer-facing projects should score lower. Internal tools with no personal data should score higher.

Return ONLY this JSON (no markdown, no backticks):
{"popiaScore":<0-100>,"faisScore":<0-100>,"pprTcfScore":<0-100>,"insuranceActScore":<0-100>,"aiGovernanceScore":<0-100>,"cloudScore":<0-100>,"dataResidencyScore":<0-100>,"outsourcingScore":<0-100>,"findings":"<2-3 sentence plain English summary of key compliance risks and recommendations for this specific project>"}`

      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      })
      if (!res.ok) { setAssessing(null); return }
      const data = await res.json()
      const text = data.content?.[0]?.text || "{}"
      const scores = JSON.parse(text.replace(/```json|```/g, "").trim())
      const overall = Math.round((scores.popiaScore*0.20)+(scores.faisScore*0.15)+(scores.pprTcfScore*0.20)+(scores.insuranceActScore*0.15)+(scores.aiGovernanceScore*0.15)+(scores.cloudScore*0.05)+(scores.dataResidencyScore*0.05)+(scores.outsourcingScore*0.05))
      const cert = overall >= 60
      const { data: saved } = await supabase.from("ComplianceAssessment").insert({
        projectId, rulesVersion:"v2.0-claude",
        popiaScore:scores.popiaScore, faisScore:scores.faisScore, pprTcfScore:scores.pprTcfScore,
        insuranceActScore:scores.insuranceActScore, aiGovernanceScore:scores.aiGovernanceScore,
        cloudScore:scores.cloudScore, dataResidencyScore:scores.dataResidencyScore, outsourcingScore:scores.outsourcingScore,
        overallScore:overall, findings:scores.findings||"",
        certificateIssued:cert,
        certificateIssuedAt:cert?new Date().toISOString():null,
        certificateExpiresAt:cert?new Date(Date.now()+365*24*60*60*1000).toISOString():null,
      }).select().single()
      if (saved) setAssessments(a => [saved, ...a.filter(x => x.projectId !== projectId)])
    } catch (e) { console.error(e) }
    setAssessing(null)
  }

  const handleAssess = (projectId: string) => {
    runAssessment(projectId)
  }

  const getLatest = (projectId: string) => assessments.find(a => a.projectId === projectId)
  const scoreColor = (s: number) => s >= 70 ? "var(--grn)" : s >= 50 ? "var(--amb)" : "var(--red)"

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Compliance assessments</h1><p>SA insurance regulatory framework - 8 domains, AI-powered assessment</p></div>
      </div>

{loading ? <div className="empty">Loading...</div> : projects.length === 0 ? (
        <div className="card"><div className="card-body"><div className="empty">Register a project first to run compliance assessments</div></div></div>
      ) : projects.map(p => {
        const a = getLatest(p.id)
        return (
          <div key={p.id} className="card">
            <div className="card-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="proj-id">{p.projectCode}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "var(--g500)" }}>{p.department}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {a ? (
                  <>
                    <span style={{ fontSize: 20, fontWeight: 800, color: scoreColor(a.overallScore) }}>{a.overallScore}</span>
                    <span style={{ fontSize: 10, color: "var(--g500)" }}>/100</span>
                    <span className={"badge " + (a.certificateIssued ? "badge-ok" : "badge-fail")}>{a.certificateIssued ? "Certificate issued" : "Below threshold"}</span>
                  </>
                ) : <span className="badge badge-pending">Not assessed</span>}
                <button className={"btn btn-sm " + (a ? "btn-ghost" : "btn-org")} onClick={() => handleAssess(p.id)} disabled={assessing === p.id}>
                  {assessing === p.id ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "currentColor", fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>
                      Assessing...
                    </span>
                  ) : a ? "Re-assess" : "Run assessment"}
                </button>
              </div>
            </div>
            {a && (
              <div style={{ padding: "8px 16px 12px" }}>
                {domains.map(d => {
                  const score = a[d.key as keyof Assessment] as number || 0
                  return (
                    <div key={d.key} className="compliance-bar">
                      <span className="compliance-bar-name">{d.label}</span>
                      <span style={{ fontSize: 9, color: "var(--g300)", width: 28, flexShrink: 0 }}>{d.weight}</span>
                      <div className="compliance-bar-track"><div className="compliance-bar-fill" style={{ width: score + "%", background: scoreColor(score) }}></div></div>
                      <span className="compliance-bar-score" style={{ color: scoreColor(score) }}>{score}</span>
                    </div>
                  )
                })}
                {a.findings && (
                  <div style={{ marginTop: 10, background: "var(--g50)", borderRadius: 7, padding: "10px 12px", fontSize: 11, color: "var(--g700)", lineHeight: 1.6, borderLeft: "3px solid var(--org)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>AI findings</div>
                    {a.findings}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
