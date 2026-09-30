import { formatDistanceToNow } from "date-fns";
import { HistoryIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

const statusOptions = ["RUNNING", "SUCCESS", "FAILED", "CANCELLED"] as const;

function toDate(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) => {
  const session = await requireAuth();
  const params = await searchParams;

  const status = statusOptions.includes(
    params.status as (typeof statusOptions)[number],
  )
    ? (params.status as (typeof statusOptions)[number])
    : undefined;
  const workflowId = params.workflow ?? undefined;
  const from = toDate(params.from);
  const to = toDate(params.to);

  const where: Prisma.ExecutionWhereInput = {
    workflow: {
      userId: session.user.id,
      ...(workflowId ? { id: workflowId } : {}),
    },
    ...(status ? { status } : {}),
    ...(from || to
      ? {
          startedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: new Date(to.getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };

  const [executions, workflows] = await Promise.all([
    prisma.execution.findMany({
      where,
      orderBy: { startedAt: "desc" },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.workflow.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const hasFilters = Boolean(status || workflowId || from || to);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Executions</h1>
        <p className="text-sm text-muted-foreground">
          Monitor workflow runs and inspect failures.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="filter-status"
          >
            Status
          </label>
          <NativeSelect
            className="w-40"
            defaultValue={status ?? ""}
            id="filter-status"
            name="status"
            size="sm"
          >
            <NativeSelectOption value="">All</NativeSelectOption>
            {statusOptions.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="filter-workflow"
          >
            Workflow
          </label>
          <NativeSelect
            className="w-56"
            defaultValue={workflowId ?? ""}
            id="filter-workflow"
            name="workflow"
            size="sm"
          >
            <NativeSelectOption value="">All workflows</NativeSelectOption>
            {workflows.map((workflow) => (
              <NativeSelectOption key={workflow.id} value={workflow.id}>
                {workflow.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="filter-from"
          >
            From
          </label>
          <Input
            className="h-8 w-40"
            defaultValue={from ? from.toISOString().slice(0, 10) : ""}
            id="filter-from"
            name="from"
            type="date"
          />
        </div>

        <div className="grid gap-1.5">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor="filter-to"
          >
            To
          </label>
          <Input
            className="h-8 w-40"
            defaultValue={to ? to.toISOString().slice(0, 10) : ""}
            id="filter-to"
            name="to"
            type="date"
          />
        </div>

        <div className="flex gap-2">
          <ButtonSubmit />
          {hasFilters ? (
            <Link className="inline-flex h-8 items-center" href="/executions">
              <span className="text-xs text-muted-foreground hover:underline">
                Clear
              </span>
            </Link>
          ) : null}
        </div>
      </form>

      {executions.length === 0 ? (
        <Empty className="min-h-[320px] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle>
              {hasFilters ? "No matching runs" : "No executions yet"}
            </EmptyTitle>
            <EmptyDescription>
              {hasFilters
                ? "Try adjusting the filters above."
                : "Runs will appear here after a workflow is triggered."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead className="w-40">Started</TableHead>
                <TableHead className="w-40">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.map((execution) => (
                <TableRow key={execution.id}>
                  <TableCell>
                    <Link
                      href={`/executions/${execution.id}`}
                      className="font-medium hover:underline"
                    >
                      {execution.workflow.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        execution.status === "FAILED"
                          ? "destructive"
                          : execution.status === "SUCCESS"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {execution.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {execution.triggerType ?? "MANUAL"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(execution.startedAt, {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {execution.completedAt
                      ? formatDistanceToNow(execution.completedAt, {
                          addSuffix: true,
                        })
                      : "In progress"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

function ButtonSubmit() {
  return (
    <button
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm"
      type="submit"
    >
      <SearchIcon className="size-3.5" />
      Apply
    </button>
  );
}

export default Page;
