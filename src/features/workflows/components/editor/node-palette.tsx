"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { PALETTE_CATEGORIES } from "@/integrations/nodes/registry";
import { nodeIcon } from "../node-icon";

export function NodePalette({
  onAdd,
  disabled,
}: {
  onAdd: (type: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    if (!query.trim()) {
      return PALETTE_CATEGORIES;
    }

    const needle = query.trim().toLowerCase();
    return PALETTE_CATEGORIES.map((category) => ({
      ...category,
      nodes: category.nodes.filter((meta) =>
        `${meta.label} ${meta.description}`.toLowerCase().includes(needle),
      ),
    })).filter((category) => category.nodes.length > 0);
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <p className="text-sm font-semibold">Add node</p>
        <div className="relative mt-2">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search nodes"
            className="h-8 pl-8"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search…"
            value={query}
          />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matching nodes.</p>
        ) : (
          categories.map((category) => (
            <div key={category.label}>
              <p className="px-1 pb-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {category.label}
              </p>
              <div className="grid gap-1.5">
                {category.nodes.map((meta) => {
                  const Icon = nodeIcon(meta.icon);
                  return (
                    <button
                      className="flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left text-sm hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={disabled}
                      key={meta.type}
                      onClick={() => onAdd(meta.type)}
                      type="button"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {meta.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {meta.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
