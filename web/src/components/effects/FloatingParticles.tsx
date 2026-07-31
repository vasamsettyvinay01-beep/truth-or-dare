"use client";

import { motion } from "framer-motion";

export function FloatingParticles({ count = 24 }: { count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: `${(i * 37) % 100}%`,
    size: 2 + (i % 4),
    delay: (i % 10) * 0.4,
    duration: 8 + (i % 7),
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
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
