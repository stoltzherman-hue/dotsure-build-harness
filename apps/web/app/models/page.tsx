"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

const MODEL_META: Record<string, { label: string; provider: string; tier: string; risk: "LOW" | "MEDIUM" | "HIGH"; color: string }> = {
  "claude-haiku-4-5-20251001": { label: "Haiku 4.5", provider: "Anthropic", tier: "Efficiency", risk: "LOW", color: "var(--org)" },
  "claude-sonnet-4-6": { label: "Sonnet 4.6", provider: "Anthropic", tier: "Balanced", risk: "MEDIUM", color: "#7c3aed" },
}

interface ModelStat {
  model: string
  runs: number
  totalCost: number
  avgLatency: number
  totalTokensIn: number
  totalTokensOut: number
  flagCount: number
  lastUsed: string | null
}

export default function ModelsPage() {
  const [stats, setStats] = useState<ModelStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from("PipelineRun").select("model,costUsd,latencyMs,inputTokens,outputTokens,guardrailFlag,createdAt")
      .then(({ data }) => {
        if (!data) { setLoading(false); return }
        const map: Record<string, ModelStat> = {}
        for (const r of data as any[]) {
          if (!r.model) continue
          if (!map[r.model]) map[r.model] = { model: r.model, runs: 0, totalCost: 0, avgLatency: 0, totalTokensIn: 0, totalTokensOut: 0, flagCount: 0, lastUsed: null }
          const m = map[r.model]
          m.runs++
          m.totalCost += r.costUsd || 0
          m.avgLatency += r.latencyMs || 0
          m.totalTokensIn += r.inputTokens || 0
          m.totalTokensOut += r.outputTokens || 0
          if (r.guardrailFlag) m.flagCount++
          if (!m.lastUsed || r.createdAt > m.lastUsed) m.lastUsed = r.createdAt
        }
        for (const m of Object.values(map)) m.avgLatency = m.runs ? Math.round(m.avgLatency / m.runs) : 0
        setStats(Object.values(map).sort((a, b) => b.runs - a.runs))
        setLoading(false)
      })
  }, [])

  const riskColor = (r: "LOW" | "MEDIUM" | "HIGH") => r === "LOW" ? "var(--grn)" : r === "MEDIUM" ? "var(--amb)" : "#dc2626"
  const riskBg = (r: "LOW" | "MEDIUM" | "HIGH") => r === "LOW" ? "#f0fdf4" : r === "MEDIUM" ? "#fff8f0" : "#fef2f2"

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>AI model inventory</h1><p>All models in use across the pipeline — usage stats, cost, and risk classification</p></div>
      </div>

      {loading ? (
        <div className="empty">Loading...</div>
      ) : stats.length === 0 ? (
        <div className="card"><div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>No pipeline runs yet — run the build pipeline to populate model usage.</div></div>
      ) : (
        <>
          {/* Model cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, marginBottom: 4 }}>
            {stats.map(s => {
              const meta = MODEL_META[s.model]
              const risk = meta?.risk ?? "MEDIUM"
              return (
                <div key={s.model} className="card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: meta?.color ?? "var(--g900)" }}>{meta?.label ?? s.model}</div>
                      <div style={{ fontSize: 11, color: "var(--g500)", marginTop: 2 }}>{meta?.provider ?? "Unknown"} · {meta?.tier ?? "—"}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, background: riskBg(risk), color: riskColor(risk), padding: "3px 8px", borderRadius: 5 }}>{risk} RISK</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Runs", value: s.runs.toLocaleString() },
                      { label: "Total cost", value: `$${s.totalCost.toFixed(4)}` },
                      { label: "Avg latency", value: `${(s.avgLatency / 1000).toFixed(1)}s` },
                      { label: "Flag rate", value: s.runs ? `${Math.round((s.flagCount / s.runs) * 100)}%` : "—" },
                      { label: "Tokens in", value: s.totalTokensIn.toLocaleString() },
                      { label: "Tokens out", value: s.totalTokensOut.toLocaleString() },
                    ].map(k => (
                      <div key={k.label} style={{ background: "var(--g50)", borderRadius: 6, padding: "8px 10px" }}>
                        <div style={{ fontSize: 9, color: "var(--g400)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{k.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--g900)" }}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {s.lastUsed && (
                    <div style={{ marginTop: 10, fontSize: 10, color: "var(--g400)" }}>
                      Last used {new Date(s.lastUsed).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Comparison table */}
          <div className="card">
            <div className="card-head"><h3>Model comparison</h3></div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--g50)", borderBottom: "1px solid var(--g100)" }}>
                    {["Model", "Provider", "Risk tier", "Runs", "Cost/run", "Avg latency", "Flag rate", "Tokens in/run"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--g600)", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => {
                    const meta = MODEL_META[s.model]
                    const risk = meta?.risk ?? "MEDIUM"
                    return (
                      <tr key={s.model} style={{ borderBottom: "1px solid var(--g100)", background: i % 2 === 0 ? "white" : "var(--g50)" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: meta?.color ?? "var(--g900)" }}>{meta?.label ?? s.model}</td>
                        <td style={{ padding: "8px 12px", color: "var(--g600)" }}>{meta?.provider ?? "—"}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, background: riskBg(risk), color: riskColor(risk), padding: "2px 6px", borderRadius: 4 }}>{risk}</span>
                        </td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "var(--g700)" }}>{s.runs}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "var(--grn)", fontWeight: 600 }}>${s.runs ? (s.totalCost / s.runs).toFixed(5) : "—"}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "var(--g700)" }}>{(s.avgLatency / 1000).toFixed(1)}s</td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: s.flagCount > 0 ? "#dc2626" : "var(--g400)" }}>{s.runs ? `${Math.round((s.flagCount / s.runs) * 100)}%` : "—"}</td>
                        <td style={{ padding: "8px 12px", fontFamily: "monospace", color: "var(--g700)" }}>{s.runs ? Math.round(s.totalTokensIn / s.runs).toLocaleString() : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
