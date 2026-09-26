export type WorkoutPlanFileKind = "docx" | "doc" | "xlsx" | "pdf";

function isPdf(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x25 &&
    buf[1] === 0x50 &&
    buf[2] === 0x44 &&
    buf[3] === 0x46
  );
}

/** OLE Compound File (stary .doc / .xls). */
function isOle(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  );
}

/** ZIP (OOXML: .docx / .xlsx). */
function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function zipLooksLike(buf: Buffer, needle: string): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8_000)).toString("latin1");
  return sample.includes(needle);
}

/**
 * Rozpoznaje rodzaj pliku planu: nazwa → MIME → magiczne bajty.
 * Na Androidzie WebView często oddaje pustą nazwę albo `content://…`.
 */
export function detectWorkoutPlanFileKind(opts: {
  name?: string | null;
  mime?: string | null;
  buffer: Buffer;
}): WorkoutPlanFileKind | null {
  const name = String(opts.name ?? "")
    .trim()
    .toLowerCase()
    // content://.../Plan.xlsx → weź ostatni segment
    .replace(/^.*[\\/]/, "");
  const mime = String(opts.mime ?? "")
    .trim()
    .toLowerCase();
  const buf = opts.buffer;

  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".doc")) return "doc";
  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".xlsb")
  ) {
    return "xlsx";
  }

  if (
    mime.includes("spreadsheetml") ||
    mime.includes("excel") ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/haansoftxlsx"
  ) {
    return "xlsx";
  }
  if (
    mime.includes("wordprocessingml") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (mime === "application/msword") return "doc";
  if (mime === "application/pdf" || mime.includes("pdf")) return "pdf";

  if (isPdf(buf)) return "pdf";

  if (isZip(buf)) {
    if (zipLooksLike(buf, "xl/") || zipLooksLike(buf, "workbook.xml")) {
      return "xlsx";
    }
    if (zipLooksLike(buf, "word/")) return "docx";
    // Nieznany ZIP OOXML — spróbuj Excela (częstszy przypadek przy pustej nazwie)
    return "xlsx";
  }

  if (isOle(buf)) {
    // Stary .xls vs .doc — Excel library lepiej wykryje .xls; .doc idzie do word-extractor.
    // Heurystyka: Workbook / Book stream vs WordDocument
    const sample = buf.subarray(0, Math.min(buf.length, 64_000)).toString("latin1");
    if (/Workbook|Book|Excel/i.test(sample)) return "xlsx";
    if (/WordDocument/i.test(sample)) return "doc";
    // Domyślnie stary Word (użytkownik częściej ma .doc planu)
    return "doc";
  }

  return null;
}
