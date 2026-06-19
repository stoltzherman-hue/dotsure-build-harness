"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface Props {
  projectId: string
  projectName: string
  currentStatus: string
}

type RequestStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED"

export function RequestApprovalButton({ projectId, projectName, currentStatus }: Props) {
  const { user } = useAuth()
  const supabase = createClient()

  const [requestStatus, setRequestStatus] = useState<RequestStatus>("NONE")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = currentStatus === "REGISTERED" || currentStatus === "IN_ASSESSMENT"

  useEffect(() => {
    if (!user || !canSubmit) {
      setLoading(false)
      return
    }

    supabase
      .from("ApprovalRequest")
      .select("status")
      .eq("project_id", projectId)
      .eq("requested_by", user.id)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setRequestStatus(data.status as RequestStatus)
        setLoading(false)
      })
  }, [projectId, user])

  if (!canSubmit) return null
  if (loading) return null

  if (requestStatus === "APPROVED") {
    return (
      <span
        className="badge badge-ok"
        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: "currentColor", fill: "none", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Approved
      </span>
    )
  }

  if (requestStatus === "PENDING") {
    return (
      <span
        className="badge badge-warn"
        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5 }}
      >
        <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: "currentColor", fill: "none", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        Pending approval
      </span>
    )
  }

  const handleSubmit = async () => {
    if (!user) return
    setSubmitting(true)
    const { error } = await supabase.from("ApprovalRequest").insert({
      project_id: projectId,
      requested_by: user.id,
      status: "PENDING",
    })
    if (!error) setRequestStatus("PENDING")
    setSubmitting(false)
  }

  return (
    <button
      className="btn btn-sm btn-org"
      onClick={handleSubmit}
      disabled={submitting}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {submitting ? (
        <>
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "currentColor", fill: "none", strokeWidth: 2, strokeLinecap: "round", animation: "spin 1s linear infinite" }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          Submitting…
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, stroke: "currentColor", fill: "none", strokeWidth: 2.5, strokeLinecap: "round", strokeLinejoin: "round" }}>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Submit for approval
        </>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </button>
  )
}
