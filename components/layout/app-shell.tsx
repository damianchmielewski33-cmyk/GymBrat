"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity,
  BarChart3,
  Dumbbell,
  Home,
  LineChart,
  LogOut,
  Menu,
  Shield,
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
import { cn } from "@/lib/utils";

const nav = [
  { href: "/",                 label: "Start",   icon: Home      },
  { href: "/active-workout",   label: "Trening", icon: Activity  },
  { href: "/workout-plan",     label: "Plan",    icon: Dumbbell  },
  { href: "/reports",          label: "Raporty", icon: BarChart3 },
  { href: "/progress-analysis",label: "Analiza", icon: LineChart },
  { href: "/profile",          label: "Profil",  icon: User      },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { data } = useSession();
  const reduceFixedBugs = pathname.startsWith("/active-workout");

  return (
    <div className="relative min-h-screen">
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-xl"
        style={{
          background:
            "linear-gradient(180deg,rgba(10,10,12,0.88) 0%,rgba(8,8,9,0.80) 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 1px 0 rgba(230,0,35,0.22), 0 4px 24px rgba(0,0,0,0.55)",
        }}
      >
        {/* Red accent stripe at very top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg,transparent 0%,rgba(230,0,35,0.7) 30%,rgba(230,0,35,0.9) 50%,rgba(230,0,35,0.7) 70%,transparent 100%)",
          }}
        />

        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {/* Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(145deg,rgba(230,0,35,0.18),rgba(230,0,35,0.08))",
                border: "1px solid rgba(230,0,35,0.50)",
                borderTopColor: "rgba(230,0,35,0.70)",
                boxShadow:
                  "0 0 18px rgba(230,0,35,0.30), inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              <Dumbbell className="h-5 w-5 text-[var(--neon)]" />
            </span>
            <span className="font-heading text-[17px] font-bold tracking-tight text-white/90">
              GYM<span className="text-[var(--neon)]">BRAT</span>
            </span>
          </Link>

          {/* Desktop nav — środek belki */}
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
                        ? "text-white"
                        : "text-white/55 hover:text-white/85 hover:bg-white/[0.06]",
                    )}
                    style={
                      active
                        ? {
                            background:
                              "linear-gradient(145deg,rgba(230,0,35,0.20),rgba(230,0,35,0.08))",
                            border: "1px solid rgba(230,0,35,0.35)",
                            borderTopColor: "rgba(230,0,35,0.55)",
                            boxShadow:
                              "0 0 12px rgba(230,0,35,0.20), inset 0 1px 0 rgba(255,255,255,0.07)",
                          }
                        : undefined
                    }
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4",
                        active ? "text-[var(--neon)]" : "text-white/45",
                      )}
                    />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Prawa strona belki: admin (tylko administrator) + menu użytkownika */}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {data?.user?.role === "admin" ? (
              <Link
                href="/admin"
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  pathname.startsWith("/admin")
                    ? "text-amber-100"
                    : "text-amber-200/95 hover:bg-amber-500/15 hover:text-amber-50",
                )}
                style={{
                  background:
                    pathname.startsWith("/admin")
                      ? "linear-gradient(145deg,rgba(245,158,11,0.22),rgba(245,158,11,0.08))"
                      : "rgba(245,158,11,0.06)",
                  border: pathname.startsWith("/admin")
                    ? "1px solid rgba(245,158,11,0.45)"
                    : "1px solid rgba(245,158,11,0.22)",
                  borderTopColor:
                    pathname.startsWith("/admin")
                      ? "rgba(251,191,36,0.55)"
                      : "rgba(245,158,11,0.35)",
                  boxShadow: pathname.startsWith("/admin")
                    ? "0 0 14px rgba(245,158,11,0.18), inset 0 1px 0 rgba(255,255,255,0.06)"
                    : undefined,
                }}
              >
                <Shield className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
                <span className="max-[380px]:sr-only">Panel admina</span>
              </Link>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger
                className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-white/75 outline-none transition-colors hover:text-white md:inline-flex"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderTopColor: "rgba(255,255,255,0.18)",
                }}
              >
                {data?.user?.name
                  ? `Cześć, ${data.user.name.split(" ")[0]}`
                  : "Cześć"}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-white/10 bg-zinc-950/95 text-white backdrop-blur-xl"
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

            <Sheet>
              <SheetTrigger
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-white/70 outline-none transition-colors hover:text-white md:hidden"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
                aria-label="Otwórz menu"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border-white/10 text-white backdrop-blur-xl"
                style={{ background: "rgba(8,8,9,0.96)" }}
              >
                {/* Mobile sheet header stripe */}
                <div
                  className="absolute top-0 left-0 right-0 h-[2px]"
                  style={{
                    background:
                      "linear-gradient(90deg,transparent,rgba(230,0,35,0.8) 40%,rgba(230,0,35,0.8) 60%,transparent)",
                  }}
                />
                <div className="mt-8 flex flex-col gap-1.5">
                  {nav.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    return (
                      <Link key={item.href} href={item.href}>
                        <span
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                            active
                              ? "text-white"
                              : "text-white/60 hover:bg-white/[0.06] hover:text-white/85",
                          )}
                          style={
                            active
                              ? {
                                  background:
                                    "linear-gradient(145deg,rgba(230,0,35,0.18),rgba(230,0,35,0.07))",
                                  border: "1px solid rgba(230,0,35,0.30)",
                                }
                              : undefined
                          }
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
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => signOut({ callbackUrl: "/login" })}
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

      {/* ── Main content ── */}
      <main
        key={pathname}
        className={cn(
          "mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-28 md:pb-8",
          reduceFixedBugs ? "animate-page-enter-opacity" : "animate-page-enter",
        )}
      >
        {children}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 backdrop-blur-xl md:hidden"
        style={{
          background:
            "linear-gradient(0deg,rgba(8,8,9,0.95) 0%,rgba(12,12,14,0.85) 100%)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 -1px 0 rgba(230,0,35,0.18), 0 -8px 32px rgba(0,0,0,0.50)",
        }}
      >
        {/* Red accent stripe at very bottom-top edge */}
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px]"
          style={{
            background:
              "linear-gradient(90deg,transparent 0%,rgba(230,0,35,0.55) 30%,rgba(230,0,35,0.75) 50%,rgba(230,0,35,0.55) 70%,transparent 100%)",
          }}
        />

        <div className="mx-auto grid max-w-6xl grid-cols-5 gap-1 px-2 py-2">
          {nav.slice(0, 5).map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-medium transition-all duration-150",
                  active ? "text-white" : "text-white/50",
                )}
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(145deg,rgba(230,0,35,0.18),rgba(230,0,35,0.06))",
                        border: "1px solid rgba(230,0,35,0.28)",
                      }
                    : undefined
                }
              >
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-[var(--neon)]" : "text-white/45",
                  )}
                />
                <span className="leading-none">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
