"use client"
export const dynamic = "force-dynamic"
import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase"

interface Project {
  id: string
  name: string
  projectCode: string
  status: string
  riskTier: string
  createdAt: string
  targetGoLive: string | null
}

type Filter = "ALL" | "BUILDING" | "LIVE" | "HIGH_RISK"

const STATUS_COLOR: Record<string, string> = {
  REGISTERED: "var(--g400)",
  IN_ASSESSMENT: "var(--org)",
  APPROVED: "#6366f1",
  BUILDING: "#a855f7",
  LIVE: "var(--grn)",
}

const STATUS_LABEL: Record<string, string> = {
  REGISTERED: "Registered",
  IN_ASSESSMENT: "In Assessment",
  APPROVED: "Approved",
  BUILDING: "Building",
  LIVE: "Live",
}

const RISK_COLOR: Record<string, string> = {
  LOW: "var(--grn)",
  MEDIUM: "var(--org)",
  HIGH: "var(--red)",
  CRITICAL: "var(--red)",
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

function dateToX(date: Date, rangeStart: Date, totalDays: number, width: number): number {
  const ms = date.getTime() - rangeStart.getTime()
  const days = ms / 86400000
  return (days / totalDays) * width
}

const COL_WIDTH = 120 // px per month

export default function Timeline() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("ALL")
  const [tooltip, setTooltip] = useState<{ x: number; y: number; p: Project } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from("Project")
      .select("id,name,projectCode,status,riskTier,createdAt,targetGoLive")
      .order("createdAt", { ascending: true })
      .then(({ data }) => {
        setProjects(data || [])
        setLoading(false)
      })
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayPlus30 = new Date(today)
  todayPlus30.setDate(todayPlus30.getDate() + 30)

  const filtered = projects.filter(p => {
    if (filter === "BUILDING") return p.status === "BUILDING"
    if (filter === "LIVE") return p.status === "LIVE"
    if (filter === "HIGH_RISK") return p.riskTier === "HIGH" || p.riskTier === "CRITICAL"
    return true
  })

  // Compute date range across all projects (not just filtered)
  const allDates: Date[] = [today, todayPlus30]
  projects.forEach(p => {
    allDates.push(new Date(p.createdAt))
    if (p.targetGoLive) allDates.push(new Date(p.targetGoLive))
  })

  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())))
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())))

  const rangeStart = startOfMonth(minDate)
  const rangeEnd = addMonths(startOfMonth(maxDate), 1)
  const numMonths = monthsBetween(rangeStart, rangeEnd) + 1
  const chartWidth = Math.max(numMonths * COL_WIDTH, 600)
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / 86400000

  // Month tick positions
  const months: { label: string; x: number }[] = []
  for (let i = 0; i <= numMonths; i++) {
    const d = addMonths(rangeStart, i)
    months.push({
      label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      x: dateToX(d, rangeStart, totalDays, chartWidth),
    })
  }

  const todayX = dateToX(today, rangeStart, totalDays, chartWidth)

  const ROW_HEIGHT = 48
  const LABEL_WIDTH = 260
  const HEADER_HEIGHT = 32

  const filters: { key: Filter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "BUILDING", label: "Building" },
    { key: "LIVE", label: "Live" },
    { key: "HIGH_RISK", label: "High Risk" },
  ]

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Project Timeline</h1>
          <p>{projects.length} project{projects.length !== 1 ? "s" : ""} — Gantt view</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={"btn btn-sm " + (filter === f.key ? "btn-org" : "btn-ghost")}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--g400)" }}>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty">No projects match this filter.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {/* Gantt container — sticky left col + scrollable chart */}
          <div style={{ display: "flex", position: "relative" }} ref={containerRef}>

            {/* Fixed label column */}
            <div style={{
              flexShrink: 0,
              width: LABEL_WIDTH,
              borderRight: "1px solid var(--g100)",
              background: "var(--g50)",
              zIndex: 3,
            }}>
              {/* Header spacer */}
              <div style={{
                height: HEADER_HEIGHT,
                borderBottom: "1px solid var(--g100)",
              }} />
              {filtered.map(p => (
                <div
                  key={p.id}
                  style={{
                    height: ROW_HEIGHT,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "0 14px",
                    borderBottom: "1px solid var(--g100)",
                    gap: 3,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: "var(--g200)",
                      color: "var(--g800)",
                      borderRadius: 4,
                      padding: "1px 5px",
                      letterSpacing: "0.04em",
                      flexShrink: 0,
                    }}>
                      {p.projectCode}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: RISK_COLOR[p.riskTier] + "22",
                      color: RISK_COLOR[p.riskTier],
                      borderRadius: 4,
                      padding: "1px 5px",
                      flexShrink: 0,
                    }}>
                      {p.riskTier}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 12,
                    color: "var(--g900)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: LABEL_WIDTH - 28,
                  }}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Scrollable chart */}
            <div style={{ flex: 1, overflowX: "auto" }}>
              <div style={{ width: chartWidth, position: "relative" }}>

                {/* Month header row */}
                <div style={{
                  height: HEADER_HEIGHT,
                  borderBottom: "1px solid var(--g100)",
                  background: "var(--g50)",
                  position: "relative",
                }}>
                  {months.map((m, i) => (
                    <div
                      key={i}
                      style={{
                        position: "absolute",
                        left: m.x + 6,
                        top: 0,
                        height: HEADER_HEIGHT,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <span style={{
                        fontSize: 11,
                        color: "var(--g500)",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                      }}>
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rows area */}
                <div style={{ position: "relative" }}>
                  {/* Vertical grid lines */}
                  {months.map((m, i) => (
                    <div key={i} style={{
                      position: "absolute",
                      left: m.x,
                      top: 0,
                      width: 1,
                      height: filtered.length * ROW_HEIGHT,
                      background: "var(--g100)",
                      pointerEvents: "none",
                    }} />
                  ))}

                  {/* Today marker */}
                  {todayX >= 0 && todayX <= chartWidth && (
                    <div style={{
                      position: "absolute",
                      left: todayX,
                      top: 0,
                      width: 2,
                      height: filtered.length * ROW_HEIGHT,
                      background: "var(--red)",
                      opacity: 0.75,
                      pointerEvents: "none",
                      zIndex: 2,
                    }}>
                      <span style={{
                        position: "absolute",
                        top: 2,
                        left: 4,
                        fontSize: 10,
                        color: "var(--red)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        letterSpacing: "0.02em",
                      }}>Today</span>
                    </div>
                  )}

                  {/* Project rows */}
                  {filtered.map((p, idx) => {
                    const start = new Date(p.createdAt)
                    const hasGoLive = !!p.targetGoLive
                    const end = hasGoLive ? new Date(p.targetGoLive!) : todayPlus30

                    const xStart = Math.max(0, dateToX(start, rangeStart, totalDays, chartWidth))
                    const xEnd = Math.min(chartWidth, dateToX(end, rangeStart, totalDays, chartWidth))
                    const barWidth = Math.max(xEnd - xStart, 6)
                    const color = STATUS_COLOR[p.status] || "var(--g300)"

                    return (
                      <div
                        key={p.id}
                        style={{
                          height: ROW_HEIGHT,
                          borderBottom: "1px solid var(--g100)",
                          position: "relative",
                          background: idx % 2 === 1 ? "rgba(0,0,0,0.015)" : "transparent",
                        }}
                      >
                        {/* Bar */}
                        <div
                          style={{
                            position: "absolute",
                            top: "50%",
                            transform: "translateY(-50%)",
                            left: xStart,
                            width: barWidth,
                            height: 20,
                            background: hasGoLive ? color : "transparent",
                            border: hasGoLive ? "none" : `2px dashed ${color}`,
                            borderRadius: 5,
                            boxSizing: "border-box",
                            cursor: "pointer",
                            zIndex: 1,
                            // subtle inner fill for dashed bars
                            backgroundImage: hasGoLive
                              ? "none"
                              : `repeating-linear-gradient(90deg, ${color}33 0px, ${color}33 8px, transparent 8px, transparent 16px)`,
                          }}
                          onMouseEnter={e => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setTooltip({ x: rect.left + rect.width / 2, y: rect.top, p })
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{
            display: "flex",
            gap: 16,
            padding: "10px 16px",
            borderTop: "1px solid var(--g100)",
            flexWrap: "wrap",
            alignItems: "center",
          }}>
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11, color: "var(--g500)" }}>{STATUS_LABEL[s]}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 24,
                height: 12,
                borderRadius: 3,
                border: "2px dashed var(--g400)",
                background: "transparent",
              }} />
              <span style={{ fontSize: 11, color: "var(--g500)" }}>No target date (extends to today+30d)</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating tooltip — rendered in fixed viewport coordinates */}
      {tooltip && (
        <div style={{
          position: "fixed",
          pointerEvents: "none",
          zIndex: 9999,
          left: tooltip.x - 110,
          top: tooltip.y - 128,
          background: "var(--g900)",
          color: "var(--g50)",
          borderRadius: 8,
          padding: "10px 14px",
          fontSize: 12,
          minWidth: 220,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          lineHeight: 1.75,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{tooltip.p.name}</div>
          <div>
            <span style={{ color: "var(--g400)" }}>Code: </span>
            {tooltip.p.projectCode}
          </div>
          <div>
            <span style={{ color: "var(--g400)" }}>Status: </span>
            <span style={{ color: STATUS_COLOR[tooltip.p.status] }}>
              {STATUS_LABEL[tooltip.p.status] || tooltip.p.status}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--g400)" }}>Risk: </span>
            <span style={{ color: RISK_COLOR[tooltip.p.riskTier] }}>{tooltip.p.riskTier}</span>
          </div>
          <div>
            <span style={{ color: "var(--g400)" }}>Registered: </span>
            {new Date(tooltip.p.createdAt).toLocaleDateString()}
          </div>
          <div>
            <span style={{ color: "var(--g400)" }}>Target go-live: </span>
            {tooltip.p.targetGoLive
              ? new Date(tooltip.p.targetGoLive).toLocaleDateString()
              : <em style={{ color: "var(--g500)" }}>Not set</em>}
          </div>
        </div>
      )}
    </div>
  )
}
