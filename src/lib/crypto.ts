import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PREFIX = "enc:v1:";
const KEY_BYTES = 32;

function getEncryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }

  const base64Attempt = Buffer.from(raw, "base64");
  if (
    base64Attempt.length === KEY_BYTES &&
    base64Attempt.toString("base64") === raw
  ) {
    return base64Attempt;
  }

  const hexAttempt = Buffer.from(
    raw.length === 64 ? raw : raw.padStart(64, "0"),
    "hex",
  );
  if (hexAttempt.length === KEY_BYTES) {
    return hexAttempt;
  }

  const rawAttempt = Buffer.from(raw.padEnd(KEY_BYTES, "0"));
  if (rawAttempt.length === KEY_BYTES) {
    return rawAttempt;
  }

  throw new Error(
    "ENCRYPTION_KEY must be 32 bytes (base64-encoded via `openssl rand -base64 32` or a 64-char hex string)",
  );
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    PREFIX,
    iv.toString("base64url"),
    ":",
    authTag.toString("base64url"),
    ":",
    encrypted.toString("base64url"),
  ].join("");
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) {
    return value;
  }

  const [, ivPart, tagPart, dataPart] = value.split(":");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Encrypted credential value is malformed");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskSecret(value: string): string {
  if (!value) {
    return "";
  }

  const cleaned = value.startsWith(PREFIX)
    ? value
    : value.replaceAll(/\s+/g, "");

  if (cleaned.length <= 8) {
    return `${cleaned.slice(0, 2)}${"•".repeat(Math.max(4, cleaned.length - 2))}`;
  }

  return `${cleaned.slice(0, 4)}${"•".repeat(8)}${cleaned.slice(-4)}`;
}

export function encryptSecretOrNull(
  value: string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  return encryptSecret(value);
}
