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
import { Button } from "@/components/ui/button";
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
                onClick={() => setOpen(false)}
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
          {showAdminLink ? (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
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
              setOpen(false);
              void signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut className="h-4 w-4" />
            Wyloguj się
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
