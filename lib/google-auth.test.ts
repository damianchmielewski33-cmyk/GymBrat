import { describe, expect, it } from "vitest";
import {
  resolveGooglePersonName,
  splitDisplayName,
} from "@/lib/google-auth";

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

describe("resolveGooglePersonName", () => {
  it("bierze given_name i family_name z Google", () => {
    expect(
      resolveGooglePersonName({
        givenName: "Jan",
        familyName: "Kowalski",
        name: "Jan Kowalski",
      }),
    ).toEqual({
      firstName: "Jan",
      lastName: "Kowalski",
      displayName: "Jan Kowalski",
    });
  });

  it("gdy brak given/family — rozbija name", () => {
    expect(
      resolveGooglePersonName({
        givenName: null,
        familyName: null,
        name: "Anna Nowak",
      }),
    ).toEqual({
      firstName: "Anna",
      lastName: "Nowak",
      displayName: "Anna Nowak",
    });
  });
});
