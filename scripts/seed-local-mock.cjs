/* Lokalne dane mock do przeglądu ekranów (tylko file:./local.db). Uruchom: node scripts/seed-local-mock.cjs */
const { createClient } = require("@libsql/client");
const { hashSync } = require("bcryptjs");
const crypto = require("crypto");

const URL = process.env.TURSO_DATABASE_URL || "file:./local.db";
if (!URL.startsWith("file:")) {
  console.error("Odmowa: seed mock tylko dla lokalnej bazy file:");
  process.exit(1);
}
const c = createClient({ url: URL });
const PASSWORD = process.env.MOCK_PASSWORD || "Mock-Local-1234";
const day = 86_400_000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

async function user(email, first, role, packageDays) {
  const id = crypto.randomUUID();
  const now = Date.now();
  await c.execute({
    sql: `insert or ignore into users (id,email,password_hash,name,first_name,last_name,weight_kg,height_cm,age,sex,activity_level,app_role,package_ends_at,email_verified_at,session_version,created_at)
          values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
    args: [id, email, hashSync(PASSWORD, 10), `${first} Mock`, first, "Mock", 82.5, 180, 29, "male", "medium", role,
      packageDays ? now + packageDays * day : null, now, now - 60 * day],
  });
  const [r] = (await c.execute({ sql: "select id from users where email=?", args: [email] })).rows;
  await c.execute({ sql: "insert or ignore into user_settings (user_id,updated_at) values (?,?)", args: [r.id, now] });
  return r.id;
}

(async () => {
  const uid = await user("mock.user@gymbrat.test", "Marek", "zawodnik", 0);
  const fid = await user("mock.friend@gymbrat.test", "Ola", "zawodnik", 30);
  await user("mock.admin@gymbrat.test", "Admin", "admin", 0);
  const now = Date.now();
  for (const [u, base] of [[uid, 84], [fid, 61]]) {
    for (let i = 0; i < 12; i++) {
      await c.execute({
        sql: "insert or ignore into weight_logs (id,user_id,recorded_at,weight_kg) values (?,?,?,?)",
        args: [`mock-w-${u}-${i}`, u, now - i * 5 * day, +(base - i * 0.25).toFixed(1)],
      });
    }
    for (let i = 0; i < 10; i++) {
      const ex = [
        { name: "Wyciskanie sztangi leżąc", sets: [0, 1, 2].map((s) => ({ reps: 8 - s, weight: 70 + i + s * 2.5, done: true })) },
        { name: "Przysiad ze sztangą", sets: [0, 1, 2].map((s) => ({ reps: 6, weight: 100 + i * 2, done: true })) },
      ];
      await c.execute({
        sql: "insert or ignore into workouts (id,user_id,date,cardio_minutes,exercises,tonnage_kg,operation_id) values (?,?,?,?,?,?,?)",
        args: [`mock-t-${u}-${i}`, u, iso(now - i * 3 * day), i % 3 === 0 ? 20 : 0, JSON.stringify(ex), 2400 + i * 60, `mock-op-${u}-${i}`],
      });
    }
    for (let i = 0; i < 4; i++) {
      await c.execute({
        sql: "insert or ignore into meal_logs (id,user_id,date,calories,protein_g,fat_g,carbs_g,created_at) values (?,?,?,?,?,?,?,?)",
        args: [`mock-m-${u}-${i}`, u, iso(now), 450 + i * 120, 30 + i * 5, 12 + i * 3, 50 + i * 10, now - i * 3600_000],
      });
    }
  }
  console.log("OK. Konta: mock.user / mock.friend / mock.admin @gymbrat.test, hasło z MOCK_PASSWORD lub domyślne dev.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
