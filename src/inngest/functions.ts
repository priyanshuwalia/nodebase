import { CronExpressionParser } from "cron-parser";
import { executeWorkflow } from "@/features/workflows/server/execution";
import prisma from "@/lib/db";
import { inngest } from "./client";

function isDue(cron: string, now = new Date()): boolean {
  try {
    const interval = CronExpressionParser.parse(cron, { currentDate: now });
    const previous = interval.prev().getTime();
    const next = interval.next().getTime();
    return previous <= now.getTime() && now.getTime() < next;
  } catch {
    return false;
  }
}

export const execute = inngest.createFunction(
  { id: "execute-ai", retries: 0 },
  { event: "execute/ai" },
  async ({ event }) => {
    const { executionId, workflowId, triggerType, triggerPayload, replayFrom } =
      event.data as {
        executionId?: string;
        workflowId?: string;
        triggerType?: string;
        triggerPayload?: unknown;
        replayFrom?: { executionId: string; stepIndex: number } | null;
      };

    if (typeof executionId !== "string" || typeof workflowId !== "string") {
      throw new Error("execute/ai requires executionId and workflowId");
    }

    return executeWorkflow({
      executionId,
      workflowId,
      triggerType,
      triggerPayload,
      replayFrom,
    });
  },
);

export const scheduleCheck = inngest.createFunction(
  { id: "schedule-check", retries: 0 },
  { cron: "* * * * *" },
  async ({ step }) => {
    const scheduledNodes = await step.run("load-scheduled-nodes", () =>
      prisma.node.findMany({
        where: { type: "SCHEDULE_TRIGGER" },
        include: { workflow: { select: { userId: true } } },
      }),
    );

    const now = new Date();
    const due = scheduledNodes.filter((node) => {
      const data = (node.data ?? {}) as Record<string, unknown>;
      const cron = String(data.cron ?? "").trim();
      return cron && isDue(cron, now);
    });

    for (const node of due) {
      await step.run(`queue-${node.id}`, async () => {
        const inngestEventId = crypto.randomUUID();
        const execution = await prisma.execution.create({
          data: {
            workflowId: node.workflowId,
            inngestEventId,
            triggerType: "SCHEDULE",
          },
        });

        await inngest.send({
          id: inngestEventId,
          name: "execute/ai",
          data: {
            executionId: execution.id,
            workflowId: node.workflowId,
            triggerType: "SCHEDULE",
            triggerPayload: serialize({
              cron: String((node.data as Record<string, unknown>).cron ?? ""),
              firedAt: now.toISOString(),
            }),
            replayFrom: null,
          },
        });
      });
    }

    return { checkedAt: now.toISOString(), due: due.length };
  },
);

function serialize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null));
}
