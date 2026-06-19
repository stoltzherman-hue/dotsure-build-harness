"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/")
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.replace("/")
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--g50)" }}>
      <div className="card" style={{ width: 380, padding: 32 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "var(--g900)" }}>build harness</div>
          <div style={{ fontSize: 11, color: "var(--g500)", textTransform: "uppercase", letterSpacing: 1 }}>Dotsure Governance</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--g500)", display: "block", marginBottom: 4 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: "100%" }} autoFocus />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: "var(--g500)", display: "block", marginBottom: 4 }}>Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: "100%" }} />
          </div>
          {error && <div style={{ marginBottom: 14, fontSize: 12, color: "var(--red)" }}>{error}</div>}
          <button className="btn btn-org" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
