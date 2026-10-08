import { Suspense } from "react";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/auth/login-screen";
import {
  isFacebookAuthConfigured,
  isGoogleAuthConfigured,
} from "@/lib/google-auth";
import { HomeHeaderSkeleton } from "@/components/home/home-header-skeleton";
import { HomeTodayHeader } from "@/components/home/home-today-header";
import { HomeTodayPageContent } from "@/components/home/home-today-page-content";
import { DashboardRouteSkeleton } from "@/components/layout/dashboard-route-skeleton";

export default async function HomePage() {
  const session = await auth().catch((err) => {
    console.error("[home] auth()", err);
    return null;
  });
  const userId = session?.user?.id;
  if (!userId) {
    return (
      <LoginScreen
        googleEnabled={isGoogleAuthConfigured()}
        facebookEnabled={isFacebookAuthConfigured()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Suspense fallback={<HomeHeaderSkeleton />}>
        <HomeTodayHeader userId={userId} />
      </Suspense>
      <Suspense fallback={<DashboardRouteSkeleton />}>
        <HomeTodayPageContent userId={userId} />
      </Suspense>
    </div>
  );
}
