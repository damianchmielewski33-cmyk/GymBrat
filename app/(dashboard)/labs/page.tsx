import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { showUnfinishedPages } from "@/lib/feature-flags";
import { AppMenuComingSoon } from "@/components/layout/app-menu-coming-soon";

export default async function LabsPage() {
  // Z54/DK-9: bez zdefiniowanego produktu ekran jest ukryty (flaga NEXT_PUBLIC_SHOW_UNFINISHED_PAGES).
  if (!showUnfinishedPages()) notFound();
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/labs");

  return (
    <AppMenuComingSoon
      title="Badania"
      description="Wyniki krwi i hormony — archiwum badań z makiety menu. Funkcja w przygotowaniu."
    />
  );
}
