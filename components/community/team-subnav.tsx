"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticTap } from "@/lib/haptics";

/**
 * Szybkie skoki po Team — w dolnej strefie kciuka (sticky).
 */
export function TeamSubnav({ teamId }: { teamId: string }) {
  const pathname = usePathname();
  const items = [
    {
      href: `/community/teams/${teamId}`,
      label: "Tablica",
      icon: MessageCircle,
      match: (p: string) =>
        p === `/community/teams/${teamId}` ||
        p === `/community/teams/${teamId}/`,
    },
    {
      href: `/community/teams/${teamId}/challenges`,
      label: "Wyzwania",
      icon: Trophy,
      match: (p: string) => p.includes("/challenges"),
    },
    {
      href: `/community/teams/${teamId}/members`,
      label: "Ludzie",
      icon: Users,
      match: (p: string) => p.includes("/members"),
    },
  ] as const;

  return (
    <nav
      className={cn(
        "sticky z-[30] -mx-1 mb-1 rounded-2xl border border-white/[0.07] bg-black/70 px-1 py-1 backdrop-blur-md",
        "top-[calc(3.5rem+env(safe-area-inset-top))]",
      )}
      aria-label="Nawigacja grupy"
    >
      <div className="grid grid-cols-3 gap-0.5">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => hapticTap()}
              className={cn(
                "inline-flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition",
                active
                  ? "bg-[var(--gym-gold)]/15 text-[var(--gym-gold)]"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/70",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
