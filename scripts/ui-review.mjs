#!/usr/bin/env node
// Z69/Z74: zrzuty ekranów (mobile 375×667, 412×915, desktop 1280×800) i opcjonalnie audyt axe.
//   npm run build && npm start        # w osobnym terminalu
//   node scripts/ui-review.mjs --base=http://localhost:3000 --cookie="authjs.session-token=..." [--axe] [--out=tmp/ui-review]
// axe wymaga `npm i -D axe-core` (nie ma go w zależnościach). Wynik: <out>/<slug>-<viewport>.png + axe.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const body = a.replace(/^--/, "");
    const i = body.indexOf("=");
    return i < 0 ? [body, "1"] : [body.slice(0, i), body.slice(i + 1)];
  }),
);
const base = (args.base ?? "http://localhost:3000").replace(/\/$/, "");
const out = args.out ?? "tmp/ui-review";
const cookie = args.cookie ?? process.env.UI_REVIEW_COOKIE ?? "";

// 10 kluczowych ekranów (Z74) + ekrany z listy Z69.
const SCREENS = [
  "/", "/workout-plan", "/active-workout", "/meal-suggestions", "/nutrition/week", "/progress",
  "/reports?new=1", "/plany/atlas", "/plany/import", "/profile", "/community/teams",
  "/community/wars", "/community/challenges", "/admin/settings", "/admin/catalog", "/admin/branding",
];
const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 667 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "desktop", width: 1280, height: 800 },
];

mkdirSync(out, { recursive: true });
let axeSource = null;
if (args.axe) {
  try {
    const require = createRequire(import.meta.url);
    axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
  } catch {
    console.error("Brak axe-core: uruchom `npm i -D axe-core` i powtórz z --axe.");
    process.exit(2);
  }
}
const browser = await chromium.launch();
const axeResults = [];
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    // --state=e2e/.auth/user.json: sesja z Playwright (zamiast ręcznego cookie).
    ...(args.state ? { storageState: args.state } : {}),
  });
  // Bez banera cookies na zrzutach.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("gymbrat_consent_v1", JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), analytics: false, marketing: false }));
    } catch {}
  });
  if (cookie) {
    const [name, ...rest] = cookie.split("=");
    await ctx.addCookies([{ name, value: rest.join("="), url: base }]);
  }
  const page = await ctx.newPage();
  const consoleWarnings = [];
  page.on("console", (m) => {
    if (/width\(-?\d+\)|height\(-?\d+\)/.test(m.text())) consoleWarnings.push(m.text());
  });
  for (const path of SCREENS) {
    const slug = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "start";
    try {
      await page.goto(base + path, { waitUntil: "networkidle", timeout: 30000 });
      await page.screenshot({ path: `${out}/${slug}-${vp.name}.png`, fullPage: true });
      if (axeSource && vp.name === "mobile-375") {
        await page.evaluate(axeSource);
        const r = await page.evaluate(() => globalThis.axe.run());
        axeResults.push({
          path,
          violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
        });
      }
    } catch (e) {
      console.warn(`${path} @ ${vp.name}: ${String(e.message).slice(0, 80)}`);
    }
  }
  if (consoleWarnings.length) console.warn(`[${vp.name}] ostrzeżenia wymiarów wykresów:`, consoleWarnings.length);
  await ctx.close();
}
await browser.close();
if (axeSource) {
  writeFileSync(`${out}/axe.json`, JSON.stringify(axeResults, null, 2));
  const crit = axeResults.flatMap((r) => r.violations.filter((v) => v.impact === "critical" || v.impact === "serious"));
  console.log(`axe: krytyczne/poważne naruszenia: ${crit.length} (szczegóły: ${out}/axe.json)`);
  if (crit.length) process.exitCode = 1;
}
