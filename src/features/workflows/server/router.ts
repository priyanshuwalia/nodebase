import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { NodeType, Prisma } from "@/generated/prisma";
import {
  credentialTypesForNodeType,
  getNodeTypeMeta,
  isImplemented,
  isTriggerType,
} from "@/integrations/nodes/registry";
import {
  parseNodeConfig,
  validateNodeConfig,
} from "@/integrations/nodes/schemas";
import prisma from "@/lib/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { orderAndReach } from "./graph";
import { queueWorkflowRun } from "./run";
import { validateWorkflowGraph } from "./validation";

function getAppUrl() {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const workflowsRouter = createTRPCRouter({
  getWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
        include: {
          connections: true,
          nodes: {
            orderBy: { createdAt: "asc" },
            include: {
              credential: { select: { id: true, name: true, type: true } },
              webhookEndpoint: { select: { secret: true, enabled: true } },
            },
          },
        },
      });

      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return workflow;
    }),

  renameWorkflow: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await prisma.workflow.updateMany({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
        data: { name: input.name },
      });
      return { ok: true };
    }),

  addNode: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        type: z.string(),
        position: positionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const meta = getNodeTypeMeta(input.type as NodeType);

      if (!meta || !isImplemented(input.type as NodeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Node type "${input.type}" is not available`,
        });
      }

      const workflow = await prisma.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
        include: { nodes: { select: { id: true, type: true } } },
      });

      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (isTriggerType(input.type as NodeType)) {
        if (workflow.nodes.some((node) => isTriggerType(node.type))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "This workflow already has a trigger. Workflows can only have one.",
          });
        }
      }

      const node = await prisma.node.create({
        data: {
          workflowId: input.workflowId,
          name: `${meta.label}`,
          type: input.type as NodeType,
          position: input.position,
          data: meta.defaultData as Prisma.InputJsonValue,
        },
      });

      let webhookUrl: string | null = null;
      if (input.type === "WEBHOOK_TRIGGER") {
        const endpoint = await prisma.webhookEndpoint.create({
          data: {
            workflowId: input.workflowId,
            nodeId: node.id,
            secret: crypto.randomUUID(),
          },
        });
        webhookUrl = `${getAppUrl()}/api/webhook/${endpoint.secret}`;
      }

      return { nodeId: node.id, webhookUrl };
    }),

  updateNode: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        nodeId: z.string(),
        name: z.string().trim().min(1).max(80).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
        credentialId: z.string().nullable().optional(),
        position: positionSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflow: { id: input.workflowId, userId: ctx.auth.user.id },
        },
      });

      if (!node) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const data =
        input.data ?? (node.data as Record<string, unknown> | null) ?? {};
      const configErrors = validateNodeConfig(node.type, data);
      if (configErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid config for "${node.name}":\n${configErrors.join("\n")}`,
        });
      }

      let credentialId = node.credentialId;
      if (input.credentialId !== undefined) {
        if (input.credentialId) {
          const allowedTypes = credentialTypesForNodeType(node.type);
          const credential = await prisma.credential.findFirst({
            where: { id: input.credentialId, userId: ctx.auth.user.id },
          });
          if (!credential) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Credential not found",
            });
          }
          if (
            allowedTypes.length > 0 &&
            !allowedTypes.includes(credential.type)
          ) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Credential "${credential.name}" (${credential.type}) is not valid for a ${node.type} node`,
            });
          }
        }
        credentialId = input.credentialId;
      }

      const normalizedData = parseNodeConfig(node.type, data) as Record<
        string,
        unknown
      >;
      const jsonData = normalizedData as Prisma.InputJsonValue;

      await prisma.node.update({
        where: { id: node.id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.position ? { position: input.position } : {}),
          ...(input.data !== undefined ? { data: jsonData } : {}),
          credentialId,
        },
      });

      return { ok: true };
    }),

  moveNodes: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        positions: z.array(
          z.object({ nodeId: z.string(), x: z.number(), y: z.number() }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
      });
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const nodeIds = new Set(
        input.positions.map((position) => position.nodeId),
      );
      const owned = await prisma.node.findMany({
        where: { id: { in: [...nodeIds] }, workflowId: input.workflowId },
        select: { id: true },
      });
      if (owned.length !== nodeIds.size) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await prisma.$transaction(
        input.positions.map((position) =>
          prisma.node.update({
            where: { id: position.nodeId },
            data: { position: { x: position.x, y: position.y } },
          }),
        ),
      );

      return { ok: true };
    }),

  deleteNode: protectedProcedure
    .input(z.object({ workflowId: z.string(), nodeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflow: { id: input.workflowId, userId: ctx.auth.user.id },
        },
      });
      if (!node) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await prisma.node.delete({ where: { id: node.id } });
      return { ok: true };
    }),

  createConnection: protectedProcedure
    .input(
      z.object({
        workflowId: z.string(),
        fromNodeId: z.string(),
        toNodeId: z.string(),
        fromOutput: z.string().default("main"),
        toInput: z.string().default("main"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const nodes = await prisma.node.findMany({
        where: { workflowId: input.workflowId },
      });
      const owned = await prisma.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
      });
      if (!owned) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (!nodes.some((node) => node.id === input.fromNodeId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source node not found",
        });
      }
      if (!nodes.some((node) => node.id === input.toNodeId)) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Target node not found",
        });
      }

      const toNode = nodes.find((node) => node.id === input.toNodeId);
      if (toNode && isTriggerType(toNode.type)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot connect into a trigger node",
        });
      }

      const existing = await prisma.connection.findMany({
        where: { workflowId: input.workflowId },
      });

      const wouldCycle = orderAndReach(nodes, [
        ...existing,
        {
          fromNodeId: input.fromNodeId,
          toNodeId: input.toNodeId,
          fromOutput: input.fromOutput,
        },
      ]);
      if (!wouldCycle.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This connection would create a cycle in the workflow.",
        });
      }

      try {
        const connection = await prisma.connection.create({
          data: {
            workflowId: input.workflowId,
            fromNodeId: input.fromNodeId,
            toNodeId: input.toNodeId,
            fromOutput: input.fromOutput,
            toInput: input.toInput,
          },
        });
        return { connectionId: connection.id };
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Those two nodes are already connected.",
        });
      }
    }),

  deleteConnection: protectedProcedure
    .input(z.object({ workflowId: z.string(), connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const connection = await prisma.connection.findFirst({
        where: {
          id: input.connectionId,
          workflow: { id: input.workflowId, userId: ctx.auth.user.id },
        },
      });
      if (!connection) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await prisma.connection.delete({ where: { id: connection.id } });
      return { ok: true };
    }),

  validateWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
        include: { connections: true, nodes: true },
      });

      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return validateWorkflowGraph(workflow.nodes, workflow.connections);
    }),

  getWebhook: protectedProcedure
    .input(z.object({ workflowId: z.string(), nodeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const node = await prisma.node.findFirst({
        where: {
          id: input.nodeId,
          workflow: { id: input.workflowId, userId: ctx.auth.user.id },
        },
        include: { webhookEndpoint: true },
      });
      if (!node || !node.webhookEndpoint) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return {
        url: `${getAppUrl()}/api/webhook/${node.webhookEndpoint.secret}`,
        enabled: node.webhookEndpoint.enabled,
      };
    }),

  runWorkflow: protectedProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await prisma.workflow.findFirst({
        where: { id: input.workflowId, userId: ctx.auth.user.id },
        include: { nodes: true, connections: true },
      });
      if (!workflow) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const trigger = workflow.nodes.find((node) => isTriggerType(node.type));
      if (!trigger) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This workflow has no trigger.",
        });
      }
      if (trigger.type !== "MANUAL_TRIGGER" && trigger.type !== "INITIAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            trigger.type === "WEBHOOK_TRIGGER"
              ? "This workflow is triggered by a webhook. POST to its webhook URL to run it."
              : "This workflow is triggered on a schedule and runs automatically.",
        });
      }

      const validation = validateWorkflowGraph(
        workflow.nodes,
        workflow.connections,
      );
      if (!validation.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Workflow is invalid:\n${validation.errors.join("\n")}`,
        });
      }

      const executionId = await queueWorkflowRun({
        workflowId: input.workflowId,
        userId: ctx.auth.user.id,
        triggerType: "MANUAL",
      });

      return { executionId };
    }),

  getExecution: protectedProcedure
    .input(z.object({ executionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const execution = await prisma.execution.findFirst({
        where: {
          id: input.executionId,
          workflow: { userId: ctx.auth.user.id },
        },
        include: {
          workflow: { select: { id: true, name: true } },
          steps: { orderBy: { order: "asc" } },
        },
      });
      if (!execution) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return {
        id: execution.id,
        status: execution.status,
        triggerType: execution.triggerType,
        startedAt: execution.startedAt.toISOString(),
        completedAt: execution.completedAt?.toISOString() ?? null,
        error: execution.error,
        errorStack: execution.errorStack,
        workflow: { id: execution.workflow.id, name: execution.workflow.name },
        steps: execution.steps.map((step) => ({
          id: step.id,
          nodeName: step.nodeName,
          nodeType: step.nodeType,
          status: step.status,
          order: step.order,
          input: step.input as unknown,
          output: step.output as unknown,
          error: step.error,
          errorStack: step.errorStack,
          startedAt: step.startedAt.toISOString(),
          completedAt: step.completedAt?.toISOString() ?? null,
          durationMs: step.durationMs,
          attempt: step.attempt,
        })),
      };
    }),

  replayExecution: protectedProcedure
    .input(
      z.object({
        executionId: z.string(),
        fromStepIndex: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const execution = await prisma.execution.findFirst({
        where: {
          id: input.executionId,
          workflow: { userId: ctx.auth.user.id },
        },
        include: { steps: { orderBy: { order: "asc" } } },
      });
      if (!execution) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const triggerStep = execution.steps[0];
      const triggerPayload =
        execution.triggerType === "WEBHOOK" ||
        execution.triggerType === "SCHEDULE"
          ? (triggerStep?.output ?? null)
          : null;

      const newExecutionId = await queueWorkflowRun({
        workflowId: execution.workflowId,
        userId: ctx.auth.user.id,
        triggerType:
          (execution.triggerType as "MANUAL" | "WEBHOOK" | "SCHEDULE") ??
          "MANUAL",
        triggerPayload,
        replayFrom:
          input.fromStepIndex !== undefined
            ? { executionId: execution.id, stepIndex: input.fromStepIndex }
            : null,
      });

      return { executionId: newExecutionId };
    }),
});
