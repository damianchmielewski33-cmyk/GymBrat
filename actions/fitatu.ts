"use server";

import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { fitatuTag } from "@/lib/cache-tags";

export async function refreshFitatuMacros() {
  const session = await auth();
  if (!session?.user?.id) return;
  revalidateTag(fitatuTag(session.user.id), "max");
}
