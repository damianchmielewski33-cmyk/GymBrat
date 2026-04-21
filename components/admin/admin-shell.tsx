"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Shield, Users } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin/overview", label: "Analityka", icon: LayoutDashboard },
  { href: "/admin/users", label: "Użytkownicy", icon: Users },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();

  return (
    <div className="space-y-8">
      <header className="glass-panel neon-glow flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(145deg,rgba(230,0,35,0.22),rgba(230,0,35,0.08))",
              border: "1px solid rgba(230,0,35,0.45)",
            }}
          >
            <Shield className="h-5 w-5 text-[var(--neon)]" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
              GymBrat
            </p>
            <h1 className="font-heading text-lg font-semibold text-white">
              Administrator
            </h1>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href}>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--neon)]/20 text-white ring-1 ring-[var(--neon)]/40"
                      : "text-white/65 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </Link>
            );
          })}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-white/15 bg-white/[0.06]"
            onClick={() => {
              void (async () => {
                const res = await fetch("/api/admin/lock", { method: "POST" });
                if (!res.ok) {
                  notifyError("Nie udało się zablokować panelu.");
                  return;
                }
                notifySaved("Zablokowano panel administratora.");
                router.push("/");
                router.refresh();
              })();
            }}
          >
            Wyjdź z panelu
          </Button>
          <Link href="/">
            <Button type="button" variant="ghost" size="sm" className="text-white/70">
              Wróć do aplikacji
            </Button>
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
