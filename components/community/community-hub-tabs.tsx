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
      className="flex flex-wrap gap-2"
      aria-label="Widoki Community"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              active
                ? "rounded-full border border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/15 px-3.5 py-2 text-[12px] font-medium text-[var(--gym-gold)]"
                : "rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] text-white/55 hover:text-white"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
