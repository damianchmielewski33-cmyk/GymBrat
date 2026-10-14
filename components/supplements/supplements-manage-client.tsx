"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Percent, Plus, Trash2 } from "lucide-react";
import { saveSupplementsAction } from "@/actions/fitness-goals";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { SectionLabel } from "@/components/ui/section-label";
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

/** Oddziela np. „2 · 2×/dzień” → ilość + podtytuł częstotliwości. */
function splitAmount(amount: string): { qty: string; note: string | null } {
  const raw = amount.trim();
  if (!raw) return { qty: "", note: null };
  const sep = raw.includes(" · ")
    ? " · "
    : raw.includes(" | ")
      ? " | "
      : raw.includes("\n")
        ? "\n"
        : null;
  if (!sep) return { qty: raw, note: null };
  const [qty, ...rest] = raw.split(sep);
  const note = rest.join(sep).trim();
  return { qty: (qty ?? "").trim(), note: note || null };
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editingKey) return;
    const id = window.setTimeout(() => amountInputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [editingKey]);

  function patch(key: string, field: "name" | "amount", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length > 0
        ? next
        : [{ key: `new-${Date.now()}`, name: "", amount: "" }];
    });
    if (editingKey === key) setEditingKey(null);
  }

  function addRow() {
    const key = `new-${Date.now()}`;
    setRows((prev) => [...prev, { key, name: "", amount: "" }]);
    setEditingKey(key);
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
      setEditingKey(null);
      router.refresh();
    });
  }

  const namedCount = rows.filter((r) => r.name.trim()).length;

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-2 px-0.5">
        <Link
          href="/"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/70 hover:bg-white/[0.06]"
          aria-label="Wróć na DZIŚ"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <header className="px-0.5">
        <h1 className="text-[28px] font-semibold leading-none tracking-tight text-white">
          Suplementy
        </h1>
        <p className="mt-2 max-w-md text-[13px] leading-snug text-white/50">
          „Zmień dawkę” ustawia ilość przy produkcie. Lista widać na DZIŚ i w
          Planie diety.
        </p>
      </header>

      <SectionLabel
        index={1}
        title="Codziennie"
        trailing={String(namedCount || rows.length)}
      />

      <ul className="overflow-hidden rounded-[18px] border border-white/[0.07] bg-[#141414] divide-y divide-white/[0.06]">
        {rows.map((row) => {
          const editing = editingKey === row.key;
          const { qty, note } = splitAmount(row.amount);
          const displayName = row.name.trim() || "Nowy suplement";
          const displayQty = qty || "—";

          return (
            <li key={row.key} className="px-3.5 py-3.5">
              {editing ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                      Edycja dawki
                    </p>
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-rose-200"
                      aria-label="Usuń"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-[1.35fr_1fr]">
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-white/45">
                        Nazwa
                      </span>
                      <input
                        value={row.name}
                        onChange={(e) =>
                          patch(row.key, "name", e.target.value)
                        }
                        placeholder="np. Magnez"
                        className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--gym-gold)]/45"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-1 block text-[11px] text-white/45">
                        Ilość / dawka
                      </span>
                      <input
                        ref={editing ? amountInputRef : undefined}
                        value={row.amount}
                        onChange={(e) =>
                          patch(row.key, "amount", e.target.value)
                        }
                        placeholder="np. 2 · 2×/dzień"
                        className="h-11 w-full rounded-xl border border-white/12 bg-black/40 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--gym-gold)]/45"
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white/14 text-[13px] font-semibold text-white/70"
                    >
                      Gotowe
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={save}
                      className="gold-btn inline-flex h-10 flex-1 items-center justify-center rounded-full text-[13px] font-semibold disabled:opacity-45"
                    >
                      {pending ? "Zapis…" : "Zapisz"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-[15px] font-semibold text-white">
                      {displayName}
                    </p>
                    {note ? (
                      <p className="mt-0.5 text-[12px] text-white/40">{note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <p
                      className={cn(
                        "text-[13px] font-semibold uppercase leading-none tracking-[0.04em] tabular-nums",
                        qty
                          ? "text-[var(--gym-gold)]"
                          : "text-white/30",
                      )}
                    >
                      {displayQty}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingKey(row.key)}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--gym-gold)]/55 px-3 text-[12px] font-semibold text-[var(--gym-gold)] transition hover:bg-[var(--gym-gold)]/10"
                    >
                      zmień dawkę
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/18 text-sm font-medium text-white/70 hover:border-white/30 hover:bg-white/[0.03]"
      >
        <Plus className="h-4 w-4" />
        Dodaj suplement
      </button>

      {editingKey == null ? (
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
      ) : null}

      <div className="pt-1 text-center">
        <Link
          href="/promo-codes"
          className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-gold)]"
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--gym-gold)]/50">
            <Percent className="h-3 w-3" aria-hidden />
          </span>
          Wszystkie kody teamu
        </Link>
      </div>
    </div>
  );
}
