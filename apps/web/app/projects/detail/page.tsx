"use client"
import { useEffect, useState, Suspense } from "react"
import { createClient } from "@/lib/supabase"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

interface Project {
  id: string; projectCode: string; name: string; projectType: string
  department: string; businessProblem: string; riskTier: string
  riskScore: number; status: string; costCentre: string
  businessOwnerId: string; technicalOwnerId: string
  expectedSavingsZar: number; estimatedUsers: number
  targetGoLive: string; createdAt: string
}

const riskColor = (t: string) => ({ LOW:"var(--grn)", MEDIUM:"var(--amb)", HIGH:"var(--red)", CRITICAL:"var(--red-dk)" }[t] || "var(--g500)")
const riskBadgeClass = (t: string) => ({ LOW:"badge-low", MEDIUM:"badge-medium", HIGH:"badge-high", CRITICAL:"badge-critical" }[t] || "badge-pending")
const statusBadgeClass = (s: string) => ({ REGISTERED:"badge-org", IN_ASSESSMENT:"badge-warn", APPROVED:"badge-ok", BUILDING:"badge-pur", LIVE:"badge-ok", REJECTED:"badge-fail" }[s] || "badge-pending")

function toBase64(str: string) { return btoa(unescape(encodeURIComponent(str))) }

function ProjectDetailInner() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || ""
  const supabase = createClient()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [mockupHtml, setMockupHtml] = useState<string | null>(null)
  const [mockupSavedAt, setMockupSavedAt] = useState<string | null>(null)
  const [mockupError, setMockupError] = useState<string | null>(null)
  const [scaffolding, setScaffolding] = useState(false)
  const [scaffoldResult, setScaffoldResult] = useState<{ repoUrl: string } | null>(null)
  const [scaffoldError, setScaffoldError] = useState<string | null>(null)
  const [githubToken, setGithubToken] = useState("")
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [docs, setDocs] = useState<any[]>([])
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)
  const [anthropicKey, setAnthropicKey] = useState("")
  const [showKeyInput, setShowKeyInput] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from("Project").select("*").eq("id", id).single(),
      supabase.from("ProjectMockup").select("html,generatedAt").eq("projectId", id).order("generatedAt", { ascending: false }).limit(1).single(),
      supabase.from("ProjectDocument").select("*").eq("projectId", id).order("createdAt", { ascending: true })
    ]).then(([{ data: proj }, { data: mockup }, { data: docData }]) => {
      setProject(proj)
      if (mockup) { setMockupHtml(mockup.html); setMockupSavedAt(mockup.generatedAt) }
      setDocs(docData || [])
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!mockupHtml) return
    const frame = document.getElementById("mockup-frame") as HTMLIFrameElement
    if (!frame) return
    const blob = new Blob([mockupHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    frame.src = url
    return () => URL.revokeObjectURL(url)
  }, [mockupHtml])

  const generateMockup = async () => {
    if (!project) return
    if (!anthropicKey) { setShowKeyInput(true); return }
    setGenerating(true)
    setMockupError(null)
    try {
      const prompt = `You are an expert UI/UX designer and frontend developer. Generate a complete, interactive, visually impressive HTML mockup for this project.

PROJECT:
- Name: ${project.name}
- Type: ${project.projectType}
- Department: ${project.department}
- Business problem: ${project.businessProblem || "Not specified"}
- Estimated users: ${project.estimatedUsers || "Not specified"}

REQUIREMENTS:
1. Single complete HTML file with embedded CSS and JavaScript
2. Production-quality modern design - LIGHT background (white or very light grey), NEVER dark
3. Realistic sample data for South African insurance company Dotsure
4. Interactive - buttons respond, tabs switch, forms feel live
5. Multiple sections appropriate for the project type
6. Sidebar or top navigation as appropriate
7. Charts, tables, or data visualisations where relevant
8. Responsive, looks great at 1200px wide
9. CSS variables, smooth transitions and hover states
10. Header with project name and Dotsure branding (orange #e86c00 accent)
11. Realistic SA data - rand amounts (R format), SA dates (DD/MM/YYYY), SA names

CRITICAL: Return ONLY raw HTML. No markdown, no explanation, no code fences. Start with <!DOCTYPE html>.`

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
      })
      if (!res.ok) { setMockupError(`Claude API error: ${res.status}`); setGenerating(false); return }
      const data = await res.json()
      const html = data.content?.[0]?.text || ""
      if (!html.includes("<html") && !html.includes("<!DOCTYPE")) { setMockupError("Invalid response - try again"); setGenerating(false); return }
      setMockupHtml(html)
      await supabase.from("ProjectMockup").delete().eq("projectId", project.id)
      const { data: saved } = await supabase.from("ProjectMockup").insert({ projectId: project.id, html, projectName: project.name, projectType: project.projectType }).select("generatedAt").single()
      if (saved) setMockupSavedAt(saved.generatedAt)
    } catch (e: any) { setMockupError(e.message || "Network error") }
    setGenerating(false)
  }

  const createScaffold = async () => {
    if (!project || !githubToken) return
    setScaffolding(true)
    setScaffoldError(null)
    try {
      const repoName = `dotsure-${project.projectCode.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
      const createRes = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: { "Authorization": `Bearer ${githubToken}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
        body: JSON.stringify({ name: repoName, description: `${project.name} - ${project.projectType} | ${project.department} | Dotsure AI Build Harness`, private: true, auto_init: false }),
      })
      if (!createRes.ok) { const err = await createRes.json(); setScaffoldError(err.message || "Failed"); setScaffolding(false); return }
      const repo = await createRes.json()
      const files: Record<string, string> = {
        "README.md": `# ${project.name}\n\n**Project code:** ${project.projectCode}\n**Type:** ${project.projectType}\n**Department:** ${project.department}\n\nGenerated by Dotsure AI Build Harness on ${new Date().toISOString()}\n`,
        "package.json": JSON.stringify({ name: repoName, version: "0.1.0", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "14.2.5", react: "^18", "react-dom": "^18", typescript: "^5", "@supabase/supabase-js": "^2" }, devDependencies: { "@types/node": "^20", "@types/react": "^18", "@types/react-dom": "^18", tailwindcss: "^3", autoprefixer: "^10", postcss: "^8" } }, null, 2),
        "src/app/layout.tsx": `import type { Metadata } from "next"\nimport "./globals.css"\nexport const metadata: Metadata = { title: "${project.name}", description: "${project.projectType} | ${project.department} | Dotsure" }\nexport default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }\n`,
        "src/app/globals.css": `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
        "src/app/page.tsx": `export default function Home() { return <main className="min-h-screen p-8 bg-gray-50"><div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8"><span className="bg-orange-100 text-orange-700 text-xs font-bold px-3 py-1 rounded-full">${project.projectCode}</span><h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">${project.name}</h1><p className="text-gray-500">${project.department} | Dotsure AI Build Harness</p></div></main> }\n`,
        ".gitignore": `.env.local\nnode_modules/\n.next/\nout/\n`,
        "GOVERNANCE.md": `# Governance\n\nProject: ${project.projectCode}\nDepartment: ${project.department}\nGenerated: ${new Date().toISOString()}\n\nAll deployments require 4-gate approval at https://dotsure-build-harness.netlify.app/deployments\n`,
      }
      for (const [filePath, content] of Object.entries(files)) {
        await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${filePath}`, {
          method: "PUT",
          headers: { "Authorization": `Bearer ${githubToken}`, "Accept": "application/vnd.github+json", "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
          body: JSON.stringify({ message: `scaffold: add ${filePath}`, content: toBase64(content) }),
        })
      }
      setScaffoldResult({ repoUrl: repo.html_url })
      await supabase.from("Project").update({ status: "BUILDING" }).eq("id", project.id)
      setProject(p => p ? { ...p, status: "BUILDING" } : p)
    } catch (e: any) { setScaffoldError(e.message || "Network error") }
    setScaffolding(false)
  }

  if (loading) return <div className="content"><div className="empty">Loading...</div></div>
  if (!project) return <div className="content"><div className="empty">Project not found</div></div>

  return (
    <div className="content">
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/projects"><button className="btn btn-ghost btn-sm">Back</button></Link>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="proj-id">{project.projectCode}</span>
              <span className={"badge " + riskBadgeClass(project.riskTier)}>{project.riskTier}</span>
              <span className={"badge " + statusBadgeClass(project.status)}>{project.status.replace("_", " ")}</span>
            </div>
            <h1 style={{ marginTop: 4 }}>{project.name}</h1>
          </div>
        </div>
        <button className="btn btn-org" onClick={generateMockup} disabled={generating} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {generating
            ? <><svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "white", fill: "none", strokeWidth: 2, animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>Generating...</>
            : <><svg viewBox="0 0 24 24" style={{ width: 16, height: 16, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>{mockupHtml ? "Regenerate" : "Generate mockup"}</>
          }
        </button>
      </div>

      {showKeyInput && (
        <div className="card">
          <div className="card-head"><h3>Anthropic API key required</h3></div>
          <div className="card-body">
            <div style={{ fontSize: 12, color: "var(--g700)", marginBottom: 10 }}>Used in-browser only. Never stored.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="form-input" type="password" placeholder="sk-ant-..." value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} style={{ flex: 1, margin: 0 }} />
              <button className="btn btn-org" onClick={() => { setShowKeyInput(false); setTimeout(generateMockup, 50) }} disabled={!anthropicKey}>Generate</button>
              <button className="btn btn-ghost" onClick={() => setShowKeyInput(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <div className="card-head"><h3>Project details</h3></div>
          <div style={{ padding: "12px 16px", display: "grid", gap: 10 }}>
            {[
              { label: "Type", value: project.projectType },
              { label: "Department", value: project.department },
              { label: "Cost centre", value: project.costCentre || "-" },
              { label: "Business owner", value: project.businessOwnerId || "-" },
              { label: "Technical owner", value: project.technicalOwnerId || "-" },
              { label: "Target go-live", value: project.targetGoLive ? new Date(project.targetGoLive).toLocaleDateString("en-ZA") : "-" },
              { label: "Estimated users", value: project.estimatedUsers ? project.estimatedUsers.toLocaleString() : "-" },
              { label: "Expected savings", value: project.expectedSavingsZar ? `R${Number(project.expectedSavingsZar).toLocaleString("en-ZA")}` : "-" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, borderBottom: "1px solid var(--g100)", paddingBottom: 8 }}>
                <span style={{ color: "var(--g500)", fontWeight: 600 }}>{row.label}</span>
                <span style={{ color: "var(--g900)", textAlign: "right" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Risk profile</h3></div>
          <div style={{ padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: riskColor(project.riskTier), lineHeight: 1 }}>{project.riskScore}</div>
            <div style={{ fontSize: 11, color: "var(--g500)", marginBottom: 12 }}>Risk score / 100</div>
            <span className={"badge " + riskBadgeClass(project.riskTier)} style={{ fontSize: 13, padding: "4px 12px" }}>{project.riskTier} RISK</span>
          </div>
          {project.businessProblem && (
            <div style={{ padding: "0 16px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--g500)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Business problem</div>
              <div style={{ fontSize: 12, color: "var(--g700)", lineHeight: 1.6 }}>{project.businessProblem}</div>
            </div>
          )}
        </div>
      </div>

      {mockupError && (
        <div style={{ background: "#fff0f0", border: "1px solid var(--red)", borderRadius: 8, padding: "12px 16px", fontSize: 12, color: "var(--red)" }}>
          {mockupError} <button className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={generateMockup}>Retry</button>
        </div>
      )}

      {mockupHtml && (
        <div className="card">
          <div className="card-head">
            <div>
              <h3>AI-generated mockup</h3>
              <div style={{ fontSize: 11, color: "var(--g500)" }}>
                Interactive prototype for {project.name}
                {mockupSavedAt && <span style={{ marginLeft: 8, color: "var(--grn)", fontWeight: 600 }}>Saved {new Date(mockupSavedAt).toLocaleDateString("en-ZA")}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!scaffoldResult && (
                <button className="btn btn-org" onClick={() => setShowTokenInput(t => !t)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, stroke: "white", fill: "none", strokeWidth: 2, strokeLinecap: "round" }}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22" /></svg>
                  Approve and build
                </button>
              )}
            </div>
          </div>
          {showTokenInput && !scaffoldResult && (
            <div style={{ padding: "12px 16px", background: "var(--g50)", borderBottom: "1px solid var(--g100)" }}>
              <div style={{ fontSize: 11, color: "var(--g700)", marginBottom: 8, fontWeight: 600 }}>GitHub Personal Access Token (repo scope). Used in-browser only, never stored.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="form-input" type="password" placeholder="ghp_xxxxxxxxxxxx" value={githubToken} onChange={e => setGithubToken(e.target.value)} style={{ flex: 1, margin: 0 }} />
                <button className="btn btn-org" onClick={createScaffold} disabled={scaffolding || !githubToken}>{scaffolding ? "Creating..." : "Create repo and scaffold"}</button>
              </div>
              {scaffoldError && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 8 }}>Error: {scaffoldError}</div>}
            </div>
          )}
          {scaffoldResult && (
            <div style={{ padding: "12px 16px", background: "#f0fff4", borderBottom: "1px solid var(--grn)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 8 }}>Repository created and scaffold pushed.</div>
              <a href={scaffoldResult.repoUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View GitHub repo</a>
            </div>
          )}
          <div style={{ borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
            <iframe id="mockup-frame" style={{ width: "100%", height: 640, border: "none", display: "block" }} title="AI-generated mockup" />
          </div>
        </div>
      )}
      {docs.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>Project documents</h3>
            <a href="/library" style={{ fontSize: 11, color: "var(--org)", fontWeight: 600 }}>View all in library</a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, padding: "12px 16px" }}>
            {["product.md","techstack.md","governance.md","evidence-pack.md"].map(filename => {
              const doc = docs.find((d: any) => d.filename === filename)
              const colors: Record<string,string> = { "product.md":"var(--org)", "techstack.md":"var(--grn)", "governance.md":"#7c3aed", "evidence-pack.md":"#7c3aed" }
              const color = colors[filename] || "var(--g500)"
              return (
                <div key={filename} onClick={() => doc && setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                  style={{ border: `1px solid ${doc ? (selectedDoc?.id === doc.id ? color : "var(--g200)") : "var(--g100)"}`, borderRadius: 8, padding: "10px 12px", cursor: doc ? "pointer" : "default", opacity: doc ? 1 : 0.4, transition: "all 0.15s" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: doc ? color : "var(--g300)", marginBottom: 4 }}>{filename}</div>
                  {doc ? <div style={{ fontSize: 9, color: "var(--grn)", fontWeight: 700 }}>{new Date(doc.createdAt).toLocaleDateString("en-ZA")}</div>
                    : <div style={{ fontSize: 9, color: "var(--g300)" }}>Not generated</div>}
                </div>
              )
            })}
          </div>
          {selectedDoc && (
            <div style={{ borderTop: "1px solid var(--g100)", padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--g900)" }}>{selectedDoc.filename}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { const b = new Blob([selectedDoc.content], { type: "text/markdown" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = selectedDoc.filename; a.click(); URL.revokeObjectURL(u) }}>Download</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(selectedDoc.content)}>Copy</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDoc(null)}>Close</button>
                </div>
              </div>
              <pre style={{ fontSize: 11, color: "var(--g800)", whiteSpace: "pre-wrap", lineHeight: 1.7, maxHeight: 400, overflowY: "auto", margin: 0, fontFamily: "inherit" }}>{selectedDoc.content}</pre>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function ProjectDetailPage() {
  return (
    <Suspense fallback={<div className="content"><div className="empty">Loading...</div></div>}>
      <ProjectDetailInner />
    </Suspense>
  )
}


