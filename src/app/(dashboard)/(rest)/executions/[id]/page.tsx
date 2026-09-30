import { notFound } from "next/navigation";

import {
  type ExecutionData,
  type ExecutionStepData,
  ExecutionTimeline,
} from "@/features/executions/components/execution-timeline";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;

  const execution = await prisma.execution.findFirst({
    where: {
      id,
      workflow: {
        userId: session.user.id,
      },
    },
    include: {
      workflow: {
        select: {
          id: true,
          name: true,
        },
      },
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!execution) {
    notFound();
  }

  const initialRun: ExecutionData = {
    id: execution.id,
    status: execution.status,
    triggerType: execution.triggerType,
    startedAt: execution.startedAt.toISOString(),
    completedAt: execution.completedAt?.toISOString() ?? null,
    error: execution.error,
    errorStack: execution.errorStack,
    workflow: {
      id: execution.workflow.id,
      name: execution.workflow.name,
    },
    steps: execution.steps.map((step): ExecutionStepData => {
      const input =
        step.input !== null && typeof step.input === "object"
          ? step.input
          : null;
      const output =
        step.output !== null && typeof step.output === "object"
          ? step.output
          : null;
      return {
        id: step.id,
        nodeName: step.nodeName,
        nodeType: step.nodeType,
        status: step.status,
        order: step.order,
        input,
        output,
        error: step.error,
        errorStack: step.errorStack,
        startedAt: step.startedAt.toISOString(),
        completedAt: step.completedAt?.toISOString() ?? null,
        durationMs: step.durationMs,
        attempt: step.attempt,
      };
    }),
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Execution details
        </h1>
        <p className="text-sm text-muted-foreground">
          Step-by-step trace of one run, with inputs, outputs, and errors.
        </p>
      </div>
      <ExecutionTimeline executionId={execution.id} initialRun={initialRun} />
    </div>
  );
}
