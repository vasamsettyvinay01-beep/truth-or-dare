"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { RoomExperience } from "@/components/game/RoomExperience";
import { useGameActions } from "@/hooks/use-socket";
import { useGameStore } from "@/store/game-store";
import { loadSession } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "reconnecting" | "need-join" | "ready";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();
  const room = useGameStore((s) => s.room);
  const connected = useGameStore((s) => s.connected);
  const actions = useGameActions();
  const [status, setStatus] = useState<Status>("idle");
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (room?.code === code) {
      setStatus("ready");
      return;
    }
    if (!connected || !code) return;

    // Guard against a second rejoin (React strict mode, re-renders, or a
    // socket reconnect) creating a duplicate player.
    if (attemptedRef.current === code) return;

    const session = loadSession(code);
    if (!session?.reconnectToken) {
      setStatus("need-join");
      return;
    }

    attemptedRef.current = code;
    setStatus("reconnecting");
    actions
      .joinRoom({
        code,
        nickname: session.nickname,
        reconnectToken: session.reconnectToken,
      })
      .then(() => setStatus("ready"))
      .catch(() => {
        attemptedRef.current = null;
        setStatus("need-join");
      });
  }, [connected, code, room?.code, actions]);

  if (status === "need-join") {
    return (
      <div className="safe-area flex min-h-screen-safe flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl sm:text-3xl">Join room {code}</h1>
        <p className="max-w-sm text-sm text-muted">
          Enter a nickname to get in. Nothing is saved after the room closes.
        </p>
        <Link href={`/join?code=${code}`} className="w-full max-w-xs">
          <Button size="lg" className="w-full">
            Continue
          </Button>
        </Link>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Home
        </Button>
      </div>
    );
  }

  if (!room || room.code !== code) {
    return (
      <div
        className="safe-area flex min-h-screen-safe flex-col items-center justify-center gap-3 px-6 text-center text-muted"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <p>{status === "reconnecting" ? "Reconnecting you to the room…" : "Entering room…"}</p>
        {!connected && (
          <p className="max-w-xs text-xs">
            Waiting for the game server. This keeps retrying on its own.
          </p>
        )}
      </div>
    );
  }

  return <RoomExperience />;
}
