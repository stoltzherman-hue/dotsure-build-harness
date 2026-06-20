"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

interface FeedItem {
  id: string
  title: string
  body: string
  regulator: string
  impact: "HIGH" | "MEDIUM" | "LOW"
  affectedTiers: string[]
  effectiveDate: string
  actionRequired: string
}

const impactColor = (i: string) => i === "HIGH" ? "#dc2626" : i === "MEDIUM" ? "var(--amb)" : "var(--grn)"
const impactBg = (i: string) => i === "HIGH" ? "#fef2f2" : i === "MEDIUM" ? "#fff8f0" : "#f0fdf4"

const FEED_TAG = "regulatory-feed"
const CACHE_HOURS = 24

export default function RegulatoryPage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [filter, setFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL")

  const supabase = createClient()

  const loadFeed = async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)

    // Check cache
    if (!forceRefresh) {
      const { data: cached } = await supabase.from("Memory")
        .select("content,createdAt").eq("tag", FEED_TAG)
        .order("createdAt", { ascending: false }).limit(1).single()
      if (cached) {
        const ageHours = (Date.now() - new Date(cached.createdAt).getTime()) / 3600000
        if (ageHours < CACHE_HOURS) {
          try {
            setItems(JSON.parse(cached.content))
            setLastUpdated(cached.createdAt)
            setLoading(false)
            return
          } catch {}
        }
      }
    }

    // Pull active project risk tiers to tailor the feed
    const { data: projects } = await supabase.from("Project")
      .select("riskTier,department,projectType").limit(50)
    const tierSummary = projects?.length
      ? [...new Set((projects as any[]).map(p => p.riskTier))].join(", ")
      : "LOW, MEDIUM, HIGH"
    const deptSummary = projects?.length
      ? [...new Set((projects as any[]).map(p => p.department).filter(Boolean))].slice(0, 6).join(", ")
      : "Technology, Claims, Finance"

    const prompt = `You are a South African insurance regulatory intelligence analyst. Generate a regulatory change feed for a South African short-term insurance company (Dotsure) that has active AI and technology projects.

Active project risk tiers: ${tierSummary}
Active departments: ${deptSummary}

Return ONLY a JSON array of 6 regulatory updates relevant to SA insurance tech projects right now. Focus on FSCA, POPIA, FAIS, PPR, Insurance Act, AI governance, cloud/data residency regulations.

Each item must follow this exact shape (no markdown, no backticks):
[
  {
    "id": "unique-slug",
    "title": "Short headline (max 80 chars)",
    "body": "2-3 sentence plain English description of the regulatory change or requirement",
    "regulator": "FSCA | POPIA | FAIS | PPR | Insurance Act | AI Governance | Cloud",
    "impact": "HIGH | MEDIUM | LOW",
    "affectedTiers": ["LOW","MEDIUM","HIGH","CRITICAL"] (include tiers this affects),
    "effectiveDate": "Q1 2025 | Q2 2025 | Q3 2025 | Q4 2025 | Q1 2026 | In effect",
    "actionRequired": "One sentence on what the team should do"
  }
]`

    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
      })
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      const text = data.content?.[0]?.text || "[]"
      const parsed: FeedItem[] = JSON.parse(text.replace(/```json|```/g, "").trim())

      // Cache to Memory table
      await supabase.from("Memory").insert({
        tag: FEED_TAG,
        title: "Regulatory feed",
        content: JSON.stringify(parsed),
        agentName: "Regulatory Intelligence",
        sourceFile: "regulatory-feed",
      })

      setItems(parsed)
      setLastUpdated(new Date().toISOString())
    } catch (e) {
      console.error(e)
    }

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { loadFeed() }, [])

  const displayed = filter === "ALL" ? items : items.filter(i => i.impact === filter)

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Regulatory change feed</h1>
          <p>SA insurance regulatory updates relevant to your active projects{lastUpdated && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--g400)" }}>· Updated {new Date(lastUpdated).toLocaleString("en-ZA", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>}</p>
        </div>
        <button className="btn btn-org btn-sm" onClick={() => loadFeed(true)} disabled={refreshing} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {refreshing
            ? <><svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "white", fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>Refreshing...</>
            : "Refresh feed"
          }
        </button>
      </div>

      {/* Impact filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {(["ALL", "HIGH", "MEDIUM", "LOW"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ fontSize: 11, padding: "3px 12px", borderRadius: 6, border: "1px solid var(--g200)", cursor: "pointer", fontWeight: filter === f ? 700 : 400, background: filter === f ? "var(--g900)" : "white", color: filter === f ? "white" : "var(--g700)" }}>
            {f === "ALL" ? `All (${items.length})` : `${f} (${items.filter(i => i.impact === f).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card"><div style={{ padding: 48, textAlign: "center" }}>
          <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, stroke: "var(--org)", fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite", margin: "0 auto 12px", display: "block" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>
          <div style={{ fontSize: 13, color: "var(--g500)" }}>Generating regulatory intelligence...</div>
        </div></div>
      ) : displayed.length === 0 ? (
        <div className="card"><div style={{ padding: 32, textAlign: "center", color: "var(--g400)", fontSize: 13 }}>No items for this filter.</div></div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {displayed.map(item => (
            <div key={item.id} className="card" style={{ borderLeft: `3px solid ${impactColor(item.impact)}` }}>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, background: impactBg(item.impact), color: impactColor(item.impact), padding: "2px 7px", borderRadius: 4 }}>{item.impact}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, background: "var(--g100)", color: "var(--g600)", padding: "2px 7px", borderRadius: 4 }}>{item.regulator}</span>
                      <span style={{ fontSize: 10, color: "var(--g400)" }}>Effective: {item.effectiveDate}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--g900)" }}>{item.title}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {item.affectedTiers?.map(t => (
                      <span key={t} style={{ fontSize: 9, fontWeight: 700, background: "var(--g100)", color: "var(--g600)", padding: "2px 5px", borderRadius: 3 }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "var(--g700)", lineHeight: 1.6, marginBottom: 10 }}>{item.body}</div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "var(--g50)", borderRadius: 6, padding: "8px 10px" }}>
                  <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: "var(--org)", fill: "none", strokeWidth: 2, flexShrink: 0, marginTop: 1 }}><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                  <span style={{ fontSize: 11, color: "var(--g700)" }}><strong>Action:</strong> {item.actionRequired}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
