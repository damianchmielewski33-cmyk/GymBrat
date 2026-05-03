/**
 * Reguły pory posiłku dla generatora propozycji — spójne z {@link getCalendarTimezone}.
 * Godzina 0–23 w strefie kalendarza żywienia.
 */
export function getMealSuggestionsTimeRulesPl(hour: number): string {
  const h = hour % 24;

  if (h >= 5 && h < 11) {
    return [
      "To pora śniadania (ew. drugiego śniadania).",
      "Proponuj wyłącznie posiłki typowe na ranek: owsianki, jajka, twaróg / serek wiejski, pieczywo z dodatkami, smoothie bowl, omlety, wrapy śniadaniowe.",
      "NIE proponuj pełnych obiadów w stylu „drugie danie + zupa”, ciężkich schabowych z dużą porcją ziemniaków ani zestawów jak na kolację wieczorem.",
    ].join(" ");
  }

  if (h >= 11 && h < 15) {
    return [
      "To typowa pora obiadu.",
      "Proponuj ciepłe, sycące dania: talerze z mięsem / rybą / roślinnym białkiem i dodatkiem ziemniaków / kaszy / ryżu, lekkie zupy krem, bowl z pieczonym białkiem, makaron z warzywami.",
      "NIE stawiaj na pierwszym miejscu samych owsianki, tostów śniadaniowych ani samych słodkich smoothie — to nie jest pora śniadania.",
    ].join(" ");
  }

  if (h >= 15 && h < 18) {
    return [
      "To popołudnie (np. podwieczorek lub wczesna kolacja).",
      "Proponuj średnio lekkie posiłki: sałatki z białkiem, kanapki z dobrym źródłem białka, bowl z komosą / kaszą, jogurt z dodatkami, zupa krem z pieczywem.",
      "Unikaj czterech kopii ciężkiego obiadu „jak w barze mlecznym” oraz zestawów wyłącznie śniadaniowych (same owsianki / płatki).",
    ].join(" ");
  }

  if (h >= 18 && h < 22) {
    return [
      "To pora kolacji.",
      "Proponuj lżejsze porcje niż w środku dnia: więcej warzyw, pieczone / duszone zamiast smażonych, ryby, jajka, strączki, małe porcje mięsa.",
      "NIE proponuj wyłącznie typowych śniadań (np. same owsianki, płatki z mlekiem, jajecznica jako jedyna idea) ani bardzo ciężkich obiadów jak w południe.",
    ].join(" ");
  }

  return [
    "To późny wieczór lub noc przed śniadaniem.",
    "Proponuj małe, łatwostrawne porcje: kefir / jogurt z pieczywem, kanapka z szynką drobiową i warzywami, jajko na miękko z grzanką, owoc z orzechami.",
    "Unikaj obfitych obiadów i słodkich zestawów śniadaniowych — to nie jest pora na duży posiłek ani na start dnia.",
  ].join(" ");
}
