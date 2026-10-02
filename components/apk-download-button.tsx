"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { requestNativeAndroidUpdate } from "@/lib/app-webview";
import { cn } from "@/lib/utils";

type Props = {
  versionName: string;
  versionCode: number;
  className?: string;
  label?: string;
};

/**
 * Chrome Android często „wisi” na klasycznym downloadzie APK.
 * Tu: pobieramy w JS (widać %), potem Share / zapis pliku — omija DownloadManager Chrome.
 * W aplikacji natywnej → most checkUpdate().
 */
export function ApkDownloadButton({
  versionName,
  versionCode,
  className,
  label,
}: Props) {
  const [phase, setPhase] = useState<"idle" | "fetching" | "sharing" | "done" | "error">(
    "idle",
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const safeName =
    /^[0-9A-Za-z._-]+$/.test(versionName.trim()) ? versionName.trim() : "download";
  const fileName = `gymbrat-${safeName}.apk`;
  const apkPath = `/gymbrat-${safeName}.apk?v=${versionCode}`;

  async function start() {
    setError(null);
    if (requestNativeAndroidUpdate()) {
      setPhase("done");
      return;
    }

    setPhase("fetching");
    setProgress(0);
    try {
      const res = await fetch(apkPath, {
        cache: "no-store",
        headers: { Accept: "application/vnd.android.package-archive,*/*" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const total = Number(res.headers.get("content-length") || 0);
      if (!res.body) {
        throw new Error("Brak treści APK");
      }

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            setProgress(Math.min(99, Math.round((received / total) * 100)));
          }
        }
      }

      // TS DOM: Uint8Array<ArrayBufferLike> vs BlobPart (ArrayBuffer) — cast bezpieczny w runtime.
      const blob = new Blob(chunks as BlobPart[], {
        type: "application/vnd.android.package-archive",
      });
      if (blob.size < 50_000) {
        throw new Error("Plik APK wygląda na uszkodzony");
      }
      setProgress(100);

      const file = new File([blob], fileName, {
        type: "application/vnd.android.package-archive",
      });

      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        setPhase("sharing");
        await nav.share({
          files: [file],
          title: `GymBrat ${safeName}`,
          text: "Zapisz APK albo otwórz instalator.",
        });
        setPhase("done");
        return;
      }

      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(
        e instanceof Error
          ? e.message
          : "Nie udało się pobrać APK. Spróbuj ponownie albo użyj innego przeglądarki.",
      );
    }
  }

  const busy = phase === "fetching" || phase === "sharing";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className={cn(
          "gym-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold sm:w-auto disabled:opacity-60",
          className,
        )}
      >
        <Download className="h-4 w-4" aria-hidden />
        {phase === "fetching"
          ? `Pobieranie… ${progress}%`
          : phase === "sharing"
            ? "Wybierz zapis / instalator…"
            : (label ?? `Pobierz Android ${safeName}`)}
      </button>

      {phase === "fetching" ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--gym-gold)] transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}

      {phase === "done" ? (
        <p className="text-xs text-emerald-300/90">
          Gotowe — w udostępnianiu wybierz „Zapisz w plikach” albo instalator. Potem
          otwórz zapisany APK.
        </p>
      ) : null}

      {error ? <p className="text-xs text-rose-300/90">{error}</p> : null}

      <p className="text-[11px] leading-relaxed text-white/40">
        Awaryjnie (inna przeglądarka / PC):{" "}
        <a
          href={apkPath}
          className="text-[var(--gym-gold)] underline-offset-2 hover:underline"
        >
          {fileName}
        </a>
      </p>
    </div>
  );
}
