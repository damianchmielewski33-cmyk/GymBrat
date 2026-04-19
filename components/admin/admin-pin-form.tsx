"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminPinForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="mt-8 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const pin = String(fd.get("pin") ?? "");
        setError(null);
        start(async () => {
          const res = await fetch("/api/admin/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as { error?: string } | null;
            setError(j?.error === "Invalid PIN" ? "Nieprawidłowy PIN." : "Spróbuj ponownie.");
            return;
          }
          router.push("/admin/overview");
          router.refresh();
        });
      }}
    >
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="pin">PIN administratora</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          required
          className="h-11 border-white/15 bg-black/40 tracking-widest"
          placeholder="••••"
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full bg-[var(--neon)] font-semibold text-white hover:bg-[#ff4d6d]"
      >
        {pending ? "Sprawdzanie…" : "Odblokuj panel"}
      </Button>
    </form>
  );
}
