import Link from "next/link";
import { Footprints, History, Video, type LucideIcon } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";

type TrainingTool = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
};

/** Narzędzia (US-5, P-1): trzy kafelki, bez minut cardio (BR-9). */
const TRAINING_TOOLS: readonly TrainingTool[] = [
  { href: "/cardio", icon: Footprints, title: "Dodaj cardio", description: "marsz, bieg" },
  { href: "/workout-history", icon: History, title: "Dziennik", description: "historia" },
  { href: "/technique", icon: Video, title: "Technika", description: "filmy" },
];

export function TrainingToolsGrid() {
  return (
    <section className="space-y-2.5">
      <SectionLabel title="Narzędzia" titleTone="white" titleAs="h2" />
      <ul className="grid grid-cols-3 gap-2.5">
        {TRAINING_TOOLS.map(({ href, icon: Icon, title, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="app-panel flex h-full min-h-[88px] flex-col justify-between p-3 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <Icon className="size-5 text-[var(--gym-gold)]" aria-hidden />
              <span>
                <span className="block text-[13px] font-semibold leading-tight text-white">
                  {title}
                </span>
                <span className="mt-0.5 block text-[12px] text-white/60">
                  <span className="sr-only">, </span>
                  {description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
