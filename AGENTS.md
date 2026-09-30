# AGENTS.md — Nodebase SaaS-Grade Build Guide

You are working on **Nodebase**, a visual AI workflow automation platform. Your job is not to make a toy demo. Your job is to turn this into a **9.5/10 resume project** that can credibly be compared with Zapier, n8n, Make, and Pipedream for the AI-workflow niche.

This document is the source of truth for future agents. Read it before editing code. Then inspect the current implementation, preserve existing user work, and build in small, verified increments.

## Product North Star

Nodebase should become a self-hostable, developer-friendly automation SaaS focused on AI workflows.

The finished project should let users:

- Build workflows visually with nodes, edges, triggers, actions, AI steps, conditions, transforms, and webhook endpoints.
- Connect credentials securely for providers such as OpenAI, Anthropic, Gemini, Slack, Discord, Stripe, HTTP APIs, and webhooks.
- Run workflows manually, on schedule, or from external webhook events.
- Inspect execution history step by step, including inputs, outputs, latency, retries, errors, and logs.
- Debug failed runs and replay from failed steps.
- Use workflow templates to create real automations quickly.
- Understand the product within 60 seconds from a seeded demo workspace.

The resume story should be: **“I built a production-quality AI automation platform with a visual workflow editor, background execution engine, secure credential handling, realtime run observability, and SaaS-grade product polish.”**

## Current Stack

- Framework: Next.js 15 App Router
- Language: TypeScript
- Database: PostgreSQL with Prisma
- Auth: BetterAuth
- API: tRPC and Server Actions
- Background jobs: Inngest
- AI: Vercel AI SDK, Gemini currently wired
- UI: Tailwind CSS v4, Shadcn-style components, lucide-react
- Package manager: Bun
- Lint/format: Biome

Prefer existing project patterns over new frameworks. Do not introduce a large new dependency unless it clearly improves core product quality.

## Non-Negotiable Build Principles

1. Ship an actual product, not a landing page.
2. Every visible control must do something useful or be removed.
3. Workflow execution must be persisted, inspectable, and debuggable.
4. Credentials must never be exposed back to the browser after creation.
5. Multi-user isolation is mandatory: every workflow, credential, node, connection, and execution query must be scoped to the authenticated user.
6. Empty states must lead users to the next action.
7. The app must pass `bun run lint`, `bunx tsc --noEmit`, and `bun run build`.
8. UI must be responsive at mobile, tablet, and desktop widths.
9. Do not manually edit generated Prisma client files or bulk-generated Shadcn UI internals unless the task explicitly requires it.
10. Preserve user changes. Never reset or overwrite unrelated dirty files.

## Competitive Bar

Nodebase does not need all Zapier/n8n features, but it must match their core value loop:

1. User creates a workflow.
2. User adds a trigger.
3. User adds one or more actions.
4. User connects credentials.
5. User tests each step.
6. User runs the whole workflow.
7. User sees a clear execution trace.
8. User can fix errors and run again.

If this loop is not excellent, do not spend time on billing, marketing, or decorative UI.

## MVP+ Feature Requirements

### 1. Workflow Editor

Build a serious editor, not static cards.

Required:

- Pan and zoom canvas.
- Drag nodes and persist positions.
- Connect nodes visually with SVG edges.
- Delete nodes and edges with confirmation where destructive.
- Node type picker with searchable categories.
- Click node to open a configuration panel.
- Validate required fields before running.
- Show unsaved/saved state when editing node config.
- Support at least these node categories:
  - Triggers: Manual Trigger, Webhook Trigger, Schedule Trigger
  - AI: OpenAI, Anthropic, Gemini
  - Logic: Condition, Delay
  - Data: Transform JSON, Extract Field
  - Integrations: HTTP Request, Slack Message, Discord Message, Stripe Event

Strong recommendation: use a proven graph library such as React Flow for canvas interaction unless the current codebase already has an equivalent.

Acceptance criteria:

- A user can create a workflow with a manual trigger and two AI/data steps.
- A user can drag nodes, connect them, save, refresh, and see the same layout.
- Invalid workflows display clear validation messages before execution.

### 2. Execution Engine

The execution engine must feel real and reliable.

Required:

- Execute nodes in topological order.
- Detect cycles and fail validation with a useful message.
- Store per-step input, output, status, startedAt, completedAt, duration, retry count, and error.
- Support manual runs from the editor.
- Support webhook-triggered runs with unique webhook URLs.
- Support scheduled runs using Inngest cron or equivalent.
- Mark executions as `RUNNING`, `SUCCESS`, `FAILED`, or `CANCELLED`.
- Make failed executions replayable from the start. Replay-from-step is a stretch goal.
- Show execution logs in the UI.

Implementation guidance:

- Keep orchestration in `src/inngest/functions.ts` or feature-scoped execution modules imported from it.
- Move provider-specific execution into small adapter functions.
- Never trust node `data` blindly. Validate with Zod schemas before execution.
- Store JSON outputs in Prisma JSON columns, but normalize them to serializable JSON.

Acceptance criteria:

- Running a valid workflow creates an execution and updates it after every step.
- Failed provider calls show the failing node, error message, and stack/server detail where appropriate.
- Execution detail page can be used as a debugging tool without opening server logs.

### 3. Credentials And Security

Credential handling must look production-aware.

Required:

- Create, list, rename, and delete credentials.
- Never render stored secret values in plaintext.
- Encrypt credential values at rest using an app secret.
- Show masked previews such as `sk-...abcd`.
- Restrict credential assignment to credentials owned by the current user.
- Filter credential options by compatible provider type.
- Add copy that makes clear credentials are used only server-side.

Acceptance criteria:

- A credential can be created and assigned to a node.
- Refreshing the page never exposes the raw key.
- Deleting a credential prevents future runs of dependent nodes and shows a clear error.

### 4. Integrations

To be competitive with Zapier/n8n, Nodebase must include useful integrations, not placeholders.

Required first integrations:

- HTTP Request node:
  - Method, URL, headers, query params, JSON body
  - Timeout and error handling
  - Use previous step output with variable interpolation
- Webhook Trigger node:
  - Generated endpoint URL
  - Captures headers, query, and body
  - Shows recent payloads
- Slack Message node:
  - Send message to channel via bot token or webhook URL
- Discord Message node:
  - Send message via webhook URL
- Stripe Event trigger:
  - Validate webhook signature when secret is configured
  - Parse event type and payload

AI provider support:

- Gemini must work with current Vercel AI SDK wiring.
- OpenAI and Anthropic nodes should be implemented if the packages are installed. If packages are not installed, either add them deliberately or make the UI clearly mark them as setup-required.

Acceptance criteria:

- A user can build: Webhook Trigger → AI Summary → Slack/Discord Message.
- A user can build: Manual Trigger → HTTP Request → Transform JSON → AI Step.

### 5. Templates And Demo Data

The project must showcase well.

Required templates:

- “Summarize webhook payload and send Slack alert”
- “Transform API response and generate AI brief”
- “Classify support message”
- “Stripe payment alert”
- “Daily scheduled AI digest”

Required demo experience:

- Provide a seed script that creates a demo user, workflows, credentials placeholders, nodes, connections, and executions.
- Add a dashboard or templates page where users can create a workflow from a template.
- Make the first-run experience obvious.

Acceptance criteria:

- A reviewer can run one command to seed demo data.
- The app looks impressive before any manual setup beyond `.env`.

### 6. Observability

Required:

- Execution list filters: status, workflow, date range.
- Execution detail timeline.
- Per-node execution logs.
- Dashboard metrics: total workflows, runs today, success rate, failures, average duration.
- Sentry should remain configured for runtime error reporting.

Stretch:

- Realtime updates in the editor while a workflow is running.
- Toast notifications when a run starts/fails/succeeds.

### 7. SaaS Product Polish

Required:

- App sidebar should contain only working destinations/actions.
- Pages should have consistent empty, loading, and error states.
- Auth should support email/password reliably.
- OAuth buttons should exist only if providers are configured.
- Add a proper README with screenshots/GIFs once core features are working.
- Add `.env.example` with every required variable.
- Add meaningful loading states for slow operations.

Do not add billing until the product loop is strong. If billing UI exists before Stripe is implemented, remove it or mark it as unavailable without dead buttons.

## Data Model Expectations

Current Prisma models include users, credentials, workflows, nodes, connections, and executions. Expand carefully.

Likely needed additions:

- `ExecutionStep`
  - `id`
  - `executionId`
  - `nodeId`
  - `status`
  - `input`
  - `output`
  - `error`
  - `startedAt`
  - `completedAt`
  - `durationMs`
  - `attempt`
- `WebhookEndpoint`
  - `id`
  - `workflowId`
  - `nodeId`
  - `secret`
  - `enabled`
  - `createdAt`
- `WorkflowTemplate`
  - Can be static TypeScript data at first; database-backed templates are optional.

Migration rule:

- Every Prisma schema change needs a migration.
- Run `bunx prisma generate` after schema changes.
- Prefer additive migrations while the project is moving fast.

## API And Architecture Rules

Recommended structure:

```txt
src/features/workflows/
  components/
  lib/
  server/
    router.ts
    execution.ts
    validation.ts
    templates.ts

src/features/credentials/
  components/
  server/

src/features/executions/
  components/
  server/

src/integrations/
  ai/
  http/
  slack/
  discord/
  stripe/
```

Rules:

- Keep route files thin.
- Put reusable server logic in feature modules.
- Use Zod schemas for all node config, router inputs, webhook payloads, and execution inputs.
- Prefer tRPC for client-driven mutations and queries.
- Server Actions are acceptable for simple forms, but avoid duplicating business logic inside pages.
- Do not let client components import Prisma, BetterAuth server helpers, or secrets.

## UI/UX Standards

This should feel like a polished operational SaaS tool.

Design direction:

- Dense, calm, scannable interface.
- No decorative landing-page composition inside the product.
- Use icons for node types and actions.
- Keep cards restrained. Use full-width layouts for main sections.
- Avoid nested cards.
- Use clear status badges and timeline UI.
- Make tables sortable/filterable when the dataset benefits from it.

Editor UX:

- Left: node palette or workflow navigation.
- Center: canvas.
- Right: selected node config or run inspector.
- Top bar: workflow name, save state, validate, test, run.

Execution UX:

- Show a vertical timeline of steps.
- Each step expands to input, output, logs, and error.
- Include duration and provider/model metadata.

## Quality Gates

Before saying a task is done, run the relevant subset:

```bash
bun run lint
bunx tsc --noEmit
bun run build
```

For database changes:

```bash
bunx prisma migrate dev
bunx prisma generate
```

For full local verification:

```bash
bun run dev
bun run inngest:dev
```

Manual smoke test:

1. Sign up.
2. Create a credential.
3. Create a workflow.
4. Add and configure nodes.
5. Connect nodes.
6. Run workflow.
7. Confirm execution succeeds.
8. Confirm execution detail shows step outputs.
9. Create a failing workflow and confirm the error is understandable.
10. Refresh pages and confirm data persists.

## Resume-Grade Definition Of Done

A 9.5/10 version of Nodebase has:

- A visual drag-and-drop workflow builder.
- Real connections and validation.
- Manual, webhook, and scheduled triggers.
- At least five useful node types fully implemented.
- Secure credential storage with encryption.
- Step-level execution history and debugging.
- Templates and seeded demo data.
- Strong README with architecture, screenshots, setup, and demo script.
- Clean TypeScript, lint, and production build.
- No dead UI.
- No obvious multi-user data leaks.
- A reviewer can understand the product value in under one minute.

## Recommended Build Order

Follow this order unless the user explicitly asks otherwise:

1. Stabilize auth, environment, and README.
2. Move workflow business logic into feature server modules.
3. Add React Flow editor with persisted node positions and edges.
4. Add node config schemas and validation.
5. Add `ExecutionStep` model and timeline UI.
6. Implement manual run with step-level execution.
7. Implement HTTP Request and Transform JSON nodes.
8. Implement secure encrypted credentials.
9. Implement Webhook Trigger.
10. Implement Slack/Discord message nodes.
11. Implement schedule trigger.
12. Add templates and seed script.
13. Add dashboard metrics and filters.
14. Add realtime execution updates.
15. Polish responsive UI and README screenshots.

## Prompt For Future Agents

When asked to continue this project, use this operating prompt:

> You are upgrading Nodebase into a SaaS-grade AI workflow automation platform competitive with Zapier and n8n for AI workflows. Read `AGENTS.md`, `REPICKUP.md`, `README.md`, `prisma/schema.prisma`, and the relevant feature files before editing. Prioritize the core workflow loop: build, configure, connect, run, inspect, debug. Preserve user changes. Ship cohesive increments with lint, typecheck, and build verification. Remove dead UI. Make every feature demonstrable.

## Final Reminder

Do not optimize for checklist volume. Optimize for the reviewer saying:

> “This feels like a real product. I can see the engineering judgment, product thinking, and execution depth.”
