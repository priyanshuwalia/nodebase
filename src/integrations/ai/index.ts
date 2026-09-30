import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import type { InterpolationContext } from "@/features/workflows/server/interpolation";
import { interpolateValue } from "@/features/workflows/server/interpolation";
import type { NodeType } from "@/generated/prisma";
import type { NodeOutput } from "@/integrations/nodes/item";
import { decryptSecret } from "@/lib/crypto";

const ENV_KEY_BY_TYPE: Record<string, string> = {
  GEMINI: "GOOGLE_GENERATIVE_AI_API_KEY",
  OPENAI: "OPENAI_API_KEY",
  ANTHROPIC: "ANTHROPIC_API_KEY",
};

const DEFAULT_MODEL_BY_TYPE: Record<string, string> = {
  GEMINI: "gemini-2.5-flash",
  OPENAI: "gpt-4o-mini",
  ANTHROPIC: "claude-3-5-haiku-latest",
};

export type AiNodeConfig = {
  model?: unknown;
  prompt?: unknown;
  system?: unknown;
  temperature?: unknown;
};

export type AiNodeRunInput = {
  type: NodeType;
  config: AiNodeConfig;
  context: InterpolationContext;
  credential?: { type: string; value: string } | null;
};

export async function runAiNode({
  type,
  config,
  context,
  credential,
}: AiNodeRunInput): Promise<NodeOutput> {
  const provider =
    type === "GEMINI" ? "gemini" : type === "OPENAI" ? "openai" : "anthropic";

  const model =
    typeof config.model === "string" && config.model.trim()
      ? config.model.trim()
      : DEFAULT_MODEL_BY_TYPE[type];
  const prompt = String(
    interpolateValue(
      config.prompt ?? "Continue the workflow using the previous output.",
      context,
    ),
  );
  const system = String(interpolateValue(config.system ?? "", context));

  let apiKey: string | undefined;
  const envKey = ENV_KEY_BY_TYPE[type];

  if (credential) {
    if (credential.type !== type) {
      throw new Error(
        `Node type is ${type} but the assigned credential "${credential.type}" is for a different provider`,
      );
    }
    apiKey = decryptSecret(credential.value);
  } else if (envKey && process.env[envKey]) {
    apiKey = process.env[envKey];
  } else {
    throw new Error(
      `No credential is assigned to this ${type} node and ${envKey || "provider"} is not configured. ` +
        "Assign a credential on the node or set the provider environment variable.",
    );
  }

  const temperature =
    typeof config.temperature === "number" &&
    Number.isFinite(config.temperature)
      ? config.temperature
      : undefined;

  try {
    const response = await generateText({
      prompt,
      system: system || undefined,
      temperature,
      model: (type === "GEMINI"
        ? createGoogleGenerativeAI({ apiKey })(model)
        : type === "OPENAI"
          ? createOpenAI({ apiKey })(model)
          : createAnthropic({ apiKey })(model)) as Parameters<
        typeof generateText
      >[0]["model"],
    });
    return [{ json: { text: response.text, model, provider }, pairedItem: 0 }];
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The AI provider call failed";
    throw new Error(
      `${provider} request to model "${model}" failed: ${message}`,
    );
  }
}
