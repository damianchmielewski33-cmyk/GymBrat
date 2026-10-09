"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bug,
  ImageIcon,
  Dumbbell,
  LayoutDashboard,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { BUG_REPORTS_CHANGED_EVENT } from "@/lib/bug-reports";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/overview", label: "Analityka", icon: LayoutDashboard },
  { href: "/admin/users", label: "Użytkownicy", icon: Users },
  { href: "/admin/bugs", label: "Błędy", icon: Bug, badge: "bugs" as const },
  { href: "/admin/catalog", label: "Przepisy", icon: UtensilsCrossed },
  { href: "/admin/exercises", label: "Ćwiczenia", icon: Dumbbell },
  { href: "/admin/branding", label: "Branding", icon: ImageIcon },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notifyError } = useSaveFeedback();
  const [openBugs, setOpenBugs] = useState(0);

  const refreshOpenCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/bug-reports?summary=1", {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        openCount?: number;
      } | null;
      if (res.ok && data?.ok && typeof data.openCount === "number") {
        setOpenBugs(data.openCount);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshOpenCount();
  }, [refreshOpenCount, pathname]);

  useEffect(() => {
    const onChanged = () => {
      void refreshOpenCount();
    };
    window.addEventListener(BUG_REPORTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(BUG_REPORTS_CHANGED_EVENT, onChanged);
  }, [refreshOpenCount]);

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
          {links.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const showBadge = badge === "bugs" && openBugs > 0;
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
                  {showBadge ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                      {openBugs > 99 ? "99+" : openBugs}
                    </span>
                  ) : null}
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
                  notifyError("Nie udało się wyjść z panelu.");
                  return;
                }
                router.push("/");
                router.refresh();
              })();
            }}
          >
            Wróć do aplikacji
          </Button>
        </nav>
      </header>
      {children}
    </div>
  );
}
