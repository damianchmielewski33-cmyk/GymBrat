"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  ArrowLeft,
  BadgePercent,
  Bell,
  Bug,
  CalendarCheck2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Dumbbell,
  Flame,
  History,
  LineChart,
  LogOut,
  Menu,
  Shield,
  TestTube2,
  Trophy,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { isPrimaryAdminEmail } from "@/lib/admin-config";
import { cn } from "@/lib/utils";

type MenuIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type MenuRow = {
  href: string;
  title: string;
  subtitle: string;
  icon: MenuIcon;
  iconTone?: "gold" | "muted";
};

type MenuSection = {
  index: string;
  title: string;
  trailing?: string | null;
  rows: MenuRow[];
};

function MenuSectionBlock({
  section,
  pathname,
  onNavigate,
}: {
  section: MenuSection;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="font-metric text-[15px] leading-none text-[var(--gym-gold)]">
            {section.index}
          </span>
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
            {section.title}
          </span>
        </div>
        <div className="h-px min-w-[1rem] flex-1 bg-[var(--gym-gold)]/35" />
        {section.trailing ? (
          <p className="shrink-0 text-[11px] text-white/40">{section.trailing}</p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121214] divide-y divide-white/[0.06]">
        {section.rows.map((row) => {
          const active =
            row.href === "/"
              ? pathname === "/"
              : pathname === row.href ||
                pathname.startsWith(`${row.href.split("?")[0]}`);
          const Icon = row.icon;
          const gold = row.iconTone === "gold";
          return (
            <Link
              key={`${row.href}-${row.title}`}
              href={row.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3.5 py-3.5 transition-colors",
                active ? "bg-[var(--gym-gold)]/[0.06]" : "hover:bg-white/[0.03]",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                  gold
                    ? "border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
                    : "border-white/10 bg-white/[0.04] text-white/70",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-[15px] font-semibold leading-snug",
                    active ? "text-[var(--gym-gold)]" : "text-white",
                  )}
                >
                  {row.title}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-white/45">
                  {row.subtitle}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-white/30"
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function AppMenuButton({
  variant = "icon",
  initials,
  firstName,
  packageName,
  packageDaysLeft,
  packageEndsLabel,
}: {
  variant?: "icon" | "initials";
  /** Skrót imienia/nazwiska — trigger menu na Pulpicie. */
  initials?: string;
  firstName?: string | null;
  /** Nazwa pakietu pod imieniem (np. „Ponad Limit”). */
  packageName?: string | null;
  packageDaysLeft?: number | null;
  /** np. „do 30 października 2026” */
  packageEndsLabel?: string | null;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const showAdminLink =
    data?.user?.role === "admin" || isPrimaryAdminEmail(data?.user?.email);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const displayName =
    firstName?.trim() ||
    data?.user?.name?.trim()?.split(/\s+/)[0] ||
    "Profil";
  const avatar = initials?.trim() || displayName.slice(0, 1).toUpperCase() || "?";
  const planLabel = packageName?.trim() || null;
  const daysLeft =
    packageDaysLeft != null && Number.isFinite(packageDaysLeft)
      ? Math.max(0, Math.round(packageDaysLeft))
      : null;

  const sections: MenuSection[] = [
    {
      index: "01",
      title: "Pakiet",
      trailing: packageEndsLabel?.trim() || null,
      rows: [
        {
          href: "/package",
          title: "Twój pakiet",
          subtitle: packageEndsLabel
            ? `aktywny do ${packageEndsLabel}`
            : "kup pakiet albo oglądaj reklamy",
          icon: CalendarCheck2,
          iconTone: "gold",
        },
        {
          href: "/promo-codes",
          title: "Kody rabatowe",
          subtitle: "Ostrovit, Bolero, Farma Białka, Pro-Body",
          icon: BadgePercent,
          iconTone: "gold",
        },
      ],
    },
    {
      index: "02",
      title: "Postępy",
      rows: [
        {
          href: "/reports?new=1",
          title: "Wyślij raport",
          subtitle: "waga, obwody, samopoczucie, zdjęcia",
          icon: ClipboardList,
          iconTone: "gold",
        },
        {
          href: "/progress",
          title: "Postępy",
          subtitle: "siła, sylwetka, zdjęcia, tydzień",
          icon: LineChart,
        },
        {
          href: "/progress?tab=sila",
          title: "Moje maxy",
          subtitle: "ciężar na 1 powtórzenie",
          icon: Trophy,
        },
        {
          href: "/reports",
          title: "Historia raportów",
          subtitle: "pomiary, notatki i zalecenia",
          icon: Clock3,
        },
        {
          href: "/labs",
          title: "Badania",
          subtitle: "wyniki krwi, hormony",
          icon: TestTube2,
        },
      ],
    },
    {
      index: "03",
      title: "Community",
      rows: [
        {
          href: "/community/teams",
          title: "Teams",
          subtitle: "grupy, zaproszenia, ranking zespołu",
          icon: Users,
          iconTone: "gold",
        },
        {
          href: "/community/challenges",
          title: "Wyzwania",
          subtitle: "globalne challenge, XP i odznaki",
          icon: Trophy,
          iconTone: "gold",
        },
        {
          href: "/community/notifications",
          title: "Powiadomienia",
          subtitle: "komentarze, live, wyzwania, ogłoszenia",
          icon: Bell,
          iconTone: "gold",
        },
      ],
    },
    {
      index: "04",
      title: "Trening",
      rows: [
        {
          href: "/workout-plan",
          title: "Plan treningowy",
          subtitle: "dni, serie, start sesji",
          icon: Dumbbell,
          iconTone: "gold",
        },
        {
          href: "/workout-history",
          title: "Historia treningów",
          subtitle: "zaliczone sesje i tonaż",
          icon: History,
        },
        {
          href: "/cardio",
          title: "Cardio",
          subtitle: "trasy, wpisy, zalecenie",
          icon: Flame,
        },
        {
          href: "/technique",
          title: "Korekta techniki",
          subtitle: "filmy i uwagi do formy",
          icon: Video,
        },
      ],
    },
  ];

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const body = document.body;
    const root = document.documentElement;
    if (open) {
      wasOpenRef.current = true;
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      return () => {
        body.style.overflow = "";
        root.style.overflow = "";
      };
    }
    body.style.overflow = "";
    root.style.overflow = "";
    // Fokus tylko po zamknięciu menu — nie przy mount (iOS scrollIntoView = skok viewportu).
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      queueMicrotask(() => triggerRef.current?.focus());
    }
  }, [open]);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        ref={triggerRef}
        className={cn(
          "outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gym-black)]",
          variant === "initials"
            ? "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/70 bg-[var(--gym-gold)]/10 text-sm font-semibold tracking-wide text-white transition-colors hover:border-[var(--gym-gold)] hover:bg-[var(--gym-gold)]/15"
            : "touch-target inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white",
        )}
        aria-label={open ? "Zamknij menu" : "Otwórz menu"}
      >
        {variant === "initials" ? (
          open ? (
            <X className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          ) : (
            <span aria-hidden>{avatar}</span>
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
          "w-full max-w-none gap-0 border-l border-white/[0.08] p-0 text-white sm:max-w-md",
          "bg-[#050505]",
          "pt-[max(0.65rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <button
            type="button"
            onClick={close}
            className="inline-flex w-fit items-center gap-1.5 px-4 py-1 text-[14px] text-white/80"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Wróć
          </button>

          <div className="flex items-center gap-3 px-4 pb-4 pt-2">
            <div
              className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-[var(--gym-gold)]/70 bg-[var(--gym-gold)]/10 text-[15px] font-semibold tracking-wide text-[var(--gym-gold)]"
              aria-hidden
            >
              {avatar}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-gold)]">
                Profil
              </p>
              <p className="mt-0.5 truncate text-[22px] font-semibold leading-tight text-[var(--gym-gold)]">
                {displayName}
              </p>
              {planLabel ? (
                <p className="mt-0.5 truncate text-[13px] text-white/55">
                  {planLabel}
                </p>
              ) : (
                <Link
                  href="/profile"
                  onClick={close}
                  className="mt-0.5 inline-block text-[13px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
                >
                  Ustawienia konta
                </Link>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-metric text-[28px] leading-none tabular-nums text-white">
                {daysLeft != null ? daysLeft : "—"}
              </p>
              <p className="mt-1 text-[11px] leading-none text-white/45">
                dni pakietu
              </p>
            </div>
          </div>

          <div className="space-y-5 px-3.5 pb-4">
            {sections.map((section) => (
              <MenuSectionBlock
                key={section.index}
                section={section}
                pathname={pathname}
                onNavigate={close}
              />
            ))}

            <section className="space-y-2">
              <div className="flex items-center gap-2 px-0.5">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="font-metric text-[15px] leading-none text-[var(--gym-gold)]">
                    04
                  </span>
                  <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]">
                    Konto
                  </span>
                </div>
                <div className="h-px min-w-[1rem] flex-1 bg-[var(--gym-gold)]/35" />
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121214] divide-y divide-white/[0.06]">
                <Link
                  href="/profile"
                  onClick={close}
                  className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70">
                    <User className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-white">
                      Profil
                    </span>
                    <span className="mt-0.5 block text-[12px] text-white/45">
                      cele, cykl raportów, hasło
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
                </Link>
                <Link
                  href="/bug-report"
                  onClick={close}
                  className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70">
                    <Bug className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-white">
                      Zgłoś błąd
                    </span>
                    <span className="mt-0.5 block text-[12px] text-white/45">
                      opis i zdjęcia z ekranu
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/30" aria-hidden />
                </Link>
                {showAdminLink ? (
                  <Link
                    href="/admin"
                    onClick={close}
                    className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]">
                      <Shield className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-white">
                        Panel admina
                      </span>
                      <span className="mt-0.5 block text-[12px] text-white/45">
                        użytkownicy, branding, błędy
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 text-white/30"
                      aria-hidden
                    />
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-rose-500/10"
                  onClick={() => {
                    close();
                    void signOut({ callbackUrl: "/login" });
                  }}
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-400/25 bg-rose-500/10 text-rose-300">
                    <LogOut className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-rose-200">
                      Wyloguj się
                    </span>
                    <span className="mt-0.5 block text-[12px] text-white/40">
                      zakończ sesję na tym urządzeniu
                    </span>
                  </span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
