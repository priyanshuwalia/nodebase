import "server-only";

import type { Item } from "@/integrations/nodes/item";
import { firstItemJson } from "@/integrations/nodes/item";
import { evaluateExpression as runInSandbox } from "@/lib/sandbox";

export type ExpressionContext = {
  trigger: Item[] | null;
  prev: Item[] | null;
  node: Record<string, Item[]>;
  nodeByName: Record<string, Item[]>;
  now: Date;
  today: Date;
  workflow: { id: string; name: string };
  execution: { id: string; resumeUrl?: string };
  vars: Record<string, string>;
  itemIndex: number;
  runIndex: number;
};

export type ExpressionResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as object).length === 0;
  }
  return false;
}

export function evaluateExpression(
  expression: string,
  context: ExpressionContext,
): ExpressionResult {
  const sandbox: Record<string, unknown> = {
    $json: firstItemJson(context.prev),
    $now: context.now,
    $today: context.today,
    $workflow: context.workflow,
    $execution: context.execution,
    $vars: context.vars,
    $itemIndex: context.itemIndex,
    $runIndex: context.runIndex,
    $if: (cond: unknown, a: unknown, b: unknown) => (cond ? a : b),
    $ifEmpty: (v: unknown, fallback: unknown) => (isEmpty(v) ? fallback : v),
    $max: (...args: number[]) => Math.max(...args),
    $min: (...args: number[]) => Math.min(...args),
  };

  for (const [name, items] of Object.entries(context.nodeByName)) {
    sandbox[`$node["${name}"]`] = firstItemJson(items);
  }

  return runInSandbox(expression, sandbox);
}
