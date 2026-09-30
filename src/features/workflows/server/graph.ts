import type { NodeType } from "@/generated/prisma";
import { isTriggerType } from "@/integrations/nodes/registry";

export type GraphNode = {
  id: string;
  name: string;
  type: NodeType;
  createdAt: Date | string;
};

export type EdgeLike = {
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string;
};

export type OrderResult =
  | { ok: true; orderedIds: string[]; reachableIds: Set<string> }
  | { ok: false; error: string };

export function orderAndReach(
  nodes: GraphNode[],
  edges: EdgeLike[],
): OrderResult {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodes.map((node) => node.id));

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const reachable = new Set<string>();

  for (const node of nodes) {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      continue;
    }
    indegree.set(edge.toNodeId, (indegree.get(edge.toNodeId) ?? 0) + 1);
    outgoing.set(edge.fromNodeId, [
      ...(outgoing.get(edge.fromNodeId) ?? []),
      edge.toNodeId,
    ]);
  }

  const triggers = nodes.filter((node) => isTriggerType(node.type));

  function collectReachable(startIds: string[]) {
    const stack = [...startIds];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || reachable.has(current)) {
        continue;
      }
      reachable.add(current);
      for (const target of outgoing.get(current) ?? []) {
        stack.push(target);
      }
    }
  }

  collectReachable(triggers.map((trigger) => trigger.id));

  const byCreatedAt = [...nodes].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const queue = byCreatedAt.filter((node) => indegree.get(node.id) === 0);
  const orderedIds: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      continue;
    }
    orderedIds.push(node.id);

    for (const targetId of outgoing.get(node.id) ?? []) {
      const nextDegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextDegree);
      if (nextDegree === 0) {
        const candidate = byId.get(targetId);
        if (candidate) {
          queue.push(candidate);
        }
      }
    }
  }

  if (orderedIds.length < nodes.length) {
    return {
      ok: false,
      error:
        "The workflow contains a cycle. Remove the loop before running it.",
    };
  }

  return { ok: true, orderedIds, reachableIds: reachable };
}

export type TriggerResolution =
  | { ok: true; type: string; manual: boolean }
  | { ok: false; error: string };

export function resolveTrigger(
  nodes: Pick<GraphNode, "id" | "name" | "type">[],
): TriggerResolution {
  const triggers = nodes.filter((node) => isTriggerType(node.type));

  if (triggers.length === 0) {
    return {
      ok: false,
      error:
        "This workflow has no trigger. Add a Manual, Webhook, or Schedule trigger.",
    };
  }

  if (triggers.length > 1) {
    const names = triggers.map((trigger) => trigger.name).join(", ");
    return {
      ok: false,
      error: `Workflows can only have one trigger, but this one has several: ${names}`,
    };
  }

  const trigger = triggers[0];
  return {
    ok: true,
    type: trigger.type,
    manual: ["MANUAL_TRIGGER", "INITIAL"].includes(trigger.type),
  };
}
