"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Home,
  LineChart,
  LogOut,
  Menu,
  MessageCircle,
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
      { href: "/changelog", label: t("nav.messages"), icon: MessageCircle },
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
                    >
                      <span
                        className={cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium",
                          active
                            ? "bg-white/[0.06] text-white"
                            : "text-white/70 hover:bg-white/[0.04] hover:text-white",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4",
                            active ? "text-[var(--neon)]" : "text-white/40",
                          )}
                        />
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
                {data?.user?.role === "admin" ? (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)}>
                    <span className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.04]">
                      <Shield className="h-4 w-4 text-[var(--neon)]" />
                      Panel admina
                    </span>
                  </Link>
                ) : null}
                <Button
                  variant="ghost"
                  className="mt-4 justify-start text-white/70"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void signOut({ callbackUrl: "/login" });
                  }}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Wyloguj się
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main
        key={pathname}
        className={cn(
          "mx-auto min-w-0 max-w-lg flex-1 overflow-x-clip px-4 py-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))]",
          reduceFixedBugs ? "animate-page-enter-opacity" : "animate-page-enter",
        )}
      >
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 bg-[#050505] pb-[env(safe-area-inset-bottom)]"
        aria-label="Nawigacja główna"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pb-2 pt-1">
          {tabs.slice(0, 2).map((item) => (
            <TabLink key={item.href} item={item} pathname={pathname} />
          ))}
          <div className="relative flex justify-center">
            <Link
              href="/reports"
              className="gym-btn-primary absolute -top-6 inline-flex h-[3.35rem] min-w-[7.25rem] items-center justify-center gap-1 rounded-full px-5 text-sm"
              aria-label="Dodaj raport"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Raport
            </Link>
          </div>
          {tabs.slice(2).map((item) => (
            <TabLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </nav>
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
  const active =
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[10px] font-medium",
        active ? "text-[var(--neon)]" : "text-white/45",
      )}
    >
      <item.icon className="h-5 w-5" />
      <span className="leading-none">{item.label}</span>
    </Link>
  );
}
