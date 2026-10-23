import {
  BarChart3,
  Bug,
  Dumbbell,
  ImageIcon,
  Package,
  Settings2,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavBadge = "bugs" | "config";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: AdminNavBadge;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

/** Jedyne źródło prawdy dla nawigacji panelu (pasek mobilny i panel boczny). */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Przegląd",
    items: [{ href: "/admin/overview", label: "Analityka", icon: BarChart3 }],
  },
  {
    label: "Użytkownicy",
    items: [
      { href: "/admin/users", label: "Konta", icon: Users },
      { href: "/admin/packages", label: "Pakiety i ceny", icon: Package },
    ],
  },
  {
    label: "Treści",
    items: [
      { href: "/admin/catalog", label: "Przepisy", icon: UtensilsCrossed },
      { href: "/admin/exercises", label: "Ćwiczenia", icon: Dumbbell },
      { href: "/admin/branding", label: "Branding", icon: ImageIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Konfiguracja", icon: Settings2, badge: "config" },
      { href: "/admin/bugs", label: "Błędy", icon: Bug, badge: "bugs" },
    ],
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
