# Nodebase

A self-hostable, developer-friendly **AI workflow automation platform** — a visual editor, background execution engine, secure credential storage, and a run inspector for debugging. Build and run AI automations the way you would with Zapier, n8n, or Pipedream, focused on the AI-workflow niche.

## What's inside

- **Visual workflow editor** — drag, connect, and configure nodes on a pan/zoom canvas (React Flow). Searchable node palette, inline config panel, branch outputs, and layout that persists across refreshes.
- **Execution engine** — runs nodes in topological order, detects cycles, stores per-step inputs/outputs/errors/durations, and supports manual, webhook, and cron-scheduled triggers.
- **Observability** — a run-by-run timeline with expandable inputs, outputs, logs, and errors; executors can replay a whole run or resume from the first failed step.
- **Secure credentials** — encrypted at rest (AES-256-GCM with an app secret), never returned to the browser after creation, scoped to the owning user, and filtered by provider.
- **Templates & seed data** — start from a real automation in one click, or seed a demo workspace with one command.

## Stack

Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · BetterAuth · tRPC · Inngest · Vercel AI SDK (Gemini, OpenAI, Anthropic) · React Flow · Tailwind CSS v4 · Bun

## Getting started

### 1. Configure environment

```bash
cp .env.example .env
```

Fill in at minimum `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `ENCRYPTION_KEY` (generate with `openssl rand -base64 32`). See `.env.example` for every optional variable (AI provider keys, Slack/Discord webhooks, Inngest, Sentry).

### 2. Database

```bash
bunx prisma migrate dev
bunx prisma generate
```

### 3. Run

```bash
bun install
bun run dev            # app at http://localhost:3000
bun run inngest:dev    # background execution (webhook/schedule triggers)
```

## Seed demo data

Creates the template workflows, setup-required placeholder credentials, and runs the demo executions whose provider keys are configured (runs that need a missing key are skipped — nothing is faked).

```bash
SEED_USER_EMAIL=you@example.com bun run seed
```

Then sign in with that email and open **/workflows** to explore.

## Core workflow loop

1. Create a workflow (or start from a template). 2. Add a trigger (Manual, Webhook, or Schedule). 3. Add AI, data, logic, or integration nodes. 4. Assign credentials where needed. 5. Validate, then **Run**. 6. Inspect the step-by-step execution trace. 7. Fix a failed step and replay.

### Node types

- **Triggers:** Manual, Webhook, Schedule (cron)
- **AI:** Gemini, OpenAI, Anthropic
- **Logic:** Condition (branch on any value), Delay
- **Data:** Transform JSON (interpolation templates), Extract Field
- **Integrations:** HTTP Request, Slack Message, Discord Message

Unimplemented node types are surfaced in the palette and fail at runtime with a clear error — the engine never silently fakes a success.

## Architecture

```
src/
  app/                    # routes (dashboard, editor, REST pages, API routes)
  components/             # shared UI + sidebar
  features/
    workflows/            # editor components, server router, execution engine,
                          #   graph/validation/interpolation, templates + seed actions
    credentials/          # encrypted credential types + server actions
    executions/           # run timeline components + detail page
  integrations/           # provider adapters: ai, http, slack, discord, transforms, nodes
  inngest/                # background execution client + functions
  lib/                    # auth, db, crypto
```

Key rules: route files stay thin; business logic lives in feature modules; node config and router inputs are validated with Zod; client components never import Prisma, auth helpers, or secrets; every workflow/credential/execution query is scoped to the authenticated user.

## Scripts

```bash
bun run dev        # dev server (Turbopack)
bun run build      # production build
bun run lint       # Biome
bunx tsc --noEmit  # typecheck
bun run seed       # demo data (requires SEED_USER_EMAIL)
bun run inngest:dev
```
