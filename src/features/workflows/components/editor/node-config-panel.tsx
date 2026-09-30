"use client";

import { CopyIcon, PlusIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { getNodeTypeMeta } from "@/integrations/nodes/registry";
import type { FieldMeta } from "@/integrations/nodes/types";
import { nodeIcon } from "../node-icon";

export type EditorNodeItem = {
  id: string;
  name: string;
  type: string;
  data: Record<string, unknown>;
  credentialId: string | null;
};

export type EditorCredential = {
  id: string;
  name: string;
  type: string;
};

type NodeConfigPanelProps = {
  node: EditorNodeItem;
  credentials: EditorCredential[];
  webhookUrl?: string;
  onSave: (input: {
    nodeId: string;
    name: string;
    data: Record<string, unknown>;
    credentialId: string | null;
  }) => Promise<void>;
  onDelete: (nodeId: string) => void | Promise<void>;
  onClose: () => void;
};

function pairValue(value: unknown): Array<{ key: string; value: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      key: String(obj.key ?? ""),
      value: String(obj.value ?? ""),
    };
  });
}

function listValue(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item));
}

export function NodeConfigPanel({
  node,
  credentials,
  webhookUrl,
  onSave,
  onDelete,
  onClose,
}: NodeConfigPanelProps) {
  const meta = getNodeTypeMeta(
    node.type as Parameters<typeof getNodeTypeMeta>[0],
  );
  const Icon = nodeIcon(meta?.icon ?? "Sparkles");

  const initial = useMemo(
    () => ({
      name: node.name,
      credentialId: node.credentialId ?? "",
      data: node.data ?? {},
    }),
    [node],
  );

  const [name, setName] = useState(initial.name);
  const [credentialId, setCredentialId] = useState(initial.credentialId);
  const [data, setData] = useState<Record<string, unknown>>(initial.data);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  if (!meta) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Unknown node type {node.type}.
      </div>
    );
  }

  const dirty =
    name !== initial.name ||
    credentialId !== initial.credentialId ||
    JSON.stringify(data) !== JSON.stringify(initial.data);

  function setValue(key: string, value: unknown) {
    setData((current) => ({ ...current, [key]: value }));
  }

  const hasJsonErrors = Object.keys(jsonErrors).length > 0;

  async function handleSave() {
    if (hasJsonErrors) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        nodeId: node.id,
        name,
        data,
        credentialId: credentialId || null,
      });
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable.
    }
  }

  function renderField(field: FieldMeta) {
    switch (field.kind) {
      case "credential": {
        const filtered = credentials.filter((credential) =>
          field.types.includes(credential.type as (typeof field.types)[number]),
        );
        return (
          <div className="grid gap-1.5" key={field.key}>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`credential-${node.id}`}
            >
              {field.label}
            </label>
            <NativeSelect
              className="w-full"
              id={`credential-${node.id}`}
              onChange={(event) => setCredentialId(event.target.value)}
              size="sm"
              value={credentialId}
            >
              <NativeSelectOption value="">
                Use environment key
              </NativeSelectOption>
              {filtered.map((credential) => (
                <NativeSelectOption key={credential.id} value={credential.id}>
                  {credential.name} ({credential.type})
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );
      }

      case "text":
        return (
          <div className="grid gap-1.5" key={field.key}>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`${node.id}-${field.key}`}
            >
              {field.label}
            </label>
            <Input
              className="h-8"
              id={`${node.id}-${field.key}`}
              onChange={(event) => setValue(field.key, event.target.value)}
              placeholder={field.placeholder}
              value={String(data[field.key] ?? "")}
            />
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );

      case "number":
        return (
          <div className="grid gap-1.5" key={field.key}>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`${node.id}-${field.key}`}
            >
              {field.label}
            </label>
            <Input
              className="h-8"
              id={`${node.id}-${field.key}`}
              min={field.min}
              max={field.max}
              onChange={(event) =>
                setValue(field.key, Number(event.target.value) || 0)
              }
              type="number"
              value={Number(data[field.key] ?? 0)}
            />
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );

      case "select":
        return (
          <div className="grid gap-1.5" key={field.key}>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`${node.id}-${field.key}`}
            >
              {field.label}
            </label>
            {field.options.length > 0 ? (
              <NativeSelect
                className="w-full"
                id={`${node.id}-${field.key}`}
                onChange={(event) => setValue(field.key, event.target.value)}
                size="sm"
                value={String(data[field.key] ?? field.options[0]?.value ?? "")}
              >
                {field.options.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input
                className="h-8"
                id={`${node.id}-${field.key}`}
                onChange={(event) => setValue(field.key, event.target.value)}
                value={String(data[field.key] ?? "")}
              />
            )}
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );

      case "textarea":
        return (
          <div className="grid gap-1.5" key={field.key}>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`${node.id}-${field.key}`}
            >
              {field.label}
            </label>
            <Textarea
              id={`${node.id}-${field.key}`}
              onChange={(event) => setValue(field.key, event.target.value)}
              rows={field.rows ?? 3}
              value={String(data[field.key] ?? "")}
            />
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );

      case "json": {
        const currentJson =
          typeof data[field.key] === "string"
            ? String(data[field.key])
            : JSON.stringify(data[field.key] ?? "", null, 2);
        const error = jsonErrors[field.key];
        return (
          <div className="grid gap-1.5" key={field.key}>
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`${node.id}-${field.key}`}
            >
              {field.label}
            </label>
            <Textarea
              aria-invalid={Boolean(error)}
              className={error ? "border-destructive" : ""}
              id={`${node.id}-${field.key}`}
              onChange={(event) => {
                const raw = event.target.value;
                try {
                  const parsed = JSON.parse(raw);
                  setValue(field.key, parsed);
                  setJsonErrors((current) => {
                    const next = { ...current };
                    delete next[field.key];
                    return next;
                  });
                } catch {
                  setData((current) => ({ ...current, [field.key]: raw }));
                  setJsonErrors((current) => ({
                    ...current,
                    [field.key]: "Must be valid JSON",
                  }));
                }
              }}
              rows={8}
              value={currentJson}
            />
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );
      }

      case "pairs": {
        const rows = pairValue(data[field.key]);
        return (
          <div className="grid gap-1.5" key={field.key}>
            <p className="text-xs font-medium text-muted-foreground">
              {field.label}
            </p>
            <div className="grid gap-2">
              {rows.map((row, index) => (
                <div
                  className="grid grid-cols-[1fr_1fr_auto] gap-1.5"
                  // biome-ignore lint/suspicious/noArrayIndexKey: transient form rows
                  key={index}
                >
                  <Input
                    aria-label={field.keyPlaceholder}
                    className="h-7"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], key: event.target.value };
                      setValue(field.key, next);
                    }}
                    placeholder={field.keyPlaceholder}
                    value={row.key}
                  />
                  <Input
                    aria-label={field.valuePlaceholder}
                    className="h-7"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = {
                        ...next[index],
                        value: event.target.value,
                      };
                      setValue(field.key, next);
                    }}
                    placeholder={field.valuePlaceholder}
                    value={row.value}
                  />
                  <Button
                    aria-label={`Remove ${field.keyPlaceholder}`}
                    className="h-7 w-7"
                    onClick={() => {
                      const next = rows.filter(
                        (_, rowIndex) => rowIndex !== index,
                      );
                      setValue(field.key, next);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                className="w-fit h-7"
                onClick={() =>
                  setValue(field.key, [...rows, { key: "", value: "" }])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );
      }

      case "path-list": {
        const paths = listValue(data[field.key]);
        return (
          <div className="grid gap-1.5" key={field.key}>
            <p className="text-xs font-medium text-muted-foreground">
              {field.label}
            </p>
            <div className="grid gap-2">
              {paths.map((path, index) => (
                <div
                  className="grid grid-cols-[1fr_auto] gap-1.5"
                  // biome-ignore lint/suspicious/noArrayIndexKey: transient form rows
                  key={index}
                >
                  <Input
                    aria-label={`${field.label} ${index + 1}`}
                    className="h-7"
                    onChange={(event) => {
                      const next = [...paths];
                      next[index] = event.target.value;
                      setValue(field.key, next);
                    }}
                    placeholder={field.placeholder}
                    value={path}
                  />
                  <Button
                    aria-label={`Remove ${field.label} ${index + 1}`}
                    className="h-7 w-7"
                    onClick={() => {
                      const next = paths.filter(
                        (_, rowIndex) => rowIndex !== index,
                      );
                      setValue(field.key, next);
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                className="h-7 w-fit"
                onClick={() => setValue(field.key, [...paths, ""])}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
            </div>
            {field.hint ? (
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        );
      }

      case "info":
        return (
          <div
            className="grid gap-1.5 rounded-md border border-dashed p-3 text-xs"
            key={field.key}
          >
            <p className="font-medium text-muted-foreground">{field.label}</p>
            <p className="text-muted-foreground">{field.text}</p>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{meta.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {meta.category}
            </p>
          </div>
        </div>
        <Button
          aria-label="Close node configuration"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {meta.isTrigger ? (
          <div>
            <Badge variant="outline">Trigger</Badge>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {meta.description}
            </p>
          </div>
        ) : null}

        {node.type === "WEBHOOK_TRIGGER" ? (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Webhook URL
            </p>
            {webhookUrl ? (
              <div className="grid gap-1.5">
                <code className="block break-all rounded-md bg-muted px-2 py-1.5 text-xs">
                  {webhookUrl}
                </code>
                <Button
                  className="h-7 w-fit"
                  onClick={() => handleCopy(webhookUrl)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <CopyIcon className="size-3.5" />
                  {copied ? "Copied" : "Copy URL"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  POST JSON or text to this URL to start a run. The payload
                  becomes this node&apos;s output.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Save this node and reload to generate the endpoint URL.
              </p>
            )}
          </div>
        ) : null}

        <fieldset className="grid gap-4">
          <legend className="sr-only">Node settings</legend>
          <div className="grid gap-1.5">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={`name-${node.id}`}
            >
              Name
            </label>
            <Input
              className="h-8"
              id={`name-${node.id}`}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          {meta.fields.map((field) => renderField(field))}
        </fieldset>
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            disabled={saving || !dirty || hasJsonErrors}
            onClick={handleSave}
            size="sm"
          >
            <SaveIcon className="size-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
          {savedAt && !dirty ? (
            <span className="text-xs text-muted-foreground">Saved</span>
          ) : dirty ? (
            <span className="text-xs text-amber-600">Unsaved changes</span>
          ) : null}
        </div>
        <Button
          onClick={() => onDelete(node.id)}
          size="icon-sm"
          variant="ghost"
        >
          <Trash2Icon className="size-4" />
          <span className="sr-only">Delete node</span>
        </Button>
      </div>
    </div>
  );
}
