import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Silently skip if Resend not configured — email is non-blocking
    return NextResponse.json({ ok: true, skipped: true })
  }

  let body: { to: string[]; subject: string; html: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Dotsure Build Harness <onboarding@resend.dev>",
      to: body.to,
      subject: body.subject,
      html: body.html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
