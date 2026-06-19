"use client"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { FolderOpen, ShieldCheck, Clock, GitBranch, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"

interface Stats {
  totalProjects: number
  compliantProjects: number
  pendingApprovals: number
  totalRepos: number
}

interface Project {
  id: string
  projectCode: string
  name: string
  department: string
  riskTier: string
  status: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalProjects: 0, compliantProjects: 0, pendingApprovals: 0, totalRepos: 0 })
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: allProjects }, { data: repos }, { data: deployments }] = await Promise.all([
        supabase.from("Project").select("id,projectCode,name,department,riskTier,status").order("createdAt", { ascending: false }).limit(5),
        supabase.from("Repository").select("id", { count: "exact" }),
        supabase.from("Deployment").select("id", { count: "exact" }).eq("status", "PENDING"),
      ])
      const proj = allProjects || []
      setProjects(proj)
      setStats({
        totalProjects: proj.length,
        compliantProjects: proj.filter((p: Project) => p.riskTier === "LOW" || p.riskTier === "MEDIUM").length,
        pendingApprovals: deployments?.length || 0,
        totalRepos: repos?.length || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const riskColour = (tier: string) => {
    if (tier === "LOW") return "#22a06b"
    if (tier === "MEDIUM") return "#f59e0b"
    if (tier === "HIGH") return "#e5483d"
    return "#991b1b"
  }

  const kpis = [
    { label: "Active projects", value: stats.totalProjects, accent: "var(--orange)", icon: FolderOpen },
    { label: "Compliant", value: stats.compliantProjects, accent: "var(--green)", icon: ShieldCheck },
    { label: "Pending approvals", value: stats.pendingApprovals, accent: "var(--red)", icon: Clock },
    { label: "Repos governed", value: stats.totalRepos, accent: "var(--grey-500)", icon: GitBranch },
  ]

  return (
    <div className="p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{color:"var(--grey-900)"}}>Good morning, Herman</h1>
          <p className="text-sm mt-0.5" style={{color:"var(--grey-500)"}}>AI Build Harness - governance platform</p>
        </div>
        <Link href="/projects/new">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{background:"var(--orange)"}}>
            <Plus size={14} /> Register project
          </button>
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border p-4 relative overflow-hidden" style={{borderColor:"var(--grey-100)"}}>
            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{background:k.accent}}></div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{color:"var(--grey-500)"}}>{k.label}</div>
            <div className="text-3xl font-bold" style={{color:"var(--grey-900)"}}>{loading ? "-" : k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border" style={{borderColor:"var(--grey-100)"}}>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{borderColor:"var(--grey-100)"}}>
            <h3 className="text-sm font-bold">Recent projects</h3>
            <Link href="/projects" className="text-xs font-semibold flex items-center gap-1" style={{color:"var(--orange)"}}>
              All projects <ArrowRight size={11} />
            </Link>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm" style={{color:"var(--grey-300)"}}>Loading...</div>
          ) : projects.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm mb-3" style={{color:"var(--grey-300)"}}>No projects yet</p>
              <Link href="/projects/new">
                <button className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{background:"var(--orange)"}}>Register your first project</button>
              </Link>
            </div>
          ) : (
            projects.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0 hover:bg-gray-50 cursor-pointer" style={{borderColor:"var(--grey-50)"}}>
                <span className="text-xs font-bold font-mono" style={{color:"var(--orange)", minWidth:"100px"}}>{p.projectCode}</span>
                <span className="text-sm font-semibold flex-1" style={{color:"var(--grey-900)"}}>{p.name}</span>
                <span className="text-xs" style={{color:"var(--grey-500)", minWidth:"70px"}}>{p.department}</span>
                {p.riskTier && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{background:riskColour(p.riskTier)}}>{p.riskTier}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="bg-white rounded-xl border" style={{borderColor:"var(--grey-100)"}}>
          <div className="px-4 py-3 border-b" style={{borderColor:"var(--grey-100)"}}>
            <h3 className="text-sm font-bold">Innovation pipeline</h3>
          </div>
          <div className="p-4">
            {["REGISTERED","IN_ASSESSMENT","APPROVED","BUILDING","LIVE"].map((stage, i) => {
              const count = projects.filter(p => p.status === stage).length
              const colours = ["var(--orange)","var(--orange)","var(--green)","var(--green)","var(--grey-700)"]
              const labels = ["Intake","In review","Approved","Building","Live"]
              return (
                <div key={stage} className="flex items-center gap-3 mb-3 last:mb-0">
                  <span className="text-xs font-semibold w-20 text-right" style={{color:"var(--grey-500)"}}>{labels[i]}</span>
                  <div className="flex-1 rounded-full h-2" style={{background:"var(--grey-100)"}}>
                    <div className="h-2 rounded-full transition-all" style={{width: count > 0 ? Math.max(8, count * 20)+"%" : "0%", background:colours[i]}}></div>
                  </div>
                  <span className="text-sm font-bold w-4" style={{color:colours[i]}}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}