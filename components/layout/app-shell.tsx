"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  LineChart,
  Plus,
  Utensils,
  Dumbbell,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";
import { useI18n } from "@/components/i18n/i18n-provider";
import { BrandMark } from "@/components/layout/brand-mark";
import { AppMenuButton } from "@/components/layout/app-menu-button";
import { NotificationBell } from "@/components/community/notification-bell";

/** Ciężkie widgety Community / trening — poza krytycznym bundlem shella (LCP). */
const WorkoutCompletePopup = dynamic(
  () =>
    import("@/components/reports/workout-complete-popup").then((m) => ({
      default: m.WorkoutCompletePopup,
    })),
  { ssr: false },
);
const GroupWorkoutFloatingWidget = dynamic(
  () =>
    import("@/components/community/group-workout-floating-widget").then(
      (m) => ({ default: m.GroupWorkoutFloatingWidget }),
    ),
  { ssr: false },
);
const WorkoutChatLauncher = dynamic(
  () =>
    import("@/components/community/workout-chat-launcher").then((m) => ({
      default: m.WorkoutChatLauncher,
    })),
  { ssr: false },
);
const FriendLiveWatchWidget = dynamic(
  () =>
    import("@/components/community/friend-live-watch-widget").then((m) => ({
      default: m.FriendLiveWatchWidget,
    })),
  { ssr: false },
);

/** Phone → tablet → desktop: treść w kolumnie, bez „pustego” tabletu. */
export const APP_SHELL_MAX =
  "max-w-lg md:max-w-xl xl:max-w-2xl";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
  /** @deprecated Profil/Admin są w menu bocznym; dolny pasek ma Team. */
  showAdminNav?: boolean;
}) {
  const { t } = useI18n();
  const tabs = useMemo(
    () => [
      { href: "/", label: t("nav.today"), icon: Home },
      { href: "/workout-plan", label: t("nav.training"), icon: Dumbbell },
      { href: "/meal-suggestions", label: t("nav.diet"), icon: Utensils },
      { href: "/progress", label: t("nav.analysis"), icon: LineChart },
      { href: "/community/teams", label: t("nav.teams"), icon: Users },
    ],
    [t],
  );

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const routes = [
      "/",
      "/workout-plan",
      "/meal-suggestions",
      "/progress",
      "/community/teams",
    ];
    for (const href of routes) {
      router.prefetch(href);
    }
  }, [router]);

  const sessionFullscreen =
    pathname.startsWith("/active-workout") ||
    pathname.startsWith("/cardio/record");
  /** Formularz poprawy treningu — własna belka Zapisz zamiast dolnego menu. */
  const hideBottomNav =
    sessionFullscreen || /\/workout-history\/[^/]+\/edit\/?$/.test(pathname);
  const hideChromeHeader = pathname === "/";
  const showReportFab =
    pathname === "/" ||
    pathname.startsWith("/workout-plan") ||
    pathname.startsWith("/progress");

  return (
    <div
      className={cn(
        "relative bg-transparent",
        sessionFullscreen
          ? "h-[100dvh] max-h-[100dvh] overflow-hidden"
          : "min-h-screen",
      )}
    >
      {sessionFullscreen ? null : hideChromeHeader ? (
        <div className="pt-[env(safe-area-inset-top)]" aria-hidden />
      ) : (
        <header className="sticky top-0 z-40 bg-black/55 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div
            className={cn(
              "mx-auto flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3.5",
              APP_SHELL_MAX,
            )}
          >
            <BrandMark className="min-w-0" />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <NotificationBell />
              <AppMenuButton variant="icon" />
            </div>
          </div>
        </header>
      )}

      <main
        className={cn(
          "mx-auto min-w-0 w-full flex-1 overflow-x-clip",
          APP_SHELL_MAX,
          sessionFullscreen
            ? "h-[100dvh] max-h-[100dvh] overflow-hidden px-0 py-0"
            : hideBottomNav
              ? "px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-4"
              : "px-3 py-3 pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:py-4",
        )}
      >
        {children}
      </main>

      {/* Po zakończeniu treningu — rekordy / podsumowanie zaraz po nawigacji (nie dopiero na /progress). */}
      <WorkoutCompletePopup />
      <GroupWorkoutFloatingWidget />
      <FriendLiveWatchWidget />
      <WorkoutChatLauncher />

      {hideBottomNav ? null : (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-black/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
          aria-label="Nawigacja główna"
        >
          <div className={cn("relative mx-auto", APP_SHELL_MAX)}>
            {showReportFab ? (
              <Suspense fallback={null}>
                <ReportFab />
              </Suspense>
            ) : null}
            <div
              className={cn(
                "grid grid-cols-5 items-stretch px-0.5 pb-1.5 sm:px-1 sm:pb-2",
                showReportFab ? "pt-7" : "pt-1.5",
              )}
            >
              {tabs.map((item) => (
                <TabLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}

/** Środkowy FAB „Raport” — absolutnie na środku belki. */
function ReportFab() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wizardOpen =
    pathname.startsWith("/reports") &&
    (searchParams.get("new") === "1" || searchParams.get("new") === "true");

  if (wizardOpen) {
    return <span className="sr-only">Dodawanie raportu w toku</span>;
  }

  return (
    <Link
      href="/reports?new=1"
      onClick={() => hapticTap()}
      className="gym-btn-primary absolute left-1/2 top-0 z-10 inline-flex h-12 min-h-12 min-w-[7.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full px-5 text-sm shadow-[0_8px_28px_rgba(var(--neon-rgb),0.35)]"
      aria-label="Dodaj raport"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Raport
    </Link>
  );
}

function TabLink({
  item,
  pathname,
}: {
  item: { href: string; label: string; icon: typeof Home };
  pathname: string;
}) {
  const [optimisticHref, setOptimisticHref] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticHref(null);
  }, [pathname]);

  const active =
    item.href === "/"
      ? pathname === "/"
      : item.href === "/progress"
        ? pathname.startsWith("/progress") ||
          pathname.startsWith("/progress-analysis")
        : item.href === "/community/teams"
          ? pathname.startsWith("/community")
          : pathname.startsWith(item.href);
  const visuallyActive = active || optimisticHref === item.href;

  return (
    <Link
      href={item.href}
      prefetch
      onClick={() => {
        hapticTap();
        setOptimisticHref(item.href);
      }}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-[3.25rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 text-center text-[9px] font-medium transition-[color,box-shadow,background-color,opacity,transform] duration-150 active:scale-[0.96] active:opacity-80 sm:gap-1 sm:text-[10px]",
        visuallyActive
          ? "bg-[var(--gym-gold)]/10 text-[var(--gym-gold)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.45),0_0_18px_rgba(var(--neon-rgb),0.55),0_0_36px_rgba(var(--neon-rgb),0.28)]"
          : "text-white/45 shadow-none",
        optimisticHref === item.href && !active ? "opacity-90" : null,
      )}
    >
      {visuallyActive ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl bg-[var(--gym-gold)]/15 blur-md"
        />
      ) : null}
      <item.icon className="relative h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
      <span className="relative max-w-full truncate leading-none uppercase tracking-[0.06em]">
        {item.label}
      </span>
    </Link>
  );
}
