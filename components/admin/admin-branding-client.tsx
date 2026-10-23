"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useBranding } from "@/components/branding/branding-provider";
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

type ApkBuildResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

type BrandingMutationResponse = {
  slots?: SlotState[];
  apkBuild?: ApkBuildResult;
};

const GROUPS: { title: string; description: string; slots: BrandingSlot[] }[] = [
  {
    title: "Logo",
    description: "Nagłówek i ekran logowania w przeglądarce / WebView — działa od razu po odświeżeniu.",
    slots: ["logo_app", "logo_login"],
  },
  {
    title: "Ikony strony i PWA",
    description: "Favicon, ikona „Dodaj do ekranu” oraz ikona iOS — działają od razu.",
    slots: ["icon_web", "icon_pwa", "icon_ios"],
  },
  {
    title: "Aplikacja Android",
    description:
      "Ikona launchera w APK. Wymaga GITHUB_APK_DISPATCH_TOKEN na hostingu; po udanym buildzie pobierz nowe APK z Profilu.",
    slots: ["icon_android"],
  },
];

function feedbackForApkBuild(
  apkBuild: ApkBuildResult | undefined,
  kind: "saved" | "deleted",
): { ok: boolean; message: string } {
  const saved =
    kind === "saved" ? "Zapisano ikonę Android." : "Usunięto ikonę Android.";
  if (!apkBuild) {
    return { ok: true, message: saved };
  }
  if (apkBuild.ok && apkBuild.skipped && apkBuild.reason === "missing_token") {
    return {
      ok: false,
      message: `${saved} Przebudowa APK nie wystartowała — brak GITHUB_APK_DISPATCH_TOKEN na hostingu.`,
    };
  }
  if (!apkBuild.ok) {
    return {
      ok: false,
      message: `${saved} Przebudowa APK nie wystartowała: ${apkBuild.error}`,
    };
  }
  return {
    ok: true,
    message: `${saved} Startuje przebudowa APK (~kilka minut) — potem Profil → pobierz APK.`,
  };
}

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
  const { refresh: refreshAppBranding } = useBranding();
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
      const res = await adminRequest<BrandingMutationResponse>("/api/admin/branding", {
        method: "POST",
        body: { slot, dataUrl },
        fallbackError: "Upload nieudany — spróbuj mniejszego pliku PNG/WebP.",
      });
      if (!res.ok) {
        notifyError(res.error);
        return;
      }
      if (slot === "icon_android") {
        const fb = feedbackForApkBuild(res.data.apkBuild, "saved");
        if (fb.ok) notifySaved(fb.message);
        else notifyError(fb.message);
      } else {
        notifySaved("Zapisano grafikę — odśwież stronę, jeśli nadal widać starą.");
      }
      refreshAppBranding();
      await reload();
    } finally {
      setBusySlot(null);
    }
  }

  async function remove(slot: BrandingSlot) {
    setBusySlot(slot);
    const res = await adminRequest<BrandingMutationResponse>("/api/admin/branding", {
      method: "POST",
      body: { slot, action: "delete" },
      fallbackError: "Nie udało się usunąć.",
    });
    setBusySlot(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    if (slot === "icon_android") {
      const fb = feedbackForApkBuild(res.data.apkBuild, "deleted");
      if (fb.ok) notifySaved(fb.message);
      else notifyError(fb.message);
    } else {
      notifySaved("Usunięto. Wrócono do domyślnej grafiki.");
    }
    refreshAppBranding();
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
