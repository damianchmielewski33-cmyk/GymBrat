// Użycie (z korzenia repo, wymaga @libsql/client): node docs/wydajnosc/skrypty/003-bench-workouts-scan.mjs <plik.db> <sesji_na_uzytkownika>
// Tworzy 300 użytkowników x N sesji (JSON ok. 3 KB), mierzy zapytania z ekranu Trening przed i po dodaniu indeksu (user_id, workout_plan_id, date).
import { createClient } from "@libsql/client";
import fs from "node:fs";
const f = process.argv[2];
try{fs.unlinkSync(f)}catch{}
const c = createClient({ url: "file:" + f });
await c.execute("create table workouts(id text primary key,user_id text not null,workout_plan_id text,date text not null,cardio_minutes integer not null default 0,exercises text not null)");
const mk=(n)=>JSON.stringify({title:"x",exercises:Array.from({length:6},(_,i)=>({id:"e"+i,name:"Ex"+i,sets:Array.from({length:4},()=>({reps:8,weight:80,done:true}))})),pad:"p".repeat(n)});
const ex = mk(3000);
const USERS=300, PER=Number(process.argv[3]); // sessions/user
const tx = await c.transaction("write");
let k=0;
for(let u=0;u<USERS;u++){ for(let i=0;i<PER;i++){ const d=new Date(Date.UTC(2021,0,1)+i*86400000*(1826/PER)).toISOString().slice(0,10);
 await tx.execute({sql:"insert into workouts values(?,?,?,?,0,?)",args:[`w${k++}`,`u${u}`,`p${u}_${i%5}`,d,ex]});}}
await tx.commit();
const qs={
 maxDate:["select workout_plan_id, max(date) from workouts where user_id='u7' and workout_plan_id is not null group by workout_plan_id"],
 last1:["select exercises from workouts where user_id='u7' and workout_plan_id='p7_2' order by date desc, rowid desc limit 1"],
};
for(const [n,[q]] of Object.entries(qs)){
 const plan=(await c.execute("explain query plan "+q)).rows.map(r=>r.detail);
 const t=[];for(let i=0;i<20;i++){const s=performance.now();await c.execute(q);t.push(performance.now()-s);}
 t.sort((a,b)=>a-b);
 console.log(n,"plan:",plan.join(" | "),"p50ms",t[10].toFixed(2));
}
await c.execute("create index idx_w on workouts(user_id, workout_plan_id, date)");
for(const [n,[q]] of Object.entries(qs)){
 const plan=(await c.execute("explain query plan "+q)).rows.map(r=>r.detail);
 const t=[];for(let i=0;i<20;i++){const s=performance.now();await c.execute(q);t.push(performance.now()-s);}
 t.sort((a,b)=>a-b);
 console.log("WITH INDEX",n,"plan:",plan.join(" | "),"p50ms",t[10].toFixed(2));
}
console.log("rows",(await c.execute("select count(*) c from workouts")).rows[0].c, "size MB",(fs.statSync(f).size/1e6).toFixed(0));
