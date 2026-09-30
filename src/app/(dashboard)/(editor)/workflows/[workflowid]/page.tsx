import { notFound } from "next/navigation";

import { WorkflowEditor } from "@/features/workflows/components/editor/workflow-editor";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page({
  params,
}: {
  params: Promise<{ workflowid: string }>;
}) {
  const session = await requireAuth();
  const { workflowid } = await params;

  const workflow = await prisma.workflow.findFirst({
    where: {
      id: workflowid,
      userId: session.user.id,
    },
    include: {
      connections: true,
      nodes: {
        orderBy: { createdAt: "asc" },
        include: {
          credential: { select: { id: true, name: true, type: true } },
          webhookEndpoint: { select: { secret: true, enabled: true } },
        },
      },
    },
  });

  if (!workflow) {
    notFound();
  }

  const credentials = await prisma.credential.findMany({
    where: { userId: session.user.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  return (
    <WorkflowEditor
      credentials={credentials}
      initialConnections={workflow.connections.map((connection) => ({
        id: connection.id,
        fromNodeId: connection.fromNodeId,
        toNodeId: connection.toNodeId,
        fromOutput: connection.fromOutput,
        toInput: connection.toInput,
      }))}
      initialName={workflow.name}
      initialNodes={workflow.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        position: node.position,
        data: (node.data ?? {}) as Record<string, unknown>,
        credentialId: node.credentialId,
        webhookEndpoint: node.webhookEndpoint,
      }))}
      workflowId={workflow.id}
    />
  );
}
