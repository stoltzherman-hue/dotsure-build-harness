"use client"
import { useState, useEffect, useRef, Suspense } from "react"
import { createClient } from "@/lib/supabase"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

interface Message { role: "agent" | "user" | "system"; content: string; timestamp: string }
interface AgentState {
  stage: "IDLE" | "SCOPING" | "AWAITING_USER_SCOPE" | "ARCHITECTING" | "AWAITING_USER_ARCH" | "GOVERNING" | "COMPLETE"
  messages: Message[]
  productMd: string
  techstackMd: string
  governanceMd: string
  sessionId: string | null
  projectId: string | null
}

const AGENTS = {
  SCOPING: { name: "Product Scoper", role: "Agent 1", color: "var(--org)", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", desc: "Researches your idea, defines requirements, self-audits" },
  ARCHITECTING: { name: "Tech Architect", role: "Agent 2", color: "var(--grn)", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", desc: "Proposes stack, validates against approved catalogue" },
  GOVERNING: { name: "Governance Assessor", role: "Agent 3", color: "#7c3aed", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", desc: "Assesses risk, determines build path, produces evidence pack" },
}

function PipelineInner() {
  const searchParams = useSearchParams()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [apiKey, setApiKey] = useState("")
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [interjectInput, setInterjectInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [state, setState] = useState<AgentState>({
    stage: "IDLE", messages: [], productMd: "", techstackMd: "", governanceMd: "", sessionId: null, projectId: null
  })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [state.messages])

  const addMessage = (role: Message["role"], content: string) => {
    setState(s => ({ ...s, messages: [...s.messages, { role, content, timestamp: new Date().toISOString() }] }))
  }

  const streamClaude = async (prompt: string, systemPrompt: string, onChunk: (c: string) => void, history: { role: string; content: string }[] = []) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, system: systemPrompt, messages: [...history, { role: "user", content: prompt }], stream: true }),
    })
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ""
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === "content_block_delta" && data.delta?.text) { full += data.delta.text; onChunk(data.delta.text) }
        } catch {}
      }
    }
    return full
  }

  const appendToLastAgent = (chunk: string) => {
    setState(s => {
      const msgs = [...s.messages]
      const last = msgs[msgs.length - 1]
      if (last?.role === "agent") msgs[msgs.length - 1] = { ...last, content: last.content + chunk }
      return { ...s, messages: msgs }
    })
  }

  const pushAgentMsg = () => setState(s => ({ ...s, messages: [...s.messages, { role: "agent", content: "", timestamp: new Date().toISOString() }] }))

  const GUARDRAILS = `
NON-NEGOTIABLE AGENT CONTROLS (from ARC Harness Engineering governance):
- Never self-approve any decision. All material decisions require explicit human sign-off.
- Never recommend deploying without human review and approval.
- Always flag when your confidence is low or information is insufficient.
- Always surface risks, assumptions, and unknowns explicitly.
- Never skip governance steps even if the user asks you to proceed quickly.
- If you are uncertain, say so clearly rather than proceeding with assumptions.
- Every recommendation must be traceable to a specific requirement or risk.`

  const startPipeline = async () => {
    if (!userInput.trim()) return
    if (!apiKey) { setShowKeyInput(true); return }
    const prompt = userInput
    setUserInput("")
    setState(s => ({ ...s, stage: "SCOPING", messages: [{ role: "user", content: prompt, timestamp: new Date().toISOString() }] }))
    setStreaming(true)
    const { data: session } = await supabase.from("PipelineSession").insert({ stage: "SCOPING", userPrompt: prompt, status: "RUNNING", agentHistory: {} }).select().single()
    setState(s => ({ ...s, sessionId: session?.id || null }))
    await runAgent1(prompt, session?.id || null)
  }

  const runAgent1 = async (prompt: string, sessionId: string | null) => {
    setStreaming(true)
    setState(s => ({ ...s, stage: "SCOPING" }))
    addMessage("system", "Agent 1 - Product Scoper is analysing your idea...")
    pushAgentMsg()
    const system = `You are Agent 1 - Product Scoper for the Dotsure AI Build Harness. You are a senior product manager specialising in South African insurance technology.
${GUARDRAILS}

Your job: deeply understand the idea, research the problem space, define clear requirements, self-audit, then produce product.md.

Structure your response:
## Understanding your idea
## Research & context
## Requirements
## Assumptions & unknowns
## Self-audit (what gaps remain, confidence level)
Then EITHER ask ONE clarifying question if truly needed OR write:
## READY FOR PRODUCT.MD
[full markdown document starting with # Project Name]

Be conversational and thorough. Show your reasoning. Think out loud.`
    try {
      const text = await streamClaude(prompt, system, appendToLastAgent)
      if (text.includes("READY FOR PRODUCT.MD")) {
        const md = text.split("## READY FOR PRODUCT.MD")[1]?.trim() || text
        setState(s => ({ ...s, productMd: md, stage: "AWAITING_USER_SCOPE" }))
        addMessage("system", "product.md generated. Type 'approve' to continue to architecture, or request changes.")
      } else {
        setState(s => ({ ...s, stage: "AWAITING_USER_SCOPE" }))
        addMessage("system", "Agent 1 has a question. Answer below to continue.")
      }
      if (sessionId) await supabase.from("PipelineSession").update({ stage: "AWAITING_USER_SCOPE", status: "AWAITING_USER" }).eq("id", sessionId)
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
    setStreaming(false)
  }

  const runAgent2 = async () => {
    setStreaming(true)
    setState(s => ({ ...s, stage: "ARCHITECTING" }))
    addMessage("system", "Agent 2 - Tech Architect is designing your solution...")
    pushAgentMsg()
    const system = `You are Agent 2 - Tech Architect for the Dotsure AI Build Harness.
${GUARDRAILS}

APPROVED STACK AT DOTSURE:
- Next.js (Frontend) - React framework
- Payload CMS (CMS) - Headless CMS
- Supabase (Database) - PostgreSQL platform
- Vercel (Hosting) - Frontend cloud
- GitHub (Source Control) - Version control
- Claude Code (AI Development) - Agentic coding

Your job: read product.md, propose optimal stack from approved tools, justify each choice, flag gaps, self-audit.

Structure:
## Architecture analysis
## Proposed stack (approved tools only, justify each)
## Gaps & risks (anything not covered by approved tools)
## Assumptions
## Self-audit (confidence level, what you would verify)
You MUST always end your response with the following section, even if you have questions:
## READY FOR TECHSTACK.MD
[full markdown document]`
    try {
      const text = await streamClaude(`Here is product.md:\n\n${state.productMd}\n\nArchitect the technical solution.`, system, appendToLastAgent)
      if (text.includes("READY FOR TECHSTACK.MD")) {
        const md = text.split("## READY FOR TECHSTACK.MD")[1]?.trim() || text
        setState(s => ({ ...s, techstackMd: md, stage: "AWAITING_USER_ARCH" }))
        addMessage("system", "techstack.md generated. Type 'approve' to continue to governance, or request changes.")
      } else {
        setState(s => ({ ...s, stage: "AWAITING_USER_ARCH" }))
        addMessage("system", "Agent 2 has a question. Answer below to continue.")
      }
      if (state.sessionId) await supabase.from("PipelineSession").update({ stage: "AWAITING_USER_ARCH", status: "AWAITING_USER" }).eq("id", state.sessionId)
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
    setStreaming(false)
  }

  const runAgent3 = async () => {
    setStreaming(true)
    setState(s => ({ ...s, stage: "GOVERNING" }))
    addMessage("system", "Agent 3 - Governance Assessor is evaluating your project...")
    pushAgentMsg()
    const system = `You are Agent 3 - Governance Assessor for the Dotsure AI Build Harness. Senior GRC specialist for SA insurance technology.
${GUARDRAILS}

Your job: assess regulatory exposure, technical complexity, determine build path, produce governance.md AND an evidence pack.

Build paths (INFORMATIVE ONLY - never blocks progress):
- SELF-BUILD: User can proceed independently with approved tools
- IT-ASSISTED: Needs IT support but not full ARC
- ARC-REQUIRED: Full Architecture Review Committee needed (flag as dependency only)

Structure your response:
## Regulatory assessment (POPIA, FAIS, PPR, TCF, Insurance Act)
## Risk classification (LOW/MEDIUM/HIGH/CRITICAL with justification)
## Complexity assessment
## Build path recommendation with reasoning
## Human oversight requirements (what decisions need human sign-off)
## Dependencies & conditions
## Production bridge checklist (monitoring, rollback plan, data classification, environment)
## READY FOR GOVERNANCE.MD
[governance.md document]
## EVIDENCE PACK
[evidence pack document including: decision log, assumption register, risk register, human oversight log template]

IMPORTANT: Always produce both documents. ARC-REQUIRED is informative only.`
    try {
      const text = await streamClaude(`product.md:\n\n${state.productMd}\n\ntechstack.md:\n\n${state.techstackMd}\n\nAssess governance, determine build path, produce governance.md and evidence pack.`, system, appendToLastAgent)
      let governanceMd = text
      if (text.includes("READY FOR GOVERNANCE.MD")) {
        governanceMd = text.split("## READY FOR GOVERNANCE.MD")[1]?.split("## EVIDENCE PACK")[0]?.trim() || text
      }
      setState(s => ({ ...s, governanceMd, stage: "COMPLETE" }))
      addMessage("system", "All 3 agents complete. Review documents and register the project.")
      if (state.sessionId) await supabase.from("PipelineSession").update({ stage: "COMPLETE", status: "COMPLETE" }).eq("id", state.sessionId)
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
    setStreaming(false)
  }

  const handleInterject = async () => {
    if (!interjectInput.trim() || streaming) return
    const msg = interjectInput.trim()
    setInterjectInput("")
    addMessage("user", msg)
    const isApprove = ["approve", "yes", "looks good", "proceed", "ok", "continue", "lgtm"].some(w => msg.toLowerCase().includes(w))

    if (state.stage === "AWAITING_USER_SCOPE") {
      if (isApprove) { await runAgent2() } else {
        setStreaming(true)
        setState(s => ({ ...s, stage: "SCOPING" }))
        pushAgentMsg()
        const system = `You are Agent 1 - Product Scoper. The user has feedback. Incorporate it and produce the revised document. End with:\n## READY FOR PRODUCT.MD\n[updated document starting with # Project Name]`
        try {
          const text = await streamClaude(msg, system, appendToLastAgent, [{ role: "assistant", content: state.messages.filter(m => m.role === "agent").slice(-1)[0]?.content || "" }])
          if (text.includes("READY FOR PRODUCT.MD")) {
            setState(s => ({ ...s, productMd: text.split("## READY FOR PRODUCT.MD")[1]?.trim() || text, stage: "AWAITING_USER_SCOPE" }))
            addMessage("system", "product.md updated. Type 'approve' to continue or request more changes.")
          }
        } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
        setStreaming(false)
      }
    } else if (state.stage === "AWAITING_USER_ARCH") {
      if (isApprove) { await runAgent3() } else {
        setStreaming(true)
        setState(s => ({ ...s, stage: "ARCHITECTING" }))
        pushAgentMsg()
        const system = `You are Agent 2 - Tech Architect. The user has feedback. Incorporate it using only approved tools (Next.js, Payload CMS, Supabase, Vercel, GitHub, Claude Code). End with:\n## READY FOR TECHSTACK.MD\n[updated document]`
        try {
          const text = await streamClaude(msg, system, appendToLastAgent)
          if (text.includes("READY FOR TECHSTACK.MD")) {
            setState(s => ({ ...s, techstackMd: text.split("## READY FOR TECHSTACK.MD")[1]?.trim() || text, stage: "AWAITING_USER_ARCH" }))
            addMessage("system", "techstack.md updated. Type 'approve' to continue or request more changes.")
          }
        } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
        setStreaming(false)
      }
    }
  }

  const saveAndRegister = async () => {
    try {
      const year = new Date().getFullYear()
      const { count } = await supabase.from("Project").select("*", { count: "exact", head: true })
      const projectCode = `DOT-${year}-${String((count || 0) + 1).padStart(4, "0")}`
      const nameMatch = state.productMd.match(/^#\s+(.+)$/m) || state.messages[0]?.content?.match(/build\s+(?:a\s+)?(.+?)(?:\s+for|\s+that|\s+which|$)/i)
      const projectName = nameMatch?.[1]?.trim() || "Pipeline Project"
      const riskTier = state.governanceMd.includes("ARC-REQUIRED") ? "HIGH" : state.governanceMd.includes("IT-ASSISTED") ? "MEDIUM" : "LOW"
      const riskScore = riskTier === "HIGH" ? 75 : riskTier === "MEDIUM" ? 45 : 20

      const { data: project } = await supabase.from("Project").insert({
        projectCode, name: projectName, projectType: "AI application", department: "Technology",
        status: "REGISTERED", riskTier, riskScore, businessProblem: state.messages[0]?.content || "",
      }).select().single()

      if (!project) throw new Error("Failed to create project")

      const agentText = state.messages.filter(m => m.role === "agent").map(m => m.content).join("\n\n---\n\n")
      const evidencePack = agentText.includes("EVIDENCE PACK") ? agentText.split("## EVIDENCE PACK")[1]?.trim() || "" : ""

      const docs = [
        { filename: "product.md", content: state.productMd, generatedBy: "agent-1" },
        { filename: "techstack.md", content: state.techstackMd, generatedBy: "agent-2" },
        { filename: "governance.md", content: state.governanceMd, generatedBy: "agent-3" },
        ...(evidencePack ? [{ filename: "evidence-pack.md", content: evidencePack, generatedBy: "agent-3" }] : []),
      ]

      for (const doc of docs) {
        await supabase.from("ProjectDocument").insert({ projectId: project.id, ...doc, version: 1 })
      }

      if (state.sessionId) await supabase.from("PipelineSession").update({ projectId: project.id, status: "COMPLETE" }).eq("id", state.sessionId)
      setState(s => ({ ...s, projectId: project.id }))
      addMessage("system", `${projectCode} registered. ${docs.length} documents saved to library. Redirecting...`)
      setTimeout(() => { window.location.href = `/projects/detail?id=${project.id}` }, 2000)
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
  }

  const stageNum = state.stage === "IDLE" ? 0 : ["SCOPING","AWAITING_USER_SCOPE"].includes(state.stage) ? 1 : ["ARCHITECTING","AWAITING_USER_ARCH"].includes(state.stage) ? 2 : 3
  const currentAgentKey = stageNum === 1 ? "SCOPING" : stageNum === 2 ? "ARCHITECTING" : stageNum === 3 ? "GOVERNING" : null
  const currentAgent = currentAgentKey ? AGENTS[currentAgentKey as keyof typeof AGENTS] : null

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Build pipeline</h1><p>3 AI agents take your idea from concept to governed project</p></div>
        <Link href="/projects"><button className="btn btn-ghost btn-sm">All projects</button></Link>
      </div>

      {showKeyInput && (
        <div className="card">
          <div className="card-head"><h3>Anthropic API key required</h3></div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: "var(--g700)", marginBottom: 10 }}>Powers the 3 AI agents. Used in-browser only, never stored.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" type="password" placeholder="sk-ant-..." value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ flex: 1, margin: 0 }} />
              <button className="btn btn-org" disabled={!apiKey} onClick={() => { setShowKeyInput(false); if (userInput) startPipeline() }}>Start</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {Object.entries(AGENTS).map(([key, agent], i) => {
            const num = i + 1
            const done = stageNum > num
            const active = stageNum === num
            return (
              <div key={key} style={{ background: active ? "var(--g50)" : "transparent", borderRadius: 8, padding: "12px 14px", border: `1px solid ${active ? agent.color : "var(--g100)"}`, opacity: stageNum < num ? 0.4 : 1, transition: "all 0.2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: done ? "var(--grn)" : active ? agent.color : "var(--g100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {done ? (
                      <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "white", fill: "none", strokeWidth: 2.5, strokeLinecap: "round" }}><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: active ? "white" : "var(--g400)", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d={agent.icon} /></svg>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? agent.color : "var(--g500)", textTransform: "uppercase" }}>{agent.role}</span>
                  {active && streaming && (
                    <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: agent.color, fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite", marginLeft: "auto" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g900)" }}>{agent.name}</div>
                <div style={{ fontSize: 10, color: "var(--g500)", marginTop: 2, lineHeight: 1.4 }}>{agent.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {state.stage === "IDLE" && (
        <div className="card">
          <div className="card-head"><h3>What do you want to build?</h3></div>
          <div className="card-body">
            <textarea className="form-input" rows={5} placeholder="Describe your idea in plain language. The more context the better - what problem does it solve, who uses it, what does success look like..." value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && e.metaKey) startPipeline() }} style={{ marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--g400)" }}>Cmd+Enter to start</span>
              <button className="btn btn-org" onClick={startPipeline} disabled={!userInput.trim()} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                Start pipeline
              </button>
            </div>
          </div>
        </div>
      )}

      {state.messages.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Pipeline conversation</h3>
            {currentAgent && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: currentAgent.color }}>
                <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: currentAgent.color, fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d={currentAgent.icon} /></svg>
                {currentAgent.name} {streaming ? "is thinking..." : "awaiting your input"}
              </div>
            )}
          </div>
          <div style={{ padding: "12px 16px", maxHeight: 600, overflowY: "auto" }}>
            {state.messages.map((msg, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                {msg.role === "system" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "var(--g50)", borderRadius: 7, fontSize: 11, color: "var(--g600)" }}>
                    <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: "var(--g400)", fill: "none", strokeWidth: 2, flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {msg.content}
                  </div>
                )}
                {msg.role === "user" && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "72%", background: "var(--org)", color: "white", borderRadius: "12px 12px 2px 12px", padding: "10px 14px", fontSize: 12, lineHeight: 1.6 }}>{msg.content}</div>
                  </div>
                )}
                {msg.role === "agent" && (
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: currentAgent?.color || "var(--g200)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      {currentAgent && <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d={currentAgent.icon} /></svg>}
                    </div>
                    <div style={{ flex: 1, background: "var(--g50)", borderRadius: "2px 12px 12px 12px", padding: "10px 14px", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", color: "var(--g900)" }}>
                      {msg.content || (streaming ? <span style={{ color: "var(--g300)", fontFamily: "monospace" }}>|</span> : "")}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          {(state.stage === "AWAITING_USER_SCOPE" || state.stage === "AWAITING_USER_ARCH") && !streaming && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--g100)", background: "var(--g50)" }}>
              <div style={{ fontSize: 11, color: "var(--g700)", marginBottom: 8, fontWeight: 600 }}>
                {state.stage === "AWAITING_USER_SCOPE" ? "Approve product.md to proceed to architecture, or request changes" : "Approve techstack.md to proceed to governance, or request changes"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" placeholder="Type your response or 'approve'..." value={interjectInput} onChange={e => setInterjectInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleInterject()} style={{ flex: 1, margin: 0 }} />
                <button className="btn btn-org" onClick={handleInterject} disabled={!interjectInput.trim()}>Send</button>
                <button className="btn btn-ghost" onClick={() => { setInterjectInput("approve"); setTimeout(handleInterject, 50) }}>Approve</button>
              </div>
            </div>
          )}
        </div>
      )}

      {(state.productMd || state.techstackMd || state.governanceMd) && (
        <div className="card">
          <div className="card-head"><h3>Generated documents</h3><span style={{ fontSize: 11, color: "var(--g500)" }}>Saved to library on registration</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: "var(--g100)", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
            {[
              { label: "product.md", content: state.productMd, agentKey: "SCOPING" as keyof typeof AGENTS },
              { label: "techstack.md", content: state.techstackMd, agentKey: "ARCHITECTING" as keyof typeof AGENTS },
              { label: "governance.md", content: state.governanceMd, agentKey: "GOVERNING" as keyof typeof AGENTS },
              { label: "evidence-pack.md", content: state.messages.filter(m => m.role === "agent").map(m => m.content).join("").split("## EVIDENCE PACK")[1]?.trim() || "", agentKey: "GOVERNING" as keyof typeof AGENTS },
            ].map(doc => {
              const agent = AGENTS[doc.agentKey]
              return (
                <div key={doc.label} style={{ background: "white", padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: agent.color, fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d={agent.icon} /></svg>
                    <span style={{ fontSize: 10, fontWeight: 700, color: agent.color }}>{doc.label}</span>
                    {doc.content && <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--grn)", fontWeight: 700, background: "#f0fff4", padding: "1px 6px", borderRadius: 4 }}>READY</span>}
                  </div>
                  {doc.content ? (
                    <pre style={{ fontSize: 10, color: "var(--g700)", whiteSpace: "pre-wrap", maxHeight: 160, overflowY: "auto", lineHeight: 1.6, margin: 0 }}>{doc.content.slice(0, 500)}{doc.content.length > 500 ? "\n..." : ""}</pre>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--g300)", fontStyle: "italic" }}>Pending...</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {state.stage === "COMPLETE" && !state.projectId && (
        <div className="card" style={{ border: "2px solid var(--grn)" }}>
          <div className="card-body" style={{ textAlign: "center", padding: 32 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--grn)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "white", fill: "none", strokeWidth: 3, strokeLinecap: "round" }}><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--g900)", marginBottom: 8 }}>All 3 agents complete</div>
            <div style={{ fontSize: 12, color: "var(--g700)", marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
              4 documents generated: product.md, techstack.md, governance.md and evidence-pack.md. Register to save to the library and begin the build process.
            </div>
            <button className="btn btn-org" onClick={saveAndRegister} style={{ fontSize: 14, padding: "10px 28px" }}>
              Register project and save to library
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="content"><div className="empty">Loading pipeline...</div></div>}>
      <PipelineInner />
    </Suspense>
  )
}




