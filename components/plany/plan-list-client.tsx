"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Copy,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { WorkoutPlanListItemDTO } from "@/actions/workout-plan";
import {
  deleteWorkoutPlan,
  reorderWorkoutPlans,
  saveWorkoutPlan,
} from "@/actions/workout-plan";
import { AppPageHeader } from "@/components/layout/screen";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MuscleGlyph } from "@/components/treningi/muscle-glyph";
import type { PlanDayMuscleSummary } from "@/lib/plan-day-muscles";
import { cn } from "@/lib/utils";

export type PlanListItemView = WorkoutPlanListItemDTO & {
  muscles: PlanDayMuscleSummary | null;
  setsTotal: number;
};

function formatPlanMeta(updatedAt: string): string {
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}`;
}

export function PlanListClient({
  initialPlans,
  exerciseCount,
  corruptCount = 0,
}: {
  initialPlans: PlanListItemView[];
  exerciseCount: number;
  corruptCount?: number;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [menuPlanId, setMenuPlanId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const menuPlan = useMemo(
    () => plans.find((p) => p.id === menuPlanId) ?? null,
    [plans, menuPlanId],
  );

  function persistOrder(next: PlanListItemView[], previous: PlanListItemView[]) {
    startTransition(async () => {
      const res = await reorderWorkoutPlans(next.map((p) => p.id));
      if (!res.ok) {
        setPlans(previous);
        setError(res.error);
        return;
      }
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      setSavedAt(`${hh}:${mm}`);
      setError(null);
      router.refresh();
    });
  }

  function movePlan(id: string, dir: -1 | 1) {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const nextIdx = idx + dir;
      if (idx < 0 || nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const [row] = next.splice(idx, 1);
      next.splice(nextIdx, 0, row!);
      persistOrder(next, prev);
      return next;
    });
  }

  function onDelete() {
    if (!deleteId) return;
    startTransition(async () => {
      const res = await deleteWorkoutPlan(deleteId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlans((prev) => prev.filter((p) => p.id !== deleteId));
      setDeleteId(null);
      setMenuPlanId(null);
      router.refresh();
    });
  }

  function onDuplicate(plan: PlanListItemView) {
    startTransition(async () => {
      const copy = {
        ...plan.plan,
        planName: `${plan.plan.planName} (kopia)`.slice(0, 80),
      };
      const res = await saveWorkoutPlan(copy);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMenuPlanId(null);
      router.push(`/plany/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="px-1 pb-24 pt-1 sm:px-0">
      <AppPageHeader
        kicker="Trening"
        title="Plany treningowe"
        description="Kolejność tutaj = kolejność w Treningach."
      />

      {corruptCount > 0 ? (
        <InlineBanner variant="info" className="mt-4">
          Część planów nie mogła zostać wczytana. Pozostałe są dostępne.
        </InlineBanner>
      ) : null}
      {error ? (
        <InlineBanner variant="error" className="mt-4">
          {error}
        </InlineBanner>
      ) : null}

      <Link
        href="/plany/nowy"
        className={cn(buttonVariants({ variant: "cta" }), "mt-5 w-full gap-2")}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nowy plan
      </Link>

      {plans.length === 0 ? (
        <div className="app-card mt-6 border border-white/10 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]">
            <ListChecks className="h-6 w-6" aria-hidden />
          </div>
          <h2 className="mt-4 text-[15px] font-semibold text-white">
            Nie masz jeszcze planu
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--gym-text-secondary)]">
            Plan to jeden dzień treningowy, np. „Push A”. Dodasz go z ćwiczeniami z
            atlasu.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/plany/nowy?tryb=zero"
              className={cn(buttonVariants({ variant: "cta" }), "w-full")}
            >
              Utwórz pierwszy plan
            </Link>
            <Link
              href="/plany/import"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              Importuj z pliku
            </Link>
          </div>
        </div>
      ) : (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
              <span className="mr-2 text-[var(--gym-gold)]">01</span>
              Twoje plany · {plans.length}
            </h2>
            {plans.length > 1 ? (
              <Button
                type="button"
                variant={reorderMode ? "cta" : "ghost"}
                className="h-11 px-3 text-[12px]"
                onClick={() => {
                  setReorderMode((v) => !v);
                  setMenuPlanId(null);
                }}
              >
                {reorderMode ? "Gotowe" : "Zmień kolejność"}
              </Button>
            ) : null}
          </div>
          {reorderMode && savedAt ? (
            <p className="mb-2 text-[12px] text-[var(--gym-success)]" role="status">
              Zapisano {savedAt}
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {plans.map((item, index) => {
              const isDraft = item.plan.exercises.length === 0;
              return (
                <li key={item.id} className="app-card p-0">
                  <div className="flex items-start gap-1 p-2 pl-4">
                    {reorderMode ? (
                      <div className="min-w-0 flex-1 py-2">
                        <p className="truncate text-[15px] font-semibold text-white">
                          {item.plan.planName || "Bez nazwy"}
                        </p>
                        <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">
                          Dzień {index + 1}
                        </p>
                      </div>
                    ) : (
                      <Link
                        href={`/plany/${item.id}`}
                        className="min-w-0 flex-1 py-2"
                        aria-label={`${item.plan.planName}, ${item.plan.exercises.length} ćwiczeń, ${item.setsTotal} serii`}
                      >
                        <p className="truncate text-[15px] font-semibold text-white">
                          {item.plan.planName || "Bez nazwy"}
                        </p>
                        {isDraft ? (
                          <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">
                            Brak ćwiczeń. Dodaj co najmniej jedno, aby plan był w
                            Treningach.
                          </p>
                        ) : (
                          <p className="mt-1 text-[12px] tabular-nums text-[var(--gym-text-secondary)]">
                            {item.plan.exercises.length} ćwiczeń · {item.setsTotal}{" "}
                            serii · zmiana {formatPlanMeta(item.updatedAt)}
                          </p>
                        )}
                        <div className="mt-2.5 flex items-center gap-2">
                          <MuscleGlyph summary={item.muscles} size="row" />
                          <span className="truncate text-[12px] text-white/75">
                            {item.muscles?.labels.join(", ") ?? ""}
                          </span>
                        </div>
                      </Link>
                    )}
                    {reorderMode ? (
                      <div className="flex shrink-0 flex-col gap-1 pr-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-11 px-0"
                          disabled={index === 0 || pending}
                          aria-label={`Przesuń ${item.plan.planName} w górę`}
                          aria-disabled={index === 0}
                          onClick={() => movePlan(item.id, -1)}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-11 px-0"
                          disabled={index >= plans.length - 1 || pending}
                          aria-label={`Przesuń ${item.plan.planName} w dół`}
                          aria-disabled={index >= plans.length - 1}
                          onClick={() => movePlan(item.id, 1)}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-11 w-11 shrink-0 px-0"
                        aria-label={`Akcje planu ${item.plan.planName}`}
                        aria-haspopup="menu"
                        onClick={() => setMenuPlanId(item.id)}
                      >
                        <MoreVertical className="h-5 w-5" aria-hidden />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          <span className="mr-2 text-[var(--gym-gold)]">02</span>
          Ćwiczenia
        </h2>
        <Link
          href="/plany/atlas"
          className="app-card flex items-center gap-3 p-4"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] text-[var(--gym-gold)]">
            <BookOpen className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white">Atlas ćwiczeń</p>
            <p className="text-[12px] text-[var(--gym-text-secondary)]">
              {exerciseCount} ćwiczeń w 14 partiach
            </p>
          </div>
        </Link>
      </section>

      <Sheet open={!!menuPlan} onOpenChange={(o) => !o && setMenuPlanId(null)}>
        <SheetContent side="bottom" className="rounded-t-[22px] border-white/10">
          <SheetHeader>
            <SheetTitle className="text-white">
              {menuPlan?.plan.planName ?? "Plan"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-2 pb-4">
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start gap-2"
              onClick={() => menuPlan && router.push(`/plany/${menuPlan.id}`)}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edytuj plan
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start gap-2"
              disabled={pending}
              onClick={() => menuPlan && onDuplicate(menuPlan)}
            >
              <Copy className="h-4 w-4" aria-hidden />
              Duplikuj
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start gap-2 border-rose-400/40 text-rose-300"
              onClick={() => {
                if (menuPlan) setDeleteId(menuPlan.id);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Usuń plan
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        onConfirm={onDelete}
        pending={pending}
        title={`Usunąć plan „${menuPlan?.plan.planName ?? ""}”?`}
        description="Plan zniknie z listy i z Treningów. Historia zakończonych treningów zostaje."
        confirmLabel="Usuń plan"
      />
    </div>
  );
}
