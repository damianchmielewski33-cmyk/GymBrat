/**
 * Minimalny, bezpieczny czytnik plików .xlsx (OOXML) — zamiennik biblioteki `xlsx` (SheetJS 0.18.5),
 * która ma znane podatności (prototype pollution, ReDoS) bez poprawki w npm.
 *
 * Zakres: odczyt wartości komórek z arkuszy (tekst, liczby, daty, wartości logiczne).
 * Nie obsługuje: starego formatu .xls (OLE), makr, formuł (czytamy zapisany wynik), wykresów ani obrazów.
 *
 * Zabezpieczenia przed złośliwymi plikami (plik pochodzi od użytkownika):
 * - rozpakowujemy WYŁĄCZNIE potrzebne wpisy ZIP i odrzucamy zbyt duże (zip bomb) zanim zostaną rozpakowane,
 * - limity liczby arkuszy, wierszy, kolumn i komórek,
 * - parser XML (`saxes`) jest ścisły i nie rozwija zewnętrznych/własnych encji,
 * - wynik to zwykłe tablice — żadnych obiektów z kluczami pochodzącymi z pliku (brak prototype pollution).
 */

import { strFromU8, unzipSync } from "fflate";
import { SaxesParser, type SaxesTagPlain } from "saxes";

export type CellValue = string | number | boolean | Date | null;

export type XlsxSheet = {
  name: string;
  /** Wiersze od pierwszego niepustego; kolumny od pierwszej niepustej. */
  rows: CellValue[][];
};

export type ReadXlsxLimits = {
  maxEntryBytes: number;
  maxTotalBytes: number;
  maxSheets: number;
  maxRows: number;
  maxCols: number;
  maxCells: number;
};

export const DEFAULT_XLSX_LIMITS: ReadXlsxLimits = {
  maxEntryBytes: 30 * 1024 * 1024,
  maxTotalBytes: 60 * 1024 * 1024,
  maxSheets: 30,
  maxRows: 20_000,
  maxCols: 200,
  maxCells: 500_000,
};

export class XlsxReadError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "XlsxReadError";
  }
}

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];

function normalizePath(target: string): string {
  const t = target.replace(/\\/g, "/");
  if (t.startsWith("/")) return t.slice(1);
  const parts = `xl/${t}`.split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

function parseXml(xml: string, handlers: {
  open?: (tag: SaxesTagPlain) => void;
  close?: (tag: SaxesTagPlain) => void;
  text?: (text: string) => void;
}): void {
  const parser = new SaxesParser();
  parser.on("error", (e) => {
    throw e;
  });
  if (handlers.open) parser.on("opentag", handlers.open);
  if (handlers.close) parser.on("closetag", handlers.close);
  if (handlers.text) {
    parser.on("text", handlers.text);
    parser.on("cdata", handlers.text);
  }
  parser.write(xml.replace(/^\uFEFF/, "")).close();
}

function attr(tag: SaxesTagPlain, name: string): string | undefined {
  const v = tag.attributes[name];
  return typeof v === "string" ? v : undefined;
}

// ── sharedStrings.xml ────────────────────────────────────────────────────

function readSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  const out: string[] = [];
  let current = "";
  let inT = false;
  let phonetic = 0;
  parseXml(xml, {
    open(tag) {
      if (tag.name === "si") current = "";
      else if (tag.name === "rPh") phonetic += 1;
      else if (tag.name === "t") inT = true;
    },
    close(tag) {
      if (tag.name === "t") inT = false;
      else if (tag.name === "rPh") phonetic -= 1;
      else if (tag.name === "si") out.push(current);
    },
    text(text) {
      if (inT && phonetic === 0) current += text;
    },
  });
  return out;
}

// ── styles.xml (które style są datami) ───────────────────────────────────

function isBuiltinDateFormat(id: number): boolean {
  return (
    (id >= 14 && id <= 22) ||
    (id >= 27 && id <= 36) ||
    (id >= 45 && id <= 47) ||
    (id >= 50 && id <= 58)
  );
}

function isDateFormatCode(code: string): boolean {
  const stripped = code
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "")
    .replace(/[_*]./g, "");
  return /[ymdhs]/i.test(stripped);
}

function readDateStyles(xml: string | undefined): boolean[] {
  if (!xml) return [];
  const customDate = new Map<number, boolean>();
  const styles: boolean[] = [];
  let inCellXfs = false;
  parseXml(xml, {
    open(tag) {
      if (tag.name === "numFmt") {
        const id = Number(attr(tag, "numFmtId"));
        const code = attr(tag, "formatCode");
        if (Number.isInteger(id) && code !== undefined) customDate.set(id, isDateFormatCode(code));
      } else if (tag.name === "cellXfs") {
        inCellXfs = true;
      } else if (tag.name === "xf" && inCellXfs) {
        const id = Number(attr(tag, "numFmtId") ?? 0);
        styles.push(customDate.get(id) ?? isBuiltinDateFormat(id));
      }
    },
    close(tag) {
      if (tag.name === "cellXfs") inCellXfs = false;
    },
  });
  return styles;
}

// ── workbook.xml + rels ──────────────────────────────────────────────────

function readWorkbook(xml: string): { sheets: { name: string; rid: string }[]; date1904: boolean } {
  const sheets: { name: string; rid: string }[] = [];
  let date1904 = false;
  parseXml(xml, {
    open(tag) {
      if (tag.name === "sheet") {
        const name = attr(tag, "name");
        const rid = attr(tag, "r:id");
        if (name !== undefined && rid) sheets.push({ name, rid });
      } else if (tag.name === "workbookPr") {
        const v = attr(tag, "date1904");
        date1904 = v === "1" || v === "true";
      }
    },
  });
  return { sheets, date1904 };
}

function readRelationships(xml: string | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  parseXml(xml, {
    open(tag) {
      if (tag.name === "Relationship") {
        const id = attr(tag, "Id");
        const target = attr(tag, "Target");
        if (id && target) map.set(id, normalizePath(target));
      }
    },
  });
  return map;
}

// ── arkusz ───────────────────────────────────────────────────────────────

function columnIndex(ref: string): number {
  let col = 0;
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i);
    if (c < 65 || c > 90) break;
    col = col * 26 + (c - 64);
  }
  return col - 1;
}

function rowIndex(ref: string): number {
  const m = ref.match(/(\d+)$/);
  return m ? Number(m[1]) - 1 : -1;
}

function serialToDate(serial: number, date1904: boolean): Date | null {
  if (!Number.isFinite(serial)) return null;
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const d = new Date(epoch + Math.round(serial * 86_400_000));
  return Number.isNaN(d.getTime()) ? null : d;
}

type SheetContext = {
  shared: string[];
  dateStyles: boolean[];
  date1904: boolean;
  limits: ReadXlsxLimits;
};

function readSheet(xml: string, ctx: SheetContext): CellValue[][] {
  const cells = new Map<number, Map<number, CellValue>>();
  let cellCount = 0;

  let ref = "";
  let type = "";
  let style = -1;
  let value = "";
  let inlineText = "";
  let inV = false;
  let inT = false;
  let inInline = false;
  let phonetic = 0;
  let inCell = false;
  let currentRow = -1;
  let nextCol = 0;

  parseXml(xml, {
    open(tag) {
      switch (tag.name) {
        case "row": {
          const r = Number(attr(tag, "r"));
          currentRow = Number.isInteger(r) && r > 0 ? r - 1 : currentRow + 1;
          nextCol = 0;
          break;
        }
        case "c": {
          inCell = true;
          ref = attr(tag, "r") ?? "";
          type = attr(tag, "t") ?? "n";
          style = Number(attr(tag, "s") ?? -1);
          value = "";
          inlineText = "";
          break;
        }
        case "v":
          if (inCell) inV = true;
          break;
        case "is":
          if (inCell) inInline = true;
          break;
        case "rPh":
          phonetic += 1;
          break;
        case "t":
          if (inCell && inInline) inT = true;
          break;
        default:
          break;
      }
    },
    text(text) {
      if (inV) value += text;
      else if (inT && phonetic === 0) inlineText += text;
    },
    close(tag) {
      switch (tag.name) {
        case "v":
          inV = false;
          break;
        case "t":
          inT = false;
          break;
        case "is":
          inInline = false;
          break;
        case "rPh":
          phonetic -= 1;
          break;
        case "c": {
          inCell = false;
          const col = ref ? columnIndex(ref) : nextCol;
          const row = ref ? rowIndex(ref) : currentRow;
          nextCol = col + 1;
          if (row < 0 || col < 0) break;
          if (row >= ctx.limits.maxRows || col >= ctx.limits.maxCols) break;

          let parsed: CellValue = null;
          if (type === "s") {
            parsed = ctx.shared[Number(value)] ?? null;
          } else if (type === "str") {
            parsed = value;
          } else if (type === "inlineStr") {
            parsed = inlineText;
          } else if (type === "b") {
            parsed = value === "1";
          } else if (type === "e") {
            parsed = null;
          } else if (type === "d") {
            const d = new Date(value);
            parsed = Number.isNaN(d.getTime()) ? null : d;
          } else if (value.trim() !== "") {
            const n = Number(value);
            if (Number.isFinite(n)) {
              parsed = style >= 0 && ctx.dateStyles[style] ? serialToDate(n, ctx.date1904) : n;
            }
          }
          if (parsed === null || parsed === "") break;

          cellCount += 1;
          if (cellCount > ctx.limits.maxCells) {
            throw new XlsxReadError("Arkusz zawiera zbyt wiele komórek.");
          }
          let rowMap = cells.get(row);
          if (!rowMap) {
            rowMap = new Map();
            cells.set(row, rowMap);
          }
          rowMap.set(col, parsed);
          break;
        }
        default:
          break;
      }
    },
  });

  if (cells.size === 0) return [];

  let minRow = Infinity;
  let maxRow = -1;
  let minCol = Infinity;
  let maxCol = -1;
  for (const [r, rowMap] of cells) {
    minRow = Math.min(minRow, r);
    maxRow = Math.max(maxRow, r);
    for (const c of rowMap.keys()) {
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    }
  }

  const rows: CellValue[][] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const rowMap = cells.get(r);
    const out: CellValue[] = new Array<CellValue>(maxCol - minCol + 1).fill(null);
    if (rowMap) for (const [c, v] of rowMap) out[c - minCol] = v;
    rows.push(out);
  }
  return rows;
}

// ── API ──────────────────────────────────────────────────────────────────

/** Czy bufor wygląda na stary format .xls (OLE2), którego nie obsługujemy. */
export function looksLikeLegacyXls(data: Uint8Array): boolean {
  return OLE_MAGIC.every((b, i) => data[i] === b);
}

export function readXlsx(
  input: ArrayBuffer | Uint8Array,
  limits: ReadXlsxLimits = DEFAULT_XLSX_LIMITS,
): XlsxSheet[] {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);

  if (looksLikeLegacyXls(data)) {
    throw new XlsxReadError(
      "Stary format Excel (.xls) nie jest obsługiwany. Zapisz plik jako .xlsx i wgraj ponownie.",
    );
  }

  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter(file) {
        const wanted =
          file.name === "xl/workbook.xml" ||
          file.name === "xl/_rels/workbook.xml.rels" ||
          file.name === "xl/sharedStrings.xml" ||
          file.name === "xl/styles.xml" ||
          /^xl\/worksheets\/[^/]+\.xml$/.test(file.name);
        if (!wanted) return false;
        if (file.originalSize > limits.maxEntryBytes) {
          throw new XlsxReadError("Plik Excel jest zbyt duży po rozpakowaniu.");
        }
        total += file.originalSize;
        if (total > limits.maxTotalBytes) {
          throw new XlsxReadError("Plik Excel jest zbyt duży po rozpakowaniu.");
        }
        return true;
      },
    });
  } catch (err) {
    if (err instanceof XlsxReadError) throw err;
    throw new XlsxReadError("To nie jest prawidłowy plik Excel (.xlsx).", { cause: err });
  }

  const text = (name: string): string | undefined => {
    const f = files[name];
    return f ? strFromU8(f) : undefined;
  };

  const workbookXml = text("xl/workbook.xml");
  if (!workbookXml) {
    throw new XlsxReadError("To nie jest prawidłowy plik Excel (.xlsx).");
  }

  try {
    const workbook = readWorkbook(workbookXml);
    const rels = readRelationships(text("xl/_rels/workbook.xml.rels"));
    const ctx: SheetContext = {
      shared: readSharedStrings(text("xl/sharedStrings.xml")),
      dateStyles: readDateStyles(text("xl/styles.xml")),
      date1904: workbook.date1904,
      limits,
    };

    const sheets: XlsxSheet[] = [];
    for (const s of workbook.sheets.slice(0, limits.maxSheets)) {
      const path = rels.get(s.rid);
      const xml = path ? text(path) : undefined;
      sheets.push({ name: s.name, rows: xml ? readSheet(xml, ctx) : [] });
    }
    return sheets;
  } catch (err) {
    if (err instanceof XlsxReadError) throw err;
    throw new XlsxReadError("Nie udało się odczytać zawartości pliku Excel.", { cause: err });
  }
}

/** Tekst komórki w stylu „formatted” (jak wyświetla Excel dla formatu Ogólny). */
export function cellToText(v: CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}
