"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function AuthHeroBrand({
  headline,
  support,
}: {
  headline: string;
  support: string;
}) {
  return (
    <div className="mb-8 text-center sm:mb-10">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: easeOut }}
      >
        <Link
          href="/login"
          className="inline-block rounded-sm font-display text-5xl font-normal uppercase tracking-[0.04em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#070708]/80 sm:text-6xl md:text-7xl"
          aria-label="GymBrat — strona główna"
        >
          Gym
          <span className="text-[var(--neon)]">Brat</span>
        </Link>
      </motion.div>

      <motion.h1
        className="mt-5 font-heading text-xl font-semibold tracking-tight text-white/95 sm:text-2xl"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.12, ease: easeOut }}
      >
        {headline}
      </motion.h1>

      <motion.p
        className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/60 sm:text-base"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.22, ease: easeOut }}
      >
        {support}
      </motion.p>

      <motion.div
        aria-hidden
        className="mx-auto mt-6 h-px w-24 bg-gradient-to-r from-transparent via-[var(--neon)] to-transparent"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
      />
    </div>
  );
}
