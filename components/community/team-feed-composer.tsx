"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import {
  createTeamFeedPostAction,
  type TeamFeedActionState,
} from "@/actions/team-feed";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { screenInputClass } from "@/components/layout/screen";
import { fileToCompressedImageDataUrl } from "@/lib/client-image-data-url";
import type { MentionCandidate } from "@/lib/community/feed-mentions";
import { cn } from "@/lib/utils";

type DraftImage = { mimeType: string; dataUrl: string };

export function TeamFeedComposer({
  teamId,
  mentionCandidates,
}: {
  teamId: string;
  mentionCandidates: MentionCandidate[];
}) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [state, formAction, pending] = useActionState(
    createTeamFeedPostAction,
    {} as TeamFeedActionState,
  );
  const [body, setBody] = useState("");
  const [images, setImages] = useState<DraftImage[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) notifyError(state.error);
    if (state.ok) {
      notifySaved("Opublikowano");
      setBody("");
      setImages([]);
      formRef.current?.reset();
    }
  }, [state, notifyError, notifySaved]);

  const filteredMentions = (() => {
    const at = body.match(/@([A-Za-zÀ-ž0-9_]*)$/);
    if (!at) return [];
    const q = at[1]!.toLowerCase();
    return mentionCandidates
      .filter(
        (c) =>
          c.handle.toLowerCase().startsWith(q) ||
          c.displayName.toLowerCase().includes(q),
      )
      .slice(0, 6);
  })();

  useEffect(() => {
    setMentionOpen(filteredMentions.length > 0);
  }, [filteredMentions.length]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const next = [...images];
    for (const file of Array.from(files).slice(0, 6 - next.length)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await fileToCompressedImageDataUrl(file);
        next.push({ mimeType: "image/jpeg", dataUrl });
      } catch {
        notifyError("Nie udało się dodać zdjęcia.");
      }
    }
    setImages(next);
  }

  function insertMention(candidate: MentionCandidate) {
    setBody((prev) => prev.replace(/@([A-Za-zÀ-ž0-9_]*)$/, `@${candidate.handle} `));
    setMentionOpen(false);
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="app-card space-y-3 p-4"
    >
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="imagesJson" value={JSON.stringify(images)} />
      <div className="relative">
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Napisz do grupy… Użyj @ aby oznaczyć"
          rows={3}
          maxLength={2000}
          className={cn(screenInputClass, "min-h-[88px] text-base sm:text-sm")}
        />
        {mentionOpen ? (
          <div className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-xl border border-white/10 bg-[#121214] shadow-xl">
            {filteredMentions.map((c) => (
              <button
                key={c.userId}
                type="button"
                className="flex min-h-11 w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-white/[0.05]"
                onClick={() => insertMention(c)}
              >
                <span className="text-white">{c.displayName}</span>
                <span className="text-[12px] text-white/40">@{c.handle}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt=""
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                className="absolute top-1 right-1 rounded-full bg-black/70 p-1 text-white"
                onClick={() =>
                  setImages((prev) => prev.filter((_, idx) => idx !== i))
                }
                aria-label="Usuń zdjęcie"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={images.length >= 6 || pending}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" aria-hidden />
          Zdjęcia
        </Button>
        <Button
          type="submit"
          className="min-h-11 w-full sm:ml-auto sm:w-auto"
          disabled={pending}
        >
          {pending ? "Publikacja…" : "Opublikuj"}
        </Button>
      </div>
    </form>
  );
}
