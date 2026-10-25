// Pomiar przeglądarkowy ekranu aktywnego treningu (zadanie 004, etap 9).
// Uzycie (z korzenia repo, serwer produkcyjny lub `next dev` na tym samym porcie):
//   E2E_EMAIL=... E2E_PASSWORD=... PERF_BASE=http://localhost:3101 PERF_OUT=<plik.json> \
//     node docs/wydajnosc/skrypty/004-active-workout-browser.mjs
// Wymaga konta testowego na lokalnej bazie `file:` (poza repo) i Microsoft Edge (kanał msedge).
// Warunki: viewport 360×640, DPR 2, CPU x4 (telefon klasy średniej), sieć „Regular 4G” (150 ms, 1,6 Mb/s w dół).
// Mierzy: czas do gotowości ekranu serii, LCP/CLS/FCP, długie zadania (longtask), opóźnienie
// wejście→następna klatka przy wpisywaniu ciężaru (proxy INP), liczbę zapisów do chmury
// (`/api/active-workout-session`, metody inne niż GET) w scenariuszach: wejście na serię,
// wpis ciężaru, zapis serii, edycja zapisanej serii.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.PERF_BASE ?? "http://localhost:3101";
const email = process.env.E2E_EMAIL?.trim();
const password = process.env.E2E_PASSWORD?.trim();
const OUT = process.env.PERF_OUT ?? null;
const RUNS = Number(process.env.PERF_RUNS ?? 5);

if (!email || !password) {
  console.error("Ustaw E2E_EMAIL i E2E_PASSWORD.");
  process.exit(1);
}

const set = (extra = {}) => ({ reps: 8, weight: 0, done: false, skipped: false, rpe: null, rir: 1, ...extra });
const last = (weight, reps, rir) => ({ reps, weight, done: true, skipped: false, rpe: null, rir });

/** Plan 7 ćwiczeń × 4 serie (typowy trening), pierwsze 3 ćwiczenia z historią, 2 pierwsze serie zapisane w ćwiczeniu 1. */
function session() {
  const names = [
    "Wyciskanie sztangi leżąc",
    "Wyciskanie hantli skos",
    "Rozpiętki na ławce",
    "Wiosłowanie sztangą",
    "Podciąganie",
    "Uginanie ramion",
    "Prostowanie ramion na wyciągu",
  ];
  return {
    state: {
      startedAt: Date.now() - 125_000,
      pausedElapsedSeconds: 0,
      workoutStartedAtMs: Date.now() - 125_000,
      title: "Push perf",
      workoutPlanId: "perf-plan",
      cardioMinutes: 0,
      cardioExtras: {},
      selectedExerciseId: "perf-0",
      exercises: names.map((name, i) => ({
        id: `perf-${i}`,
        name,
        sets: [0, 1, 2, 3].map(() => set()),
        targetSets: 4,
        targetReps: 8,
        targetRir: 1,
        lastSessionSets: i < 3 ? [last(65, 8, 2), last(65, 8, 2), last(65, 7, 1), last(65, 7, 1)] : undefined,
        suggestedWeights: i < 3 ? [67.5, 67.5, 65, 65] : undefined,
        coachContext: i < 3 ? { daysSinceLastSession: 5, recentSessionCount: 3, avgTopSetWeightKg: 65 } : undefined,
      })),
    },
    version: 2,
  };
}

const perfInit = () => {
  window.__perf = { lcp: 0, cls: 0, longTasks: [], fcp: 0, latencies: [] };
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.name === "first-contentful-paint") window.__perf.fcp = e.startTime;
      }
    }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perf.longTasks.push(Math.round(e.duration));
    }).observe({ type: "longtask", buffered: true });
  } catch {
    /* przeglądarka bez wpisu */
  }
  // Opóźnienie wejście → następna klatka (proxy INP): po obsłudze zdarzenia w bańce dokumentu, dwa rAF.
  document.addEventListener(
    "input",
    () => {
      const t0 = performance.now();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => window.__perf.latencies.push(Math.round((performance.now() - t0) * 10) / 10)),
      );
    },
    true,
  );
};

function stats(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return { n: s.length, p50: at(50), p95: at(95), max: s[s.length - 1] };
}

const browser = await chromium.launch({ channel: "msedge" });
const context = await browser.newContext({
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 2,
  locale: "pl-PL",
});
await context.addInitScript(() => {
  window.localStorage.setItem(
    "gymbrat_consent_v1",
    JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), analytics: false, marketing: false }),
  );
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

// Logowanie i czyszczenie sesji w chmurze (jak w e2e/active-workout.spec.ts).
await page.goto(`${BASE}/login`);
await page.getByLabel("Email").fill(email);
await page.getByLabel("Hasło", { exact: true }).fill(password);
await page.getByRole("button", { name: /^zaloguj się$/i }).click();
await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
await page.goto("about:blank");
await page.request.get(`${BASE}/api/csrf`);
const xsrf = (await context.cookies()).find((c) => c.name === "gymbrat_xsrf")?.value ?? "";
await page.request.delete(`${BASE}/api/active-workout-session`, {
  headers: { "x-xsrf-token": decodeURIComponent(xsrf) },
});

await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});

let pushes = [];
page.on("request", (req) => {
  if (req.url().includes("/api/active-workout-session") && req.method() !== "GET") {
    pushes.push({ t: Date.now(), method: req.method() });
  }
});

const results = { conditions: { viewport: "360x640", dpr: 2, cpuSlowdown: 4, network: "Regular 4G (150 ms, 1,6 Mb/s)", browser: "msedge", base: BASE, runs: RUNS }, open: [], keystrokes: {}, pushes: {} };

// 1. Otwarcie ekranu serii (cold-ish: nowa nawigacja, sesja z localStorage).
const openRuns = [];
// Init scripty rejestrowane raz (inaczej każdy przebieg dokładałby kolejne obserwatory).
await page.addInitScript((s) => {
  if (window.sessionStorage.getItem("perf-seeded")) return;
  window.sessionStorage.setItem("perf-seeded", "1");
  window.localStorage.setItem("active-workout", JSON.stringify(s));
}, session());
await page.addInitScript(perfInit);
for (let r = 0; r < RUNS; r++) {
  const t0 = Date.now();
  await page.goto(`${BASE}/active-workout`, { waitUntil: "domcontentloaded" });
  // Dialog wznowienia pojawia się tylko, gdy sesja jest w chmurze: czekamy na dowolny z dwóch stanów.
  const resume = page.getByRole("button", { name: "Kontynuuj" });
  const ready = page.getByRole("button", { name: "Zapisz serię 1" });
  await resume.or(ready).first().waitFor({ state: "visible", timeout: 60_000 });
  if (await resume.isVisible()) await resume.click();
  await ready.waitFor({ timeout: 60_000 });
  const readyMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  const perf = await page.evaluate(() => window.__perf);
  openRuns.push({
    readyMs,
    fcpMs: Math.round(perf.fcp),
    lcpMs: Math.round(perf.lcp),
    cls: Math.round(perf.cls * 1000) / 1000,
    longTasksMs: perf.longTasks,
  });
  // Czyszczenie init script przed kolejnym przebiegiem: nowa strona, ten sam kontekst.
  await page.evaluate(() => window.sessionStorage.removeItem("perf-seeded"));
}
results.open = {
  readyMs: stats(openRuns.map((r) => r.readyMs)),
  fcpMs: stats(openRuns.map((r) => r.fcpMs)),
  lcpMs: stats(openRuns.map((r) => r.lcpMs)),
  cls: stats(openRuns.map((r) => r.cls)),
  longTaskCountPerRun: stats(openRuns.map((r) => r.longTasksMs.length)),
  longTaskMsP95: stats(openRuns.flatMap((r) => r.longTasksMs)),
  raw: openRuns,
};

// Od tego miejsca jedna strona z załadowaną sesją (ostatnie przeładowanie).
// Bezczynność 9 s bez dotknięć: tylko okresowy zapis co ~8 s (PUSH_INTERVAL_MS), bez zapisu przy otwarciu serii.
pushes = [];
await page.waitForTimeout(9000);
results.pushes.bezczynnosc9s = pushes.length;
const latencyReset = () => page.evaluate(() => (window.__perf.latencies = []));

// 2. Przejście na serię 2 (bez wpisywania): oczekiwane 0 zapisów do chmury (LR-3).
pushes = [];
await page.getByRole("button", { name: "Seria 2, do zrobienia" }).click();
await page.waitForTimeout(2000);
results.pushes.wejscieNaSerie2 = pushes.length;

// 3. Wpis ciężaru w serii 2 (2 znaki), pauza 1,5 s: debounce 700 ms → oczekiwane 1 zapis.
await latencyReset();
pushes = [];
const weight = page.locator("#set-weight");
await weight.click();
await weight.press("Control+A");
await weight.pressSequentially("70", { delay: 60 });
await page.waitForTimeout(1500);
results.keystrokes.wpisCiezaru = {
  znaki: 2,
  latencjaWejscieNaKlatke: stats(await page.evaluate(() => window.__perf.latencies)),
};
results.pushes.wpisCiezaruNowaSeria = pushes.length;

// 4. Zapis serii 2 („Zapisz serię 2”): oczekiwany 1 natychmiastowy zapis, przejście na przerwę.
await latencyReset();
pushes = [];
const saveStart = Date.now();
await page.getByRole("button", { name: "Zapisz serię 2" }).click();
await page.getByRole("button", { name: /Zacznij serię 3/ }).waitFor({ timeout: 10_000 });
results.keystrokes.zapisSerii = { przejscieNaPrzerwe_ms: Date.now() - saveStart };
await page.waitForTimeout(1500);
results.pushes.zapisSerii = pushes.length;

// 5. Powrót na serię 2 (zapisaną) i edycja ciężaru: 3 znaki. Stan „zapisana” → każdy znak = natychmiastowy zapis (zachowanie sprzed zadania).
await page.getByRole("button", { name: "Zacznij serię 3" }).click();
await page.getByRole("button", { name: "Seria 2, zapisana: 70 kg × 8" }).click();
await page.waitForTimeout(1200);
await latencyReset();
pushes = [];
await weight.click();
await weight.press("Control+A");
await weight.pressSequentially("715", { delay: 60 });
await page.waitForTimeout(1500);
results.keystrokes.edycjaZapisanejSerii = {
  znaki: 3,
  latencjaWejscieNaKlatke: stats(await page.evaluate(() => window.__perf.latencies)),
};
results.pushes.edycjaZapisanejSerii = pushes.length;

await browser.close();

const out = JSON.stringify(results, null, 2);
if (OUT) fs.writeFileSync(OUT, out + "\n");
console.log(out);
