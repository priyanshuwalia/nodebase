import { type NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";

const MAX_BODY_BYTES = 1024 * 1024;

function parseBody(text: string): unknown {
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;

  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { secret },
    include: {
      workflow: { select: { id: true, name: true } },
      node: { select: { id: true, name: true } },
    },
  });

  if (!endpoint || !endpoint.enabled) {
    return NextResponse.json(
      { error: "Webhook endpoint not found" },
      { status: 404 },
    );
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: "Failed to read request body" },
      { status: 400 },
    );
  }

  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "Request body too large (max 1MB)" },
      { status: 413 },
    );
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "cookie") {
      headers[key] = value;
    }
  });

  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const payload = {
    receivedAt: new Date().toISOString(),
    method: request.method,
    headers,
    query,
    body: parseBody(rawBody),
    rawBody,
    workflow: { id: endpoint.workflow.id, name: endpoint.workflow.name },
    node: { id: endpoint.node.id, name: endpoint.node.name },
  };

  const inngestEventId = crypto.randomUUID();
  const execution = await prisma.execution.create({
    data: {
      workflowId: endpoint.workflowId,
      inngestEventId,
      triggerType: "WEBHOOK",
    },
  });

  try {
    await inngest.send({
      id: inngestEventId,
      name: "execute/ai",
      data: {
        executionId: execution.id,
        workflowId: endpoint.workflowId,
        triggerType: "WEBHOOK",
        triggerPayload: payload,
        replayFrom: null,
      },
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
            : "Failed to queue webhook run",
        errorStack: error instanceof Error ? error.stack : null,
      },
    });

    return NextResponse.json(
      { error: "Failed to queue workflow run" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      received: true,
      executionId: execution.id,
      workflow: endpoint.workflow.name,
      node: endpoint.node.name,
    },
    { status: 200 },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ secret: string }> },
) {
  const { secret } = await params;
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { secret },
  });

  if (!endpoint || !endpoint.enabled) {
    return NextResponse.json(
      { error: "Webhook endpoint not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      method: "POST",
      message:
        "POST JSON or text to this URL to start a workflow run. The payload becomes the trigger output.",
    },
    { status: 200 },
  );
}
