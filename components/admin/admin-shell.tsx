"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ScrollText, Users } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/overview", label: "Analityka", icon: LayoutDashboard },
  { href: "/admin/users", label: "Użytkownicy", icon: Users },
  { href: "/admin/audit", label: "Dziennik", icon: ScrollText },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();

  return (
    <div className="space-y-8">
      <header className="app-card flex flex-col gap-6 p-8 text-center sm:text-left">
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">
              GymBrat
            </p>
            <h1 className="font-heading mt-2 text-2xl font-semibold text-white">
              Administrator
            </h1>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--neon)]/20 text-white ring-1 ring-[var(--neon)]/40"
                      : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </Link>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-white/15 bg-white/[0.06]"
            onClick={() => {
              void (async () => {
                await ensureCsrfCookie();
                const res = await fetch("/api/admin/lock", {
                  method: "POST",
                  credentials: "include",
                  headers: { ...getXsrfHeaders() },
                });
                if (!res.ok) {
                  notifyError("Nie udało się zablokować panelu.");
                  return;
                }
                notifySaved("Zablokowano panel administratora.");
                router.push("/");
                router.refresh();
              })();
            }}
          >
            Wyjdź z panelu
          </Button>
          <Link href="/">
            <Button type="button" variant="ghost" size="sm" className="text-white/70">
              Wróć do aplikacji
            </Button>
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
