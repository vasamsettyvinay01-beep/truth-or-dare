"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Disc3, Flame, Sparkles, Users } from "lucide-react";
import { FloatingParticles } from "@/components/effects/FloatingParticles";
import { Button } from "@/components/ui/Button";

const features = [
  {
    icon: Users,
    title: "Instant rooms",
    text: "Create, share a code, and play. No accounts. No clutter.",
  },
  {
    icon: Flame,
    title: "Four intensities",
    text: "Cool to No Boundaries — host controls how far the night goes.",
  },
  {
    icon: Disc3,
    title: "Seven modes",
    text: "Classic, Spin Wheel, Survival, Couples, Team Battle, and more.",
  },
  {
    icon: Sparkles,
    title: "Live social layer",
    text: "Chat, reactions, optional voice, confetti when someone delivers.",
  },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen-safe overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-[42rem] w-[42rem] rounded-full bg-[radial-gradient(circle,rgba(255,77,109,0.22),transparent_60%)] blur-2xl" />
        <div className="absolute -right-24 top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(124,92,255,0.2),transparent_60%)] blur-2xl" />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_60%)] blur-2xl" />
        <FloatingParticles />
      </div>

      <div className="safe-area relative mx-auto flex min-h-screen-safe max-w-6xl flex-col px-5 pb-14 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
        <nav className="flex items-center justify-between gap-3">
          <div className="font-display text-lg tracking-[0.2em]">TOD</div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/join">
              <Button variant="ghost" size="sm">
                Join
              </Button>
            </Link>
            <Link href="/create">
              <Button size="sm">
                Create room <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
          </div>
        </nav>

        <section className="relative mt-12 flex flex-1 flex-col justify-center sm:mt-16 md:mt-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-muted sm:text-xs sm:tracking-[0.35em]">
              Remote nights · Real stakes
            </p>
            <h1 className="mt-4 font-display text-[clamp(2.75rem,13vw,4rem)] leading-[0.95] tracking-tight sm:mt-5 md:text-8xl">
              <span className="text-gradient">Truth or Dare</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted sm:mt-6 sm:text-lg md:text-xl">
              A premium multiplayer social game for friends anywhere in the world.
              One link. Zero logins. Pure chaos.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-4">
              <Link href="/create" className="sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Create a room <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </Link>
              <Link href="/join" className="sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Join with code
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="pointer-events-none absolute right-0 top-8 hidden w-[420px] lg:block"
          >
            <div className="glass relative aspect-square overflow-hidden rounded-[2.5rem] p-8">
              <div className="absolute inset-0 bg-[conic-gradient(from_120deg,#ff4d6d33,#7c5cff33,#38bdf833,#ff4d6d33)] opacity-70" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex justify-between text-xs uppercase tracking-[0.2em] text-muted">
                  <span>Live room</span>
                  <span>Round 03</span>
                </div>
                <div className="text-center">
                  <p className="font-display text-sm uppercase tracking-[0.3em] text-rose-300">Dare</p>
                  <p className="mt-4 font-display text-3xl leading-tight">
                    Slow dance for twenty seconds. Full commitment.
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  {["#22d3ee", "#f472b6", "#fbbf24", "#a78bfa"].map((c) => (
                    <span key={c} className="h-10 w-10 rounded-full" style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mt-14 grid gap-4 sm:mt-20 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-3xl p-5"
            >
              <f.icon className="mb-4 h-5 w-5 text-[color:var(--color-accent)]" />
              <h3 className="font-display text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.text}</p>
            </motion.div>
          ))}
        </section>
      </div>
    </div>
  );
}
