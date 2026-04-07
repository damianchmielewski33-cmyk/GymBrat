import { RegisterForm } from "@/components/auth/register-form";
import { Suspense } from "react";

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-xl">
      <Suspense fallback={<div className="text-center text-sm text-white/50">Ładowanie…</div>}>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
