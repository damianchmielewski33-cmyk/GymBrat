import { redirect } from "next/navigation";
import { parseProgressTab } from "@/lib/progress-tabs";

/** Legacy route — hub Postępy lives at `/progress`. */
export default async function ProgressAnalysisRedirect({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tab?: string | string[] }>;
}) {
  const sp = await searchParams;
  const qRaw = sp?.q;
  const q = Array.isArray(qRaw) ? qRaw[0] : qRaw;

  if (q?.trim()) {
    redirect(`/progress/exercises/${encodeURIComponent(q.trim())}`);
  }

  const tabRaw = sp?.tab;
  const tab = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  if (tab) {
    // Stare nazwy zakładek (np. „zdjecia”) są mapowane przez parseProgressTab.
    redirect(`/progress?tab=${parseProgressTab(tab)}`);
  }

  redirect("/progress");
}
