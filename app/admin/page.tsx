import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { isAdminEligible } from "@/lib/admin-session";

export default async function AdminGatePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const eligible = await isAdminEligible(session);
  if (eligible) {
    redirect("/admin/overview");
  }

  return (
    <div className="glass-panel neon-glow p-8 text-center">
      <h1 className="font-heading text-xl text-white">Brak dostępu</h1>
      <p className="mt-2 text-sm text-white/60">
        Panel administratora jest dostępny tylko dla kont z rolą administratora.
      </p>
    </div>
  );
}
