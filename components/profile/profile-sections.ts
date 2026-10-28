export const PROFILE_SECTIONS = [
  { id: "body", label: "Ciało", href: "/profile/body" },
  { id: "training", label: "Trening", href: "/profile/training" },
  { id: "diet", label: "Dieta", href: "/profile/diet" },
  { id: "reminders", label: "Przypomnienia", href: "/profile/reminders" },
  { id: "app", label: "Aplikacja", href: "/profile/app" },
  { id: "account", label: "Konto", href: "/profile/account" },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];
