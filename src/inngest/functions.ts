// src/inngest/functions.ts
import { inngest } from "./client";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const result = await step.sleep("wait-a-month", "10s");

    return { message: `Hello ${event.data.email}!` };
  },
);
