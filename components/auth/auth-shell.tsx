"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: "easeOut" }}
        >
          <Image
            src="/images/gym/hero-barbell.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
        </motion.div>
        <div className="absolute inset-0 bg-[#070708]/72" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_1200px_800px_at_12%_18%,rgba(var(--neon-rgb),0.28),transparent_58%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_900px_700px_at_88%_88%,rgba(180,140,40,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-[#070708]/55 to-[#070708]/35" />
        <div className="absolute inset-0 opacity-[0.09] grain-overlay" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6 sm:py-14">
        {children}

        <motion.section
          aria-label="Atmosfera siłowni"
          className="mt-14 grid grid-cols-2 gap-3 sm:mt-20 sm:gap-4"
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10]">
            <Image
              src="/images/gym/plates-rack.jpg"
              alt="Stojak z talerzami na siłowni"
              fill
              sizes="(max-width: 640px) 50vw, 480px"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--neon)]/50 to-transparent" />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10]">
            <Image
              src="/images/gym/dumbbells.jpg"
              alt="Hantle na podłodze siłowni"
              fill
              sizes="(max-width: 640px) 50vw, 480px"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--neon)]/50 to-transparent" />
          </div>
        </motion.section>
      </div>
    </div>
  );
}
