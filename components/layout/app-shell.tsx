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
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveContextFab, type ContextFab } from "@/lib/context-fab";
import { hapticTap } from "@/lib/haptics";
import { useI18n } from "@/components/i18n/i18n-provider";
import { BrandMark } from "@/components/layout/brand-mark";
import { AppMenuButton } from "@/components/layout/app-menu-button";
import { NotificationBell } from "@/components/community/notification-bell";
import { ThemeToggleButton } from "@/components/theme/theme-toggle-button";
import { ReminderRunnerBoot } from "@/components/reminders/reminder-runner-boot";

/** Ciężkie widgety Community / trening — poza krytycznym bundlem shella (LCP). */
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

/** Phone → tablet (kolumna) → desktop (lg+: szeroka treść + boczny pasek nawigacji). */
export const APP_SHELL_MAX =
  "max-w-lg md:max-w-xl lg:max-w-4xl 2xl:max-w-5xl";

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
    sessionFullscreen ||
    /\/workout-history\/[^/]+\/edit\/?$/.test(pathname) ||
    pathname.startsWith("/plany/import") ||
    pathname.startsWith("/plany/nowy") ||
    // edytor dnia: /plany/<id>, ale nie /plany/atlas
    (/^\/plany\/[^/]+\/?$/.test(pathname) && !pathname.startsWith("/plany/atlas"));
  const hideChromeHeader = pathname === "/";
  // Z59: kontekstowy środkowy przycisk (Treningi → Start, Dieta → Dodaj posiłek, Analiza/Start → Raport).
  // /plany* — zarządzanie planem, bez przycisku (UX 008).
  const contextFab = resolveContextFab(pathname);
  const showReportFab = contextFab != null;

  return (
    <div
      className={cn(
        "relative bg-transparent",
        sessionFullscreen
          ? "h-[100dvh] max-h-[100dvh] overflow-hidden"
          : "min-h-screen",
        !sessionFullscreen && "lg:pl-60",
      )}
    >
      {sessionFullscreen ? null : hideChromeHeader ? (
        <div className="pt-[env(safe-area-inset-top)]" aria-hidden />
      ) : (
        <header className="sticky top-0 z-40 bg-black/55 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div
            className={cn(
              "mx-auto flex items-center justify-between gap-2 lg:justify-end lg:px-8 px-[var(--space-screen-x)] py-2.5 sm:gap-3 sm:px-[var(--space-screen-x-sm)] sm:py-3.5",
              APP_SHELL_MAX,
            )}
          >
            <BrandMark className="min-w-0 lg:hidden" />
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
              ? "px-[var(--space-screen-x)] py-3 pb-[calc(var(--bottom-gap)+4.5rem+env(safe-area-inset-bottom))] sm:px-[var(--space-screen-x-sm)] sm:py-4"
              : "px-[var(--space-screen-x)] py-3 pb-[calc(var(--bottom-chrome)+1rem+env(safe-area-inset-bottom))] sm:px-[var(--space-screen-x-sm)] sm:py-4",
          !sessionFullscreen && "lg:px-8 lg:py-6 lg:pb-12",
        )}
      >
        {children}
      </main>

      {sessionFullscreen ? null : <ReminderRunnerBoot />}
      <GroupWorkoutFloatingWidget />
      <FriendLiveWatchWidget />
      <WorkoutChatLauncher />

      {sessionFullscreen ? null : (
        <nav
          className={cn(
            "pointer-events-none fixed inset-x-0 bottom-0 z-50 pb-[max(0.65rem,env(safe-area-inset-bottom))]",
            // Desktop: stały boczny pasek zamiast pływającej belki.
            "lg:pointer-events-auto lg:inset-y-0 lg:right-auto lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-white/[0.08] lg:bg-black/60 lg:p-4 lg:backdrop-blur-xl",
            hideBottomNav && "hidden lg:flex",
          )}
          aria-label="Nawigacja główna"
        >
          <div className={cn("pointer-events-auto relative mx-auto px-3", APP_SHELL_MAX)}>
            <div
              className={cn(
                "grid items-stretch gap-0.5 rounded-[var(--radius-nav)] border border-[var(--gym-border-gold)] px-1.5 py-1.5",
                "bg-black/70 backdrop-blur-2xl",
                "shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.04)_inset]",
                showReportFab ? "grid-cols-5" : "grid-cols-4",
              )}
            >
              {tabs.slice(0, 2).map((item) => (
                <TabLink key={item.href} item={item} pathname={pathname} />
              ))}
              {showReportFab ? (
                <Suspense fallback={<span aria-hidden />}>
                  <ContextFabButton fab={contextFab} />
                </Suspense>
              ) : null}
              {tabs.slice(2).map((item) => (
                <TabLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
          <ThemeToggleButton className="pointer-events-auto mt-auto hidden lg:flex" />
        </nav>
      )}
    </div>
  );
}

/** Środkowy przycisk belki — absolutnie na środku, treść zależy od ekranu (Z59). */
function ContextFabButton({ fab }: { fab: ContextFab | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wizardOpen =
    fab?.kind === "report" &&
    pathname.startsWith("/reports") &&
    (searchParams.get("new") === "1" || searchParams.get("new") === "true");

  if (!fab) return null;
  if (wizardOpen) {
    return (
      <>
        <span className="sr-only">Dodawanie raportu w toku</span>
        <span aria-hidden />
      </>
    );
  }

  const Icon = fab.kind === "start" ? Play : Plus;

  return (
    <div className="flex items-center justify-center">
      <Link
        href={fab.href}
        onClick={() => hapticTap()}
        className="gold-btn -mt-6 inline-flex h-14 w-14 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold-bright)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gym-black)]"
        aria-label={fab.ariaLabel}
      >
        <Icon className={cn("h-6 w-6", fab.kind === "start" && "fill-current")} aria-hidden />
      </Link>
    </div>
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
        "relative flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-left rounded-[var(--radius-card)] px-0.5 py-1.5 text-center text-[length:var(--text-label)] font-semibold transition-[color,box-shadow,background-color,opacity,transform] duration-150 active:scale-[0.96] active:opacity-80 sm:gap-1 sm:text-[length:var(--text-caption)]",
        visuallyActive
          ? "bg-[var(--gym-surface-gold)] text-[var(--gym-gold-bright)] shadow-[0_0_0_1px_rgba(var(--neon-rgb),0.35)]"
          : "text-white/55 shadow-none",
        optimisticHref === item.href && !active ? "opacity-90" : null,
      )}
    >
      <item.icon className="relative h-5 w-5 sm:h-[1.35rem] sm:w-[1.35rem]" />
      <span className="relative max-w-full truncate leading-none uppercase tracking-[0.06em]">
        {item.label}
      </span>
    </Link>
  );
}
