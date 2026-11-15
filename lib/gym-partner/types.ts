export const GOALS = {
  masa: "Masa",
  redukcja: "Redukcja",
  sila: "Siła",
  kondycja: "Kondycja",
  ogolny: "Ogólnie",
} as const;
export const LEVELS = {
  poczatkujacy: "Początkujący",
  sredni: "Średni",
  zaawansowany: "Zaawansowany",
} as const;
export const TIMES = {
  teraz: "Teraz",
  rano: "Rano",
  popoludnie: "Po południu",
  wieczor: "Wieczorem",
} as const;
export const DURATIONS_H = [1, 2, 4] as const;
export const SEARCH_RADIUS_M = 5000;

export type Goal = keyof typeof GOALS;
export type Level = keyof typeof LEVELS;
export type PreferredTime = keyof typeof TIMES;

export type NearbyPartner = {
  userId: string;
  name: string;
  goal: Goal;
  level: Level;
  preferredTime: PreferredTime;
  lat: number;
  lng: number;
  distanceKm: number;
  requestStatus: "none" | "pending" | "accepted" | "declined";
};

export type IncomingRequest = {
  id: string;
  fromUserId: string;
  name: string;
  createdAt: string;
};

export type MyPresence = {
  goal: Goal;
  level: Level;
  preferredTime: PreferredTime;
  expiresAt: string;
};

export type GymPlace = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  website: string | null;
  mapsUrl: string | null;
  openNow: boolean | null;
  hours: string[];
};
