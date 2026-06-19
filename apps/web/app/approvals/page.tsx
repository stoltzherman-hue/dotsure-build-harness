"use client"
export const dynamic = "force-dynamic"

/*
SQL — run once to create the ApprovalRequest table:

CREATE TABLE "ApprovalRequest" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES "Project"(id),
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  comment TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by UUID REFERENCES auth.users(id)
);
GRANT ALL ON "ApprovalRequest" TO anon, authenticated;
*/

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface ApprovalProject {
  id: string
  name: string
  projectCode: string
  riskTier: string
  department: string
}

interface ApprovalRequest {
  id: string
  project_id: string
  requested_by: string
  status: "PENDING" | "APPROVED" | "REJECTED"
  comment: string | null
  requested_at: string
  decided_at: string | null
  decided_by: string | null
  project: ApprovalProject | null
}

const statusBadge = (s: string) =>
  ({ PENDING: "badge-warn", APPROVED: "badge-ok", REJECTED: "badge-fail" }[s] || "badge-pending")

const riskBadge = (t: string) =>
  ({ LOW: "badge-low", MEDIUM: "badge-medium", HIGH: "badge-high", CRITICAL: "badge-critical" }[t] || "badge-pending")

function fmt(ts: string | null) {
  if (!ts) return "—"
  const d = new Date(ts)
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })
}

export default function Approvals() {
  const { user, role } = useAuth()
  const supabase = createClient()

  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState("ALL")
  const [comments, setComments] = useState<Record<string, string>>({})
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<Record<string, string>>({})

  const isApprover = role === "GM" || role === "APPROVER"

  useEffect(() => {
    if (!user) return
    const q = supabase
      .from("ApprovalRequest")
      .select("*, project:project_id(id, name, projectCode, riskTier, department)")
      .order("requested_at", { ascending: false })

    if (!isApprover) {
      q.eq("requested_by", user.id)
    }

    q.then(({ data }) => {
      setRequests((data as ApprovalRequest[]) || [])
      setLoading(false)
    })
  }, [user])

  const tabs = ["ALL", "PENDING", "APPROVED", "REJECTED"]
  const filtered = tab === "ALL" ? requests : requests.filter(r => r.status === tab)

  const handleApprove = async (req: ApprovalRequest) => {
    if (!user) return
    setActing(req.id)
    const now = new Date().toISOString()
    const { error: e1 } = await supabase
      .from("ApprovalRequest")
      .update({ status: "APPROVED", decided_at: now, decided_by: user.id, comment: comments[req.id] || null })
      .eq("id", req.id)
    if (e1) { setActing(null); return }
    await supabase.from("Project").update({ status: "APPROVED" }).eq("id", req.project_id)
    setRequests(rs => rs.map(r => r.id === req.id
      ? { ...r, status: "APPROVED", decided_at: now, decided_by: user.id, comment: comments[req.id] || null }
      : r))
    setActing(null)
  }

  const handleReject = async (req: ApprovalRequest) => {
    if (!user) return
    const c = comments[req.id]?.trim()
    if (!c) {
      setError(e => ({ ...e, [req.id]: "A comment is required when rejecting." }))
      return
    }
    setError(e => ({ ...e, [req.id]: "" }))
    setActing(req.id)
    const now = new Date().toISOString()
    const { error: e1 } = await supabase
      .from("ApprovalRequest")
      .update({ status: "REJECTED", decided_at: now, decided_by: user.id, comment: c })
      .eq("id", req.id)
    if (e1) { setActing(null); return }
    await supabase.from("Project").update({ status: "REJECTED" }).eq("id", req.project_id)
    setRequests(rs => rs.map(r => r.id === req.id
      ? { ...r, status: "REJECTED", decided_at: now, decided_by: user.id, comment: c }
      : r))
    setActing(null)
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p>
            {isApprover
              ? "Review and action pending project approval requests"
              : "Track the status of your submitted approval requests"}
          </p>
        </div>
      </div>

      <div className="card card-last">
        <div className="card-head">
          <h3>{isApprover ? "Approval requests" : "My requests"}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {tabs.map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={"btn btn-sm " + (tab === t ? "btn-org" : "btn-ghost")}
              >
                {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="empty">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No approval requests found</div>
        ) : (
          filtered.map((req, i) => {
            const isLast = i === filtered.length - 1
            const isPending = req.status === "PENDING"
            const proj = req.project

            return (
              <div
                key={req.id}
                style={{
                  padding: "14px 16px",
                  borderBottom: isLast ? "none" : "1px solid var(--g100)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  {proj ? (
                    <>
                      <span className="proj-id">{proj.projectCode}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--g900)" }}>{proj.name}</span>
                      {proj.department && (
                        <span style={{ fontSize: 11, color: "var(--g500)" }}>{proj.department}</span>
                      )}
                      {proj.riskTier && (
                        <span className={"badge " + riskBadge(proj.riskTier)}>{proj.riskTier}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--g500)" }}>Project {req.project_id}</span>
                  )}
                  <span style={{ marginLeft: "auto" }}>
                    <span className={"badge " + statusBadge(req.status)}>{req.status}</span>
                  </span>
                </div>

                {/* Meta row */}
                <div style={{ display: "flex", gap: 20, fontSize: 11, color: "var(--g500)", flexWrap: "wrap" }}>
                  <span>Requested: {fmt(req.requested_at)}</span>
                  {isApprover && (
                    <span>
                      By:{" "}
                      <code style={{ fontSize: 10, background: "var(--g100)", padding: "1px 5px", borderRadius: 4 }}>
                        {req.requested_by.slice(0, 8)}&hellip;
                      </code>
                    </span>
                  )}
                  {req.decided_at && <span>Decided: {fmt(req.decided_at)}</span>}
                  {req.decided_by && (
                    <span>
                      By:{" "}
                      <code style={{ fontSize: 10, background: "var(--g100)", padding: "1px 5px", borderRadius: 4 }}>
                        {req.decided_by.slice(0, 8)}&hellip;
                      </code>
                    </span>
                  )}
                </div>

                {/* Decision comment (resolved requests) */}
                {!isPending && req.comment && (
                  <div style={{
                    background: req.status === "APPROVED" ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                    border: `1px solid ${req.status === "APPROVED" ? "var(--grn)" : "var(--red)"}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 12,
                    color: "var(--g800)",
                    lineHeight: 1.5,
                  }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.4px",
                      color: "var(--g500)",
                      marginRight: 6,
                    }}>
                      {req.status === "APPROVED" ? "Note" : "Rejection reason"}:
                    </span>
                    {req.comment}
                  </div>
                )}

                {/* Approver action panel — only on PENDING */}
                {isApprover && isPending && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <textarea
                      className="input"
                      placeholder="Add a comment (required for rejection)…"
                      rows={2}
                      value={comments[req.id] || ""}
                      onChange={e => setComments(c => ({ ...c, [req.id]: e.target.value }))}
                      style={{ resize: "vertical", fontSize: 12, fontFamily: "inherit" }}
                    />
                    {error[req.id] && (
                      <div style={{ fontSize: 11, color: "var(--red)" }}>{error[req.id]}</div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-sm btn-org"
                        disabled={acting === req.id}
                        onClick={() => handleApprove(req)}
                      >
                        {acting === req.id ? "Saving…" : "Approve"}
                      </button>
                      <button
                        className="btn btn-sm"
                        disabled={acting === req.id}
                        onClick={() => handleReject(req)}
                        style={{ background: "var(--red)", color: "#fff", border: "1px solid var(--red)" }}
                      >
                        {acting === req.id ? "Saving…" : "Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
