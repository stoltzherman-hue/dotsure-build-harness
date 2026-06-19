"use client"
export const dynamic = "force-dynamic"
import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const questions = [
  { key:"personalData", q:"Will this solution process, store or transmit personal customer information?" },
  { key:"customerFacing", q:"Does it interact directly with customers (not just internal staff)?" },
  { key:"claimsOrAdvice", q:"Will it influence claims decisions, underwriting or financial advice?" },
  { key:"aiDecisions", q:"Does it use AI or machine learning in any automated decision?" },
  { key:"outsideSA", q:"Will any part be hosted or processed outside South Africa?" },
  { key:"thirdParty", q:"Will it be operated by a third-party vendor on behalf of Dotsure?" },
]

function calcRisk(r: Record<string,string>) {
  let s = 0
  if(r.personalData==="Yes") s+=25; else if(r.personalData==="Not sure") s+=10
  if(r.customerFacing==="Yes") s+=20; else if(r.customerFacing==="Not sure") s+=8
  if(r.claimsOrAdvice==="Yes") s+=25; else if(r.claimsOrAdvice==="Not sure") s+=10
  if(r.aiDecisions==="Yes") s+=15; else if(r.aiDecisions==="Not sure") s+=6
  if(r.outsideSA==="Yes") s+=10; else if(r.outsideSA==="Not sure") s+=4
  if(r.thirdParty==="Yes") s+=5
  s = Math.min(100, s)
  const tier = s<=25?"LOW":s<=50?"MEDIUM":s<=75?"HIGH":"CRITICAL"
  return { score: s, tier }
}

export default function RegisterProject() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [projectId, setProjectId] = useState("")
  const [form, setForm] = useState({ name:"", projectType:"", department:"", businessProblem:"", costCentre:"", businessOwnerId:"", technicalOwnerId:"", expectedSavingsZar:"", estimatedUsers:"", targetGoLive:"" })
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [result, setResult] = useState<{tier:string,score:number}|null>(null)

  const set = (k: string, v: string) => setForm(f => ({...f,[k]:v}))

  const step2 = () => {
    if(!form.name || !form.projectType || !form.department) { alert("Please fill in name, type and department"); return }
    setStep(2)
  }

  const submit = async () => {
    setSaving(true)
    const r = calcRisk(answers)
    setResult(r)
    const year = new Date().getFullYear()
    const { count } = await supabase.from("Project").select("*", { count:"exact", head:true })
    const projectCode = `DOT-${year}-${String((count||0)+1).padStart(4,"0")}`
    const { data, error } = await supabase.from("Project").insert({
      projectCode, name:form.name, projectType:form.projectType, department:form.department,
      businessProblem:form.businessProblem, costCentre:form.costCentre,
      businessOwnerId:form.businessOwnerId, technicalOwnerId:form.technicalOwnerId,
      expectedSavingsZar:form.expectedSavingsZar||null, estimatedUsers:form.estimatedUsers?parseInt(form.estimatedUsers):null,
      targetGoLive:form.targetGoLive||null, status:"REGISTERED", riskTier:r.tier, riskScore:r.score
    }).select().single()
    if(!error && data) {
      setProjectId(data.projectCode)
      setStep(3)
    } else {
      alert("Error saving project: " + (error?.message||"unknown"))
    }
    setSaving(false)
  }

  const riskColor = (t: string) => ({ LOW:"var(--grn)", MEDIUM:"var(--amb)", HIGH:"var(--red)", CRITICAL:"var(--red-dk)" }[t]||"var(--g500)")
  const riskBadgeClass = (t: string) => ({ LOW:"badge-low", MEDIUM:"badge-medium", HIGH:"badge-high", CRITICAL:"badge-critical" }[t]||"badge-pending")

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Register a new project</h1><p>Every initiative needs a Project ID before any work begins</p></div>
      </div>

      <div className="step-row">
        <div className={"sdot " + (step>1?"sdot-done":step===1?"sdot-active":"sdot-todo")}>1</div>
        <span className={"slbl" + (step===1?" slbl-active":"")}>Project details</span>
        <div className={"sline" + (step>1?" sline-done":"")}></div>
        <div className={"sdot " + (step>2?"sdot-done":step===2?"sdot-active":"sdot-todo")}>2</div>
        <span className={"slbl" + (step===2?" slbl-active":"")}>Risk assessment</span>
        <div className={"sline" + (step>2?" sline-done":"")}></div>
        <div className={"sdot " + (step===3?"sdot-active":"sdot-todo")}>3</div>
        <span className={"slbl" + (step===3?" slbl-active":"")}>Confirmation</span>
      </div>

      {step === 1 && (
        <div className="card">
          <div className="card-head"><h3>Step 1: Project identity</h3></div>
          <div className="card-body">
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Project name *</label><input className="form-input" placeholder="e.g. Claims AI Assistant" value={form.name} onChange={e=>set("name",e.target.value)}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Project type *</label>
                <select className="form-input" value={form.projectType} onChange={e=>set("projectType",e.target.value)}>
                  <option value="">Select type</option>
                  <option>AI application</option><option>Internal tool</option><option>Customer-facing application</option>
                  <option>Automation</option><option>API / integration</option><option>Website</option><option>Data solution</option>
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Business problem</label><textarea className="form-input" placeholder="What problem does this solve for Dotsure?" value={form.businessProblem} onChange={e=>set("businessProblem",e.target.value)}/></div>
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Department *</label>
                <select className="form-input" value={form.department} onChange={e=>set("department",e.target.value)}>
                  <option value="">Select</option>
                  <option>Claims</option><option>Sales</option><option>Operations</option><option>Product</option>
                  <option>Technology</option><option>Finance</option><option>Underwriting</option><option>Compliance</option>
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Cost centre</label><input className="form-input" placeholder="e.g. CC-0142" value={form.costCentre} onChange={e=>set("costCentre",e.target.value)}/></div>
            </div>
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Business owner</label><input className="form-input" placeholder="Full name" value={form.businessOwnerId} onChange={e=>set("businessOwnerId",e.target.value)}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Technical owner</label><input className="form-input" placeholder="Full name" value={form.technicalOwnerId} onChange={e=>set("technicalOwnerId",e.target.value)}/></div>
            </div>
            <div className="form-row" style={{marginBottom:16}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Expected savings (ZAR / year)</label><input className="form-input" type="number" placeholder="e.g. 500000" value={form.expectedSavingsZar} onChange={e=>set("expectedSavingsZar",e.target.value)}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Target go-live</label><input className="form-input" type="date" value={form.targetGoLive} onChange={e=>set("targetGoLive",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button className="btn btn-org" onClick={step2}>Continue to risk questions</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-head"><h3>Step 2: Risk assessment</h3><span style={{fontSize:10,color:"var(--g500)"}}>Plain language - we handle the scoring</span></div>
          <div className="card-body">
            {questions.map(q => (
              <div key={q.key} className="rq">
                <div className="rq-q">{q.q}</div>
                <div className="rq-opts">
                  {["Yes","No","Not sure"].map(opt => (
                    <button key={opt} className={"ropt" + (answers[q.key]===opt?" sel":"")} onClick={() => setAnswers(a=>({...a,[q.key]:opt}))}>{opt}</button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
              <button className="btn btn-ghost" onClick={()=>setStep(1)}>Back</button>
              <button className="btn btn-org" onClick={submit} disabled={saving}>{saving?"Saving...":"Register & calculate risk"}</button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="card" style={{border:`2px solid ${riskColor(result.tier)}`}}>
          <div className="confirm-box">
            <div className="confirm-icon">
              <svg viewBox="0 0 24 24" style={{width:24,height:24,stroke:"white",fill:"none",strokeWidth:3,strokeLinecap:"round",strokeLinejoin:"round"}}><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:"var(--g500)",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:4}}>Project registered</div>
            <div className="confirm-id">{projectId}</div>
            <div className="confirm-name">{form.name}</div>
            <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"var(--g50)",borderRadius:7,padding:"8px 14px",marginBottom:12}}>
              <span style={{fontSize:11,color:"var(--g700)"}}>Risk tier:</span>
              <span className={"badge " + riskBadgeClass(result.tier)}>{result.tier}</span>
              <span style={{fontSize:11,fontWeight:700,color:"var(--g700)"}}>Score: {result.score}/100</span>
            </div>
            <div style={{fontSize:11,color:"var(--g700)",marginBottom:20}}>Approval workflow generated. Notifications sent to {form.businessOwnerId || "business owner"} and {form.technicalOwnerId || "technical owner"}.</div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button className="btn btn-org" onClick={()=>router.push("/")}>Go to dashboard</button>
              <button className="btn btn-ghost" onClick={()=>router.push("/projects")}>View all projects</button>
              <button className="btn btn-ghost" onClick={()=>{setStep(1);setForm({name:"",projectType:"",department:"",businessProblem:"",costCentre:"",businessOwnerId:"",technicalOwnerId:"",expectedSavingsZar:"",estimatedUsers:"",targetGoLive:""});setAnswers({})}}>Register another</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
