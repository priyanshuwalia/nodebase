import { formatDistanceToNow } from "date-fns";
import { KeyIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
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
import { createCredential } from "@/features/credentials/server/actions";
import { requireAuth } from "@/lib/auth-utils";
import prisma from "@/lib/db";

const Page = async () => {
  const session = await requireAuth();
  const credentials = await prisma.credential.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          Node: true,
        },
      },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credentials</h1>
          <p className="text-sm text-muted-foreground">
            Review API keys connected to workflow nodes.
          </p>
        </div>
        <form
          action={createCredential}
          className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_140px_1fr_auto]"
        >
          <Input
            aria-label="Credential name"
            name="name"
            placeholder="Gemini production"
            required
          />
          <NativeSelect aria-label="Provider" name="type">
            <NativeSelectOption value="GEMINI">Gemini</NativeSelectOption>
            <NativeSelectOption value="OPENAI">OpenAI</NativeSelectOption>
            <NativeSelectOption value="ANTHROPIC">Anthropic</NativeSelectOption>
            <NativeSelectOption value="SLACK">Slack</NativeSelectOption>
            <NativeSelectOption value="DISCORD">Discord</NativeSelectOption>
            <NativeSelectOption value="HTTP_BEARER">
              HTTP bearer token
            </NativeSelectOption>
          </NativeSelect>
          <Input
            aria-label="API key"
            name="value"
            placeholder="API key"
            required
            type="password"
          />
          <Button type="submit">
            <PlusIcon className="size-4" />
            New
          </Button>
        </form>
      </div>

      {credentials.length === 0 ? (
        <Empty className="min-h-[320px] border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyIcon className="size-5" />
            </EmptyMedia>
            <EmptyTitle>No credentials saved</EmptyTitle>
            <EmptyDescription>
              Add a provider key above, then assign it to an AI node in the
              workflow editor.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent />
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Used by</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell>
                    <Link
                      href={`/credentials/${credential.id}`}
                      className="font-medium hover:underline"
                    >
                      {credential.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{credential.type}</Badge>
                  </TableCell>
                  <TableCell>{credential._count.Node} nodes</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(credential.updatedAt, {
                      addSuffix: true,
                    })}
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
