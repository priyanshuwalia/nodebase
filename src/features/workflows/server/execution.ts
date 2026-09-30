import "server-only";

import type { Connection, Node, NodeType } from "@/generated/prisma";
import { Prisma } from "@/generated/prisma";
import { runAiNode } from "@/integrations/ai";
import { runDiscordNode } from "@/integrations/discord";
import { runHttpNode } from "@/integrations/http";
import type { NodeOutput } from "@/integrations/nodes/item";
import { normalizeToItems } from "@/integrations/nodes/item";
import { runSlackNode } from "@/integrations/slack";
import {
  runAggregate,
  runCondition,
  runDelay,
  runExtractField,
  runLimit,
  runLoop,
  runMerge,
  runRemoveDuplicates,
  runRemoveEmpty,
  runSort,
  runSplitOut,
  runSummarize,
  runSwitch,
  runTransformJson,
  runWait,
} from "@/integrations/transforms";
import prisma from "@/lib/db";
import { orderAndReach } from "./graph";
import type { InterpolationContext } from "./interpolation";
import { queueWorkflowRun } from "./run";
import { validateWorkflowGraph } from "./validation";

export type WorkflowRunOptions = {
  executionId: string;
  workflowId: string;
  triggerType?: string;
  triggerPayload?: unknown;
  replayFrom?: { executionId: string; stepIndex: number } | null;
};

export class WaitNodeError extends Error {
  constructor(
    message: string,
    public executionId: string,
    public output: NodeOutput,
    public waitTill?: Date,
  ) {
    super(message);
    this.name = "WaitNodeError";
  }
}

type NodeWithCredential = Node & {
  credential: { id: string; type: string; value: string } | null;
};

type StepWrite = {
  executionId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  order: number;
  input: Prisma.InputJsonValue | null;
  output: Prisma.InputJsonValue | null;
  error: string | null;
  errorStack: string | null;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  attempt: number;
};

function serialize(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function writeStep(step: StepWrite) {
  const input = step.input ?? Prisma.JsonNull;
  const output = step.output ?? Prisma.JsonNull;

  await prisma.executionStep.upsert({
    where: {
      executionId_nodeId: {
        executionId: step.executionId,
        nodeId: step.nodeId,
      },
    },
    create: {
      ...step,
      input: input as Prisma.InputJsonValue,
      output: output as Prisma.InputJsonValue,
    },
    update: {
      status: step.status,
      order: step.order,
      input: input as Prisma.InputJsonValue,
      output: output as Prisma.InputJsonValue,
      error: step.error,
      errorStack: step.errorStack,
      completedAt: step.completedAt,
      durationMs: step.durationMs,
      attempt: step.attempt,
    },
  });
}

async function markExecutionFailed(
  executionId: string,
  message: string,
  stack?: string | null,
) {
  await prisma.execution.update({
    where: { id: executionId },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error: message,
      errorStack: stack ?? null,
    },
  });
}

function findTriggerNode(nodes: NodeWithCredential[]) {
  return nodes.find((node) =>
    [
      "MANUAL_TRIGGER",
      "WEBHOOK_TRIGGER",
      "SCHEDULE_TRIGGER",
      "INITIAL",
    ].includes(node.type),
  );
}

function executeNode(
  node: NodeWithCredential,
  context: InterpolationContext,
  options: WorkflowRunOptions,
): Promise<NodeOutput> {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const credential = node.credential
    ? { type: node.credential.type, value: node.credential.value }
    : null;

  switch (node.type as NodeType) {
    case "MANUAL_TRIGGER":
    case "INITIAL":
      return Promise.resolve([
        {
          json: {
            triggeredAt: new Date().toISOString(),
            trigger: "MANUAL",
          },
          pairedItem: 0,
        },
      ]);
    case "ERROR_TRIGGER":
      return Promise.resolve([
        {
          json: {
            triggeredAt: new Date().toISOString(),
            trigger: "ERROR",
            error: options.triggerPayload ?? {},
          },
          pairedItem: 0,
        },
      ]);
    case "WEBHOOK_TRIGGER":
      if (
        options.triggerType === "WEBHOOK" &&
        options.triggerPayload !== undefined
      ) {
        return Promise.resolve(normalizeToItems(options.triggerPayload));
      }
      return Promise.reject(
        new Error(
          "This workflow is started by a webhook. POST to the workflow's webhook URL to run it — it cannot be run manually.",
        ),
      );
    case "SCHEDULE_TRIGGER":
      if (options.triggerType === "SCHEDULE") {
        return Promise.resolve([
          {
            json: {
              firedAt: new Date().toISOString(),
              trigger: "SCHEDULE",
            },
            pairedItem: 0,
          },
        ]);
      }
      return Promise.reject(
        new Error(
          "This workflow is started on a schedule. Runs are triggered automatically by the schedule — it cannot be run manually.",
        ),
      );
    case "GEMINI":
    case "OPENAI":
    case "ANTHROPIC":
      return runAiNode({
        type: node.type,
        config: data as never,
        context,
        credential,
      });
    case "HTTP_REQUEST":
      return runHttpNode({ config: data as never, context, credential });
    case "SLACK":
      return runSlackNode({ config: data as never, context, credential });
    case "DISCORD":
      return runDiscordNode({ config: data as never, context, credential });
    case "CONDITION":
      return Promise.resolve(runCondition(data as never, context));
    case "DELAY":
      return runDelay(data as never);
    case "TRANSFORM_JSON":
      return Promise.resolve(runTransformJson(data as never, context));
    case "EXTRACT_FIELD":
      return Promise.resolve(runExtractField(data as never, context));
    case "SWITCH":
      return Promise.resolve(runSwitch(data as never, context));
    case "MERGE":
      return Promise.resolve(runMerge(data as never, context));
    case "WAIT":
      return runWait(data as never, context).then((result) => {
        const mode = String(data.mode ?? "interval");
        if (mode === "webhook") {
          throw new WaitNodeError(
            "Waiting for webhook call",
            options.executionId,
            result,
          );
        }
        if (mode === "time") {
          const waitUntil = new Date(
            Date.now() + Number(data.milliseconds ?? 60000),
          );
          throw new WaitNodeError(
            "Waiting for specified time",
            options.executionId,
            result,
            waitUntil,
          );
        }
        return result;
      });
    case "LOOP":
      return Promise.resolve(runLoop(data as never, context));
    case "SORT":
      return Promise.resolve(runSort(data as never, context));
    case "LIMIT":
      return Promise.resolve(runLimit(data as never, context));
    case "REMOVE_DUPLICATES":
      return Promise.resolve(runRemoveDuplicates(data as never, context));
    case "SPLIT_OUT":
      return Promise.resolve(runSplitOut(data as never, context));
    case "SUMMARIZE":
      return Promise.resolve(runSummarize(data as never, context));
    case "AGGREGATE":
      return Promise.resolve(runAggregate(data as never, context));
    case "REMOVE_EMPTY":
      return Promise.resolve(runRemoveEmpty(data as never, context));
    case "EXECUTE_WORKFLOW":
      return Promise.resolve([
        { json: { workflowId: String(data.workflowId ?? "") }, pairedItem: 0 },
      ]);
    case "RESPOND_TO_WEBHOOK":
      return Promise.resolve([
        {
          json: {
            respondWith: String(data.respondWith ?? "json"),
            responseCode: Number(data.responseCode ?? 200),
          },
          pairedItem: 0,
        },
      ]);
    case "EXECUTE_SUBWORKFLOW_TRIGGER":
      return Promise.resolve([
        {
          json: {
            triggeredAt: new Date().toISOString(),
            trigger: "SUBWORKFLOW",
            parentExecutionId: options.triggerPayload,
          },
          pairedItem: 0,
        },
      ]);
    default:
      return Promise.reject(
        new Error(`Node type ${node.type} is not implemented yet.`),
      );
  }
}

export async function executeWorkflow(options: WorkflowRunOptions): Promise<{
  ok: boolean;
  executionId: string;
  status: "SUCCESS" | "FAILED";
}> {
  const { executionId, workflowId } = options;

  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        connections: true,
        nodes: {
          include: { credential: true },
        },
      },
    });

    if (!workflow) {
      await markExecutionFailed(executionId, "Workflow not found");
      return { ok: false, executionId, status: "FAILED" };
    }

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        workflowSnapshot: serialize({
          nodes: workflow.nodes,
          connections: workflow.connections,
        }),
      },
    });

    const nodes = workflow.nodes as unknown as NodeWithCredential[];
    const connections = workflow.connections as Connection[];

    const validation = validateWorkflowGraph(nodes, connections);
    if (!validation.ok) {
      await markExecutionFailed(
        executionId,
        `Workflow is invalid and was not run:\n${validation.errors.join("\n")}`,
      );
      return { ok: false, executionId, status: "FAILED" };
    }

    const connectivity = orderAndReach(nodes, connections);
    if (!connectivity.ok) {
      await markExecutionFailed(executionId, connectivity.error);
      return { ok: false, executionId, status: "FAILED" };
    }

    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const edges = connections.map((connection) => ({
      fromNodeId: connection.fromNodeId,
      toNodeId: connection.toNodeId,
      fromOutput: connection.fromOutput,
    }));

    const triggerNode = findTriggerNode(nodes);
    if (!triggerNode) {
      await markExecutionFailed(executionId, "Workflow has no trigger");
      return { ok: false, executionId, status: "FAILED" };
    }

    const nodeByName = new Map<string, string>();
    for (const node of nodes) {
      nodeByName.set(node.name, node.id);
    }

    const outputs = new Map<string, NodeOutput>();
    const stepLog: Array<{
      nodeId: string;
      nodeName: string;
      status: string;
      output?: unknown;
      error?: string;
    }> = [];

    let replayOutputs: Map<string, NodeOutput> | null = null;
    if (options.replayFrom) {
      const previousSteps = await prisma.executionStep.findMany({
        where: { executionId: options.replayFrom.executionId },
        orderBy: { order: "asc" },
      });
      replayOutputs = new Map(
        previousSteps
          .filter((step) => step.nodeId && step.status === "SUCCESS")
          .map((step) => [
            step.nodeId as string,
            normalizeToItems(step.output),
          ]),
      );
    }

    const now = new Date();
    const baseContext = {
      now,
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      workflow: { id: workflow.id, name: workflow.name },
      execution: { id: executionId },
      vars: {},
      itemIndex: 0,
      runIndex: 0,
    };

    for (let index = 0; index < connectivity.orderedIds.length; index++) {
      const nodeId = connectivity.orderedIds[index];
      const node = nodesById.get(nodeId);
      if (!node) {
        continue;
      }

      const startedAt = new Date();

      const predecessorIds = edges
        .filter((edge) => edge.toNodeId === node.id)
        .map((edge) => edge.fromNodeId);

      const successfulPredecessors = predecessorIds.filter((id) =>
        outputs.has(id),
      );
      const prevNodeId = successfulPredecessors.reduce(
        (latest, id) => {
          const currentIndex = connectivity.orderedIds.indexOf(id);
          const latestIndex = latest
            ? connectivity.orderedIds.indexOf(latest)
            : -1;
          return currentIndex > latestIndex ? id : latest;
        },
        null as string | null,
      );

      const context: InterpolationContext = {
        ...baseContext,
        trigger:
          outputs.get(triggerNode.id) ??
          normalizeToItems(options.triggerPayload) ??
          null,
        prev: prevNodeId ? (outputs.get(prevNodeId) ?? null) : null,
        node: Object.fromEntries(outputs),
        nodeByName: Object.fromEntries(
          [...outputs.entries()]
            .map(([id, items]) => {
              const node = nodesById.get(id);
              return node ? [node.name, items] : null;
            })
            .filter((entry): entry is [string, NodeOutput] => entry !== null),
        ),
      };

      const replayAndSkipped =
        options.replayFrom && index < options.replayFrom.stepIndex;
      if (replayAndSkipped) {
        const replayedOutput = replayOutputs?.get(node.id) ?? null;
        if (replayedOutput !== null) {
          await writeStep({
            executionId,
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            status: "SUCCESS",
            order: index,
            input: serialize({ replayed: true }),
            output: serialize(replayedOutput),
            error: null,
            errorStack: null,
            startedAt,
            completedAt: startedAt,
            durationMs: null,
            attempt: 1,
          });
          if (replayedOutput !== undefined) {
            outputs.set(node.id, replayedOutput);
          }
          continue;
        }
      }

      const blocked = edges.some((edge) => {
        if (edge.toNodeId !== node.id) {
          return false;
        }
        if (
          edge.fromOutput !== "true" &&
          edge.fromOutput !== "false" &&
          edge.fromOutput !== "loop" &&
          edge.fromOutput !== "done"
        ) {
          return false;
        }
        const parent = nodesById.get(edge.fromNodeId);
        if (!parent) {
          return false;
        }
        if (parent.type === "CONDITION") {
          const parentOutput = outputs.get(parent.id)?.[0]?.json as
            | { result?: boolean }
            | undefined;
          return parentOutput?.result !== (edge.fromOutput === "true");
        }
        if (parent.type === "SWITCH") {
          const parentOutput = outputs.get(parent.id)?.[0]?.json as
            | { matched?: boolean; output?: string }
            | undefined;
          if (edge.fromOutput === "loop" || edge.fromOutput === "done") {
            return parentOutput?.matched !== true;
          }
          return parentOutput?.output !== edge.fromOutput;
        }
        if (parent.type === "LOOP") {
          const parentOutput = outputs.get(parent.id)?.[0]?.json as
            | { looped?: boolean }
            | undefined;
          if (edge.fromOutput === "loop") {
            return parentOutput?.looped !== true;
          }
          if (edge.fromOutput === "done") {
            return parentOutput?.looped === true;
          }
        }
        return false;
      });

      if (blocked) {
        const blockedEdges = edges.filter(
          (edge) =>
            edge.toNodeId === node.id &&
            (edge.fromOutput === "true" || edge.fromOutput === "false"),
        );
        const reasons = blockedEdges
          .map((edge) => {
            const parent = nodesById.get(edge.fromNodeId);
            return `${parent?.name ?? "condition"} → cond.${edge.fromOutput}`;
          })
          .join(", ");

        await writeStep({
          executionId,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          status: "SKIPPED",
          order: index,
          input: serialize({ skipped: true }),
          output: serialize({
            skipped: true,
            reason: `Branch not taken (${reasons})`,
          }),
          error: null,
          errorStack: null,
          startedAt,
          completedAt: new Date(),
          durationMs: 0,
          attempt: 1,
        });

        stepLog.push({
          nodeId: node.id,
          nodeName: node.name,
          status: "SKIPPED",
          output: { skipped: true, reason: `Branch not taken (${reasons})` },
        });
        continue;
      }

      const inputSummary = serialize({
        prev: context.prev,
        trigger: context.trigger,
        ...(options.triggerType ? { triggerType: options.triggerType } : {}),
      });

      if (node.disabled) {
        await writeStep({
          executionId,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          status: "SKIPPED",
          order: index,
          input: inputSummary,
          output: serialize({ skipped: true, reason: "Node is disabled" }),
          error: null,
          errorStack: null,
          startedAt,
          completedAt: new Date(),
          durationMs: 0,
          attempt: 1,
        });
        stepLog.push({
          nodeId: node.id,
          nodeName: node.name,
          status: "SKIPPED",
          output: { skipped: true, reason: "Node is disabled" },
        });
        continue;
      }

      const maxTries = node.retryOnFail ? Math.max(1, node.maxTries) : 1;
      const waitBetweenTries = node.waitBetweenTries;

      let output: NodeOutput = [];
      let error: string | null = null;
      let errorStack: string | null = null;
      let attempt = 0;
      const nodeStartedAt = new Date();

      for (attempt = 1; attempt <= maxTries; attempt++) {
        try {
          output = await executeNode(node, context, options);
          error = null;
          errorStack = null;
          break;
        } catch (e) {
          if (e instanceof WaitNodeError) {
            await writeStep({
              executionId,
              nodeId: node.id,
              nodeName: node.name,
              nodeType: node.type,
              status: "SUCCESS",
              order: index,
              input: inputSummary,
              output: serialize(e.output),
              error: null,
              errorStack: null,
              startedAt: nodeStartedAt,
              completedAt: new Date(),
              durationMs: Date.now() - nodeStartedAt.getTime(),
              attempt: 1,
            });
            await prisma.execution.update({
              where: { id: executionId },
              data: {
                status: "WAITING",
                waitTill: e.waitTill ?? null,
                output: serialize({ nodes: stepLog }),
              },
            });
            return { ok: true, executionId, status: "SUCCESS" as const };
          }
          error = e instanceof Error ? e.message : "Node execution failed";
          errorStack = e instanceof Error ? (e.stack ?? null) : null;
          if (attempt < maxTries) {
            await new Promise((resolve) =>
              setTimeout(resolve, waitBetweenTries * attempt),
            );
          }
        }
      }

      const completedAt = new Date();

      if (node.alwaysOutputData && output.length === 0) {
        output = [{ json: {}, pairedItem: 0 }];
      }

      if (error) {
        const errorOutput: NodeOutput = [
          {
            json: {
              error,
              errorStack,
              attempt,
              maxTries,
            },
            pairedItem: 0,
          },
        ];

        if (node.onError === "CONTINUE") {
          await writeStep({
            executionId,
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            status: "SUCCESS",
            order: index,
            input: inputSummary,
            output: serialize(errorOutput),
            error: null,
            errorStack: null,
            startedAt: nodeStartedAt,
            completedAt,
            durationMs: completedAt.getTime() - nodeStartedAt.getTime(),
            attempt,
          });
          outputs.set(node.id, errorOutput);
          stepLog.push({
            nodeId: node.id,
            nodeName: node.name,
            status: "SUCCESS",
            output: serialize(errorOutput),
          });
          continue;
        }

        if (node.onError === "CONTINUE_ERROR_OUTPUT") {
          await writeStep({
            executionId,
            nodeId: node.id,
            nodeName: node.name,
            nodeType: node.type,
            status: "SUCCESS",
            order: index,
            input: inputSummary,
            output: serialize(errorOutput),
            error: null,
            errorStack: null,
            startedAt: nodeStartedAt,
            completedAt,
            durationMs: completedAt.getTime() - nodeStartedAt.getTime(),
            attempt,
          });
          outputs.set(node.id, errorOutput);
          stepLog.push({
            nodeId: node.id,
            nodeName: node.name,
            status: "SUCCESS",
            output: serialize(errorOutput),
          });
          continue;
        }

        await writeStep({
          executionId,
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          status: "FAILED",
          order: index,
          input: inputSummary,
          output: null,
          error,
          errorStack,
          startedAt: nodeStartedAt,
          completedAt,
          durationMs: completedAt.getTime() - nodeStartedAt.getTime(),
          attempt,
        });

        stepLog.push({
          nodeId: node.id,
          nodeName: node.name,
          status: "FAILED",
          error,
        });

        await markExecutionFailed(
          executionId,
          `Node "${node.name}" failed after ${attempt} attempt(s):\n${error}`,
          errorStack,
        );
        await prisma.execution.update({
          where: { id: executionId },
          data: { output: serialize({ nodes: stepLog }) },
        });

        const errorWorkflowId = workflow.errorWorkflowId;
        if (errorWorkflowId) {
          try {
            await queueWorkflowRun({
              workflowId: errorWorkflowId,
              triggerType: "MANUAL",
              triggerPayload: {
                error: {
                  message: error,
                  stack: errorStack,
                  executionId,
                  workflowId: workflow.id,
                  workflowName: workflow.name,
                  nodeId: node.id,
                  nodeName: node.name,
                  nodeType: node.type,
                },
              },
            });
          } catch {
            // Error workflow trigger failure should not mask the original error
          }
        }

        return { ok: false, executionId, status: "FAILED" };
      }

      await writeStep({
        executionId,
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status: "SUCCESS",
        order: index,
        input: inputSummary,
        output: serialize(output),
        error: null,
        errorStack: null,
        startedAt: nodeStartedAt,
        completedAt,
        durationMs: completedAt.getTime() - nodeStartedAt.getTime(),
        attempt,
      });

      outputs.set(node.id, output);
      stepLog.push({
        nodeId: node.id,
        nodeName: node.name,
        status: "SUCCESS",
        output: serialize(output),
      });
    }

    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        triggerType: options.triggerType ?? "MANUAL",
        output: serialize({ nodes: stepLog }),
      },
    });

    return { ok: true, executionId, status: "SUCCESS" };
  } catch (codeError) {
    const message =
      codeError instanceof Error
        ? codeError.message
        : "Unexpected workflow execution error";
    const stack = codeError instanceof Error ? codeError.stack : null;
    await markExecutionFailed(executionId, message, stack);
    return { ok: false, executionId, status: "FAILED" };
  }
}
