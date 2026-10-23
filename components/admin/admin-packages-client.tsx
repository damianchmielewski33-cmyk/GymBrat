"use client";

import { useCallback, useEffect, useState } from "react";
import { Package } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminField,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminRequest } from "@/lib/admin-client";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";
import { cn } from "@/lib/utils";

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

type Draft = { title: string; description: string; pricePln: string; active: boolean };

const PRICE_RE = /^\d+([.,]\d{1,2})?$/;

function toDraft(p: PlanRow): Draft {
  return {
    title: p.title,
    description: p.description,
    pricePln: (p.priceGrosze / 100).toFixed(2).replace(".", ","),
    active: p.active === 1,
  };
}

function isDirty(p: PlanRow, d: Draft): boolean {
  const base = toDraft(p);
  return (
    base.title !== d.title ||
    base.description !== d.description ||
    base.pricePln !== d.pricePln.trim() ||
    base.active !== d.active
  );
}

export function AdminPackagesClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const applyPlans = useCallback((list: PlanRow[]) => {
    setPlans(list);
    setDrafts(Object.fromEntries(list.map((p) => [p.id, toDraft(p)])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminRequest<{ plans?: PlanRow[] }>("/api/admin/subscription-plans", {
      fallbackError: "Nie udało się wczytać pakietów.",
    });
    if (res.ok && res.data.plans) applyPlans(res.data.plans);
    else notifyError(res.ok ? "Nie udało się wczytać pakietów." : res.error);
    setLoading(false);
  }, [applyPlans, notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function save(id: string) {
    const d = drafts[id];
    if (!d) return;
    if (!d.title.trim()) {
      notifyError("Tytuł pakietu nie może być pusty.");
      return;
    }
    if (!PRICE_RE.test(d.pricePln.trim())) {
      notifyError("Podaj cenę w złotówkach, np. 29,99.");
      return;
    }
    setBusyId(id);
    const res = await adminRequest<{ plans?: PlanRow[] }>("/api/admin/subscription-plans", {
      method: "PATCH",
      body: {
        id,
        title: d.title,
        description: d.description,
        pricePln: d.pricePln,
        active: d.active,
      },
      fallbackError: "Zapis nie powiódł się.",
    });
    setBusyId(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    if (res.data.plans) applyPlans(res.data.plans);
    notifySaved("Zapisano pakiet.");
  }

  const activeCount = plans.filter((p) => p.active === 1).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Package />}
        title="Pakiety i ceny"
        description="Okresy są stałe (7 / 30 / 90 / 365 dni). Zmieniaj tytuły, opisy i ceny — użytkownik widzi je na ekranie „Twój pakiet” i płaci przez bramkę płatniczą."
      />

      {!loading && plans.length > 0 && activeCount === 0 ? (
        <AdminNotice tone="warn">
          Żaden pakiet nie jest aktywny — użytkownicy nie mogą nic kupić.
        </AdminNotice>
      ) : null}

      {loading ? (
        <AdminLoading label="Wczytywanie pakietów…" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((p) => {
            const d = drafts[p.id];
            if (!d) return null;
            const dirty = isDirty(p, d);
            const priceInvalid = d.pricePln.trim() !== "" && !PRICE_RE.test(d.pricePln.trim());
            return (
              <AdminCard
                key={p.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {p.days} dni
                    <span className="font-mono text-xs font-normal text-white/40">{p.sku}</span>
                  </span>
                }
                description={`Obecnie w sklepie: ${formatPlnFromGrosze(p.priceGrosze)}`}
                actions={
                  <>
                    {dirty ? <AdminPill tone="gold">Niezapisane</AdminPill> : null}
                    <AdminPill tone={d.active ? "ok" : "neutral"}>
                      {d.active ? "Aktywny" : "Ukryty"}
                    </AdminPill>
                  </>
                }
                className={cn(dirty && "border-[var(--gym-gold)]/35")}
              >
                <div className="space-y-4">
                  <AdminField label="Tytuł" htmlFor={`plan-title-${p.id}`}>
                    <Input
                      id={`plan-title-${p.id}`}
                      value={d.title}
                      onChange={(e) => patchDraft(p.id, { title: e.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Opis" htmlFor={`plan-desc-${p.id}`}>
                    <Textarea
                      id={`plan-desc-${p.id}`}
                      rows={3}
                      value={d.description}
                      onChange={(e) => patchDraft(p.id, { description: e.target.value })}
                    />
                  </AdminField>
                  <div className="flex flex-wrap items-end gap-4">
                    <AdminField
                      label="Cena (PLN)"
                      htmlFor={`plan-price-${p.id}`}
                      hint={priceInvalid ? "Użyj formatu 29,99" : undefined}
                      className="w-36"
                    >
                      <Input
                        id={`plan-price-${p.id}`}
                        inputMode="decimal"
                        value={d.pricePln}
                        aria-invalid={priceInvalid || undefined}
                        onChange={(e) => patchDraft(p.id, { pricePln: e.target.value })}
                      />
                    </AdminField>
                    <label className="flex h-11 cursor-pointer items-center gap-2.5 text-sm text-white/75">
                      <input
                        type="checkbox"
                        checked={d.active}
                        onChange={(e) => patchDraft(p.id, { active: e.target.checked })}
                        className="h-4 w-4 accent-[var(--gym-gold)]"
                      />
                      Dostępny w sklepie
                    </label>
                    <div className="ml-auto flex gap-2">
                      {dirty ? (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busyId === p.id}
                          onClick={() => patchDraft(p.id, toDraft(p))}
                        >
                          Cofnij
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        disabled={busyId === p.id || !dirty}
                        onClick={() => void save(p.id)}
                      >
                        {busyId === p.id ? "Zapisywanie…" : "Zapisz"}
                      </Button>
                    </div>
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
