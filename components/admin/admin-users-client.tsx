"use client";

import { useCallback, useEffect, useState } from "react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  appRole: string | null;
  createdAt: Date | string | number;
};

export function AdminUsersClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [founderUserId, setFounderUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        users: UserRow[];
        founderUserId: string | null;
      };
      setUsers(data.users);
      setFounderUserId(data.founderUserId ?? null);
    } catch {
      setError("Nie udało się wczytać listy kont.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(id: string, appRole: "zawodnik" | "trener") {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appRole }),
    });
    if (!res.ok) {
      const msg = "Zmiana roli nie powiodła się.";
      setError(msg);
      notifyError(msg);
      return;
    }
    notifySaved(`Zapisano rolę: ${appRole}.`);
    setError(null);
    await load();
  }

  async function removeUser(id: string) {
    if (!confirm("Na pewno usunąć to konto i powiązane dane? Ta operacja jest nieodwracalna.")) {
      return;
    }
    const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      const msg = j?.error ?? "Usunięcie nie powiodło się.";
      setError(msg);
      notifyError(msg);
      return;
    }
    notifySaved("Usunięto konto użytkownika.");
    setError(null);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel neon-glow p-5 sm:p-6">
        <h1 className="font-heading text-xl font-semibold text-white">Konta użytkowników</h1>
        <p className="mt-1 text-sm text-white/55">
          Administratorem jest wyłącznie konto utworzone jako pierwsze w systemie. Pozostałym
          kontom możesz nadać rolę zawodnika lub trenera oraz je usuwać.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="glass-panel neon-glow overflow-hidden">
        <div className="max-h-[min(70vh,640px)] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-950/95 text-[11px] uppercase tracking-wide text-white/45">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Nazwa</th>
                <th className="px-4 py-3 font-medium">Rola</th>
                <th className="px-4 py-3 font-medium">Utworzono</th>
                <th className="px-4 py-3 font-medium text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-white/85">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-white/50">
                    Ładowanie…
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isFounder = founderUserId !== null && u.id === founderUserId;
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-4 py-3">{u.email}</td>
                      <td className="max-w-[200px] truncate px-4 py-3">{u.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {isFounder ? (
                          <span className="font-medium text-amber-200/95">
                            Administrator{" "}
                            <span className="font-normal text-white/45">(pierwsze konto)</span>
                          </span>
                        ) : (
                          <span className="capitalize">{u.appRole ?? "—"}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-white/60">
                        {typeof u.createdAt === "string" || typeof u.createdAt === "number"
                          ? new Date(u.createdAt).toLocaleString("pl-PL")
                          : u.createdAt.toLocaleString("pl-PL")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isFounder ? (
                          <span className="text-xs text-white/40">—</span>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              type="button"
                              className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] px-3 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
                            >
                              Rola / usuń
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="border-white/10 bg-zinc-950 text-white"
                            >
                              <DropdownMenuItem onClick={() => void setRole(u.id, "zawodnik")}>
                                Ustaw: zawodnik
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void setRole(u.id, "trener")}>
                                Ustaw: trener
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-300 focus:text-red-200"
                                onClick={() => void removeUser(u.id)}
                              >
                                Usuń konto
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
