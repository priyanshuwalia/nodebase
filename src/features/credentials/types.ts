import { maskSecret } from "@/lib/crypto";

export const CREDENTIAL_TYPES = [
  "OPENAI",
  "ANTHROPIC",
  "GEMINI",
  "SLACK",
  "DISCORD",
  "HTTP_BEARER",
] as const;
export type CredentialTypeValue = (typeof CREDENTIAL_TYPES)[number];

export function isCredentialType(value: string): value is CredentialTypeValue {
  return (CREDENTIAL_TYPES as readonly string[]).includes(value);
}

export function maskCredential(value: string): string {
  return maskSecret(value);
}
