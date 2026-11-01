"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const easeLift = [0.45, 0.05, 0.55, 0.95] as const;

/**
 * Złoty hantel GymBrat z animacją podnoszenia — splash / logowanie / loading.
 */
export function AnimatedDumbbellMark({
  className,
  size = "lg",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "sm" ? "h-14 w-14" : size === "md" ? "h-20 w-20" : "h-28 w-28 sm:h-32 sm:w-32";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", box, className)}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-[var(--gym-gold)]/15 blur-2xl"
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.08, 0.92] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        viewBox="0 0 120 120"
        className="relative h-full w-full drop-shadow-[0_8px_24px_rgba(235,196,74,0.35)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        initial={{ y: 10, opacity: 0 }}
        animate={{
          y: [10, -14, 10],
          opacity: 1,
          rotate: [-6, 6, -6],
        }}
        transition={{
          y: { duration: 1.65, repeat: Infinity, ease: easeLift },
          rotate: { duration: 1.65, repeat: Infinity, ease: easeLift },
          opacity: { duration: 0.45 },
        }}
      >
        <defs>
          <linearGradient id="gb-bar" x1="18" y1="60" x2="102" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c49a1f" />
            <stop offset="0.5" stopColor="#f7e28f" />
            <stop offset="1" stopColor="#c49a1f" />
          </linearGradient>
          <linearGradient id="gb-plate" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#f7e28f" />
            <stop offset="0.45" stopColor="#ebc44a" />
            <stop offset="1" stopColor="#9a7a18" />
          </linearGradient>
        </defs>
        {/* Gryf */}
        <rect x="28" y="54" width="64" height="12" rx="4" fill="url(#gb-bar)" />
        {/* Lewe talerze */}
        <rect x="14" y="38" width="12" height="44" rx="3" fill="url(#gb-plate)" />
        <rect x="22" y="44" width="8" height="32" rx="2" fill="#ebc44a" />
        {/* Prawe talerze */}
        <rect x="94" y="38" width="12" height="44" rx="3" fill="url(#gb-plate)" />
        <rect x="90" y="44" width="8" height="32" rx="2" fill="#ebc44a" />
        {/* Uchwyty */}
        <rect x="8" y="52" width="8" height="16" rx="2" fill="#f7e28f" />
        <rect x="104" y="52" width="8" height="16" rx="2" fill="#f7e28f" />
      </motion.svg>
    </div>
  );
}
