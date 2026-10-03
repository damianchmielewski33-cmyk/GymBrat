import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CardioHubView } from "@/components/cardio/cardio-hub-view";
import { getCardioHubData } from "@/lib/cardio-hub";

export default async function CardioHubPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login?callbackUrl=/cardio");

  const data = await getCardioHubData(userId);
  return <CardioHubView data={data} />;
}
