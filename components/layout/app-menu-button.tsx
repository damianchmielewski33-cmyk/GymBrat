"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  BarChart3,
  Bug,
  LineChart,
  LogOut,
  Menu,
  ScrollText,
  Shield,
  User,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useI18n } from "@/components/i18n/i18n-provider";
import { isPrimaryAdminEmail } from "@/lib/admin-config";
import { cn } from "@/lib/utils";

export function AppMenuButton({
  variant = "icon",
  initials,
}: {
  variant?: "icon" | "initials";
  /** Skrót imienia/nazwiska — trigger menu na Pulpicie (bez osobnego „Menu”). */
  initials?: string;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { data } = useSession();
  const showAdminLink =
    data?.user?.role === "admin" || isPrimaryAdminEmail(data?.user?.email);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const menu = [
    { href: "/profile", label: t("nav.profile"), icon: User },
    { href: "/reports", label: t("nav.reports"), icon: BarChart3 },
    { href: "/progress", label: t("nav.progress"), icon: LineChart },
    { href: "/workout-history", label: t("nav.history"), icon: ScrollText },
    { href: "/bug-report", label: "Zgłoś błąd", icon: Bug },
  ];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const root = document.documentElement;
    if (open) {
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      return;
    }
    body.style.overflow = "";
    root.style.overflow = "";
    queueMicrotask(() => triggerRef.current?.focus());
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        ref={triggerRef}
        className={cn(
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gym-black)]",
          variant === "initials"
            ? "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/70 bg-[var(--gym-gold)]/10 text-sm font-semibold tracking-wide text-white transition-colors hover:border-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/15"
            : "inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white",
        )}
        aria-label={open ? "Zamknij menu" : "Otwórz menu"}
      >
        {variant === "initials" ? (
          open ? (
            <X className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          ) : (
            <span aria-hidden>{initials?.trim() || "?"}</span>
          )
        ) : open ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          "gap-0 border-l border-white/[0.08] p-0 text-white",
          "bg-[#070708] bg-[linear-gradient(165deg,rgba(235,196,74,0.06)_0%,transparent_42%),linear-gradient(180deg,#0c0c0e_0%,#050505_100%)]",
          "pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 pb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]/85">
              GymBrat
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-white">Menu</p>
          </div>
          <button
            type="button"
            aria-label="Zamknij menu"
            onClick={() => setOpen(false)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
          {menu.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-3 text-[14px] font-medium transition-colors",
                  active
                    ? "border border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
                    : "border border-transparent text-white/75 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-[var(--gym-gold)]" : "text-white/45",
                  )}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
          {showAdminLink ? (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-[14px] font-medium text-white/75 transition-colors hover:bg-white/[0.05] hover:text-white",
                pathname.startsWith("/admin") &&
                  "border-[var(--gym-gold)]/25 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]",
              )}
            >
              <Shield
                className={cn(
                  "h-4 w-4 shrink-0",
                  pathname.startsWith("/admin")
                    ? "text-[var(--gym-gold)]"
                    : "text-white/45",
                )}
                aria-hidden
              />
              Panel admina
            </Link>
          ) : null}
        </nav>

        <div className="mt-auto border-t border-white/[0.08] px-3 pt-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14px] font-medium text-white/55 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Wyloguj się
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
