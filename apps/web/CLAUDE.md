# Dotsure Build Harness — Claude Code Adapter

## Start here

Read `AGENTS.md` in this directory first. It contains the governing instructions for this repository.

This file is a Claude Code adapter — it does not replace `AGENTS.md`.

## ARC Harness context

This application is built under the ARC Harness Engineering operating model.

The canonical agent entrypoint for ARC governance is in the control repository:
- `https://github.com/dylanparctesting007-cyber/arc-harness-engineering/blob/main/AGENTS.md`

- Claude Code skills for this app repo are at:
- - `.claude/skills/arc-harness-app/SKILL.md`
 
  - ## Claude-specific behaviours
 
  - When working in this repo:
 
  - 1. **Do not call the Anthropic API directly from client components.** All AI calls go through `apps/web/app/api/concierge/route.ts` (Next.js server-side route). The key is `ANTHROPIC_API_KEY` in environment variables.
   
    2. 2. **Do not read `harness_anthropic_key` from localStorage.** This pattern has been removed. If you see it in existing code, remove it.
      
       3. 3. **Model tiers are already set in `pipeline/page.tsx`** — Agent 1 uses `claude-haiku-4-5-20251001`, Agents 2 and 3 use `claude-sonnet-4-6`. Do not change model assignments without recording the reason in the run ledger.
         
          4. 4. **Before adding new features**, check the lifecycle checklist on the pipeline page — the same 7 stages apply to harness changes too: Intent, Research, Spec, Governance, Design, Architecture, Orchestration.
            
             5. 5. **Generated code is proposed code.** Do not self-merge. Open a PR and route it through the ARC PR review workflow.
               
                6. ## Key file map
               
                7. | Purpose | File |
                8. |---|---|
                9. | Auth context and roles | `contexts/AuthContext.tsx` |
                10. | Supabase client | `lib/supabase.ts` |
                11. | Server-side AI proxy | `app/api/concierge/route.ts` |
                12. | Governance Concierge component | `components/Concierge.tsx` |
                13. | Build pipeline | `app/pipeline/page.tsx` |
                14. | Knowledge base | `app/memory/page.tsx` |
                15. | Systematic debug log | `app/debug/page.tsx` |
                16. | App layout + sidebar | `components/layout/` |
