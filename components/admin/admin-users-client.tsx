"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Search, Users } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminEmpty,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminSelect,
  type AdminTone,
} from "@/components/admin/admin-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { adminRequest } from "@/lib/admin-client";

type AppRole = "zawodnik" | "trener" | "admin";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  appRole: string | null;
  createdAt: Date | string | number;
};

type UsersPayload = {
  users: UserRow[];
  /** Konta chronione (właściciel z ADMIN_EMAILS albo founder) — liczone na serwerze. */
  protectedUserIds?: string[];
  canGrantAdmin?: boolean;
};

const ROLE_LABEL: Record<AppRole, string> = {
  zawodnik: "Zawodnik",
  trener: "Trener",
  admin: "Administrator",
};

const ROLE_TONE: Record<AppRole, AdminTone> = {
  zawodnik: "neutral",
  trener: "info",
  admin: "gold",
};

function isAppRole(v: string | null): v is AppRole {
  return v === "zawodnik" || v === "trener" || v === "admin";
}

function formatDate(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pl-PL", { dateStyle: "medium" });
}

function initials(u: UserRow): string {
  const src = (u.name?.trim() || u.email).trim();
  return src.slice(0, 2).toUpperCase();
}

export function AdminUsersClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [protectedUserIds, setProtectedUserIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [canGrantAdmin, setCanGrantAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminRequest<UsersPayload>("/api/admin/users", {
      fallbackError: "Nie udało się wczytać listy kont.",
    });
    if (res.ok) {
      setUsers(res.data.users ?? []);
      setProtectedUserIds(new Set(res.data.protectedUserIds ?? []));
      setCanGrantAdmin(Boolean(res.data.canGrantAdmin));
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setRole(user: UserRow, appRole: AppRole) {
    const res = await adminRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: { appRole },
      fallbackError: "Zmiana roli nie powiodła się.",
    });
    if (!res.ok) {
      setError(res.error);
      notifyError(res.error);
      return;
    }
    setError(null);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, appRole } : u)));
    notifySaved(`${user.email}: rola ${ROLE_LABEL[appRole].toLowerCase()}.`);
  }

  async function removeUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await adminRequest(
      `/api/admin/users/${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE", fallbackError: "Usunięcie nie powiodło się." },
    );
    setDeleting(false);
    if (!res.ok) {
      setError(res.error);
      notifyError(res.error);
      return;
    }
    setError(null);
    setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
    notifySaved("Usunięto konto użytkownika.");
    setDeleteTarget(null);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && (u.appRole ?? "zawodnik") !== roleFilter) return false;
      if (!q) return true;
      return u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
    });
  }, [users, query, roleFilter]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Users />}
        title="Konta użytkowników"
        description={
          canGrantAdmin
            ? "Zarządzaj rolami i kontami. Jako główny administrator możesz nadawać rolę admina."
            : "Zmieniaj role (zawodnik / trener) i usuwaj konta. Rolę admina nadaje tylko główny administrator."
        }
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminCard flush>
        <div className="flex flex-col gap-2 border-b border-white/10 p-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj po e-mailu lub nazwie…"
              aria-label="Szukaj użytkowników"
              className="pl-9"
            />
          </div>
          <AdminSelect
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
            aria-label="Filtr roli"
            className="sm:w-48"
          >
            <option value="all">Wszystkie role</option>
            <option value="zawodnik">Zawodnicy</option>
            <option value="trener">Trenerzy</option>
            <option value="admin">Administratorzy</option>
          </AdminSelect>
        </div>

        {loading ? (
          <AdminLoading label="Wczytywanie kont…" />
        ) : filtered.length === 0 ? (
          <AdminEmpty
            icon={<Users />}
            title={users.length === 0 ? "Brak kont" : "Brak wyników"}
            description={
              users.length === 0
                ? "Gdy ktoś się zarejestruje, pojawi się tutaj."
                : "Zmień frazę wyszukiwania lub filtr roli."
            }
          />
        ) : (
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-950/95 text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-4 py-3 font-medium">Użytkownik</th>
                  <th className="px-4 py-3 font-medium">Rola</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Utworzono</th>
                  <th className="px-4 py-3 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/85">
                {filtered.map((u) => {
                  const isProtected = protectedUserIds.has(u.id);
                  const role: AppRole = isAppRole(u.appRole) ? u.appRole : "zawodnik";
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-xs font-semibold text-white/70"
                            aria-hidden
                          >
                            {initials(u)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {u.name?.trim() || u.email}
                            </p>
                            {u.name?.trim() ? (
                              <p className="truncate text-xs text-white/45">{u.email}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AdminPill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</AdminPill>
                          {isProtected ? <AdminPill tone="gold">główny</AdminPill> : null}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3 text-white/55 sm:table-cell">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/users/${encodeURIComponent(u.id)}`}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] px-3 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
                          >
                            Szczegóły
                          </Link>
                          {isProtected ? (
                            <span
                              className="inline-flex h-9 w-9 items-center justify-center text-white/20"
                              title="Konto chronione"
                              aria-label="Konto chronione"
                            >
                              —
                            </span>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                type="button"
                                aria-label={`Więcej akcji dla ${u.email}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-white/[0.05] text-white/80 transition-colors hover:bg-white/10"
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="border-white/10 bg-zinc-950 text-white"
                              >
                                {role !== "zawodnik" ? (
                                  <DropdownMenuItem onClick={() => void setRole(u, "zawodnik")}>
                                    Ustaw: zawodnik
                                  </DropdownMenuItem>
                                ) : null}
                                {role !== "trener" ? (
                                  <DropdownMenuItem onClick={() => void setRole(u, "trener")}>
                                    Ustaw: trener
                                  </DropdownMenuItem>
                                ) : null}
                                {canGrantAdmin && role !== "admin" ? (
                                  <DropdownMenuItem onClick={() => void setRole(u, "admin")}>
                                    Nadaj: administrator
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuItem
                                  className="text-red-300 focus:text-red-200"
                                  onClick={() => setDeleteTarget(u)}
                                >
                                  Usuń konto
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && users.length > 0 ? (
          <p className="border-t border-white/10 px-4 py-2.5 text-xs text-white/40">
            Wyświetlono {filtered.length} z {users.length} kont.
          </p>
        ) : null}
      </AdminCard>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void removeUser()}
        pending={deleting}
        title="Usunąć to konto?"
        description={
          deleteTarget
            ? `${deleteTarget.email} oraz wszystkie powiązane dane zostaną usunięte. Tej operacji nie można cofnąć.`
            : undefined
        }
        confirmLabel="Usuń konto"
      />
    </div>
  );
}
