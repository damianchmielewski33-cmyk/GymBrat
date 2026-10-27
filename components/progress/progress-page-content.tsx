import Link from "next/link";
import { ProgressHubView } from "@/components/progress/progress-hub-view";
import { getProgressHubData } from "@/lib/progress-hub";
import type { ProgressTabId } from "@/lib/progress-tabs";

export async function ProgressPageContent({
  userId,
  tab,
  period,
}: {
  userId: string;
  tab: ProgressTabId;
  period: "7" | "30" | "90";
}) {
  let data: Awaited<ReturnType<typeof getProgressHubData>>;
  try {
    data = await getProgressHubData(userId);
  } catch (e) {
    console.error(
      "[progress-hub]",
      e instanceof Error ? e.message : e,
    );
    return (
      <div className="app-panel space-y-4 px-4 py-5 text-center">
        <p className="text-[15px] font-semibold text-white">
          Nie udało się wczytać analizy
        </p>
        <p className="text-[13px] leading-snug text-white/55">
          Chwilowy problem z bazą lub hostingu. Odśwież stronę za chwilę —
          treningi i zdjęcia są bezpieczne.
        </p>
        <Link
          href={`/progress?tab=${encodeURIComponent(tab)}`}
          className="gym-btn-primary inline-flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold"
        >
          Odśwież analizę
        </Link>
      </div>
    );
  }

  return <ProgressHubView data={data} initialTab={tab} initialPeriod={period} />;
}
