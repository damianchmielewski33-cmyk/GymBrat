"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="theme-black-gold relative min-h-[100dvh] overflow-x-hidden bg-[#f4f5f7]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-x-0 top-0 h-[min(52vh,28rem)]"
          style={{
            backgroundColor: "#0b1c18",
            backgroundImage: [
              "linear-gradient(180deg, rgba(8,16,24,0.25) 0%, rgba(244,245,247,0.92) 100%)",
              'var(--awp-bg-stadium, url("/stadium-bg.svg"))',
            ].join(","),
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_900px_480px_at_12%_0%,rgba(0,201,177,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_700px_420px_at_100%_8%,rgba(14,165,233,0.10),transparent_50%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6 sm:py-14">
        <div className="glass-panel mx-auto w-full max-w-xl p-6 sm:p-8">{children}</div>

        <motion.section
          aria-label="Atmosfera treningu"
          className="mt-14 grid grid-cols-2 gap-3 sm:mt-20 sm:gap-4"
          initial={false}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.7, ease: easeOut }}
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 shadow-md sm:aspect-[16/10]">
            <Image
              src="/images/gym/plates-rack.jpg"
              alt="Stojak z talerzami na siłowni"
              fill
              sizes="(max-width: 640px) 50vw, 480px"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 shadow-md sm:aspect-[16/10]">
            <Image
              src="/images/gym/dumbbells.jpg"
              alt="Hantle na podłodze siłowni"
              fill
              sizes="(max-width: 640px) 50vw, 480px"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        </motion.section>
      </div>
    </div>
  );
}
