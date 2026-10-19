"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { searchUsersAction } from "@/actions/community-social";

export function DiscoverView({
  initialTeams,
}: {
  initialTeams: Array<{
    id: string;
    name: string;
    description: string;
    memberCount: number;
  }>;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    Array<{ userId: string; displayName: string; bio: string | null }>
  >([]);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj po nazwie…"
          className="min-h-11 flex-1 rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white placeholder:text-white/30"
        />
        <button
          type="button"
          disabled={pending || q.trim().length < 2}
          onClick={() =>
            start(async () => {
              const r = await searchUsersAction(q);
              setResults(r);
            })
          }
          className="rounded-xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-4 text-[13px] text-[var(--gym-gold)] disabled:opacity-40"
        >
          Szukaj
        </button>
      </div>

      {results.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-heading text-[16px] text-white">Atleci</h2>
          {results.map((u) => (
            <Link
              key={u.userId}
              href={`/community/u/${u.userId}`}
              className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
            >
              <p className="text-[14px] text-white">{u.displayName}</p>
              {u.bio ? (
                <p className="mt-0.5 text-[12px] text-white/40">{u.bio}</p>
              ) : null}
            </Link>
          ))}
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-heading text-[16px] text-white">Publiczne grupy</h2>
        {initialTeams.map((t) => (
          <Link
            key={t.id}
            href={`/community/teams/${t.id}`}
            className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <p className="text-[14px] text-white">{t.name}</p>
            <p className="mt-0.5 text-[12px] text-white/40">
              {t.memberCount} członków
              {t.description ? ` · ${t.description.slice(0, 80)}` : ""}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
