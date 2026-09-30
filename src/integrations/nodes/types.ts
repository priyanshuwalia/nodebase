import type { CredentialType, NodeType } from "@/generated/prisma";

export type { Item, NodeOutput } from "./item";

export type NodeCategory =
  | "Triggers"
  | "AI"
  | "Logic"
  | "Data"
  | "Integrations";

export type FieldMeta =
  | {
      kind: "text";
      key: string;
      label: string;
      placeholder?: string;
      hint?: string;
    }
  | {
      kind: "textarea";
      key: string;
      label: string;
      rows?: number;
      hint?: string;
    }
  | {
      kind: "number";
      key: string;
      label: string;
      min?: number;
      max?: number;
      hint?: string;
    }
  | {
      kind: "select";
      key: string;
      label: string;
      options: Array<{ label: string; value: string }>;
      hint?: string;
    }
  | { kind: "json"; key: string; label: string; hint?: string }
  | {
      kind: "credential";
      key: string;
      label: string;
      types: CredentialType[];
      hint?: string;
    }
  | {
      kind: "pairs";
      key: string;
      label: string;
      keyPlaceholder: string;
      valuePlaceholder: string;
      hint?: string;
    }
  | {
      kind: "path-list";
      key: string;
      label: string;
      placeholder?: string;
      hint?: string;
    }
  | { kind: "info"; key: string; label: string; text: string };

export interface NodeTypeMeta {
  type: NodeType;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string;
  defaultName: string;
  defaultData: Record<string, unknown>;
  fields: FieldMeta[];
  isTrigger?: boolean;
  manuallyTriggerable?: boolean;
  hasBranchOutputs?: boolean;
  setupNote?: string;
}
