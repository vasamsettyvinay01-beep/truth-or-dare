"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useIsSmallScreen } from "@/hooks/use-media-query";

export function FloatingParticles({ count = 24 }: { count?: number }) {
  const reduceMotion = useReducedMotion();
  const isSmall = useIsSmallScreen();

  // Dozens of infinite transforms drain the battery and drop frames on phones.
  const effectiveCount = reduceMotion ? 0 : isSmall ? Math.min(count, 8) : count;

  const particles = useMemo(
    () =>
      Array.from({ length: effectiveCount }, (_, i) => ({
        id: i,
        left: `${(i * 37) % 100}%`,
        size: 2 + (i % 4),
        delay: (i % 10) * 0.4,
        duration: 8 + (i % 7),
      })),
    [effectiveCount]
  );

  if (!particles.length) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-white/30"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            bottom: -10,
          }}
          animate={{ y: [0, -900], opacity: [0, 0.7, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
