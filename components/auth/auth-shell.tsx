"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;

/**
 * Auth layout chrome. Atmosphere (photo + gold fog) comes from MetalBackdrop
 * in the root layout — same language as the rest of the app.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden">
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
