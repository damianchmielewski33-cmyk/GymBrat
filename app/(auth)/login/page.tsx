import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="glass-panel p-8">
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="inline-block rounded-sm font-heading text-2xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]/80"
          aria-label="GymBrat — strona główna"
        >
          Gym<span className="text-[var(--neon)]">Brat</span>
        </Link>
        <p className="mt-2 text-sm text-white/60">Zaloguj się do swojego centrum treningowego</p>
      </div>
      <Suspense fallback={<div className="text-sm text-white/50">Ładowanie…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
