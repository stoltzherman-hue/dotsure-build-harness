"use client"

interface Control {
  id: string
  title: string
  status: "covered" | "partial" | "not-covered"
  note: string
}

interface FrameworkSection {
  title: string
  controls: Control[]
}

const ISO42001: FrameworkSection[] = [
  {
    title: "4 — Context of the organisation",
    controls: [
      { id: "4.1", title: "Understanding the organisation and its context", status: "covered", note: "Risk dashboard, governance assessor, and compliance page capture regulatory context (POPIA, FAIS, PPR, TCF)." },
      { id: "4.2", title: "Understanding the needs of interested parties", status: "partial", note: "User roles (GM, DEVELOPER, APPROVER) mapped; external stakeholder register not formalised." },
      { id: "4.3", title: "Determining the scope of the AIMS", status: "covered", note: "Pipeline governs all AI project intake; scope defined at project registration." },
    ],
  },
  {
    title: "5 — Leadership",
    controls: [
      { id: "5.1", title: "Leadership and commitment", status: "covered", note: "GM approval gate is mandatory before any AI project proceeds to build." },
      { id: "5.2", title: "AI policy", status: "partial", note: "GUARDRAILS embedded in every agent system prompt; formal written policy not published to staff." },
      { id: "5.3", title: "Organisational roles and responsibilities", status: "covered", note: "RBAC enforced: GM, APPROVER, DEVELOPER with distinct permissions." },
    ],
  },
  {
    title: "6 — Planning",
    controls: [
      { id: "6.1", title: "Actions to address risks and opportunities", status: "covered", note: "Governance Assessor produces risk register and evidence pack per project." },
      { id: "6.2", title: "AI objectives and planning to achieve them", status: "partial", note: "Per-project objectives captured in product.md; organisation-level OKR tracking not present." },
    ],
  },
  {
    title: "8 — Operation",
    controls: [
      { id: "8.1", title: "Operational planning and control", status: "covered", note: "Lifecycle pre-flight checklist; build path (SELF-BUILD / IT-ASSISTED / ARC-REQUIRED) per project." },
      { id: "8.2", title: "AI risk assessment", status: "covered", note: "Agent 3 produces structured risk classification (LOW/MEDIUM/HIGH/CRITICAL) with justification." },
      { id: "8.3", title: "AI risk treatment", status: "partial", note: "Mitigations recommended in governance.md; treatment tracking not automated." },
      { id: "8.4", title: "Impact assessment for AI systems", status: "partial", note: "Regulatory assessment covers TCF and POPIA impact; formal AIIA template not enforced." },
      { id: "8.5", title: "AI system lifecycle", status: "covered", note: "7-stage lifecycle checklist (intent → orchestration) enforced at pipeline entry." },
      { id: "8.6", title: "Responsible AI system use", status: "covered", note: "Non-negotiable guardrails in every agent; human-in-the-loop approval gates." },
    ],
  },
  {
    title: "9 — Performance evaluation",
    controls: [
      { id: "9.1", title: "Monitoring, measurement, analysis and evaluation", status: "covered", note: "LLM Observability page tracks tokens, latency, cost and guardrail flags per run." },
      { id: "9.2", title: "Internal audit", status: "partial", note: "Audit log captures all user actions; scheduled internal audit process not configured." },
      { id: "9.3", title: "Management review", status: "not-covered", note: "No automated management review report generation. Manual review required." },
    ],
  },
  {
    title: "10 — Improvement",
    controls: [
      { id: "10.1", title: "Continual improvement", status: "covered", note: "Knowledge base captures PATTERN, FAILURE, LESSON, GOVERNANCE entries for reuse in future runs." },
      { id: "10.2", title: "Nonconformity and corrective action", status: "partial", note: "Debug log tracks issues to resolution; formal NCR workflow not implemented." },
    ],
  },
]

const NIST_RMF: FrameworkSection[] = [
  {
    title: "GOVERN — Policies, processes, procedures and practices",
    controls: [
      { id: "GV-1", title: "Policies and procedures for AI risk management", status: "covered", note: "Agent guardrails, approval gates, and ARC-REQUIRED flag form the policy layer." },
      { id: "GV-2", title: "Accountability and responsibilities", status: "covered", note: "GM, APPROVER, DEVELOPER roles enforced by Supabase RLS and RBAC." },
      { id: "GV-3", title: "Organisational culture supporting AI risk", status: "partial", note: "Platform promotes transparency via scored outputs; culture maturity not measured." },
      { id: "GV-4", title: "Organisational teams are committed", status: "covered", note: "Pipeline requires explicit human approval at GM level before project proceeds." },
      { id: "GV-6", title: "Policies include third-party AI", status: "partial", note: "Anthropic Claude usage noted in tech catalogue; third-party risk assessment not formalised." },
    ],
  },
  {
    title: "MAP — Context is established and understood",
    controls: [
      { id: "MP-1", title: "Context established for AI risk", status: "covered", note: "Agent 1 researches problem space; regulatory context assessed per SA insurance regulation." },
      { id: "MP-2", title: "Scientific and technological context", status: "covered", note: "Tech catalogue tracks approved stack; Sonnet/Haiku model tiering with cost transparency." },
      { id: "MP-3", title: "AI risks enumerated by category", status: "covered", note: "Agent 3 classifies risk as LOW/MEDIUM/HIGH/CRITICAL with regulatory justification." },
      { id: "MP-5", title: "Likelihood and magnitude of impacts", status: "partial", note: "Risk score (0-100) calculated per project; likelihood/magnitude axes not separate." },
    ],
  },
  {
    title: "MEASURE — Analysed, assessed, and benchmarked",
    controls: [
      { id: "MS-1", title: "Methods to measure AI risks", status: "covered", note: "Run scorecard (0-100) measures completeness, assumptions, risks, and confidence per pipeline run." },
      { id: "MS-2", title: "AI systems tested", status: "partial", note: "Guardrail input/output scanning active; formal red-teaming not scheduled." },
      { id: "MS-3", title: "AI system performance is evaluated", status: "covered", note: "Observability page tracks latency, token usage, cost, and flag rates per agent." },
      { id: "MS-4", title: "Risk metrics reviewed on a recurring basis", status: "partial", note: "Data available in observability and risk dashboard; automated threshold alerts not configured." },
    ],
  },
  {
    title: "MANAGE — Risks are prioritised and addressed",
    controls: [
      { id: "MG-1", title: "Risks identified in MEASURE are prioritised", status: "covered", note: "HIGH/CRITICAL projects trigger ARC-REQUIRED flag and GM notification." },
      { id: "MG-2", title: "Treatments address AI risks", status: "covered", note: "Build path (SELF-BUILD / IT-ASSISTED / ARC-REQUIRED) is the primary treatment mechanism." },
      { id: "MG-3", title: "Risk responses are communicated", status: "covered", note: "GM notified via in-app notification and approval request on every auto-pipeline completion." },
      { id: "MG-4", title: "Residual risks documented", status: "partial", note: "Evidence pack includes assumption register; residual risk sign-off not tracked." },
    ],
  },
]

const STATUS_CONFIG = {
  "covered":     { label: "Covered",     bg: "#f0fff4", color: "#166534", dot: "var(--grn)" },
  "partial":     { label: "Partial",     bg: "#fff8f0", color: "#92400e", dot: "var(--org)" },
  "not-covered": { label: "Not covered", bg: "#fef2f2", color: "#991b1b", dot: "#dc2626" },
}

function FrameworkSection({ section }: { section: FrameworkSection }) {
  const counts = { covered: 0, partial: 0, "not-covered": 0 }
  section.controls.forEach(c => counts[c.status]++)
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--g700)", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid var(--g100)" }}>
        {section.title}
        <span style={{ marginLeft: 12, fontWeight: 400, color: "var(--g400)", fontSize: 11 }}>
          {counts.covered} covered · {counts.partial} partial · {counts["not-covered"]} gap{counts["not-covered"] !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {section.controls.map(ctrl => {
          const cfg = STATUS_CONFIG[ctrl.status]
          return (
            <div key={ctrl.id} style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 12, alignItems: "flex-start", padding: "10px 12px", background: "var(--g50)", borderRadius: 8, border: "1px solid var(--g100)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g500)", fontFamily: "monospace", paddingTop: 1 }}>{ctrl.id}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g900)", marginBottom: 3 }}>{ctrl.title}</div>
                <div style={{ fontSize: 11, color: "var(--g600)", lineHeight: 1.5 }}>{ctrl.note}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: cfg.bg, color: cfg.color, padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                  {cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function FrameworksPage() {
  const [tab, setTab] = useState<"iso" | "nist">("iso")

  const allControls = (tab === "iso" ? ISO42001 : NIST_RMF).flatMap(s => s.controls)
  const counts = { covered: 0, partial: 0, "not-covered": 0 }
  allControls.forEach(c => counts[c.status]++)
  const coverage = Math.round((counts.covered + counts.partial * 0.5) / allControls.length * 100)

  const framework = tab === "iso" ? ISO42001 : NIST_RMF

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>AI Governance Frameworks</h1><p>Platform coverage mapped to ISO 42001 and NIST AI Risk Management Framework</p></div>
        <div style={{ fontSize: 13, fontWeight: 700, color: coverage >= 75 ? "var(--grn)" : "var(--org)", background: "var(--g50)", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--g200)" }}>
          {coverage}% coverage
        </div>
      </div>

      {/* Coverage summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 4 }}>
        {(["covered", "partial", "not-covered"] as const).map(s => {
          const cfg = STATUS_CONFIG[s]
          return (
            <div key={s} className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${cfg.dot}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: cfg.dot }}>{counts[s]}</div>
              <div style={{ fontSize: 12, color: "var(--g600)" }}>{cfg.label}</div>
            </div>
          )
        })}
      </div>

      {/* Framework tabs */}
      <div className="card">
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--g100)", display: "flex", gap: 6 }}>
          {([["iso", "ISO 42001 — AI Management Systems"], ["nist", "NIST AI RMF — Risk Management Framework"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{ fontSize: 12, padding: "6px 16px", borderRadius: 8, border: "1px solid var(--g200)", cursor: "pointer", fontWeight: tab === k ? 700 : 400, background: tab === k ? "var(--g900)" : "white", color: tab === k ? "white" : "var(--g700)", transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ padding: "20px 20px 8px" }}>
          {framework.map(section => (
            <FrameworkSection key={section.title} section={section} />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--g400)", textAlign: "center", padding: "8px 0 16px" }}>
        Coverage assessment current as of June 2026. Last reviewed by Build Harness governance layer.
      </div>
    </div>
  )
}
