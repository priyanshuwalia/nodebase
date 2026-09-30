import "server-only";

import type { InterpolationContext } from "@/features/workflows/server/interpolation";
import { interpolateValue } from "@/features/workflows/server/interpolation";
import type { NodeOutput } from "@/integrations/nodes/item";
import { decryptSecret } from "@/lib/crypto";

export type DiscordNodeConfig = {
  message?: unknown;
  username?: unknown;
};

export type DiscordNodeRunInput = {
  config: DiscordNodeConfig;
  context: InterpolationContext;
  credential?: { type: string; value: string } | null;
};

export async function runDiscordNode({
  config,
  context,
  credential,
}: DiscordNodeRunInput): Promise<NodeOutput> {
  const message = String(interpolateValue(config.message ?? "", context));
  const username = String(config.username ?? "").trim();

  if (!message.trim()) {
    throw new Error("Discord message is empty");
  }

  let webhookUrl: string | undefined;

  if (credential && credential.type === "DISCORD") {
    webhookUrl = decryptSecret(credential.value);
  } else if (process.env.DISCORD_WEBHOOK_URL) {
    webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  if (!webhookUrl) {
    throw new Error(
      "No Discord webhook URL is configured. Assign a Discord credential to this node or set DISCORD_WEBHOOK_URL.",
    );
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content: message,
        ...(username ? { username } : {}),
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Network error";
    throw new Error(`Discord message failed: ${detail}`);
  }

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(
      `Discord webhook responded with HTTP ${response.status}${
        body ? `\n${body.slice(0, 300)}` : ""
      }`,
    );
  }

  let messageId: string | null = null;
  try {
    const json = JSON.parse(body) as { id?: string };
    messageId = typeof json.id === "string" ? json.id : null;
  } catch {
    messageId = null;
  }

  return [{ json: { ok: true, messageId }, pairedItem: 0 }];
}
