"use client";

import { useActionState } from "react";
import {
  connectFitatuLoginAction,
  disconnectFitatuAction,
  saveFitatuTokenAction,
} from "@/actions/fitatu";
import { SubmitButton } from "@/components/home/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link2, Unlink } from "lucide-react";

export function FitatuConnectForm({ connected }: { connected: boolean }) {
  const [loginState, loginFormAction] = useActionState(connectFitatuLoginAction, {});
  const [tokenState, tokenFormAction] = useActionState(saveFitatuTokenAction, {});

  return (
    <div className="space-y-6">
      {connected ? (
        <div className="space-y-4">
          <p className="text-sm text-emerald-200/90">
            Konto Fitatu jest połączone — na stronie Start pobierane są dzienne makra
            (wymagany adres proxy w <span className="font-mono text-white/70">FITATU_API_BASE_URL</span>).
          </p>
          <form action={disconnectFitatuAction}>
            <Button
              type="submit"
              variant="outline"
              className="border-white/15 bg-white/5"
            >
              <Unlink className="mr-2 h-4 w-4" />
              Odłącz Fitatu
            </Button>
          </form>
        </div>
      ) : (
        <>
          <form action={loginFormAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fitatuEmail">Email Fitatu</Label>
              <Input
                id="fitatuEmail"
                name="email"
                type="email"
                autoComplete="username"
                className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
                placeholder="twoj@email.pl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fitatuPassword">Hasło Fitatu</Label>
              <Input
                id="fitatuPassword"
                name="password"
                type="password"
                autoComplete="current-password"
                className="h-11 rounded-xl border-white/15 bg-black/30 px-4"
              />
              <p className="text-xs text-white/45">
                Logowanie odbywa się przez Twój endpoint proxy (
                <span className="font-mono">POST …/auth/login</span>
                ) — hasło nie jest zapisywane w GymBrat, tylko token zwrócony przez proxy.
              </p>
            </div>
            {loginState?.error ? (
              <p className="text-sm text-rose-300/90">{loginState.error}</p>
            ) : null}
            <SubmitButton className="bg-[var(--neon)] text-white hover:bg-[#ff4d6d]">
              <Link2 className="mr-2 h-4 w-4" />
              Zaloguj i połącz
            </SubmitButton>
          </form>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.18em] text-white/40">
              lub token
            </div>
          </div>

          <form action={tokenFormAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fitatuToken">Token dostępu (Bearer)</Label>
              <Input
                id="fitatuToken"
                name="token"
                type="password"
                autoComplete="off"
                className="h-11 rounded-xl border-white/15 bg-black/30 px-4 font-mono text-sm"
                placeholder="Wklej token z proxy / partnera"
              />
              <p className="text-xs text-white/45">
                Jeśli masz już token JWT lub klucz API z integracji, zapisz go tutaj zamiast
                logowania hasłem.
              </p>
            </div>
            {tokenState?.error ? (
              <p className="text-sm text-rose-300/90">{tokenState.error}</p>
            ) : null}
            <SubmitButton className="border border-white/15 bg-white/5 hover:bg-white/10">
              Zapisz token
            </SubmitButton>
          </form>
        </>
      )}
    </div>
  );
}
