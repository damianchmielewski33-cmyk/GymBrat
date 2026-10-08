import { describe, expect, it } from "vitest";
import { splitDisplayName } from "@/lib/google-auth";

describe("splitDisplayName", () => {
  it("rozbija imię i nazwisko", () => {
    expect(splitDisplayName("Jan Kowalski")).toEqual({
      firstName: "Jan",
      lastName: "Kowalski",
    });
  });

  it("łączy wieloczłonowe nazwisko", () => {
    expect(splitDisplayName("Anna Maria Nowak")).toEqual({
      firstName: "Anna",
      lastName: "Maria Nowak",
    });
  });

  it("obsługuje puste / jedno słowo", () => {
    expect(splitDisplayName("")).toEqual({ firstName: null, lastName: null });
    expect(splitDisplayName("Damian")).toEqual({
      firstName: "Damian",
      lastName: null,
    });
  });
});
