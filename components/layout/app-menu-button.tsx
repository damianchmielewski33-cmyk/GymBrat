"use client";

import { ThemeToggleButton } from "@/components/theme/theme-toggle-button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  Bug,
  CalendarCheck2,
  ChevronDown,
  BookOpen,
  ClipboardList,
  Clock3,
  FileText,
  Flame,
  History,
  LineChart,
  ListChecks,
  LifeBuoy,
  LogOut,
  Menu,
  Play,
  Shield,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PRIVACY_PATH, REGULAMIN_PATH } from "@/lib/legal-seller";
import { cn } from "@/lib/utils";

type MenuIcon = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type MenuRow = {
  href: string;
  title: string;
  icon: MenuIcon;
};

type QuickTileData = MenuRow & { hint: string; primary?: boolean };

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
  "/plany",
  "/reports",
];

function isActivePath(pathname: string, href: string): boolean {
  const path = href.split("?")[0] ?? href;
  if (path === "/") return pathname === "/";
  if (pathname === path) return true;
  return NESTED_ACTIVE.includes(path) && pathname.startsWith(`${path}/`);
}

/** Najważniejsze akcje — kafelki na górze. */
const QUICK: QuickTileData[] = [
  { href: "/workout-plan", title: "Trening", hint: "start dzisiaj", icon: Play, primary: true },
  { href: "/reports?new=1", title: "Raport", hint: "waga i zdjęcia", icon: ClipboardList },
  { href: "/progress", title: "Postępy", hint: "siła i sylwetka", icon: LineChart },
  { href: "/plany", title: "Plany", hint: "dni i ćwiczenia", icon: ListChecks },
];

const TRAINING: MenuRow[] = [
  { href: "/workout-history", title: "Historia treningów", icon: History },
  { href: "/cardio", title: "Cardio", icon: Flame },
  { href: "/plany/atlas", title: "Atlas ćwiczeń", icon: BookOpen },
  { href: "/technique", title: "Korekta techniki", icon: Video },
];

const SOCIAL: MenuRow[] = [
  { href: "/community", title: "Community", icon: Users },
  { href: "/community/notifications", title: "Powiadomienia", icon: Bell },
  { href: "/community/friends", title: "Znajomi", icon: UserPlus },
];

const MORE: MenuRow[] = [
  { href: "/progress?tab=sila", title: "Moje maxy", icon: Trophy },
  { href: "/reports", title: "Historia raportów", icon: Clock3 },
  { href: "/community/challenges", title: "Wyzwania", icon: Trophy },
  { href: "/community/wars", title: "Wojny drużyn", icon: Swords },
  { href: "/community/hall-of-fame", title: "Galeria sławy", icon: Trophy },
  { href: "/package", title: "Twój pakiet", icon: CalendarCheck2 },
  { href: "/bug-report", title: "Zgłoś błąd", icon: Bug },
];

function delay(seconds: number): CSSProperties {
  return { "--menu-delay": `${seconds}s` } as CSSProperties;
}

function QuickTile({
  tile,
  pathname,
  onNavigate,
}: {
  tile: QuickTileData;
  pathname: string;
  onNavigate: () => void;
}) {
  const Icon = tile.icon;
  const active = isActivePath(pathname, tile.href);
  return (
    <Link
      href={tile.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[4.5rem] flex-col justify-between rounded-2xl border p-3 transition active:scale-[0.97]",
        tile.primary
          ? "border-[var(--gym-gold)]/60 bg-[var(--gym-gold)]/15"
          : active
            ? "border-[rgba(var(--neon-rgb),0.35)] bg-[rgba(var(--neon-rgb),0.10)]"
            : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06]",
      )}
    >
      <Icon className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
      <span>
        <span className="block text-[14px] font-semibold leading-tight text-white">
          {tile.title}
        </span>
        <span className="block text-[11px] leading-tight text-[var(--gym-text-secondary)]">
          {tile.hint}
        </span>
      </span>
    </Link>
  );
}

function MenuLink({
  row,
  pathname,
  onNavigate,
  className,
  style,
}: {
  row: MenuRow;
  pathname: string;
  onNavigate: () => void;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = row.icon;
  const active = isActivePath(pathname, row.href);
  return (
    <Link
      href={row.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      style={style}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl border px-2.5 text-[14px] font-medium transition active:scale-[0.98]",
        className,
        active
          ? "border-[rgba(var(--neon-rgb),0.35)] bg-[rgba(var(--neon-rgb),0.10)] text-[var(--gym-gold)]"
          : "border-transparent text-white/90 hover:bg-white/[0.04]",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--gym-gold)]" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{row.title}</span>
    </Link>
  );
}

function MenuGroup({
  title,
  rows,
  pathname,
  onNavigate,
  delaySeconds,
}: {
  title: string;
  rows: MenuRow[];
  pathname: string;
  onNavigate: () => void;
  delaySeconds: number;
}) {
  return (
    <section className="menu-stagger" style={delay(delaySeconds)}>
      <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-text-secondary)]">
        {title}
      </p>
      <div className="space-y-0.5">
        {rows.map((row) => (
          <MenuLink key={row.href} row={row} pathname={pathname} onNavigate={onNavigate} />
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
}: {
  variant?: "icon" | "initials";
  /** Skrót imienia/nazwiska — trigger menu na Pulpicie. */
  initials?: string;
  firstName?: string | null;
  /** Nazwa pakietu pod imieniem (np. „Ponad Limit”). */
  packageName?: string | null;
  packageDaysLeft?: number | null;
  /** Zachowane dla zgodności wywołań. */
  packageEndsLabel?: string | null;
}) {
  const pathname = usePathname();
  const { data } = useSession();
  const showAdminLink = data?.user?.role === "admin";
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const displayName =
    firstName?.trim() || data?.user?.name?.trim()?.split(/\s+/)[0] || "Profil";
  const avatar = initials?.trim() || displayName.slice(0, 1).toUpperCase() || "?";
  const planLabel = packageName?.trim() || null;
  const daysLeft =
    packageDaysLeft != null && Number.isFinite(packageDaysLeft)
      ? Math.max(0, Math.round(packageDaysLeft))
      : null;

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
        aria-label={open ? "Zamknij menu" : variant === "initials" ? `${avatar}, otwórz menu` : "Otwórz menu"}
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
          "w-[min(100%,20rem)] max-w-none gap-0 overflow-hidden border-l border-[var(--gym-border-gold)] p-0 text-white sm:max-w-[20rem]",
          "bg-[#101012]",
          "pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        )}
      >
        <SheetTitle className="sr-only">Menu aplikacji</SheetTitle>
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-white/[0.06] px-3.5 pb-3 pt-1">
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                onClick={close}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl"
              >
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/10 font-heading text-[14px] font-semibold text-[var(--gym-gold)]"
                  aria-hidden
                >
                  {avatar}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold leading-tight text-white">
                    {displayName}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-[var(--gym-text-secondary)]">
                    {planLabel ?? "Profil i ustawienia"}
                    {daysLeft != null ? ` · ${daysLeft} dni` : ""}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={close}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="Zamknij menu"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
            <div className="menu-stagger grid grid-cols-2 gap-2" style={delay(0.15)}>
              {QUICK.map((tile) => (
                <QuickTile key={tile.href} tile={tile} pathname={pathname} onNavigate={close} />
              ))}
            </div>

            <MenuGroup title="Trening" rows={TRAINING} pathname={pathname} onNavigate={close} delaySeconds={0.25} />
            <MenuGroup title="Społeczność" rows={SOCIAL} pathname={pathname} onNavigate={close} delaySeconds={0.35} />

            <section className="menu-stagger" style={delay(0.45)}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                className="flex min-h-11 w-full items-center justify-between rounded-xl px-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--gym-text-secondary)] hover:bg-white/[0.04]"
              >
                Więcej
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-300", moreOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {moreOpen ? (
                <div className="space-y-0.5">
                  {MORE.map((row, i) => (
                    <MenuLink
                      key={row.href}
                      row={row}
                      pathname={pathname}
                      onNavigate={close}
                      className="menu-unfold"
                      style={delay(i * 0.04)}
                    />
                  ))}
                </div>
              ) : null}
            </section>
          </div>

          <footer className="shrink-0 space-y-0.5 border-t border-white/[0.06] px-3 pt-2">
            <MenuLink
              row={{ href: "/pomoc", title: "Pomoc i reklamacje", icon: LifeBuoy }}
              pathname={pathname}
              onNavigate={close}
            />
            {showAdminLink ? (
              <MenuLink
                row={{ href: "/admin", title: "Panel admina", icon: Shield }}
                pathname={pathname}
                onNavigate={close}
              />
            ) : null}
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => {
                close();
                void signOut({ callbackUrl: "/login" });
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-[14px] font-medium text-[color-mix(in_srgb,var(--destructive)_85%,white)] transition-colors hover:bg-[var(--destructive)]/10"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Wyloguj się
            </button>
            <nav
              aria-label="Dokumenty prawne"
              className="flex flex-wrap gap-x-4 gap-y-1 px-2.5 pb-1 pt-1 text-[12px] text-[var(--gym-text-secondary)]"
            >
              <Link href={REGULAMIN_PATH} onClick={close} className="inline-flex items-center gap-1 hover:text-white/80">
                <FileText className="h-3 w-3" aria-hidden />
                Regulamin
              </Link>
              <Link href={PRIVACY_PATH} onClick={close} className="inline-flex items-center gap-1 hover:text-white/80">
                <Shield className="h-3 w-3" aria-hidden />
                Polityka prywatności
              </Link>
            </nav>
          </footer>
        </div>
      </SheetContent>
    </Sheet>
  );
}
