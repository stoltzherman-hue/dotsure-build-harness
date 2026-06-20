---
name: arc-harness-app
description: >
  ARC Harness application repo adapter for dotsure-build-harness.
    Use when working in this repository to ensure ARC governance controls apply.
      Triggers: any coding, architecture, review, debugging, or deployment task in this repo.
      argument-hint: "[feature | fix | review | debug | deploy] [details]"
      ---

      # ARC Harness App Adapter — Dotsure Build Harness

      ## Purpose

      This skill connects `dotsure-build-harness` to the ARC Harness Engineering operating model.

      This is the **application repository**. It is governed by:
      `https://github.com/dylanparctesting007-cyber/arc-harness-engineering`

      Before proceeding with any material task, read `apps/web/AGENTS.md` in this repository and `AGENTS.md` in the arc-harness-engineering control repository.

      ## This repository in one sentence

      A live Next.js + Express governance platform for Dotsure that registers, risk-assesses, compliance-scores, and governs AI projects — deployed on Vercel, backed by Supabase.

      ## Routing

      | Task | Use |
      |---|---|
      | New feature or experiment | Start with lifecycle checklist in `apps/web/app/pipeline/page.tsx`, then arc-harness `arc-experiment-intake.yaml` |
      | Governed coding task | `arc-harness-engineering/.arc-harness/workflows/arc-coding-starter.yaml` |
      | PR review | `arc-harness-engineering/.arc-harness/workflows/arc-pr-review.yaml` |
      | Debugging a failure | `apps/web/app/debug/page.tsx` — log the session, then `arc-systematic-debugging.yaml` |
      | Deployment | `arc-harness-engineering/.arc-harness/workflows/arc-deployment-setup.yaml` |
      | Production readiness | `arc-harness-engineering/.arc-harness/workflows/arc-production-bridge.yaml` |
      | Capturing lessons | `apps/web/app/memory/page.tsx` — also `arc-memory-capture.yaml` |

      ## Pipeline architecture

      The build pipeline lives at `apps/web/app/pipeline/page.tsx`.

      It is the **UI layer** for the ARC Harness execution model:

      ```
      Intent → Research → Spec → Governance → Design → Architecture → Orchestration → Build
      ```

      The 7-stage pre-flight checklist in the pipeline UI maps directly to the ARC lifecycle gate. Both must pass before implementation begins.

      Agent model tiers in the pipeline:
      - Agent 1 (Product Scoper): `claude-haiku-4-5-20251001` — fast intake
      - Agent 2 (Tech Architect): `claude-sonnet-4-6` — balanced reasoning
      - Agent 3 (Governance Assessor): `claude-sonnet-4-6` — balanced reasoning

      Do not change model assignments without recording the reason in the run ledger.

      ## AI API handling

      All Anthropic API calls in this repo go through the server-side proxy:

      ```
      apps/web/app/api/concierge/route.ts
      ```

      The key is `ANTHROPIC_API_KEY` — a Vercel environment variable. It never touches the client.

      Do NOT call `https://api.anthropic.com` directly from any client component. Do NOT read any API key from localStorage.

      ## Non-negotiable controls

      - No production secrets committed to the repo
      - No self-merge of generated code — PR required
      - No production deployment without a completed ARC production bridge assessment
      - Generated code is proposed code until reviewed
      - Humans approve material decisions — agents prepare evidence
      - Deviations from the lifecycle must be recorded with reason and human approver

      ## Memory and learning

      After each material run, capture the lesson:
      - In the platform: `apps/web/app/memory/page.tsx`
      - In the harness: `arc-harness-engineering/05_workflow_capture/`
