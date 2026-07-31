"use client";

import { motion } from "framer-motion";
import { GAME_LEVELS, type GameLevel } from "@tod/shared";
import { cn } from "@/lib/utils";

export function LevelSelect({
  enabled,
  onSelect,
  isHost,
}: {
  enabled: GameLevel[];
  onSelect: (level: GameLevel) => void;
  isHost: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-xs uppercase tracking-[0.25em] text-muted">Intensity</p>
      <h2 className="mt-2 font-display text-3xl text-gradient sm:text-4xl md:text-5xl">
        Choose your level
      </h2>
      <p className="mt-3 text-muted">
        {isHost ? "Pick how wild this round gets." : "Waiting for the host…"}
      </p>
      <div className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4">
        {GAME_LEVELS.filter((l) => enabled.includes(l.id)).map((level, i) => (
          <motion.button
            key={level.id}
            type="button"
            disabled={!isHost}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            whileHover={isHost ? { y: -4, scale: 1.02 } : undefined}
            onClick={() => onSelect(level.id)}
            className={cn(
              "glass relative min-h-[88px] overflow-hidden rounded-[1.5rem] p-5 text-left disabled:cursor-default sm:rounded-[1.75rem] sm:p-6",
              isHost && "active:scale-[0.99] sm:hover:border-white/20"
            )}
          >
            <div
              className="absolute inset-0 opacity-30"
              style={{
                background: `radial-gradient(circle at 20% 20%, ${level.color}, transparent 55%)`,
              }}
            />
            <div className="relative">
              <p className="font-display text-2xl" style={{ color: level.color }}>
                {level.label}
              </p>
              <p className="mt-2 text-sm text-muted">{level.description}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
