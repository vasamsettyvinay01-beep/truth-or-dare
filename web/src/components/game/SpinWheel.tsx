"use client";

import { motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";

export function SpinWheel({ onSpin, disabled }: { onSpin: () => void; disabled?: boolean }) {
  const lastSpin = useGameStore((s) => s.lastSpin);
  const angle = lastSpin?.angle ?? 0;

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 -translate-y-1 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-cream" />
        <motion.div
          className="relative h-[min(56vw,14rem)] w-[min(56vw,14rem)] rounded-full border-4 border-white/10 shadow-[0_0_60px_rgba(124,92,255,0.25)]"
          animate={{ rotate: angle }}
          transition={{ duration: 3.2, ease: [0.15, 0.8, 0.1, 1] }}
          style={{
            background:
              "conic-gradient(#38bdf8 0deg 180deg, #fb7185 180deg 360deg)",
          }}
        >
          <div className="absolute inset-6 flex items-center justify-center rounded-full bg-ink/80 backdrop-blur">
            <div className="text-center">
              <p className="font-display text-xs uppercase tracking-[0.25em] text-muted">Fate</p>
              <p className="mt-1 font-display text-2xl">
                {lastSpin ? (lastSpin.type === "truth" ? "Truth" : "Dare") : "Spin"}
              </p>
            </div>
          </div>
          <span className="absolute left-1/2 top-4 -translate-x-1/2 font-display text-sm font-bold text-ink">
            TRUTH
          </span>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 font-display text-sm font-bold text-white">
            DARE
          </span>
        </motion.div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onSpin}
        className="glow-accent tap-target rounded-full bg-[linear-gradient(135deg,#ff4d6d,#7c5cff)] px-8 py-3.5 font-display text-sm uppercase tracking-[0.2em] active:scale-95 disabled:opacity-40"
      >
        {disabled ? "Waiting…" : "Spin the Wheel"}
      </button>
    </div>
  );
}
