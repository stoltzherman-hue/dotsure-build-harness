"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

const STATUSES = {
  OPEN:          { label: "Open",          color: "var(--org)",  bg: "#fff8f0" },
  INVESTIGATING: { label: "Investigating", color: "#7c3aed",     bg: "#faf5ff" },
  RESOLVED:      { label: "Resolved",      color: "var(--grn)",  bg: "#f0fff4" },
  WONT_FIX:      { label: "Won't fix",     color: "var(--g400)", bg: "var(--g50)" },
}

const STEPS = [
  { key: "symptoms",             label: "1. Symptoms",             hint: "What is the observable behaviour? What broke? When did it start?" },
  { key: "rootCauseHypothesis",  label: "2. Root cause hypothesis", hint: "What do you believe is causing this? List your hypotheses in order of likelihood." },
  { key: "evidence",             label: "3. Evidence gathered",    hint: "What did you check? Logs, traces, DB queries, reproduction steps." },
  { key: "fixApplied",           label: "4. Fix applied",          hint: "What change was made? Reference commit/PR if available." },
  { key: "outcome",              label: "5. Outcome",              hint: "Did it resolve? Any side effects? Should this be captured in the knowledge base?" },
]

interface DebugSession {
  id: string
  title: string
  symptoms: string
  rootCauseHypothesis: string | null
  evidence: string | null
  fixApplied: string | null
  outcome: string | null
  status: keyof typeof STATUSES
  projectId: string | null
  createdAt: string
  resolvedAt: string | null
  project?: { name: string; projectCode: string } | null
}

export default function DebugPage() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState<DebugSession[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<DebugSession | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState("ALL")
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState({ title: "", symptoms: "", projectId: "" })
  const [editFields, setEditFields] = useState<Partial<DebugSession>>({})

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from("DebugSession").select("*, project:projectId(name, projectCode)").order("createdAt", { ascending: false }),
      sb.from("Project").select("id, name, projectCode").order("name"),
    ]).then(([{ data: sess }, { data: projs }]) => {
      setSessions(sess || [])
      setProjects(projs || [])
      setLoading(false)
    })
  }, [])

  const createSession = async () => {
    if (!newForm.title.trim() || !newForm.symptoms.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const { data } = await sb.from("DebugSession").insert({
      title: newForm.title, symptoms: newForm.symptoms,
      projectId: newForm.projectId || null, createdById: user?.id, status: "OPEN",
    }).select("*, project:projectId(name, projectCode)").single()
    if (data) { setSessions(s => [data as DebugSession, ...s]); setSelected(data as DebugSession) }
    setNewForm({ title: "", symptoms: "", projectId: "" })
    setShowNew(false)
    setSaving(false)
  }

  const updateSession = async (id: string, updates: Partial<DebugSession>) => {
    const sb = createClient()
    const payload: any = { ...updates }
    if (updates.status === "RESOLVED" && selected?.status !== "RESOLVED") payload.resolvedAt = new Date().toISOString()
    await sb.from("DebugSession").update(payload).eq("id", id)
    setSessions(s => s.map(x => x.id === id ? { ...x, ...payload } : x))
    setSelected(s => s ? { ...s, ...payload } : s)
  }

  const filtered = sessions.filter(s => filter === "ALL" || s.status === filter)

  const completedSteps = selected ? STEPS.filter(s => selected[s.key as keyof DebugSession]).length : 0

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Systematic debugging</h1>
          <p>Root-cause investigation before fixes — structured, traceable, captured</p>
        </div>
        <button className="btn btn-org" onClick={() => { setShowNew(true); setSelected(null) }}>+ New debug session</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>
        {/* Left panel — session list */}
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {["ALL", ...Object.keys(STATUSES)].map(s => (
              <button key={s} onClick={() => setFilter(s)} className={"btn btn-sm " + (filter === s ? "btn-org" : "btn-ghost")} style={{ fontSize: 10 }}>
                {s === "ALL" ? `All (${sessions.length})` : STATUSES[s as keyof typeof STATUSES].label}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ fontSize: 12, color: "var(--g400)", padding: 16 }}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: "center", padding: 24, fontSize: 12, color: "var(--g500)" }}>No sessions yet</div></div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {filtered.map(s => {
                const st = STATUSES[s.status]
                const active = selected?.id === s.id
                return (
                  <div key={s.id} onClick={() => { setSelected(s); setShowNew(false) }} className="card"
                    style={{ cursor: "pointer", border: active ? "2px solid var(--org)" : "1px solid var(--g100)", padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, padding: "2px 7px", borderRadius: 10 }}>{st.label.toUpperCase()}</span>
                      <span style={{ fontSize: 10, color: "var(--g400)", marginLeft: "auto" }}>{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g900)", marginBottom: 2 }}>{s.title}</div>
                    {s.project && <div style={{ fontSize: 10, color: "var(--g500)" }}>{s.project.projectCode}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right panel — new session or detail */}
        <div>
          {showNew && (
            <div className="card" style={{ border: "2px solid var(--org)" }}>
              <div className="card-head"><h3>Start debug session</h3></div>
              <div className="card-body" style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: "10px 14px", background: "#fff8f0", borderRadius: 8, border: "1px solid #fed7aa", fontSize: 12, color: "#92400e" }}>
                  Before writing any fix, document the root cause first. Rushed fixes without investigation create new bugs.
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Session title</div>
                  <input className="form-input" style={{ margin: 0 }} placeholder="e.g. Login page redirects to blank screen after auth" value={newForm.title} onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Symptoms — what are you observing?</div>
                  <textarea className="form-input" style={{ margin: 0 }} rows={4} placeholder="Describe exactly what is broken. Include error messages, affected users, frequency, when it started..." value={newForm.symptoms} onChange={e => setNewForm(f => ({ ...f, symptoms: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Linked project (optional)</div>
                  <select className="form-input" style={{ margin: 0 }} value={newForm.projectId} onChange={e => setNewForm(f => ({ ...f, projectId: e.target.value }))}>
                    <option value="">None</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.projectCode} — {p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                  <button className="btn btn-org" onClick={createSession} disabled={saving || !newForm.title.trim() || !newForm.symptoms.trim()}>
                    {saving ? "Creating..." : "Start investigation"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {selected && !showNew && (
            <div style={{ display: "grid", gap: 12 }}>
              {/* Header */}
              <div className="card">
                <div style={{ padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--g900)", marginBottom: 4 }}>{selected.title}</div>
                      <div style={{ fontSize: 11, color: "var(--g500)" }}>
                        Opened {new Date(selected.createdAt).toLocaleDateString()}
                        {selected.resolvedAt && ` · Resolved ${new Date(selected.resolvedAt).toLocaleDateString()}`}
                        {selected.project && ` · ${selected.project.projectCode}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        value={selected.status}
                        onChange={e => updateSession(selected.id, { status: e.target.value as any })}
                        style={{ fontSize: 11, fontWeight: 700, color: STATUSES[selected.status].color, background: STATUSES[selected.status].bg, border: "1px solid " + STATUSES[selected.status].color + "40", borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}
                      >
                        {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--g500)", marginBottom: 4 }}>
                      <span>Investigation progress</span>
                      <span>{completedSteps}/{STEPS.length} steps</span>
                    </div>
                    <div style={{ height: 4, background: "var(--g100)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(completedSteps / STEPS.length) * 100}%`, background: completedSteps === STEPS.length ? "var(--grn)" : "var(--org)", borderRadius: 2, transition: "width 0.3s" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps */}
              {STEPS.map(step => {
                const value = selected[step.key as keyof DebugSession] as string || ""
                const done = !!value
                return (
                  <div key={step.key} className="card" style={{ border: done ? "1px solid var(--g200)" : "1px solid var(--g100)", opacity: 1 }}>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: done ? "var(--grn)" : "var(--g100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {done
                            ? <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: "white", fill: "none", strokeWidth: 3 }}><polyline points="20 6 9 17 4 12" /></svg>
                            : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--g300)" }} />
                          }
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--g900)" }}>{step.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--g500)", marginBottom: 8, fontStyle: "italic" }}>{step.hint}</div>
                      <textarea
                        className="form-input"
                        style={{ margin: 0, minHeight: 80 }}
                        placeholder={step.hint}
                        defaultValue={value}
                        onBlur={e => {
                          const v = e.target.value.trim()
                          if (v !== value) updateSession(selected.id, { [step.key]: v || null } as any)
                        }}
                      />
                    </div>
                  </div>
                )
              })}

              {completedSteps === STEPS.length && selected.status !== "RESOLVED" && (
                <div className="card" style={{ border: "2px solid var(--grn)", background: "#f0fff4" }}>
                  <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>All steps complete</div>
                      <div style={{ fontSize: 11, color: "#15803d" }}>Mark this session as resolved and optionally save the lesson to the knowledge base.</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <a href="/memory"><button className="btn btn-ghost" style={{ fontSize: 12 }}>Save to knowledge base</button></a>
                      <button className="btn" style={{ background: "var(--grn)", color: "white", fontSize: 12 }} onClick={() => updateSession(selected.id, { status: "RESOLVED" })}>Mark resolved</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!selected && !showNew && (
            <div className="card">
              <div className="card-body" style={{ textAlign: "center", padding: 48 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g700)", marginBottom: 6 }}>No session selected</div>
                <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 16 }}>Select a session from the left or start a new one. Investigate before you fix.</div>
                <button className="btn btn-org" onClick={() => setShowNew(true)}>Start debug session</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
