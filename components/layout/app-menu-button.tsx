"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  BadgePercent,
  Bell,
  Bug,
  CalendarCheck2,
  ChevronRight,
  BookOpen,
  ClipboardList,
  Clock3,
  Dumbbell,
  FileText,
  Flame,
  History,
  LineChart,
  ListChecks,
  LogOut,
  Menu,
  Play,
  Shield,
  Swords,
  TestTube2,
  Trophy,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PRIVACY_PATH, REGULAMIN_PATH } from "@/lib/legal-seller";
import { cn } from "@/lib/utils";

type MenuIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type MenuRow = {
  href?: string;
  title: string;
  subtitle: string;
  icon: MenuIcon;
  iconTone?: "gold" | "muted" | "danger";
  /** Nieużywana / jeszcze niegotowa funkcja — widać w menu, ale nie da się kliknąć. */
  disabled?: boolean;
  onSelect?: () => void;
};

type MenuSection = {
  id: string;
  title: string;
  rows: MenuRow[];
};

/** Ścieżki, przy których podstrony (np. /cardio/123) też liczą się jako aktywne. */
const NESTED_ACTIVE = [
  "/progress",
  "/workout-history",
  "/cardio",
  "/admin",
  "/community/friends",
  "/community/challenges",
  "/community/wars",
  "/community/hall-of-fame",
];

function isActivePath(pathname: string, href: string): boolean {
  const path = href.split("?")[0] ?? href;
  if (path === "/") return pathname === "/";
  if (pathname === path) return true;
  return NESTED_ACTIVE.includes(path) && pathname.startsWith(`${path}/`);
}

function MenuRowView({
  row,
  pathname,
  onNavigate,
}: {
  row: MenuRow;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = row.icon;
  const active = Boolean(row.href) && !row.disabled && isActivePath(pathname, row.href!);
  const gold = row.iconTone === "gold";
  const danger = row.iconTone === "danger";

  const inner = (
    <>
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
          row.disabled
            ? "border-white/[0.06] bg-white/[0.03] text-white/30"
            : danger
              ? "border-rose-400/25 bg-rose-500/10 text-rose-300"
              : gold
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
            row.disabled
              ? "text-white/40"
              : danger
                ? "text-rose-200"
                : active
                  ? "text-[var(--gym-gold)]"
                  : "text-white",
          )}
        >
          {row.title}
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-white/40">{row.subtitle}</span>
      </span>
      {row.disabled ? (
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
          Wkrótce
        </span>
      ) : danger ? null : (
        <ChevronRight className="h-4 w-4 shrink-0 text-white/25" aria-hidden />
      )}
    </>
  );

  const rowClass = cn(
    "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
    row.disabled
      ? "cursor-not-allowed opacity-70"
      : active
        ? "bg-[var(--gym-gold)]/[0.08]"
        : danger
          ? "hover:bg-rose-500/10"
          : "hover:bg-white/[0.04]",
  );

  if (row.disabled) {
    return (
      <div className={rowClass} aria-disabled="true">
        {inner}
      </div>
    );
  }

  if (row.onSelect) {
    return (
      <button
        type="button"
        className={rowClass}
        onClick={() => {
          onNavigate();
          row.onSelect?.();
        }}
      >
        {inner}
      </button>
    );
  }

  if (!row.href) return null;

  return (
    <Link
      href={row.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={rowClass}
    >
      {inner}
    </Link>
  );
}

function MenuSectionBlock({
  section,
  pathname,
  onNavigate,
}: {
  section: MenuSection;
  pathname: string;
  onNavigate: () => void;
}) {
  if (section.rows.length === 0) return null;
  return (
    <section>
      <p className="app-label mb-2 px-0.5 text-[var(--gym-gold)]">{section.title}</p>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.06]">
        {section.rows.map((row) => (
          <MenuRowView
            key={`${row.href ?? row.title}-${row.title}`}
            row={row}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
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
  const showAdminLink = data?.user?.role === "admin";
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const displayName =
    firstName?.trim() || data?.user?.name?.trim()?.split(/\s+/)[0] || "Profil";
  const avatar = initials?.trim() || displayName.slice(0, 1).toUpperCase() || "?";
  const planLabel = packageName?.trim() || null;
  const daysLeft =
    packageDaysLeft != null && Number.isFinite(packageDaysLeft)
      ? Math.max(0, Math.round(packageDaysLeft))
      : null;

  const sections: MenuSection[] = [
    {
      id: "package",
      title: "Pakiet",
      rows: [
        {
          href: "/package",
          title: "Twój pakiet",
          subtitle: packageEndsLabel
            ? `aktywny ${packageEndsLabel}`
            : "kup pakiet albo oglądaj reklamy",
          icon: CalendarCheck2,
          iconTone: "gold",
        },
        {
          href: "/promo-codes",
          title: "Kody rabatowe",
          subtitle: "zniżki partnerskie — w przygotowaniu",
          icon: BadgePercent,
          disabled: true,
        },
      ],
    },
    {
      id: "progress",
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
          subtitle: "przegląd, siła, sylwetka, tygodnie",
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
          subtitle: "wyniki krwi i hormony — w przygotowaniu",
          icon: TestTube2,
          disabled: true,
        },
      ],
    },
    {
      id: "community",
      title: "Społeczność",
      rows: [
        {
          href: "/community",
          title: "Community",
          subtitle: "grupy, znajomi, odkrywaj",
          icon: Users,
          iconTone: "gold",
        },
        {
          href: "/community/friends",
          title: "Znajomi",
          subtitle: "udostępnianie treningu i podgląd na żywo",
          icon: UserPlus,
        },
        {
          href: "/community/challenges",
          title: "Wyzwania",
          subtitle: "globalne wyzwania, XP i odznaki",
          icon: Trophy,
        },
        {
          href: "/community/wars",
          title: "Wojny drużyn",
          subtitle: "Team Wars · ligi Bronze→Diamond",
          icon: Swords,
        },
        {
          href: "/community/hall-of-fame",
          title: "Galeria sławy",
          subtitle: "sezony i kategorie",
          icon: Trophy,
        },
        {
          href: "/community/notifications",
          title: "Powiadomienia",
          subtitle: "komentarze, trening na żywo, ogłoszenia",
          icon: Bell,
        },
      ],
    },
    {
      id: "training",
      title: "Trening",
      rows: [
        {
          href: "/workout-plan",
          title: "Treningi",
          subtitle: "start dzisiejszego treningu",
          icon: Play,
          iconTone: "gold",
        },
        {
          href: "/plany",
          title: "Plany treningowe",
          subtitle: "dni i ćwiczenia, nowy plan",
          icon: ListChecks,
        },
        {
          href: "/plany/atlas",
          title: "Atlas ćwiczeń",
          subtitle: "partie, technika, wyszukiwarka",
          icon: BookOpen,
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
    {
      id: "account",
      title: "Konto",
      rows: [
        {
          href: "/profile",
          title: "Profil",
          subtitle: "ciało, cele, dieta, przypomnienia, konto",
          icon: User,
          iconTone: "gold",
        },
        {
          href: "/bug-report",
          title: "Zgłoś błąd",
          subtitle: "opis i zdjęcia z ekranu",
          icon: Bug,
        },
        ...(showAdminLink
          ? [
              {
                href: "/admin",
                title: "Panel admina",
                subtitle: "użytkownicy, konfiguracja, błędy",
                icon: Shield,
                iconTone: "gold" as const,
              },
            ]
          : []),
        {
          title: "Wyloguj się",
          subtitle: "zakończ sesję na tym urządzeniu",
          icon: LogOut,
          iconTone: "danger",
          onSelect: () => {
            void signOut({ callbackUrl: "/login" });
          },
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
    const prevBody = body.style.overflow;
    const prevRoot = root.style.overflow;
    if (open) {
      wasOpenRef.current = true;
      body.style.overflow = "hidden";
      root.style.overflow = "hidden";
      return () => {
        body.style.overflow = prevBody;
        root.style.overflow = prevRoot;
      };
    }
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
          "bg-[#070708]",
          "pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-white/[0.06] px-4 pb-4">
            <div className="flex items-center justify-between gap-2">
              <p className="app-label text-[var(--gym-gold)]">Menu</p>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="Zamknij menu"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/10 font-heading text-[15px] font-semibold text-[var(--gym-gold)]"
                aria-hidden
              >
                {avatar}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold leading-tight text-white">
                  {displayName}
                </p>
                {planLabel ? (
                  <p className="mt-0.5 truncate text-[12px] text-white/50">{planLabel}</p>
                ) : (
                  <Link
                    href="/profile"
                    onClick={close}
                    className="mt-0.5 inline-block text-[12px] text-white/45 underline-offset-2 hover:text-white/75 hover:underline"
                  >
                    Ustawienia konta
                  </Link>
                )}
              </div>
              <Link
                href="/package"
                onClick={close}
                className="shrink-0 rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2 text-right"
              >
                <p className="font-metric text-[22px] leading-none tabular-nums text-white">
                  {daysLeft != null ? daysLeft : "—"}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/40">
                  dni pakietu
                </p>
              </Link>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3.5 py-4">
            {sections.map((section) => (
              <MenuSectionBlock
                key={section.id}
                section={section}
                pathname={pathname}
                onNavigate={close}
              />
            ))}

            <nav
              aria-label="Dokumenty prawne"
              className="flex flex-wrap gap-x-4 gap-y-2 px-0.5 pb-2 text-[12px] text-white/40"
            >
              <Link
                href={REGULAMIN_PATH}
                onClick={close}
                className="inline-flex items-center gap-1 hover:text-white/70"
              >
                <FileText className="h-3 w-3" aria-hidden />
                Regulamin
              </Link>
              <Link
                href={PRIVACY_PATH}
                onClick={close}
                className="inline-flex items-center gap-1 hover:text-white/70"
              >
                <Shield className="h-3 w-3" aria-hidden />
                Polityka prywatności
              </Link>
            </nav>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
