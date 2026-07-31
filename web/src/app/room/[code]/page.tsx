"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RoomExperience } from "@/components/game/RoomExperience";
import { useGameActions } from "@/hooks/use-socket";
import { useGameStore } from "@/store/game-store";
import { loadSession } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const router = useRouter();
  const room = useGameStore((s) => s.room);
  const connected = useGameStore((s) => s.connected);
  const actions = useGameActions();
  const [status, setStatus] = useState<"idle" | "reconnecting" | "need-join" | "ready">("idle");

  useEffect(() => {
    if (!connected || !code) return;
    if (room?.code === code) {
      setStatus("ready");
      return;
    }

    const session = loadSession(code);
    if (!session?.reconnectToken) {
      setStatus("need-join");
      return;
    }

    setStatus("reconnecting");
    actions
      .joinRoom({
        code,
        nickname: session.nickname,
        reconnectToken: session.reconnectToken,
      })
      .then(() => setStatus("ready"))
      .catch(() => setStatus("need-join"));
  }, [connected, code, room?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "need-join") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl">Join room {code}</h1>
        <p className="text-muted">Enter a nickname to get in.</p>
        <Link href={`/join?code=${code}`}>
          <Button size="lg">Continue</Button>
        </Link>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Home
        </Button>
      </div>
    );
  }

  if (!room || room.code !== code) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        {status === "reconnecting" ? "Reconnecting…" : "Entering room…"}
      </div>
    );
  }

  return <RoomExperience />;
}
