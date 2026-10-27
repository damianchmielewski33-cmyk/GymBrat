import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ImportClient } from "@/components/plany/import-client";

export default async function PlanyImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return <ImportClient />;
}
