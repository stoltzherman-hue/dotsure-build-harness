"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

type RiskTier = "LOW" | "MEDIUM" | "HIGH"

interface Project {
  id: string
  name: string
  projectCode: string
  department: string
  riskTier: RiskTier
  riskScore: number
  status: string
}

const TIERS: RiskTier[] = ["LOW", "MEDIUM", "HIGH"]

const tierStyle: Record<RiskTier, { bg: string; color: string; border: string }> = {
  LOW:    { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
  MEDIUM: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  HIGH:   { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
}

const statusColor: Record<string, string> = {
  ACTIVE:   "var(--grn)",
  INACTIVE: "var(--g400)",
  PENDING:  "var(--org)",
  ARCHIVED: "var(--g300)",
}

export default function RiskDashboard() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{ dept: string; tier: RiskTier } | null>(null)
  const [activeTier, setActiveTier] = useState<RiskTier>("HIGH")

  useEffect(() => {
    if (!user) return
    const supabase = createClient()
    supabase
      .from("Project")
      .select("id, name, projectCode, department, riskTier, riskScore, status")
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setProjects((data as Project[]) || [])
        setLoading(false)
      })
  }, [user])

  const departments = Array.from(new Set(projects.map(p => p.department))).sort()

  const cellCount = (dept: string, tier: RiskTier) =>
    projects.filter(p => p.department === dept && p.riskTier === tier).length

  const totalProjects = projects.length
  const highRiskCount = projects.filter(p => p.riskTier === "HIGH").length
  const avgScore = totalProjects
    ? Math.round(projects.reduce((s, p) => s + (p.riskScore ?? 0), 0) / totalProjects)
    : 0

  const filteredProjects = selected
    ? projects.filter(p => p.department === selected.dept && p.riskTier === selected.tier)
    : projects.filter(p => p.riskTier === activeTier)

  const handleCellClick = (dept: string, tier: RiskTier) => {
    if (selected?.dept === dept && selected?.tier === tier) {
      setSelected(null)
    } else {
      setSelected({ dept, tier })
      setActiveTier(tier)
    }
  }

  const handleTierFilter = (tier: RiskTier) => {
    setSelected(null)
    setActiveTier(tier)
  }

  const isSelected = (dept: string, tier: RiskTier) =>
    selected ? selected.dept === dept && selected.tier === tier : false

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--g900)" }}>Risk dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--g400)" }}>
            Project risk heatmap and portfolio exposure
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Total projects</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--g900)" }}>{loading ? "—" : totalProjects}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>High risk</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: "var(--red)" }}>{loading ? "—" : highRiskCount}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g400)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Avg risk score</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: avgScore >= 70 ? "var(--red)" : avgScore >= 40 ? "var(--org)" : "var(--grn)" }}>
              {loading ? "—" : avgScore}
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-head">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Risk heatmap</span>
          <span style={{ fontSize: 12, color: "var(--g400)" }}>Click a cell to filter projects below</span>
        </div>
        <div className="card-body" style={{ overflowX: "auto" }}>
          {loading ? (
            <div className="empty">Loading…</div>
          ) : departments.length === 0 ? (
            <div className="empty">No project data available</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--g400)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid var(--g100)" }}>
                    Department
                  </th>
                  {TIERS.map(tier => (
                    <th
                      key={tier}
                      style={{
                        textAlign: "center",
                        padding: "8px 12px",
                        color: tierStyle[tier].color,
                        fontWeight: 700,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        borderBottom: "1px solid var(--g100)",
                        background: tierStyle[tier].bg,
                        minWidth: 100,
                      }}
                    >
                      {tier}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments.map((dept, i) => (
                  <tr key={dept} style={{ borderBottom: i < departments.length - 1 ? "1px solid var(--g100)" : "none" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--g800)", whiteSpace: "nowrap" }}>
                      {dept}
                    </td>
                    {TIERS.map(tier => {
                      const count = cellCount(dept, tier)
                      const sel = isSelected(dept, tier)
                      return (
                        <td key={tier} style={{ padding: 6, textAlign: "center" }}>
                          <button
                            onClick={() => handleCellClick(dept, tier)}
                            style={{
                              width: "100%",
                              minWidth: 80,
                              padding: "10px 8px",
                              border: sel
                                ? `2px solid ${tierStyle[tier].color}`
                                : `1px solid ${count > 0 ? tierStyle[tier].border : "var(--g100)"}`,
                              borderRadius: 8,
                              background: count > 0 ? tierStyle[tier].bg : "var(--g50)",
                              color: count > 0 ? tierStyle[tier].color : "var(--g300)",
                              fontWeight: sel ? 800 : count > 0 ? 700 : 400,
                              fontSize: count > 0 ? 20 : 14,
                              cursor: count > 0 ? "pointer" : "default",
                              boxShadow: sel ? `0 0 0 3px ${tierStyle[tier].border}` : "none",
                              transition: "all 0.15s",
                            }}
                            disabled={count === 0}
                          >
                            {count > 0 ? count : "—"}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Project list */}
      <div className="card">
        <div className="card-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>
            {selected
              ? `${selected.dept} — ${selected.tier} risk projects`
              : `${activeTier} risk projects`}
            {" "}
            <span style={{ color: "var(--g400)", fontWeight: 400, fontSize: 13 }}>({filteredProjects.length})</span>
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {TIERS.map(tier => (
              <button
                key={tier}
                className={"btn btn-sm" + (!selected && activeTier === tier ? " btn-org" : " btn-ghost")}
                onClick={() => handleTierFilter(tier)}
                style={!selected && activeTier === tier ? {} : { color: tierStyle[tier].color }}
              >
                {tier}
              </button>
            ))}
            {selected && (
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>
                Clear filter
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="empty">Loading projects…</div>
          ) : error ? (
            <div className="empty" style={{ color: "var(--red)" }}>Error: {error}</div>
          ) : filteredProjects.length === 0 ? (
            <div className="empty">No projects in this category</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredProjects.map(project => {
                const score = project.riskScore ?? 0
                const barColor = score >= 70 ? "var(--red)" : score >= 40 ? "var(--org)" : "var(--grn)"
                return (
                  <div
                    key={project.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: "0 16px",
                      alignItems: "center",
                      padding: "12px 16px",
                      border: "1px solid var(--g100)",
                      borderRadius: 10,
                      background: "var(--g50)",
                    }}
                  >
                    {/* Left: code + name + dept */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="proj-id">{project.projectCode}</span>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "var(--g900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {project.name}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: "var(--g400)" }}>{project.department}</span>
                    </div>

                    {/* Middle: risk score bar */}
                    <div style={{ minWidth: 120 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--g400)", fontWeight: 500 }}>Risk score</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: barColor }}>{score}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--g200)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${score}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                    </div>

                    {/* Right: tier + status badges */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        background: tierStyle[project.riskTier]?.bg ?? "var(--g100)",
                        color: tierStyle[project.riskTier]?.color ?? "var(--g500)",
                        border: `1px solid ${tierStyle[project.riskTier]?.border ?? "var(--g200)"}`,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        {project.riskTier}
                      </span>
                      <span style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: "var(--g100)",
                        color: statusColor[project.status] ?? "var(--g500)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}>
                        {project.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
