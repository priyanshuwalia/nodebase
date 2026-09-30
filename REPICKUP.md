# 🔁 REPICKUP.md — Nodebase Project Resume Guide

> **Generated:** 2026-08-11 · **Codebase scanned:** 100% · **Last commit:** `eb16e5a schema updated`

---

## 🛠️ Automated Fixes Applied

| # | File | Fix |
|---|------|-----|
| 1 | `.env.example` *(new file)* | Created from all `process.env` and Inngest/auth usages across the codebase. Includes documented placeholders for every required and planned variable, including optional OAuth keys referenced in login/register forms (GitHub & Google). |

> **No source code was modified.** The codebase passed Biome lint/format checks with 0 errors (38 files scanned).

---

## 1. Project Overview

### Purpose

**Nodebase** is a **visual AI workflow automation platform** — think a self-hosted, developer-first alternative to n8n or Zapier, specialized for AI pipelines.

Users can:
- Create named **workflows** with connected **nodes** (triggers + AI steps)
- Nodes represent AI providers (OpenAI, Gemini, Anthropic), webhooks, or external services (Slack, Discord, Stripe, Google Forms)
- Trigger workflow executions manually or via webhooks
- Monitor **execution history** with status, output, and error details
- Store reusable **credentials** (API keys) attached to workflow nodes

### Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Turbopack) |
| **Language** | TypeScript 5 |
| **Database** | PostgreSQL (NeonDB serverless) via Prisma ORM 6 |
| **Auth** | BetterAuth 1.3 (email/password + social OAuth stubs) |
| **API Layer** | tRPC v11 + TanStack Query v5 |
| **Background Jobs** | Inngest 3.54 (durable functions, AI step wrapping) |
| **AI SDKs** | Vercel AI SDK 5 + `@ai-sdk/google` (Gemini 2.5 Flash) |
| **UI Components** | Shadcn/ui (Base UI) + Radix UI + Tailwind CSS v4 |
| **Styling** | Tailwind CSS v4, `tw-animate-css`, CSS variables for theming |
| **Forms** | React Hook Form 7 + Zod 4 validation |
| **Error Tracking** | Sentry v10 |
| **Linting/Formatting** | Biome 2.2 |
| **Process Manager** | mprocs (runs Next.js + Inngest dev server together) |
| **Package Manager** | Bun |

---

## 2. Current State Summary

### What Works (Complete)

- **Authentication**: Email/password sign-up & sign-in via BetterAuth. `requireAuth()` / `requireUnauth()` guards on all protected pages.
- **Workflow list page** (`/workflows`): Create new workflows, view table of existing ones (node count, execution count, last updated).
- **Workflow editor page** (`/workflows/[workflowid]`): View workflow nodes as absolute-positioned cards, rename workflow, add a hardcoded "OpenAI step" node, view recent executions panel.
- **Executions list** (`/executions`): Table of all runs across all workflows with status badges and timestamps.
- **Execution detail** (`/executions/[id]`): Shows run summary, Inngest event ID, and output/error payload.
- **Credentials list** (`/credentials`): Table of stored API key credentials with provider type and node usage count.
- **Credential detail** (`/credentials/[id]`): Shows credential provider info and all nodes using it.
- **App Sidebar**: Collapsible sidebar with Workflows / Credentials / Executions navigation + sign-out.
- **Prisma schema**: Fully defined — `User`, `Session`, `Account`, `Verification`, `Credential`, `Workflow`, `Node`, `Connection`, `Execution`.
- **Database migrations**: 3 migrations applied (`init`, `init` v2, `workflow`).
- **tRPC setup**: Provider, context, `baseProcedure`, `protectedProcedure` all wired.
- **Inngest integration**: Client, route handler (`/api/inngest`), and a proof-of-concept `execute-ai` function using Gemini.
- **Error tracking**: Sentry with `global-error.tsx` configured.
- **Environment**: All secrets in `.env`; `.env.example` now generated.

### What Is Partial (In-Progress)

- **Workflow editor**: Canvas renders static node cards at DB positions. No drag-and-drop, no live node editing, no connection drawing. The **"Run" button has no handler** — it does nothing.
- **Node configuration panel**: Editor's right sidebar shows only counts and recent executions. No form to configure node data (prompt, credential, model).
- **Inngest execution function** (`src/inngest/functions.ts`): Demo stub — hardcoded "what is 2+2" Gemini prompt. Real function that chains workflow nodes is not built yet.
- **Social OAuth (GitHub/Google)**: Login/register forms have social buttons calling `authClient.signIn.social(...)`, but `better-auth`'s `socialProviders` plugin is **not configured** in `src/lib/auth.ts`. Clicking them will fail at runtime.
- **`workflowsRouter`** (`src/features/workflows/server/router.ts`): Exists but is an empty tRPC router — no procedures. The main `appRouter` directly holds workflow procedures instead.
- **Credential creation UI**: No form or dialog to add a new credential. The credentials page is read-only.
- **Node connections**: Rendered as a simple text label at node edge — no SVG arrows drawn.
- **`add node` action**: Always creates an `OPENAI` node. No node type picker exists.

### What Is Missing / Broken

- **`src/features/workflows/`**: Only contains a stub `server/router.ts`. No client-side feature components exist (untracked in git — never committed).
- **Realtime middleware** (`src/inngest/client.ts`): Commented out — planned but not implemented.
- **`superjson` tRPC transformer**: Commented out — Date objects arrive as strings over tRPC, not as `Date` instances.
- **"Upgrade to Pro" / "Billing Portal"** buttons in sidebar: `onClick={() => {}}` — completely non-functional stubs.
- **No tests**: Zero test files found anywhere. No testing framework installed.
- **Register form name bug** (`register-form.tsx:89`): `name: values.email` — the display name is set to the user's email address. No separate name input field exists.

---

## 3. Quickstart Guide

### Prerequisites

- **Bun** >= 1.x (`brew install bun`)
- **Node.js** >= 20 (for type tooling)
- **PostgreSQL** database — [NeonDB free tier](https://neon.tech) recommended

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your actual secrets (see Section 6 for all variables)
```

### 3. Run database migrations

```bash
bunx prisma migrate deploy
# Or for development (creates a new migration if schema changed):
bunx prisma migrate dev
```

### 4. Generate Prisma client

```bash
bunx prisma generate
# Output goes to: src/generated/prisma/
```

### 5. Run the full dev stack

```bash
bun run dev:all
# mprocs starts both:
#   - Next.js dev server  → http://localhost:3000
#   - Inngest dev server  → http://localhost:8288
```

Or run separately:

```bash
# Terminal 1 — Next.js
bun run dev

# Terminal 2 — Inngest
bun run inngest:dev
```

### 6. Run tests

```bash
# No test suite exists yet — see Priority 3 in Section 5.
```

### 7. Lint / format

```bash
bun run lint      # biome check (read-only report)
bun run format    # biome format --write (auto-fix)
```

---

## 4. Developer Onboarding Map

### Directory Structure

```
nodebase/
├── prisma/
│   ├── schema.prisma          # Database schema — SOURCE OF TRUTH
│   └── migrations/            # 3 applied SQL migration folders
│
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout — fonts, TRPCProvider, Toaster
│   │   ├── page.tsx           # Root page — redirects / → /workflows
│   │   ├── globals.css        # Global styles, CSS vars, Tailwind imports
│   │   ├── global-error.tsx   # Sentry top-level error boundary
│   │   │
│   │   ├── (auth)/            # Route group — no sidebar layout
│   │   │   ├── layout.tsx     # Simple centered auth layout
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   │
│   │   ├── (dashboard)/       # Route group — all pages with sidebar
│   │   │   ├── layout.tsx     # SidebarProvider + AppSidebar wrapper
│   │   │   ├── (rest)/        # Standard dashboard pages with header
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── workflows/page.tsx
│   │   │   │   ├── credentials/page.tsx
│   │   │   │   ├── credentials/[id]/page.tsx
│   │   │   │   ├── executions/page.tsx
│   │   │   │   └── executions/[id]/page.tsx
│   │   │   └── (editor)/      # Fullscreen editor — no top header bar
│   │   │       └── workflows/[workflowid]/page.tsx
│   │   │
│   │   └── api/
│   │       ├── auth/[...all]/route.ts   # BetterAuth request handler
│   │       ├── inngest/route.ts         # Inngest serve (GET/POST/PUT)
│   │       └── trpc/[trpc]/route.ts    # tRPC HTTP handler
│   │
│   ├── components/
│   │   ├── AppSidebar.tsx     # Main navigation sidebar (client component)
│   │   ├── appHeader.tsx      # Simple breadcrumb header
│   │   └── ui/                # Shadcn/ui components — DO NOT MANUALLY EDIT
│   │
│   ├── features/              # Feature-scoped code
│   │   ├── auth/components/
│   │   │   ├── Login-form.tsx      # Email/password + social login form
│   │   │   ├── register-form.tsx   # Sign-up form (has name bug on line 89)
│   │   │   └── auth-layout.tsx     # Centered auth card layout wrapper
│   │   └── workflows/server/
│   │       └── router.ts      # EMPTY tRPC router stub — develop here next
│   │
│   ├── hooks/
│   │   └── use-mobile.ts      # useIsMobile() responsive hook
│   │
│   ├── inngest/
│   │   ├── client.ts          # Inngest("nodebase") client instance
│   │   └── functions.ts       # Background function defs — currently a demo stub
│   │
│   ├── lib/
│   │   ├── auth.ts            # BetterAuth server instance + Prisma adapter
│   │   ├── auth-client.ts     # BetterAuth browser client (used in forms)
│   │   ├── auth-utils.ts      # requireAuth() / requireUnauth() helpers
│   │   ├── db.ts              # Prisma singleton (HMR-safe for dev)
│   │   └── utils.ts           # cn() Tailwind class merge helper
│   │
│   ├── trpc/
│   │   ├── init.ts            # tRPC instance, context factory, protectedProcedure
│   │   ├── client.tsx         # TRPCReactProvider (wraps entire client app)
│   │   ├── server.tsx         # Server-side tRPC caller utility
│   │   ├── query-client.ts    # TanStack Query client factory
│   │   └── routers/_app.ts    # Root router: getWorkflows, createWorkflow
│   │
│   └── generated/prisma/      # Auto-generated Prisma client — DO NOT EDIT
```

### Data Flow

**Page request (React Server Component):**
```
Browser GET /workflows
  → Next.js App Router routes to RSC
  → src/app/(dashboard)/(rest)/workflows/page.tsx
  → requireAuth() → BetterAuth validates session cookie from headers
  → prisma.workflow.findMany({ where: { userId } })
  → Renders JSX table of workflows → browser
```

**Mutations (Server Actions — current pattern used in pages):**
```
User clicks "New workflow" → submits <form action={createWorkflow}>
  → createWorkflow() Server Action (marked "use server") runs on server
  → requireAuth() → validate session
  → prisma.workflow.create({ data: { name, userId, nodes: { create: {...} } } })
  → redirect(`/workflows/${workflow.id}`)
```

**tRPC (fully wired, underused — expand here):**
```
Client component calls useTRPC().getWorkflows.useQuery()
  → TRPCReactProvider → POST /api/trpc/getWorkflows
  → protectedProcedure: validates session via BetterAuth headers
  → prisma.workflow.findMany(...)
  → JSON → TanStack Query cache → component re-renders
```

**Background execution via Inngest (partial/planned):**
```
[Future] "Run" button → Server Action or tRPC mutation
  → inngest.send({ name: "execute/ai", data: { workflowId } })
  → Inngest picks up event → execute() function fires
  → Loads Workflow + Nodes from Prisma
  → Runs nodes in order, step.ai.wrap() for AI calls
  → Updates Execution record (status, output, error)
```

### Where to Add New Features

| Feature | Location |
|---|---|
| New tRPC endpoint | `src/trpc/routers/_app.ts` or `src/features/[name]/server/router.ts` → merge into `_app.ts` |
| New dashboard page | `src/app/(dashboard)/(rest)/[pagename]/page.tsx` |
| New editor view | `src/app/(dashboard)/(editor)/[pagename]/page.tsx` |
| New Inngest function | `src/inngest/functions.ts` (export) → register in `src/app/api/inngest/route.ts` |
| New Shadcn component | `bunx shadcn add [component-name]` → auto-outputs to `src/components/ui/` |
| New client-side feature | `src/features/[name]/` — mirror the `auth` directory structure |
| Configure OAuth providers | `src/lib/auth.ts` → add `socialProviders` plugin |

---

## 5. Next Steps (Prioritized)

### PRIORITY 1 — Critical: Get to Runnable State

**1. Wire the "Run" button to trigger a workflow execution**
- Location: `src/app/(dashboard)/(editor)/workflows/[workflowid]/page.tsx` line 155
- Add a Server Action (or tRPC mutation) that calls `inngest.send({ name: "execute/ai", data: { workflowId } })`
- Create an `Execution` DB record (status: RUNNING, inngestEventId) before sending the event
- Redirect or link to `/executions/[id]` after triggering

**2. Build the real Inngest execution function**
- Location: `src/inngest/functions.ts`
- Replace the hardcoded demo with: load Workflow + Nodes + Connections from DB → sort nodes topologically → execute each node in order using `step.ai.wrap()` → update `Execution` record with output/error/status

**3. Fix the register form name bug**
- Location: `src/features/auth/components/register-form.tsx` line 89
- Change `name: values.email` to `name: values.name`
- Add a `name: z.string().min(1, "Name is required")` field to `registerSchema`
- Add the `<FormField>` for the name input in JSX (above the email field)

**4. Fix or disable social OAuth buttons**
- Option A (enable): Add `socialProviders: { github: { clientId: ..., clientSecret: ... }, google: { ... } }` to `src/lib/auth.ts`
- Option B (disable): Wrap buttons in `{process.env.GITHUB_CLIENT_ID && <Button>...}` to hide when not configured

### PRIORITY 2 — Core Product Features

**5. Interactive workflow canvas** (the main product value)
- Drag-to-reposition nodes and persist position via tRPC mutation
- SVG/canvas connection arrows between nodes
- Click node → slide-over config panel (prompt, model, credential)
- Node type picker dropdown when adding a new step

**6. Credential creation flow**
- Add a "+ New Credential" dialog/sheet on the `/credentials` page
- Form fields: name (text), type (OPENAI / ANTHROPIC / GEMINI select), API key (password input)
- Server action or tRPC mutation to `prisma.credential.create(...)`
- Optional: encrypt the `value` field at rest before persisting

**7. Node credential assignment**
- In the workflow editor node config panel, show a dropdown of saved credentials filtered by type
- Persist `Node.credentialId` via tRPC mutation

**8. Real-time execution status**
- Uncomment Inngest Realtime middleware in `src/inngest/client.ts`
- Stream step-by-step execution status to the editor UI while a workflow runs

### PRIORITY 3 — Tech Debt & Cleanup

**9. Migrate page Server Actions → tRPC `workflowsRouter`**
- Move `createWorkflow`, `renameWorkflow`, `addNode` from page files to `src/features/workflows/server/router.ts`
- Merge `workflowsRouter` into `appRouter` in `_app.ts`
- Invalidate TanStack Query caches on mutation success

**10. Add `superjson` data transformer**
- `bun add superjson`
- Uncomment `// transformer: superjson` in `src/trpc/init.ts` and `src/trpc/client.tsx`
- Fixes Date object serialization across the tRPC boundary

**11. Set up a test suite**
- `bun add -d vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event`
- Test: Zod schemas in auth forms, `requireAuth()` behavior, tRPC procedure input validation

**12. Implement billing or remove stubs**
- "Upgrade to Pro" and "Billing Portal" buttons have `onClick={() => {}}` — integrate Stripe Billing Portal or remove them until needed

**13. Extract hardcoded URLs to env vars**
- `src/lib/auth-client.ts`: Replace `baseURL: "http://localhost:3000"` with `baseURL: process.env.NEXT_PUBLIC_APP_URL`

---

## 6. Environment & Configuration

### All Required Environment Variables

| Variable | Required | Description | Example Value |
|---|---|---|---|
| `DATABASE_URL` | YES | PostgreSQL connection string | `postgresql://user:pass@host/db?sslmode=require` |
| `BETTER_AUTH_SECRET` | YES | Session signing secret (32+ chars) | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | YES | Public URL of your app | `http://localhost:3000` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | YES | Gemini API key for AI steps | From [aistudio.google.com](https://aistudio.google.com) |
| `SENTRY_AUTH_TOKEN` | OPTIONAL | Enables Sentry source map uploads | From sentry.io project settings |
| `VERCEL_URL` | AUTO | Set automatically by Vercel on deploy | `yourapp.vercel.app` |
| `GITHUB_CLIENT_ID` | PLANNED | GitHub OAuth app client ID | GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | PLANNED | GitHub OAuth app client secret | GitHub Developer Settings |
| `GOOGLE_CLIENT_ID` | PLANNED | Google OAuth client ID | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | PLANNED | Google OAuth client secret | Google Cloud Console |

> See `.env.example` in the project root for a copy-paste ready template.

### External Services

| Service | How It Is Used |
|---|---|
| **PostgreSQL / NeonDB** | Primary database — users, sessions, workflows, nodes, connections, executions, credentials |
| **Inngest** | Durable background job runner for workflow executions. Dev dashboard at `localhost:8288` |
| **Google Gemini** | AI model powering the proof-of-concept execution function (`gemini-2.5-flash`) |
| **Sentry** | Runtime error monitoring and source map tracking |
| **GitHub / Google OAuth** | Planned social login providers — UI buttons exist but server config is missing |

---

## 7. Known Issues & Gotchas

### Bugs

| # | File | Line | Description |
|---|---|---|---|
| 1 | `register-form.tsx` | 89 | `name: values.email` — user display name is set to their email. No separate name field. |
| 2 | `workflows/[workflowid]/page.tsx` | 155 | "Run" `<Button>` has no onClick or form action. Clicking it does nothing. |
| 3 | `Login-form.tsx`, `register-form.tsx` | — | GitHub/Google buttons will throw at runtime — `socialProviders` not configured server-side. |
| 4 | `workflows/[workflowid]/page.tsx` | 79 | `addNode` hardcodes `type: "OPENAI"`. No other node type can be added via UI. |

### Gotchas & Unusual Patterns

1. **Prisma client is in `src/generated/prisma/`**, not `node_modules/@prisma/client`. The schema specifies `output = "../src/generated/prisma"`. If the generated folder is missing or stale, run `bunx prisma generate`.

2. **Biome excludes `src/components/ui/`** — these are Shadcn-managed auto-generated files. Don't manually lint or edit them; re-run `bunx shadcn add` if they need to change.

3. **`bun run dev:all` uses mprocs** — it starts Next.js AND the Inngest dev server in a split-pane terminal. Both must be running for full dev functionality (otherwise triggering events won't be processed).

4. **Two tRPC routers coexist** — `src/trpc/routers/_app.ts` (active, has `getWorkflows` and `createWorkflow`) and `src/features/workflows/server/router.ts` (empty stub, not merged). Only `_app.ts` is wired into the request handler.

5. **Mutations currently live in page files as Server Actions** — `createWorkflow`, `renameWorkflow`, `addNode` are `"use server"` functions defined inline in page components. This is valid Next.js but makes them non-reusable from client components. Extraction to tRPC is deferred to Priority 3.

6. **`auth-client.ts` `baseURL` is hardcoded** to `http://localhost:3000`. This must be updated or removed before deploying to production.

7. **`BETTER_AUTH_URL` must be correct** — BetterAuth uses this to construct OAuth callback URLs and email verification links. An incorrect value causes silent auth failures.

8. **All `src/components/ui/` files show as git-modified** — this is the expected result of Shadcn regenerating the component library. The changes are safe and intentional; commit them with `git add src/components/ui/`.

9. **`src/features/workflows/` is untracked in git** — the directory was created locally but never committed. It is the primary feature area to build next.

10. **`superjson` is commented out** — Date values fetched via tRPC arrive on the client as ISO 8601 strings, not native `Date` objects. Call `new Date(value)` as a workaround until `superjson` is added.

11. **`Assumption`**: The `Execution.inngestEventId` field is marked `@unique`, meaning each Inngest event maps to exactly one execution. Do not reuse event IDs when retrying failed runs — send a new event and create a new `Execution` record.

---

*Generated by Antigravity on 2026-08-11. Update this file as features land.*
