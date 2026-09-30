import type { Connection, Node } from "@/generated/prisma";
import { isImplemented, isTriggerType } from "@/integrations/nodes/registry";
import { validateNodeConfig } from "@/integrations/nodes/schemas";
import { orderAndReach } from "./graph";

export type WorkflowValidation = {
  ok: boolean;
  errors: string[];
};

export function validateWorkflowGraph(
  nodes: Pick<Node, "id" | "name" | "type" | "data" | "createdAt">[],
  connections: Connection[],
): WorkflowValidation {
  const errors: string[] = [];

  const connectivity = orderAndReach(nodes, connections);

  if (!connectivity.ok) {
    errors.push(connectivity.error);
  } else {
    const unreachable = nodes.filter(
      (node) => !connectivity.reachableIds.has(node.id),
    );
    if (unreachable.length > 0) {
      errors.push(
        `Nodes not connected to the trigger will never run: ${unreachable
          .map((node) => node.name)
          .join(", ")}. Connect them to the trigger chain.`,
      );
    }
  }

  const triggers = nodes.filter((node) => isTriggerType(node.type));

  if (triggers.length === 0) {
    errors.push(
      "This workflow has no trigger. Add a Manual, Webhook, or Schedule trigger to run it.",
    );
  } else if (triggers.length > 1) {
    errors.push(
      `Workflows can only have one trigger, but this one has several: ${triggers
        .map((trigger) => trigger.name)
        .join(", ")}`,
    );
  }

  for (const node of nodes) {
    if (!isImplemented(node.type)) {
      errors.push(
        `Node "${node.name}" uses type ${node.type}, which is not implemented yet. Remove it or replace it with a supported node.`,
      );
    }

    const configErrors = validateNodeConfig(node.type, node.data);
    for (const configError of configErrors) {
      errors.push(`Node "${node.name}": ${configError}`);
    }
  }

  return { ok: errors.length === 0, errors };
}
