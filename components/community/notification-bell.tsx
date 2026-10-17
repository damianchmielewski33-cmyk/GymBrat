"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useSession } from "next-auth/react";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { cn } from "@/lib/utils";

export function NotificationBell({ className }: { className?: string }) {
  const { status } = useSession();
  const enabled = status === "authenticated";
  const { unreadCount } = useNotificationsRealtime(enabled);

  if (!enabled) return null;

  return (
    <Link
      href="/community/notifications"
      className={cn(
        "touch-target relative inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]",
        className,
      )}
      aria-label={
        unreadCount > 0
          ? `Powiadomienia, ${unreadCount} nieprzeczytanych`
          : "Powiadomienia"
      }
    >
      <Bell className="h-4 w-4" aria-hidden />
      {unreadCount > 0 ? (
        <span
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--gym-gold)] px-1 text-[10px] font-bold text-black"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="sr-only">Nieprzeczytane: </span>
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
