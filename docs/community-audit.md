# Audyt Community — wyniki i remedacje

Data: 2026-10-17 · Zakres: UI · UX · a11y · security · performance · mobile · desktop

Inspiracje: Apple Fitness, Whoop, Strava, Discord.

---

## Werdykt

Community jest spójne z GymBrat (metal + gold, mobile-first shell). Po tej rundzie: **presence IDOR zamknięty**, progressbary a11y, empty states, ranking „podium”, hub Teams z chipami, cele ~44px, live regions na feed/chat/badge.

Pozostałe ryzyka (nie blokujące UX): Fair Ranking / zaufanie do client workout metrics (MEDIUM) — osobny epic.

---

## Per ekran

### `/community/teams`
| Problem | Status |
|---------|--------|
| CTA poza thumb zone | ✅ ThumbActionBar |
| Słaba discoverability Challenges | ✅ chipy skrótów |
| Pusty stan generyczny | ✅ CommunityEmptyState |
| Search bez label | ✅ `sr-only` + role=search |
| Karty bez focus ring / aria | ✅ |

### `/community/teams/new` · `/join`
| Problem | Status |
|---------|--------|
| Back link mały | ✅ min-h-10 + focus |
| Select ranking < 44px | ✅ min-h-12 |

### `/community/teams/[id]` (hub)
| Problem | Status |
|---------|--------|
| Chat defaultOpen zabiera viewport | ✅ collapsed |
| Ranking płaski | ✅ podium top-1 highlight |
| Feed empty | ✅ empty state |
| Subnav sticky | ✅ wcześniej |
| Live badge bez kontekstu SR | ✅ |

### Feed / post card
| Problem | Status |
|---------|--------|
| Brak aria-live na nowych postach | ✅ polite |
| Lazy comments | ✅ (perf) |

### Challenges (Team + Global)
| Problem | Status |
|---------|--------|
| Progress bez role=progressbar | ✅ CommunityProgress |
| XP card płaska | ✅ radial + duże liczby |
| Przyciski < 44px | ✅ min-h-11 |

### Notifications
| Problem | Status |
|---------|--------|
| Badge bez live region | ✅ |
| Mark-all na wąskim ekranie | ✅ stack mobile |
| Chip scroll | ✅ wcześniej |

### Live / Chat / Active workout
| Problem | Status |
|---------|--------|
| **Presence IDOR** (GET bez membership) | ✅ remediated |
| Chat log bez role | ✅ role=log |
| Mode sheet hit targets | ✅ min-h |

### Desktop / tablet
| Problem | Status |
|---------|--------|
| max-w-lg pustka | ✅ shell md/xl |
| Siatki 2-col | ✅ Teams / Challenges |

---

## Bezpieczeństwo (ta runda)

`listGroupWorkoutPresence` wymaga teraz:
1. sesja `live`, oraz
2. aktywne członkostwo Team **lub** status `joined` w sesji.

Bez tego zwraca `[]` (brak leak presence).

---

## Performance (utrzymane)

Adaptive SSE · event-head cache · presence TTL · infinite scroll · comment preview · reaction GROUP BY.

---

## Checklist jakości 11/10 (pozostałe)

- [ ] Audyt kontrastu WCAG AA na wszystkich chipach (manual)
- [ ] E2E: presence IDOR regression test
- [ ] Fair Ranking / server-side metric trust
- [ ] Redis fanout SSE (multi-instance)
