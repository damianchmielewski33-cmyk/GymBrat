"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { SUPPORT_KINDS, SUPPORT_KIND_LABELS, SUPPORT_RESPONSE_DAYS, supportDueLabel } from "@/lib/support";

export type SupportOrderOption = { id: string; label: string };

const FIELD =
  "w-full rounded-xl border border-white/12 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--gym-gold)]/60";

export function SupportForm({ orders, defaultEmail }: { orders: SupportOrderOption[]; defaultEmail: string }) {
  const [kind, setKind] = useState<string>("question");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [contactEmail, setContactEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; dueAt: string; emailSent: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/support", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getXsrfHeaders() },
        body: JSON.stringify({
          kind,
          subject,
          message,
          orderId: orderId || undefined,
          contactEmail: contactEmail.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; id?: string; dueAt?: string; emailSent?: boolean; error?: string }
        | null;
      if (!res.ok || !json?.ok || !json.id || !json.dueAt) {
        setError(json?.error ?? "Nie udało się wysłać zgłoszenia. Spróbuj ponownie.");
        return;
      }
      setDone({ id: json.id, dueAt: json.dueAt, emailSent: Boolean(json.emailSent) });
      setSubject("");
      setMessage("");
      setOrderId("");
    } catch {
      setError("Brak połączenia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" role="status">
        <p className="font-semibold">Zgłoszenie przyjęte (nr {done.id.slice(0, 8)}).</p>
        <p className="mt-1 text-emerald-100/80">
          Odpowiemy najpóźniej do {supportDueLabel(new Date(done.dueAt))} ({SUPPORT_RESPONSE_DAYS} dni).
          {done.emailSent ? " Potwierdzenie wysłaliśmy e-mailem." : ""}
        </p>
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setDone(null)}>
          Nowe zgłoszenie
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1 text-sm text-white/80">
        <span>Rodzaj zgłoszenia</span>
        <select className={FIELD} value={kind} onChange={(e) => setKind(e.target.value)}>
          {SUPPORT_KINDS.map((k) => (
            <option key={k} value={k}>
              {SUPPORT_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-sm text-white/80">
        <span>Temat</span>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} minLength={3} maxLength={120} required />
      </label>
      {orders.length > 0 ? (
        <label className="block space-y-1 text-sm text-white/80">
          <span>Dotyczy zamówienia (opcjonalnie)</span>
          <select className={FIELD} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
            <option value="">— nie dotyczy —</option>
            {orders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block space-y-1 text-sm text-white/80">
        <span>Opis</span>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} minLength={10} maxLength={4000} rows={6} required />
      </label>
      <label className="block space-y-1 text-sm text-white/80">
        <span>E-mail do odpowiedzi</span>
        <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={200} />
      </label>
      {error ? (
        <p className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Wysyłanie…" : "Wyślij zgłoszenie"}
      </Button>
    </form>
  );
}
