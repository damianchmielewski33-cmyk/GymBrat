"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Zmiana hasła w arkuszu od dołu: stare hasło wymagane + reset przez e-mail. */
export function ChangePasswordSheet() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--gym-gold)]/50"
      >
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10 text-[var(--gym-gold)]"
        >
          <KeyRound className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-white">
            Zmień hasło
          </span>
          <span className="block text-[13px] text-white/50">
            Wymaga podania obecnego hasła
          </span>
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
        >
          <SheetHeader className="p-0">
            <SheetTitle>Zmień hasło</SheetTitle>
            <SheetDescription>
              Podaj obecne hasło i ustaw nowe (minimum 8 znaków).
            </SheetDescription>
          </SheetHeader>
          <ChangePasswordForm onDone={() => setOpen(false)} />
          <p className="text-center text-[13px] text-white/55">
            Nie pamiętasz hasła?{" "}
            <Link
              href="/forgot-password"
              className="font-semibold text-[var(--gym-gold)] underline-offset-2 hover:underline"
            >
              Zresetuj przez e-mail
            </Link>
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
