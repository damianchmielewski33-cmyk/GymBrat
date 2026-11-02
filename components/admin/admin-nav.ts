import {
  BarChart3,
  Bug,
  Dumbbell,
  ImageIcon,
  LifeBuoy,
  Package,
  Receipt,
  Wallet,
  Settings2,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AdminNavBadge = "bugs" | "config";

export type AdminNavItem = {
  href: string;
  label: string;
  /** Krótka etykieta w siatce na telefonie. */
  shortLabel?: string;
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
    items: [{ href: "/admin/overview", label: "Analityka", shortLabel: "Analityka", icon: BarChart3 }],
  },
  {
    label: "Użytkownicy",
    items: [
      { href: "/admin/users", label: "Konta", shortLabel: "Konta", icon: Users },
      { href: "/admin/packages", label: "Pakiety i ceny", shortLabel: "Pakiety", icon: Package },
      { href: "/admin/orders", label: "Zamówienia", shortLabel: "Zamówienia", icon: Receipt },
      { href: "/admin/finance", label: "Finanse", shortLabel: "Finanse", icon: Wallet },
    ],
  },
  {
    label: "Treści",
    items: [
      { href: "/admin/catalog", label: "Przepisy", shortLabel: "Przepisy", icon: UtensilsCrossed },
      { href: "/admin/exercises", label: "Ćwiczenia", shortLabel: "Ćwiczenia", icon: Dumbbell },
      { href: "/admin/branding", label: "Branding", shortLabel: "Grafika", icon: ImageIcon },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Konfiguracja", shortLabel: "Konfig.", icon: Settings2, badge: "config" },
      { href: "/admin/bugs", label: "Błędy", shortLabel: "Błędy", icon: Bug, badge: "bugs" },
      { href: "/admin/support", label: "Wsparcie", shortLabel: "Wsparcie", icon: LifeBuoy },
    ],
  },
];

export function isAdminNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
