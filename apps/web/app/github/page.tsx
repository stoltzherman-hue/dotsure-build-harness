export const dynamic = "force-dynamic"
"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

interface Repo { id:string; githubRepoName:string; githubRepoUrl:string; environment:string; governanceScore:number; governanceStatus:string; projectId:string }

const controls = [
  {key:"isPrivate",label:"Private repository",pts:20},
  {key:"mfaEnabled",label:"MFA enabled for all contributors",pts:15},
  {key:"branchProtection",label:"Branch protection on main",pts:15},
  {key:"secretScanning",label:"Secret scanning enabled",pts:10},
  {key:"codeownersPresent",label:"CODEOWNERS file present",pts:10},
  {key:"prReviewsRequired",label:"PR reviews required (min 1)",pts:10},
  {key:"dependabotEnabled",label:"Dependabot enabled",pts:10},
  {key:"securityPolicyPresent",label:"SECURITY.md present",pts:10},
]

export default function Github() {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [projects, setProjects] = useState<{id:string,projectCode:string,name:string}[]>([])
  const [form, setForm] = useState({name:"",projId:"",env:"Development",deploy:"GitHub Actions"})
  const [checks, setChecks] = useState<Record<string,boolean>>({})
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from("Repository").select("*").order("createdAt",{ascending:false}),
      supabase.from("Project").select("id,projectCode,name")
    ]).then(([{data:r},{data:p}]) => { setRepos(r||[]); setProjects(p||[]); setLoading(false) })
  }, [])

  const calcScore = () => controls.reduce((s,c) => s+(checks[c.key]?c.pts:0), 0)
  const scoreColor = (s:number) => s>=90?"var(--grn)":s>=70?"var(--amb)":s>=50?"var(--red)":"var(--red-dk)"
  const statusBadge = (s:string) => ({COMPLIANT:"badge-ok",ACCEPTABLE:"badge-warn",AT_RISK:"badge-fail",NON_COMPLIANT:"badge-fail"}[s]||"badge-pending")

  const save = async () => {
    if(!form.name||!form.projId){alert("Repository name and project required");return}
    const score = calcScore()
    const status = score>=90?"COMPLIANT":score>=70?"ACCEPTABLE":score>=50?"AT_RISK":"NON_COMPLIANT"
    const {data:repo} = await supabase.from("Repository").insert({
      githubRepoName:form.name, githubRepoUrl:"https://github.com/"+form.name,
      projectId:form.projId, environment:form.env, deploymentMethod:form.deploy,
      governanceScore:score, governanceStatus:status, lastValidatedAt:new Date().toISOString(), isActive:true
    }).select().single()
    if(repo) {
      await supabase.from("RepositoryControlResult").insert({ repositoryId:repo.id, validationTrigger:"MANUAL", calculatedScore:score, ...checks })
      setRepos(r=>[repo,...r]); setShowForm(false)
      setForm({name:"",projId:"",env:"Development",deploy:"GitHub Actions"}); setChecks({})
    }
  }

  const kpis = [
    {label:"Compliant",count:repos.filter(r=>r.governanceScore>=90).length,color:"var(--grn)"},
    {label:"Acceptable",count:repos.filter(r=>r.governanceScore>=70&&r.governanceScore<90).length,color:"var(--amb)"},
    {label:"At risk",count:repos.filter(r=>r.governanceScore>=50&&r.governanceScore<70).length,color:"var(--red)"},
    {label:"Non-compliant",count:repos.filter(r=>r.governanceScore<50).length,color:"var(--red-dk)"},
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>GitHub governance</h1><p>All repositories must score 70+ for production deployments</p></div>
        <button className="btn btn-org" onClick={()=>setShowForm(s=>!s)}>+ Register repository</button>
      </div>

      <div className="kpi-grid">
        {kpis.map(k=>(
          <div key={k.label} className="kcard">
            <div className="kcard-accent" style={{background:k.color}}></div>
            <div className="kcard-label">{k.label}</div>
            <div className="kcard-value" style={{color:k.color}}>{loading?"â€”":k.count}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="card">
          <div className="card-head"><h3>Register repository</h3><button className="btn btn-ghost btn-sm" onClick={()=>setShowForm(false)}>Cancel</button></div>
          <div className="card-body">
            <div className="form-row" style={{marginBottom:12}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">GitHub org/repo name *</label><input className="form-input" placeholder="dotsure/repo-name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Linked project *</label>
                <select className="form-input" value={form.projId} onChange={e=>setForm(f=>({...f,projId:e.target.value}))}>
                  <option value="">Select project</option>
                  {projects.map(p=><option key={p.id} value={p.id}>{p.projectCode} â€” {p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{marginBottom:14}}>
              <div className="form-group" style={{margin:0}}><label className="form-label">Environment</label>
                <select className="form-input" value={form.env} onChange={e=>setForm(f=>({...f,env:e.target.value}))}>
                  <option>Development</option><option>Testing</option><option>UAT</option><option>Production</option>
                </select>
              </div>
              <div className="form-group" style={{margin:0}}><label className="form-label">Deployment method</label>
                <select className="form-input" value={form.deploy} onChange={e=>setForm(f=>({...f,deploy:e.target.value}))}>
                  <option>GitHub Actions</option><option>Manual</option><option>Vercel</option><option>Azure DevOps</option>
                </select>
              </div>
            </div>
            <div style={{background:"var(--g50)",borderRadius:8,padding:14,marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:"var(--g700)",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:10}}>Security controls (self-assessment)</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {controls.map(c=>(
                  <label key={c.key} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,color:"var(--g700)"}}>
                    <input type="checkbox" style={{accentColor:"var(--org)"}} checked={!!checks[c.key]} onChange={e=>setChecks(ch=>({...ch,[c.key]:e.target.checked}))}/>
                    {c.label} <span style={{color:"var(--g400)",marginLeft:"auto"}}>{c.pts}pts</span>
                  </label>
                ))}
              </div>
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"var(--g700)"}}>Live score:</span>
                <span style={{fontSize:18,fontWeight:700,color:scoreColor(calcScore())}}>{calcScore()}/100</span>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end"}}>
              <button className="btn btn-org" onClick={save}>Register & score</button>
            </div>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card card-last">
          <div className="card-head"><h3>Repository register</h3></div>
          {loading ? <div className="empty">Loading...</div> : repos.length === 0 ? <div className="empty">No repositories registered yet</div> : repos.map((r,i)=>(
            <div key={r.id} className={"row"+(i===repos.length-1?" row-last":"")}>
              <span style={{fontFamily:"monospace",fontSize:11,flex:1,color:"var(--g900)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.githubRepoName}</span>
              <div className="sbar-wrap"><div className="sbar" style={{width:r.governanceScore+"%",background:scoreColor(r.governanceScore)}}></div></div>
              <span style={{fontSize:11,fontWeight:700,color:scoreColor(r.governanceScore),minWidth:28,textAlign:"right"}}>{r.governanceScore}</span>
              <span className={"badge "+statusBadge(r.governanceStatus)}>{r.governanceStatus?.replace("_"," ")}</span>
            </div>
          ))}
        </div>
        <div className="card card-last">
          <div className="card-head"><h3>Required controls</h3></div>
          <div style={{padding:"4px 16px"}}>
            {controls.map(c=>(
              <div key={c.key} className="ctrl-row">
                <svg viewBox="0 0 24 24" style={{width:14,height:14,stroke:"var(--g400)",fill:"none",strokeWidth:2,flexShrink:0,strokeLinecap:"round",strokeLinejoin:"round"}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="ctrl-lbl">{c.label}</span>
                <span className="ctrl-pts">{c.pts} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
