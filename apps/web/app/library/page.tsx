"use client"
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"

interface Doc { id: string; projectId: string; filename: string; content: string; generatedBy: string; version: number; createdAt: string }
interface Project { id: string; projectCode: string; name: string; status: string }

const agentMeta = (g: string) => ({
  "agent-1": { label: "Product Scoper", color: "var(--org)", d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  "agent-2": { label: "Tech Architect", color: "var(--grn)", d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" },
  "agent-3": { label: "Governance Assessor", color: "#7c3aed", d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
}[g] || { label: g, color: "var(--g500)", d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6" })

export default function Library() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Doc | null>(null)
  const [filter, setFilter] = useState("ALL")
  const supabase = createClient()

  useEffect(() => {
    Promise.all([
      supabase.from("ProjectDocument").select("*").order("createdAt", { ascending: false }),
      supabase.from("Project").select("id,projectCode,name,status")
    ]).then(([{ data: d }, { data: p }]) => { setDocs(d || []); setProjects(p || []); setLoading(false) })
  }, [])

  const getProject = (id: string) => projects.find(p => p.id === id)
  const filtered = filter === "ALL" ? docs : docs.filter(d => d.filename === filter)
  const grouped = filtered.reduce((acc: Record<string, Doc[]>, doc) => { acc[doc.projectId] = acc[doc.projectId] || []; acc[doc.projectId].push(doc); return acc }, {})

  return (
    <div className="content">
      <div className="page-head">
        <div><h1>Project library</h1><p>{docs.length} document{docs.length !== 1 ? "s" : ""} across {Object.keys(grouped).length} project{Object.keys(grouped).length !== 1 ? "s" : ""}</p></div>
        <Link href="/pipeline"><button className="btn btn-org">+ New pipeline</button></Link>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["ALL", "product.md", "techstack.md", "governance.md", "evidence-pack.md"].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={"btn btn-sm " + (filter === f ? "btn-org" : "btn-ghost")}>{f}</button>
        ))}
      </div>

      {loading ? <div className="empty">Loading...</div> : Object.keys(grouped).length === 0 ? (
        <div className="card"><div className="card-body"><div className="empty"><div style={{ marginBottom: 12 }}>No documents yet. Start a pipeline to generate your first project documents.</div><Link href="/pipeline"><button className="btn btn-org">Start pipeline</button></Link></div></div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1.4fr" : "1fr", gap: 16, alignItems: "start" }}>
          <div>
            {Object.entries(grouped).map(([projectId, projectDocs]) => {
              const project = getProject(projectId)
              return (
                <div key={projectId} className="card" style={{ marginBottom: 12 }}>
                  <div className="card-head">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {project && <span className="proj-id">{project.projectCode}</span>}
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{project?.name || "Unknown project"}</span>
                    </div>
                    {project && <Link href={`/projects/detail?id=${projectId}`}><button className="btn btn-ghost btn-sm">View project</button></Link>}
                  </div>
                  <div style={{ padding: "8px 16px 14px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                    {["product.md", "techstack.md", "governance.md", "evidence-pack.md"].map(filename => {
                      const doc = projectDocs.find(d => d.filename === filename)
                      const meta = agentMeta(doc?.generatedBy || "agent-3")
                      const isSelected = selected?.id === doc?.id
                      return (
                        <div key={filename} onClick={() => doc && setSelected(isSelected ? null : doc)}
                          style={{ border: `1px solid ${doc ? (isSelected ? meta.color : "var(--g200)") : "var(--g100)"}`, borderRadius: 8, padding: "10px 12px", cursor: doc ? "pointer" : "default", background: isSelected ? "var(--g50)" : "transparent", opacity: doc ? 1 : 0.4, transition: "all 0.15s" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, stroke: doc ? meta.color : "var(--g300)", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d={meta.d} /></svg>
                            <span style={{ fontSize: 10, fontWeight: 700, color: doc ? meta.color : "var(--g300)" }}>{filename}</span>
                          </div>
                          <div style={{ fontSize: 10, color: "var(--g500)" }}>{meta.label}</div>
                          {doc ? <div style={{ fontSize: 9, color: "var(--grn)", fontWeight: 700, marginTop: 4 }}>v{doc.version} - {new Date(doc.createdAt).toLocaleDateString("en-ZA")}</div>
                            : <div style={{ fontSize: 9, color: "var(--g300)", marginTop: 4 }}>Not generated</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {selected && (
            <div className="card" style={{ position: "sticky", top: 80 }}>
              <div className="card-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 13, height: 13, stroke: agentMeta(selected.generatedBy).color, fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d={agentMeta(selected.generatedBy).d} /></svg>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{selected.filename}</div><div style={{ fontSize: 10, color: "var(--g500)" }}>{agentMeta(selected.generatedBy).label} - v{selected.version}</div></div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Close</button>
              </div>
              <div style={{ padding: "12px 16px", maxHeight: "60vh", overflowY: "auto" }}>
                <pre style={{ fontSize: 11, color: "var(--g800)", whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, fontFamily: "inherit" }}>{selected.content}</pre>
              </div>
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--g100)", display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { const b = new Blob([selected.content], { type: "text/markdown" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = selected.filename; a.click(); URL.revokeObjectURL(u) }}>Download</button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(selected.content)}>Copy</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

