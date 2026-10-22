export type IntroTourStep = {
  id: string;
  kicker: string;
  title: string;
  body: string;
};

/**
 * Konta założone wcześniej nie dostają wymuszonego touru (jednorazowy backfill UX).
 * Nowe rejestracje (createdAt ≥ tej daty) widzą popupy do ukończenia / pominięcia.
 */
export const INTRO_TOUR_SINCE_ISO = "2026-10-22";

export function shouldShowIntroTour(opts: {
  introTourCompletedAt: Date | null | undefined;
  accountCreatedAt: Date | null | undefined;
}): boolean {
  if (opts.introTourCompletedAt) return false;
  const created = opts.accountCreatedAt;
  if (!created || Number.isNaN(created.getTime())) return false;
  const since = new Date(`${INTRO_TOUR_SINCE_ISO}T00:00:00`);
  return created.getTime() >= since.getTime();
}

/** Instrukcja startowa po założeniu konta — kolejne popupy z „Dalej”. */
export const INTRO_TOUR_STEPS: IntroTourStep[] = [
  {
    id: "welcome",
    kicker: "Start",
    title: "Witaj w GymBrat",
    body: "To Twój dziennik treningu, diety i sylwetki. W kilku krokach pokażemy, gdzie co jest i od czego zacząć.",
  },
  {
    id: "home",
    kicker: "01 · Pulpit",
    title: "Twój dzień na starcie",
    body: "Na Pulpicie widzisz kolejny trening, wagę, makro, formę i raporty. Stąd najszybciej uruchomisz sesję przyciskiem „Zacznij trening”.",
  },
  {
    id: "diet",
    kicker: "02 · Dieta",
    title: "Jadłospis i skan",
    body: "W Diecie logujesz posiłki do sekcji dnia, szukasz produktów i skanujesz kod EAN. Cele kcal/makro ustawisz w Profilu.",
  },
  {
    id: "training",
    kicker: "03 · Treningi",
    title: "Plan i sesja prowadzona",
    body: "Zakładka Treningi to hub: wybór dnia planu, start sesji, cardio i historia. Sam plan (ćwiczenia, serie) edytujesz w Profilu → Plan treningowy.",
  },
  {
    id: "progress",
    kicker: "04 · Analiza",
    title: "Postępy siły i sylwetki",
    body: "Analiza pokazuje e1RM, objętość, porównania tygodni, wagę, obwody i zdjęcia Start→Teraz. Tu ocenisz, czy idziesz w górę.",
  },
  {
    id: "report",
    kicker: "05 · Raport",
    title: "Pomiary i przemiana",
    body: "Złoty przycisk „+ Raport” na dolnej belce otwiera zapis wagi, obwodów, samopoczucia i trzech zdjęć sylwetki. Regularność widać na Pulpicie.",
  },
  {
    id: "profile",
    kicker: "06 · Profil",
    title: "Ustawienia i pakiet",
    body: "W Profilu: plan treningowy, cele diety, parametry ciała, prywatność (RODO) i pakiet bez reklam. Menu (inicjały) prowadzi też do Community i regulaminu.",
  },
  {
    id: "done",
    kicker: "Gotowe",
    title: "Możesz trenować",
    body: "Ustaw plan w Profilu, zaloguj pierwszy posiłek albo odpal trening z Pulpitu. Wskazówki możesz zawsze pominąć — wrócisz do aplikacji od razu.",
  },
];
