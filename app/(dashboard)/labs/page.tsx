import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppMenuComingSoon } from "@/components/layout/app-menu-coming-soon";

export default async function LabsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/labs");

  return (
    <AppMenuComingSoon
      title="Badania"
      description="Wyniki krwi i hormony — archiwum badań z makiety menu. Funkcja w przygotowaniu."
    />
  );
}
