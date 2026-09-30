import { format } from "date-fns";
import { Trash2Icon } from "lucide-react";
import { notFound } from "next/navigation";
import { ConfirmForm } from "@/components/confirm-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  deleteCredential,
  renameCredential,
} from "@/features/credentials/server/actions";
import { maskCredential } from "@/features/credentials/types";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAuth();
  const { id } = await params;
  const credential = await prisma.credential.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    include: {
      Node: {
        include: {
          workflow: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!credential) {
    notFound();
  }

  const masked = maskCredential(credential.value);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {credential.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Credential details and workflow usage.
          </p>
        </div>
        <ConfirmForm
          action={deleteCredential}
          message={`Delete "${credential.name}"? Nodes using it will have no credential and will fail until a new one is assigned.`}
          className="contents"
        >
          <input name="credentialId" type="hidden" value={credential.id} />
          <Button type="submit" variant="destructive">
            <Trash2Icon className="size-4" />
            Delete credential
          </Button>
        </ConfirmForm>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>
            Created {format(credential.createdAt, "PPP p")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{credential.type}</Badge>
            <span className="text-sm text-muted-foreground">
              Updated {format(credential.updatedAt, "PPP p")}
            </span>
          </div>
          <div className="grid gap-1.5">
            <p className="text-sm text-muted-foreground">Secret value</p>
            <code className="w-fit rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
              {masked}
            </code>
            <p className="text-xs text-muted-foreground">
              Stored encrypted at rest. Never rendered as plaintext — used only
              server-side during execution.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rename</CardTitle>
          <CardDescription>
            Give this credential a clearer label.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={renameCredential} className="grid gap-3">
            <input name="credentialId" type="hidden" value={credential.id} />
            <Input
              defaultValue={credential.name}
              name="name"
              aria-label="Credential name"
              required
            />
            <Button size="sm" type="submit" variant="outline" className="w-fit">
              Save name
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connected nodes</CardTitle>
          <CardDescription>
            Nodes currently using this credential.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {credential.Node.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This credential is not attached to any nodes.
            </p>
          ) : (
            <div className="grid gap-3">
              {credential.Node.map((node) => (
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  key={node.id}
                >
                  <div>
                    <p className="font-medium">{node.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {node.workflow.name}
                    </p>
                  </div>
                  <Badge variant="secondary">{node.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
