"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/community", label: "Mój Team", match: (p: string) => p === "/community" || p === "/community/" },
  { href: "/community/friends", label: "Znajomi", match: (p: string) => p.startsWith("/community/friends") },
  { href: "/community/global", label: "Global GymBrat", match: (p: string) => p.startsWith("/community/global") },
  { href: "/community/discover", label: "Odkrywaj", match: (p: string) => p.startsWith("/community/discover") },
] as const;

export function CommunityHubTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-black/30 p-1"
      aria-label="Widoki Community"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "inline-flex min-h-11 items-center rounded-lg border border-[var(--gym-gold)]/35 bg-[var(--gym-gold)]/20 px-3.5 text-[length:var(--text-caption)] font-semibold text-[var(--gym-gold)]"
                : "inline-flex min-h-11 items-center rounded-lg border border-transparent px-3.5 text-[length:var(--text-caption)] font-semibold text-white/55 hover:text-white"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
