import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "zawodnik" | "trener" } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role?: "zawodnik" | "trener";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "zawodnik" | "trener";
  }
}
