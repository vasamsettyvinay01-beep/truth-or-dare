"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { FloatingParticles } from "@/components/effects/FloatingParticles";
import { useGameActions } from "@/hooks/use-socket";
import { useGameStore } from "@/store/game-store";
import { loadSession } from "@/lib/utils";

/** Mobile keyboards happily insert spaces and smart quotes into a room code. */
function sanitizeCode(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 6);
}

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actions = useGameActions();
  const connected = useGameStore((s) => s.connected);
  const connecting = useGameStore((s) => s.connecting);
  const status = useGameStore((s) => s.status);
  const fatalError = useGameStore((s) => s.fatalError);
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState("#22d3ee");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = sanitizeCode(params.get("code") || "");
    if (q) setCode(q);
    const session = loadSession(q || undefined);
    if (session) {
      setNickname(session.nickname);
      setCode(sanitizeCode(session.code));
    }
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = sanitizeCode(code);
    const cleanNickname = nickname.trim();
    if (!cleanNickname || !cleanCode) return;
    setBusy(true);
    try {
      const session = loadSession(cleanCode);
      const data = await actions.joinRoom({
        code: cleanCode,
        nickname: cleanNickname,
        color,
        reconnectToken: session?.reconnectToken,
      });
      router.push(`/room/${data.room.code}`);
    } catch (err) {
      useGameStore.getState().setError(err instanceof Error ? err.message : "Failed to join");
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="glass mt-6 space-y-6 rounded-[1.75rem] p-5 sm:mt-8 sm:rounded-[2rem] sm:p-6 md:p-8"
    >
      <Input
        label="Room code"
        value={code}
        onChange={(e) => setCode(sanitizeCode(e.target.value))}
        placeholder="ABC123"
        maxLength={6}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        className="font-mono tracking-[0.3em]"
        required
      />
      <Input
        label="Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Your display name"
        maxLength={20}
        autoComplete="nickname"
        enterKeyHint="go"
        required
      />
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Avatar color</p>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={busy || !nickname.trim() || code.length < 4 || status === "unavailable"}
      >
        {busy
          ? "Joining…"
          : status === "unavailable"
            ? "Server unavailable"
            : connected
              ? "Join room"
              : "Join room (connecting…)"}
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
  );
}

export default function JoinPage() {
  return (
    <div className="safe-area relative min-h-screen-safe overflow-x-hidden px-5 py-8 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,77,109,0.16),transparent_45%)]" />
      <FloatingParticles count={16} />
      <div className="relative mx-auto w-full max-w-xl">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted sm:mb-8 sm:hover:text-cream"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Link>
        <h1 className="font-display text-3xl text-gradient sm:text-4xl">Join a room</h1>
        <p className="mt-2 text-muted">Enter the code. Drop in. No password theater.</p>
        <Suspense
          fallback={<div className="glass mt-6 h-64 animate-pulse rounded-[1.75rem] sm:mt-8 sm:rounded-[2rem]" />}
        >
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
