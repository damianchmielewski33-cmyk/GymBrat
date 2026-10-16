"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { Button } from "@/components/ui/button";
import { ensureCsrfCookie, getXsrfHeaders } from "@/lib/client-csrf";
import { isPrimaryAdminEmail } from "@/lib/admin-config";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";

type DetailPayload = {
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    appRole: string | null;
    packageEndsAt: string | Date | null;
    packagePlanSku: string | null;
    adminNote: string | null;
    createdAt: string | Date | number;
  };
  package: {
    active: boolean;
    daysLeft: number | null;
    endsLabel: string | null;
    planSku: string | null;
  };
  activity: {
    mealLogs: number;
    trainingSessions: number;
    pageViews: number;
  };
  orders: Array<{
    id: string;
    planSku: string;
    days: number;
    amountGrosze: number;
    status: string;
    source: string;
    hotpayPaymentId: string | null;
    createdAt: string | Date | number;
    paidAt: string | Date | number | null;
  }>;
};

function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function fmtWhen(value: string | Date | number | null | undefined): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
}

export function AdminUserDetailClient({
  userId,
  editMode,
}: {
  userId: string;
  editMode: boolean;
}) {
  const router = useRouter();
  const { notifySaved, notifyError } = useSaveFeedback();
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [appRole, setAppRole] = useState<"zawodnik" | "trener" | "admin">(
    "zawodnik",
  );
  const [adminNote, setAdminNote] = useState("");
  const [packageEndsAt, setPackageEndsAt] = useState("");
  const [grantDays, setGrantDays] = useState("30");
  const [grantSku, setGrantSku] = useState("d30");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/detail`,
        { credentials: "include" },
      );
      const json = (await res.json().catch(() => null)) as
        | (DetailPayload & { ok?: boolean; error?: string })
        | null;
      if (!res.ok || !json?.ok) {
        notifyError(json?.error ?? "Nie udało się wczytać konta.");
        setData(null);
        return;
      }
      setData(json);
      setFirstName(json.user.firstName ?? "");
      setLastName(json.user.lastName ?? "");
      setName(json.user.name ?? "");
      setAppRole(
        (json.user.appRole as "zawodnik" | "trener" | "admin") || "zawodnik",
      );
      setAdminNote(json.user.adminNote ?? "");
      setPackageEndsAt(toDateInput(json.user.packageEndsAt));
    } catch {
      notifyError("Nie udało się wczytać konta.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [notifyError, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile() {
    setSaving(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({
          firstName: firstName || null,
          lastName: lastName || null,
          name: name || null,
          adminNote: adminNote || null,
          appRole: isPrimaryAdminEmail(data?.user.email ?? "")
            ? undefined
            : appRole,
          packageEndsAt: packageEndsAt || null,
          packagePlanSku: data?.user.packagePlanSku ?? null,
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        notifyError(json?.error ?? "Zapis nie powiódł się.");
        return;
      }
      notifySaved("Zapisano konto.");
      await load();
      router.push(`/admin/users/${encodeURIComponent(userId)}`);
    } catch {
      notifyError("Zapis nie powiódł się.");
    } finally {
      setSaving(false);
    }
  }

  async function grantPackage() {
    const days = Number(grantDays);
    if (!Number.isFinite(days) || days < 1) {
      notifyError("Podaj liczbę dni.");
      return;
    }
    setSaving(true);
    try {
      await ensureCsrfCookie();
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getXsrfHeaders(),
        },
        body: JSON.stringify({ grantDays: days, grantSku }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !json?.ok) {
        notifyError(json?.error ?? "Nadanie pakietu nie powiodło się.");
        return;
      }
      notifySaved("Nadano pakiet.");
      await load();
    } catch {
      notifyError("Nadanie pakietu nie powiodło się.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-white/50">Ładowanie konta…</p>;
  }
  if (!data) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-200">Brak danych konta.</p>
        <Link href="/admin/users" className="text-sm text-[var(--gym-gold)]">
          ← Wróć do listy
        </Link>
      </div>
    );
  }

  const u = data.user;
  const primary = isPrimaryAdminEmail(u.email);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/users"
            className="text-xs font-medium uppercase tracking-wider text-white/45 hover:text-white/70"
          >
            ← Konta
          </Link>
          <h1 className="font-heading mt-2 text-xl font-semibold text-white">
            {editMode ? "Edycja konta" : "Szczegóły konta"}
          </h1>
          <p className="mt-1 font-mono text-sm text-white/55">{u.email}</p>
        </div>
        {!editMode ? (
          <Button
            type="button"
            className="gym-btn-primary"
            onClick={() =>
              router.push(`/admin/users/${encodeURIComponent(userId)}/edit`)
            }
          >
            Edytuj
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="border-white/15"
            onClick={() =>
              router.push(`/admin/users/${encodeURIComponent(userId)}`)
            }
          >
            Anuluj
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--gym-gold)]">Profil</h2>
          {editMode ? (
            <div className="space-y-3">
              <label className="block text-xs text-white/50">
                Imię
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="block text-xs text-white/50">
                Nazwisko
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label className="block text-xs text-white/50">
                Wyświetlana nazwa
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {!primary ? (
                <label className="block text-xs text-white/50">
                  Rola
                  <select
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                    value={appRole}
                    onChange={(e) =>
                      setAppRole(e.target.value as typeof appRole)
                    }
                  >
                    <option value="zawodnik">zawodnik</option>
                    <option value="trener">trener</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
              ) : (
                <p className="text-sm text-amber-200/90">Główny administrator</p>
              )}
            </div>
          ) : (
            <dl className="space-y-2 text-sm text-white/80">
              <div className="flex justify-between gap-2">
                <dt className="text-white/45">Imię</dt>
                <dd>{u.firstName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/45">Nazwisko</dt>
                <dd>{u.lastName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/45">Nazwa</dt>
                <dd>{u.name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/45">Rola</dt>
                <dd className="capitalize">{u.appRole || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/45">Utworzono</dt>
                <dd>{fmtWhen(u.createdAt)}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="glass-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--gym-gold)]">
            Subskrypcja
          </h2>
          <dl className="space-y-2 text-sm text-white/80">
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">Status</dt>
              <dd>{data.package.active ? "Aktywny" : "Brak / reklamy"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">Dni</dt>
              <dd>{data.package.daysLeft ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">Do</dt>
              <dd>{data.package.endsLabel ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">SKU</dt>
              <dd className="font-mono text-xs">{data.package.planSku ?? "—"}</dd>
            </div>
          </dl>
          {editMode ? (
            <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="block text-xs text-white/50">
                Data końca pakietu
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  value={packageEndsAt}
                  onChange={(e) => setPackageEndsAt(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  className="w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  value={grantDays}
                  onChange={(e) => setGrantDays(e.target.value)}
                  placeholder="dni"
                />
                <select
                  className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
                  value={grantSku}
                  onChange={(e) => setGrantSku(e.target.value)}
                >
                  <option value="d7">d7</option>
                  <option value="d30">d30</option>
                  <option value="d90">d90</option>
                  <option value="d365">d365</option>
                  <option value="manual">manual</option>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  className="border-white/15"
                  disabled={saving}
                  onClick={() => void grantPackage()}
                >
                  Nadaj dni
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="glass-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--gym-gold)]">
            Aktywność
          </h2>
          <dl className="space-y-2 text-sm text-white/80">
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">Treningi (sesje)</dt>
              <dd>{data.activity.trainingSessions}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">Wpisy posiłków</dt>
              <dd>{data.activity.mealLogs}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/45">Odsłony ekranów</dt>
              <dd>{data.activity.pageViews}</dd>
            </div>
          </dl>
        </section>

        <section className="glass-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--gym-gold)]">
            Notatka admina
          </h2>
          {editMode ? (
            <textarea
              rows={5}
              className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-white/70">
              {u.adminNote?.trim() || "—"}
            </p>
          )}
        </section>
      </div>

      <section className="glass-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-[var(--gym-gold)]">
          Płatności / zamówienia
        </h2>
        {data.orders.length === 0 ? (
          <p className="text-sm text-white/45">Brak zamówień.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Kwota</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Źródło</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/80">
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {fmtWhen(o.paidAt ?? o.createdAt)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {o.planSku} ({o.days}d)
                    </td>
                    <td className="py-2 pr-3">
                      {formatPlnFromGrosze(o.amountGrosze)}
                    </td>
                    <td className="py-2 pr-3">{o.status}</td>
                    <td className="py-2">
                      {o.source}
                      {o.hotpayPaymentId ? (
                        <span className="ml-1 text-[10px] text-white/35">
                          {o.hotpayPaymentId}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editMode ? (
        <div className="flex justify-end">
          <Button
            type="button"
            className="gym-btn-primary"
            disabled={saving}
            onClick={() => void saveProfile()}
          >
            {saving ? "Zapis…" : "Zapisz zmiany"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
