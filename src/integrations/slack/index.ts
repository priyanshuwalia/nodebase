import "server-only";

import type { InterpolationContext } from "@/features/workflows/server/interpolation";
import { interpolateValue } from "@/features/workflows/server/interpolation";
import type { NodeOutput } from "@/integrations/nodes/item";
import { decryptSecret } from "@/lib/crypto";

export type SlackNodeConfig = {
  message?: unknown;
  channel?: unknown;
};

export type SlackNodeRunInput = {
  config: SlackNodeConfig;
  context: InterpolationContext;
  credential?: { type: string; value: string } | null;
};

export async function runSlackNode({
  config,
  context,
  credential,
}: SlackNodeRunInput): Promise<NodeOutput> {
  const message = String(interpolateValue(config.message ?? "", context));
  const channel = String(config.channel ?? "").trim();

  if (!message.trim()) {
    throw new Error("Slack message is empty");
  }

  let webhookUrl: string | undefined;

  if (credential && credential.type === "SLACK") {
    webhookUrl = decryptSecret(credential.value);
  } else if (process.env.SLACK_WEBHOOK_URL) {
    webhookUrl = process.env.SLACK_WEBHOOK_URL;
  }

  if (!webhookUrl) {
    throw new Error(
      "No Slack incoming webhook is configured. Assign a Slack credential to this node or set SLACK_WEBHOOK_URL.",
    );
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: message,
        ...(channel ? { channel } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Slack webhook responded with HTTP ${response.status}${
          body ? `\n${body.slice(0, 300)}` : ""
        }`,
      );
    }

    return [
      {
        json: { ok: true, channel: channel || "default", ts: "" },
        pairedItem: 0,
      },
    ];
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Slack webhook")) {
      throw error;
    }
    const message1 =
      error instanceof Error ? error.message : "Request to Slack failed";
    throw new Error(`Slack message failed: ${message1}`);
  }
}
