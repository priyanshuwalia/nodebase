import "server-only";

import type { Item } from "@/integrations/nodes/item";
import { firstItemJson } from "@/integrations/nodes/item";
import { evaluateExpression } from "./expressions";

const REF_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const JS_EXPR_PATTERN = /^\{\{=\s*(.+?)\s*\}\}$/;

export type InterpolationContext = {
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

export function resolvePath(source: unknown, path: string): unknown {
  if (!path) {
    return source;
  }

  const json = extractJson(source);

  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let current: unknown = json;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function extractJson(source: unknown): unknown {
  if (Array.isArray(source) && source.length > 0) {
    const first = source[0];
    if (
      first !== null &&
      typeof first === "object" &&
      "json" in first &&
      (first as { json?: unknown }).json !== null &&
      typeof (first as { json?: unknown }).json === "object"
    ) {
      return (first as Item).json;
    }
  }
  return source;
}

export function resolveRef(
  context: InterpolationContext,
  ref: string,
): unknown {
  const expression = ref.trim();

  if (expression === "$trigger" || expression === "trigger") {
    return firstItemJson(context.trigger);
  }
  if (expression === "$prev" || expression === "prev") {
    return firstItemJson(context.prev);
  }

  if (expression.startsWith("$trigger.")) {
    return resolvePath(
      firstItemJson(context.trigger),
      expression.slice("$trigger.".length),
    );
  }
  if (expression.startsWith("trigger.")) {
    return resolvePath(
      firstItemJson(context.trigger),
      expression.slice("trigger.".length),
    );
  }
  if (expression.startsWith("$prev.")) {
    return resolvePath(
      firstItemJson(context.prev),
      expression.slice("$prev.".length),
    );
  }
  if (expression.startsWith("prev.")) {
    return resolvePath(
      firstItemJson(context.prev),
      expression.slice("prev.".length),
    );
  }

  if (expression.startsWith("$node.") || expression.startsWith("node.")) {
    const rest = expression.replace(/^\$node\./, "").replace(/^node\./, "");
    const dotIndex = rest.indexOf(".");
    if (dotIndex === -1) {
      return firstItemJson(context.node[rest]);
    }
    const nodeId = rest.slice(0, dotIndex);
    const nodePath = rest.slice(dotIndex + 1);
    return resolvePath(firstItemJson(context.node[nodeId]), nodePath);
  }

  return undefined;
}

export function interpolateValue(
  value: unknown,
  context: InterpolationContext,
): unknown {
  if (typeof value === "string") {
    const jsMatch = value.match(JS_EXPR_PATTERN);
    if (jsMatch) {
      const result = evaluateExpression(jsMatch[1], context);
      if (result.ok) {
        return result.value;
      }
      return "";
    }

    if (!REF_PATTERN.test(value)) {
      REF_PATTERN.lastIndex = 0;
      return value;
    }
    REF_PATTERN.lastIndex = 0;

    return value.replace(REF_PATTERN, (_match, ref) => {
      const resolved = resolveRef(context, ref);
      if (resolved === undefined || resolved === null) {
        return "";
      }
      if (typeof resolved === "object") {
        return JSON.stringify(resolved);
      }
      return String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => interpolateValue(item, context));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        interpolateValue(item, context),
      ]),
    );
  }

  return value;
}

export function hasReferences(value: string): boolean {
  if (typeof value !== "string") {
    return false;
  }
  REF_PATTERN.lastIndex = 0;
  const has = REF_PATTERN.test(value);
  REF_PATTERN.lastIndex = 0;
  return has;
}
