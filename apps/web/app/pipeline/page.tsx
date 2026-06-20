"use client"
import { useState, useEffect, useRef, Suspense } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
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
  SCOPING:      { name: "Product Scoper",      role: "Agent 1", color: "var(--org)", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",                             desc: "Researches your idea, defines requirements, self-audits",      model: "claude-haiku-4-5-20251001",  modelLabel: "Haiku 4.5 — fast" },
  ARCHITECTING: { name: "Tech Architect",      role: "Agent 2", color: "var(--grn)", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",                 desc: "Proposes stack, validates against approved catalogue",         model: "claude-sonnet-4-6",          modelLabel: "Sonnet 4.6 — balanced" },
  GOVERNING:    { name: "Governance Assessor", role: "Agent 3", color: "#7c3aed",    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",                             desc: "Assesses risk, determines build path, produces evidence pack", model: "claude-sonnet-4-6",          modelLabel: "Sonnet 4.6 — balanced" },
}

const MODEL_COSTS: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "claude-haiku-4-5-20251001": { inputPer1M: 0.80, outputPer1M: 4.00 },
  "claude-sonnet-4-6":         { inputPer1M: 3.00, outputPer1M: 15.00 },
}

const INJECTION_PATTERNS = [
  /ignore (previous|all|above) instructions/i,
  /you are now/i,
  /jailbreak/i,
  /pretend you (are|have no)/i,
  /disregard (your|the) (system|instructions)/i,
  /act as (a|an) (different|unrestricted)/i,
  /bypass (safety|filter|guardrail)/i,
]

const OUTPUT_SCAN_PATTERNS = [
  { re: /\b(eval\s*\(|system\s*\(|rm\s+-rf|DROP\s+TABLE|DELETE\s+FROM)/i, reason: "Potential code injection in output" },
  { re: /as an ai (language model|assistant), i (cannot|will not)/i, reason: "Agent broke character / refusal loop" },
  { re: /\b(password|api.?key|secret|token)\s*[:=]\s*["']?\w{8,}/i, reason: "Possible credential leakage in output" },
]

const LIFECYCLE_STAGES = [
  { key: "intent",        label: "Intent",        hint: "What problem are we solving?" },
  { key: "research",      label: "Research",      hint: "Problem space explored?" },
  { key: "spec",          label: "Spec",          hint: "Idea documented?" },
  { key: "governance",    label: "Governance",    hint: "Risk tier pre-assessed?" },
  { key: "design",        label: "Design",        hint: "User flow / mockup exists?" },
  { key: "architecture",  label: "Architecture",  hint: "Tech approach discussed?" },
  { key: "orchestration", label: "Orchestration", hint: "Agent plan confirmed?" },
]

function computeScorecard(productMd: string, techstackMd: string, governanceMd: string) {
  const combined = [productMd, techstackMd, governanceMd].join("\n").toLowerCase()
  const sections = ["requirements", "assumptions", "risk", "architecture", "regulatory", "build path", "compliance"]
  const found = sections.filter(s => combined.includes(s)).length
  const completeness = Math.round((found / sections.length) * 100)
  const assumptions = (combined.match(/assumption/g) || []).length
  const risks = (combined.match(/\brisk\b/g) || []).length
  const lowConf = combined.includes("low confidence") || combined.includes("uncertain") || combined.includes("unclear")
  const arcRequired = combined.includes("arc-required")
  const overallScore = Math.min(100, Math.round(completeness * 0.5 + Math.min(assumptions * 4, 25) + Math.min(risks * 2, 25)))
  return { completeness, assumptions, risks, lowConf, arcRequired, overallScore }
}

function AutoProgressStep({ label, status, color }: { label: string; status: "waiting" | "running" | "done"; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: status === "done" ? "var(--grn)" : status === "running" ? color : "var(--g100)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.4s",
        boxShadow: status === "running" ? `0 0 0 4px ${color}22` : "none",
      }}>
        {status === "done" ? (
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "white", fill: "none", strokeWidth: 3, strokeLinecap: "round" }}><polyline points="20 6 9 17 4 12" /></svg>
        ) : status === "running" ? (
          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "white", fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>
        ) : (
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--g300)" }} />
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: status === "waiting" ? "var(--g400)" : "var(--g900)" }}>{label}</div>
        <div style={{ fontSize: 11, color: status === "running" ? color : "var(--g400)", marginTop: 1 }}>
          {status === "done" ? "Complete" : status === "running" ? "Running..." : "Waiting"}
        </div>
      </div>
    </div>
  )
}

function PipelineInner() {
  const { profile } = useAuth()
  const supabase = createClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [userInput, setUserInput] = useState("")
  const [interjectInput, setInterjectInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [mode, setMode] = useState<"MANUAL" | "AUTO" | null>(null)
  const [autoStatus, setAutoStatus] = useState<"idle" | "running" | "saving" | "done">("idle")
  const [autoLog, setAutoLog] = useState<string[]>([])
  const [lifecycle, setLifecycle] = useState<Record<string, boolean>>({})
  const [showLifecycle, setShowLifecycle] = useState(false)
  const [guardrailWarning, setGuardrailWarning] = useState<string | null>(null)
  const [sessionRunCost, setSessionRunCost] = useState(0)
  const [showMemoryPrompt, setShowMemoryPrompt] = useState(false)
  const [state, setState] = useState<AgentState>({
    stage: "IDLE", messages: [], productMd: "", techstackMd: "", governanceMd: "", sessionId: null, projectId: null
  })

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [state.messages])

  const addMessage = (role: Message["role"], content: string) =>
    setState(s => ({ ...s, messages: [...s.messages, { role, content, timestamp: new Date().toISOString() }] }))

  const appendAutoLog = (msg: string) => setAutoLog(l => [...l, msg])

  // ─── GUARDRAILS ────────────────────────────────────────────────────────────

  const checkGuardrails = (input: string): string | null => {
    for (const p of INJECTION_PATTERNS) {
      if (p.test(input)) return `Potential prompt injection detected: matched pattern "${p.source}"`
    }
    return null
  }

  const scanOutput = (text: string): string | null => {
    for (const { re, reason } of OUTPUT_SCAN_PATTERNS) {
      if (re.test(text)) return reason
    }
    return null
  }

  // ─── MEMORY RETRIEVAL ─────────────────────────────────────────────────────

  const scoreMemories = async (prompt: string): Promise<{ type: string; title: string; content: string }[]> => {
    try {
      const sb = createClient()
      const { data } = await sb.from("Memory").select("title, content, type").order("createdAt", { ascending: false }).limit(50)
      if (!data?.length) return []
      const words = prompt.toLowerCase().split(/\W+/).filter(w => w.length > 3)
      return (data as any[])
        .map(m => ({ ...m, score: words.filter(w => (m.title + " " + m.content).toLowerCase().includes(w)).length }))
        .filter(m => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    } catch { return [] }
  }

  const buildMemoryBlock = (memories: { type: string; title: string; content: string }[]) => {
    if (!memories.length) return ""
    return `\n\n## INSTITUTIONAL KNOWLEDGE\nThe following lessons from previous Dotsure projects are relevant to this prompt:\n${memories.map(m => `[${m.type}] ${m.title}: ${m.content}`).join("\n")}`
  }

  // ─── APPROVED STACK: load from Technology table ──────────────────────────

  const loadApprovedStack = async (): Promise<string> => {
    try {
      const { data } = await supabase.from("Technology").select("name, category, description").eq("lifecycleStatus", "Approved")
      if (!data || data.length === 0) throw new Error("empty")
      return data.map((t: any) => `- ${t.name} (${t.category})${t.description ? " - " + t.description.split(".")[0] : ""}`).join("\n")
    } catch {
      return "- Next.js (Dev platform)\n- Payload CMS (CMS)\n- Supabase (Database)\n- Vercel (Dev platform)\n- GitHub (Dev platform)\n- Claude Code (AI tooling)"
    }
  }

  // ─── OBSERVABILITY: log PipelineRun ──────────────────────────────────────

  const logPipelineRun = async (opts: {
    agentName: string; model: string; inputTokens: number; outputTokens: number;
    latencyMs: number; costUsd: number; guardrailFlag: boolean; flagReason?: string
  }) => {
    try {
      const res = await fetch("/api/log-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentName: opts.agentName, model: opts.model,
          inputTokens: opts.inputTokens, outputTokens: opts.outputTokens,
          latencyMs: opts.latencyMs, costUsd: opts.costUsd,
          guardrailFlag: opts.guardrailFlag, flagReason: opts.flagReason || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        appendAutoLog(`⚠ Observability log error: ${err.error}`)
      }
    } catch (e: any) {
      appendAutoLog(`⚠ Observability log failed: ${e.message}`)
    }
  }

  // ─── STREAM CLAUDE (returns tokens + latency) ─────────────────────────────

  const streamClaude = async (
    prompt: string,
    systemPrompt: string,
    onChunk: (c: string) => void,
    history: { role: string; content: string }[] = [],
    model = "claude-sonnet-4-6"
  ): Promise<{ text: string; inputTokens: number; outputTokens: number; latencyMs: number }> => {
    const t0 = Date.now()
    const res = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 4000, system: systemPrompt, messages: [...history, { role: "user", content: prompt }], stream: true }),
    })
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`)
    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    let full = ""
    let inputTokens = 0
    let outputTokens = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === "message_start" && data.message?.usage) {
            inputTokens = data.message.usage.input_tokens || 0
          }
          if (data.type === "message_delta" && data.usage) {
            outputTokens = data.usage.output_tokens || 0
          }
          if (data.type === "content_block_delta" && data.delta?.text) {
            full += data.delta.text
            onChunk(data.delta.text)
          }
        } catch {}
      }
    }
    return { text: full, inputTokens, outputTokens, latencyMs: Date.now() - t0 }
  }

  const calcCost = (model: string, inputTokens: number, outputTokens: number) => {
    const c = MODEL_COSTS[model] || MODEL_COSTS["claude-sonnet-4-6"]
    return (inputTokens / 1_000_000) * c.inputPer1M + (outputTokens / 1_000_000) * c.outputPer1M
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
    const prompt = userInput

    const flag = checkGuardrails(prompt)
    if (flag) {
      setGuardrailWarning(flag)
    } else {
      setGuardrailWarning(null)
    }

    setUserInput("")
    setSessionRunCost(0)

    if (mode === "AUTO") {
      await runAutoPipeline(prompt)
    } else {
      setState(s => ({ ...s, stage: "SCOPING", messages: [{ role: "user", content: prompt, timestamp: new Date().toISOString() }] }))
      setStreaming(true)
      let session: any = null
      try { const { data: s } = await supabase.from("PipelineSession").insert({ stage: "SCOPING", userPrompt: prompt, status: "RUNNING", agentHistory: {} }).select().single(); session = s } catch {}
      setState(s => ({ ...s, sessionId: session?.id || null }))
      await runAgent1(prompt, session?.id || null)
    }
  }

  // ─── AUTO MODE ──────────────────────────────────────────────────────────────

  const runAutoPipeline = async (prompt: string) => {
    setAutoStatus("running")
    setAutoLog([])
    setState(s => ({ ...s, stage: "SCOPING", messages: [{ role: "user", content: prompt, timestamp: new Date().toISOString() }] }))

    let session: any = null
    try { const { data: s } = await supabase.from("PipelineSession").insert({ stage: "SCOPING", userPrompt: prompt, status: "RUNNING", agentHistory: {} }).select().single(); session = s } catch {}
    setState(s => ({ ...s, sessionId: session?.id || null }))

    // Retrieve relevant memories for context
    const memories = await scoreMemories(prompt)
    const memBlock = buildMemoryBlock(memories)
    if (memories.length) appendAutoLog(`↑ ${memories.length} institutional memory match${memories.length > 1 ? "es" : ""} injected`)

    appendAutoLog("Agent 1 - Product Scoper starting...")
    pushAgentMsg()
    const system1 = `You are Agent 1 - Product Scoper for the Dotsure AI Build Harness. Senior product manager specialising in South African insurance technology.
${GUARDRAILS}${memBlock}

Your job: deeply understand the idea, research the problem space, define clear requirements, self-audit, produce product.md.

Structure your response:
## Understanding your idea
## Research & context
## Requirements
## Assumptions & unknowns
## Self-audit (what gaps remain, confidence level)
## READY FOR PRODUCT.MD
[full markdown document starting with # Project Name]

Always end with the READY FOR PRODUCT.MD section with the full document.`

    let productMd = ""
    try {
      const r1 = await streamClaude(prompt, system1, appendToLastAgent, [], AGENTS.SCOPING.model)
      const cost1 = calcCost(AGENTS.SCOPING.model, r1.inputTokens, r1.outputTokens)
      setSessionRunCost(c => c + cost1)
      const outputFlag = scanOutput(r1.text)
      await logPipelineRun({ agentName: "Product Scoper", model: AGENTS.SCOPING.model, inputTokens: r1.inputTokens, outputTokens: r1.outputTokens, latencyMs: r1.latencyMs, costUsd: cost1, guardrailFlag: !!outputFlag, flagReason: outputFlag || undefined })
      appendAutoLog(`✓ product.md — ${r1.inputTokens}in/${r1.outputTokens}out tokens · $${cost1.toFixed(4)} · ${(r1.latencyMs/1000).toFixed(1)}s`)
      if (outputFlag) { appendAutoLog(`⚠ Output scan: ${outputFlag}`); setGuardrailWarning(outputFlag) }
      if (r1.text.includes("READY FOR PRODUCT.MD")) {
        productMd = r1.text.split("## READY FOR PRODUCT.MD")[1]?.trim() || r1.text
      } else { productMd = r1.text }
      setState(s => ({ ...s, productMd, stage: "ARCHITECTING" }))
    } catch (e: any) {
      appendAutoLog(`✗ Agent 1 error: ${e.message}`)
      setAutoStatus("idle")
      return
    }

    appendAutoLog("Agent 2 - Tech Architect starting...")
    pushAgentMsg()
    setState(s => ({ ...s, stage: "ARCHITECTING" }))
    const approvedStack2auto = await loadApprovedStack()
    const system2 = `You are Agent 2 - Tech Architect for the Dotsure AI Build Harness.
${GUARDRAILS}${memBlock}

APPROVED STACK AT DOTSURE:
${approvedStack2auto}

Your job: read product.md, propose optimal stack from approved tools, justify each choice, flag gaps, self-audit.

Structure:
## Architecture analysis
## Proposed stack
## Gaps & risks
## Assumptions
## Self-audit
## READY FOR TECHSTACK.MD
[full markdown document]

Always end with READY FOR TECHSTACK.MD.`

    let techstackMd = ""
    try {
      const r2 = await streamClaude(`Here is the product requirements:\n\n${productMd}\n\nArchitect the technical solution.`, system2, appendToLastAgent, [], AGENTS.ARCHITECTING.model)
      const cost2 = calcCost(AGENTS.ARCHITECTING.model, r2.inputTokens, r2.outputTokens)
      setSessionRunCost(c => c + cost2)
      const outputFlag2 = scanOutput(r2.text)
      await logPipelineRun({ agentName: "Tech Architect", model: AGENTS.ARCHITECTING.model, inputTokens: r2.inputTokens, outputTokens: r2.outputTokens, latencyMs: r2.latencyMs, costUsd: cost2, guardrailFlag: !!outputFlag2, flagReason: outputFlag2 || undefined })
      appendAutoLog(`✓ techstack.md — ${r2.inputTokens}in/${r2.outputTokens}out tokens · $${cost2.toFixed(4)} · ${(r2.latencyMs/1000).toFixed(1)}s`)
      if (outputFlag2) { appendAutoLog(`⚠ Output scan: ${outputFlag2}`); setGuardrailWarning(outputFlag2) }
      if (r2.text.includes("READY FOR TECHSTACK.MD")) {
        techstackMd = r2.text.split("## READY FOR TECHSTACK.MD")[1]?.trim() || r2.text
      } else { techstackMd = r2.text }
      setState(s => ({ ...s, techstackMd, stage: "GOVERNING" }))
    } catch (e: any) {
      appendAutoLog(`✗ Agent 2 error: ${e.message}`)
      setAutoStatus("idle")
      return
    }

    appendAutoLog("Agent 3 - Governance Assessor starting...")
    pushAgentMsg()
    setState(s => ({ ...s, stage: "GOVERNING" }))
    const system3 = `You are Agent 3 - Governance Assessor for the Dotsure AI Build Harness. Senior GRC specialist for SA insurance technology.
${GUARDRAILS}${memBlock}

Your job: assess regulatory exposure, technical complexity, determine build path, produce governance.md AND an evidence pack.

Structure:
## Regulatory assessment (POPIA, FAIS, PPR, TCF, Insurance Act)
## Risk classification (LOW/MEDIUM/HIGH/CRITICAL with justification)
## Complexity assessment
## Build path recommendation
## Human oversight requirements
## Dependencies & conditions
## Production bridge checklist
## READY FOR GOVERNANCE.MD
[governance.md document]
## EVIDENCE PACK
[evidence pack document]`

    let governanceMd = ""
    try {
      const r3 = await streamClaude(`product.md:\n\n${productMd}\n\ntechstack.md:\n\n${techstackMd}\n\nAssess governance, determine build path, produce governance.md and evidence pack.`, system3, appendToLastAgent, [], AGENTS.GOVERNING.model)
      const cost3 = calcCost(AGENTS.GOVERNING.model, r3.inputTokens, r3.outputTokens)
      setSessionRunCost(c => c + cost3)
      const outputFlag3 = scanOutput(r3.text)
      await logPipelineRun({ agentName: "Governance Assessor", model: AGENTS.GOVERNING.model, inputTokens: r3.inputTokens, outputTokens: r3.outputTokens, latencyMs: r3.latencyMs, costUsd: cost3, guardrailFlag: !!outputFlag3, flagReason: outputFlag3 || undefined })
      appendAutoLog(`✓ governance.md — ${r3.inputTokens}in/${r3.outputTokens}out tokens · $${cost3.toFixed(4)} · ${(r3.latencyMs/1000).toFixed(1)}s`)
      if (outputFlag3) { appendAutoLog(`⚠ Output scan: ${outputFlag3}`); setGuardrailWarning(outputFlag3) }
      if (r3.text.includes("READY FOR GOVERNANCE.MD")) {
        governanceMd = r3.text.split("## READY FOR GOVERNANCE.MD")[1]?.split("## EVIDENCE PACK")[0]?.trim() || r3.text
      } else { governanceMd = r3.text }
      setState(s => ({ ...s, governanceMd, stage: "COMPLETE" }))
      appendAutoLog("✓ governance.md + evidence pack generated")
    } catch (e: any) {
      appendAutoLog(`✗ Agent 3 error: ${e.message}`)
      setAutoStatus("idle")
      return
    }

    appendAutoLog("Registering project and submitting for approval...")
    setAutoStatus("saving")
    await autoSaveAndSubmit(prompt, productMd, techstackMd, governanceMd, session?.id || null)
  }

  const autoSaveAndSubmit = async (
    prompt: string,
    productMd: string,
    techstackMd: string,
    governanceMd: string,
    sessionId: string | null
  ) => {
    try {
      const sb = createClient()
      const year = new Date().getFullYear()
      const { count } = await sb.from("Project").select("*", { count: "exact", head: true })
      const projectCode = `DOT-${year}-${String((count || 0) + 1).padStart(4, "0")}`
      const nameMatch = productMd.match(/^#\s+(.+)$/m)
      const projectName = nameMatch?.[1]?.trim() || prompt.slice(0, 60) || "AI Pipeline Project"
      const riskTier = governanceMd.includes("CRITICAL") ? "CRITICAL" : governanceMd.includes("ARC-REQUIRED") || governanceMd.includes("HIGH") ? "HIGH" : governanceMd.includes("IT-ASSISTED") || governanceMd.includes("MEDIUM") ? "MEDIUM" : "LOW"
      const riskScore = riskTier === "CRITICAL" ? 90 : riskTier === "HIGH" ? 75 : riskTier === "MEDIUM" ? 45 : 20

      const { data: project } = await sb.from("Project").insert({
        projectCode, name: projectName, projectType: "AI application", department: "Technology",
        status: "REGISTERED", riskTier, riskScore, businessProblem: prompt,
      }).select().single()

      if (!project) throw new Error("Failed to create project")

      const allAgentText = stateRef.current.messages.filter(m => m.role === "agent").map(m => m.content).join("\n\n---\n\n")
      const evidencePack = allAgentText.includes("EVIDENCE PACK") ? allAgentText.split("## EVIDENCE PACK")[1]?.trim() || "" : ""

      const docs = [
        { filename: "product.md", content: productMd || "No content", generatedBy: "agent-1" },
        { filename: "techstack.md", content: techstackMd || "No content", generatedBy: "agent-2" },
        { filename: "governance.md", content: governanceMd || "No content", generatedBy: "agent-3" },
        ...(evidencePack ? [{ filename: "evidence-pack.md", content: evidencePack, generatedBy: "agent-3" }] : []),
      ]
      for (const doc of docs) {
        await sb.from("ProjectDocument").insert({ projectId: project.id, ...doc, version: 1 })
      }

      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        await sb.from("ApprovalRequest").insert({
          projectId: project.id, requestedById: user.id, status: "PENDING",
          notes: `Auto-submitted by AI pipeline agent. Risk tier: ${riskTier}. Project code: ${projectCode}.`,
        })

        const { data: gms } = await sb.from("UserProfile").select("id, email").eq("role", "GM")
        if (gms?.length) {
          await sb.from("Notification").insert(
            gms.map((gm: any) => ({
              userId: gm.id,
              title: "New project pending approval",
              body: `${projectCode} — "${projectName}" was registered automatically by the AI pipeline and is awaiting your review.`,
              type: "APPROVAL_REQUIRED",
              link: `/approvals`,
            }))
          )
          const gmEmails = gms.map((gm: any) => gm.email).filter(Boolean)
          if (gmEmails.length) {
            const isCritical = riskTier === "CRITICAL"
            await fetch("/api/notify-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: gmEmails,
                subject: `${isCritical ? "🚨 CRITICAL — " : ""}Approval required: ${projectCode} ${projectName}`,
                html: `
                  <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
                    <div style="background:#e86c00;color:white;padding:16px 20px;border-radius:8px 8px 0 0;font-weight:700;font-size:18px">
                      Dotsure Build Harness
                    </div>
                    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:24px">
                      ${isCritical ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;padding:12px 16px;margin-bottom:16px;color:#991b1b;font-weight:700">⚠ CRITICAL RISK — ARC approval required before any build activity</div>` : ""}
                      <p style="margin:0 0 8px;color:#111827;font-size:15px">A new AI project requires your approval.</p>
                      <table style="width:100%;border-collapse:collapse;margin:16px 0">
                        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px">Project</td><td style="padding:8px 0;font-weight:600;color:#111827;font-size:13px">${projectCode} — ${projectName}</td></tr>
                        <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Risk tier</td><td style="padding:8px 0;font-weight:700;color:${isCritical ? "#dc2626" : "#92400e"};font-size:13px">${riskTier}</td></tr>
                      </table>
                      <a href="https://dotsure-build-harness.vercel.app/approvals" style="display:inline-block;background:#e86c00;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:13px;margin-top:8px">
                        Review &amp; approve →
                      </a>
                      <p style="margin:20px 0 0;font-size:11px;color:#9ca3af">Sent automatically by the Dotsure AI Build Harness pipeline.</p>
                    </div>
                  </div>`,
              }),
            }).catch(() => {}) // non-blocking
          }
        }
      }

      try { if (sessionId) await sb.from("PipelineSession").update({ projectId: project.id, status: "COMPLETE" }).eq("id", sessionId) } catch {}

      setState(s => ({ ...s, projectId: project.id }))
      appendAutoLog(`✓ ${projectCode} registered — approval request submitted to GM`)
      setAutoStatus("done")
      setShowMemoryPrompt(true)
    } catch (e: any) {
      appendAutoLog(`✗ Save error: ${e.message}`)
      setAutoStatus("idle")
    }
  }

  // ─── MANUAL MODE ─────────────────────────────────────────────────────────────

  const runAgent1 = async (prompt: string, sessionId: string | null) => {
    setStreaming(true)
    setState(s => ({ ...s, stage: "SCOPING" }))
    addMessage("system", "Agent 1 - Product Scoper is analysing your idea...")
    pushAgentMsg()
    const memories = await scoreMemories(prompt)
    const memBlock = buildMemoryBlock(memories)
    const system = `You are Agent 1 - Product Scoper for the Dotsure AI Build Harness. You are a senior product manager specialising in South African insurance technology.
${GUARDRAILS}${memBlock}

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
      const r = await streamClaude(prompt, system, appendToLastAgent, [], AGENTS.SCOPING.model)
      const cost = calcCost(AGENTS.SCOPING.model, r.inputTokens, r.outputTokens)
      setSessionRunCost(c => c + cost)
      const outputFlag = scanOutput(r.text)
      await logPipelineRun({ agentName: "Product Scoper", model: AGENTS.SCOPING.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, latencyMs: r.latencyMs, costUsd: cost, guardrailFlag: !!outputFlag, flagReason: outputFlag || undefined })
      if (outputFlag) setGuardrailWarning(outputFlag)
      if (r.text.includes("READY FOR PRODUCT.MD")) {
        const md = r.text.split("## READY FOR PRODUCT.MD")[1]?.trim() || r.text
        setState(s => ({ ...s, productMd: md, stage: "AWAITING_USER_SCOPE" }))
        addMessage("system", "product.md generated. Type 'approve' to continue to architecture, or request changes.")
      } else {
        setState(s => ({ ...s, stage: "AWAITING_USER_SCOPE" }))
        addMessage("system", "Agent 1 has a question. Answer below to continue.")
      }
      try { if (sessionId) await supabase.from("PipelineSession").update({ stage: "AWAITING_USER_SCOPE", status: "AWAITING_USER" }).eq("id", sessionId) } catch {}
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
    setStreaming(false)
  }

  const runAgent2 = async (productContent: string = "") => {
    setStreaming(true)
    setState(s => ({ ...s, stage: "ARCHITECTING" }))
    addMessage("system", "Agent 2 - Tech Architect is designing your solution...")
    pushAgentMsg()
    const memories = await scoreMemories(productContent || state.productMd)
    const memBlock = buildMemoryBlock(memories)
    const approvedStack2 = await loadApprovedStack()
    const system = `You are Agent 2 - Tech Architect for the Dotsure AI Build Harness.
${GUARDRAILS}${memBlock}

APPROVED STACK AT DOTSURE:
${approvedStack2}
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
      const r = await streamClaude(`Here is the product requirements:\n\n${productContent || state.productMd}\n\nArchitect the technical solution based on these requirements.`, system, appendToLastAgent, [], AGENTS.ARCHITECTING.model)
      const cost = calcCost(AGENTS.ARCHITECTING.model, r.inputTokens, r.outputTokens)
      setSessionRunCost(c => c + cost)
      const outputFlag = scanOutput(r.text)
      await logPipelineRun({ agentName: "Tech Architect", model: AGENTS.ARCHITECTING.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, latencyMs: r.latencyMs, costUsd: cost, guardrailFlag: !!outputFlag, flagReason: outputFlag || undefined })
      if (outputFlag) setGuardrailWarning(outputFlag)
      if (r.text.includes("READY FOR TECHSTACK.MD")) {
        const md = r.text.split("## READY FOR TECHSTACK.MD")[1]?.trim() || r.text
        setState(s => ({ ...s, techstackMd: md, stage: "AWAITING_USER_ARCH" }))
        addMessage("system", "techstack.md generated. Type 'approve' to continue to governance, or request changes.")
      } else {
        setState(s => ({ ...s, stage: "AWAITING_USER_ARCH" }))
        addMessage("system", "Agent 2 has a question. Answer below to continue.")
      }
      try { if (state.sessionId) await supabase.from("PipelineSession").update({ stage: "AWAITING_USER_ARCH", status: "AWAITING_USER" }).eq("id", state.sessionId) } catch {}
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
    setStreaming(false)
  }

  const runAgent3 = async () => {
    setStreaming(true)
    setState(s => ({ ...s, stage: "GOVERNING" }))
    addMessage("system", "Agent 3 - Governance Assessor is evaluating your project...")
    pushAgentMsg()
    const memories = await scoreMemories(state.productMd + " " + state.techstackMd)
    const memBlock = buildMemoryBlock(memories)
    const system = `You are Agent 3 - Governance Assessor for the Dotsure AI Build Harness. Senior GRC specialist for SA insurance technology.
${GUARDRAILS}${memBlock}

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
      const r = await streamClaude(`product.md:\n\n${state.productMd}\n\ntechstack.md:\n\n${state.techstackMd}\n\nAssess governance, determine build path, produce governance.md and evidence pack.`, system, appendToLastAgent, [], AGENTS.GOVERNING.model)
      const cost = calcCost(AGENTS.GOVERNING.model, r.inputTokens, r.outputTokens)
      setSessionRunCost(c => c + cost)
      const outputFlag = scanOutput(r.text)
      await logPipelineRun({ agentName: "Governance Assessor", model: AGENTS.GOVERNING.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, latencyMs: r.latencyMs, costUsd: cost, guardrailFlag: !!outputFlag, flagReason: outputFlag || undefined })
      if (outputFlag) setGuardrailWarning(outputFlag)
      let governanceMd = r.text
      if (r.text.includes("READY FOR GOVERNANCE.MD")) {
        governanceMd = r.text.split("## READY FOR GOVERNANCE.MD")[1]?.split("## EVIDENCE PACK")[0]?.trim() || r.text
      }
      setState(s => ({ ...s, governanceMd, stage: "COMPLETE" }))
      addMessage("system", "All 3 agents complete. Review documents and register the project.")
      try { if (state.sessionId) await supabase.from("PipelineSession").update({ stage: "COMPLETE", status: "COMPLETE" }).eq("id", state.sessionId) } catch {}
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
      if (isApprove) {
        const agent1Text = state.productMd || state.messages.filter(m => m.role === "agent").slice(-1)[0]?.content || ""
        if (!state.productMd) setState(s => ({ ...s, productMd: agent1Text }))
        await runAgent2(agent1Text)
      } else {
        setStreaming(true)
        setState(s => ({ ...s, stage: "SCOPING" }))
        pushAgentMsg()
        const system = `You are Agent 1 - Product Scoper. The user has feedback. Incorporate it and produce the revised document. End with:\n## READY FOR PRODUCT.MD\n[updated document starting with # Project Name]`
        try {
          const r = await streamClaude(msg, system, appendToLastAgent, [{ role: "assistant", content: state.messages.filter(m => m.role === "agent").slice(-1)[0]?.content || "" }])
          const cost = calcCost("claude-sonnet-4-6", r.inputTokens, r.outputTokens)
          setSessionRunCost(c => c + cost)
          await logPipelineRun({ agentName: "Product Scoper (revision)", model: "claude-sonnet-4-6", inputTokens: r.inputTokens, outputTokens: r.outputTokens, latencyMs: r.latencyMs, costUsd: cost, guardrailFlag: false })
          if (r.text.includes("READY FOR PRODUCT.MD")) {
            setState(s => ({ ...s, productMd: r.text.split("## READY FOR PRODUCT.MD")[1]?.trim() || r.text, stage: "AWAITING_USER_SCOPE" }))
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
        const approvedStack2rev = await loadApprovedStack()
        const system = `You are Agent 2 - Tech Architect. The user has feedback. Incorporate it using only approved tools:\n${approvedStack2rev}\nEnd with:\n## READY FOR TECHSTACK.MD\n[updated document]`
        try {
          const r = await streamClaude(msg, system, appendToLastAgent)
          const cost = calcCost("claude-sonnet-4-6", r.inputTokens, r.outputTokens)
          setSessionRunCost(c => c + cost)
          await logPipelineRun({ agentName: "Tech Architect (revision)", model: "claude-sonnet-4-6", inputTokens: r.inputTokens, outputTokens: r.outputTokens, latencyMs: r.latencyMs, costUsd: cost, guardrailFlag: false })
          if (r.text.includes("READY FOR TECHSTACK.MD")) {
            setState(s => ({ ...s, techstackMd: r.text.split("## READY FOR TECHSTACK.MD")[1]?.trim() || r.text, stage: "AWAITING_USER_ARCH" }))
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
        { filename: "product.md", content: state.productMd || "No content", generatedBy: "agent-1" },
        { filename: "techstack.md", content: state.techstackMd || "No content", generatedBy: "agent-2" },
        { filename: "governance.md", content: state.governanceMd || "No content", generatedBy: "agent-3" },
        ...(evidencePack ? [{ filename: "evidence-pack.md", content: evidencePack, generatedBy: "agent-3" }] : []),
      ]
      for (const doc of docs) {
        await supabase.from("ProjectDocument").insert({ projectId: project.id, ...doc, version: 1 })
      }

      try { if (state.sessionId) await supabase.from("PipelineSession").update({ projectId: project.id, status: "COMPLETE" }).eq("id", state.sessionId) } catch {}
      setState(s => ({ ...s, projectId: project.id }))
      addMessage("system", `${projectCode} registered. ${docs.length} documents saved to library. Redirecting...`)
      setTimeout(() => { window.location.href = `/projects/detail?id=${project.id}` }, 2000)
    } catch (e: any) { addMessage("system", `Error: ${e.message}`) }
  }

  const stageNum = state.stage === "IDLE" ? 0 : ["SCOPING","AWAITING_USER_SCOPE"].includes(state.stage) ? 1 : ["ARCHITECTING","AWAITING_USER_ARCH"].includes(state.stage) ? 2 : 3
  const currentAgentKey = stageNum === 1 ? "SCOPING" : stageNum === 2 ? "ARCHITECTING" : stageNum === 3 ? "GOVERNING" : null
  const currentAgent = currentAgentKey ? AGENTS[currentAgentKey as keyof typeof AGENTS] : null

  const autoStep1 = stageNum >= 1 ? (stageNum > 1 ? "done" : "running") : "waiting"
  const autoStep2 = stageNum >= 2 ? (stageNum > 2 ? "done" : "running") : "waiting"
  const autoStep3 = stageNum >= 3 ? (state.stage === "COMPLETE" ? "done" : "running") : "waiting"

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Build pipeline</h1><p>3 AI agents take your idea from concept to governed project</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {sessionRunCost > 0 && (
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g600)", background: "var(--g50)", padding: "4px 10px", borderRadius: 8, border: "1px solid var(--g200)" }}>
              Session cost: ${sessionRunCost.toFixed(4)}
            </div>
          )}
          <Link href="/projects"><button className="btn btn-ghost btn-sm">All projects</button></Link>
        </div>
      </div>

      {/* Guardrail warning — non-blocking banner */}
      {guardrailWarning && (
        <div style={{ padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, marginBottom: 4, display: "flex", alignItems: "center", gap: 10 }}>
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "#dc2626", fill: "none", strokeWidth: 2, flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>Security flag (advisory) — </span>
            <span style={{ fontSize: 12, color: "#7f1d1d" }}>{guardrailWarning}</span>
          </div>
          <button onClick={() => setGuardrailWarning(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626", padding: "0 4px" }}>×</button>
        </div>
      )}


      {/* Lifecycle checklist */}
      {state.stage === "IDLE" && (() => {
        const checked = LIFECYCLE_STAGES.filter(s => lifecycle[s.key]).length
        const pct = Math.round((checked / LIFECYCLE_STAGES.length) * 100)
        return (
          <div className="card">
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setShowLifecycle(v => !v)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--g900)" }}>Pre-flight checklist</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: checked === LIFECYCLE_STAGES.length ? "var(--grn)" : "var(--org)", background: checked === LIFECYCLE_STAGES.length ? "#f0fff4" : "#fff8f0", padding: "2px 8px", borderRadius: 10 }}>
                    {checked}/{LIFECYCLE_STAGES.length} stages
                  </span>
                  <span style={{ fontSize: 10, color: "var(--g500)" }}>Advisory — you can start at any time</span>
                </div>
                <div style={{ height: 3, background: "var(--g100)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: checked === LIFECYCLE_STAGES.length ? "var(--grn)" : "var(--org)", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </div>
              <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "var(--g400)", fill: "none", strokeWidth: 2, transform: showLifecycle ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {showLifecycle && (
              <div style={{ padding: "0 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {LIFECYCLE_STAGES.map(s => (
                  <label key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: lifecycle[s.key] ? "#f0fff4" : "var(--g50)", cursor: "pointer", border: `1px solid ${lifecycle[s.key] ? "#bbf7d0" : "var(--g100)"}` }}>
                    <input type="checkbox" checked={!!lifecycle[s.key]} onChange={e => setLifecycle(l => ({ ...l, [s.key]: e.target.checked }))} style={{ accentColor: "var(--grn)", width: 14, height: 14 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g900)" }}>{s.label}</div>
                      <div style={{ fontSize: 10, color: "var(--g500)" }}>{s.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Mode selector */}
      {state.stage === "IDLE" && mode === null && (
        <div className="card">
          <div className="card-head"><h3>Choose your pipeline mode</h3></div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button
              onClick={() => setMode("AUTO")}
              style={{ all: "unset", cursor: "pointer", display: "block", border: "2px solid var(--g100)", borderRadius: 12, padding: 20, background: "white", transition: "all 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#7c3aed"; (e.currentTarget as HTMLElement).style.background = "#faf5ff" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--g100)"; (e.currentTarget as HTMLElement).style.background = "white" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--g900)" }}>Auto mode</div>
                  <div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>AI runs everything</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--g700)", lineHeight: 1.6, marginBottom: 12 }}>
                Describe your idea once. The AI pipeline runs all 3 agents back-to-back, registers the project, and submits it for GM approval — while you focus on other work.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["All 3 agents run automatically", "Project auto-registered on completion", "Approval request sent to GM", "Notification delivered instantly"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--g600)" }}>
                    <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: "#7c3aed", fill: "none", strokeWidth: 3, strokeLinecap: "round", flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    {f}
                  </div>
                ))}
              </div>
            </button>

            <button
              onClick={() => setMode("MANUAL")}
              style={{ all: "unset", cursor: "pointer", display: "block", border: "2px solid var(--g100)", borderRadius: 12, padding: 20, background: "white", transition: "all 0.2s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--org)"; (e.currentTarget as HTMLElement).style.background = "#fff8f0" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--g100)"; (e.currentTarget as HTMLElement).style.background = "white" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg, var(--org), #f97316)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}>
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--g900)" }}>Manual mode</div>
                  <div style={{ fontSize: 11, color: "var(--org)", fontWeight: 600 }}>You stay in control</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--g700)", lineHeight: 1.6, marginBottom: 12 }}>
                Step through each agent one at a time. Review and approve outputs between stages — refine product.md before architecture begins, review the stack before governance runs.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {["Review product.md before architecture", "Approve or refine at each stage", "Full conversation with each agent", "Register manually when ready"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--g600)" }}>
                    <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: "var(--org)", fill: "none", strokeWidth: 3, strokeLinecap: "round", flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                    {f}
                  </div>
                ))}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Agent progress cards */}
      {mode !== null && (
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
                    {active && (autoStatus === "running" || autoStatus === "saving" || streaming) && (
                      <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: agent.color, fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite", marginLeft: "auto" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--g900)" }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: "var(--g500)", marginTop: 2, lineHeight: 1.4 }}>{agent.desc}</div>
                  <div style={{ fontSize: 9, color: "var(--g400)", marginTop: 4, background: "var(--g50)", padding: "1px 6px", borderRadius: 4, display: "inline-block" }}>{agent.modelLabel}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* IDLE prompt box */}
      {state.stage === "IDLE" && mode !== null && (
        <div className="card">
          <div className="card-head">
            <h3>{mode === "AUTO" ? "Describe your idea — the agent handles the rest" : "What do you want to build?"}</h3>
            <button onClick={() => setMode(null)} style={{ background: "none", cursor: "pointer", fontSize: 11, color: "var(--g500)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--g200)" }}>
              Switch mode
            </button>
          </div>
          <div className="card-body">
            {mode === "AUTO" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#faf5ff", borderRadius: 8, marginBottom: 12, border: "1px solid #e9d5ff" }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "#7c3aed", fill: "none", strokeWidth: 2, strokeLinecap: "round", flexShrink: 0 }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                <span style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600 }}>Auto mode — all 3 agents will run unattended. You'll be notified when it's done.</span>
              </div>
            )}
            <textarea className="form-input" rows={mode === "AUTO" ? 3 : 5} placeholder={mode === "AUTO" ? "e.g. A claims intake portal for personal lines that integrates with our core system and sends SMS updates to policyholders..." : "Describe your idea in plain language. The more context the better — what problem does it solve, who uses it, what does success look like..."} value={userInput} onChange={e => setUserInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && e.metaKey) startPipeline() }} style={{ marginBottom: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--g400)" }}>Cmd+Enter to start</span>
              <button
                className="btn"
                onClick={startPipeline}
                disabled={!userInput.trim()}
                style={{ display: "flex", alignItems: "center", gap: 8, background: mode === "AUTO" ? "#7c3aed" : "var(--org)", color: "white", border: "none" }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}>
                  {mode === "AUTO" ? <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> : <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />}
                </svg>
                {mode === "AUTO" ? "Launch AI agent" : "Start pipeline"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO MODE: live progress view */}
      {mode === "AUTO" && state.stage !== "IDLE" && (
        <div className="card">
          <div className="card-head">
            <h3>Agent running autonomously</h3>
            {autoStatus === "done" ? (
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--grn)", background: "#f0fff4", padding: "2px 10px", borderRadius: 10 }}>Complete</span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", background: "#faf5ff", padding: "2px 10px", borderRadius: 10, display: "flex", alignItems: "center", gap: 5 }}>
                <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, stroke: "#7c3aed", fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>
                Running
              </span>
            )}
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <AutoProgressStep label="Product Scoper — define requirements" status={autoStep1 as any} color="var(--org)" />
                <div style={{ width: 1, height: 12, background: "var(--g100)", marginLeft: 15 }} />
                <AutoProgressStep label="Tech Architect — design the stack" status={autoStep2 as any} color="var(--grn)" />
                <div style={{ width: 1, height: 12, background: "var(--g100)", marginLeft: 15 }} />
                <AutoProgressStep label="Governance Assessor — assess risk & compliance" status={autoStep3 as any} color="#7c3aed" />
                {(autoStatus === "saving" || autoStatus === "done") && (
                  <>
                    <div style={{ width: 1, height: 12, background: "var(--g100)", marginLeft: 15 }} />
                    <AutoProgressStep label="Register project & submit for approval" status={autoStatus === "done" ? "done" : "running"} color="#7c3aed" />
                  </>
                )}
              </div>
              <div style={{ flex: 1.2, background: "var(--g50)", borderRadius: 8, padding: "12px 14px", maxHeight: 220, overflowY: "auto" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Agent log</div>
                {autoLog.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--g400)", fontStyle: "italic" }}>Starting...</div>
                ) : autoLog.map((line, i) => (
                  <div key={i} style={{ fontSize: 11, color: line.startsWith("✓") ? "var(--grn)" : line.startsWith("✗") ? "#dc2626" : line.startsWith("⚠") ? "#d97706" : line.startsWith("↑") ? "#7c3aed" : "var(--g700)", marginBottom: 4, fontFamily: "monospace" }}>{line}</div>
                ))}
              </div>
            </div>

            {/* Live agent output stream */}
            {(() => {
              const lastAgent = [...state.messages].reverse().find(m => m.role === "agent")
              const isStreaming = autoStatus === "running"
              if (!lastAgent?.content && !isStreaming) return null
              const agentColor = autoStep1 === "running" ? "var(--org)" : autoStep2 === "running" ? "var(--grn)" : "#7c3aed"
              const agentName = autoStep1 === "running" ? "Product Scoper" : autoStep2 === "running" ? "Tech Architect" : "Governance Assessor"
              return (
                <div style={{ marginTop: 16, background: "var(--g50)", borderRadius: 8, border: `1px solid var(--g100)` }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--g100)", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: agentColor, flexShrink: 0, ...(isStreaming && lastAgent?.content ? { animation: "pulse 1.5s ease-in-out infinite" } : {}) }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: agentColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>{agentName} — live output</span>
                  </div>
                  <div style={{ padding: "12px 14px", maxHeight: 320, overflowY: "auto", fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--g800)", fontFamily: "inherit" }}>
                    {lastAgent?.content || <span style={{ color: "var(--g300)", fontFamily: "monospace" }}>|</span>}
                    {isStreaming && lastAgent?.content && <span style={{ color: agentColor, fontFamily: "monospace", animation: "pulse 1s step-end infinite" }}>▌</span>}
                  </div>
                </div>
              )
            })()}

            {autoStatus === "done" && state.projectId && (
              <div style={{ marginTop: 20, padding: 16, background: "#f0fff4", borderRadius: 10, border: "1px solid #bbf7d0", textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 6 }}>Pipeline complete — project registered</div>
                <div style={{ fontSize: 12, color: "#15803d", marginBottom: 14 }}>Approval request submitted to GM. You'll be notified when a decision is made.</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                  <a href={`/projects/detail?id=${state.projectId}`}><button className="btn btn-org" style={{ fontSize: 12 }}>View project</button></a>
                  <a href="/approvals"><button className="btn btn-ghost" style={{ fontSize: 12 }}>View approvals</button></a>
                  <a href="/observability"><button className="btn btn-ghost" style={{ fontSize: 12 }}>View observability</button></a>
                </div>
              </div>
            )}
            {showMemoryPrompt && (
              <div style={{ marginTop: 12, padding: "12px 16px", background: "#faf5ff", borderRadius: 10, border: "1px solid #e9d5ff", display: "flex", alignItems: "center", gap: 12 }}>
                <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, stroke: "#7c3aed", fill: "none", strokeWidth: 2, flexShrink: 0 }}><path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 6v4l3 3" strokeLinecap="round"/></svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>Save a lesson to the knowledge base?</div>
                  <div style={{ fontSize: 11, color: "#6d28d9", marginTop: 2 }}>Capture patterns, decisions or risks from this run so future agents can learn from them.</div>
                </div>
                <a href="/memory"><button className="btn btn-ghost" style={{ fontSize: 11, borderColor: "#c4b5fd", color: "#7c3aed" }}>Save lesson</button></a>
                <button onClick={() => setShowMemoryPrompt(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a78bfa", fontSize: 16 }}>×</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL MODE: streaming conversation */}
      {mode === "MANUAL" && state.messages.length > 0 && (
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

      {/* Generated documents */}
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

      {/* Manual mode complete card */}
      {mode === "MANUAL" && state.stage === "COMPLETE" && !state.projectId && (
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

      {/* Scorecard */}
      {state.stage === "COMPLETE" && state.productMd && (() => {
        const sc = computeScorecard(state.productMd, state.techstackMd, state.governanceMd)
        const scoreColor = sc.overallScore >= 80 ? "var(--grn)" : sc.overallScore >= 50 ? "var(--org)" : "#dc2626"
        return (
          <div className="card">
            <div className="card-head">
              <h3>Run scorecard</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {sessionRunCost > 0 && <span style={{ fontSize: 11, color: "var(--g500)" }}>Total cost: ${sessionRunCost.toFixed(4)}</span>}
                <Link href="/observability"><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>View observability →</button></Link>
              </div>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 40, fontWeight: 800, color: scoreColor }}>{sc.overallScore}</div>
                  <div style={{ fontSize: 10, color: "var(--g500)", fontWeight: 600 }}>OVERALL SCORE</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { label: "Section completeness", value: `${sc.completeness}%`, ok: sc.completeness >= 70 },
                    { label: "Assumptions flagged", value: sc.assumptions, ok: sc.assumptions >= 3 },
                    { label: "Risks identified", value: sc.risks, ok: sc.risks >= 5 },
                    { label: "ARC-REQUIRED flagged", value: sc.arcRequired ? "Yes" : "No", ok: true },
                  ].map(item => (
                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--g50)", borderRadius: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.ok ? "var(--grn)" : "var(--org)", flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 10, color: "var(--g500)" }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--g900)" }}>{item.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {sc.lowConf && (
                <div style={{ marginTop: 12, padding: "8px 12px", background: "#fff8f0", borderRadius: 8, border: "1px solid #fed7aa", fontSize: 11, color: "#92400e", display: "flex", gap: 8 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "#f97316", fill: "none", strokeWidth: 2, flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  Low-confidence signals detected in agent outputs. Review flagged sections before registering.
                </div>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <a href="/memory"><button className="btn btn-ghost" style={{ fontSize: 12 }}>Save lesson to knowledge base</button></a>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ARC-REQUIRED hard block */}
      {state.stage === "COMPLETE" && computeScorecard(state.productMd, state.techstackMd, state.governanceMd).arcRequired && (
        <div style={{ border: "2px solid #dc2626", borderRadius: 12, padding: "20px 24px", background: "#fef2f2", display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, stroke: "white", fill: "none", strokeWidth: 2.5, strokeLinecap: "round" }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#991b1b", marginBottom: 4 }}>BUILD BLOCKED — ARC APPROVAL REQUIRED</div>
            <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6, marginBottom: 12 }}>
              This project has been classified as <strong>CRITICAL risk</strong>. No build activity may proceed until the Architecture Review Committee (ARC) approves it. An approval request has been automatically submitted to your GM.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/approvals"><button className="btn btn-sm" style={{ background: "#dc2626", color: "white", border: "none", fontSize: 11, fontWeight: 700 }}>View approval status →</button></Link>
              <Link href="/risk"><button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Risk dashboard</button></Link>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
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
