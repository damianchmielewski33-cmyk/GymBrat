export const PROFILE_SECTIONS = [
  { id: "body", label: "Ciało", href: "/profile/body" },
  { id: "training", label: "Trening", href: "/profile/training" },
  { id: "diet", label: "Dieta", href: "/profile/diet" },
  { id: "reminders", label: "Przypomnienia", href: "/profile/reminders" },
  { id: "privacy", label: "Prywatność", href: "/profile/privacy" },
  { id: "account", label: "Konto", href: "/profile/account" },
  { id: "appearance", label: "Wygląd", href: "/profile/appearance" },
  { id: "app", label: "Aplikacja", href: "/profile/app" },
] as const;

export type ProfileSectionId = (typeof PROFILE_SECTIONS)[number]["id"];
