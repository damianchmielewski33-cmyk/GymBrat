"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 12.9 19.6C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l.1.1 6.3 5.3C39.2 37.3 44 32 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

type Props = {
  callbackUrl?: string;
  className?: string;
  label?: string;
};

export function GoogleSignInButton({
  callbackUrl = "/",
  className,
  label = "Kontynuuj z Google",
}: Props) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "h-12 w-full gap-3 border-white/18 bg-white/[0.04] text-[15px] font-semibold text-white",
        "hover:border-white/28 hover:bg-white/[0.07]",
        className,
      )}
      onClick={() => {
        setPending(true);
        void signIn("google", { callbackUrl }).finally(() => {
          setPending(false);
        });
      }}
    >
      <GoogleMark className="h-5 w-5 shrink-0" />
      {pending ? "Przekierowanie…" : label}
    </Button>
  );
}

export function AuthProviderDivider({ label = "lub" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-white/12" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/12" />
    </div>
  );
}
