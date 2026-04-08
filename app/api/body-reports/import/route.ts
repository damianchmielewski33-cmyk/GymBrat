import { auth } from "@/auth";
import { importBodyReports } from "@/lib/body-reports";
import { parseBodyReportsFromXlsx } from "@/lib/excel/body-report-import";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function readBufferFromUrl(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać pliku (HTTP ${res.status}).`);
  }
  return await res.arrayBuffer();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Brak autoryzacji" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nieprawidłowe dane formularza" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const url = String(form.get("url") ?? "").trim();

  let buf: ArrayBuffer | null = null;
  if (file instanceof File) {
    buf = await file.arrayBuffer();
  } else if (url) {
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Link musi zaczynać się od http(s). Ścieżka lokalna typu C:\\... nie zadziała w przeglądarce — użyj uploadu pliku.",
        },
        { status: 400 },
      );
    }
    try {
      buf = await readBufferFromUrl(url);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Nie udało się pobrać pliku." },
        { status: 400 },
      );
    }
  }

  if (!buf) {
    return NextResponse.json(
      { ok: false, error: "Dodaj plik .xlsx albo podaj link do pliku." },
      { status: 400 },
    );
  }

  let parsed: ReturnType<typeof parseBodyReportsFromXlsx>;
  try {
    parsed = parseBodyReportsFromXlsx(buf);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Nie udało się odczytać pliku Excel." },
      { status: 400 },
    );
  }

  if (parsed.rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Nie znaleziono wierszy do importu w arkuszu `Raport`.", warnings: parsed.warnings },
      { status: 400 },
    );
  }

  const { imported, skipped } = await importBodyReports(session.user.id, parsed.rows);
  revalidatePath("/reports");
  return NextResponse.json({ ok: true, imported, skipped, warnings: parsed.warnings });
}

