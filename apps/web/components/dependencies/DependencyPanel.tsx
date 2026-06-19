/*
  SQL — run once in Supabase SQL editor:

  CREATE TABLE "ProjectDependency" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES "Project"(id) ON DELETE CASCADE,
    dependency_type TEXT DEFAULT 'TECHNICAL',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, depends_on_id),
    CHECK (project_id != depends_on_id)
  );
  GRANT ALL ON "ProjectDependency" TO anon, authenticated;
*/

"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

interface DepProject {
  id: string
  name: string
  projectCode: string
  riskTier: string
  status: string
}

interface Dependency {
  id: string
  depends_on_id: string
  dependency_type: string
  dependsOn: DepProject
}

const riskBadgeClass = (t: string) =>
  ({ LOW: "badge-low", MEDIUM: "badge-medium", HIGH: "badge-high", CRITICAL: "badge-critical" }[t] || "badge-pending")

const statusBadgeClass = (s: string) =>
  ({ REGISTERED: "badge-org", IN_ASSESSMENT: "badge-warn", APPROVED: "badge-ok", BUILDING: "badge-pur", LIVE: "badge-ok", REJECTED: "badge-fail" }[s] || "badge-pending")

export default function DependencyPanel({ projectId }: { projectId: string }) {
  const supabase = createClient()
  const { profile } = useAuth()
  const isGM = profile?.role === "GM"

  const [deps, setDeps] = useState<Dependency[]>([])
  const [loading, setLoading] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [allProjects, setAllProjects] = useState<DepProject[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [adding, setAdding] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchDeps = async () => {
    const { data } = await supabase
      .from("ProjectDependency")
      .select("*, dependsOn:depends_on_id(id, name, projectCode, riskTier, status)")
      .eq("project_id", projectId)
    setDeps((data as Dependency[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!projectId) return
    fetchDeps()
  }, [projectId])

  const openSearch = async () => {
    setShowSearch(true)
    setSearchQuery("")
    setError(null)
    if (allProjects.length === 0) {
      const { data } = await supabase
        .from("Project")
        .select("id, name, projectCode, riskTier, status")
        .neq("id", projectId)
        .order("projectCode", { ascending: true })
      setAllProjects((data as DepProject[]) || [])
    }
  }

  const addDependency = async (target: DepProject) => {
    setError(null)
    // Circular dependency check: does target already depend on this project?
    const { data: reverse } = await supabase
      .from("ProjectDependency")
      .select("id")
      .eq("project_id", target.id)
      .eq("depends_on_id", projectId)
      .maybeSingle()

    if (reverse) {
      setError(`Cannot add: ${target.projectCode} already depends on this project (circular dependency).`)
      return
    }

    setAdding(target.id)
    const { error: insertErr } = await supabase
      .from("ProjectDependency")
      .insert({ project_id: projectId, depends_on_id: target.id })

    if (insertErr) {
      setError(insertErr.message)
    } else {
      await fetchDeps()
      setShowSearch(false)
    }
    setAdding(null)
  }

  const removeDependency = async (depId: string) => {
    setRemoving(depId)
    await supabase.from("ProjectDependency").delete().eq("id", depId)
    setDeps(d => d.filter(x => x.id !== depId))
    setRemoving(null)
  }

  const existingDepIds = new Set(deps.map(d => d.depends_on_id))

  const filteredProjects = allProjects.filter(p => {
    if (existingDepIds.has(p.id)) return false
    const q = searchQuery.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.projectCode.toLowerCase().includes(q)
  })

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Dependencies</h3>
          <div style={{ fontSize: 11, color: "var(--g500)" }}>Projects this project depends on</div>
        </div>
        {isGM && !showSearch && (
          <button className="btn btn-ghost btn-sm" onClick={openSearch}>+ Add dependency</button>
        )}
      </div>

      {error && (
        <div style={{ margin: "0 16px 12px", background: "#fff0f0", border: "1px solid var(--red)", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "var(--red)" }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {showSearch && (
        <div style={{ borderBottom: "1px solid var(--g100)", padding: "12px 16px", background: "var(--g50)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input
              className="form-input"
              type="text"
              placeholder="Search by name or code..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
              style={{ flex: 1, margin: 0 }}
            />
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowSearch(false); setError(null) }}>Cancel</button>
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto", display: "grid", gap: 6 }}>
            {filteredProjects.length === 0 ? (
              <div className="empty" style={{ padding: "12px 0", fontSize: 12 }}>No projects found</div>
            ) : filteredProjects.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", border: "1px solid var(--g200)", borderRadius: 6, background: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="proj-id">{p.projectCode}</span>
                  <span style={{ fontSize: 12, color: "var(--g800)", fontWeight: 500 }}>{p.name}</span>
                  <span className={"badge " + riskBadgeClass(p.riskTier)} style={{ fontSize: 10 }}>{p.riskTier}</span>
                </div>
                <button
                  className="btn btn-org btn-sm"
                  onClick={() => addDependency(p)}
                  disabled={adding === p.id}
                >
                  {adding === p.id ? "Adding..." : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-body">
        {loading ? (
          <div className="empty">Loading dependencies...</div>
        ) : deps.length === 0 ? (
          <div className="empty">No dependencies registered for this project.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {deps.map(dep => (
              <div key={dep.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", border: `1px solid ${dep.dependsOn.riskTier === "HIGH" || dep.dependsOn.riskTier === "CRITICAL" ? "var(--red)" : "var(--g200)"}`, borderRadius: 8, background: "white" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="proj-id">{dep.dependsOn.projectCode}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--g800)" }}>{dep.dependsOn.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span className={"badge " + riskBadgeClass(dep.dependsOn.riskTier)} style={{ fontSize: 10 }}>{dep.dependsOn.riskTier}</span>
                      <span className={"badge " + statusBadgeClass(dep.dependsOn.status)} style={{ fontSize: 10 }}>{dep.dependsOn.status.replace("_", " ")}</span>
                      {(dep.dependsOn.riskTier === "HIGH" || dep.dependsOn.riskTier === "CRITICAL") && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--red)", fontWeight: 600 }}>
                          <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, fill: "none", stroke: "var(--red)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                          High risk dependency
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isGM && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "var(--red)", fontSize: 11 }}
                    onClick={() => removeDependency(dep.id)}
                    disabled={removing === dep.id}
                  >
                    {removing === dep.id ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
