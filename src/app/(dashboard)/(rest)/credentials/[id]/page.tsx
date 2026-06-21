import { requireAuth } from "@/lib/auth-utils";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  return <div>credential ID: {id}</div>;
}
