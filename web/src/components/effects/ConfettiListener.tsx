"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useReducedMotion } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { useIsSmallScreen } from "@/hooks/use-media-query";

export function ConfettiListener() {
  const nonce = useGameStore((s) => s.confettiNonce);
  const reduceMotion = useReducedMotion();
  const isSmall = useIsSmallScreen();

  useEffect(() => {
    if (!nonce || reduceMotion) return;

    const end = Date.now() + 900;
    const particleCount = isSmall ? 2 : 3;
    let raf = 0;
    let cancelled = false;

    const frame = () => {
      if (cancelled) return;
      confetti({
        particleCount,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#ff4d6d", "#7c5cff", "#38bdf8", "#fbbf24"],
      });
      confetti({
        particleCount,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#ff4d6d", "#7c5cff", "#38bdf8", "#fbbf24"],
      });
      if (Date.now() < end) raf = requestAnimationFrame(frame);
    };
    frame();

    // Without this the loop keeps drawing after navigation.
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      confetti.reset();
    };
  }, [nonce, reduceMotion, isSmall]);

  return null;
}
