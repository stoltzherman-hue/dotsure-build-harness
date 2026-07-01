import { NextRequest, NextResponse } from "next/server"

// Server-side proxy so BUILD_CALLBACK_SECRET never reaches the browser.
// The pipeline page (client component) calls this route; this route attaches
// the secret and forwards to Leader OS.
// Set LEADER_OS_URL and BUILD_CALLBACK_SECRET in Vercel env vars.

export async function POST(req: NextRequest) {
  const leaderOsUrl = process.env.LEADER_OS_URL
  const secret = process.env.BUILD_CALLBACK_SECRET

  if (!leaderOsUrl || !secret) {
    return NextResponse.json(
      { error: "LEADER_OS_URL or BUILD_CALLBACK_SECRET is not configured" },
      { status: 500 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const upstream = await fetch(`${leaderOsUrl}/api/builds/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-callback-secret": secret },
      body: JSON.stringify(body),
    })
    return NextResponse.json({ ok: upstream.ok }, { status: upstream.ok ? 200 : 502 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
