"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { encryptSecret } from "@/lib/crypto";
import prisma from "@/lib/db";
import { isCredentialType } from "../types";

export async function createCredential(formData: FormData) {
  const session = await requireAuth();
  const name = String(formData.get("name") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  const typeValue = String(formData.get("type") ?? "GEMINI");

  if (!name || !value) {
    redirect("/credentials");
  }

  const type = isCredentialType(typeValue) ? typeValue : "GEMINI";

  const credential = await prisma.credential.create({
    data: {
      name,
      type,
      value: encryptSecret(value),
      userId: session.user.id,
    },
  });

  revalidatePath("/credentials");
  redirect(`/credentials/${credential.id}`);
}

export async function renameCredential(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("credentialId") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!id || !name) {
    return;
  }

  await prisma.credential.updateMany({
    where: { id, userId: session.user.id },
    data: { name },
  });

  revalidatePath(`/credentials/${id}`);
}

export async function deleteCredential(formData: FormData) {
  const session = await requireAuth();
  const id = String(formData.get("credentialId") ?? "");

  if (!id) {
    return;
  }

  const credential = await prisma.credential.findFirst({
    where: { id, userId: session.user.id },
    include: { Node: { select: { id: true } } },
  });

  if (!credential) {
    return;
  }

  await prisma.$transaction([
    prisma.node.updateMany({
      where: { id: { in: credential.Node.map((node) => node.id) } },
      data: { credentialId: null },
    }),
    prisma.credential.delete({ where: { id } }),
  ]);

  revalidatePath("/credentials");
  redirect("/credentials");
}
