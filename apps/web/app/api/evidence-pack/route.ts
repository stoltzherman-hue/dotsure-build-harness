import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// POST /api/evidence-pack
// Saves a machine-readable ARC evidence pack to Supabase and returns the saved record.
// Called by the pipeline page after a run completes.
// Schema mirrors ARC Harness EVIDENCE_PACK.md + CODING_RUN_SCORECARD.md

export async function POST(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Supabase env vars not configured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let body: Record<string, unknown>
    try {
          body = await req.json()
    } catch {
          return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

  const required = ["runId", "lifecycleGatePassed", "lifecycle", "scorecard", "agentOutputs"]
    const missing = required.filter(k => !(k in body))
    if (missing.length > 0) {
          return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 })
    }

  const pack = {
        projectId: body.projectId ?? null,
        runId: body.runId,
        createdAt: new Date().toISOString(),
        lifecycleGatePassed: body.lifecycleGatePassed,
        lifecycle: body.lifecycle,
        scorecard: body.scorecard,
        agentOutputs: body.agentOutputs,
        modelSelection: body.modelSelection ?? null,
        costEstimate: body.costEstimate ?? null,
        reviewStatus: "PENDING",
        reviewedBy: null,
        reviewedAt: null,
        recommendation: null,
        humanNotes: null,
  }

  const { data, error } = await supabase
      .from("EvidencePack")
      .insert(pack)
      .select()
      .single()

  if (error) {
        console.error("EvidencePack insert error:", error.message)
        // Graceful degradation — return pack for local download even if DB save fails
      return NextResponse.json({ pack, persisted: false, dbError: error.message }, { status: 200 })
  }

  return NextResponse.json({ pack: data, persisted: true }, { status: 201 })
}
