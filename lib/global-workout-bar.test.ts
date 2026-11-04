import { describe, expect, it } from "vitest";
import {
  isGlobalWorkoutBarRoute,
  shouldShowGlobalWorkoutBar,
} from "@/lib/global-workout-bar";

describe("mini-pasek niedokończonego treningu", () => {
  it("nie dubluje sterowania na ekranie Treningi i w sesji", () => {
    expect(isGlobalWorkoutBarRoute("/treningi")).toBe(false);
    expect(isGlobalWorkoutBarRoute("/active-workout")).toBe(false);
    expect(isGlobalWorkoutBarRoute("/active-workout/x")).toBe(false);
  });

  it("pokazuje się na pozostałych ekranach (Start, Postępy, Profil)", () => {
    for (const p of ["/", "/progress", "/profile", "/treningi-extra"]) {
      expect(isGlobalWorkoutBarRoute(p)).toBe(true);
    }
  });

  it("wymaga aktywnej sesji i braku ukrycia", () => {
    const base = { pathname: "/", hasSession: true, hiddenForRoute: false };
    expect(shouldShowGlobalWorkoutBar(base)).toBe(true);
    expect(shouldShowGlobalWorkoutBar({ ...base, hasSession: false })).toBe(false);
    expect(shouldShowGlobalWorkoutBar({ ...base, hiddenForRoute: true })).toBe(false);
    expect(shouldShowGlobalWorkoutBar({ ...base, pathname: "/treningi" })).toBe(false);
  });
});
