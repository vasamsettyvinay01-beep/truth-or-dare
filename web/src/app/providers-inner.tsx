"use client";

import { useEffect } from "react";
import { useSocketLifecycle } from "@/hooks/use-socket";
import { ConfettiListener } from "@/components/effects/ConfettiListener";
import { FloatingReactions } from "@/components/effects/FloatingReactions";
import { ConnectionBanner } from "@/components/ui/ConnectionStatus";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useGameStore } from "@/store/game-store";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function ProvidersInner({ children }: { children: React.ReactNode }) {
  useSocketLifecycle();
  const error = useGameStore((s) => s.error);
  const setError = useGameStore((s) => s.setError);

  // Errors are transient notices, not modal state — auto-dismiss so a stuck
  // toast never covers the controls at the bottom of a small screen.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error, setError]);

  return (
    <ErrorBoundary>
      {children}
      <ConnectionBanner />
      <ConfettiListener />
      <FloatingReactions />
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="alert"
            aria-live="assertive"
            className="safe-bottom fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-950/95 px-4 py-3 text-sm text-rose-100 shadow-2xl backdrop-blur sm:inset-x-auto sm:left-1/2 sm:bottom-6 sm:-translate-x-1/2"
          >
            <p className="min-w-0 flex-1">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss message"
              className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
