export const PROGRESSION_TRACKS = [
  "user",
  "team",
  "season",
  "community",
] as const;
export type ProgressionTrack = (typeof PROGRESSION_TRACKS)[number];

export const PRESTIGE_META: Record<
  number,
  { label: string; auraKey: string; frameKey: string; exclusive: string }
> = {
  1: {
    label: "Prestige I",
    auraKey: "prestige_aura_1",
    frameKey: "frame_prestige_1",
    exclusive: "Pierwszy prestiż · subtelna aura",
  },
  2: {
    label: "Prestige II",
    auraKey: "prestige_aura_2",
    frameKey: "frame_prestige_2",
    exclusive: "Podwójny prestiż · wzmocniona ramka",
  },
  3: {
    label: "Prestige III",
    auraKey: "prestige_aura_3",
    frameKey: "frame_prestige_3",
    exclusive: "Prestige III · oznaczenie ◆",
  },
  4: {
    label: "Prestige IV",
    auraKey: "prestige_aura_4",
    frameKey: "frame_prestige_4",
    exclusive: "Prestige IV · shimmer profilu",
  },
  5: {
    label: "Prestige V",
    auraKey: "prestige_aura_5",
    frameKey: "frame_prestige_5",
    exclusive: "Prestige Master · najwyższa aura",
  },
};

export type UserProgressionView = {
  xpTotal: number;
  level: number;
  prestige: number;
  prestigeLabel: string | null;
  intoLevel: number;
  needForNext: number;
  pct: number;
  canPrestige: boolean;
  frameKey: string | null;
  auraKey: string | null;
  titleKey: string | null;
  seasonLevel: number;
  seasonXp: number;
  seasonPct: number;
};
