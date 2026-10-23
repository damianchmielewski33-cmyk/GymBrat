import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "zawodnik" | "trener" | "admin";
      /** false = trzeba dokończyć profil (np. po Google). */
      profileComplete?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: "zawodnik" | "trener" | "admin";
    /** `users.session_version` w chwili logowania hasłem (ADR 0001 D5). */
    sv?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "zawodnik" | "trener" | "admin";
    profileComplete?: boolean;
    /** Wersja sesji; różna od `users.session_version` = token unieważniony. Brak = 0. */
    sv?: number;
  }
}
