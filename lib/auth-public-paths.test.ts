import { describe, expect, it } from "vitest";
import {
  isAnonymousPublicPath,
  mustCompleteProfile,
  postAuthDestination,
  shouldBounceAuthenticatedFromAuthPage,
} from "@/lib/auth-public-paths";

describe("auth-public-paths", () => {
  it("GET / i ekrany auth są publiczne — bez 307 na logowanie", () => {
    expect(isAnonymousPublicPath("/")).toBe(true);
    expect(isAnonymousPublicPath("/login")).toBe(true);
    expect(isAnonymousPublicPath("/register")).toBe(true);
    expect(isAnonymousPublicPath("/reports")).toBe(false);
    expect(isAnonymousPublicPath("/profile")).toBe(false);
  });

  it("po zalogowaniu odbija tylko /login i /register, nie sam Start", () => {
    expect(shouldBounceAuthenticatedFromAuthPage("/login")).toBe(true);
    expect(shouldBounceAuthenticatedFromAuthPage("/register")).toBe(true);
    expect(shouldBounceAuthenticatedFromAuthPage("/")).toBe(false);
  });

  it("niepełny profil (Google) → /complete-profile", () => {
    expect(postAuthDestination(false)).toBe("/complete-profile");
    expect(postAuthDestination(true)).toBe("/");
    expect(mustCompleteProfile("/workout-plan", false)).toBe(true);
    expect(mustCompleteProfile("/complete-profile", false)).toBe(false);
    expect(mustCompleteProfile("/", true)).toBe(false);
  });
});
