"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/store/game-store";

export function FloatingReactions() {
  const reactions = useGameStore((s) => s.floatingReactions);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 40, scale: 0.6 }}
            animate={{ opacity: 1, y: -180, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="absolute bottom-24 text-4xl"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
