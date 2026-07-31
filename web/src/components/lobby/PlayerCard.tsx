"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, MoreHorizontal } from "lucide-react";
import type { Player } from "@tod/shared";
import { Avatar } from "./Avatar";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

export function PlayerCard({
  player,
  isYou,
  isHostView,
  isCurrentTurn,
  onKick,
  onTransfer,
  onReact,
}: {
  player: Player;
  isYou?: boolean;
  isHostView?: boolean;
  isCurrentTurn?: boolean;
  onKick?: () => void;
  onTransfer?: () => void;
  onReact?: (emoji: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // A <details> menu cannot be dismissed by tapping elsewhere on touch devices,
  // so the menu is managed explicitly with pointer and Escape handling.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass relative flex items-center gap-3 rounded-2xl p-3",
        isCurrentTurn && "glow-accent ring-1 ring-[color:var(--color-accent)]/40",
        player.eliminated && "opacity-50"
      )}
    >
      {isCurrentTurn && (
        <motion.span
          className="absolute inset-0 rounded-2xl"
          animate={{ boxShadow: ["0 0 0 0 rgba(255,77,109,0.0)", "0 0 0 8px rgba(255,77,109,0.12)", "0 0 0 0 rgba(255,77,109,0.0)"] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
        />
      )}
      <Avatar player={player} showHost />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{player.nickname}</p>
          {isYou && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">You</span>}
          {player.team && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider">
              Team {player.team}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted">
          <span>{player.score} pts</span>
          <span>·</span>
          <span>{player.completedChallenges} done</span>
          <span>·</span>
          <span>{player.skipTokens} skips</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {player.isReady ? (
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300"
            title="Ready"
          >
            <Check className="h-4 w-4" aria-hidden />
            <span className="sr-only">Ready</span>
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-white/20" aria-label="Not ready" role="img" />
        )}
        {onReact && (
          <div className="flex">
            {["🔥", "😂", "💀"].map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`React ${e} to ${player.nickname}`}
                className="flex h-11 w-9 items-center justify-center text-base opacity-80 transition active:scale-90 sm:hover:opacity-100"
                onClick={() => onReact(e)}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {isHostView && !isYou && (
          <div className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Host options for ${player.nickname}`}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10 sm:hover:bg-white/10"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 z-30 mt-2 w-40 overflow-hidden rounded-2xl border border-white/10 bg-ink-elevated p-1 shadow-xl"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                  className="w-full justify-start"
                  onClick={() => {
                    setMenuOpen(false);
                    onTransfer?.();
                  }}
                >
                  Make host
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  role="menuitem"
                  className="w-full justify-start"
                  onClick={() => {
                    setMenuOpen(false);
                    onKick?.();
                  }}
                >
                  Kick
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
