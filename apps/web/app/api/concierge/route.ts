import { NextRequest, NextResponse } from "next/server"

// Server-side Anthropic proxy.
// The API key never leaves the server. Client components call /api/concierge instead
// of reaching https://api.anthropic.com directly.
// Set ANTHROPIC_API_KEY in your Vercel environment variables (or .env.local for dev).

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const DEFAULT_MODEL = "claude-sonnet-4-6"
const DEFAULT_MAX_TOKENS = 4000

export async function POST(req: NextRequest) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
          return NextResponse.json(
            { error: "ANTHROPIC_API_KEY is not configured. Add it to your Vercel environment variables." },
            { status: 500 }
                )
    }

  let body: Record<string, unknown>
    try {
          body = await req.json()
    } catch {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

  const { model, max_tokens, system, messages, stream } = body

  const upstream = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
                model: model ?? DEFAULT_MODEL,
                max_tokens: max_tokens ?? DEFAULT_MAX_TOKENS,
                system,
                messages,
                stream: stream ?? false,
        }),
  })

  if (!upstream.ok) {
        const err = await upstream.text()
        return NextResponse.json({ error: err }, { status: upstream.status })
  }

  // Pass streaming responses straight through
  if (stream && upstream.body) {
        return new Response(upstream.body, {
                status: 200,
                headers: {
                          "Content-Type": "text/event-stream",
                          "Cache-Control": "no-cache",
                          "X-Accel-Buffering": "no",
                },
        })
  }

  const data = await upstream.json()
    return NextResponse.json(data)
}
