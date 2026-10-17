import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { JoinTeamForm } from "@/components/community/join-team-form";
import { AppPageHeader } from "@/components/layout/screen";

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
      <Link
        href="/community/teams"
        className="inline-flex min-h-10 items-center gap-1.5 text-[13px] text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/45"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Teams
      </Link>
      <AppPageHeader
        kicker="Community"
        title="Dołącz do grupy"
        description="Wpisz kod od Ownera / Admina albo otwórz link z zaproszenia."
      />
      <JoinTeamForm initialCode={params.code ?? ""} />
      {params.token ? (
        <p className="px-1 text-[13px] text-white/45">
          Masz token zaproszenia — otwórz listę Teams i zaakceptuj zaproszenie
          na górze listy, albo użyj kodu grupy.
        </p>
      ) : null}
    </div>
  );
}
