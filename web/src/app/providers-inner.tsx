"use client";

import { useSocketLifecycle } from "@/hooks/use-socket";
import { ConfettiListener } from "@/components/effects/ConfettiListener";
import { FloatingReactions } from "@/components/effects/FloatingReactions";
import { useGameStore } from "@/store/game-store";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function ProvidersInner({ children }: { children: React.ReactNode }) {
  useSocketLifecycle();
  const error = useGameStore((s) => s.error);
  const setError = useGameStore((s) => s.setError);

  return (
    <>
      {children}
      <ConfettiListener />
      <FloatingReactions />
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 z-[60] flex max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-950/90 px-4 py-3 text-sm text-rose-100 shadow-2xl backdrop-blur"
          >
            <p className="flex-1">{error}</p>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
