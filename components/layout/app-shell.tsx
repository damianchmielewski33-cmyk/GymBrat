"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  Home,
  LineChart,
  Plus,
  Shield,
  User,
  Utensils,
  Dumbbell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/i18n-provider";
import { BrandMark } from "@/components/layout/brand-mark";
import { WorkoutCompletePopup } from "@/components/reports/workout-complete-popup";

export function AppShell({
  children,
  showAdminNav = false,
}: {
  children: React.ReactNode;
  /** Zamiast Profilu — skrót do panelu admina. */
  showAdminNav?: boolean;
}) {
  const { t } = useI18n();
  const tabs = useMemo(
    () => [
      { href: "/", label: t("nav.today"), icon: Home },
      { href: "/workout-plan", label: t("nav.training"), icon: Dumbbell },
      { href: "/meal-suggestions", label: t("nav.diet"), icon: Utensils },
      { href: "/progress", label: t("nav.analysis"), icon: LineChart },
      showAdminNav
        ? { href: "/admin", label: t("nav.admin"), icon: Shield }
        : { href: "/profile", label: t("nav.profile"), icon: User },
    ],
    [t, showAdminNav],
  );

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const routes = [
      "/",
      "/workout-plan",
      "/meal-suggestions",
      "/progress",
      showAdminNav ? "/admin" : "/profile",
    ];
    for (const href of routes) {
      router.prefetch(href);
    }
  }, [router, showAdminNav]);

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
    <div className="relative min-h-screen bg-transparent">
      {sessionFullscreen ? null : hideChromeHeader ? (
        <div className="pt-[env(safe-area-inset-top)]" aria-hidden />
      ) : (
        <header className="sticky top-0 z-40 bg-black/55 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center px-4 py-3.5 sm:py-4">
            <BrandMark />
          </div>
        </header>
      )}

      <main
        className={cn(
          "mx-auto min-w-0 w-full max-w-lg flex-1 overflow-x-clip",
          sessionFullscreen
            ? "px-0 py-0 pb-[env(safe-area-inset-bottom)]"
            : hideBottomNav
              ? "px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-5"
              : "px-4 py-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-5",
        )}
      >
        {children}
      </main>

      {/* Po zakończeniu treningu — rekordy / podsumowanie zaraz po nawigacji (nie dopiero na /progress). */}
      <WorkoutCompletePopup />

      {hideBottomNav ? null : (
        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-black/70 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
          aria-label="Nawigacja główna"
        >
          <div className="relative mx-auto max-w-lg">
            <BugReportNavButton />
            {showReportFab ? (
              <Suspense fallback={null}>
                <ReportFab />
              </Suspense>
            ) : null}
            <div
              className={cn(
                "grid grid-cols-5 items-end px-1 pb-2",
                "pt-7",
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

/** Przycisk zgłoszenia błędu — lewa strona belki, widoczny dla wszystkich. */
function BugReportNavButton() {
  const pathname = usePathname();
  const active = pathname.startsWith("/bug-report");

  return (
    <Link
      href="/bug-report"
      className={cn(
        "absolute left-2 top-0 z-10 inline-flex h-10 max-w-[42%] -translate-y-1/2 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.04em] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-colors sm:left-3 sm:gap-1.5 sm:px-3 sm:text-[11px]",
        active
          ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/20 text-[var(--gym-gold)]"
          : "border-white/15 bg-black/85 text-white/80 hover:border-white/30 hover:text-white",
      )}
      aria-label="Zgłoś błąd"
      title="Zgłoś błąd"
      aria-current={active ? "page" : undefined}
    >
      <Bug className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">Zgłoś błąd</span>
    </Link>
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
      className="gym-btn-primary absolute left-1/2 top-0 z-10 inline-flex h-12 min-w-[7.25rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full px-5 text-sm shadow-[0_8px_28px_rgba(var(--neon-rgb),0.35)]"
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
        : item.href === "/profile"
          ? pathname.startsWith("/profile")
          : item.href === "/admin"
            ? pathname.startsWith("/admin")
            : pathname.startsWith(item.href);
  const visuallyActive = active || optimisticHref === item.href;

  return (
    <Link
      href={item.href}
      prefetch
      onClick={() => setOptimisticHref(item.href)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-2 text-center text-[10px] font-medium transition-[color,box-shadow,background-color,opacity,transform] duration-150 active:scale-[0.96] active:opacity-80",
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
      <item.icon className="relative h-5 w-5" />
      <span className="relative leading-none uppercase tracking-[0.08em]">
        {item.label}
      </span>
    </Link>
  );
}
