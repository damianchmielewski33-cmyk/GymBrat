"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import {
  BRANDING_SLOT_LABELS,
  BRANDING_SLOTS,
  type BrandingSlot,
} from "@/lib/app-branding-slots";

type SlotState = {
  slot: BrandingSlot;
  label: string;
  asset: { url: string; updatedAt: number; mimeType: string } | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("read failed"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function AdminBrandingClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [slots, setSlots] = useState<SlotState[]>(
    BRANDING_SLOTS.map((slot) => ({
      slot,
      label: BRANDING_SLOT_LABELS[slot],
      asset: null,
    })),
  );
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<BrandingSlot | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/branding", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        slots?: SlotState[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.slots) {
        notifyError(data.error ?? "Nie udało się wczytać brandingu.");
        return;
      }
      setSlots(data.slots);
    } catch {
      notifyError("Nie udało się wczytać brandingu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  async function upload(slot: BrandingSlot, file: File) {
    setBusySlot(slot);
    try {
      const dataUrl = await fileToDataUrl(file);
      await ensureCsrfCookie();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ slot, dataUrl }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        notifyError(data.error ?? "Upload nieudany.");
        return;
      }
      notifySaved("Zapisano ikonę / logo.");
      await reload();
    } catch {
      notifyError("Upload nieudany.");
    } finally {
      setBusySlot(null);
    }
  }

  async function remove(slot: BrandingSlot) {
    if (!window.confirm("Usunąć ten asset i wrócić do domyślnego wyglądu?")) return;
    setBusySlot(slot);
    try {
      await ensureCsrfCookie();
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ slot, action: "delete" }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        notifyError(data.error ?? "Nie udało się usunąć.");
        return;
      }
      notifySaved("Usunięto. Wrócono do domyślnego.");
      await reload();
    } catch {
      notifyError("Nie udało się usunąć.");
    } finally {
      setBusySlot(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="app-card space-y-3 p-5">
        <h2 className="font-heading text-lg font-semibold text-white">Branding</h2>
        <p className="text-sm leading-relaxed text-white/55">
          Zmieniaj logo i ikony bez edycji kodu. Web, PWA i logo w aplikacji
          działają od razu. Ikona Androida na launcherze wchodzi przy kolejnym
          pushu na master (Actions buduje APK równolegle z deployem strony) —
          użytkownicy aktualizują aplikację z Profilu / Release.
        </p>
        <p className="text-xs text-white/40">
          Formaty: PNG, JPEG, WebP, SVG · zalecane kwadrat · max ~600&nbsp;KB na plik.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-white/45">Wczytywanie…</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {slots.map((s) => (
            <li key={s.slot} className="app-card flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  {s.asset ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.asset.url}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-white/25" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{s.label}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-white/35">{s.slot}</p>
                  {s.slot === "icon_android" ? (
                    <p className="mt-1 text-[11px] text-amber-200/70">
                      Po wgraniu: push na master (lub ręczny Actions) przebuduje
                      APK z tą ikoną.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    disabled={busySlot === s.slot}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void upload(s.slot, file);
                    }}
                  />
                  <span className="gym-btn-primary inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium">
                    <Upload className="h-4 w-4" />
                    {busySlot === s.slot ? "…" : "Wgraj"}
                  </span>
                </label>
                {s.asset ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 border-white/15"
                    disabled={busySlot === s.slot}
                    onClick={() => void remove(s.slot)}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Usuń
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
