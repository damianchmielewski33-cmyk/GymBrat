import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { CreateTeamForm } from "@/components/community/create-team-form";
import { AppPageHeader } from "@/components/layout/screen";

export default async function CreateTeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
        title="Nowa grupa"
        description="Publiczna — widoczna w wyszukiwarce. Prywatna — tylko kod lub zaproszenie e-mail."
      />
      <CreateTeamForm />
    </div>
  );
}
