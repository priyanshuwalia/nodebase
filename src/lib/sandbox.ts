import "server-only";

import vm from "node:vm";

export type EvalResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function evaluateExpression(
  code: string,
  context: Record<string, unknown>,
  timeoutMs = 5000,
): EvalResult {
  const sandbox: Record<string, unknown> = {
    ...context,
    undefined,
    NaN,
    Infinity,
    isNaN,
    isFinite,
    parseInt,
    parseFloat,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    Date,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Map,
    Set,
    Promise,
  };

  vm.createContext(sandbox);

  try {
    const script = new vm.Script(`(${code})`);
    const value = script.runInContext(sandbox, { timeout: timeoutMs });
    return { ok: true, value };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Expression evaluation failed";
    return { ok: false, error: message };
  }
}
