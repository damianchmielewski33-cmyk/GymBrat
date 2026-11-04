import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CreateTeamForm } from "@/components/community/create-team-form";
import { AppPageHeader } from "@/components/layout/screen";

export const metadata = { title: "Nowa grupa" };

export default async function CreateTeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="space-y-5">
      <AppPageHeader
        backHref="/community/teams"
        backLabel="Grupy"
        kicker="Społeczność"
        title="Nowa grupa"
        description="Publiczna — widoczna w wyszukiwarce. Prywatna — tylko kod lub zaproszenie e-mail."
      />
      <CreateTeamForm />
    </div>
  );
}
