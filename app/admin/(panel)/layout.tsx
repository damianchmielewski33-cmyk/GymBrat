import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { isAdmin2faSatisfied, isAdminEligible } from "@/lib/admin-session";

export const runtime = "nodejs";

export default async function AdminPanelLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin/overview");
  }

  const eligible = await isAdminEligible(session);
  if (!eligible) {
    return (
      <div className="glass-panel mx-auto max-w-lg p-8 text-center">
        <p className="font-heading text-2xl font-semibold text-white">Brak dostępu</p>
        <p className="mt-2 text-sm text-white/60">
          Panel jest dostępny tylko dla kont z rolą administratora.
        </p>
      </div>
    );
  }

  // Z32: przy włączonym wymogu panel otwiera się dopiero po 2FA.
  if (!(await isAdmin2faSatisfied(session))) {
    redirect("/admin/2fa");
  }

  return <AdminShell>{children}</AdminShell>;
}
