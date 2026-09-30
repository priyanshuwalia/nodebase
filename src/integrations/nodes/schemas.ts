import { z } from "zod";
import type { NodeType } from "@/generated/prisma";

const pairSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string(),
});

const emptySchema = z.object({});

export const nodeConfigSchemas = {
  INITIAL: emptySchema,
  MANUAL_TRIGGER: emptySchema,
  WEBHOOK_TRIGGER: emptySchema,
  SCHEDULE_TRIGGER: z.object({
    cron: z.string().trim().min(1, "Cron expression is required"),
    timezone: z.string().trim().optional().or(z.literal("")),
  }),
  HTTP_REQUEST: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
    url: z.string().trim().min(1, "URL is required"),
    headers: z.array(pairSchema).default([]),
    query: z.array(pairSchema).default([]),
    bodyType: z.enum(["none", "json", "raw"]).default("none"),
    bodyContent: z.string().default(""),
    timeoutMs: z.coerce
      .number()
      .int()
      .min(1000, "Timeout must be at least 1s")
      .max(60000, "Timeout must be at most 60s")
      .default(10000),
  }),
  TRANSFORM_JSON: z.object({
    template: z.union([
      z.record(z.string(), z.unknown()),
      z.array(z.unknown()),
    ]),
  }),
  EXTRACT_FIELD: z.object({
    paths: z
      .array(z.string().trim().min(1))
      .min(1, "At least one path is required"),
  }),
  CONDITION: z.object({
    rules: z
      .array(
        z.object({
          path: z.string().trim().min(1, "A value path is required"),
          operator: z.enum([
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
          ]),
          value: z.union([z.string(), z.number(), z.boolean()]).optional(),
        }),
      )
      .min(1, "At least one rule is required"),
    combinator: z.enum(["AND", "OR"]).default("AND"),
  }),
  DELAY: z.object({
    milliseconds: z.coerce
      .number()
      .int()
      .min(0)
      .max(60000, "Delay must be at most 60 seconds")
      .default(0),
  }),
  GEMINI: z.object({
    model: z.string().trim().min(1, "Model is required"),
    prompt: z.string(),
    system: z.string().optional().default(""),
    temperature: z.coerce.number().optional(),
  }),
  OPENAI: z.object({
    model: z.string().trim().min(1, "Model is required"),
    prompt: z.string(),
    system: z.string().optional().default(""),
    temperature: z.coerce.number().optional(),
  }),
  ANTHROPIC: z.object({
    model: z.string().trim().min(1, "Model is required"),
    prompt: z.string(),
    system: z.string().optional().default(""),
    temperature: z.coerce.number().optional(),
  }),
  SLACK: z.object({
    message: z.string(),
    channel: z.string().trim().optional().default(""),
  }),
  DISCORD: z.object({
    message: z.string(),
    username: z.string().trim().optional().default(""),
  }),
  GOOGLE_FORM_TRIGGER: emptySchema,
  STRIPE_TRIGGER: emptySchema,
  SWITCH: z.object({
    rules: z
      .array(
        z.object({
          value: z.string(),
          operator: z.enum([
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
          ]),
          renameOutput: z.string().optional().default(""),
        }),
      )
      .min(1, "At least one rule is required"),
    fallbackOutput: z.enum(["none", "first", "last"]).default("none"),
  }),
  MERGE: z.object({
    mode: z.enum(["append", "chooseBranch"]).default("append"),
  }),
  WAIT: z.object({
    mode: z.enum(["interval", "time", "webhook"]).default("interval"),
    milliseconds: z.coerce.number().int().min(0).max(86400000).default(60000),
  }),
  LOOP: z.object({
    batchSize: z.coerce.number().int().min(1).max(1000).default(10),
  }),
  ERROR_TRIGGER: emptySchema,
  EXECUTE_WORKFLOW: z.object({
    workflowId: z.string().trim().min(1, "Workflow ID is required"),
  }),
  EXECUTE_SUBWORKFLOW_TRIGGER: emptySchema,
  RESPOND_TO_WEBHOOK: z.object({
    respondWith: z
      .enum(["allIncomingItems", "firstIncomingItem", "json", "text", "noData"])
      .default("json"),
    responseCode: z.coerce.number().int().min(100).max(599).default(200),
    responseHeaders: z.array(pairSchema).default([]),
  }),
  SORT: z.object({
    path: z.string().trim().default(""),
    direction: z.enum(["asc", "desc"]).default("asc"),
  }),
  LIMIT: z.object({
    count: z.coerce.number().int().min(0).max(10000).default(10),
    from: z.enum(["first", "last"]).default("first"),
  }),
  REMOVE_DUPLICATES: z.object({
    path: z.string().trim().default(""),
  }),
  SPLIT_OUT: z.object({
    path: z.string().trim().min(1, "Field path is required"),
  }),
  SUMMARIZE: z.object({
    mode: z
      .enum(["individualFields", "allItemData"])
      .default("individualFields"),
    fields: z.array(pairSchema).default([]),
  }),
  AGGREGATE: z.object({
    fields: z.array(pairSchema).default([]),
  }),
  REMOVE_EMPTY: emptySchema,
} satisfies Record<string, z.ZodType>;

export type NodeConfigOf<T extends NodeType> = z.infer<
  (typeof nodeConfigSchemas)[T]
>;

export function parseNodeConfig<T extends NodeType>(
  type: T,
  raw: unknown,
): NodeConfigOf<T> {
  const schema = nodeConfigSchemas[type];
  if (!schema) {
    throw new Error(`No config schema registered for node type "${type}"`);
  }
  return schema.parse(raw) as NodeConfigOf<T>;
}

export function validateNodeConfig(type: NodeType, raw: unknown): string[] {
  const schema = nodeConfigSchemas[type];
  if (!schema) {
    return [`No config schema registered for node type "${type}"`];
  }

  const result = schema.safeParse(raw);
  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    const where = path ? `${path}: ` : "";
    return `${where}${issue.message}`;
  });
}
