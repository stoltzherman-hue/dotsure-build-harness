"use client"
import { useState, useRef, useEffect } from "react"

interface Msg { role:"user"|"assistant"; content:string }

const SYS = `You are the Governance Concierge for the Dotsure AI Build Harness. Help staff understand SA insurance governance: POPIA, FAIS, PPR, TCF, Insurance Act. Risk tiers: Low 0-25, Medium 26-50, High 51-75, Critical 76-100. Be concise and plain-language. Never give legal advice.`

export function Concierge() {
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{role:"assistant",content:"Hi Herman. Ask me anything about governance, risk tiers, compliance requirements or approval workflows."}])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [noKey, setNoKey] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"})},[msgs,open])

  const send = async () => {
    const text = input.trim()
    if(!text||loading) return
    const k = localStorage.getItem("harness_anthropic_key")
    if(!k){setNoKey(true);return}
    setNoKey(false)
    setMsgs(m=>[...m,{role:"user",content:text}])
    setInput("")
    setLoading(true)
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1024,system:SYS,messages:[...msgs,{role:"user",content:text}]})})
      const d = await res.json()
      setMsgs(m=>[...m,{role:"assistant",content:d.content?.[0]?.text||"Could not process that."}])
    } catch {
      setMsgs(m=>[...m,{role:"assistant",content:"Connection error. Check your API key in Admin > Settings."}])
    }
    setLoading(false)
  }

  return (
    <>
      {open&&(
        <div style={{position:"fixed",bottom:80,right:20,width:340,background:"var(--wh)",borderRadius:12,border:"1px solid var(--g100)",boxShadow:"0 8px 32px rgba(34,40,45,0.16)",zIndex:999,display:"flex",flexDirection:"column",maxHeight:520,overflow:"hidden"}}>
          <div style={{background:"var(--g900)",padding:"12px 14px",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:"var(--org)"}}></div>
            <span style={{color:"white",fontSize:12,fontWeight:600,flex:1}}>Governance Concierge</span>
            <button onClick={()=>setOpen(false)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.4)",fontSize:18,cursor:"pointer"}}>×</button>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{padding:"8px 10px",borderRadius:8,fontSize:11,lineHeight:1.6,maxWidth:"88%",whiteSpace:"pre-wrap",alignSelf:m.role==="user"?"flex-end":"flex-start",background:m.role==="user"?"var(--org)":"var(--g50)",color:m.role==="user"?"white":"var(--g900)"}}>{m.content}</div>
            ))}
            {loading&&<div style={{alignSelf:"flex-start",padding:"8px 10px",borderRadius:8,fontSize:11,background:"var(--g50)",color:"var(--g500)"}}>Thinking...</div>}
            {noKey&&<div style={{alignSelf:"flex-start",padding:"8px 10px",borderRadius:8,fontSize:11,background:"var(--red-lt)",color:"var(--red-dk)"}}>No API key. Go to <strong>Admin → Settings</strong> to add your Anthropic key.</div>}
            <div ref={ref}/>
          </div>
          <div style={{padding:10,borderTop:"1px solid var(--g100)",display:"flex",gap:6,flexShrink:0}}>
            <input style={{flex:1,padding:"7px 10px",border:"1.5px solid var(--g200)",borderRadius:7,fontSize:11,fontFamily:"inherit"}} placeholder="Ask about governance..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} disabled={loading}/>
            <button onClick={send} disabled={loading||!input.trim()} style={{background:"var(--org)",border:"none",borderRadius:7,padding:"7px 12px",color:"white",fontSize:11,fontWeight:600,cursor:"pointer",opacity:loading||!input.trim()?0.5:1}}>Send</button>
          </div>
        </div>
      )}
      <button onClick={()=>setOpen(o=>!o)} style={{position:"fixed",bottom:20,right:20,width:50,height:50,borderRadius:"50%",background:open?"var(--g900)":"var(--org)",border:"none",cursor:"pointer",boxShadow:"0 4px 14px rgba(255,135,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,transition:"all 0.2s"}} aria-label="Governance Concierge">
        {open?<svg viewBox="0 0 24 24" style={{width:20,height:20,stroke:"white",fill:"none",strokeWidth:2.5,strokeLinecap:"round"}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>:<svg viewBox="0 0 24 24" style={{width:20,height:20,stroke:"white",fill:"none",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
      </button>
    </>
  )
}