import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseBodyReportsFromXlsx } from "@/lib/excel/body-report-import";
import {
  DEFAULT_XLSX_LIMITS,
  readXlsx,
  XlsxReadError,
} from "@/lib/excel/read-xlsx";
import { buildTestXlsx } from "@/lib/excel/xlsx-test-builder";

describe("readXlsx", () => {
  it("czyta tekst, liczby, wartości logiczne i daty; przycina puste narożniki", () => {
    const date = new Date(Date.UTC(2026, 9, 23));
    const bytes = buildTestXlsx([
      {
        name: "Dane",
        rows: [
          [],
          [null, "Tekst", 12.5, true, date],
          [null, "Zażółć & <gęślą>", "", null, null],
        ],
      },
    ]);
    const [sheet] = readXlsx(bytes);
    expect(sheet!.name).toBe("Dane");
    expect(sheet!.rows).toHaveLength(2);
    expect(sheet!.rows[0]).toEqual(["Tekst", 12.5, true, date]);
    expect(sheet!.rows[1]![0]).toBe("Zażółć & <gęślą>");
  });

  it("czyta shared strings oraz zignoruje wpisy ZIP spoza dozwolonej listy", () => {
    const files = {
      "xl/workbook.xml": strToU8(
        `<workbook xmlns:r="x"><sheets><sheet name="A" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        `<Relationships><Relationship Id="rId1" Target="/xl/worksheets/sheet1.xml"/></Relationships>`,
      ),
      "xl/sharedStrings.xml": strToU8(
        `<sst><si><t>Raz</t></si><si><r><t>Dw</t></r><r><t>a</t></r><rPh><t>fonetyka</t></rPh></si></sst>`,
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row></sheetData></worksheet>`,
      ),
      "evil/../../etc/passwd": strToU8("x"),
    };
    const [sheet] = readXlsx(zipSync(files));
    expect(sheet!.rows).toEqual([["Raz", "Dwa"]]);
  });

  it("odrzuca plik, który nie jest ZIP-em, oraz ZIP bez workbook.xml", () => {
    expect(() => readXlsx(strToU8("śmieci"))).toThrow(XlsxReadError);
    expect(() => readXlsx(zipSync({ "a.txt": strToU8("x") }))).toThrow(XlsxReadError);
  });

  it("rozpoznaje stary format .xls", () => {
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect(() => readXlsx(ole)).toThrow(/\.xlsx/);
  });

  it("odrzuca zip bomb zanim zostanie rozpakowany", () => {
    const big = new Uint8Array(2 * 1024 * 1024); // kompresuje się do kilku KB
    const bomb = zipSync({
      "xl/workbook.xml": strToU8("<workbook/>"),
      "xl/worksheets/sheet1.xml": big,
    });
    expect(bomb.length).toBeLessThan(50_000);
    expect(() =>
      readXlsx(bomb, { ...DEFAULT_XLSX_LIMITS, maxEntryBytes: 1024 * 1024 }),
    ).toThrow(/zbyt duży/);
  });

  it("przerywa przy zbyt wielu komórkach", () => {
    const rows = Array.from({ length: 50 }, (_, r) => Array.from({ length: 50 }, (_, c) => r * 50 + c + 1));
    expect(() =>
      readXlsx(buildTestXlsx([{ name: "S", rows }]), { ...DEFAULT_XLSX_LIMITS, maxCells: 100 }),
    ).toThrow(/zbyt wiele komórek/);
  });

  it("odrzuca niepoprawny XML jako błąd odczytu", () => {
    const bytes = zipSync({
      "xl/workbook.xml": strToU8(`<workbook xmlns:r="x"><sheets><sheet name="A" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(
        `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`,
      ),
      "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData><row><c r="A1"`),
    });
    expect(() => readXlsx(bytes)).toThrow(XlsxReadError);
  });
});

describe("parseBodyReportsFromXlsx", () => {
  it("importuje raport z nagłówkami, datą i liczbami", () => {
    const bytes = buildTestXlsx([
      {
        name: "Raport",
        rows: [
          ["Raport pomiarów"],
          ["Data", "Waga", "Pas", "Klatka"],
          [new Date(Date.UTC(2026, 0, 5)), 82.5, 90, 104],
          [],
          [new Date(Date.UTC(2026, 0, 12)), "81,9", 89, 103],
        ],
      },
    ]);
    const { rows, warnings } = parseBodyReportsFromXlsx(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    );
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.weightKg).toBe(82.5);
    expect(rows[0]!.createdAt.toISOString().slice(0, 10)).toBe("2026-01-05");
    expect(rows[1]!.weightKg).toBe(81.9);
    expect(rows[1]!.waistCm).toBe(89);
  });

  it("zepsuty plik daje ostrzeżenie zamiast wyjątku", () => {
    const { rows, warnings } = parseBodyReportsFromXlsx(strToU8("nie excel").buffer as ArrayBuffer);
    expect(rows).toEqual([]);
    expect(warnings[0]).toMatch(/Excel/);
  });
});
