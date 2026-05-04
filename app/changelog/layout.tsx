import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) {
    return <AppShell>{children}</AppShell>;
  }
  return <>{children}</>;
}
