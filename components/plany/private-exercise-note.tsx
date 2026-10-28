"use client";

import { useState, useTransition } from "react";
import { Link2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  getUserExerciseNote,
  saveUserExerciseNote,
  type UserExerciseNoteDTO,
} from "@/actions/user-exercise-notes";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { InlineBanner } from "@/components/ui/inline-banner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PrivateExerciseNote({
  exerciseId,
  initial,
}: {
  exerciseId: string;
  initial: UserExerciseNoteDTO | null;
}) {
  const [note, setNote] = useState(initial);
  const [expanded, setExpanded] = useState(Boolean(initial?.note || initial?.personalYoutubeUrl));
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(initial?.personalYoutubeUrl ?? "");
  const [text, setText] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pending, start] = useTransition();

  const filled = Boolean(note?.note || note?.personalYoutubeUrl);

  function startEdit() {
    setUrl(note?.personalYoutubeUrl ?? "");
    setText(note?.note ?? "");
    setEditing(true);
    setExpanded(true);
    setError(null);
  }

  function onSave() {
    start(async () => {
      setError(null);
      const res = await saveUserExerciseNote({
        exerciseId,
        personalYoutubeUrl: url.trim() || null,
        note: text.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNote(
        res.note.note || res.note.personalYoutubeUrl ? res.note : null,
      );
      setEditing(false);
    });
  }

  function onClear() {
    start(async () => {
      setError(null);
      const res = await saveUserExerciseNote({
        exerciseId,
        personalYoutubeUrl: null,
        note: null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNote(null);
      setUrl("");
      setText("");
      setEditing(false);
      setConfirmClear(false);
      setExpanded(false);
    });
  }

  return (
    <section className="rounded-[22px] border border-dashed border-[rgba(235,196,74,0.4)] bg-[rgba(235,196,74,0.03)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
            Tylko dla Ciebie
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-3 text-[12px]"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Zwiń" : "Rozwiń"}
        </Button>
      </div>
      <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">
        Twój link i notatka. Nikt inny ich nie zobaczy.
      </p>

      {!expanded ? null : !filled && !editing ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-11 w-full gap-2"
          onClick={startEdit}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Dodaj swój link lub notatkę
        </Button>
      ) : editing ? (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-[12px] text-[var(--gym-text-secondary)]">
              Link wideo (opcjonalnie)
            </label>
            <Input
              className="mt-1 h-12"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value.slice(0, 500))}
            />
            <p className="mt-1 text-[12px] text-[var(--gym-text-secondary)]">
              Dowolny adres, np. z YouTube. Widoczny tylko dla Ciebie.
            </p>
          </div>
          <div>
            <label className="text-[12px] text-[var(--gym-text-secondary)]">
              Notatka (opcjonalnie)
            </label>
            <Textarea
              className="mt-1 min-h-24"
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
            />
            <p className="mt-1 flex justify-between text-[12px] text-[var(--gym-text-secondary)]">
              <span>
                Nie wpisuj danych medycznych (np. kontuzji). Notatka jest widoczna
                tylko dla Ciebie.
              </span>
              <span className="tabular-nums shrink-0">
                {text.length >= 280
                  ? `zostało ${300 - text.length}`
                  : `${text.length}/300`}
              </span>
            </p>
          </div>
          {error ? (
            <InlineBanner variant="error">{error}</InlineBanner>
          ) : null}
          <Button
            type="button"
            variant="cta"
            className="h-12 w-full"
            disabled={pending}
            onClick={onSave}
          >
            Zapisz
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full"
            onClick={() => {
              setEditing(false);
              if (!filled) setExpanded(false);
            }}
          >
            Anuluj
          </Button>
          {filled ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-rose-300"
              onClick={() => setConfirmClear(true)}
            >
              Usuń swój link i notatkę
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {note?.personalYoutubeUrl ? (
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[var(--gym-gold)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-white">
                  {(() => {
                    try {
                      return new URL(note.personalYoutubeUrl!).hostname;
                    } catch {
                      return "Twój link";
                    }
                  })()}
                </p>
                <p className="text-[11px] text-[var(--gym-text-secondary)]">
                  Twój link
                </p>
              </div>
              <a
                href={note.personalYoutubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-2xl border border-[var(--gym-border-gold)] px-3 text-[13px] font-semibold text-white"
              >
                Otwórz
              </a>
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-11 px-0"
                aria-label="Edytuj link"
                onClick={startEdit}
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          ) : null}
          {note?.note ? (
            <div>
              <p className="whitespace-pre-wrap text-[14px] leading-5 text-white">
                {note.note}
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-1 h-11 px-0 text-[12px]"
                onClick={startEdit}
              >
                Edytuj notatkę
              </Button>
            </div>
          ) : null}
          {!note?.personalYoutubeUrl && !note?.note ? null : (
            <Button
              type="button"
              variant="ghost"
              className="h-11 gap-2 px-0 text-rose-300"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Usuń
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        onConfirm={onClear}
        pending={pending}
        title="Usunąć swój link i notatkę?"
        description="Zniknie tylko z tej karty. Plan i historia się nie zmieniają."
        confirmLabel="Usuń"
      />
    </section>
  );
}

/** Prefetch helper — unused export kept for RSC pages. */
export async function loadPrivateNote(exerciseId: string) {
  return getUserExerciseNote(exerciseId);
}
