import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppMenuComingSoon } from "@/components/layout/app-menu-coming-soon";

export default async function PackagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/package");

  return (
    <AppMenuComingSoon
      title="Twój pakiet"
      description="Tu zobaczysz status i datę końca współpracy. Widok z makiety menu — funkcja w przygotowaniu."
    />
  );
}
