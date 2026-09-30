import "server-only";

export interface Item {
  json: Record<string, unknown>;
  pairedItem?: number;
}

export type NodeOutput = Item[];

export function normalizeToItems(value: unknown): Item[] {
  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      if (
        entry !== null &&
        typeof entry === "object" &&
        "json" in entry &&
        (entry as { json?: unknown }).json !== null &&
        typeof (entry as { json?: unknown }).json === "object"
      ) {
        return entry as Item;
      }
      return { json: { value: entry }, pairedItem: index };
    });
  }

  if (value !== null && typeof value === "object") {
    return [{ json: value as Record<string, unknown>, pairedItem: 0 }];
  }

  return [{ json: {}, pairedItem: 0 }];
}

export function firstItemJson(
  items: Item[] | null | undefined,
): Record<string, unknown> | null {
  if (!items || items.length === 0) {
    return null;
  }
  return items[0]?.json ?? null;
}

export function itemCount(items: Item[] | null | undefined): number {
  return items?.length ?? 0;
}
