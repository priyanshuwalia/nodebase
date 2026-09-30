import "server-only";

import type { InterpolationContext } from "@/features/workflows/server/interpolation";
import {
  interpolateValue,
  resolvePath,
  resolveRef,
} from "@/features/workflows/server/interpolation";
import type { NodeOutput } from "@/integrations/nodes/item";

export type TransformConfig = { template?: unknown };

export function runTransformJson(
  config: TransformConfig,
  context: InterpolationContext,
): NodeOutput {
  if (config.template === undefined || config.template === null) {
    throw new Error("Transform JSON template is missing");
  }
  return [
    {
      json: interpolateValue(config.template, context) as Record<
        string,
        unknown
      >,
      pairedItem: 0,
    },
  ];
}

export type ExtractConfig = { paths?: unknown };

export function runExtractField(
  config: ExtractConfig,
  context: InterpolationContext,
): NodeOutput {
  const paths = Array.isArray(config.paths)
    ? config.paths.map((value) => String(value).trim()).filter(Boolean)
    : [];

  if (paths.length === 0) {
    throw new Error("Extract field has no paths configured");
  }

  const result: Record<string, unknown> = {};

  for (const path of paths) {
    let value: unknown;

    if (/^\$[a-z]+(\.|$)/i.test(path) || path.startsWith("node.")) {
      value = resolveRef(context, path);
    } else {
      value = resolvePath(context.prev, path);
      if (value === undefined) {
        value = resolvePath(context.trigger, path);
      }
    }

    const label = path.split(".").at(-1) ?? path;
    result[label] = value;
  }

  return [{ json: result, pairedItem: 0 }];
}

const OPERATORS = new Set([
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "is_empty",
  "is_not_empty",
  "matches",
]);

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

function compare(
  operator: string,
  actual: unknown,
  expected: unknown,
): boolean {
  switch (operator) {
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    case "eq": {
      if (actual === expected) {
        return true;
      }
      const a = Number(actual);
      const b = Number(expected);
      return (
        !Number.isNaN(a) &&
        !Number.isNaN(b) &&
        a === b &&
        (typeof actual === "number" || typeof expected === "number")
      );
    }
    case "ne":
      return !compare("eq", actual, expected);
    case "gt":
      return Number(actual) > Number(expected);
    case "gte":
      return Number(actual) >= Number(expected);
    case "lt":
      return Number(actual) < Number(expected);
    case "lte":
      return Number(actual) <= Number(expected);
    case "contains": {
      if (typeof actual === "string" && typeof expected === "string") {
        return actual.includes(expected);
      }
      if (Array.isArray(actual)) {
        return actual.some((item) => item === expected);
      }
      return false;
    }
    case "not_contains":
      return !compare("contains", actual, expected);
    case "starts_with":
      return (
        typeof actual === "string" &&
        typeof expected === "string" &&
        actual.startsWith(expected)
      );
    case "matches": {
      if (typeof actual !== "string" || typeof expected !== "string") {
        return false;
      }
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

export type ConditionConfig = {
  rules?: unknown;
  combinator?: unknown;
};

export function runCondition(
  config: ConditionConfig,
  context: InterpolationContext,
): NodeOutput {
  const rules = Array.isArray(config.rules) ? config.rules : [];
  if (rules.length === 0) {
    throw new Error("Condition has no rules configured");
  }

  const combinator = String(config.combinator ?? "AND");
  const results: boolean[] = [];

  for (const rule of rules) {
    const ruleObj = rule as Record<string, unknown>;
    const path = String(ruleObj.path ?? "").trim();
    if (!path) {
      throw new Error("Condition rule path is missing");
    }
    const operator = String(ruleObj.operator ?? "");
    if (!OPERATORS.has(operator)) {
      throw new Error(`Condition operator "${operator}" is not supported`);
    }

    let actual: unknown;
    if (/^\$[a-z]+(\.|$)/i.test(path) || path.startsWith("node.")) {
      actual = resolveRef(context, path);
    } else {
      actual = resolvePath(context.prev, path);
      if (actual === undefined) {
        actual = resolvePath(context.trigger, path);
      }
    }

    results.push(compare(operator, actual, ruleObj.value));
  }

  const result =
    combinator === "OR" ? results.some(Boolean) : results.every(Boolean);

  return [
    { json: { result, combinator, ruleCount: rules.length }, pairedItem: 0 },
  ];
}

export async function runDelay(config: {
  milliseconds?: unknown;
}): Promise<NodeOutput> {
  const milliseconds = Number(config.milliseconds ?? 0);
  if (
    !Number.isInteger(milliseconds) ||
    milliseconds < 0 ||
    milliseconds > 60000
  ) {
    throw new Error("Delay duration is invalid (0–60000ms)");
  }
  if (milliseconds > 0) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
  return [{ json: { waitedMs: milliseconds }, pairedItem: 0 }];
}

export type SwitchConfig = {
  rules?: unknown;
  fallbackOutput?: unknown;
};

export function runSwitch(
  config: SwitchConfig,
  context: InterpolationContext,
): NodeOutput {
  const rules = Array.isArray(config.rules) ? config.rules : [];
  if (rules.length === 0) {
    throw new Error("Switch has no rules configured");
  }

  const prevJson = context.prev?.[0]?.json ?? {};
  const fallback = String(config.fallbackOutput ?? "none");

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as Record<string, unknown>;
    const value = String(rule.value ?? "");
    const operator = String(rule.operator ?? "eq");
    const renameOutput = String(rule.renameOutput ?? "");

    const actual = resolvePath(prevJson, "");
    const matches = compare(operator, actual, value);

    if (matches) {
      const outputName = renameOutput || `output${i}`;
      return [
        {
          json: { matched: true, output: outputName, rule: i },
          pairedItem: 0,
        },
      ];
    }
  }

  if (fallback === "first" || fallback === "last") {
    return [
      {
        json: { matched: false, output: fallback, rule: -1 },
        pairedItem: 0,
      },
    ];
  }

  return [
    { json: { matched: false, output: "none", rule: -1 }, pairedItem: 0 },
  ];
}

export type MergeConfig = { mode?: unknown };

export function runMerge(
  config: MergeConfig,
  context: InterpolationContext,
): NodeOutput {
  const mode = String(config.mode ?? "append");
  const allItems: NodeOutput = [];

  for (const items of Object.values(context.node)) {
    if (Array.isArray(items)) {
      allItems.push(...items);
    }
  }

  if (mode === "append") {
    return allItems.length > 0 ? allItems : [{ json: {}, pairedItem: 0 }];
  }

  return allItems.length > 0 ? [allItems[0]] : [{ json: {}, pairedItem: 0 }];
}

export type WaitConfig = {
  mode?: unknown;
  milliseconds?: unknown;
};

export async function runWait(
  config: WaitConfig,
  context: InterpolationContext,
): Promise<NodeOutput> {
  const mode = String(config.mode ?? "interval");
  const milliseconds = Number(config.milliseconds ?? 60000);

  if (mode === "interval") {
    if (milliseconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
    return [{ json: { waitedMs: milliseconds, mode }, pairedItem: 0 }];
  }

  if (mode === "time") {
    return [
      { json: { mode, resumeAt: new Date().toISOString() }, pairedItem: 0 },
    ];
  }

  return [
    {
      json: { mode, resumeUrl: `${context.execution.id}/resume` },
      pairedItem: 0,
    },
  ];
}

export type LoopConfig = { batchSize?: unknown };

export function runLoop(
  config: LoopConfig,
  context: InterpolationContext,
): NodeOutput {
  const batchSize = Number(config.batchSize ?? 10);
  const items = context.prev ?? [];

  if (items.length === 0) {
    return [{ json: { looped: false, batchSize }, pairedItem: 0 }];
  }

  const batch = items.slice(0, batchSize);
  return batch.map((item, i) => ({
    json: { ...item.json, looped: true, batchIndex: i },
    pairedItem: item.pairedItem ?? i,
  }));
}

export type SortConfig = {
  path?: unknown;
  direction?: unknown;
};

export function runSort(
  config: SortConfig,
  context: InterpolationContext,
): NodeOutput {
  const path = String(config.path ?? "");
  const direction = String(config.direction ?? "asc");
  const items = [...(context.prev ?? [])];

  if (path) {
    items.sort((a, b) => {
      const aVal = resolvePath(a.json, path);
      const bVal = resolvePath(b.json, path);
      const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""));
      return direction === "desc" ? -cmp : cmp;
    });
  }

  return items.map((item, i) => ({
    json: { ...item.json, sorted: true },
    pairedItem: item.pairedItem ?? i,
  }));
}

export type LimitConfig = {
  count?: unknown;
  from?: unknown;
};

export function runLimit(
  config: LimitConfig,
  context: InterpolationContext,
): NodeOutput {
  const count = Number(config.count ?? 10);
  const from = String(config.from ?? "first");
  const items = context.prev ?? [];

  if (from === "last") {
    return items.slice(-count).map((item, i) => ({
      json: { ...item.json, limited: true },
      pairedItem: item.pairedItem ?? i,
    }));
  }

  return items.slice(0, count).map((item, i) => ({
    json: { ...item.json, limited: true },
    pairedItem: item.pairedItem ?? i,
  }));
}

export type RemoveDuplicatesConfig = { path?: unknown };

export function runRemoveDuplicates(
  config: RemoveDuplicatesConfig,
  context: InterpolationContext,
): NodeOutput {
  const path = String(config.path ?? "");
  const items = context.prev ?? [];
  const seen = new Set<string>();
  const result: NodeOutput = [];

  for (const item of items) {
    const key = path
      ? String(resolvePath(item.json, path) ?? "")
      : JSON.stringify(item.json);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result.length > 0 ? result : [{ json: {}, pairedItem: 0 }];
}

export type SplitOutConfig = { path?: unknown };

export function runSplitOut(
  config: SplitOutConfig,
  context: InterpolationContext,
): NodeOutput {
  const path = String(config.path ?? "");
  if (!path) {
    throw new Error("Split out field path is missing");
  }

  const items = context.prev ?? [];
  const result: NodeOutput = [];

  for (const item of items) {
    const value = resolvePath(item.json, path);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        result.push({
          json: { ...item.json, [path]: value[i], splitIndex: i },
          pairedItem: item.pairedItem ?? i,
        });
      }
    } else {
      result.push(item);
    }
  }

  return result.length > 0 ? result : [{ json: {}, pairedItem: 0 }];
}

export type SummarizeConfig = {
  mode?: unknown;
  fields?: unknown;
};

export function runSummarize(
  config: SummarizeConfig,
  context: InterpolationContext,
): NodeOutput {
  const mode = String(config.mode ?? "individualFields");
  const items = context.prev ?? [];

  if (mode === "allItemData") {
    return [
      {
        json: { count: items.length, items: items.map((i) => i.json) },
        pairedItem: 0,
      },
    ];
  }

  const fields = Array.isArray(config.fields) ? config.fields : [];
  const summary: Record<string, unknown> = { count: items.length };

  for (const field of fields) {
    const obj = field as Record<string, unknown>;
    const name = String(obj.key ?? "");
    const agg = String(obj.value ?? "");
    if (!name) continue;

    const values = items
      .map((i) => resolvePath(i.json, name))
      .filter((v) => v !== undefined && v !== null);

    if (agg === "sum") {
      summary[name] = values.reduce<number>((a, b) => a + Number(b), 0);
    } else if (agg === "avg") {
      const sum = values.reduce<number>((a, b) => a + Number(b), 0);
      summary[name] = values.length > 0 ? sum / values.length : 0;
    } else if (agg === "min") {
      summary[name] = values.length > 0 ? Math.min(...values.map(Number)) : 0;
    } else if (agg === "max") {
      summary[name] = values.length > 0 ? Math.max(...values.map(Number)) : 0;
    } else {
      summary[name] = values.length;
    }
  }

  return [{ json: summary, pairedItem: 0 }];
}

export type AggregateConfig = { fields?: unknown };

export function runAggregate(
  config: AggregateConfig,
  context: InterpolationContext,
): NodeOutput {
  const fields = Array.isArray(config.fields) ? config.fields : [];
  const items = context.prev ?? [];
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const obj = field as Record<string, unknown>;
    const outputName = String(obj.key ?? "");
    const sourcePath = String(obj.value ?? "");
    if (!outputName || !sourcePath) continue;

    const values = items
      .map((i) => resolvePath(i.json, sourcePath))
      .filter((v) => v !== undefined && v !== null);

    result[outputName] = values.length > 0 ? values[0] : null;
  }

  return [{ json: result, pairedItem: 0 }];
}

export function runRemoveEmpty(
  _config: unknown,
  context: InterpolationContext,
): NodeOutput {
  const items = context.prev ?? [];

  return items.map((item) => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item.json)) {
      if (value !== undefined && value !== null && value !== "") {
        cleaned[key] = value;
      }
    }
    return { json: cleaned, pairedItem: item.pairedItem };
  });
}
