"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";

type PlanRow = {
  id: string;
  sku: string;
  title: string;
  description: string;
  days: number;
  priceGrosze: number;
  active: number;
  sortOrder: number;
};

export function AdminPackagesClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { title: string; description: string; pricePln: string; active: boolean }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/subscription-plans", {
        credentials: "include",
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        plans?: PlanRow[];
      } | null;
      if (!res.ok || !data?.ok || !data.plans) {
        notifyError("Nie udało się wczytać pakietów.");
        return;
      }
      setPlans(data.plans);
      const next: typeof drafts = {};
      for (const p of data.plans) {
        next[p.id] = {
          title: p.title,
          description: p.description,
          pricePln: (p.priceGrosze / 100).toFixed(2).replace(".", ","),
          active: p.active === 1,
        };
      }
      setDrafts(next);
    } catch {
      notifyError("Nie udało się wczytać pakietów.");
    } finally {
      setLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(id: string) {
    const d = drafts[id];
    if (!d) return;
    setBusyId(id);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/admin/subscription-plans", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({
          id,
          title: d.title,
          description: d.description,
          pricePln: d.pricePln,
          active: d.active,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        plans?: PlanRow[];
      } | null;
      if (!res.ok || !data?.ok) {
        notifyError(data?.error ?? "Zapis nie powiódł się.");
        return;
      }
      if (data.plans) setPlans(data.plans);
      notifySaved("Zapisano pakiet.");
    } catch {
      notifyError("Zapis nie powiódł się.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel neon-glow p-5 sm:p-6">
        <h1 className="font-heading text-xl font-semibold text-white">Pakiety</h1>
        <p className="mt-1 text-sm text-white/55">
          Okresy są stałe (7 / 30 / 90 / 365 dni). Ceny i opisy zmieniasz tutaj —
          użytkownik widzi je na ekranie „Twój pakiet” i płaci przez HotPay.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">Ładowanie…</p>
      ) : (
        <div className="space-y-4">
          {plans.map((p) => {
            const d = drafts[p.id];
            if (!d) return null;
            return (
              <div
                key={p.id}
                className="glass-panel space-y-3 p-5 ring-1 ring-white/10"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gym-gold)]">
                    {p.sku} · {p.days} dni
                  </p>
                  <p className="text-sm text-white/45">
                    Aktualnie: {formatPlnFromGrosze(p.priceGrosze)}
                  </p>
                </div>
                <label className="block text-xs text-white/50">
                  Tytuł
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    value={d.title}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [p.id]: { ...d, title: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className="block text-xs text-white/50">
                  Opis
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    value={d.description}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [p.id]: { ...d, description: e.target.value },
                      }))
                    }
                  />
                </label>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block text-xs text-white/50">
                    Cena (PLN)
                    <input
                      className="mt-1 w-32 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      value={d.pricePln}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.id]: { ...d, pricePln: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={d.active}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.id]: { ...d, active: e.target.checked },
                        }))
                      }
                    />
                    Aktywny w sklepie
                  </label>
                  <Button
                    type="button"
                    className="gym-btn-primary ml-auto"
                    disabled={busyId === p.id}
                    onClick={() => void save(p.id)}
                  >
                    {busyId === p.id ? "Zapis…" : "Zapisz"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
