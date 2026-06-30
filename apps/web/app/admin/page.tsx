"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

export default function Admin() {
  const [key, setKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [hasKey, setHasKey] = useState(false)
  const [ctxContent, setCtxContent] = useState("")
  const [ctxRowId, setCtxRowId] = useState<string | null>(null)
  const [ctxLoading, setCtxLoading] = useState(true)
  const [ctxSaving, setCtxSaving] = useState(false)
  const [ctxSavedAt, setCtxSavedAt] = useState<string | null>(null)

  useEffect(() => {
    const k = localStorage.getItem("harness_anthropic_key")
    if (k) { setHasKey(true); setKey(k) }
  }, [])

  useEffect(() => {
    const loadContext = async () => {
      const sb = createClient()
      const { data } = await sb.from("CompanyContext").select("*").order("updatedAt", { ascending: false }).limit(1).single()
      if (data) { setCtxContent(data.content || ""); setCtxRowId(data.id); setCtxSavedAt(data.updatedAt) }
      setCtxLoading(false)
    }
    loadContext()
  }, [])
  const saveContext = async () => {
    setCtxSaving(true)
    const sb = createClient()
    if (ctxRowId) {
      await sb.from("CompanyContext").update({ content: ctxContent, updatedAt: new Date().toISOString() }).eq("id", ctxRowId)
    } else {
      const { data } = await sb.from("CompanyContext").insert({ content: ctxContent }).select().single()
      if (data) setCtxRowId(data.id)
    }
    setCtxSavedAt(new Date().toISOString())
    setCtxSaving(false)
  }
  const save = () => {
    if (!key.trim()) { alert("Enter an API key"); return }
    localStorage.setItem("harness_anthropic_key", key.trim())
    setHasKey(true); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const clear = () => {
    localStorage.removeItem("harness_anthropic_key")
    setKey(""); setHasKey(false)
  }

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Platform settings</h1><p>API keys and configuration</p></div>
      </div>
      <div className="card" style={{maxWidth:580}}>
        <div className="card-head">
          <h3>Governance Concierge - Anthropic API key</h3>
          {hasKey && <span className="badge badge-ok">Key saved</span>}
        </div>
        <div className="card-body">
          <p style={{fontSize:12,color:"var(--g700)",marginBottom:16,lineHeight:1.6}}>The Governance Concierge uses Claude to answer governance questions, explain compliance requirements and assist with project registration. Your key is stored in your browser only.</p>
          <div className="form-group">
            <label className="form-label">Anthropic API key</label>
            <input className="form-input" type="password" placeholder="sk-ant-..." value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()} />
            <div style={{fontSize:10,color:"var(--g500)",marginTop:4}}>Get your key at console.anthropic.com</div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button className="btn btn-org" onClick={save}>{saved?"Saved":"Save API key"}</button>
            {hasKey && <button className="btn btn-ghost" onClick={clear}>Clear</button>}
          </div>
        </div>
      </div>
      <div className="card" style={{maxWidth:580,marginTop:16}}>
        <div className="card-head">
          <h3>Company context</h3>
          {ctxSavedAt && <span style={{fontSize:11,color:"var(--g500)"}}>Saved {new Date(ctxSavedAt).toLocaleString()}</span>}
        </div>
        <div className="card-body">
          <p style={{fontSize:12,color:"var(--g700)",marginBottom:12,lineHeight:1.6}}>This text is automatically included in every AI agent prompt across every project. Use it to record verified company facts (licences, entities, contacts) so agents do not re-raise questions that already have known answers.</p>
          {ctxLoading ? <div style={{fontSize:12,color:"var(--g400)"}}>Loading...</div> : (
            <>
              <textarea className="form-input" rows={16} value={ctxContent} onChange={e=>setCtxContent(e.target.value)} style={{fontFamily:"monospace",fontSize:12,lineHeight:1.6}} />
              <div style={{marginTop:12,display:"flex",justifyContent:"flex-end"}}>
                <button className="btn btn-org" onClick={saveContext} disabled={ctxSaving}>{ctxSaving?"Saving...":"Save"}</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="card" style={{maxWidth:580,marginTop:16}}>
        <div className="card-head"><h3>Platform information</h3></div>
        <div className="card-body">
          {[["Version","1.0.0"],["Project ID","DOT-2026-0001"],["Business owner","Herman Stoltz"],["Repository","stoltzherman-hue/dotsure-build-harness"],["Database","guwqrtxfnymhmrgqgavx"],["Environment","Development"]].map(([l,v])=>(
            <div key={l} style={{display:"flex",padding:"7px 0",borderBottom:"1px solid var(--g50)"}}>
              <span style={{fontSize:11,color:"var(--g500)",width:150,flexShrink:0}}>{l}</span>
              <span style={{fontSize:12,fontWeight:600,color:"var(--g900)"}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}