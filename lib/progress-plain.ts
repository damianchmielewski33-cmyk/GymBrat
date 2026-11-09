import type { FatigueSnapshot } from "@/lib/analytics/types";

/**
 * Proste słownictwo Analizy: nazwy pasm, rady i słowniczek dla przycisku „?”.
 * Silniki w `lib/analytics` zostają bez zmian (używa ich też coach), tutaj tylko warstwa widoku.
 */

export type FatigueBand = FatigueSnapshot["band"];

export const FATIGUE_BAND_STEPS: ReadonlyArray<{ id: FatigueBand; label: string }> = [
  { id: "fresh", label: "Świeżość" },
  { id: "normal", label: "W normie" },
  { id: "fatigued", label: "Duże" },
  { id: "overreached", label: "Za duże" },
];

export const FATIGUE_BAND_HEADLINE: Record<FatigueBand, string> = {
  fresh: "Jesteś wypoczęty",
  normal: "W normie",
  fatigued: "Zmęczenie jest duże",
  overreached: "Zmęczenie jest za duże",
};

export const FATIGUE_BAND_ADVICE: Record<FatigueBand, string> = {
  fresh: "Masz dużo energii. To dobry dzień na cięższy trening.",
  normal: "Trenujesz tyle, ile zwykle. Możesz ćwiczyć zgodnie z planem.",
  fatigued: "Ostatnio dużo ćwiczysz. Zrób lżejszy trening albo skróć sesję.",
  overreached: "Organizm potrzebuje odpoczynku. Wyśpij się i przez kilka dni trenuj lżej.",
};

export type ReadinessBand = "poor" | "average" | "good" | "excellent";

export const READINESS_HEADLINE: Record<ReadinessBand, string> = {
  poor: "Słaba",
  average: "Przeciętna",
  good: "Dobra",
  excellent: "Świetna",
};

export const READINESS_ADVICE: Record<ReadinessBand, string> = {
  poor: "Organizm jest zmęczony. Dziś lepiej trenuj lżej.",
  average: "Jest w porządku, ale bez szaleństw. Trenuj według planu.",
  good: "Dobra regeneracja. To dobry dzień na cięższy trening.",
  excellent: "Jesteś świetnie wypoczęty. Możesz iść na rekord.",
};

export type GlossaryKey = "e1rm" | "tonnage" | "fatigue" | "readiness" | "muscleBalance" | "cardioZones" | "weeks";

export type GlossaryEntry = {
  title: string;
  /** Jedno zdanie, bez żargonu. */
  short: string;
  example: string;
  /** Szczegóły „Jak to liczymy” (może zawierać pojęcia techniczne). */
  detail: string;
};

export const GLOSSARY: Record<GlossaryKey, GlossaryEntry> = {
  e1rm: {
    title: "Siła w ćwiczeniu",
    short: "To ciężar, jaki podniesiesz dokładnie jeden raz. Im większa liczba, tym więcej masz siły.",
    example: "Przysiad: 100 kg na 6 powtórzeń. Z tego wychodzi, że jeden raz podniesiesz około 120 kg.",
    detail:
      "Nie trzeba tego sprawdzać na siłowni. Aplikacja liczy to z każdej zapisanej serii (szacowany max, wzór Epleya: ciężar × (1 + powtórzenia / 30)). To szacunek, więc może się różnić o kilka kilogramów.",
  },
  tonnage: {
    title: "Podniesione kilogramy",
    short: "To suma wszystkich serii: ciężar razy liczba powtórzeń. Pokazuje, ile pracy wykonano.",
    example: "3 serie po 10 powtórzeń z 50 kg to 1500 kg.",
    detail: "W tabelach pokazujemy to w tysiącach kilogramów (tonaż). Wyższa liczba oznacza cięższy tydzień, ale nie zawsze lepszy.",
  },
  fatigue: {
    title: "Jak duże jest zmęczenie?",
    short: "Pokazuje, jak mocno obciążył Cię trening w ostatnich dniach. To nie to samo co samopoczucie.",
    example: "Po kilku ciężkich treningach z rzędu zmęczenie rośnie, po lżejszym tygodniu spada.",
    detail:
      "Wynik 0–100 składa się z siedmiu części (tonaż, trend tygodnia, serie do upadku, RPE, liczba treningów, cardio, dni z rzędu). 0–30 świeżość, 31–60 w normie, 61–80 duże, 81–100 za duże.",
  },
  readiness: {
    title: "Gotowość na dziś",
    short: "Ocena tego, jak dobrze odpocząłeś. Bierzemy pod uwagę sen, energię i stres z Twojej ankiety.",
    example: "Dobry sen i mało stresu dają wysoką gotowość, nawet po mocnym tygodniu.",
    detail:
      "Bez wypełnionej ankiety liczymy ją tylko z obciążenia treningowego (100 minus zmęczenie), więc nie wnosi nowej informacji.",
  },
  muscleBalance: {
    title: "Które partie ćwiczysz za mało?",
    short: "Porównujemy, ile serii robisz na poszczególne partie ciała. Pokazujemy te, które zostają w tyle.",
    example: "Jeśli klatkę ćwiczysz 20 razy w miesiącu, a nogi 5, nogi dostają za mało pracy.",
    detail: "Liczymy serie z ostatnich 30 dni i porównujemy każdą partię z tą, którą ćwiczysz najczęściej.",
  },
  cardioZones: {
    title: "Jak ciężkie było cardio?",
    short: "Dzielimy czas cardio według tętna: spokojnie, umiarkowanie i ciężko.",
    example: "30 minut marszu to zwykle spokojne tempo, a bieg pod górkę to ciężkie.",
    detail: "Opisy odpowiadają strefom tętna: Z1–Z2 spokojnie, Z3 umiarkowanie, Z4–Z5 ciężko. Wymaga zapisanego tętna.",
  },
  weeks: {
    title: "Porównanie tygodni",
    short: "Zestawiasz dwa tygodnie i widzisz, w czym jest lepiej, a w czym gorzej.",
    example: "Wybierz „Wcześniej” i „Teraz”. Zielona strzałka w górę oznacza, że teraz jest więcej.",
    detail: "Jeśli bieżący tydzień trwa, oba tygodnie liczymy od poniedziałku do tego samego dnia tygodnia.",
  },
};
