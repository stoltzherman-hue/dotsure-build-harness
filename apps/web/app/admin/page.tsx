"use client"
import { useState, useEffect } from "react"

export default function Admin() {
  const [key, setKey] = useState("")
  const [saved, setSaved] = useState(false)
  const [hasKey, setHasKey] = useState(false)

  useEffect(() => {
    const k = localStorage.getItem("harness_anthropic_key")
    if (k) { setHasKey(true); setKey(k) }
  }, [])

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