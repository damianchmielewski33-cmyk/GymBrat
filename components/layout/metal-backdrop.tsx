"use client";

import Image from "next/image";
import { motion } from "framer-motion";

/**
 * Global atmosphere matching the login screen:
 * full-bleed gym photo, black–gold fog, grain, vignette.
 */
export function MetalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
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
  );
}
