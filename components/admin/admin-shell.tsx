"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  ADMIN_NAV_GROUPS,
  isAdminNavActive,
  type AdminNavBadge,
  type AdminNavItem,
} from "@/components/admin/admin-nav";
import { AdminNotice } from "@/components/admin/admin-ui";
import { formatHostingFunctionCount } from "@/lib/admin-config-status";
import { BUG_REPORTS_CHANGED_EVENT } from "@/lib/bug-reports";
import { adminRequest } from "@/lib/admin-client";
import { cn } from "@/lib/utils";

type Badges = Partial<Record<AdminNavBadge, { count: number; tone: "danger" | "warn" }>>;

function NavBadge({ count, tone }: { count: number; tone: "danger" | "warn" }) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none text-white",
        tone === "danger" ? "bg-red-500" : "bg-amber-500 text-black",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({
  item,
  active,
  badge,
  compact = false,
}: {
  item: AdminNavItem;
  active: boolean;
  badge?: { count: number; tone: "danger" | "warn" };
  compact?: boolean;
}) {
  const Icon = item.icon;
  const label = compact ? (item.shortLabel ?? item.label) : item.label;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "flex items-center gap-2.5 rounded-xl text-sm font-medium transition-colors",
        compact
          ? "min-w-0 flex-col gap-1 px-1.5 py-2.5 text-center"
          : "px-3 py-2.5",
        active
          ? "bg-[var(--neon)]/15 text-white ring-1 ring-[var(--neon)]/40"
          : "text-white/60 hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <span className="relative inline-flex">
        <Icon
          className={cn("h-4 w-4 shrink-0", active && "text-[var(--gym-gold)]")}
          aria-hidden
        />
        {compact && badge && badge.count > 0 ? (
          <span
            className={cn(
              "absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-white",
              badge.tone === "danger" ? "bg-red-500" : "bg-amber-500 text-black",
            )}
          >
            {badge.count > 9 ? "9+" : badge.count}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          compact
            ? "w-full truncate text-[10px] font-semibold leading-tight"
            : "whitespace-nowrap",
        )}
      >
        {label}
      </span>
      {!compact && badge && badge.count > 0 ? <NavBadge {...badge} /> : null}
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notifyError } = useSaveFeedback();
  const [openBugs, setOpenBugs] = useState(0);
  const [configIssues, setConfigIssues] = useState(0);
  const [configRequired, setConfigRequired] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const refreshOpenCount = useCallback(async () => {
    const res = await adminRequest<{ openCount?: number }>(
      "/api/admin/bug-reports?summary=1",
    );
    if (res.ok && typeof res.data.openCount === "number") {
      setOpenBugs(res.data.openCount);
    }
  }, []);

  const refreshConfigIssues = useCallback(async () => {
    const res = await adminRequest<{
      summary?: { requiredIssues: number; hostingIssues?: number; recommendedIssues?: number };
    }>("/api/admin/config-status");
    if (res.ok && res.data.summary) {
      const hosting =
        typeof res.data.summary.hostingIssues === "number"
          ? res.data.summary.hostingIssues
          : res.data.summary.requiredIssues + (res.data.summary.recommendedIssues ?? 0);
      setConfigIssues(hosting);
      setConfigRequired(res.data.summary.requiredIssues);
    }
  }, []);

  useEffect(() => {
    void refreshOpenCount();
  }, [refreshOpenCount, pathname]);

  useEffect(() => {
    void refreshConfigIssues();
  }, [refreshConfigIssues]);

  useEffect(() => {
    const onChanged = () => void refreshOpenCount();
    window.addEventListener(BUG_REPORTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(BUG_REPORTS_CHANGED_EVENT, onChanged);
  }, [refreshOpenCount]);

  const badges: Badges = {
    bugs: { count: openBugs, tone: "danger" },
    config: { count: configIssues, tone: "warn" },
  };

  async function leavePanel() {
    setLeaving(true);
    const res = await adminRequest("/api/admin/lock", {
      method: "POST",
      fallbackError: "Nie udało się wyjść z panelu.",
    });
    if (!res.ok) {
      notifyError(res.error);
      setLeaving(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const backButton = (
    <button
      type="button"
      disabled={leaving}
      onClick={() => void leavePanel()}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Wróć do aplikacji
    </button>
  );

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]">
        <ShieldCheck className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">GymBrat</p>
        <p className="font-heading text-lg font-semibold leading-tight text-white">Administrator</p>
      </div>
    </div>
  );

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[236px_minmax(0,1fr)] lg:items-start lg:gap-8">
      {/* Mobile / tablet: nagłówek + siatka zakładek (bez poziomego scrolla — nic nie ucina) */}
      <div className="min-w-0 space-y-3 lg:hidden">
        <div className="flex min-w-0 flex-col gap-3">
          {brand}
          {backButton}
        </div>
        <nav
          aria-label="Sekcje panelu admina"
          className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/25 p-1.5"
        >
          {ADMIN_NAV_GROUPS.flatMap((g) => g.items).map((item) => (
            <NavLink
              key={item.href}
              item={item}
              compact
              active={isAdminNavActive(pathname, item.href)}
              badge={item.badge ? badges[item.badge] : undefined}
            />
          ))}
        </nav>
      </div>

      {/* Desktop: panel boczny z grupami */}
      <aside className="app-card-raised hidden space-y-5 border border-white/10 p-4 lg:sticky! lg:top-6 lg:block">
        {brand}
        <nav aria-label="Sekcje panelu admina" className="space-y-4">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                {group.label}
              </p>
              {group.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isAdminNavActive(pathname, item.href)}
                  badge={item.badge ? badges[item.badge] : undefined}
                />
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 pt-4">{backButton}</div>
      </aside>

      <main className="min-w-0 max-w-full space-y-6">
        {configIssues > 0 && pathname !== "/admin/settings" ? (
          <AdminNotice
            tone={configRequired > 0 ? "danger" : "warn"}
            action={
              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
              >
                Otwórz Konfigurację
              </Link>
            }
          >
            Trzeba skonfigurować na hostingu {formatHostingFunctionCount(configIssues)}.
            Ustaw zmienne środowiska i zrób redeploy.
          </AdminNotice>
        ) : null}
        {children}
      </main>
    </div>
  );
}
