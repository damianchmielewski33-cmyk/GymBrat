import { describe, expect, it } from "vitest";
import {
  classifyEffort,
  effectiveRir,
  hasEffortConflict,
  isEasyEffort,
  isHardEffort,
  isWarnEffort,
} from "@/lib/set-effort";
import {
  resolveEffortContext,
  resolveMovementProfile,
} from "@/lib/live-coach/movement-profiles";

describe("set-effort — domyślny kontekst (bez profilu ruchu)", () => {
  it("RIR ≥ 2 = łatwo, RIR 1 = na styk, RIR 0 = twardo", () => {
    expect(classifyEffort({ rir: 5 })).toBe("easy");
    expect(classifyEffort({ rir: 3 })).toBe("easy");
    expect(classifyEffort({ rir: 2 })).toBe("easy");
    expect(classifyEffort({ rir: 1 })).toBe("warn");
    expect(classifyEffort({ rir: 0 })).toBe("hard");
  });

  it("RPE jako fallback (RIR = 10 − RPE)", () => {
    expect(classifyEffort({ rpe: 6 })).toBe("easy");
    expect(classifyEffort({ rpe: 8 })).toBe("easy");
    expect(classifyEffort({ rpe: 9 })).toBe("warn");
    expect(classifyEffort({ rpe: 10 })).toBe("hard");
    expect(effectiveRir({ rpe: 8 })).toBe(2);
    expect(effectiveRir({ rpe: 10 })).toBe(0);
  });

  it("RIR ma pierwszeństwo przed RPE", () => {
    expect(effectiveRir({ rir: 3, rpe: 8 })).toBe(3);
    expect(classifyEffort({ rir: 2, rpe: 9 })).toBe("easy");
  });

  it("brak danych → unknown", () => {
    expect(classifyEffort({})).toBe("unknown");
    expect(classifyEffort({ rir: null, rpe: null })).toBe("unknown");
    expect(classifyEffort({ rpe: 0 })).toBe("unknown");
    expect(effectiveRir({})).toBeNull();
  });
});

describe("set-effort — konflikt RIR/RPE", () => {
  it("RIR łatwo + RPE bardzo ciężko → konflikt", () => {
    expect(hasEffortConflict({ rir: 3, rpe: 9 })).toBe(true);
    expect(hasEffortConflict({ rir: 5, rpe: 10 })).toBe(true);
    // RIR 2 jest „łatwe”, więc RPE 10 (zero zapasu) też jest sprzeczne
    expect(hasEffortConflict({ rir: 2, rpe: 10 })).toBe(true);
    expect(classifyEffort({ rir: 2, rpe: 10 })).toBe("conflict");
  });

  it("RIR 0 + RPE łatwe → konflikt", () => {
    expect(hasEffortConflict({ rir: 0, rpe: 6 })).toBe(true);
    expect(hasEffortConflict({ rir: 0, rpe: 5 })).toBe(true);
  });

  it("rozjazd o 1 punkt nie jest konfliktem", () => {
    expect(hasEffortConflict({ rir: 2, rpe: 9 })).toBe(false);
    expect(hasEffortConflict({ rir: 1, rpe: 8 })).toBe(false);
    expect(hasEffortConflict({ rir: 0, rpe: 7 })).toBe(false);
  });

  it("brak jednej z wartości → brak konfliktu", () => {
    expect(hasEffortConflict({ rir: 0 })).toBe(false);
    expect(hasEffortConflict({ rpe: 10 })).toBe(false);
  });
});

describe("set-effort — cel RIR ruchu (targetRirMin)", () => {
  it("cel 0 (izolacja do upadku): RIR 0 i 1 to nie twardo / nie na styk", () => {
    const ctx = { targetRirMin: 0 };
    expect(classifyEffort({ rir: 0 }, ctx)).toBe("moderate");
    expect(classifyEffort({ rir: 1 }, ctx)).toBe("moderate");
    expect(isHardEffort({ rir: 0 }, ctx)).toBe(false);
    expect(isWarnEffort({ rir: 0 }, ctx)).toBe(false);
    // łatwo nadal od RIR 2
    expect(classifyEffort({ rir: 2 }, ctx)).toBe("easy");
  });

  it("cel 1 (bench): RIR 0 twardo, RIR 1 zgodne z planem", () => {
    const ctx = { targetRirMin: 1 };
    expect(classifyEffort({ rir: 0 }, ctx)).toBe("hard");
    expect(classifyEffort({ rir: 1 }, ctx)).toBe("moderate");
  });

  it("cel 2 (martwy ciąg): RIR 1 to już na styk", () => {
    const ctx = { targetRirMin: 2 };
    expect(classifyEffort({ rir: 1 }, ctx)).toBe("warn");
    expect(classifyEffort({ rir: 0 }, ctx)).toBe("hard");
    expect(isEasyEffort({ rir: 2 }, ctx)).toBe(true);
  });

  it("konflikt wygrywa z celem ruchu", () => {
    expect(classifyEffort({ rir: 0, rpe: 6 }, { targetRirMin: 0 })).toBe(
      "conflict",
    );
  });
});

describe("movement-profiles — resolveEffortContext", () => {
  it("baza = profil ruchu", () => {
    expect(resolveEffortContext("Uginanie ze sztangą").targetRirMin).toBe(0);
    expect(resolveEffortContext("Wyciskanie sztangi leżąc (bench)").targetRirMin).toBe(1);
    expect(resolveEffortContext("Martwy ciąg").targetRirMin).toBe(2);
    expect(resolveEffortContext("Nieznane ćwiczenie").targetRirMin).toBe(
      resolveMovementProfile("Nieznane ćwiczenie").targetRirMin,
    );
  });

  it("cel z planu może tylko obniżyć próg, nie podnieść ponad profil", () => {
    // plan „RIR 0” → do upadku
    expect(
      resolveEffortContext("Wyciskanie sztangi leżąc (bench)", null, 0)
        .targetRirMin,
    ).toBe(0);
    // sesja domyślnie wpisuje RIR 1 — nie może podbić biceps (profil 0)
    expect(resolveEffortContext("Uginanie ze sztangą", null, 1).targetRirMin).toBe(0);
    // plan „RIR 3” nie podnosi progu ponad profil benchu
    expect(
      resolveEffortContext("Wyciskanie sztangi leżąc (bench)", null, 3)
        .targetRirMin,
    ).toBe(1);
  });

  it("nieprawidłowy cel z planu jest ignorowany", () => {
    expect(resolveEffortContext("Uginanie ze sztangą", null, NaN).targetRirMin).toBe(0);
    expect(resolveEffortContext("Martwy ciąg", null, -1).targetRirMin).toBe(2);
    expect(resolveEffortContext("Martwy ciąg", null, undefined).targetRirMin).toBe(2);
  });
});
