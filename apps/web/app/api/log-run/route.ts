import { NextRequest, NextResponse } from "next/server"

// Server-side pipeline run logger.
// Uses SUPABASE_SERVICE_ROLE_KEY (server-only) to bypass RLS entirely.
// Client components call /api/log-run instead of inserting into Supabase directly.

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey || supabaseUrl.includes("placeholder")) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/PipelineRun`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Prefer": "return=minimal",
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
