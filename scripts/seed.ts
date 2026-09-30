/**
 * Seed a demo workspace for a single user.
 *
 * Usage:
 *   SEED_USER_EMAIL=you@example.com bun run scripts/seed.ts
 *
 * Creates the template workflows, placeholder (setup-required) credentials,
 * and runs the demo executions that can succeed with the keys available in
 * environment. Runs that need a provider key that is not configured are
 * skipped with a note — nothing is faked.
 */

import { runWorkflowSynchronously } from "@/features/workflows/server/run";
import { WORKFLOW_TEMPLATES } from "@/features/workflows/server/templates";
import type { NodeType } from "@/generated/prisma";
import { type Prisma, PrismaClient } from "@/generated/prisma";
import { encryptSecret } from "@/lib/crypto";

const prisma = new PrismaClient();

const email = process.env.SEED_USER_EMAIL?.trim() ?? "";

if (!email) {
  console.error(
    "No seed user configured. Run with:\n\n  SEED_USER_EMAIL=you@example.com bun run scripts/seed.ts",
  );
  process.exit(1);
}

async function upsertUser() {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Using existing user ${email} (${existing.id})`);
    return existing;
  }
  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      name: email.split("@")[0],
      email,
      emailVerified: true,
    },
  });
  console.log(`Created user ${email} (${user.id})`);
  return user;
}

async function resetSeedWorkflows(userId: string) {
  const seeded = await prisma.workflow.findMany({
    where: { userId, name: { startsWith: "Template: " } },
    select: { id: true },
  });
  if (seeded.length > 0) {
    await prisma.workflow.deleteMany({
      where: { id: { in: seeded.map((workflow) => workflow.id) } },
    });
    console.log(
      `Removed ${seeded.length} previously seeded template workflow(s)`,
    );
  }
}

function buildNodeSpec(templateIndex: number, nodeIndex: number) {
  const template = WORKFLOW_TEMPLATES[templateIndex];
  const node = template.nodes[nodeIndex];
  return {
    name: node.name,
    type: node.type satisfies NodeType,
    position: node.position,
    data: node.data,
  };
}

async function createTemplateWorkflows(userId: string) {
  for (const [templateIndex, template] of WORKFLOW_TEMPLATES.entries()) {
    const workflow = await prisma.workflow.create({
      data: {
        name: `Template: ${template.name}`,
        userId,
      },
    });

    const nodeIds: string[] = [];
    for (let nodeIndex = 0; nodeIndex < template.nodes.length; nodeIndex++) {
      const spec = buildNodeSpec(templateIndex, nodeIndex);
      const node = await prisma.node.create({
        data: {
          workflowId: workflow.id,
          name: spec.name,
          type: spec.type,
          position: spec.position,
          data: spec.data as Prisma.InputJsonValue,
        },
      });
      nodeIds.push(node.id);
    }

    await prisma.connection.createMany({
      data: template.connections.map((connection) => ({
        workflowId: workflow.id,
        fromNodeId: nodeIds[connection.from],
        toNodeId: nodeIds[connection.to],
        fromOutput: connection.fromOutput ?? "main",
        toInput: connection.toInput ?? "main",
      })),
    });

    for (let nodeIndex = 0; nodeIndex < nodeIds.length; nodeIndex++) {
      if (template.nodes[nodeIndex].type === "WEBHOOK_TRIGGER") {
        await prisma.webhookEndpoint.create({
          data: {
            workflowId: workflow.id,
            nodeId: nodeIds[nodeIndex],
            secret: crypto.randomUUID(),
          },
        });
      }
    }

    console.log(
      `Created workflow "${template.name}" with ${nodeIds.length} nodes`,
    );
  }
}

async function createPlaceholderCredentials(userId: string) {
  const placeholders = [
    { name: "Gemini API key — setup required", type: "GEMINI" as const },
    { name: "OpenAI API key — setup required", type: "OPENAI" as const },
    { name: "Slack incoming webhook — setup required", type: "SLACK" as const },
  ];

  for (const placeholder of placeholders) {
    const exists = await prisma.credential.findFirst({
      where: { userId, name: placeholder.name },
    });
    if (exists) {
      continue;
    }
    await prisma.credential.create({
      data: {
        userId,
        name: placeholder.name,
        type: placeholder.type,
        value: encryptSecret(`seed-placeholder-${crypto.randomUUID()}`),
      },
    });
    console.log(`Created placeholder credential "${placeholder.name}"`);
  }
}

function findTemplateWorkflow(templateId: string) {
  const template = WORKFLOW_TEMPLATES.find((item) => item.id === templateId);
  if (!template) {
    return null;
  }
  return { templateId, ...template };
}

async function runDemo(
  userId: string,
  templateId: string,
  options: {
    triggerType?: "MANUAL" | "WEBHOOK" | "SCHEDULE";
    triggerPayload?: unknown;
    requiresEnv?: string[];
  } = {},
) {
  const template = findTemplateWorkflow(templateId);
  if (!template) {
    console.warn(`Unknown template "${templateId}" — skipped`);
    return;
  }

  const missing = (options.requiresEnv ?? []).filter(
    (key) => !process.env[key],
  );
  if (missing.length > 0) {
    console.warn(
      `Skipping demo run for "${template.name}": missing ${missing.join(", ")} — no run created`,
    );
    return;
  }

  const workflow = await prisma.workflow.findFirst({
    where: { userId, name: `Template: ${template.name}` },
  });
  if (!workflow) {
    console.warn(`Template workflow for "${template.name}" missing — skipped`);
    return;
  }

  const result = await runWorkflowSynchronously({
    workflowId: workflow.id,
    triggerType: options.triggerType ?? "MANUAL",
    ...(options.triggerPayload !== undefined
      ? { triggerPayload: options.triggerPayload }
      : {}),
  });

  const execution = await prisma.execution.findUnique({
    where: { id: result.executionId },
    select: { status: true, error: true },
  });

  if (result.ok) {
    console.log(
      `Demo run for "${template.name}": ${execution?.status} (${result.executionId})`,
    );
  } else {
    console.error(
      `Demo run for "${template.name}" FAILED (${result.executionId}):\n  ${execution?.error ?? "unknown error"}`,
    );
  }
}

async function main() {
  const user = await upsertUser();
  await resetSeedWorkflows(user.id);
  await createTemplateWorkflows(user.id);
  await createPlaceholderCredentials(user.id);

  await runDemo(user.id, "extract-fields");
  await runDemo(user.id, "stripe-payment-alert", {
    triggerType: "WEBHOOK",
    triggerPayload: {
      type: "charge.succeeded",
      data: {
        object: {
          id: "ch_3OQ4Bq",
          amount: 7500,
          currency: "usd",
          payment_method_details: { card: { last4: "4242" } },
        },
      },
    },
  });
  await runDemo(user.id, "classify-support", {
    requiresEnv: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  });
  await runDemo(user.id, "daily-digest", {
    triggerType: "SCHEDULE",
    requiresEnv: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  });
  await runDemo(user.id, "summarize-webhook-alert", {
    triggerType: "WEBHOOK",
    triggerPayload: {
      type: "incident.created",
      severity: "high",
      message: "API latency peaked at 4.2s during the 9am batch.",
    },
    requiresEnv: ["GOOGLE_GENERATIVE_AI_API_KEY", "SLACK_WEBHOOK_URL"],
  });

  console.log("");
  console.log(`Done. Log in with ${email} and open /workflows to explore.`);
  console.log(
    "Template workflows that skipped a run need a provider key; add it and press Run to see a fresh execution.",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
