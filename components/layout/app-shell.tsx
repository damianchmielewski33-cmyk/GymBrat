"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  ChefHat,
  Dumbbell,
  Home,
  LineChart,
  LogOut,
  Menu,
  Shield,
  ScrollText,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { releaseDocumentScrollLock } from "@/lib/document-scroll";
import { cn } from "@/lib/utils";
import { CoachChatFab } from "@/components/layout/coach-chat-fab";
import { StartWorkoutFab } from "@/components/layout/start-workout-fab";
import { useI18n } from "@/components/i18n/i18n-provider";
import { BrandMark } from "@/components/layout/brand-mark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const nav = useMemo(
    () => [
      { href: "/", label: t("nav.start"), icon: Home },
      { href: "/meal-suggestions", label: t("nav.meals"), icon: ChefHat },
      { href: "/workout-plan", label: t("nav.plan"), icon: Dumbbell },
      { href: "/reports", label: t("nav.reports"), icon: BarChart3 },
      { href: "/progress-analysis", label: t("nav.analysis"), icon: LineChart },
      { href: "/workout-history", label: t("nav.history"), icon: ScrollText },
      { href: "/changelog", label: t("nav.news"), icon: Sparkles },
      { href: "/profile", label: t("nav.profile"), icon: User },
    ],
    [t],
  );

  const pathname = usePathname();
  const router = useRouter();
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
    <div className="relative min-h-screen">
      <header className="mp-header sticky top-0 z-40 border-b border-zinc-200/80 pt-[env(safe-area-inset-top)]">
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg,transparent 0%,rgba(0,201,177,0.55) 30%,rgba(14,165,233,0.7) 50%,rgba(0,201,177,0.55) 70%,transparent 100%)",
          }}
        />

        <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
          <BrandMark className="shrink-0 text-[17px] sm:text-xl" />

          <nav className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-[var(--mp-teal)]/10 text-zinc-950 ring-1 ring-[var(--mp-teal)]/35"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        active ? "text-[var(--neon)]" : "text-zinc-400",
                      )}
                    />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {data?.user?.role === "admin" ? (
              <Link
                href="/admin"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                  pathname.startsWith("/admin")
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100",
                )}
              >
                <Shield className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                <span className="max-[380px]:sr-only">Panel admina</span>
              </Link>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger className="hidden h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 outline-none transition-colors hover:bg-zinc-50 md:inline-flex">
                {data?.user?.name
                  ? `Cześć, ${data.user.name.split(" ")[0]}`
                  : "Cześć"}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-zinc-200 bg-white text-zinc-900 shadow-lg"
              >
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  Profil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Wyloguj się
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger
                ref={mobileMenuTriggerRef}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 outline-none transition-colors hover:bg-zinc-50 md:hidden"
                aria-label="Otwórz menu"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border-zinc-200 bg-white text-zinc-900"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg,transparent,rgba(0,201,177,0.8) 40%,rgba(0,201,177,0.8) 60%,transparent)",
                  }}
                />
                <div className="mt-8 flex flex-col gap-1.5">
                  {nav.map((item) => {
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
                            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                            active
                              ? "bg-[var(--mp-teal)]/10 text-zinc-950 ring-1 ring-[var(--mp-teal)]/30"
                              : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900",
                          )}
                        >
                          <item.icon
                            className={cn(
                              "h-4 w-4",
                              active ? "text-[var(--neon)]" : "text-zinc-400",
                            )}
                          />
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                  <Button
                    variant="cta"
                    className="mt-4 w-full"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      signOut({ callbackUrl: "/login" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Wyloguj się
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main
        key={pathname}
        className={cn(
          "mx-auto min-w-0 max-w-6xl flex-1 overflow-x-clip px-3 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-8 md:pb-8",
          reduceFixedBugs ? "animate-page-enter-opacity" : "animate-page-enter",
        )}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px]"
          style={{
            background:
              "linear-gradient(90deg,transparent 0%,rgba(0,201,177,0.45) 30%,rgba(0,201,177,0.7) 50%,rgba(0,201,177,0.45) 70%,transparent 100%)",
          }}
        />

        <div className="mx-auto grid min-w-0 max-w-6xl grid-cols-5 gap-0 px-0.5 py-1.5 sm:gap-0.5 sm:px-2 sm:py-2">
          {nav
            .filter((i) => i.href !== "/profile")
            .slice(0, 5)
            .map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-center text-[9px] font-medium leading-tight transition-all duration-150 sm:gap-1 sm:rounded-xl sm:px-2 sm:py-2.5 sm:text-[11px]",
                    active
                      ? "bg-[var(--mp-teal)]/10 text-zinc-950"
                      : "text-zinc-500",
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-4 w-4 shrink-0 sm:h-5 sm:w-5",
                      active ? "text-[var(--neon)]" : "text-zinc-400",
                    )}
                  />
                  <span className="line-clamp-2 max-w-full break-words leading-[1.15] sm:line-clamp-none sm:leading-none">
                    {item.label}
                  </span>
                </Link>
              );
            })}
        </div>
      </nav>

      <CoachChatFab />
      <StartWorkoutFab />
    </div>
  );
}
