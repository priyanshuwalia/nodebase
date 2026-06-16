import { inngest } from "@/inngest/client";
import { baseProcedure, createTRPCRouter, protectedProcedure } from "../init";
import prisma from "@/lib/db";
import { email } from "zod";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { TRPCError } from "@trpc/server";
export const appRouter = createTRPCRouter({
  testAi: protectedProcedure.mutation(async () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Something went wrong.",
    });
    await inngest.send({ name: "execute/ai" });
    return { success: true, message: "Job Queued" };
  }),
  getUsers: protectedProcedure.query(({ ctx }) => {
    return prisma.user.findMany();
  }),
  getWorkflows: protectedProcedure.query(({ ctx }) => {
    return prisma.workflow.findMany();
  }),
  createWorkflow: protectedProcedure.mutation(async () => {
    await inngest.send({
      name: "test/hello.world",
      data: {
        email: "priyanshu@example.com",
      },
    });
    return prisma.workflow.create({
      data: { name: "test-workflow" },
    });
  }),
});
// export type definition of API
export type AppRouter = typeof appRouter;
