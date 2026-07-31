"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useGameStore } from "@/store/game-store";

export function ConfettiListener() {
  const nonce = useGameStore((s) => s.confettiNonce);

  useEffect(() => {
    if (!nonce) return;
    const end = Date.now() + 900;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#ff4d6d", "#7c5cff", "#38bdf8", "#fbbf24"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#ff4d6d", "#7c5cff", "#38bdf8", "#fbbf24"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [nonce]);

  return null;
}
