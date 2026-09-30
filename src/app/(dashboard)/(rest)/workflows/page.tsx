import { formatDistanceToNow } from "date-fns";
import { ArrowRightIcon, PlusIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

async function createWorkflow() {
  "use server";

  const session = await requireAuth();
  const workflow = await prisma.workflow.create({
    data: {
      name: "Untitled workflow",
      userId: session.user.id,
      nodes: {
        create: {
          name: "Manual trigger",
          type: "MANUAL_TRIGGER",
          position: { x: 80, y: 120 },
          data: {},
        },
      },
    },
  });

  redirect(`/workflows/${workflow.id}`);
}

const Page = async () => {
  const session = await requireAuth();
  const workflows = await prisma.workflow.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          nodes: true,
          executions: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
          <p className="text-sm text-muted-foreground">
            Create, inspect, and run automation flows.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/templates">Browse templates</Link>
          </Button>
          <form action={createWorkflow}>
            <Button type="submit" size="sm">
              <PlusIcon className="size-4" />
              New workflow
            </Button>
          </form>
        </div>
      </div>

      {workflows.length === 0 ? (
        <Empty className="min-h-[360px] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WorkflowIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle>No workflows yet</EmptyTitle>
            <EmptyDescription>
              Start with a manual trigger and add connected nodes as your
              automation grows.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <form action={createWorkflow}>
              <Button type="submit">
                <PlusIcon className="size-4" />
                Create workflow
              </Button>
            </form>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Nodes</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.map((workflow) => (
                <TableRow key={workflow.id}>
                  <TableCell>
                    <Link
                      href={`/workflows/${workflow.id}`}
                      className="font-medium hover:underline"
                    >
                      {workflow.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {workflow._count.nodes} nodes
                    </Badge>
                  </TableCell>
                  <TableCell>{workflow._count.executions}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(workflow.updatedAt, {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="icon-sm" variant="ghost">
                      <Link href={`/workflows/${workflow.id}`}>
                        <ArrowRightIcon className="size-4" />
                        <span className="sr-only">Open workflow</span>
                      </Link>
                    </Button>
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

export default Page;
