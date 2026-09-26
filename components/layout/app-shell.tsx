"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Home,
  LineChart,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Shield,
  Sparkles,
  User,
  Utensils,
  Dumbbell,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { releaseDocumentScrollLock } from "@/lib/document-scroll";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n/i18n-provider";
import { BrandMark } from "@/components/layout/brand-mark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const tabs = useMemo(
    () => [
      { href: "/", label: t("nav.desk"), icon: Home },
      { href: "/meal-suggestions", label: t("nav.diet"), icon: Utensils },
      { href: "/workout-plan", label: t("nav.training"), icon: Dumbbell },
      { href: "/progress-analysis", label: t("nav.analysis"), icon: LineChart },
      { href: "/profile", label: t("nav.profile"), icon: User },
    ],
    [t],
  );
  const menu = useMemo(
    () => [
      { href: "/profile", label: t("nav.profile"), icon: User },
      { href: "/reports", label: t("nav.reports"), icon: BarChart3 },
      { href: "/progress-analysis", label: t("nav.analysis"), icon: LineChart },
      { href: "/workout-history", label: t("nav.history"), icon: ScrollText },
      { href: "/changelog", label: t("nav.news"), icon: Sparkles },
    ],
    [t],
  );

  const pathname = usePathname();
  const { data } = useSession();
  const reduceFixedBugs = pathname.startsWith("/active-workout");
  const sessionFullscreen = pathname.startsWith("/active-workout");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    releaseDocumentScrollLock();
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const root = document.documentElement;
    if (mobileMenuOpen) {
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      return;
    }
    body.style.overflow = "";
    root.style.overflow = "";
    queueMicrotask(() => mobileMenuTriggerRef.current?.focus());
  }, [mobileMenuOpen]);

  return (
    <div className="relative min-h-screen bg-[#050505]">
      {sessionFullscreen ? null : (
      <header className="sticky top-0 z-40 bg-[#050505]/92 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <BrandMark />
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger
              ref={mobileMenuTriggerRef}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 outline-none transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label={mobileMenuOpen ? "Zamknij menu" : "Otwórz menu"}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </SheetTrigger>
            <SheetContent
              side="right"
              className="border-white/8 text-white"
              style={{ background: "#0b0b0b" }}
            >
              <div className="mt-10 flex flex-col gap-1.5">
                {menu.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                        active
                          ? "bg-white/[0.08] text-[var(--neon)]"
                          : "text-white/75 hover:bg-white/[0.05]",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                {data?.user?.role === "admin" ? (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/75 hover:bg-white/[0.05]"
                  >
                    <Shield className="h-4 w-4" />
                    Panel admina
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  className="mt-4 justify-start gap-3 text-white/70"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void signOut({ callbackUrl: "/login" });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Wyloguj się
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      )}

      <main
        key={pathname}
        className={cn(
          "mx-auto min-w-0 w-full max-w-lg flex-1 overflow-x-clip",
          sessionFullscreen
            ? "px-0 py-0 pb-[env(safe-area-inset-bottom)]"
            : "px-4 py-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] sm:px-5",
          reduceFixedBugs ? "animate-page-enter-opacity" : "animate-page-enter",
        )}
      >
        {children}
      </main>

      {sessionFullscreen ? null : (
      <nav
        className="fixed inset-x-0 bottom-0 z-50 bg-[#050505] pb-[env(safe-area-inset-bottom)]"
        aria-label="Nawigacja główna"
      >
        <div className="relative mx-auto max-w-lg">
          {/* FAB wyśrodkowany względem całej belki, nie komórki siatki */}
          <Suspense fallback={null}>
            <ReportFab />
          </Suspense>
          <div className="grid grid-cols-5 items-end px-1 pb-2 pt-7">
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
  const active =
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-center text-[10px] font-medium",
        active ? "text-[var(--neon)]" : "text-white/45",
      )}
    >
      <item.icon className="h-5 w-5" />
      <span className="leading-none">{item.label}</span>
    </Link>
  );
}
