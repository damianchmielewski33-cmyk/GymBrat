import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { JoinTeamForm } from "@/components/community/join-team-form";
import { AppPageHeader } from "@/components/layout/screen";

export const metadata = { title: "Dołącz do grupy" };

export default async function JoinTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; token?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;

  return (
    <div className="space-y-5">
      <AppPageHeader
        backHref="/community/teams"
        backLabel="Grupy"
        kicker="Społeczność"
        title="Dołącz do grupy"
        description="Wpisz kod od właściciela / administratora albo otwórz link z zaproszenia."
      />
      <JoinTeamForm initialCode={params.code ?? ""} />
      {params.token ? (
        <p className="px-1 text-[13px] text-white/50">
          Masz token zaproszenia — otwórz listę grup i zaakceptuj zaproszenie
          na górze listy, albo użyj kodu grupy.
        </p>
      ) : null}
    </div>
  );
}
