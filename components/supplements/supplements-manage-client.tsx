"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { saveSupplementsAction } from "@/actions/fitness-goals";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { AppPageHeader } from "@/components/layout/screen";
import type { DietSupplement } from "@/lib/diet-supplements";
import { cn } from "@/lib/utils";

type Row = { key: string; name: string; amount: string };

function toRows(items: DietSupplement[]): Row[] {
  return items.map((s, i) => ({
    key: `${i}-${s.name}`,
    name: s.name,
    amount: s.amount ?? "",
  }));
}

export function SupplementsManageClient({
  initial,
}: {
  initial: DietSupplement[];
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? toRows(initial)
      : [{ key: "new-0", name: "", amount: "" }],
  );

  function patch(key: string, field: "name" | "amount", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length > 0 ? next : [{ key: `new-${Date.now()}`, name: "", amount: "" }];
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, name: "", amount: "" },
    ]);
  }

  function save() {
    start(async () => {
      const payload = rows
        .map((r) => ({
          name: r.name.trim(),
          ...(r.amount.trim() ? { amount: r.amount.trim() } : {}),
        }))
        .filter((r) => r.name.length > 0);

      const r = await saveSupplementsAction(payload);
      if (!r.ok) {
        notifyError(r.error ?? "Nie udało się zapisać.");
        return;
      }
      notifySaved("Zapisano suplementy.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center gap-2 px-0.5">
        <Link
          href="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/70 hover:bg-white/[0.06]"
          aria-label="Wróć na DZIŚ"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <AppPageHeader
        kicker="Dieta"
        title="Suplementy"
        description="Ustaw listę na dziś: nazwę i dawkę / ilość. Widać je na DZIŚ i w Planie diety."
      />

      <ul className="space-y-2.5">
        {rows.map((row, index) => (
          <li
            key={row.key}
            className="app-card space-y-3 px-3.5 py-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Suplement {index + 1}
              </p>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-rose-200"
                aria-label="Usuń"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr]">
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] text-white/45">Nazwa</span>
                <input
                  value={row.name}
                  onChange={(e) => patch(row.key, "name", e.target.value)}
                  placeholder="np. Magnez"
                  className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--gym-gold)]/45"
                />
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-[11px] text-white/45">
                  Ilość / dawka
                </span>
                <input
                  value={row.amount}
                  onChange={(e) => patch(row.key, "amount", e.target.value)}
                  placeholder="np. 400 mg"
                  className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--gym-gold)]/45"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/18 text-sm font-medium text-white/70 hover:border-white/30 hover:bg-white/[0.03]"
      >
        <Plus className="h-4 w-4" />
        Dodaj suplement
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={save}
        className={cn(
          "gold-btn inline-flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold",
          "disabled:opacity-45",
        )}
      >
        {pending ? "Zapisuję…" : "Zapisz suplementy"}
      </button>
    </div>
  );
}
