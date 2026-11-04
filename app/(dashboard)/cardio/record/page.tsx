import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CardioRecordClient } from "@/components/cardio/cardio-record-client";

export const metadata = { title: "Nagrywanie cardio" };

export default async function CardioRecordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/cardio/record");
  return <CardioRecordClient />;
}
