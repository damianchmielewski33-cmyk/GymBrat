import { auth } from "@/auth";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AppShell } from "@/components/layout/app-shell";

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

  return <AppShell>{children}</AppShell>;
}
