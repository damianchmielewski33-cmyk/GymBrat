import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, FileUp, Pencil } from "lucide-react";
import { auth } from "@/auth";
import { AppPageHeader } from "@/components/layout/screen";

type PageProps = {
  searchParams?: Promise<{ tryb?: string }>;
};

export default async function NowyPlanPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await (searchParams ?? Promise.resolve({} as { tryb?: string }));
  if (params.tryb === "zero") {
    redirect("/plany/nowy/edytor");
  }

  return (
    <div className="px-1 pb-24 pt-1 sm:px-0">
      <div className="mb-1 flex items-center gap-1">
        <Link
          href="/plany"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white"
          aria-label="Wróć do listy planów"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
      </div>
      <AppPageHeader
        kicker="Nowy plan"
        title="Jak zacząć?"
        description="Plan możesz potem zmienić w każdej chwili."
      />
      <div className="mt-5 flex flex-col gap-3">
        <Link href="/plany/nowy/edytor" className="app-card flex min-h-24 items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]">
            <Pencil className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-white">Od zera</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--gym-text-secondary)]">
              Nazwij plan i dodaj ćwiczenia z atlasu. Zaczynasz z pustą listą.
            </p>
          </div>
        </Link>
        <Link href="/plany/import" className="app-card flex min-h-24 items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] text-[var(--gym-gold)]">
            <FileUp className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-white">Z pliku</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--gym-text-secondary)]">
              PDF, Word albo Excel. Sprawdzisz wynik przed zapisem.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
