"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  listNearbyPartnersAction,
  respondPartnerRequestAction,
  sendPartnerRequestAction,
  startSharingAction,
  stopSharingAction,
} from "@/actions/gym-partner";
import { loadGoogleMaps } from "@/components/gym-partner/google-maps-loader";
import {
  GOALS,
  LEVELS,
  TIMES,
  type Goal,
  type GymPlace,
  type IncomingRequest,
  type Level,
  type MyPresence,
  type NearbyPartner,
  type PreferredTime,
} from "@/lib/gym-partner/types";

type Pos = { lat: number; lng: number };
const DEFAULT_CENTER: Pos = { lat: 52.2297, lng: 21.0122 };
const fieldCls =
  "min-h-11 w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[14px] text-white";
const btnCls =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-4 text-[13px] font-semibold text-[var(--gym-gold)] disabled:opacity-50";
const ghostBtnCls =
  "inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-[13px] font-semibold text-white/70 disabled:opacity-50";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function gymInfoHtml(g: GymPlace): string {
  const open =
    g.openNow === null ? "" : g.openNow ? "<b style='color:#15803d'>Otwarte teraz</b>" : "<b style='color:#b91c1c'>Zamknięte</b>";
  const hours = g.hours.length
    ? `<div style="margin-top:6px;font-size:12px">${g.hours.map(esc).join("<br>")}</div>`
    : "<div style='margin-top:6px;font-size:12px'>Brak danych o godzinach</div>";
  const link = g.website
    ? `<div style="margin-top:6px"><a href="${esc(g.website)}" target="_blank" rel="noopener noreferrer">Strona siłowni</a></div>`
    : g.mapsUrl
      ? `<div style="margin-top:6px"><a href="${esc(g.mapsUrl)}" target="_blank" rel="noopener noreferrer">Otwórz w Mapach Google</a></div>`
      : "";
  return `<div style="color:#111;max-width:240px"><div style="font-weight:700">${esc(g.name)}</div><div style="font-size:12px">${esc(g.address ?? "")}</div>${open}${hours}${link}</div>`;
}

export function GymMapView({
  mapsKey,
  placesConfigured,
  initialPresence,
  initialIncoming,
}: {
  mapsKey: string;
  placesConfigured: boolean;
  initialPresence: MyPresence | null;
  initialIncoming: IncomingRequest[];
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [gyms, setGyms] = useState<GymPlace[]>([]);
  const [partners, setPartners] = useState<NearbyPartner[]>([]);
  const [presence, setPresence] = useState<MyPresence | null>(initialPresence);
  const [incoming, setIncoming] = useState(initialIncoming);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    goal: "ogolny" as Goal,
    level: "sredni" as Level,
    preferredTime: "teraz" as PreferredTime,
    durationHours: 2 as 1 | 2 | 4,
    consent: false,
  });

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Ta przeglądarka nie obsługuje lokalizacji.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () =>
        setGeoError(
          "Brak zgody na lokalizację. Zezwól w przeglądarce, aby zobaczyć siłownie i partnerów w pobliżu.",
        ),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  // Mapa
  useEffect(() => {
    if (!mapsKey || !mapEl.current) return;
    let cancelled = false;
    loadGoogleMaps(mapsKey)
      .then((maps) => {
        if (cancelled || !mapEl.current || mapRef.current) return;
        mapRef.current = new maps.Map(mapEl.current, {
          center: DEFAULT_CENTER,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        });
        infoRef.current = new maps.InfoWindow();
      })
      .catch(() => setMapError("Nie udało się załadować mapy Google."));
    return () => {
      cancelled = true;
    };
  }, [mapsKey]);

  // Dane po ustaleniu pozycji
  useEffect(() => {
    if (!pos) return;
    mapRef.current?.setCenter(pos);
    mapRef.current?.setZoom(14);
    const ctrl = new AbortController();
    if (placesConfigured) {
      fetch(`/api/gym-partner/places?lat=${pos.lat}&lng=${pos.lng}&radius=5000`, {
        signal: ctrl.signal,
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { places: GymPlace[] }) => setGyms(j.places))
        .catch(() => {
          if (!ctrl.signal.aborted) setNotice("Nie udało się pobrać siłowni w okolicy.");
        });
    }
    void listNearbyPartnersAction(pos).then((r) => {
      if (r.ok) setPartners(r.partners);
    });
    return () => ctrl.abort();
  }, [pos, placesConfigured, presence]);

  // Markery
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.setMap(null);
    markersRef.current = [];
    const add = (m: google.maps.Marker) => markersRef.current.push(m);
    for (const g of gyms) {
      const m = new google.maps.Marker({
        map,
        position: { lat: g.lat, lng: g.lng },
        title: g.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#d4af37",
          fillOpacity: 1,
          strokeColor: "#111",
          strokeWeight: 2,
        },
      });
      m.addListener("click", () => {
        infoRef.current?.setContent(gymInfoHtml(g));
        infoRef.current?.open({ map, anchor: m });
      });
      add(m);
    }
    for (const p of partners) {
      const m = new google.maps.Marker({
        map,
        position: { lat: p.lat, lng: p.lng },
        title: `${p.name} szuka partnera`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      m.addListener("click", () => {
        infoRef.current?.setContent(
          `<div style="color:#111"><b>${esc(p.name)}</b><br>${esc(GOALS[p.goal])} · ${esc(LEVELS[p.level])}<br>${esc(TIMES[p.preferredTime])} · ok. ${p.distanceKm} km<br><small>Zaproś z listy pod mapą</small></div>`,
        );
        infoRef.current?.open({ map, anchor: m });
      });
      add(m);
    }
    if (pos) {
      add(
        new google.maps.Marker({
          map,
          position: pos,
          title: "Ty",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        }),
      );
    }
  }, [gyms, partners, pos, mapError]);

  function startSharing() {
    if (!pos) return;
    start(async () => {
      const r = await startSharingAction({ ...pos, ...form });
      if (r.ok) {
        setPresence(r.presence);
        setNotice("Jesteś widoczny na mapie (przybliżona pozycja).");
      } else setNotice(r.error);
    });
  }

  function stopSharing() {
    start(async () => {
      const r = await stopSharingAction();
      if (r.ok) {
        setPresence(null);
        setNotice("Ukryto Cię na mapie.");
      } else setNotice(r.error);
    });
  }

  function invite(userId: string) {
    start(async () => {
      const r = await sendPartnerRequestAction(userId);
      if (r.ok) {
        setPartners((ps) =>
          ps.map((p) => (p.userId === userId ? { ...p, requestStatus: "pending" } : p)),
        );
        setNotice("Zaproszenie wysłane.");
      } else setNotice(r.error);
    });
  }

  function respond(id: string, accept: boolean) {
    start(async () => {
      const r = await respondPartnerRequestAction(id, accept);
      if (r.ok) {
        setIncoming((l) => l.filter((x) => x.id !== id));
        setNotice(accept ? "Dodano do znajomych — napiszcie w Community → Znajomi." : "Odrzucono.");
      } else setNotice(r.error);
    });
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p role="status" className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] text-white/80">
          {notice}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        {mapsKey && !mapError ? (
          <div ref={mapEl} className="h-[55vh] min-h-[320px] w-full" aria-label="Mapa siłowni" />
        ) : (
          <div className="flex min-h-[200px] items-center justify-center p-6 text-center text-[13px] text-white/60">
            {mapError ?? "Mapa nie jest jeszcze skonfigurowana (brak klucza Google Maps)."}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-white/60">
        <span>● <span className="text-[#d4af37]">siłownia</span></span>
        <span>● <span className="text-green-400">szuka partnera</span></span>
        <span>● <span className="text-blue-400">Ty</span></span>
      </div>

      {!pos ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[13px] text-white/70">
            Pozwól na lokalizację, aby zobaczyć siłownie i partnerów w pobliżu. Twoja pozycja nie jest
            zapisywana, dopóki sam nie włączysz widoczności.
          </p>
          <button type="button" className={btnCls} onClick={locate}>
            Użyj mojej lokalizacji
          </button>
          {geoError ? <p className="text-[12px] text-red-300">{geoError}</p> : null}
        </div>
      ) : null}

      {incoming.length > 0 ? (
        <section className="space-y-2 rounded-2xl border border-[var(--gym-gold)]/30 bg-black/30 p-4">
          <h2 className="text-[14px] font-semibold text-white">Zaproszenia na trening</h2>
          {incoming.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-white">{r.name} chce trenować razem</span>
              <span className="flex gap-2">
                <button type="button" disabled={pending} className={btnCls} onClick={() => respond(r.id, true)}>
                  Akceptuj
                </button>
                <button type="button" disabled={pending} className={ghostBtnCls} onClick={() => respond(r.id, false)}>
                  Odrzuć
                </button>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
        <h2 className="text-[14px] font-semibold text-white">Szukam partnera do treningu</h2>
        {presence ? (
          <div className="space-y-2">
            <p className="text-[13px] text-white/70">
              Jesteś widoczny ({GOALS[presence.goal]}, {LEVELS[presence.level]}, {TIMES[presence.preferredTime]})
              do {new Date(presence.expiresAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}.
            </p>
            <button type="button" disabled={pending} className={ghostBtnCls} onClick={stopSharing}>
              Ukryj mnie teraz
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-[12px] text-white/60">
                Cel
                <select className={fieldCls} value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value as Goal })}>
                  {Object.entries(GOALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[12px] text-white/60">
                Poziom
                <select className={fieldCls} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Level })}>
                  {Object.entries(LEVELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[12px] text-white/60">
                Kiedy
                <select className={fieldCls} value={form.preferredTime} onChange={(e) => setForm({ ...form, preferredTime: e.target.value as PreferredTime })}>
                  {Object.entries(TIMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-[12px] text-white/60">
                Widoczność przez
                <select className={fieldCls} value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) as 1 | 2 | 4 })}>
                  <option value={1}>1 godzinę</option>
                  <option value={2}>2 godziny</option>
                  <option value={4}>4 godziny</option>
                </select>
              </label>
            </div>
            <label className="flex items-start gap-2 text-[12px] text-white/70">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              />
              <span>
                Zgadzam się, aby inni zalogowani użytkownicy GymBrat widzieli na mapie moje imię, cel i
                przybliżoną lokalizację (obszar ok. 500 m) do czasu wygaśnięcia lub ukrycia. Dokładna
                pozycja nie jest zapisywana. Zgodę mogę cofnąć w każdej chwili przyciskiem „Ukryj mnie”.
              </span>
            </label>
            <button
              type="button"
              className={btnCls}
              disabled={pending || !pos || !form.consent}
              onClick={startSharing}
            >
              Pokaż mnie na mapie
            </button>
            {!pos ? <p className="text-[12px] text-white/50">Najpierw użyj mojej lokalizacji.</p> : null}
          </div>
        )}
      </section>

      {pos ? (
        <section className="space-y-2">
          <h2 className="text-[14px] font-semibold text-white">Partnerzy w pobliżu ({partners.length})</h2>
          {partners.length === 0 ? (
            <p className="text-[13px] text-white/50">Nikt nie szuka teraz partnera w promieniu 5 km.</p>
          ) : (
            partners.map((p) => (
              <div key={p.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-3">
                <div>
                  <p className="text-[14px] font-semibold text-white">{p.name}</p>
                  <p className="text-[12px] text-white/55">
                    {GOALS[p.goal]} · {LEVELS[p.level]} · {TIMES[p.preferredTime]} · ok. {p.distanceKm} km
                  </p>
                </div>
                {p.requestStatus === "none" ? (
                  <button type="button" disabled={pending} className={btnCls} onClick={() => invite(p.userId)}>
                    Zaproś na trening
                  </button>
                ) : (
                  <span className="text-[12px] text-white/50">
                    {p.requestStatus === "accepted" ? "Znajomi" : p.requestStatus === "pending" ? "Wysłano" : "Odrzucono"}
                  </span>
                )}
              </div>
            ))
          )}
        </section>
      ) : null}

      {gyms.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[14px] font-semibold text-white">Siłownie w okolicy ({gyms.length})</h2>
          {gyms.map((g) => (
            <div key={g.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-[14px] font-semibold text-white">{g.name}</p>
              <p className="text-[12px] text-white/55">{g.address}</p>
              <p className="mt-1 text-[12px] text-white/70">
                {g.openNow === null ? "Brak danych o godzinach" : g.openNow ? "Otwarte teraz" : "Zamknięte teraz"}
                {g.hours[0] ? ` · ${g.hours[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] ?? g.hours[0]}` : ""}
              </p>
              {g.website ? (
                <a href={g.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[12px] text-[var(--gym-gold)] underline">
                  Strona siłowni
                </a>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
