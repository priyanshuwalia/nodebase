import "server-only";

import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { executeWorkflow } from "./execution";

export type WorkflowRunRequest = {
  workflowId: string;
  userId?: string;
  triggerType?: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  triggerPayload?: unknown;
  replayFrom?: { executionId: string; stepIndex: number } | null;
};

function makeEventData(request: WorkflowRunRequest & { executionId: string }) {
  return {
    executionId: request.executionId,
    workflowId: request.workflowId,
    triggerType: request.triggerType ?? "MANUAL",
    triggerPayload: request.triggerPayload ?? undefined,
    replayFrom: request.replayFrom ?? null,
  };
}

export async function queueWorkflowRun(
  request: WorkflowRunRequest,
): Promise<string> {
  const inngestEventId = crypto.randomUUID();

  const execution = await prisma.execution.create({
    data: {
      workflowId: request.workflowId,
      inngestEventId,
      triggerType: request.triggerType ?? "MANUAL",
      retryOf: request.replayFrom?.executionId ?? null,
    },
  });

  try {
    await inngest.send({
      id: inngestEventId,
      name: "execute/ai",
      data: makeEventData({ ...request, executionId: execution.id }),
    });
  } catch (error) {
    await prisma.execution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error:
          error instanceof Error
            ? error.message
            : "Failed to queue workflow run",
        errorStack: error instanceof Error ? error.stack : null,
      },
    });
  }

  return execution.id;
}

export async function runWorkflowSynchronously(
  request: WorkflowRunRequest,
): Promise<{ executionId: string; ok: boolean }> {
  const inngestEventId = crypto.randomUUID();

  const execution = await prisma.execution.create({
    data: {
      workflowId: request.workflowId,
      inngestEventId,
      triggerType: request.triggerType ?? "MANUAL",
      retryOf: request.replayFrom?.executionId ?? null,
    },
  });

  const result = await executeWorkflow({
    executionId: execution.id,
    workflowId: request.workflowId,
    triggerType: request.triggerType ?? "MANUAL",
    triggerPayload: request.triggerPayload,
    replayFrom: request.replayFrom,
  });

  return { executionId: execution.id, ok: result.ok };
}
