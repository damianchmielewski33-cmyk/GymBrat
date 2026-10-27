import Link from "next/link";
import type { Ref } from "react";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  MainCardShell,
  mainCardKickerClass,
  mainCardTitleClass,
} from "@/components/treningi/main-card-shell";
import { cn } from "@/lib/utils";

const TITLE_ID = "no-plan-title";

/** Brak planu (4D): jedyna droga do ustawienia planu na ekranie (AC-4.9). */
export function NoPlanCard({ titleRef }: { titleRef?: Ref<HTMLHeadingElement> }) {
  return (
    <MainCardShell titleId={TITLE_ID}>
      <p className={mainCardKickerClass}>Plan treningowy</p>
      <h2 id={TITLE_ID} ref={titleRef} tabIndex={-1} className={mainCardTitleClass}>
        Dodaj plan treningowy
      </h2>
      <p className="mt-1.5 text-[13px] text-white/65">
        Ustaw dni planu, żeby szybko startować sesję.
      </p>
      <Link
        href="/plany/nowy"
        className={cn(buttonVariants({ variant: "cta" }), "mt-4 w-full gap-2")}
      >
        <Plus aria-hidden />
        Dodaj plan
      </Link>
    </MainCardShell>
  );
}
