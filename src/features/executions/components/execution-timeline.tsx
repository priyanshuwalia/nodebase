"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  HistoryIcon,
  LinkIcon,
  Loader2Icon,
  RefreshCcwIcon,
  RotateCcwIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { nodeIcon } from "@/features/workflows/components/node-icon";
import { getNodeTypeMeta } from "@/integrations/nodes/registry";
import { useTRPC } from "@/trpc/client";

type StepStatus = "SUCCESS" | "FAILED" | "SKIPPED";
type RunStatus = "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED" | "WAITING";

export type ExecutionStepData = {
  id: string;
  nodeName: string;
  nodeType: string;
  status: StepStatus;
  order: number;
  input?: unknown;
  output?: unknown;
  error: string | null;
  errorStack: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  attempt: number;
};

export type ExecutionData = {
  id: string;
  status: RunStatus;
  triggerType: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  errorStack: string | null;
  workflow: { id: string; name: string };
  steps: ExecutionStepData[];
};

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function durationLabel(ms: number | null) {
  if (ms === null) {
    return "—";
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString();
}

function statusBadge(status: RunStatus) {
  switch (status) {
    case "SUCCESS":
      return (
        <Badge variant="secondary">
          <CheckCircle2Icon className="size-3" />
          Success
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive">
          <XCircleIcon className="size-3" />
          Failed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline">
          <XCircleIcon className="size-3" />
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <Loader2Icon className="size-3 animate-spin" />
          Running
        </Badge>
      );
  }
}

export function ExecutionTimeline({
  executionId,
  initialRun,
}: {
  executionId: string;
  initialRun: ExecutionData;
}) {
  const router = useRouter();
  const trpc = useTRPC();

  const [run, setRun] = useState<ExecutionData>(initialRun);

  const query = useQuery({
    ...trpc.workflows.getExecution.queryOptions({ executionId }),
    enabled: run.status === "RUNNING",
    refetchInterval: run.status === "RUNNING" ? 1500 : false,
  });

  useEffect(() => {
    if (query.data) {
      setRun(query.data);
    }
  }, [query.data]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (run.status !== "FAILED") {
      return;
    }
    const firstFailed = run.steps
      .filter((step) => step.status === "FAILED")
      .sort((a, b) => a.order - b.order)[0];
    if (firstFailed) {
      setExpanded((current) => {
        if (current.has(firstFailed.id)) {
          return current;
        }
        const next = new Set(current);
        next.add(firstFailed.id);
        return next;
      });
    }
  }, [run.status, run.steps]);

  const replayMutation = useMutation(
    trpc.workflows.replayExecution.mutationOptions({
      onSuccess: ({ executionId: nextId }) => {
        router.push(`/executions/${nextId}`);
      },
      onError: (error) => {
        toast.error(error.message || "Could not replay run");
      },
    }),
  );

  const firstFailedOrder =
    run.steps
      .filter((step) => step.status === "FAILED")
      .sort((a, b) => a.order - b.order)[0]?.order ?? null;

  const isRunning = run.status === "RUNNING";

  function toggle(stepId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  function confirmReplay(message: string) {
    if (typeof window !== "undefined") {
      return window.confirm(message);
    }
    return true;
  }

  function replayFromStep(stepOrder: number) {
    if (!confirmReplay("Replay will create a new run. Continue?")) {
      return;
    }
    replayMutation.mutate({ executionId, fromStepIndex: stepOrder });
  }

  function replayFull() {
    if (
      !confirmReplay(
        "This starts a brand-new run of the workflow with fresh steps.",
      )
    ) {
      return;
    }
    replayMutation.mutate({ executionId });
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 rounded-lg border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{run.workflow.name}</h2>
              {statusBadge(run.status)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Started {formatTime(run.startedAt) ?? "unknown"}
              {run.completedAt
                ? ` · Completed ${formatTime(run.completedAt)}`
                : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/workflows/${run.workflow.id}`}>
                <LinkIcon className="size-4" />
                Open workflow
              </Link>
            </Button>
            {!isRunning ? (
              <>
                <Button
                  disabled={replayMutation.isPending}
                  onClick={replayFull}
                  size="sm"
                  variant="outline"
                >
                  <RotateCcwIcon className="size-4" />
                  Replay run
                </Button>
                {firstFailedOrder !== null ? (
                  <Button
                    disabled={replayMutation.isPending}
                    onClick={() => replayFromStep(firstFailedOrder)}
                    size="sm"
                    title="Rerun the failed step and everything after it"
                  >
                    <RefreshCcwIcon className="size-4" />
                    Replay from failed step
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Trigger type</p>
            <p className="font-medium">{run.triggerType ?? "MANUAL"}</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Steps</p>
            <p className="font-medium">
              {run.steps.length} total ·{" "}
              {run.steps.filter((step) => step.status === "SUCCESS").length}{" "}
              succeeded ·{" "}
              {run.steps.filter((step) => step.status === "FAILED").length}{" "}
              failed
            </p>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Total duration</p>
            <p className="font-medium">
              {run.startedAt && run.completedAt
                ? durationLabel(
                    Math.max(
                      0,
                      new Date(run.completedAt).getTime() -
                        new Date(run.startedAt).getTime(),
                    ),
                  )
                : isRunning
                  ? "Running…"
                  : "—"}
            </p>
          </div>
        </div>

        {run.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              Run failure: {run.error}
            </p>
            {run.errorStack ? (
              <pre className="mt-2 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
                {run.errorStack}
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <HistoryIcon className="size-4" />
          Steps
        </h3>
        {run.steps.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            {isRunning
              ? "Waiting for the first step…"
              : "No steps were recorded for this run."}
          </div>
        ) : (
          <ol className="relative ml-3 border-l">
            {run.steps.map((step) => (
              <StepRow
                expanded={expanded.has(step.id)}
                isLast={step.order === run.steps.length - 1}
                key={step.id}
                onToggle={() => toggle(step.id)}
                step={step}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function StepRow({
  step,
  expanded,
  onToggle,
  isLast,
}: {
  step: ExecutionStepData;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}) {
  const meta = getNodeTypeMeta(
    step.nodeType as Parameters<typeof getNodeTypeMeta>[0],
  );
  const Icon = nodeIcon(meta?.icon ?? "Sparkles");
  const isReplayed =
    step.input !== null &&
    typeof step.input === "object" &&
    !Array.isArray(step.input) &&
    ((step.input as Record<string, unknown>).replayed as boolean) === true;

  const statusColor =
    step.status === "SUCCESS"
      ? "text-emerald-600"
      : step.status === "FAILED"
        ? "text-destructive"
        : "text-muted-foreground";

  const rowClasses = [
    "rounded-r-lg border border-l-0 p-3 transition-colors",
    expanded ? "bg-muted/50" : "hover:bg-muted/30",
  ].join(" ");

  return (
    <li className="relative pb-4 pl-6">
      <span
        className={`absolute -left-[9px] top-5 size-4 rounded-full border-4 border-background bg-current ${statusColor}`}
      />
      <div className={rowClasses}>
        <button
          className="flex w-full items-center justify-between gap-3 text-left"
          onClick={onToggle}
          type="button"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-md bg-muted ${
                step.status === "FAILED"
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-medium">{step.nodeName}</p>
                {step.status === "SUCCESS" ? (
                  <Badge variant="secondary">Success</Badge>
                ) : step.status === "FAILED" ? (
                  <Badge variant="destructive">Failed</Badge>
                ) : (
                  <Badge variant="outline">Skipped</Badge>
                )}
                {isReplayed ? (
                  <Badge variant="secondary">Replayed</Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {step.nodeType.replaceAll("_", " ")}
                </span>
              </div>
              {step.status === "FAILED" && step.error ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-destructive">
                  {step.error}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span>{durationLabel(step.durationMs)}</span>
            {step.attempt > 1 ? (
              <span className="rounded bg-muted px-1.5 py-0.5">
                attempt {step.attempt}
              </span>
            ) : null}
            {expanded ? (
              <ChevronDownIcon className="size-4" />
            ) : (
              <ChevronRightIcon className="size-4" />
            )}
          </div>
        </button>

        {expanded ? (
          <div className="mt-3 grid gap-3">
            {step.status === "FAILED" && step.error ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  Error
                </p>
                <p className="mt-1 text-sm">{step.error}</p>
                {step.errorStack ? (
                  <pre className="mt-2 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">
                    {step.errorStack}
                  </pre>
                ) : null}
              </div>
            ) : null}

            {step.output !== null && step.output !== undefined ? (
              <JsonBlock label="Output" value={step.output} />
            ) : null}
            {step.input !== null && step.input !== undefined && !isReplayed ? (
              <JsonBlock label="Input" value={step.input} />
            ) : null}

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Started {formatTime(step.startedAt) ?? "unknown"}</span>
              {step.completedAt ? (
                <span>Completed {formatTime(step.completedAt)}</span>
              ) : null}
              <span>Duration {durationLabel(step.durationMs)}</span>
            </div>
          </div>
        ) : null}
      </div>
      {isLast ? null : (
        <span className="pointer-events-none absolute left-0 top-0 h-full w-px bg-transparent" />
      )}
    </li>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <pre className="mt-1 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs">
        {pretty(value)}
      </pre>
    </div>
  );
}
