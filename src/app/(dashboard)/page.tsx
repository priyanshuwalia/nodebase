import { formatDistanceToNow } from "date-fns";
import {
  FolderOpenIcon,
  GaugeIcon,
  HistoryIcon,
  PlusIcon,
  SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function DashboardPage() {
  const session = await requireAuth();

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const [workflowCount, executionCount, runsToday, workflows, recentRuns] =
    await Promise.all([
      prisma.workflow.count({ where: { userId: session.user.id } }),
      prisma.execution.count({
        where: { workflow: { userId: session.user.id } },
      }),
      prisma.execution.count({
        where: {
          workflow: { userId: session.user.id },
          startedAt: { gte: startOfToday },
        },
      }),
      prisma.workflow.findMany({
        where: { userId: session.user.id },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, name: true, updatedAt: true },
      }),
      prisma.execution.findMany({
        where: { workflow: { userId: session.user.id } },
        orderBy: { startedAt: "desc" },
        take: 8,
        include: { workflow: { select: { id: true, name: true } } },
      }),
    ]);

  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your workflows and runs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/templates">
              <SparklesIcon className="size-4" />
              Browse templates
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/workflows">
              <PlusIcon className="size-4" />
              New workflow
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={<FolderOpenIcon className="size-5" />}
          label="Workflows"
          value={workflowCount}
        />
        <StatCard
          icon={<GaugeIcon className="size-5" />}
          label="Runs today"
          value={runsToday}
        />
        <StatCard
          icon={<HistoryIcon className="size-5" />}
          label="Total runs"
          value={executionCount}
        />
      </div>

      {workflowCount === 0 ? (
        <Empty className="mt-6 min-h-[240px] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderOpenIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle>No workflows yet</EmptyTitle>
            <EmptyDescription>
              Create a workflow or start from a template to see runs here.
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild size="sm" className="mx-auto">
            <Link href="/templates">
              <SparklesIcon className="size-4" />
              Start from a template
            </Link>
          </Button>
        </Empty>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent runs</CardTitle>
              <CardDescription>
                Latest executions across your workflows.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No runs yet. Open a workflow and press Run.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {recentRuns.map((run) => (
                    <li key={run.id}>
                      <Link
                        className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
                        href={`/executions/${run.id}`}
                      >
                        <span className="min-w-0 truncate font-medium">
                          {run.workflow.name}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="hidden text-xs text-muted-foreground sm:inline">
                            {formatDistanceToNow(run.startedAt, {
                              addSuffix: true,
                            })}
                          </span>
                          <Badge
                            variant={
                              run.status === "FAILED"
                                ? "destructive"
                                : run.status === "SUCCESS"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {run.status}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent workflows</CardTitle>
              <CardDescription>Continue where you left off.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {workflows.map((workflow) => (
                  <li key={workflow.id}>
                    <Link
                      className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
                      href={`/workflows/${workflow.id}`}
                    >
                      <span className="min-w-0 truncate font-medium">
                        {workflow.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Updated{" "}
                        {formatDistanceToNow(workflow.updatedAt, {
                          addSuffix: true,
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-semibold leading-none">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
