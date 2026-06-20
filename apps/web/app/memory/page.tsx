"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

const TYPES = {
  PATTERN:    { label: "Pattern",         color: "var(--grn)",  desc: "Reusable approach that worked" },
  FAILURE:    { label: "Failure signal",  color: "#dc2626",     desc: "What went wrong and why" },
  LESSON:     { label: "Lesson",          color: "var(--org)",  desc: "Key insight from a delivery" },
  GOVERNANCE: { label: "Governance note", color: "#7c3aed",     desc: "Compliance or risk finding" },
}

interface Memory {
  id: string
  type: keyof typeof TYPES
  title: string
  content: string
  tags: string[]
  projectId: string | null
  createdAt: string
  project?: { name: string; projectCode: string } | null
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [filter, setFilter] = useState("ALL")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: "LESSON", title: "", content: "", tags: "", projectId: "" })

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from("Memory").select("*, project:projectId(name, projectCode)").order("createdAt", { ascending: false }),
      sb.from("Project").select("id, name, projectCode").order("name"),
    ]).then(([{ data: mems }, { data: projs }]) => {
      setMemories(mems || [])
      setProjects(projs || [])
      setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean)
    const { data } = await sb.from("Memory").insert({
      type: form.type, title: form.title, content: form.content,
      tags, projectId: form.projectId || null, createdById: user?.id,
    }).select("*, project:projectId(name, projectCode)").single()
    if (data) setMemories(m => [data as Memory, ...m])
    setForm({ type: "LESSON", title: "", content: "", tags: "", projectId: "" })
    setShowAdd(false)
    setSaving(false)
  }

  const filtered = memories.filter(m => {
    if (filter !== "ALL" && m.type !== filter) return false
    if (search && !m.title.toLowerCase().includes(search.toLowerCase()) && !m.content.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Knowledge base</h1>
          <p>Patterns, lessons and governance insights captured from past deliveries — fed back into future agent prompts</p>
        </div>
        <button className="btn btn-org" onClick={() => setShowAdd(true)}>+ Capture memory</button>
      </div>

      {showAdd && (
        <div className="card" style={{ border: "2px solid var(--org)" }}>
          <div className="card-head">
            <h3>Capture new memory</h3>
            <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--g400)", fontSize: 20, lineHeight: 1 }}>×</button>
          </div>
          <div className="card-body" style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Type</div>
                <select className="form-input" style={{ margin: 0 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.desc}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Linked project (optional)</div>
                <select className="form-input" style={{ margin: 0 }} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
                  <option value="">None</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.projectCode} — {p.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Title</div>
              <input className="form-input" style={{ margin: 0 }} placeholder="Short descriptive title..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Content</div>
              <textarea className="form-input" style={{ margin: 0 }} rows={5} placeholder="Describe the pattern, lesson, or finding in detail. Be specific — this will be used to inform future agent runs." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--g700)", marginBottom: 4 }}>Tags (comma-separated)</div>
              <input className="form-input" style={{ margin: 0 }} placeholder="e.g. popia, rls, agent-prompt, authentication" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-org" onClick={save} disabled={saving || !form.title.trim() || !form.content.trim()}>
                {saving ? "Saving..." : "Save to knowledge base"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {["ALL", ...Object.keys(TYPES)].map(t => (
          <button key={t} onClick={() => setFilter(t)} className={"btn btn-sm " + (filter === t ? "btn-org" : "btn-ghost")}>
            {t === "ALL" ? `All (${memories.length})` : `${TYPES[t as keyof typeof TYPES].label} (${memories.filter(m => m.type === t).length})`}
          </button>
        ))}
        <input className="form-input" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: "auto", width: 200, margin: 0 }} />
      </div>

      {loading ? (
        <div className="empty">Loading knowledge base...</div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--g700)", marginBottom: 6 }}>No memories yet</div>
            <div style={{ fontSize: 12, color: "var(--g500)", marginBottom: 16 }}>Capture patterns and lessons from your deliveries to build institutional knowledge.</div>
            <button className="btn btn-org" onClick={() => setShowAdd(true)}>Capture your first memory</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 6 }}>
          {filtered.map(m => {
            const t = TYPES[m.type]
            const open = expanded === m.id
            return (
              <div key={m.id} className="card" style={{ cursor: "pointer" }} onClick={() => setExpanded(open ? null : m.id)}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: t.color, background: t.color + "18", padding: "2px 8px", borderRadius: 10, textTransform: "uppercase", flexShrink: 0 }}>{t.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--g900)", flex: 1 }}>{m.title}</span>
                    {m.project && <span style={{ fontSize: 10, color: "var(--g500)", flexShrink: 0 }}>{m.project.projectCode}</span>}
                    <span style={{ fontSize: 10, color: "var(--g400)", flexShrink: 0 }}>{new Date(m.createdAt).toLocaleDateString()}</span>
                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "var(--g400)", fill: "none", strokeWidth: 2, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
                  </div>
                  {!open && (
                    <div style={{ fontSize: 11, color: "var(--g500)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.content}</div>
                  )}
                  {open && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--g100)" }}>
                      <div style={{ fontSize: 12, color: "var(--g800)", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: m.tags.length ? 10 : 0 }}>{m.content}</div>
                      {m.tags.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          {m.tags.map(tag => <span key={tag} style={{ fontSize: 10, background: "var(--g100)", color: "var(--g600)", padding: "2px 8px", borderRadius: 10 }}>{tag}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
