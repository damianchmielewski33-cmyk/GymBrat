"use client";

import { motion } from "framer-motion";

export function MetalBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(230,0,35,0.22),_transparent_58%),radial-gradient(ellipse_at_bottom,_rgba(255,255,255,0.10),_transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.24] [background-image:linear-gradient(120deg,rgba(255,255,255,0.07),transparent_42%),linear-gradient(300deg,rgba(255,255,255,0.05),transparent_46%),radial-gradient(1200px_900px_at_22%_10%,rgba(230,0,35,0.12),transparent_62%)]" />
      <motion.div
        className="absolute -inset-[40%] opacity-45 blur-3xl"
        animate={{
          background: [
            "conic-gradient(from 0deg, rgba(230,0,35,0.42), transparent, rgba(255,255,255,0.14), transparent)",
            "conic-gradient(from 120deg, rgba(230,0,35,0.42), transparent, rgba(255,255,255,0.14), transparent)",
            "conic-gradient(from 240deg, rgba(230,0,35,0.42), transparent, rgba(255,255,255,0.14), transparent)",
            "conic-gradient(from 360deg, rgba(230,0,35,0.42), transparent, rgba(255,255,255,0.14), transparent)",
          ],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      />
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 6px)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.16] metal-surface animated-ambient" />
      <div className="absolute inset-0 opacity-[0.08] grain-overlay" />
    </div>
  );
}
