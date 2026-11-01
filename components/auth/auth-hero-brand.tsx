"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AnimatedDumbbellMark } from "@/components/branding/animated-dumbbell-mark";
import { useBrandingUrl } from "@/components/branding/branding-provider";
import { cn } from "@/lib/utils";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function AuthHeroBrand({
  headline,
  support,
  compact = false,
}: {
  headline: string;
  support: string;
  /** Mniejszy nagłówek w krokach wizarda (logo nie zajmuje całego viewportu). */
  compact?: boolean;
}) {
  const logoUrl = useBrandingUrl("logo_login", ["logo_app", "icon_web"]);

  return (
    <div className={cn("text-center", compact ? "mb-5" : "mb-8 sm:mb-10")}>
      <motion.div
        className="flex flex-col items-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: easeOut }}
      >
        <AnimatedDumbbellMark size={compact ? "sm" : "lg"} />

        <Link
          href="/login"
          className={cn(
            "mt-4 inline-flex max-w-full flex-col items-center justify-center rounded-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--gym-black)]/80",
          )}
          aria-label="GymBrat — strona główna"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="GymBrat"
              className={cn(
                "mx-auto h-auto w-auto object-contain object-center",
                compact
                  ? "max-h-10 max-w-[min(70vw,11rem)]"
                  : "max-h-14 max-w-[min(72vw,14rem)] sm:max-h-16 sm:max-w-[16rem]",
              )}
            />
          ) : (
            <span
              className={cn(
                "font-display font-normal uppercase leading-none tracking-[0.08em] text-white",
                compact ? "text-4xl" : "text-5xl sm:text-6xl md:text-7xl",
              )}
            >
              Gym
              <span className="text-[var(--neon)]">Brat</span>
            </span>
          )}
        </Link>
      </motion.div>

      <motion.h1
        className={cn(
          "font-heading font-semibold tracking-tight text-white/95",
          compact
            ? "mt-4 text-xl sm:text-[1.35rem]"
            : "mt-6 text-xl sm:mt-7 sm:text-2xl",
        )}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.12, ease: easeOut }}
      >
        {headline}
      </motion.h1>

      <motion.p
        className={cn(
          "mx-auto leading-relaxed text-white/60",
          compact
            ? "mt-2 max-w-sm text-sm"
            : "mt-3 max-w-md text-sm sm:text-base",
        )}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.22, ease: easeOut }}
      >
        {support}
      </motion.p>

      {compact ? null : (
        <motion.div
          aria-hidden
          className="mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-[var(--neon)] to-transparent"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
        />
      )}
    </div>
  );
}
