"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

type EventType = "PIPELINE_RUN" | "MEMORY_CAPTURE" | "DEBUG_SESSION" | "APPROVAL"

interface AuditEvent {
  id: string
  type: EventType
  title: string
  detail: string
  actor: string | null
  ts: string
  meta?: string
}

const TYPE_CONFIG: Record<EventType, { label: string; color: string; dot: string }> = {
  PIPELINE_RUN:   { label: "Pipeline run",    color: "#1d4ed8", dot: "#3b82f6" },
  MEMORY_CAPTURE: { label: "Memory captured", color: "#166534", dot: "var(--grn)" },
  DEBUG_SESSION:  { label: "Debug session",   color: "#92400e", dot: "var(--org)" },
  APPROVAL:       { label: "Approval",        color: "#6b21a8", dot: "#a855f7" },
}

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All events" },
  { value: "PIPELINE_RUN", label: "Pipeline runs" },
  { value: "MEMORY_CAPTURE", label: "Memory captures" },
  { value: "DEBUG_SESSION", label: "Debug sessions" },
  { value: "APPROVAL", label: "Approvals" },
]

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from("PipelineRun").select("id, projectName, mode, riskLevel, totalCostUsd, createdAt, createdById").order("createdAt", { ascending: false }).limit(100),
      sb.from("Memory").select("id, type, title, createdAt, createdById").order("createdAt", { ascending: false }).limit(100),
      sb.from("DebugSession").select("id, title, status, createdAt, createdById").order("createdAt", { ascending: false }).limit(100),
      sb.from("Approval").select("id, status, createdAt, reviewedById, project:projectId(name)").order("createdAt", { ascending: false }).limit(100),
    ]).then(([runs, mems, dbg, approvals]) => {
      const all: AuditEvent[] = []

      ;(runs.data || []).forEach((r: any) => all.push({
        id: "run-" + r.id,
        type: "PIPELINE_RUN",
        title: r.projectName || "Pipeline run",
        detail: `Mode: ${r.mode || "MANUAL"} · Risk: ${r.riskLevel || "—"} · Cost: $${(r.totalCostUsd || 0).toFixed(4)}`,
        actor: r.createdById || null,
        ts: r.createdAt,
      }))

      ;(mems.data || []).forEach((m: any) => all.push({
        id: "mem-" + m.id,
        type: "MEMORY_CAPTURE",
        title: m.title,
        detail: `Type: ${m.type}`,
        actor: m.createdById || null,
        ts: m.createdAt,
      }))

      ;(dbg.data || []).forEach((d: any) => all.push({
        id: "dbg-" + d.id,
        type: "DEBUG_SESSION",
        title: d.title,
        detail: `Status: ${d.status}`,
        actor: d.createdById || null,
        ts: d.createdAt,
      }))

      ;(approvals.data || []).forEach((a: any) => all.push({
        id: "apv-" + a.id,
        type: "APPROVAL",
        title: (a.project as any)?.name || "Approval",
        detail: `Status: ${a.status}`,
        actor: a.reviewedById || null,
        ts: a.createdAt,
      }))

      all.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      setEvents(all)
      setLoading(false)
    })
  }, [])

  const filtered = events.filter(e => {
    if (typeFilter && e.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!e.title.toLowerCase().includes(q) && !e.detail.toLowerCase().includes(q)) return false
    }
    return true
  })

  const counts: Record<string, number> = {}
  events.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1 })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Audit log</h1>
          <p>Immutable activity record — all pipeline runs, memory captures, debug sessions and approvals</p>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--g700)", background: "var(--g50)", padding: "6px 14px", borderRadius: 8, border: "1px solid var(--g200)" }}>
          {events.length} events
        </div>
      </div>

      {/* Summary chips */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {(Object.keys(TYPE_CONFIG) as EventType[]).map(t => {
          const cfg = TYPE_CONFIG[t]
          return (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--g50)", border: "1px solid var(--g100)", borderRadius: 8, padding: "6px 12px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)" }}>{cfg.label}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: cfg.dot }}>{counts[t] || 0}</span>
            </div>
          )
        })}
      </div>

      <div className="card">
        {/* Filters */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--g100)", display: "flex", gap: 8, alignItems: "center" }}>
          {FILTERS.map(f => (
            <button key={f.value} onClick={() => setTypeFilter(f.value)}
              style={{ fontSize: 11, padding: "5px 12px", borderRadius: 6, border: "1px solid var(--g200)", cursor: "pointer", fontWeight: typeFilter === f.value ? 700 : 400, background: typeFilter === f.value ? "var(--g900)" : "white", color: typeFilter === f.value ? "white" : "var(--g700)", transition: "all 0.15s" }}>
              {f.label}
            </button>
          ))}
          <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ marginLeft: "auto", width: 200, margin: 0, padding: "5px 10px", fontSize: 11 }} />
        </div>

        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 220px 140px", gap: 12, padding: "8px 16px", background: "var(--g50)", borderBottom: "1px solid var(--g100)", fontSize: 10, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          <span>Event type</span><span>Title</span><span>Detail</span><span style={{ textAlign: "right" }}>Timestamp</span>
        </div>

        {loading ? (
          <div className="empty">Loading audit log...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">{events.length ? "No events match your filter" : "No audit events yet — run the pipeline to generate entries"}</div>
        ) : (
          <div>
            {filtered.map(e => {
              const cfg = TYPE_CONFIG[e.type]
              const d = new Date(e.ts)
              return (
                <div key={e.id} style={{ display: "grid", gridTemplateColumns: "140px 1fr 220px 140px", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--g50)", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--g900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
                  <span style={{ fontSize: 11, color: "var(--g500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</span>
                  <span style={{ fontSize: 10, color: "var(--g400)", textAlign: "right", fontFamily: "monospace" }}>
                    {d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" })} {d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--g400)", textAlign: "center", padding: "8px 0 16px" }}>
        Audit log is read-only. Events are generated automatically by platform activity.
      </div>
    </div>
  )
}
