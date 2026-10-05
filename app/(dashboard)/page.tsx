import { Suspense } from "react";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/auth/login-screen";
import { HomeTodayPageContent } from "@/components/home/home-today-page-content";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";

export default async function HomePage() {
  const session = await auth().catch((err) => {
    console.error("[home] auth()", err);
    return null;
  });
  const userId = session?.user?.id;
  if (!userId) {
    return <LoginScreen />;
  }

  return (
    <Suspense fallback={<DashboardRouteSkeleton />}>
      <HomeTodayPageContent userId={userId} />
    </Suspense>
  );
}
