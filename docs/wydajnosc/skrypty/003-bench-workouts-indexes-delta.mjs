// Delta 003: EXPLAIN + czasy zapytań ekranu Trening/Home dla wariantów indeksów oraz narzut INSERT.
// Użycie: node docs/wydajnosc/skrypty/003-bench-workouts-indexes-delta.mjs <plik.db> <sesji_na_uzytkownika> [uzytkownikow=300]
import { createClient } from "@libsql/client";
import fs from "node:fs";
const f = process.argv[2], PER = Number(process.argv[3]), USERS = Number(process.argv[4] ?? 300);
try { fs.unlinkSync(f); } catch {}
let c = createClient({ url: "file:" + f });
await c.execute("create table workouts(id text primary key,user_id text not null,workout_plan_id text,date text not null,cardio_minutes integer not null default 0,exercises text not null)");
const ex = JSON.stringify({ exercises: Array.from({ length: 6 }, (_, i) => ({ id: "e" + i, name: "Ex" + i, sets: Array.from({ length: 4 }, () => ({ reps: 8, weight: 80, done: true })) })), pad: "p".repeat(3000) });
const tx = await c.transaction("write"); let k = 0;
for (let u = 0; u < USERS; u++) for (let i = 0; i < PER; i++) {
  const d = new Date(Date.UTC(2022, 0, 1) + i * 86400000 * (1750 / PER)).toISOString().slice(0, 10);
  await tx.execute({ sql: "insert into workouts values(?,?,?,?,?,?)", args: [`w${k++}`, `u${u}`, `p${u}_${i % 5}`, d, i % 4 === 0 ? 20 : 0, ex] });
}
await tx.commit();
const today = "2026-10-24", from12w = "2026-08-03", from52w = "2025-10-24";
const qs = {
  maxDate: `select workout_plan_id, max(date) from workouts where user_id='u7' and workout_plan_id is not null group by workout_plan_id`,
  last1: `select exercises from workouts where user_id='u7' and workout_plan_id='p7_2' order by date desc, rowid desc limit 1`,
  statsWindow: `select id,date,cardio_minutes,exercises from workouts where user_id='u7' and date>='${from12w}' and date<='${today}' order by date desc, id desc`,
  streak52w: `select date from workouts where user_id='u7' and date>='${from52w}' and date<='${today}'`,
  homeRecent40: `select id,date,exercises from workouts where user_id='u7' order by date desc, id desc limit 40`,
  homeCardio: `select date,cardio_minutes,exercises from workouts where user_id='u7' and date>='${from12w}' and date<='${today}' and cardio_minutes>0 order by date desc limit 20`,
  ghostSelf5: `select id,date,workout_plan_id from workouts where user_id='u7' order by date desc limit 5`,
  ghostPlan3: `select id,date,workout_plan_id from workouts where user_id='u7' and workout_plan_id='p7_2' order by date desc limit 3`,
  countDistinct: `select count(distinct date) from workouts where user_id='u7' and date>='${from12w}' and date<='${today}'`,
};
async function run(label) {
  for (const [n, q] of Object.entries(qs)) {
    const plan = (await c.execute("explain query plan " + q)).rows.map(r => r.detail).join(" | ");
    const t = []; let rows = 0;
    for (let i = 0; i < 15; i++) { const s = performance.now(); rows = (await c.execute(q)).rows.length; t.push(performance.now() - s); }
    t.sort((a, b) => a - b);
    console.log(`${label}\t${n}\tp50=${t[7].toFixed(2)}ms\trows=${rows}\t${plan}`);
  }
}
await run("NOIDX");
await c.execute("create index idx_a on workouts(user_id, workout_plan_id, date)");
await run("PLAN_ONLY");
await c.execute("create index idx_b on workouts(user_id, date)");
await run("BOTH");
console.log("rows", (await c.execute("select count(*) c from workouts")).rows[0].c, "MB", (fs.statSync(f).size / 1e6).toFixed(0));
// narzut INSERT: 3 tabele o tej samej zawartości (próbka 20k) z 1/2/3 indeksami
const sample = 20000;
for (const [name, idx] of [["t1", []], ["t2", ["(user_id, workout_plan_id, date)"]], ["t3", ["(user_id, workout_plan_id, date)", "(user_id, date)"]]]) {
  await c.execute(`create table ${name}(id text primary key,user_id text not null,workout_plan_id text,date text not null,cardio_minutes integer not null default 0,exercises text not null)`);
  for (const [i, d] of idx.entries()) await c.execute(`create index ${name}_i${i} on ${name}${d}`);
  await c.execute(`insert into ${name} select * from workouts limit ${sample}`);
  const t = [];
  for (let i = 0; i < 300; i++) { const s = performance.now(); await c.execute({ sql: `insert into ${name} values(?,?,?,?,0,?)`, args: [`n${i}`, "u7", "p7_2", today, ex] }); t.push(performance.now() - s); }
  t.sort((a, b) => a - b);
  console.log("INSERT", name, "idx=" + (idx.length + 1), `p50=${t[150].toFixed(3)}ms p95=${t[285].toFixed(3)}ms`);
}
