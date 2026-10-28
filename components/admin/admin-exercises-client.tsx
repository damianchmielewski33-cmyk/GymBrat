"use client";

import { useCallback, useEffect, useState } from "react";
import { Dumbbell, ExternalLink, Plus, RefreshCw, Search } from "lucide-react";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  AdminCard,
  AdminEmpty,
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
import { MUSCLE_CATEGORIES, categoryLabel } from "@/lib/workout-exercise-catalog";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";

type Row = {
  id: string;
  name: string;
  categoryId: string;
  secondaryCategoryIds: string[] | null;
  aliasesEn: string[] | null;
  aliasesPl: string[] | null;
  equipment: string[] | null;
  difficulty: string | null;
  description: string | null;
  cues: string[] | null;
  techniqueYoutubeUrl: string | null;
  techniqueYoutubeTitle: string | null;
  isActive: boolean;
};

type YoutubeCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
};

const PAGE_SIZE = 40;

const emptyDraft = (): Partial<Row> & { id: string; name: string; categoryId: string; description: string } => ({
  id: "",
  name: "",
  categoryId: "chest",
  description: "",
  aliasesEn: [],
  aliasesPl: [],
  equipment: [],
  cues: [],
  difficulty: null,
  techniqueYoutubeUrl: null,
});

function csv(list: string[] | null | undefined): string {
  return (list ?? []).join(", ");
}

function parseCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function AdminExercisesClient() {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyDraft());
  const [aliasesEn, setAliasesEn] = useState("");
  const [aliasesPl, setAliasesPl] = useState("");
  const [equipment, setEquipment] = useState("");
  const [cues, setCues] = useState("");
  const [youtubeDraft, setYoutubeDraft] = useState("");
  const [candidates, setCandidates] = useState<YoutubeCandidate[]>([]);
  const [searchMsg, setSearchMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(limit),
      offset: "0",
    });
    if (query.trim()) params.set("q", query.trim());
    if (categoryId !== "all") params.set("category", categoryId);
    if (onlyMissing) params.set("missingDescription", "1");
    if (includeInactive) params.set("inactive", "1");
    const res = await adminRequest<{ rows?: Row[]; total?: number }>(
      `/api/admin/exercises?${params}`,
      { fallbackError: "Nie udało się wczytać listy ćwiczeń." },
    );
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRows(Array.isArray(res.data.rows) ? res.data.rows : []);
    setTotal(Number(res.data.total ?? 0));
    setLoading(false);
  }, [categoryId, includeInactive, limit, onlyMissing, query]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setCreating(true);
    setEditId(null);
    setForm(emptyDraft());
    setAliasesEn("");
    setAliasesPl("");
    setEquipment("");
    setCues("");
    setYoutubeDraft("");
    setCandidates([]);
    setSearchMsg(null);
  }

  function openEdit(row: Row) {
    setCreating(false);
    setEditId(row.id);
    setForm({
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      description: row.description ?? "",
      difficulty: row.difficulty,
      techniqueYoutubeTitle: row.techniqueYoutubeTitle,
    });
    setAliasesEn(csv(row.aliasesEn));
    setAliasesPl(csv(row.aliasesPl));
    setEquipment(csv(row.equipment));
    setCues(csv(row.cues));
    setYoutubeDraft(row.techniqueYoutubeUrl ?? "");
    setCandidates([]);
    setSearchMsg(null);
  }

  async function saveCreate() {
    setBusyId("new");
    const res = await adminRequest<{ row?: Row }>("/api/admin/exercises", {
      method: "POST",
      body: {
        id: form.id.trim(),
        name: form.name.trim(),
        categoryId: form.categoryId,
        description: form.description.trim(),
        aliasesEn: parseCsv(aliasesEn),
        aliasesPl: parseCsv(aliasesPl),
        equipment: parseCsv(equipment),
        cues: parseCsv(cues),
        difficulty: form.difficulty || null,
        techniqueYoutubeUrl: youtubeDraft.trim() || null,
        techniqueYoutubeTitle: form.techniqueYoutubeTitle ?? null,
      },
      fallbackError: "Nie udało się dodać ćwiczenia.",
    });
    setBusyId(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved("Dodano ćwiczenie.");
    setCreating(false);
    setLimit(PAGE_SIZE);
    void load();
  }

  async function saveEdit() {
    if (!editId) return;
    setBusyId(editId);
    const yt = youtubeDraft.trim();
    if (yt && !normalizeYoutubeUrl(yt) && !yt.startsWith("https://")) {
      notifyError("Podaj poprawny link YouTube lub https://…");
      setBusyId(null);
      return;
    }
    const res = await adminRequest<{ row?: Row }>(
      `/api/admin/exercises/${encodeURIComponent(editId)}`,
      {
        method: "PATCH",
        body: {
          name: form.name.trim(),
          categoryId: form.categoryId,
          description: form.description.trim() || null,
          aliasesEn: parseCsv(aliasesEn),
          aliasesPl: parseCsv(aliasesPl),
          equipment: parseCsv(equipment),
          cues: parseCsv(cues),
          difficulty: form.difficulty || null,
          techniqueYoutubeUrl: yt || null,
          techniqueYoutubeTitle: form.techniqueYoutubeTitle ?? null,
        },
        fallbackError: "Zapis nie powiódł się.",
      },
    );
    setBusyId(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved("Zapisano ćwiczenie.");
    setEditId(null);
    void load();
  }

  async function deactivate(id: string) {
    setBusyId(id);
    const res = await adminRequest(
      `/api/admin/exercises/${encodeURIComponent(id)}/deactivate`,
      {
        method: "PATCH",
        body: {},
        fallbackError: "Dezaktywacja nie powiodła się.",
      },
    );
    setBusyId(null);
    if (!res.ok) {
      notifyError(res.error);
      return;
    }
    notifySaved("Ćwiczenie dezaktywowane.");
    if (editId === id) setEditId(null);
    void load();
  }

  async function searchYoutube(id: string) {
    setBusyId(`yt-${id}`);
    setSearchMsg(null);
    setCandidates([]);
    const res = await adminRequest<{
      candidates?: YoutubeCandidate[];
      error?: string;
      missingConfig?: boolean;
    }>(`/api/admin/exercises/${encodeURIComponent(id)}/youtube-search`, {
      method: "POST",
      body: {},
      fallbackError: "Wyszukiwanie nie powiodło się.",
    });
    setBusyId(null);
    if (!res.ok) {
      setSearchMsg(res.error);
      return;
    }
    if (res.data.missingConfig || res.data.error) {
      setSearchMsg(res.data.error ?? "Brak konfiguracji YouTube.");
    }
    setCandidates(Array.isArray(res.data.candidates) ? res.data.candidates : []);
  }

  function approveCandidate(c: YoutubeCandidate) {
    setYoutubeDraft(`https://www.youtube.com/watch?v=${c.videoId}`);
    setForm((prev) => ({ ...prev, techniqueYoutubeTitle: c.title }));
    setCandidates([]);
  }

  const withUrl = rows.filter((r) => r.techniqueYoutubeUrl).length;
  const formOpen = creating || !!editId;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={<Dumbbell />}
        title="Atlas ćwiczeń"
        description="Te linki są domyślną techniką w atlasie (wraz z opisem/instrukcją); użytkownik może nadpisać własnym linkiem w swoim planie albo zapisać sobie prywatną notatkę w atlasie — żadna z tych nadpisań nie jest widoczna dla innych użytkowników."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={loading} onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Odśwież
            </Button>
            <Button type="button" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Dodaj ćwiczenie
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminStat label="Wyników" value={total} />
        <AdminStat label="Z linkiem (strona)" value={withUrl} tone="ok" />
        <AdminStat
          label="Bez opisu (filtr)"
          value={onlyMissing ? total : "—"}
          tone="warn"
        />
      </div>

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {formOpen ? (
        <AdminCard
          title={creating ? "Nowe ćwiczenie" : `Edycja · ${editId}`}
          description="Opis techniki jest wymagany przy tworzeniu (min. 20 znaków)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {creating ? (
              <label className="block text-sm text-white/70">
                Id
                <Input
                  className="mt-1"
                  value={form.id}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, id: e.target.value.trim() }))
                  }
                  placeholder="np. c-bench-dumbbell"
                />
              </label>
            ) : null}
            <label className="block text-sm text-white/70">
              Nazwa
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label className="block text-sm text-white/70">
              Partia
              <AdminSelect
                className="mt-1 w-full"
                value={form.categoryId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, categoryId: e.target.value }))
                }
              >
                {MUSCLE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </AdminSelect>
            </label>
            <label className="block text-sm text-white/70">
              Poziom
              <AdminSelect
                className="mt-1 w-full"
                value={form.difficulty ?? ""}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    difficulty: e.target.value || null,
                  }))
                }
              >
                <option value="">—</option>
                <option value="beginner">początkujący</option>
                <option value="intermediate">średni</option>
                <option value="advanced">zaawansowany</option>
              </AdminSelect>
            </label>
            <label className="block text-sm text-white/70 sm:col-span-2">
              Opis / jak wykonać
              <Textarea
                className="mt-1 min-h-28"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </label>
            <label className="block text-sm text-white/70">
              Aliasy EN (przecinek)
              <Input
                className="mt-1"
                value={aliasesEn}
                onChange={(e) => setAliasesEn(e.target.value)}
              />
            </label>
            <label className="block text-sm text-white/70">
              Aliasy PL (przecinek)
              <Input
                className="mt-1"
                value={aliasesPl}
                onChange={(e) => setAliasesPl(e.target.value)}
              />
            </label>
            <label className="block text-sm text-white/70">
              Sprzęt (przecinek)
              <Input
                className="mt-1"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              />
            </label>
            <label className="block text-sm text-white/70">
              Wskazówki (przecinek)
              <Input
                className="mt-1"
                value={cues}
                onChange={(e) => setCues(e.target.value)}
              />
            </label>
            <label className="block text-sm text-white/70 sm:col-span-2">
              Link YouTube
              <Input
                className="mt-1"
                value={youtubeDraft}
                onChange={(e) => setYoutubeDraft(e.target.value)}
                placeholder="https://youtu.be/… lub youtube.com/watch?v=…"
              />
            </label>
          </div>
          {editId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busyId === `yt-${editId}`}
                onClick={() => void searchYoutube(editId)}
              >
                Szukaj filmu
              </Button>
            </div>
          ) : null}
          {searchMsg ? <AdminNotice tone="warn">{searchMsg}</AdminNotice> : null}
          {candidates.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {candidates.map((c) => (
                <li
                  key={c.videoId}
                  className="flex items-center gap-3 rounded-xl border border-white/10 p-2"
                >
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnailUrl}
                      alt=""
                      className="h-12 w-16 rounded object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{c.title}</p>
                    <p className="text-xs text-white/45">{c.channelTitle}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => approveCandidate(c)}
                  >
                    Zatwierdź
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!!busyId}
              onClick={() => void (creating ? saveCreate() : saveEdit())}
            >
              {busyId ? "Zapis…" : "Zapisz"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditId(null);
              }}
            >
              Anuluj
            </Button>
            {editId ? (
              <Button
                type="button"
                variant="outline"
                className="border-rose-400/40 text-rose-300"
                disabled={busyId === editId}
                onClick={() => void deactivate(editId)}
              >
                Dezaktywuj
              </Button>
            ) : null}
          </div>
        </AdminCard>
      ) : null}

      <AdminCard flush>
        <div className="flex flex-col gap-2 border-b border-white/10 p-4 lg:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE_SIZE);
              }}
              placeholder="Szukaj nazwy lub id…"
              aria-label="Szukaj ćwiczeń"
              className="pl-9"
            />
          </div>
          <AdminSelect
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setLimit(PAGE_SIZE);
            }}
            aria-label="Partia mięśniowa"
            className="lg:w-56"
          >
            <option value="all">Wszystkie partie</option>
            {MUSCLE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </AdminSelect>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-white/20 bg-black/50 px-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={onlyMissing}
              onChange={(e) => {
                setOnlyMissing(e.target.checked);
                setLimit(PAGE_SIZE);
              }}
              className="h-4 w-4 accent-[var(--gym-gold)]"
            />
            Bez opisu
          </label>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-white/20 bg-black/50 px-3 text-sm text-white/75">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setIncludeInactive(e.target.checked);
                setLimit(PAGE_SIZE);
              }}
              className="h-4 w-4 accent-[var(--gym-gold)]"
            />
            Nieaktywne
          </label>
        </div>

        {loading ? (
          <AdminLoading label="Wczytywanie ćwiczeń…" />
        ) : rows.length === 0 ? (
          <AdminEmpty
            icon={<Dumbbell />}
            title="Brak wyników"
            description="Zmień frazę wyszukiwania lub filtry. Uruchom seed katalogu, jeśli baza jest pusta."
          />
        ) : (
          <ul className="divide-y divide-white/10">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{row.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <AdminPill>{categoryLabel(row.categoryId)}</AdminPill>
                    {!row.isActive ? <AdminPill tone="warn">nieaktywne</AdminPill> : null}
                    {!row.description ? (
                      <AdminPill tone="warn">brak opisu</AdminPill>
                    ) : null}
                    {row.techniqueYoutubeUrl ? (
                      <a
                        href={row.techniqueYoutubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[var(--gym-gold)] hover:underline"
                      >
                        Film
                        <ExternalLink className="h-3 w-3" aria-hidden />
                      </a>
                    ) : (
                      <AdminPill tone="warn">brak filmu</AdminPill>
                    )}
                    <span className="font-mono text-[11px] text-white/30">
                      {row.id}
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(row)}
                >
                  Edytuj
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!loading && total > rows.length ? (
          <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <p className="text-xs text-white/45">
              Pokazano {rows.length} z {total}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLimit((v) => v + PAGE_SIZE)}
            >
              Pokaż więcej
            </Button>
          </div>
        ) : null}
      </AdminCard>
    </div>
  );
}
