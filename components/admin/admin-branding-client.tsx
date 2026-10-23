"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { adminRequest } from "@/lib/admin-client";
import { prepareBrandingUploadDataUrl } from "@/lib/branding-upload-client";
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

const GROUPS: { title: string; description: string; slots: BrandingSlot[] }[] = [
  {
    title: "Logo",
    description: "Działa od razu po zapisaniu.",
    slots: ["logo_app", "logo_login"],
  },
  {
    title: "Ikony strony i PWA",
    description: "Favicon, ikona „Dodaj do ekranu” oraz ikona iOS — działają od razu.",
    slots: ["icon_web", "icon_pwa", "icon_ios"],
  },
  {
    title: "Aplikacja Android",
    description: "Zmiana uruchamia przebudowę APK (kilka minut) — potem Profil → pobierz APK.",
    slots: ["icon_android"],
  },
];

const initialSlots = (): SlotState[] =>
  BRANDING_SLOTS.map((slot) => ({
    slot,
    label: BRANDING_SLOT_LABELS[slot],
    asset: null,
  }));

function formatUpdated(ts: number): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pl-PL", { dateStyle: "medium" });
}

export function AdminBrandingClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [slots, setSlots] = useState<SlotState[]>(initialSlots);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<BrandingSlot | null>(null);
  const [removeSlot, setRemoveSlot] = useState<SlotState | null>(null);

  const reload = useCallback(async () => {
    const res = await adminRequest<{ slots?: SlotState[] }>("/api/admin/branding", {
      fallbackError: "Nie udało się wczytać brandingu.",
    });
    if (res.ok && res.data.slots) setSlots(res.data.slots);
    else notifyError(res.ok ? "Nie udało się wczytać brandingu." : res.error);
    setLoading(false);
  }, [notifyError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function upload(slot: BrandingSlot, file: File) {
    setBusySlot(slot);
    try {
      let dataUrl: string;
      try {
        dataUrl = await prepareBrandingUploadDataUrl(file);
      } catch (e) {
        notifyError(e instanceof Error ? e.message : "Nie udało się przygotować pliku.");
        return;
      }
      const res = await adminRequest("/api/admin/branding", {
        method: "POST",
        body: { slot, dataUrl },
        fallbackError: "Upload nieudany — spróbuj mniejszego pliku PNG/WebP.",
      });
      if (!res.ok) {
        notifyError(res.error);
        return;
      }
      notifySaved(
        slot === "icon_android"
          ? "Zapisano ikonę Android — startuje przebudowa APK (~kilka minut)."
          : "Zapisano grafikę.",
      );
      await reload();
    } finally {
      setBusySlot(null);
    }
  }

  async function remove(slot: BrandingSlot) {
    setBusySlot(slot);
    const res = await adminRequest("/api/admin/branding", {
      method: "POST",
      body: { slot, action: "delete" },
      fallbackError: "Nie udało się usunąć.",
    });
    setBusySlot(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved(
      slot === "icon_android"
        ? "Usunięto ikonę Android — startuje przebudowa APK z domyślną ikoną."
        : "Usunięto. Wrócono do domyślnej grafiki.",
    );
    await reload();
  }

  const bySlot = new Map(slots.map((s) => [s.slot, s]));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<ImageIcon />}
        title="Branding"
        description="Zmieniaj logo i ikony bez edycji kodu. Formaty: PNG, JPEG, WebP, SVG · zalecany kwadrat · duże pliki są automatycznie zmniejszane (maks. 1024 px)."
      />

      {loading ? (
        <AdminLoading label="Wczytywanie brandingu…" />
      ) : (
        GROUPS.map((group) => (
          <AdminCard key={group.title} title={group.title} description={group.description}>
            {group.slots.includes("icon_android") ? (
              <AdminNotice tone="warn" className="mb-4">
                Wgraj kwadrat bez białej ramki — build sam obcina przezroczyste i białe marginesy
                oraz wypełnia cały kafelek launchera.
              </AdminNotice>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.slots.map((slotId) => {
                const s = bySlot.get(slotId);
                if (!s) return null;
                const busy = busySlot === s.slot;
                return (
                  <li
                    key={s.slot}
                    className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[repeating-conic-gradient(rgba(255,255,255,0.06)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                        {s.asset ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.asset.url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-white/25" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-white">{s.label}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <AdminPill tone={s.asset ? "ok" : "neutral"}>
                            {s.asset ? "Własna" : "Domyślna"}
                          </AdminPill>
                          {s.asset ? (
                            <span className="text-[11px] text-white/40">
                              {formatUpdated(s.asset.updatedAt)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={`inline-flex ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}`}
                      >
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
                          className="sr-only"
                          disabled={busy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void upload(s.slot, file);
                          }}
                        />
                        <span className="gym-btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold">
                          <Upload className="h-4 w-4" aria-hidden />
                          {busy ? "Wgrywanie…" : s.asset ? "Zmień" : "Wgraj"}
                        </span>
                      </label>
                      {s.asset ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setRemoveSlot(s)}
                        >
                          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                          Przywróć domyślną
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </AdminCard>
        ))
      )}

      <ConfirmDialog
        open={removeSlot !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveSlot(null);
        }}
        onConfirm={() => {
          if (removeSlot) void remove(removeSlot.slot);
        }}
        title="Przywrócić domyślną grafikę?"
        description={
          removeSlot
            ? `Własna grafika „${removeSlot.label}” zostanie usunięta.`
            : undefined
        }
        confirmLabel="Przywróć domyślną"
      />
    </div>
  );
}
