import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WarsHub } from "@/components/community/wars/wars-hub";
import { getWarsHubData } from "@/lib/community/team-wars";

export default async function WarsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const data = await getWarsHubData(userId);
  return <WarsHub data={data} />;
}
