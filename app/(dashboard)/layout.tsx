import { auth } from "@/auth";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AppShell } from "@/components/layout/app-shell";
import { isAdminEligible } from "@/lib/admin-session";

/** Node.js: lokalny SQLite (`file:...`) w @libsql/client działa tylko poza Edge. */
export const runtime = "nodejs";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth().catch(() => null);
  if (!session?.user?.id) {
    return <AuthPageFrame>{children}</AuthPageFrame>;
  }

  // Po Google (bez wagi/wzrostu itd.) tylko formularz — bez dolnej nawigacji.
  if (session.user.profileComplete !== true) {
    return <AuthPageFrame>{children}</AuthPageFrame>;
  }

  const showAdminNav = await isAdminEligible(session).catch(() => false);

  return <AppShell showAdminNav={showAdminNav}>{children}</AppShell>;
}
