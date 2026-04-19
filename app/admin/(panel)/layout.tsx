import type { ReactNode } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  isAdminEligible,
  readAdminUnlockVerified,
} from "@/lib/admin-session";

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
      <div className="glass-panel neon-glow p-8 text-center">
        <p className="text-white/70">
          Panel jest dostępny tylko dla konta pierwszego użytkownika.
        </p>
      </div>
    );
  }

  if (!(await readAdminUnlockVerified(session))) {
    redirect("/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
