import { auth } from "@/auth";
import { AuthPageFrame } from "@/components/auth/auth-page-frame";
import { AppShell } from "@/components/layout/app-shell";
import { ReminderRunnerWrapper } from "@/components/reminders/reminder-runner-wrapper";
import { ensureCriticalSchema } from "@/db/ensure-schema";

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

  try {
    await ensureCriticalSchema();
  } catch (err) {
    console.error("[dashboard layout] ensureCriticalSchema", err);
  }

  return (
    <AppShell>
      <ReminderRunnerWrapper />
      {children}
    </AppShell>
  );
}
