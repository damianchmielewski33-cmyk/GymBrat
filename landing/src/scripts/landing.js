// Interaktywne demo landingu GymBrat. Wszystkie dane są przykładowe (oznaczone w UI).
const $ = (id) => document.getElementById(id);
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const nb = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const f1 = (n) => String(Math.round(n * 10) / 10).replace(".", ",");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Przyciski-przełączniki: renderuje grupę i woła onPick(i). */
function toggles(el, names, current, onPick) {
  el.innerHTML = names.map((n, i) => `<button type="button" class="tg" aria-pressed="${i === current}" data-i="${i}">${esc(n)}</button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("button[data-i]");
    if (b) onPick(Number(b.dataset.i));
  };
}

/* ------------------------------ hero: serie ------------------------------ */
(() => {
  let weight = 80, reps = 8, rest = 0, sets = [];
  const log = $("set-log");
  const paint = () => {
    $("w-val").textContent = String(weight).replace(".", ",");
    $("r-val").textContent = reps;
    $("tonnage").textContent = nb(sets.reduce((a, s) => a + s.w * s.r, 0)) + " kg";
    const mm = String(Math.floor(rest / 60)).padStart(2, "0"), ss = String(rest % 60).padStart(2, "0");
    $("rest-clock").textContent = `${mm}:${ss}`;
    $("rest-text").textContent = rest > 0 ? "Przerwa, odpoczywaj" : "Przerwa startuje po zapisaniu serii";
  };
  const paintLog = () => {
    log.innerHTML = sets.length
      ? sets.map((s, i) => `<div class="log-row"><span class="muted">Seria ${i + 1}</span><span class="num">${String(s.w).replace(".", ",")} kg × ${s.r}</span></div>`).join("")
      : '<p class="muted" style="font-size:14px;margin:12px 0 0">Zapisz pierwszą serię, żeby zobaczyć tonaż i start przerwy.</p>';
  };
  $("w-up").onclick = () => { weight += 2.5; paint(); };
  $("w-down").onclick = () => { weight = Math.max(0, weight - 2.5); paint(); };
  $("r-up").onclick = () => { reps += 1; paint(); };
  $("r-down").onclick = () => { reps = Math.max(1, reps - 1); paint(); };
  $("save-set").onclick = () => { sets.push({ w: weight, r: reps }); rest = 90; paint(); paintLog(); };
  $("clear-sets").onclick = () => { sets = []; rest = 0; paint(); paintLog(); };
  setInterval(() => { if (rest > 0) { rest -= 1; paint(); } }, 1000);
  paint();

  // delikatne pochylenie karty za kursorem (tylko mysz, bez reduced-motion)
  const card = $("demo-card");
  if (!reduced && window.matchMedia("(hover: hover)").matches) {
    card.addEventListener("mousemove", (ev) => {
      const r = card.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg)`;
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  }

  // film w hero (jeśli ustawiono PUBLIC_HERO_VIDEO): ładowany dopiero po wejściu w widok, dźwięk tylko po kliknięciu
  const video = $("hero-video");
  if (video) {
    const start = () => {
      if (!video.src) video.src = video.dataset.src;
      if (!reduced) video.play().catch(() => {});
    };
    new IntersectionObserver((en) => { if (en[0].isIntersecting) start(); else video.pause(); }, { threshold: 0.3 }).observe(video);
    const sound = $("sound-btn");
    sound.onclick = () => {
      video.muted = !video.muted;
      sound.setAttribute("aria-pressed", String(!video.muted));
      sound.textContent = video.muted ? "Włącz dźwięk" : "Wyłącz dźwięk";
      if (!video.muted) video.play().catch(() => {});
    };
  }
})();

/* --------------------------------- dieta --------------------------------- */
(() => {
  const FD = [["Owsianka z owocami", 350, 12, 58, 8], ["Jajka (3 szt.)", 210, 18, 1, 15], ["Kurczak z ryżem", 650, 48, 75, 14], ["Łosoś z batatem", 520, 36, 42, 22], ["Skyr z orzechami", 240, 22, 14, 10], ["Banan", 105, 1, 27, 0], ["Shake białkowy", 160, 30, 4, 2], ["Kanapka z indykiem", 380, 28, 40, 10]];
  const GOAL = 2200, GM = [["Białko", 160], ["Węglowodany", 250], ["Tłuszcze", 70]];
  let on = FD.map(() => false);
  const foods = $("foods");
  const draw = () => {
    foods.innerHTML = FD.map((x, i) => `<button type="button" class="tg" aria-pressed="${on[i]}" data-i="${i}">${esc(x[0])}</button>`).join("");
    const sel = FD.filter((_, i) => on[i]);
    const sum = (k) => sel.reduce((a, x) => a + x[k], 0);
    const kc = sum(1), over = kc > GOAL, got = [sum(2), sum(3), sum(4)];
    $("kcal-left").textContent = nb(over ? kc - GOAL : GOAL - kc);
    $("kcal-word").textContent = over ? "ponad cel" : "kcal zostało";
    const ring = $("ring");
    ring.setAttribute("stroke-dashoffset", (364.4 * (1 - Math.min(1, kc / GOAL))).toFixed(1));
    ring.setAttribute("stroke", over ? "#ff9f43" : "#dcb862");
    $("ring-svg").setAttribute("aria-label", `Zjedzono ${kc} z ${GOAL} kcal, ${over ? "ponad cel o " + (kc - GOAL) : "zostało " + (GOAL - kc)} kcal`);
    $("macros").innerHTML = GM.map((m, i) => `<div><div class="pr"><span style="font-weight:600">${m[0]}</span><span class="muted"><span style="color:var(--text)">${got[i]}</span> / ${m[1]}&nbsp;g</span></div><div class="bar2" style="margin-top:6px"><i class="${got[i] > m[1] ? "ov" : ""}" style="width:${Math.min(100, Math.round(got[i] / m[1] * 100))}%"></i></div></div>`).join("");
  };
  foods.onclick = (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    const i = Number(b.dataset.i);
    on[i] = !on[i];
    draw();
    foods.querySelector(`[data-i="${i}"]`).focus();
  };
  $("foods-clear").onclick = () => { on = FD.map(() => false); draw(); };
  draw();
})();

/* -------------------------------- analiza -------------------------------- */
(() => {
  const AR = [
    { n: "7 dni", l: ["pon", "wt", "śr", "czw", "pt", "sob", "nd"], v: [106, 107, 107, 108, 108, 109, 110] },
    { n: "30 dni", l: ["t1", "t2", "t3", "t4", "dziś"], v: [101, 103, 105, 108, 110] },
    { n: "90 dni", l: ["m1", "m1,5", "m2", "m2,5", "m3", "m3,5", "dziś"], v: [92, 95, 97, 100, 103, 106, 110] },
  ];
  const CM = [
    { name: "Poprzedni i ten tydzień", rows: [["Treningi", 3, 4, (x) => x], ["Tonaż", 35200, 43000, (x) => nb(x) + " kg"], ["Cardio", 180, 215, (x) => x + " min"]] },
    { name: "Dwa tygodnie temu i ten", rows: [["Treningi", 4, 4, (x) => x], ["Tonaż", 42300, 43000, (x) => nb(x) + " kg"], ["Cardio", 170, 215, (x) => x + " min"]] },
  ];
  let range = 1, sel = 4, cmp = 0;
  const L = 38, R = 334, T = 40, B = 148;
  const smooth = (q) => { let d = `M${q[0][0].toFixed(1)},${q[0][1].toFixed(1)}`; for (let i = 0; i < q.length - 1; i++) { const a = q[i - 1] || q[i], b = q[i], c = q[i + 1], e = q[i + 2] || c; d += ` C${(b[0] + (c[0] - a[0]) / 6).toFixed(1)},${(b[1] + (c[1] - a[1]) / 6).toFixed(1)} ${(c[0] - (e[0] - b[0]) / 6).toFixed(1)},${(c[1] - (e[1] - b[1]) / 6).toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`; } return d; };
  const chart = $("chart");
  function drawChart() {
    const cur = AR[range], vals = cur.v, n = vals.length, idx = Math.min(sel, n - 1);
    const mn = Math.min(...vals) - 2, mx = Math.max(...vals) + 2, st = (R - L) / (n - 1);
    const pts = vals.map((v, i) => [L + i * st, B - ((v - mn) / (mx - mn)) * (B - T)]);
    const line = smooth(pts), area = `${line} L${pts[n - 1][0].toFixed(1)},${B} L${pts[0][0].toFixed(1)},${B} Z`;
    const bx = Math.max(L - 10, Math.min(R - 68, pts[idx][0] - 39));
    const grid = [0, 1, 2, 3].map((i) => { const y = T + (i * (B - T)) / 3; return `<line x1="38" y1="${y.toFixed(0)}" x2="336" y2="${y.toFixed(0)}" stroke="#26231c"/><text x="0" y="${(y + 4).toFixed(0)}" fill="#b3ab9b" font-size="12">${Math.round(mx - (i * (mx - mn)) / 3)}</text>`; }).join("");
    chart.innerHTML = `<defs><linearGradient id="gla" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcb862" stop-opacity=".38"/><stop offset="1" stop-color="#dcb862" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${area}" fill="url(#gla)"/><path d="${line}" fill="none" stroke="#dcb862" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${pts.map((q) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="3.5" fill="#0c0c0e" stroke="#dcb862" stroke-width="2"/>`).join("")}<line x1="${pts[idx][0].toFixed(1)}" y1="40" x2="${pts[idx][0].toFixed(1)}" y2="148" stroke="#f6e3a1" stroke-opacity=".5" stroke-dasharray="3 3"/><circle cx="${pts[idx][0].toFixed(1)}" cy="${pts[idx][1].toFixed(1)}" r="6" fill="#f6e3a1" stroke="#b58f3e" stroke-width="2"/><rect x="${bx.toFixed(0)}" y="0" width="78" height="34" rx="9" fill="#0c0c0e" stroke="#dcb862"/><text x="${(bx + 39).toFixed(0)}" y="15" text-anchor="middle" fill="#f6e3a1" font-size="15" font-weight="700">${vals[idx]} kg</text><text x="${(bx + 39).toFixed(0)}" y="28" text-anchor="middle" fill="#b3ab9b" font-size="11">${cur.l[idx]}</text>${pts.map((q, i) => `<text x="${q[0].toFixed(0)}" y="166" text-anchor="middle" fill="#b3ab9b" font-size="11">${cur.l[i]}</text>`).join("")}`;
    chart.setAttribute("aria-label", `Szacowany max wyciskania, ${cur.n}: od ${vals[0]} do ${vals[n - 1]} kg. Wybrany punkt: ${vals[idx]} kg`);
    $("a-label").textContent = cur.l[idx];
    $("a-val").textContent = vals[idx];
    const dl = idx > 0 ? vals[idx] - vals[idx - 1] : null, dEl = $("a-delta");
    dEl.textContent = dl == null ? "pierwszy punkt" : `${dl > 0 ? "+" : dl < 0 ? "−" : ""}${Math.abs(dl)} kg vs poprzedni`;
    dEl.style.color = dl == null ? "#b3ab9b" : dl > 0 ? "#3ecf72" : dl < 0 ? "#ff9f43" : "#b3ab9b";
    toggles($("a-ranges"), AR.map((r) => r.n), range, (i) => { range = i; sel = AR[i].v.length - 1; drawChart(); });
    chart._n = n; chart._st = st;
  }
  const pick = (ev) => {
    const r = chart.getBoundingClientRect(), cx = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
    sel = Math.max(0, Math.min(chart._n - 1, Math.round((((cx - r.left) / r.width) * 340 - L) / chart._st)));
    drawChart();
  };
  chart.addEventListener("mousemove", pick);
  chart.addEventListener("click", pick);
  chart.addEventListener("touchstart", pick, { passive: true });
  chart.addEventListener("touchmove", pick, { passive: true });
  $("a-prev").onclick = () => { sel = Math.max(0, Math.min(sel, AR[range].v.length - 1) - 1); drawChart(); };
  $("a-next").onclick = () => { sel = Math.min(AR[range].v.length - 1, sel + 1); drawChart(); };
  drawChart();

  function drawCmp() {
    toggles($("cmp-sets"), CM.map((c) => c.name), cmp, (i) => { cmp = i; drawCmp(); });
    $("cmp-rows").innerHTML = CM[cmp].rows.map((r) => {
      const d = r[1] > 0 ? ((r[2] - r[1]) / r[1]) * 100 : 0, m = Math.max(r[1], r[2]);
      const flat = Math.abs(d) < 0.5, col = flat ? "#b3ab9b" : d > 0 ? "#3ecf72" : "#ff9f43";
      const pct = flat ? "bez zmian" : `${d > 0 ? "+" : "−"}${Math.abs(Math.round(d))}%`;
      return `<div class="cmp"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-weight:600;font-size:15px">${r[0]}</span><span style="font-size:13px;font-weight:600;color:${col}">${pct}</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:8px"><div class="bar2" style="flex:1"><i style="width:${Math.round((r[1] / m) * 100)}%;background:#716a5b"></i></div><span class="muted" style="font-size:13px;min-width:78px;text-align:right">${r[3](r[1])}</span></div><div style="display:flex;align-items:center;gap:10px;margin-top:5px"><div class="bar2" style="flex:1"><i style="width:${Math.round((r[2] / m) * 100)}%"></i></div><span style="font-size:13px;min-width:78px;text-align:right">${r[3](r[2])}</span></div></div>`;
    }).join("");
  }
  drawCmp();
})();

/* ---------------------------------- plan ---------------------------------- */
(() => {
  const PL = [
    { name: "Push A", ex: [["Wyciskanie sztangi", "4 × 8", "80 kg"], ["Wyciskanie hantli skos", "3 × 10", "28 kg"], ["Rozpiętki", "3 × 12", "14 kg"], ["Wyciskanie nad głowę", "3 × 8", "45 kg"], ["Prostowanie ramion na wyciągu", "3 × 12", "25 kg"]] },
    { name: "Pull A", ex: [["Martwy ciąg", "3 × 5", "120 kg"], ["Podciąganie", "4 × 8", "+10 kg"], ["Wiosłowanie sztangą", "3 × 10", "60 kg"], ["Face pull", "3 × 15", "20 kg"], ["Uginanie hantli", "3 × 12", "14 kg"]] },
    { name: "Nogi A", ex: [["Przysiad", "4 × 6", "100 kg"], ["Wykroki", "3 × 10", "24 kg"], ["Uginanie nóg", "3 × 12", "40 kg"], ["Wspięcia na palce", "4 × 15", "80 kg"]] },
  ];
  let day = 0;
  const draw = () => {
    toggles($("plan-days"), PL.map((d) => d.name), day, (i) => { day = i; draw(); $("plan-days").querySelector(`[data-i="${i}"]`).focus(); });
    const ex = PL[day].ex;
    $("plan-meta").textContent = `${ex.length} ćwiczeń · przykładowy plan`;
    $("plan-rows").innerHTML = ex.map((e, i) => `<div class="ex" style="animation-delay:${i * 0.06}s"><div><div style="font-weight:600;font-size:16px">${e[0]}</div><div class="muted" style="font-size:13px">${e[1]} serie</div></div><div class="num" style="font-size:28px">${e[2]}</div></div>`).join("");
  };
  draw();
})();

/* --------------------------------- raport --------------------------------- */
(() => {
  const view = $("rview"), track = $("rtrack");
  let pan = 0;
  const apply = () => {
    const max = Math.max(0, track.scrollWidth - view.clientWidth);
    track.style.transform = `translateX(-${Math.round(max * pan)}px)`;
    $("card-no").textContent = Math.min(6, Math.round(pan * 5) + 1);
    $("pan-bar").style.width = Math.round((0.15 + pan * 0.85) * 100) + "%";
  };
  const move = (ev) => {
    const r = view.getBoundingClientRect(), cx = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
    pan = Math.max(0, Math.min(1, (cx - r.left) / r.width));
    apply();
  };
  view.addEventListener("mousemove", move);
  view.addEventListener("touchstart", move, { passive: true });
  view.addEventListener("touchmove", move, { passive: true });
  $("pan-left").onclick = () => { pan = Math.max(0, pan - 0.25); apply(); };
  $("pan-right").onclick = () => { pan = Math.min(1, pan + 0.25); apply(); };
  window.addEventListener("resize", apply);
  apply();
})();

/* ------------------------------- kalkulator ------------------------------- */
(() => {
  let sex = "m", act = 1, goal = 1;
  const state = { w: 75, h: 178, a: 30 };
  let shown = { k: 0, p: 0, c: 0, f: 0 };
  const target = () => {
    // Mifflin–St Jeor; mnożniki aktywności i celu są uproszczone (orientacyjnie).
    const bmr = 10 * state.w + 6.25 * state.h - 5 * state.a + (sex === "m" ? 5 : -161);
    const k = bmr * [1.375, 1.55, 1.725][act] * [0.85, 1, 1.1][goal];
    const p = state.w * [2.0, 1.6, 1.8][goal], f = (k * 0.25) / 9, c = Math.max(0, (k - p * 4 - f * 9) / 4);
    return { k, p, c, f };
  };
  const paintStatic = () => {
    toggles($("c-sex"), ["Kobieta", "Mężczyzna"], sex === "f" ? 0 : 1, (i) => { sex = i === 0 ? "f" : "m"; paintStatic(); tick(true); });
    toggles($("c-act"), ["Mało (1–2 treningi)", "Średnio (3–4)", "Dużo (5+)"], act, (i) => { act = i; paintStatic(); tick(true); });
    toggles($("c-goal"), ["Redukcja", "Utrzymanie", "Masa"], goal, (i) => { goal = i; paintStatic(); tick(true); });
  };
  const render = (t) => {
    $("r-kcal").textContent = nb(shown.k);
    const share = [t.p * 4 / t.k, t.c * 4 / t.k, t.f * 9 / t.k];
    $("r-macros").innerHTML = [["Białko", shown.p], ["Węglowodany", shown.c], ["Tłuszcze", shown.f]].map((m, i) => `<div><div class="pr"><span style="font-weight:600">${m[0]}</span><span><b>${Math.round(m[1])}</b> g</span></div><div class="bar2" style="margin-top:6px"><i style="width:${Math.round(share[i] * 100)}%"></i></div></div>`).join("");
  };
  let timer = 0;
  function tick(restart) {
    const t = target();
    if (reduced) { shown = { ...t }; render(t); return; }
    if (restart && timer) cancelAnimationFrame(timer);
    const step = () => {
      let ch = false;
      for (const key of ["k", "p", "c", "f"]) {
        const d = t[key] - shown[key];
        const nx = Math.abs(d) > 0.5 ? shown[key] + d * 0.2 : t[key];
        if (nx !== shown[key]) ch = true;
        shown[key] = nx;
      }
      render(t);
      if (ch) timer = requestAnimationFrame(step);
    };
    step();
  }
  for (const [id, key, out] of [["cw", "w", "cw-v"], ["ch", "h", "ch-v"], ["ca", "a", "ca-v"]]) {
    $(id).addEventListener("input", (e) => { state[key] = Number(e.target.value); $(out).textContent = e.target.value; tick(true); });
  }
  paintStatic();
  tick(true);
})();

/* -------------------------------- iPhone PWA -------------------------------- */
(() => {
  const ST = [
    ["Otwórz stronę w Safari", "Wejdź na adres aplikacji w Safari. W innych przeglądarkach na iPhonie opcja dodania może się nie pojawić."],
    ["Stuknij „Udostępnij”", "Kwadrat ze strzałką w górę, na dole ekranu."],
    ["Dodaj do ekranu początkowego", "Przewiń listę w dół, wybierz tę opcję i stuknij Dodaj."],
    ["Otwieraj z ikony", "Aplikacja startuje pełnoekranowo, bez paska adresu. Zaloguj się lub załóż konto."],
  ];
  let step = 0;
  const draw = () => {
    $("ip-steps").innerHTML = ST.map((s, i) => `<button type="button" class="stp" aria-pressed="${i === step}" data-i="${i}"><span class="n">${i + 1}</span><span><b style="display:block;font-size:17px">${s[0]}</b><span class="muted" style="font-size:14px;line-height:1.5">${s[1]}</span></span></button>`).join("");
    document.querySelectorAll("[data-scene]").forEach((el) => el.classList.toggle("on", Number(el.dataset.scene) === step));
    $("ip-alt").setAttribute("aria-label", `Krok ${step + 1} z 4: ${ST[step][0]}`);
  };
  $("ip-steps").onclick = (e) => { const b = e.target.closest("button[data-i]"); if (b) { step = Number(b.dataset.i); draw(); $("ip-steps").querySelector(`[data-i="${step}"]`).focus(); } };
  $("ip-prev").onclick = () => { step = Math.max(0, step - 1); draw(); };
  $("ip-next").onclick = () => { step = Math.min(3, step + 1); draw(); };
  draw();
})();

/* --------------------------------- cennik --------------------------------- */
(() => {
  let per = 0;
  const draw = () => {
    toggles($("per"), ["Miesiąc", "3 miesiące", "6 miesięcy"], per, (i) => { per = i; draw(); $("per").querySelector(`[data-i="${i}"]`).focus(); });
    $("per-days").textContent = ["30 dni", "90 dni", "180 dni"][per];
  };
  draw();
})();

/* ---------------------- zapis na powiadomienie (waitlist) ---------------------- */
(() => {
  const form = $("wl-form"), msg = $("wl-msg");
  const say = (text, kind) => { msg.textContent = text; msg.className = "msg " + (kind || ""); };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    if (!email || !form.elements.email.checkValidity()) return say("Podaj poprawny adres e-mail.", "err");
    if (!form.elements.consent.checked) return say("Zaznacz zgodę na jednorazowy e-mail o premierze.", "err");
    const btn = $("wl-submit");
    btn.disabled = true;
    say("Wysyłanie…");
    try {
      const res = await fetch(form.dataset.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true, website: String(fd.get("website") || "") }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
        say("Sprawdź skrzynkę: wysłaliśmy link potwierdzający. Zapis jest ważny po kliknięciu w link.", "ok");
      } else {
        say(data.error || "Nie udało się zapisać. Spróbuj później.", "err");
      }
    } catch {
      say("Brak połączenia. Spróbuj ponownie.", "err");
    } finally {
      btn.disabled = false;
    }
  });
  // powrót z linku w e-mailu (?waitlist=ok|expired|unsub)
  const q = new URLSearchParams(location.search).get("waitlist");
  const texts = { ok: "Dziękujemy, zapis potwierdzony. Napiszemy raz, w dniu premiery.", unsub: "Wypisano z listy. Nie wyślemy już żadnych wiadomości.", expired: "Link wygasł lub jest nieprawidłowy. Zapisz się ponownie w sekcji „Pobierz”." };
  if (q && texts[q]) {
    const f = $("flash");
    f.textContent = texts[q];
    f.hidden = false;
    history.replaceState(null, "", location.pathname + location.hash);
  }
})();

/* ------------------------------ wejścia sekcji ------------------------------ */
(() => {
  const els = document.querySelectorAll(".reveal");
  if (reduced || !("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { threshold: 0.15 });
  els.forEach((e) => io.observe(e));
})();
