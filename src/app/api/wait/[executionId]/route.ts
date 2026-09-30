import { type NextRequest, NextResponse } from "next/server";
import { queueWorkflowRun } from "@/features/workflows/server/run";
import prisma from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    include: { workflow: true },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  if (execution.status !== "WAITING") {
    return NextResponse.json(
      { error: `Execution is not waiting (status: ${execution.status})` },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));

  await prisma.execution.update({
    where: { id: executionId },
    data: {
      status: "RUNNING",
      waitTill: null,
    },
  });

  await queueWorkflowRun({
    workflowId: execution.workflowId,
    triggerType: "MANUAL",
    triggerPayload: body,
    replayFrom: { executionId, stepIndex: 0 },
  });

  return NextResponse.json({ ok: true, executionId });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> },
) {
  const { executionId } = await params;

  const execution = await prisma.execution.findUnique({
    where: { id: executionId },
    select: {
      id: true,
      status: true,
      waitTill: true,
      workflow: { select: { id: true, name: true } },
    },
  });

  if (!execution) {
    return NextResponse.json({ error: "Execution not found" }, { status: 404 });
  }

  return NextResponse.json({
    executionId: execution.id,
    status: execution.status,
    waitTill: execution.waitTill,
    workflow: execution.workflow,
    resumeUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/api/wait/${execution.id}`,
  });
}
