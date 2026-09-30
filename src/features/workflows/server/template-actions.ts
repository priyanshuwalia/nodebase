"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";
import { getWorkflowTemplate, type WorkflowTemplate } from "./templates";

const inputSchema = z.object({
  templateId: z.string().min(1),
});

async function materializeTemplate(userId: string, template: WorkflowTemplate) {
  const workflow = await prisma.workflow.create({
    data: {
      name: template.name,
      userId,
    },
  });

  const nodeIds: string[] = [];
  for (const spec of template.nodes) {
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

  const connections = template.connections.map((connection) => ({
    workflowId: workflow.id,
    fromNodeId: nodeIds[connection.from],
    toNodeId: nodeIds[connection.to],
    fromOutput: connection.fromOutput ?? "main",
    toInput: connection.toInput ?? "main",
  }));

  await prisma.connection.createMany({ data: connections });

  for (const index of template.nodes.keys()) {
    if (template.nodes[index].type === "WEBHOOK_TRIGGER") {
      await prisma.webhookEndpoint.create({
        data: {
          workflowId: workflow.id,
          nodeId: nodeIds[index],
          secret: crypto.randomUUID(),
        },
      });
    }
  }

  return workflow;
}

export async function createWorkflowFromTemplate(formData: FormData) {
  const session = await requireAuth();
  const result = inputSchema.safeParse({
    templateId: formData.get("templateId"),
  });

  if (!result.success) {
    throw new Error("Invalid template id");
  }

  const template = getWorkflowTemplate(result.data.templateId);
  if (!template) {
    throw new Error("Template not found");
  }

  const workflow = await materializeTemplate(session.user.id, template);
  redirect(`/workflows/${workflow.id}`);
}
