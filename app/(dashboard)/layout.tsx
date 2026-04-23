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
  await ensureCriticalSchema();
  return (
    <AppShell>
      <ReminderRunnerWrapper />
      {children}
    </AppShell>
  );
}
