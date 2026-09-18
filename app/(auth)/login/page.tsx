import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AwpCrossLink } from "@/components/awp-cross-link";
import { ScreenCard, ScreenHeading, screenKickerClass } from "@/components/layout/screen";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <ScreenCard
      footer={
        <>
          <p className={cn(screenKickerClass, "mb-2 text-center")}>Siostrzana aplikacja</p>
          <AwpCrossLink variant="banner" />
        </>
      }
    >
      <ScreenHeading
        showBrand
        className="mb-8"
        description="Zaloguj się do swojego centrum treningowego"
      />
      <Suspense fallback={<div className="text-sm text-white/50">Ładowanie…</div>}>
        <LoginForm />
      </Suspense>
    </ScreenCard>
  );
}
