#!/usr/bin/env node
// Z41: sprawdza budżety z docs/wydajnosc/budzety.json na uruchomionym serwerze (npm run build && npm start).
//   node scripts/perf-budget.mjs --base=http://localhost:3000 [--ci] [--cookie="authjs.session-token=..."] [--lighthouse]
// --ci: tylko strony publiczne (ci:true). Bez --cookie strony z auth są pomijane.
// --lighthouse: dodatkowo `npx lighthouse` (LCP) dla sprawdzanych stron (wymaga Chrome).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const body = a.replace(/^--/, "");
    const i = body.indexOf("=");
    return i < 0 ? [body, "1"] : [body.slice(0, i), body.slice(i + 1)];
  }),
);
const base = (args.base ?? "http://localhost:3000").replace(/\/$/, "");
const cookie = args.cookie ?? process.env.PERF_COOKIE ?? "";
const budgets = JSON.parse(readFileSync("docs/wydajnosc/budzety.json", "utf8")).pages;

let failed = 0;
const rows = [];
for (const b of budgets) {
  if (args.ci && !b.ci) continue;
  if (b.auth && !cookie) {
    rows.push({ path: b.path, status: "POMINIĘTO (brak --cookie)" });
    continue;
  }
  const t0 = performance.now();
  const res = await fetch(base + b.path, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  const ttfb = Math.round(performance.now() - t0);
  const html = await res.text();
  const kb = Math.round((Buffer.byteLength(html) / 1024) * 10) / 10;
  const problems = [];
  if (res.status >= 400) problems.push(`HTTP ${res.status}`);
  if (res.status >= 300 && res.status < 400) problems.push(`redirect ${res.status} (sesja?)`);
  if (kb > b.htmlKb) problems.push(`HTML ${kb} kB > ${b.htmlKb} kB`);
  if (ttfb > b.ttfbMs) problems.push(`TTFB ${ttfb} ms > ${b.ttfbMs} ms`);
  let lcp = null;
  if (args.lighthouse) {
    try {
      const out = execFileSync(
        "npx",
        ["lighthouse", base + b.path, "--quiet", "--chrome-flags=--headless=new --no-sandbox",
          "--only-categories=performance", "--output=json", "--output-path=stdout"],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );
      lcp = Math.round(JSON.parse(out).audits["largest-contentful-paint"].numericValue);
      if (lcp > b.lcpMs) problems.push(`LCP ${lcp} ms > ${b.lcpMs} ms`);
    } catch (e) {
      problems.push(`lighthouse: ${String(e.message).slice(0, 80)}`);
    }
  }
  if (problems.length) failed += 1;
  rows.push({ path: b.path, htmlKb: kb, ttfbMs: ttfb, lcpMs: lcp, status: problems.length ? problems.join("; ") : "OK" });
}
console.table(rows);
if (failed) {
  console.error(`Przekroczone budżety: ${failed}`);
  process.exit(1);
}
