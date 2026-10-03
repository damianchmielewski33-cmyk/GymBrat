import { auth } from "@/auth";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AppShell } from "@/components/layout/app-shell";
import { ReminderRunnerBoot } from "@/components/reminders/reminder-runner-boot";
import { ensureCriticalSchema } from "@/db/ensure-schema";
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

  // Po pierwszym ensure w procesie to no-op (memo) — nie spowalnia kolejnych kliknięć.
  try {
    await ensureCriticalSchema();
  } catch (err) {
    console.error("[dashboard layout] ensureCriticalSchema", err);
  }

  const showAdminNav = await isAdminEligible(session).catch(() => false);

  return (
    <AppShell showAdminNav={showAdminNav}>
      <ReminderRunnerBoot />
      {children}
    </AppShell>
  );
}
