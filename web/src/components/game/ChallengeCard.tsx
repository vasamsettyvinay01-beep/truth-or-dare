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
    const endsAt = challenge.timerEndsAt;
    const tick = () => {
      const next = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      // Only commit when the displayed second actually changes, otherwise this
      // re-renders the card several times a second for nothing.
      setRemaining((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = setInterval(tick, 500);
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
          className="relative overflow-hidden rounded-[1.75rem] border border-white/10 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:rounded-[2rem] sm:p-8"
          style={{
            background: isTruth
              ? "linear-gradient(160deg, rgba(14,165,233,0.2), rgba(7,7,11,0.95) 55%)"
              : "linear-gradient(160deg, rgba(244,63,94,0.22), rgba(7,7,11,0.95) 55%)",
          }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 sm:mb-6">
            <div className="flex flex-wrap items-center gap-2">
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
                {levelLabel(challenge.level)} · {challenge.category.replace(/_/g, " ")}
              </span>
              {challenge.remoteFriendly && (
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                  remote
                </span>
              )}
            </div>
            {remaining !== null && (
              <div className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
                <Clock3 className="h-3.5 w-3.5" />
                {remaining}s
              </div>
            )}
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className={`mt-1 h-5 w-5 shrink-0 ${isTruth ? "text-sky-300" : "text-rose-300"}`} aria-hidden />
            <div className="min-w-0">
              <p className="font-display text-xl leading-snug text-cream sm:text-2xl md:text-3xl">
                {challenge.text}
              </p>
              {challenge.tags?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {challenge.tags.slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
