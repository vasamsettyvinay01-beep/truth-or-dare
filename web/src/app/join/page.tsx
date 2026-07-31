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

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const actions = useGameActions();
  const connected = useGameStore((s) => s.connected);
  const connecting = useGameStore((s) => s.connecting);
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState("#22d3ee");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = params.get("code");
    if (q) setCode(q.toUpperCase());
    const session = loadSession(q || undefined);
    if (session) {
      setNickname(session.nickname);
      setCode(session.code);
    }
  }, [params]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !code.trim()) return;
    setBusy(true);
    try {
      const session = loadSession(code);
      const data = await actions.joinRoom({
        code: code.toUpperCase(),
        nickname,
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
    <form onSubmit={onSubmit} className="glass mt-8 space-y-6 rounded-[2rem] p-6 md:p-8">
      <Input
        label="Room code"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="ABC123"
        maxLength={6}
        className="font-mono tracking-[0.3em]"
        required
      />
      <Input
        label="Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        placeholder="Your display name"
        maxLength={20}
        required
      />
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Avatar color</p>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={busy || connecting || !connected}>
        {busy ? "Joining…" : connected ? "Join room" : "Connecting…"}
      </Button>
    </form>
  );
}

export default function JoinPage() {
  return (
    <div className="relative min-h-screen overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,77,109,0.16),transparent_45%)]" />
      <FloatingParticles count={16} />
      <div className="relative mx-auto max-w-xl">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-cream">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="font-display text-4xl text-gradient">Join a room</h1>
        <p className="mt-2 text-muted">Enter the code. Drop in. No password theater.</p>
        <Suspense fallback={<div className="glass mt-8 h-64 animate-pulse rounded-[2rem]" />}>
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
