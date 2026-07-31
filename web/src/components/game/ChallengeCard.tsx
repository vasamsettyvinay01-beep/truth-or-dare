"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock3, Sparkles } from "lucide-react";
import type { CurrentChallenge } from "@tod/shared";
import { levelLabel } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ChallengeCard({ challenge }: { challenge: CurrentChallenge }) {
  const [flipped, setFlipped] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setFlipped(false);
    const t = setTimeout(() => setFlipped(true), 180);
    return () => clearTimeout(t);
  }, [challenge.promptId]);

  useEffect(() => {
    if (!challenge.timerEndsAt) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((challenge.timerEndsAt! - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [challenge.timerEndsAt]);

  const isTruth = challenge.type === "truth";

  return (
    <div className="perspective-[1200px] mx-auto w-full max-w-xl">
      <AnimatePresence mode="wait">
        <motion.div
          key={challenge.promptId}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: flipped ? 0 : 90, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[2rem] border border-white/10 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
          style={{
            background: isTruth
              ? "linear-gradient(160deg, rgba(14,165,233,0.2), rgba(7,7,11,0.95) 55%)"
              : "linear-gradient(160deg, rgba(244,63,94,0.22), rgba(7,7,11,0.95) 55%)",
          }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{
                  background: isTruth ? "rgba(56,189,248,0.15)" : "rgba(251,113,133,0.15)",
                  color: isTruth ? "#7dd3fc" : "#fda4af",
                }}
              >
                {challenge.type}
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-muted">
                {levelLabel(challenge.level)} · {challenge.category}
              </span>
            </div>
            {remaining !== null && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
                <Clock3 className="h-3.5 w-3.5" />
                {remaining}s
              </div>
            )}
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className={isTruth ? "text-sky-300" : "text-rose-300"} />
            <p className="font-display text-2xl leading-snug text-cream md:text-3xl">
              {challenge.text}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
