import "server-only";

import type { InterpolationContext } from "@/features/workflows/server/interpolation";
import { interpolateValue } from "@/features/workflows/server/interpolation";
import type { NodeOutput } from "@/integrations/nodes/item";
import { decryptSecret } from "@/lib/crypto";

export type HttpNodeConfig = {
  method?: unknown;
  url?: unknown;
  headers?: unknown;
  query?: unknown;
  bodyType?: unknown;
  bodyContent?: unknown;
  timeoutMs?: unknown;
};

export type HttpNodeRunInput = {
  config: HttpNodeConfig;
  context: InterpolationContext;
  credential?: { type: string; value: string } | null;
};

type Pair = { key: string; value: string };

function toPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const obj = item as Record<string, unknown>;
      const key = String(obj.key ?? "").trim();
      if (!key) {
        return null;
      }
      return { key, value: String(obj.value ?? "") };
    })
    .filter((item): item is Pair => item !== null);
}

function readResponseBody(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function runHttpNode({
  config,
  context,
  credential,
}: HttpNodeRunInput): Promise<NodeOutput> {
  const method = String(config.method ?? "GET").toUpperCase();
  const rawUrl = String(interpolateValue(config.url ?? "", context));
  if (!rawUrl) {
    throw new Error("HTTP request URL is empty");
  }
  const timeoutMs = Number(config.timeoutMs ?? 10000);

  const url = new URL(rawUrl);

  for (const pair of toPairs(config.query)) {
    url.searchParams.append(
      pair.key,
      String(interpolateValue(pair.value, context)),
    );
  }

  const headers = new Headers();
  for (const pair of toPairs(config.headers)) {
    headers.set(pair.key, String(interpolateValue(pair.value, context)));
  }

  const bodyType = String(config.bodyType ?? "none");
  let body: BodyInit | undefined;
  if (bodyType === "json") {
    const content = String(interpolateValue(config.bodyContent ?? "", context));
    if (content.trim()) {
      headers.set("content-type", "application/json");
      body = content;
    }
  } else if (bodyType === "raw") {
    body = String(interpolateValue(config.bodyContent ?? "", context));
  }

  if (credential && credential.type === "HTTP_BEARER") {
    headers.set("authorization", `Bearer ${decryptSecret(credential.value)}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `HTTP request to ${url.toString()} timed out after ${timeoutMs}ms`,
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Network error while calling URL";
    throw new Error(`HTTP request to ${url.toString()} failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  const rawBody = await response.text();
  const data = readResponseBody(rawBody);

  if (!response.ok) {
    const snippet = String(rawBody).slice(0, 300);
    throw new Error(
      `HTTP ${response.status} ${response.statusText} from ${url.toString()}${
        snippet ? `\nResponse: ${snippet}` : ""
      }`,
    );
  }

  const flatHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    flatHeaders[key] = value;
  });

  return [
    {
      json: {
        status: response.status,
        method,
        url: url.toString(),
        headers: flatHeaders,
        data,
        rawBody,
      },
      pairedItem: 0,
    },
  ];
}
