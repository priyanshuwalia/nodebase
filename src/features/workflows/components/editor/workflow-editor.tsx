"use client";

import "@xyflow/react/dist/style.css";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  ArrowLeftIcon,
  CircleCheckIcon,
  PlayIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getNodeTypeMeta } from "@/integrations/nodes/registry";
import { useTRPC } from "@/trpc/client";
import {
  type EditorCredential,
  type EditorNodeItem,
  NodeConfigPanel,
} from "./node-config-panel";
import { NodePalette } from "./node-palette";
import { WorkflowNode, type WorkflowNodeData } from "./workflow-node";

type Position = { x: number; y: number };

type EditorConnection = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromOutput: string;
  toInput: string;
};

type WorkflowEditorProps = {
  workflowId: string;
  initialName: string;
  initialNodes: Array<{
    id: string;
    name: string;
    type: string;
    position: unknown;
    data: Record<string, unknown>;
    credentialId: string | null;
    webhookEndpoint: { secret: string; enabled: boolean } | null;
  }>;
  initialConnections: EditorConnection[];
  credentials: EditorCredential[];
};

function getPosition(raw: unknown): Position {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const value = raw as Record<string, unknown>;
    const x = typeof value.x === "number" ? value.x : Number(value.x ?? 0);
    const y = typeof value.y === "number" ? value.y : Number(value.y ?? 0);
    return { x: Number.isFinite(x) ? x : 0, y: Number.isFinite(y) ? y : 0 };
  }
  return { x: 0, y: 0 };
}

const nodeTypes = { workflow: WorkflowNode };

export function WorkflowEditor({
  workflowId,
  initialName,
  initialNodes,
  initialConnections,
  credentials,
}: WorkflowEditorProps) {
  const router = useRouter();
  const trpc = useTRPC();

  const [name, setName] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [validationState, setValidationState] = useState<
    "idle" | "valid" | "error" | "checking"
  >("idle");

  const toFlowNode = useCallback(
    (
      node: WorkflowEditorProps["initialNodes"][number],
    ): Node<WorkflowNodeData> => {
      const meta = getNodeTypeMeta(
        node.type as Parameters<typeof getNodeTypeMeta>[0],
      );
      return {
        id: node.id,
        type: "workflow",
        position: getPosition(node.position),
        data: {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          nodeLabel: meta?.label ?? node.type,
          icon: meta?.icon ?? "Sparkles",
          category: meta?.category ?? "Other",
          hasBranchOutputs: meta?.hasBranchOutputs,
          isTrigger: meta?.isTrigger,
        },
      };
    },
    [],
  );

  const initialFlowNodes = useMemo(
    () => initialNodes.map((node) => toFlowNode(node)),
    [initialNodes, toFlowNode],
  );

  const initialFlowEdges = useMemo<Edge[]>(() => {
    const nodeIds = new Set(initialNodes.map((node) => node.id));
    return initialConnections
      .filter(
        (connection) =>
          nodeIds.has(connection.fromNodeId) &&
          nodeIds.has(connection.toNodeId),
      )
      .map((connection) => ({
        id: connection.id,
        source: connection.fromNodeId,
        target: connection.toNodeId,
        sourceHandle:
          connection.fromOutput === "main" ? null : connection.fromOutput,
        targetHandle: connection.toInput === "main" ? null : connection.toInput,
        type: "default",
      }));
  }, [initialConnections, initialNodes]);

  const [nodes, setNodes, onNodesChangeNative] =
    useNodesState(initialFlowNodes);
  const [edges, setEdges, onEdgesChangeNative] =
    useEdgesState(initialFlowEdges);

  const addNodeMutation = useMutation(trpc.workflows.addNode.mutationOptions());
  const deleteNodeMutation = useMutation(
    trpc.workflows.deleteNode.mutationOptions(),
  );
  const createConnectionMutation = useMutation(
    trpc.workflows.createConnection.mutationOptions(),
  );
  const deleteConnectionMutation = useMutation(
    trpc.workflows.deleteConnection.mutationOptions(),
  );
  const moveNodesMutation = useMutation(
    trpc.workflows.moveNodes.mutationOptions(),
  );
  const updateNodeMutation = useMutation(
    trpc.workflows.updateNode.mutationOptions(),
  );
  const renameMutation = useMutation(
    trpc.workflows.renameWorkflow.mutationOptions(),
  );
  const runMutation = useMutation(trpc.workflows.runWorkflow.mutationOptions());
  const validateQuery = useQuery({
    ...trpc.workflows.validateWorkflow.queryOptions({ workflowId }),
    enabled: false,
  });

  const webhookEnabled =
    selectedNodeId !== null &&
    initialNodes.some(
      (node) => node.id === selectedNodeId && node.type === "WEBHOOK_TRIGGER",
    );
  const webhookQuery = useQuery({
    ...trpc.workflows.getWebhook.queryOptions({
      workflowId,
      nodeId: selectedNodeId ?? "",
    }),
    enabled: webhookEnabled,
  });

  const selectedNodeItem = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    const source = initialNodes.find((node) => node.id === selectedNodeId);
    if (!source) {
      return null;
    }
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      data: source.data ?? {},
      credentialId: source.credentialId,
    } satisfies EditorNodeItem;
  }, [selectedNodeId, initialNodes]);

  const onNodesChange: (changes: NodeChange<Node<WorkflowNodeData>>[]) => void =
    useCallback(
      (changes) => {
        const removed = changes.filter((change) => change.type === "remove");
        for (const change of removed) {
          const flowNode = nodes.find((node) => node.id === change.id);
          if (flowNode) {
            void deleteNodeMutation
              .mutateAsync({
                workflowId,
                nodeId: flowNode.data.nodeId,
              })
              .catch((error: unknown) => {
                toast.error(messageOf(error) || "Failed to delete node");
                reload();
              });
          }
          if (selectedNodeId === change.id) {
            setSelectedNodeId(null);
          }
        }
        onNodesChangeNative(changes);
      },
      [
        nodes,
        onNodesChangeNative,
        deleteNodeMutation,
        workflowId,
        selectedNodeId,
      ],
    );

  const onEdgesChange = useCallback(
    (changes: Parameters<typeof onEdgesChangeNative>[0]) => {
      const removed = changes.filter((change) => change.type === "remove");
      for (const change of removed) {
        const edge = edges.find((item) => item.id === change.id);
        if (edge) {
          void deleteConnectionMutation
            .mutateAsync({ workflowId, connectionId: edge.id })
            .catch((error: Error) => {
              toast.error(error.message || "Failed to delete connection");
              reload();
            });
        }
      }
      onEdgesChangeNative(changes);
    },
    [edges, onEdgesChangeNative, deleteConnectionMutation, workflowId],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      void createConnectionMutation
        .mutateAsync({
          workflowId,
          fromNodeId: connection.source,
          toNodeId: connection.target,
          fromOutput: connection.sourceHandle ?? "main",
          toInput: "main",
        })
        .then((result) => {
          setEdges((current) => [
            ...current,
            {
              id: result.connectionId,
              source: connection.source,
              target: connection.target,
              sourceHandle:
                (connection.sourceHandle ?? "main") === "main"
                  ? null
                  : connection.sourceHandle,
              targetHandle: null,
              type: "default",
            },
          ]);
        })
        .catch((error: Error) => {
          toast.error(messageOf(error) || "Could not connect nodes");
        });
    },
    [createConnectionMutation, setEdges, workflowId],
  );

  const onNodeDragStop = useCallback(
    (_event: unknown, node: Node<WorkflowNodeData>) => {
      setValidationState("idle");
      setValidationErrors([]);
      void moveNodesMutation
        .mutateAsync({
          workflowId,
          positions: [
            {
              nodeId: node.data.nodeId,
              x: node.position.x,
              y: node.position.y,
            },
          ],
        })
        .catch(() => {
          // Position persistence is best-effort; retried on next drag.
        });
    },
    [moveNodesMutation, workflowId],
  );

  function addNode(type: string) {
    const meta = getNodeTypeMeta(type as Parameters<typeof getNodeTypeMeta>[0]);
    const position = { x: 160 + nodes.length * 28, y: 140 + nodes.length * 28 };
    void addNodeMutation
      .mutateAsync({ workflowId, type, position })
      .then((result) => {
        setNodes((current) => [
          ...current,
          toFlowNode({
            id: result.nodeId,
            name: meta?.label ?? type,
            type,
            position,
            data: meta?.defaultData ?? {},
            credentialId: null,
            webhookEndpoint:
              type === "WEBHOOK_TRIGGER" ? { secret: "", enabled: true } : null,
          } as WorkflowEditorProps["initialNodes"][number]),
        ]);
        setSelectedNodeId(result.nodeId);
        setPaletteOpen(false);
        setValidationState("idle");
        setValidationErrors([]);
      })
      .catch((error: Error) => {
        toast.error(messageOf(error) || "Could not add node");
      });
  }

  function deleteNode(nodeId: string) {
    void deleteNodeMutation
      .mutateAsync({ workflowId, nodeId })
      .then(() => {
        setNodes((current) =>
          current.filter((node) => node.data.nodeId !== nodeId),
        );
        setEdges((current) =>
          current.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
          ),
        );
        setSelectedNodeId(null);
        setValidationState("idle");
        setValidationErrors([]);
      })
      .catch((error: Error) => {
        toast.error(messageOf(error) || "Could not delete node");
      });
  }

  async function saveNode(input: {
    nodeId: string;
    name: string;
    data: Record<string, unknown>;
    credentialId: string | null;
  }) {
    try {
      await updateNodeMutation.mutateAsync({
        workflowId,
        nodeId: input.nodeId,
        name: input.name,
        data: input.data,
        credentialId: input.credentialId,
      });
      setNodes((current) =>
        current.map((node) =>
          node.data.nodeId === input.nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  nodeName: input.name,
                },
              }
            : node,
        ),
      );
      setValidationState("idle");
      setValidationErrors([]);
      return;
    } catch (error) {
      const message = messageOf(error) || "Could not save node config";
      toast.error(message);
      throw error;
    }
  }

  function renameWorkflow() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) {
      setName(initialName);
      return;
    }
    setNameSaving(true);
    void renameMutation
      .mutateAsync({ workflowId, name: trimmed })
      .catch((error: Error) => {
        toast.error(messageOf(error) || "Could not rename workflow");
      })
      .finally(() => setNameSaving(false));
  }

  function runValidate() {
    setValidationState("checking");
    void validateQuery.refetch().then(({ data }) => {
      if (data?.ok) {
        setValidationErrors([]);
        setValidationState("valid");
        toast.success("Workflow is valid");
      } else {
        setValidationErrors(data?.errors ?? ["Workflow is invalid"]);
        setValidationState("error");
      }
    });
  }

  function runWorkflow() {
    setIsRunning(true);
    void runMutation
      .mutateAsync({ workflowId })
      .then(({ executionId }) => {
        router.push(`/executions/${executionId}`);
      })
      .catch((error: Error) => {
        setValidationErrors([messageOf(error) || "Failed to run workflow"]);
        setValidationState("error");
        setIsRunning(false);
      });
  }

  const runDisabled = isRunning || nodes.length === 0;

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild size="icon-sm" variant="ghost">
            <Link href="/workflows">
              <ArrowLeftIcon className="size-4" />
              <span className="sr-only">Back to workflows</span>
            </Link>
          </Button>
          <form
            className="flex min-w-0 items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              renameWorkflow();
            }}
          >
            <Input
              aria-label="Workflow name"
              className="h-8 min-w-0 border-transparent px-2 text-sm font-semibold shadow-none focus-visible:border-ring"
              onChange={(event) => setName(event.target.value)}
              onBlur={renameWorkflow}
              value={name}
            />
            {nameSaving ? (
              <span className="text-xs text-muted-foreground">Saving…</span>
            ) : null}
          </form>
        </div>

        <div className="flex items-center gap-2">
          {validationState === "valid" ? (
            <Badge variant="secondary">
              <CircleCheckIcon className="size-3" />
              Valid
            </Badge>
          ) : validationState === "checking" ? (
            <Badge variant="outline">Checking…</Badge>
          ) : null}

          <Button onClick={runValidate} size="sm" variant="outline">
            <ShieldCheckIcon className="size-4" />
            Validate
          </Button>
          <Button
            disabled={runDisabled}
            onClick={runWorkflow}
            size="sm"
            title={
              hasOnlyTrigger(nodes) ? "Add a step before running" : undefined
            }
          >
            {isRunning ? (
              <span className="size-4 animate-spin rounded-full border-2 border-background/40 border-t-background" />
            ) : (
              <PlayIcon className="size-4" />
            )}
            Run
          </Button>
        </div>
      </header>

      {validationErrors.length > 0 ? (
        <div className="border-b bg-destructive/5 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            The workflow cannot run:
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-destructive/90">
            {validationErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="relative flex flex-1 overflow-hidden">
        <aside
          className={`${
            paletteOpen
              ? "absolute inset-y-0 left-0 z-20 w-72 border-r bg-background"
              : "hidden"
          } lg:static lg:block lg:w-60 lg:shrink-0 lg:border-r`}
        >
          <NodePalette disabled={isRunning} onAdd={addNode} />
        </aside>

        <main className="relative flex-1">
          <ReactFlow
            connectionLineStyle={{ stroke: "hsl(var(--ring))", strokeWidth: 2 }}
            edges={edges}
            fitView
            maxZoom={2}
            minZoom={0.25}
            nodeTypes={nodeTypes}
            nodes={nodes}
            onConnect={onConnect}
            onEdgesChange={onEdgesChange}
            onNodeClick={(_event, node) => {
              setSelectedNodeId(node.data.nodeId);
              setValidationState("idle");
            }}
            onNodeDragStop={onNodeDragStop}
            onNodesChange={onNodesChange}
            onPaneClick={() => setSelectedNodeId(null)}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              color="hsl(var(--border))"
              gap={28}
              size={1.5}
              variant={BackgroundVariant.Dots}
            />
            <Controls showInteractive={false} />
            <Panel position="top-left" className="lg:hidden">
              <Button
                onClick={() => setPaletteOpen((open) => !open)}
                size="sm"
                variant="outline"
              >
                {paletteOpen ? "Close" : "Add node"}
              </Button>
            </Panel>
          </ReactFlow>
        </main>

        {selectedNodeItem && selectedNodeId ? (
          <aside className="w-80 shrink-0 border-l bg-background max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20">
            <NodeConfigPanel
              credentials={credentials}
              node={selectedNodeItem}
              onClose={() => setSelectedNodeId(null)}
              onDelete={deleteNode}
              onSave={saveNode}
              webhookUrl={webhookQuery.data?.url}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function hasOnlyTrigger(nodes: Array<{ data?: WorkflowNodeData }>) {
  const triggerCount = nodes.filter((node) => node.data?.isTrigger).length;
  return nodes.length === triggerCount;
}

function messageOf(error: unknown): string | null {
  return error instanceof Error && error.message ? error.message : null;
}

function reload() {
  window.location.reload();
}
