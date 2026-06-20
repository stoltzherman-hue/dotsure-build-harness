"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

interface PipelineRun {
  id: string
  agentName: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  latencyMs: number | null
  costUsd: number | null
  guardrailFlag: boolean
  flagReason: string | null
  createdAt: string
  quality: number | null
}

const MODEL_LABEL: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
}

export default function ObservabilityPage() {
  const [runs, setRuns] = useState<PipelineRun[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "flagged">("all")
  const [ratings, setRatings] = useState<Record<string, number>>({})

  useEffect(() => {
    const sb = createClient()
    sb.from("PipelineRun").select("*").order("createdAt", { ascending: false }).limit(200)
      .then(({ data }) => { setRuns((data as any[]) || []); setLoading(false) })
  }, [])

  const displayed = filter === "flagged" ? runs.filter(r => r.guardrailFlag) : runs

  const totalCost = runs.reduce((s, r) => s + (r.costUsd || 0), 0)
  const totalIn = runs.reduce((s, r) => s + (r.inputTokens || 0), 0)
  const totalOut = runs.reduce((s, r) => s + (r.outputTokens || 0), 0)
  const avgLatency = runs.length ? Math.round(runs.reduce((s, r) => s + (r.latencyMs || 0), 0) / runs.length) : 0
  const flagCount = runs.filter(r => r.guardrailFlag).length

  const rateRun = async (id: string, quality: number) => {
    setRatings(prev => ({ ...prev, [id]: quality }))
    const sb = createClient()
    await sb.from("PipelineRun").update({ quality }).eq("id", id)
    setRuns(prev => prev.map(r => r.id === id ? { ...r, quality } : r))
  }

  const ratedRuns = runs.filter(r => r.quality != null || ratings[r.id] != null)
  const acceptedRuns = ratedRuns.filter(r => (ratings[r.id] ?? r.quality) === 1)
  const acceptanceRate = ratedRuns.length ? Math.round((acceptedRuns.length / ratedRuns.length) * 100) : null

  // Simple inline bar chart — last 20 runs latency
  const chartRuns = [...runs].reverse().slice(-20)
  const maxLatency = Math.max(...chartRuns.map(r => r.latencyMs || 0), 1)

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>LLM Observability</h1><p>Token usage, latency, cost and guardrail flags across all pipeline runs</p></div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 4 }}>
        {[
          { label: "Total runs", value: runs.length.toLocaleString(), color: "var(--g900)" },
          { label: "Total cost", value: `$${totalCost.toFixed(4)}`, color: "var(--grn)" },
          { label: "Tokens in", value: totalIn.toLocaleString(), color: "var(--org)" },
          { label: "Tokens out", value: totalOut.toLocaleString(), color: "#7c3aed" },
          { label: "Guardrail flags", value: flagCount, color: flagCount > 0 ? "#dc2626" : "var(--g400)" },
          { label: "Acceptance rate", value: acceptanceRate != null ? `${acceptanceRate}%` : "—", color: acceptanceRate == null ? "var(--g400)" : acceptanceRate >= 70 ? "var(--grn)" : acceptanceRate >= 40 ? "var(--amb)" : "#dc2626" },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--g500)", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Latency chart */}
      {chartRuns.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Latency — last {chartRuns.length} runs (ms)</h3><span style={{ fontSize: 11, color: "var(--g500)" }}>avg {avgLatency.toLocaleString()} ms</span></div>
          <div style={{ padding: "16px 20px 20px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
              {chartRuns.map((r, i) => {
                const h = Math.max(4, Math.round(((r.latencyMs || 0) / maxLatency) * 72))
                const col = r.guardrailFlag ? "#dc2626" : r.model.includes("haiku") ? "var(--org)" : "#7c3aed"
                return (
                  <div key={r.id} title={`${r.agentName} · ${r.latencyMs}ms`} style={{ flex: 1, height: h, background: col, borderRadius: "3px 3px 0 0", opacity: 0.85, cursor: "default", transition: "opacity 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.85")} />
                )
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 9, color: "var(--g400)" }}>oldest</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {[{ color: "var(--org)", label: "Haiku" }, { color: "#7c3aed", label: "Sonnet" }, { color: "#dc2626", label: "Flagged" }].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: l.color, borderRadius: 2 }} />
                    <span style={{ fontSize: 9, color: "var(--g500)" }}>{l.label}</span>
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 9, color: "var(--g400)" }}>newest</span>
            </div>
          </div>
        </div>
      )}

      {/* Runs table */}
      <div className="card">
        <div className="card-head">
          <h3>Run log</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "flagged"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--g200)", cursor: "pointer", fontWeight: filter === f ? 700 : 400, background: filter === f ? "var(--g900)" : "white", color: filter === f ? "white" : "var(--g700)" }}>
                {f === "all" ? `All (${runs.length})` : `Flagged (${flagCount})`}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>Loading...</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>
            {filter === "flagged" ? "No flagged runs." : "No pipeline runs yet. Run the build pipeline to see data here."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "var(--g50)", borderBottom: "1px solid var(--g100)" }}>
                  {["Time", "Agent", "Model", "Tokens in", "Tokens out", "Latency", "Cost", "Flag", "Quality"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--g600)", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--g100)", background: r.guardrailFlag ? "#fef2f2" : i % 2 === 0 ? "white" : "var(--g50)" }}>
                    <td style={{ padding: "8px 12px", color: "var(--g500)", whiteSpace: "nowrap" }}>{new Date(r.createdAt).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: "8px 12px", fontWeight: 600, color: "var(--g900)" }}>{r.agentName}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: r.model.includes("haiku") ? "#fff8f0" : "#faf5ff", color: r.model.includes("haiku") ? "var(--org)" : "#7c3aed", padding: "2px 6px", borderRadius: 4 }}>
                        {MODEL_LABEL[r.model] || r.model}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "var(--g700)", fontFamily: "monospace" }}>{r.inputTokens?.toLocaleString() ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: "var(--g700)", fontFamily: "monospace" }}>{r.outputTokens?.toLocaleString() ?? "—"}</td>
                    <td style={{ padding: "8px 12px", color: "var(--g700)", fontFamily: "monospace" }}>{r.latencyMs ? `${(r.latencyMs / 1000).toFixed(1)}s` : "—"}</td>
                    <td style={{ padding: "8px 12px", color: "var(--grn)", fontFamily: "monospace", fontWeight: 600 }}>{r.costUsd != null ? `$${Number(r.costUsd).toFixed(5)}` : "—"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {r.guardrailFlag ? (
                        <span title={r.flagReason || ""} style={{ fontSize: 10, fontWeight: 700, background: "#fef2f2", color: "#dc2626", padding: "2px 6px", borderRadius: 4, cursor: "help" }}>⚠ {r.flagReason?.slice(0, 30) || "Flagged"}</span>
                      ) : (
                        <span style={{ fontSize: 10, color: "var(--g300)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {(() => {
                        const q = ratings[r.id] ?? r.quality
                        return (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => rateRun(r.id, 1)} title="Good output" style={{ background: q === 1 ? "#dcfce7" : "transparent", border: "1px solid", borderColor: q === 1 ? "var(--grn)" : "var(--g200)", borderRadius: 4, cursor: "pointer", fontSize: 12, padding: "1px 5px", color: q === 1 ? "var(--grn)" : "var(--g400)" }}>👍</button>
                            <button onClick={() => rateRun(r.id, -1)} title="Poor output" style={{ background: q === -1 ? "#fef2f2" : "transparent", border: "1px solid", borderColor: q === -1 ? "#dc2626" : "var(--g200)", borderRadius: 4, cursor: "pointer", fontSize: 12, padding: "1px 5px", color: q === -1 ? "#dc2626" : "var(--g400)" }}>👎</button>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
