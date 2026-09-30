"use client";

import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import { nodeIcon } from "../node-icon";

export type WorkflowNodeData = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  nodeLabel: string;
  icon: string;
  category: string;
  hasBranchOutputs?: boolean;
  isTrigger?: boolean;
};

type WorkflowFlowNode = Node<WorkflowNodeData>;

export function WorkflowNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const Icon = nodeIcon(data.icon ?? "Sparkles");
  const hasBranches = data.hasBranchOutputs;

  return (
    <div
      className={[
        "w-56 rounded-lg border bg-background px-3 py-2.5 shadow-sm",
        selected ? "border-primary ring-2 ring-ring/40" : "border-border",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="main"
        className="!size-2.5 !border-background"
      />
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{data.nodeName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {data.nodeLabel}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {data.category}
        </span>
        {hasBranches ? (
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5 text-emerald-600">
              <Handle
                type="source"
                position={Position.Right}
                id="true"
                style={{ top: "36%" }}
                className="!size-2 !border-background !bg-emerald-500"
              />
              true
            </span>
            <span className="flex items-center gap-0.5 text-rose-600">
              <Handle
                type="source"
                position={Position.Right}
                id="false"
                style={{ top: "72%" }}
                className="!size-2 !border-background !bg-rose-500"
              />
              false
            </span>
          </div>
        ) : (
          <Handle
            type="source"
            position={Position.Right}
            id="main"
            className="!size-2.5 !border-background"
          />
        )}
      </div>
    </div>
  );
}
