"use client"
import { useState, useRef, useEffect } from "react"

interface Msg { role:"user"|"assistant"; content:string }

const SYS = `You are the Governance Concierge for the Dotsure AI Build Harness. Help staff understand SA insurance regulation (POPIA, FAIS, PPR/TCF, Insurance Act), AI governance controls, risk tiers, compliance requirements, and how to use this platform. Be concise, accurate, and practical. When unsure, say so.`

export function Concierge() {
    const [open, setOpen] = useState(false)
    const [msgs, setMsgs] = useState<Msg[]>([{role:"assistant",content:"Hi! Ask me anything about governance, compliance, risk tiers, or how to use this platform."}])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [apiError, setApiError] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

  useEffect(()=>{ref.current?.scrollIntoView({behavior:"smooth"})},[msgs,open])

  const send = async () => {
        const text = input.trim()
        if(!text||loading) return
        setApiError(false)
        setMsgs(m=>[...m,{role:"user",content:text}])
        setInput("")
        setLoading(true)
        try {
                const res = await fetch("/api/concierge",{
                          method:"POST",
                          headers:{"Content-Type":"application/json"},
                          body:JSON.stringify({
                                      model:"claude-haiku-4-5-20251001",
                                      max_tokens:1000,
                                      system:SYS,
                                      messages:[...msgs,{role:"user",content:text}].slice(-10),
                          }),
                })
                const d = await res.json()
                if(!res.ok){
                          setApiError(true)
                          setMsgs(m=>[...m,{role:"assistant",content:`Error: ${d.error ?? "Could not reach AI service."}`}])
                } else {
                          setMsgs(m=>[...m,{role:"assistant",content:d.content?.[0]?.text||"Could not process that."}])
                }
        } catch {
                setApiError(true)
                setMsgs(m=>[...m,{role:"assistant",content:"Connection error. Check that the server is running."}])
        }
        setLoading(false)
  }

  return (
        <>
          {open&&(
                  <div style={{position:"fixed",bottom:80,right:20,width:340,background:"var(--wh)",borderRadius:16,boxShadow:"0 8px 40px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column",maxHeight:480,zIndex:1000}}>
                            <div style={{background:"var(--g900)",padding:"12px 14px",display:"flex",alignItems:"center",gap:10,borderRadius:"16px 16px 0 0"}}>
                                        <div style={{width:8,height:8,borderRadius:"50%",background:"var(--org)"}}></div>div>
                                        <span style={{color:"white",fontSize:12,fontWeight:600,flex:1}}>Governance Concierge</span>span>
                                        <button onClick={()=>setOpen(false)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.6)",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>button>
                            </div>div>
                            <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:8}}>
                              {msgs.map((m,i)=>(
                                  <div key={i} style={{padding:"8px 10px",borderRadius:8,fontSize:11,lineHeight:1.6,maxWidth:"90%",alignSelf:m.role==="user"?"flex-end":"flex-start",background:m.role==="user"?"var(--org)":"var(--g50)",color:m.role==="user"?"white":"var(--g900)"}}>
                                    {m.content}
                                  </div>div>
                                ))}
                              {loading&&<div style={{fontSize:11,color:"var(--g400)",fontStyle:"italic"}}>Thinking...</div>div>}
                              {apiError&&<div style={{fontSize:10,color:"#dc2626",padding:"4px 8px",background:"#fef2f2",borderRadius:6}}>AI service unavailable. Ensure ANTHROPIC_API_KEY is set in Vercel environment variables.</div>div>}
                                        <div ref={ref}/>
                            </div>div>
                            <div style={{padding:"8px 10px",borderTop:"1px solid var(--g100)",display:"flex",gap:6}}>
                                        <input
                                                        style={{flex:1,fontSize:11,padding:"6px 10px",border:"1px solid var(--g200)",borderRadius:8,outline:"none"}}
                                                        placeholder="Ask about governance, compliance..."
                                                        value={input}
                                                        onChange={e=>setInput(e.target.value)}
                                                        onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}
                                                        disabled={loading}
                                                      />
                                        <button onClick={send} disabled={loading||!input.trim()} style={{background:"var(--org)",border:"none",color:"white",borderRadius:8,padding:"6px 12px",fontSize:11,cursor:"pointer",fontWeight:600,opacity:loading||!input.trim()?0.5:1}}>
                                                      Send
                                        </button>button>
                            </div>div>
                  </div>div>
              )}
              <button
                        onClick={()=>setOpen(v=>!v)}
                        style={{position:"fixed",bottom:20,right:20,width:52,height:52,borderRadius:"50%",background:"var(--g900)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",zIndex:1000}}
                        title="Governance Concierge"
                      >
                      <svg viewBox="0 0 24 24" style={{width:22,height:22,stroke:"white",fill:"none",strokeWidth:2,strokeLinecap:"round"}}>
                                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                      </svg>svg>
              </button>button>
        </>>
      )
}</>
