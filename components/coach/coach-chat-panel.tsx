"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { coachChatAction } from "@/actions/coach-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle } from "lucide-react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };

const introOn = {
  role: "assistant" as const,
  content:
    "Cześć — jestem trenerem GymBrat. Zapytaj o trening, regenerację lub makra (krótko, po polsku).",
};

const introOff = {
  role: "assistant" as const,
  content: "Funkcje AI są wyłączone w profilu — czat z modelem jest niedostępny.",
};

export function CoachChatPanel({ modelEnabled = true }: { modelEnabled?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>(() => (modelEnabled ? [introOn] : [introOff]));
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(modelEnabled ? [introOn] : [introOff]);
    setInput("");
  }, [modelEnabled]);

  function send() {
    if (!modelEnabled) return;
    const t = input.trim();
    if (!t || pending) return;
    const nextUser: Msg = { role: "user", content: t };
    const thread = [...messages, nextUser];
    setMessages(thread);
    setInput("");
    start(async () => {
      const r = await coachChatAction({
        messages: thread.map((m) => ({ role: m.role, content: m.content })),
      });
      if (r.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: r.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: r.error ?? "Błąd połączenia." },
        ]);
      }
      queueMicrotask(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    });
  }

  return (
    <div className="glass-panel neon-glow relative flex max-h-[min(520px,70vh)] flex-col overflow-hidden p-5">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(560px_240px_at_50%_100%,rgba(255,45,85,0.14),transparent_60%)]" />
      <div className="relative mb-3 flex items-center gap-2 border-b border-white/10 pb-3">
        <MessageCircle className="h-5 w-5 text-[var(--neon)]" aria-hidden />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
            AI
          </p>
          <p className="font-heading text-lg font-semibold text-white">Coach czat</p>
        </div>
      </div>
      {!modelEnabled ? (
        <p className="relative text-sm text-white/55">
          <Link href="/profile" className="font-medium text-[var(--neon)] underline-offset-4 hover:underline">
            Otwórz profil
          </Link>{" "}
          i odznacz „Wyłącz wszystkie funkcje AI”, aby włączyć model (jeśli dostawca jest skonfigurowany).
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={
              m.role === "user"
                ? "ml-6 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-white/90"
                : "mr-6 rounded-2xl border border-[var(--neon)]/25 bg-black/35 px-3 py-2 text-white/80"
            }
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="relative mt-3 flex gap-2 border-t border-white/10 pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Np. Jak rozłożyć białko na redukcji?"
          disabled={!modelEnabled}
          className="min-h-[44px] resize-none border-white/12 bg-white/[0.05] text-white placeholder:text-white/35 disabled:cursor-not-allowed disabled:opacity-45"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          type="button"
          disabled={pending || !input.trim() || !modelEnabled}
          className="h-11 shrink-0 self-end bg-[var(--neon)] px-4 text-white hover:bg-[#ff4d6d]"
          onClick={send}
        >
          {pending ? "…" : "Wyślij"}
        </Button>
      </div>
    </div>
  );
}
