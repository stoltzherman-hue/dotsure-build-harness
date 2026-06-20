# Dotsure Build Harness — Agent Entrypoint

## Governing methodology

This application is built under the **ARC Harness Engineering** operating model.

Before writing any code in this repository, read and follow:
- `arc-harness-engineering/AGENTS.md` — the universal agent entrypoint for ARC governance
- - `arc-harness-engineering/CLAUDE.md` — Claude Code adapter
 
  - The ARC Harness control repository is: `https://github.com/dylanparctesting007-cyber/arc-harness-engineering`
 
  - ## What this repository is
 
  - This is the **application repository** for the Dotsure AI Governance Platform — a live Next.js web application that registers, assesses, approves, and governs AI projects within Dotsure.
 
  - It is governed by `arc-harness-engineering`. Application code lives here. Methodology, workflow definitions, governance controls, and evidence standards live there.
 
  - ## Repository boundary
 
  - | This repo owns | arc-harness-engineering owns |
  - |---|---|
  - | Next.js frontend (`apps/web`) | Methodology and lifecycle controls |
  - | Express API (`apps/api`) | Workflow definitions and governance templates |
  - | Prisma schema and DB | Evidence standards and scorecards |
  - | Deployed application | Reusable agent memory |
 
  - ## Lifecycle gate
 
  - Before writing new application features, the experiment lifecycle gate must pass:
 
  - ```
    python .arc-harness/scripts/validate-lifecycle.py 03_experiments/<id> --through orchestration
    ```

    Run this from the arc-harness-engineering repo. Deviations must be recorded with reason and human approver — never skipped silently.

    ## Tech stack

    - **Framework**: Next.js 14 (App Router) — `apps/web`
    - - **API**: Express.js — `apps/api`
      - - **Database**: Supabase (PostgreSQL via Prisma)
        - - **Auth**: Supabase Auth with role-based access (GM / APPROVER / DEVELOPER)
          - - **AI**: Anthropic API via server-side route at `apps/web/app/api/concierge/route.ts`
            - - **Deployment**: Vercel (web), separate API host
             
              - ## Next.js version note
             
              - This version may have breaking changes from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
             
              - ## API key handling
             
              - The Anthropic API key is stored as a **server-side environment variable** (`ANTHROPIC_API_KEY`).
             
              - Do NOT read or write `harness_anthropic_key` from localStorage.
              - Do NOT call `https://api.anthropic.com/v1/messages` directly from client components.
              - All Anthropic calls must go through `apps/web/app/api/concierge/route.ts`.
             
              - ## Non-negotiable controls
             
              - - Do not commit `ANTHROPIC_API_KEY` or any secret values
                - - Do not merge generated code without a PR reviewed through the ARC PR review workflow
                  - - Do not deploy to production without a completed production bridge assessment
                    - - Humans approve material decisions — agents prepare evidence
