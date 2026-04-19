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
  { href: "/", label: "Start", icon: Home },
  { href: "/active-workout", label: "Trening", icon: Activity },
  { href: "/workout-plan", label: "Plan", icon: Dumbbell },
  { href: "/reports", label: "Raporty", icon: BarChart3 },
  { href: "/progress-analysis", label: "Analiza", icon: LineChart },
  { href: "/profile", label: "Profil", icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--neon)]/40 bg-white/5 shadow-[0_0_24px_rgba(255,45,85,0.25)]">
              <Dumbbell className="h-5 w-5 text-[var(--neon)]" />
            </span>
            <span className="font-heading text-lg font-semibold tracking-tight">
              Gym<span className="text-[var(--neon)]">Brat</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="hidden h-9 items-center rounded-md border border-white/15 bg-white/5 px-3 text-sm font-medium text-white outline-none hover:bg-white/10 md:inline-flex">
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white outline-none hover:bg-white/10 md:hidden"
                aria-label="Otwórz menu"
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border-white/10 bg-zinc-950/95 text-white backdrop-blur-xl"
              >
                <div className="mt-8 flex flex-col gap-2">
                  {nav.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <span className="flex items-center gap-2 rounded-lg px-3 py-3 hover:bg-white/10">
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </span>
                    </Link>
                  ))}
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

      <main
        key={pathname}
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-28 md:pb-8 animate-page-enter"
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/35 backdrop-blur-xl md:hidden">
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
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs transition-colors",
                  active ? "bg-white/10 text-white" : "text-white/70",
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-[var(--neon)]" : "text-white/70",
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
