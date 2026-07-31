"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { GAME_MODES, type GameMode } from "@tod/shared";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { FloatingParticles } from "@/components/effects/FloatingParticles";
import { useGameActions } from "@/hooks/use-socket";
import { useGameStore } from "@/store/game-store";
import { cn } from "@/lib/utils";

export default function CreatePage() {
  const router = useRouter();
  const actions = useGameActions();
  const connecting = useGameStore((s) => s.connecting);
  const connected = useGameStore((s) => s.connected);
  const status = useGameStore((s) => s.status);
  const fatalError = useGameStore((s) => s.fatalError);
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState("#a78bfa");
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setBusy(true);
    try {
      const data = await actions.createRoom({
        nickname: nickname.trim(),
        color,
        maxPlayers,
        gameMode,
      });
      router.push(`/room/${data.room.code}`);
    } catch (err) {
      useGameStore.getState().setError(err instanceof Error ? err.message : "Failed to create room");
      setBusy(false);
    }
  };

  return (
    <div className="safe-area relative min-h-screen-safe overflow-x-hidden px-5 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,92,255,0.18),transparent_45%)]" />
      <FloatingParticles count={16} />
      <div className="relative mx-auto w-full max-w-xl">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted sm:mb-8 sm:hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <h1 className="font-display text-3xl text-gradient sm:text-4xl">Create a room</h1>
        <p className="mt-2 text-muted">Pick a name, a vibe, and open the night.</p>

        <form
          onSubmit={onSubmit}
          className="glass mt-6 space-y-6 rounded-[1.75rem] p-5 sm:mt-8 sm:rounded-[2rem] sm:p-6 md:p-8"
        >
          <Input
            label="Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="How should we call you?"
            maxLength={20}
            required
          />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Avatar color</p>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
              Max players · {maxPlayers}
            </span>
            <input
              type="range"
              min={2}
              max={20}
              value={maxPlayers}
              aria-label="Maximum players"
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="h-11 w-full accent-[color:var(--color-accent)]"
            />
          </label>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Starting mode</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {GAME_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={gameMode === m.id}
                  onClick={() => setGameMode(m.id)}
                  className={cn(
                    "flex min-h-[48px] items-center rounded-2xl border px-3 py-3 text-left text-sm transition",
                    gameMode === m.id
                      ? "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/10"
                      : "border-white/10 bg-white/[0.03]"
                  )}
                >
                  <span className="font-medium">
                    {m.label}
                    {m.experimental ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-200/80">
                        Exp
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={busy || !nickname.trim() || status === "unavailable"}
          >
            {busy
              ? "Opening room…"
              : status === "unavailable"
                ? "Server unavailable"
                : connected
                  ? "Create room"
                  : "Create room (connecting…)"}
          </Button>
          {!connected && (
            <p className="text-center text-xs text-muted" role="status">
              {status === "unavailable"
                ? fatalError || "Can't reach the game server right now."
                : connecting
                  ? "Reaching the game server…"
                  : "Waiting for the game server."}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
