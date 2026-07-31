"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, WifiOff, TriangleAlert } from "lucide-react";
import { useGameStore } from "@/store/game-store";

const LABEL = {
  idle: "Starting…",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
  unavailable: "Server unavailable",
} as const;

/** Small always-visible pill so players know why nothing is happening. */
export function ConnectionBadge({ className = "" }: { className?: string }) {
  const status = useGameStore((s) => s.status);
  const tone =
    status === "connected"
      ? "bg-emerald-400"
      : status === "reconnecting" || status === "connecting" || status === "idle"
        ? "bg-amber-400"
        : "bg-rose-500";

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] text-muted ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />
      <span className="sr-only sm:not-sr-only">{LABEL[status]}</span>
    </span>
  );
}

/**
 * Full-width banner for the states a player must act on. Kept out of the way
 * when everything is healthy.
 */
export function ConnectionBanner() {
  const status = useGameStore((s) => s.status);
  const fatalError = useGameStore((s) => s.fatalError);
  const show = status === "reconnecting" || status === "disconnected" || status === "unavailable";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          role="status"
          aria-live="polite"
          className="safe-top fixed inset-x-0 top-0 z-[70] flex justify-center px-3 pt-3"
        >
          <div
            className={`flex max-w-[min(36rem,100%)] items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-xs shadow-2xl backdrop-blur ${
              status === "reconnecting"
                ? "border-amber-400/30 bg-amber-950/90 text-amber-100"
                : "border-rose-400/30 bg-rose-950/90 text-rose-100"
            }`}
          >
            {status === "reconnecting" ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : status === "unavailable" ? (
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
            )}
            <p className="min-w-0">
              {status === "reconnecting" && "Connection lost — reconnecting. Your seat is held."}
              {status === "disconnected" && "You're offline. We'll reconnect when your network returns."}
              {status === "unavailable" &&
                (fatalError || "Can't reach the game server right now. Try again shortly.")}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
