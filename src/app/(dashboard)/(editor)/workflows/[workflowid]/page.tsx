import { requireAuth } from "@/lib/auth-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ workflowid: string }>;
}) {
  await requireAuth();
  const { workflowid } = await params;

  return <div>workflow ID: {workflowid}</div>;
}
