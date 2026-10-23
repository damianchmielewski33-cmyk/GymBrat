"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserRound } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminEmpty,
  AdminField,
  AdminLoading,
  AdminNotice,
  AdminPageHeader,
  AdminPill,
  AdminSelect,
  AdminStat,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminRequest } from "@/lib/admin-client";
import { isPrimaryAdminEmail } from "@/lib/admin-config";
import { formatPlnFromGrosze } from "@/lib/subscription-plans-format";

type AppRole = "zawodnik" | "trener" | "admin";

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

const GRANT_PRESETS: { sku: string; label: string; days: number | null }[] = [
  { sku: "d7", label: "7 dni", days: 7 },
  { sku: "d30", label: "30 dni", days: 30 },
  { sku: "d90", label: "90 dni", days: 90 },
  { sku: "d365", label: "365 dni", days: 365 },
  { sku: "manual", label: "Własna liczba dni", days: null },
];

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-white/45">{label}</dt>
      <dd className="min-w-0 text-right text-white/85">{children}</dd>
    </div>
  );
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
  const [appRole, setAppRole] = useState<AppRole>("zawodnik");
  const [adminNote, setAdminNote] = useState("");
  const [packageEndsAt, setPackageEndsAt] = useState("");
  const [grantSku, setGrantSku] = useState("d30");
  const [grantDays, setGrantDays] = useState("30");

  const detailHref = `/admin/users/${encodeURIComponent(userId)}`;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminRequest<DetailPayload>(
      `/api/admin/users/${encodeURIComponent(userId)}/detail`,
      { fallbackError: "Nie udało się wczytać konta." },
    );
    if (!res.ok) {
      notifyError(res.error);
      setData(null);
      setLoading(false);
      return;
    }
    const json = res.data;
    setData(json);
    setFirstName(json.user.firstName ?? "");
    setLastName(json.user.lastName ?? "");
    setName(json.user.name ?? "");
    setAppRole((json.user.appRole as AppRole) || "zawodnik");
    setAdminNote(json.user.adminNote ?? "");
    setPackageEndsAt(toDateInput(json.user.packageEndsAt));
    setLoading(false);
  }, [notifyError, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile() {
    setSaving(true);
    const res = await adminRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: {
        firstName: firstName || null,
        lastName: lastName || null,
        name: name || null,
        adminNote: adminNote || null,
        appRole: isPrimaryAdminEmail(data?.user.email ?? "") ? undefined : appRole,
        packageEndsAt: packageEndsAt || null,
        packagePlanSku: data?.user.packagePlanSku ?? null,
      },
      fallbackError: "Zapis nie powiódł się.",
    });
    setSaving(false);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved("Zapisano konto.");
    router.push(detailHref);
    router.refresh();
  }

  function pickPreset(sku: string) {
    setGrantSku(sku);
    const preset = GRANT_PRESETS.find((p) => p.sku === sku);
    if (preset?.days) setGrantDays(String(preset.days));
  }

  async function grantPackage() {
    const days = Number(grantDays);
    if (!Number.isFinite(days) || days < 1) {
      notifyError("Podaj liczbę dni (min. 1).");
      return;
    }
    setSaving(true);
    const res = await adminRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: { grantDays: days, grantSku },
      fallbackError: "Nadanie pakietu nie powiodło się.",
    });
    setSaving(false);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved(`Nadano pakiet: ${days} dni.`);
    await load();
  }

  if (loading) return <AdminLoading label="Wczytywanie konta…" />;

  if (!data) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="Konto" backHref="/admin/users" backLabel="Wszystkie konta" />
        <AdminCard>
          <AdminEmpty
            icon={<UserRound />}
            title="Nie znaleziono konta"
            description="Konto mogło zostać usunięte albo nie masz do niego dostępu."
            action={
              <Link href="/admin/users" className="text-sm font-medium text-[var(--gym-gold)]">
                Wróć do listy
              </Link>
            }
          />
        </AdminCard>
      </div>
    );
  }

  const u = data.user;
  const primary = isPrimaryAdminEmail(u.email);
  const displayName = u.name?.trim() || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<UserRound />}
        title={editMode ? `Edycja: ${displayName}` : displayName}
        description={<span className="font-mono">{u.email}</span>}
        backHref={editMode ? detailHref : "/admin/users"}
        backLabel={editMode ? "Szczegóły konta" : "Wszystkie konta"}
        actions={
          editMode ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => router.push(detailHref)}
              >
                Anuluj
              </Button>
              <Button type="button" disabled={saving} onClick={() => void saveProfile()}>
                {saving ? "Zapisywanie…" : "Zapisz zmiany"}
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => router.push(`${detailHref}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden />
              Edytuj
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStat label="Sesje treningowe" value={data.activity.trainingSessions} />
        <AdminStat label="Wpisy posiłków" value={data.activity.mealLogs} />
        <AdminStat label="Odsłony ekranów" value={data.activity.pageViews} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Profil">
          {editMode ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminField label="Imię" htmlFor="u-first">
                  <Input id="u-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </AdminField>
                <AdminField label="Nazwisko" htmlFor="u-last">
                  <Input id="u-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </AdminField>
              </div>
              <AdminField label="Wyświetlana nazwa" htmlFor="u-name">
                <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
              </AdminField>
              {primary ? (
                <AdminNotice tone="warn">
                  Główny administrator — rola jest stała i nie można jej zmienić.
                </AdminNotice>
              ) : (
                <AdminField label="Rola" htmlFor="u-role">
                  <AdminSelect
                    id="u-role"
                    value={appRole}
                    onChange={(e) => setAppRole(e.target.value as AppRole)}
                  >
                    <option value="zawodnik">Zawodnik</option>
                    <option value="trener">Trener</option>
                    <option value="admin">Administrator</option>
                  </AdminSelect>
                </AdminField>
              )}
            </div>
          ) : (
            <dl className="divide-y divide-white/10">
              <Row label="Imię">{u.firstName || "—"}</Row>
              <Row label="Nazwisko">{u.lastName || "—"}</Row>
              <Row label="Nazwa">{u.name || "—"}</Row>
              <Row label="Rola">
                <span className="inline-flex items-center gap-1.5">
                  <span className="capitalize">{u.appRole || "—"}</span>
                  {primary ? <AdminPill tone="gold">główny</AdminPill> : null}
                </span>
              </Row>
              <Row label="Utworzono">{fmtWhen(u.createdAt)}</Row>
            </dl>
          )}
        </AdminCard>

        <AdminCard
          title="Subskrypcja"
          actions={
            <AdminPill tone={data.package.active ? "ok" : "neutral"}>
              {data.package.active ? "Aktywna" : "Brak / reklamy"}
            </AdminPill>
          }
        >
          <dl className="divide-y divide-white/10">
            <Row label="Pozostało dni">{data.package.daysLeft ?? "—"}</Row>
            <Row label="Ważny do">{data.package.endsLabel ?? "—"}</Row>
            <Row label="Plan (SKU)">
              <span className="font-mono text-xs">{data.package.planSku ?? "—"}</span>
            </Row>
          </dl>

          {editMode ? (
            <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
              <AdminField
                label="Data końca pakietu"
                htmlFor="u-ends"
                hint="Zmiana daty wchodzi po kliknięciu „Zapisz zmiany”."
              >
                <Input
                  id="u-ends"
                  type="date"
                  value={packageEndsAt}
                  onChange={(e) => setPackageEndsAt(e.target.value)}
                />
              </AdminField>

              <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-medium text-white/65">Nadaj dodatkowe dni (od razu)</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <AdminSelect
                    value={grantSku}
                    onChange={(e) => pickPreset(e.target.value)}
                    aria-label="Rodzaj pakietu"
                    className="sm:flex-1"
                  >
                    {GRANT_PRESETS.map((p) => (
                      <option key={p.sku} value={p.sku}>
                        {p.label}
                      </option>
                    ))}
                  </AdminSelect>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={grantDays}
                    onChange={(e) => setGrantDays(e.target.value)}
                    disabled={grantSku !== "manual"}
                    aria-label="Liczba dni"
                    className="sm:w-24"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => void grantPackage()}
                  >
                    Nadaj
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </AdminCard>

        <AdminCard title="Notatka admina" description="Widoczna tylko dla administratorów." className="lg:col-span-2">
          {editMode ? (
            <Textarea
              rows={4}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              aria-label="Notatka admina"
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-white/70">
              {u.adminNote?.trim() || "Brak notatki."}
            </p>
          )}
        </AdminCard>
      </div>

      <AdminCard title="Płatności i zamówienia" flush>
        {data.orders.length === 0 ? (
          <AdminEmpty title="Brak zamówień" description="Użytkownik nie kupił jeszcze żadnego pakietu." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-5 py-3 font-medium">Data</th>
                  <th className="px-5 py-3 font-medium">Pakiet</th>
                  <th className="px-5 py-3 font-medium">Kwota</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Źródło</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-white/80">
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap px-5 py-2.5">{fmtWhen(o.paidAt ?? o.createdAt)}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">
                      {o.planSku} ({o.days}d)
                    </td>
                    <td className="px-5 py-2.5 tabular-nums">{formatPlnFromGrosze(o.amountGrosze)}</td>
                    <td className="px-5 py-2.5">{o.status}</td>
                    <td className="px-5 py-2.5">
                      {o.source}
                      {o.hotpayPaymentId ? (
                        <span className="ml-1 text-[10px] text-white/35">{o.hotpayPaymentId}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
