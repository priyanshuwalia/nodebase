import type { NodeType } from "@/generated/prisma";
import type { NodeTypeMeta } from "./types";

const triggerFields: NodeTypeMeta["fields"] = [];

const aiFields: NodeTypeMeta["fields"] = [
  { kind: "select", key: "model", label: "Model", options: [] },
  {
    kind: "textarea",
    key: "prompt",
    label: "Prompt",
    rows: 5,
    hint: "Reference the previous step output with {{ $prev.field }} or any earlier step with {{ $node.<nodeId>.field }}.",
  },
  {
    kind: "textarea",
    key: "system",
    label: "System prompt",
    rows: 3,
    hint: "Optional. Sets the model system instructions.",
  },
];

export const nodeTypeMeta: Record<NodeType, NodeTypeMeta> = {
  INITIAL: {
    type: "INITIAL",
    label: "Manual trigger",
    category: "Triggers",
    description: "Run this workflow by hand from the editor.",
    icon: "Zap",
    defaultName: "Manual trigger",
    defaultData: {},
    fields: triggerFields,
    isTrigger: true,
    manuallyTriggerable: true,
  },
  MANUAL_TRIGGER: {
    type: "MANUAL_TRIGGER",
    label: "Manual trigger",
    category: "Triggers",
    description: "Run this workflow by hand from the editor.",
    icon: "Zap",
    defaultName: "Manual trigger",
    defaultData: {},
    fields: triggerFields,
    isTrigger: true,
    manuallyTriggerable: true,
  },
  WEBHOOK_TRIGGER: {
    type: "WEBHOOK_TRIGGER",
    label: "Webhook trigger",
    category: "Triggers",
    description: "Start a run when something posts to a generated URL.",
    icon: "Webhook",
    defaultName: "Webhook trigger",
    defaultData: {},
    fields: [
      {
        kind: "info",
        key: "endpoint",
        label: "Endpoint",
        text: "A unique URL is generated when this workflow is saved. Copy it from this panel after configuring the node.",
      },
    ],
    isTrigger: true,
    manuallyTriggerable: false,
  },
  SCHEDULE_TRIGGER: {
    type: "SCHEDULE_TRIGGER",
    label: "Schedule trigger",
    category: "Triggers",
    description: "Start a run on a cron schedule.",
    icon: "CalendarClock",
    defaultName: "Schedule trigger",
    defaultData: { cron: "0 9 * * *" },
    fields: [
      {
        kind: "text",
        key: "cron",
        label: "Cron expression",
        placeholder: "0 9 * * *",
        hint: "Five-field cron (minute hour day month weekday). Runs in the app timezone.",
      },
    ],
    isTrigger: true,
    manuallyTriggerable: false,
  },
  GEMINI: {
    type: "GEMINI",
    label: "Gemini",
    category: "AI",
    description: "Generate text or transform data with Google Gemini.",
    icon: "Sparkles",
    defaultName: "Gemini step",
    defaultData: { model: "gemini-2.5-flash", prompt: "", system: "" },
    fields: [
      {
        kind: "credential",
        key: "credentialId",
        label: "Credential",
        types: ["GEMINI"],
        hint: "Server-side only. Falls back to GOOGLE_GENERATIVE_AI_API_KEY when unset.",
      },
      ...aiFields,
    ],
  },
  OPENAI: {
    type: "OPENAI",
    label: "OpenAI",
    category: "AI",
    description: "Generate text or transform data with OpenAI.",
    icon: "Sparkles",
    defaultName: "OpenAI step",
    defaultData: { model: "gpt-4o-mini", prompt: "", system: "" },
    fields: [
      {
        kind: "credential",
        key: "credentialId",
        label: "Credential",
        types: ["OPENAI"],
        hint: "Server-side only. Falls back to OPENAI_API_KEY when unset.",
      },
      ...aiFields,
    ],
  },
  ANTHROPIC: {
    type: "ANTHROPIC",
    label: "Anthropic",
    category: "AI",
    description: "Generate text or transform data with Anthropic Claude.",
    icon: "Sparkles",
    defaultName: "Anthropic step",
    defaultData: { model: "claude-3-5-haiku-latest", prompt: "", system: "" },
    fields: [
      {
        kind: "credential",
        key: "credentialId",
        label: "Credential",
        types: ["ANTHROPIC"],
        hint: "Server-side only. Falls back to ANTHROPIC_API_KEY when unset.",
      },
      ...aiFields,
    ],
  },
  HTTP_REQUEST: {
    type: "HTTP_REQUEST",
    label: "HTTP request",
    category: "Integrations",
    description: "Call any HTTP API with headers, query params, and a body.",
    icon: "Globe",
    defaultName: "HTTP request",
    defaultData: {
      method: "GET",
      url: "https://api.example.com/v1/data",
      headers: [],
      query: [],
      bodyType: "none",
      bodyContent: "",
      timeoutMs: 10000,
    },
    fields: [
      {
        kind: "select",
        key: "method",
        label: "Method",
        options: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map(
          (value) => ({ label: value, value }),
        ),
      },
      {
        kind: "text",
        key: "url",
        label: "URL",
        placeholder: "https://api.example.com/v1/data",
        hint: "Supports {{ }} interpolation.",
      },
      {
        kind: "credential",
        key: "credentialId",
        label: "Bearer token",
        types: ["HTTP_BEARER"],
        hint: "Optional. Sent as the Authorization header.",
      },
      {
        kind: "pairs",
        key: "headers",
        label: "Headers",
        keyPlaceholder: "Header name",
        valuePlaceholder: "Value",
      },
      {
        kind: "pairs",
        key: "query",
        label: "Query parameters",
        keyPlaceholder: "Key",
        valuePlaceholder: "Value",
      },
      {
        kind: "select",
        key: "bodyType",
        label: "Body type",
        options: [
          { label: "None", value: "none" },
          { label: "JSON", value: "json" },
          { label: "Raw text", value: "raw" },
        ],
      },
      {
        kind: "textarea",
        key: "bodyContent",
        label: "Body",
        rows: 4,
        hint: "JSON or raw text. Supports {{ }} interpolation.",
      },
      {
        kind: "number",
        key: "timeoutMs",
        label: "Timeout (ms)",
        min: 1000,
        max: 60000,
      },
    ],
  },
  CONDITION: {
    type: "CONDITION",
    label: "Condition",
    category: "Logic",
    description: "Branch a workflow on a value from a previous step.",
    icon: "GitBranch",
    defaultName: "Condition",
    defaultData: {
      rules: [{ path: "$prev", operator: "is_not_empty", value: "" }],
      combinator: "AND",
    },
    fields: [
      {
        kind: "json",
        key: "rules",
        label: "Rules",
        hint: "Array of { path, operator, value } objects. All must match (AND) or any must match (OR).",
      },
      {
        kind: "select",
        key: "combinator",
        label: "Combinator",
        options: [
          { label: "AND (all must match)", value: "AND" },
          { label: "OR (any must match)", value: "OR" },
        ],
      },
    ],
    hasBranchOutputs: true,
  },
  DELAY: {
    type: "DELAY",
    label: "Delay",
    category: "Logic",
    description: "Pause the run for a fixed number of milliseconds.",
    icon: "Timer",
    defaultName: "Delay",
    defaultData: { milliseconds: 0 },
    fields: [
      {
        kind: "number",
        key: "milliseconds",
        label: "Delay (ms)",
        min: 0,
        max: 60000,
      },
    ],
  },
  TRANSFORM_JSON: {
    type: "TRANSFORM_JSON",
    label: "Transform JSON",
    category: "Data",
    description: "Restructure a payload using a JSON template.",
    icon: "Braces",
    defaultName: "Transform JSON",
    defaultData: { template: {} },
    fields: [
      {
        kind: "json",
        key: "template",
        label: "Template",
        hint: "A JSON object or array. Insert values with {{ $prev.field }} or {{ $trigger.field }}.",
      },
    ],
  },
  EXTRACT_FIELD: {
    type: "EXTRACT_FIELD",
    label: "Extract field",
    category: "Data",
    description: "Pull values out of a payload by dotted path.",
    icon: "ScanSearch",
    defaultName: "Extract field",
    defaultData: { paths: ["field"] },
    fields: [
      {
        kind: "path-list",
        key: "paths",
        label: "Field paths",
        placeholder: "items.0.price",
        hint: "Dotted paths into the previous step output.",
      },
    ],
  },
  SLACK: {
    type: "SLACK",
    label: "Slack message",
    category: "Integrations",
    description: "Send a message to a Slack channel.",
    icon: "MessageSquare",
    defaultName: "Slack message",
    defaultData: { message: "Workflow finished", channel: "" },
    fields: [
      {
        kind: "credential",
        key: "credentialId",
        label: "Incoming webhook credential",
        types: ["SLACK"],
        hint: "Server-side only. When no channel is set, the webhook's default channel is used.",
      },
      {
        kind: "textarea",
        key: "message",
        label: "Message",
        rows: 4,
        hint: "Supports {{ }} interpolation.",
      },
      {
        kind: "text",
        key: "channel",
        label: "Channel override",
        placeholder: "#general",
        hint: "Optional. Empty uses the webhook's default channel.",
      },
    ],
  },
  DISCORD: {
    type: "DISCORD",
    label: "Discord message",
    category: "Integrations",
    description: "Send a message to a Discord channel via webhook.",
    icon: "MessageSquare",
    defaultName: "Discord message",
    defaultData: { message: "Workflow finished", username: "" },
    fields: [
      {
        kind: "credential",
        key: "credentialId",
        label: "Webhook URL credential",
        types: ["DISCORD"],
        hint: "Server-side only. Falls back to DISCORD_WEBHOOK_URL when unset.",
      },
      {
        kind: "textarea",
        key: "message",
        label: "Message",
        rows: 4,
        hint: "Supports {{ }} interpolation.",
      },
      {
        kind: "text",
        key: "username",
        label: "Bot name override",
        placeholder: "Nodebase",
        hint: "Optional.",
      },
    ],
  },
  GOOGLE_FORM_TRIGGER: {
    type: "GOOGLE_FORM_TRIGGER",
    label: "Google Form",
    category: "Triggers",
    description: "Not implemented yet.",
    icon: "FormInput",
    defaultName: "Google Form trigger",
    defaultData: {},
    fields: [
      {
        kind: "info",
        key: "notice-form",
        label: "Unavailable",
        text: "This node type is not implemented. Workflows using it will fail at runtime with a clear error.",
      },
    ],
  },
  STRIPE_TRIGGER: {
    type: "STRIPE_TRIGGER",
    label: "Stripe event",
    category: "Triggers",
    description: "Not implemented yet.",
    icon: "Webhook",
    defaultName: "Stripe event",
    defaultData: {},
    fields: [
      {
        kind: "info",
        key: "notice-stripe",
        label: "Unavailable",
        text: "This node type is not implemented. Workflows using it will fail at runtime with a clear error.",
      },
    ],
  },
  SWITCH: {
    type: "SWITCH",
    label: "Switch",
    category: "Logic",
    description: "Route items to different branches based on rules.",
    icon: "GitBranch",
    defaultName: "Switch",
    defaultData: {
      rules: [{ value: "", operator: "eq", renameOutput: "" }],
      fallbackOutput: "none",
    },
    fields: [
      {
        kind: "json",
        key: "rules",
        label: "Rules",
        hint: "Array of { value, operator, renameOutput } objects. First matching rule wins.",
      },
      {
        kind: "select",
        key: "fallbackOutput",
        label: "Fallback output",
        options: [
          { label: "None", value: "none" },
          { label: "First", value: "first" },
          { label: "Last", value: "last" },
        ],
      },
    ],
    hasBranchOutputs: true,
  },
  MERGE: {
    type: "MERGE",
    label: "Merge",
    category: "Logic",
    description: "Combine outputs from multiple branches into one.",
    icon: "GitMerge",
    defaultName: "Merge",
    defaultData: { mode: "append" },
    fields: [
      {
        kind: "select",
        key: "mode",
        label: "Mode",
        options: [
          { label: "Append", value: "append" },
          { label: "Choose branch", value: "chooseBranch" },
        ],
      },
    ],
  },
  WAIT: {
    type: "WAIT",
    label: "Wait",
    category: "Logic",
    description:
      "Pause the run until a time interval passes, a specified time, or a webhook call resumes it.",
    icon: "Timer",
    defaultName: "Wait",
    defaultData: { mode: "interval", milliseconds: 60000 },
    fields: [
      {
        kind: "select",
        key: "mode",
        label: "Mode",
        options: [
          { label: "After interval", value: "interval" },
          { label: "At specified time", value: "time" },
          { label: "On webhook call", value: "webhook" },
        ],
      },
      {
        kind: "number",
        key: "milliseconds",
        label: "Interval (ms)",
        min: 0,
        max: 86400000,
        hint: "Used when mode is 'After interval'.",
      },
    ],
  },
  LOOP: {
    type: "LOOP",
    label: "Loop Over Items",
    category: "Logic",
    description: "Process items in batches, looping back for each batch.",
    icon: "Repeat",
    defaultName: "Loop Over Items",
    defaultData: { batchSize: 10 },
    fields: [
      {
        kind: "number",
        key: "batchSize",
        label: "Batch size",
        min: 1,
        max: 1000,
      },
    ],
    hasBranchOutputs: true,
  },
  ERROR_TRIGGER: {
    type: "ERROR_TRIGGER",
    label: "Error trigger",
    category: "Triggers",
    description: "Start a run when another workflow fails.",
    icon: "AlertTriangle",
    defaultName: "Error trigger",
    defaultData: {},
    fields: [],
    isTrigger: true,
    manuallyTriggerable: false,
  },
  EXECUTE_WORKFLOW: {
    type: "EXECUTE_WORKFLOW",
    label: "Execute workflow",
    category: "Logic",
    description: "Run another workflow as a sub-workflow.",
    icon: "Workflow",
    defaultName: "Execute workflow",
    defaultData: { workflowId: "" },
    fields: [
      {
        kind: "text",
        key: "workflowId",
        label: "Workflow ID",
        hint: "The ID of the workflow to execute.",
      },
    ],
  },
  EXECUTE_SUBWORKFLOW_TRIGGER: {
    type: "EXECUTE_SUBWORKFLOW_TRIGGER",
    label: "Execute sub-workflow trigger",
    category: "Triggers",
    description: "Start a run when called by an Execute workflow node.",
    icon: "Workflow",
    defaultName: "Execute sub-workflow trigger",
    defaultData: {},
    fields: [],
    isTrigger: true,
    manuallyTriggerable: false,
  },
  RESPOND_TO_WEBHOOK: {
    type: "RESPOND_TO_WEBHOOK",
    label: "Respond to webhook",
    category: "Integrations",
    description: "Send a response back to the webhook that triggered this run.",
    icon: "Webhook",
    defaultName: "Respond to webhook",
    defaultData: {
      respondWith: "json",
      responseCode: 200,
      responseHeaders: [],
    },
    fields: [
      {
        kind: "select",
        key: "respondWith",
        label: "Respond with",
        options: [
          { label: "All incoming items", value: "allIncomingItems" },
          { label: "First incoming item", value: "firstIncomingItem" },
          { label: "JSON", value: "json" },
          { label: "Text", value: "text" },
          { label: "No data", value: "noData" },
        ],
      },
      {
        kind: "number",
        key: "responseCode",
        label: "Response code",
        min: 100,
        max: 599,
      },
      {
        kind: "pairs",
        key: "responseHeaders",
        label: "Response headers",
        keyPlaceholder: "Header",
        valuePlaceholder: "Value",
      },
    ],
  },
  SORT: {
    type: "SORT",
    label: "Sort",
    category: "Data",
    description: "Sort items by a field or custom comparator.",
    icon: "ArrowUpDown",
    defaultName: "Sort",
    defaultData: { path: "", direction: "asc" },
    fields: [
      {
        kind: "text",
        key: "path",
        label: "Sort by path",
        placeholder: "price",
        hint: "Dotted path to the field to sort by.",
      },
      {
        kind: "select",
        key: "direction",
        label: "Direction",
        options: [
          { label: "Ascending", value: "asc" },
          { label: "Descending", value: "desc" },
        ],
      },
    ],
  },
  LIMIT: {
    type: "LIMIT",
    label: "Limit",
    category: "Data",
    description: "Keep only the first or last N items.",
    icon: "Filter",
    defaultName: "Limit",
    defaultData: { count: 10, from: "first" },
    fields: [
      {
        kind: "number",
        key: "count",
        label: "Count",
        min: 0,
        max: 10000,
      },
      {
        kind: "select",
        key: "from",
        label: "From",
        options: [
          { label: "First", value: "first" },
          { label: "Last", value: "last" },
        ],
      },
    ],
  },
  REMOVE_DUPLICATES: {
    type: "REMOVE_DUPLICATES",
    label: "Remove duplicates",
    category: "Data",
    description: "Remove duplicate items based on a field.",
    icon: "CopyX",
    defaultName: "Remove duplicates",
    defaultData: { path: "" },
    fields: [
      {
        kind: "text",
        key: "path",
        label: "Deduplicate by path",
        placeholder: "id",
        hint: "Dotted path to the field to deduplicate on.",
      },
    ],
  },
  SPLIT_OUT: {
    type: "SPLIT_OUT",
    label: "Split out",
    category: "Data",
    description: "Split a field containing an array into separate items.",
    icon: "Split",
    defaultName: "Split out",
    defaultData: { path: "" },
    fields: [
      {
        kind: "text",
        key: "path",
        label: "Field path",
        placeholder: "items",
        hint: "Dotted path to the array field to split.",
      },
    ],
  },
  SUMMARIZE: {
    type: "SUMMARIZE",
    label: "Summarize",
    category: "Data",
    description: "Aggregate items into a single summary item.",
    icon: "ListCollapse",
    defaultName: "Summarize",
    defaultData: { mode: "individualFields", fields: [] },
    fields: [
      {
        kind: "select",
        key: "mode",
        label: "Mode",
        options: [
          { label: "Individual fields", value: "individualFields" },
          { label: "All item data", value: "allItemData" },
        ],
      },
      {
        kind: "pairs",
        key: "fields",
        label: "Fields to summarize",
        keyPlaceholder: "Field name",
        valuePlaceholder: "Aggregation (sum, avg, min, max, count)",
      },
    ],
  },
  AGGREGATE: {
    type: "AGGREGATE",
    label: "Aggregate",
    category: "Data",
    description: "Combine all items into a single item with aggregated values.",
    icon: "Layers",
    defaultName: "Aggregate",
    defaultData: { fields: [] },
    fields: [
      {
        kind: "pairs",
        key: "fields",
        label: "Fields to aggregate",
        keyPlaceholder: "Output field",
        valuePlaceholder: "Source path",
      },
    ],
  },
  REMOVE_EMPTY: {
    type: "REMOVE_EMPTY",
    label: "Remove empty fields",
    category: "Data",
    description: "Remove fields with empty values from items.",
    icon: "Eraser",
    defaultName: "Remove empty fields",
    defaultData: {},
    fields: [],
  },
};

export const TRIGGER_TYPES: NodeType[] = [
  "MANUAL_TRIGGER",
  "WEBHOOK_TRIGGER",
  "SCHEDULE_TRIGGER",
  "INITIAL",
  "ERROR_TRIGGER",
];

export const MANUALLY_TRIGGERABLE: NodeType[] = ["MANUAL_TRIGGER", "INITIAL"];

export const IMPLEMENTED_NODE_TYPES: NodeType[] = [
  "MANUAL_TRIGGER",
  "WEBHOOK_TRIGGER",
  "SCHEDULE_TRIGGER",
  "INITIAL",
  "GEMINI",
  "OPENAI",
  "ANTHROPIC",
  "HTTP_REQUEST",
  "CONDITION",
  "DELAY",
  "TRANSFORM_JSON",
  "EXTRACT_FIELD",
  "SLACK",
  "DISCORD",
  "SWITCH",
  "MERGE",
  "WAIT",
  "LOOP",
  "ERROR_TRIGGER",
  "EXECUTE_WORKFLOW",
  "EXECUTE_SUBWORKFLOW_TRIGGER",
  "RESPOND_TO_WEBHOOK",
  "SORT",
  "LIMIT",
  "REMOVE_DUPLICATES",
  "SPLIT_OUT",
  "SUMMARIZE",
  "AGGREGATE",
  "REMOVE_EMPTY",
];

export function getNodeTypeMeta(type: NodeType): NodeTypeMeta | undefined {
  return nodeTypeMeta[type];
}

export function isTriggerType(type: NodeType): boolean {
  return TRIGGER_TYPES.includes(type);
}

export function isManuallyTriggerable(type: NodeType): boolean {
  return MANUALLY_TRIGGERABLE.includes(type);
}

export function isImplemented(type: NodeType): boolean {
  return IMPLEMENTED_NODE_TYPES.includes(type);
}

export function paletteForCategory(category: NodeTypeMeta["category"]) {
  return Object.values(nodeTypeMeta).filter(
    (meta) =>
      meta.category === category &&
      isImplemented(meta.type) &&
      meta.type !== "INITIAL",
  );
}

export const PALETTE_CATEGORIES: Array<{
  label: NodeTypeMeta["category"];
  nodes: NodeTypeMeta[];
}> = (["Triggers", "AI", "Logic", "Data", "Integrations"] as const).map(
  (category) => ({
    label: category,
    nodes: paletteForCategory(category),
  }),
);

export function credentialTypesForNodeType(type: NodeType): string[] {
  const meta = nodeTypeMeta[type];
  if (!meta) {
    return [];
  }
  return meta.fields
    .filter((field) => field.kind === "credential")
    .flatMap((field) => (field.kind === "credential" ? field.types : []));
}

export function nodeUsesCredential(type: NodeType): boolean {
  return credentialTypesForNodeType(type).length > 0;
}
