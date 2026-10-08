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
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "zawodnik" | "trener" | "admin";
    profileComplete?: boolean;
  }
}
