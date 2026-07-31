"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Copy, Check, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { GAME_MODES } from "@tod/shared";
import { useGameStore } from "@/store/game-store";
import { useGameActions } from "@/hooks/use-socket";
import { inviteUrl, levelLabel } from "@/lib/utils";
import { Button } from "../ui/Button";
import { PlayerCard } from "../lobby/PlayerCard";
import { AdminPanel } from "../lobby/AdminPanel";
import { ChatPanel } from "../chat/ChatPanel";
import { LevelSelect } from "../game/LevelSelect";
import { ChallengeCard } from "../game/ChallengeCard";
import { SpinWheel } from "../game/SpinWheel";

export function RoomExperience() {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const promptPack = useGameStore((s) => s.promptPack);
  const connected = useGameStore((s) => s.connected);
  const actions = useGameActions();
  const [copied, setCopied] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [tab, setTab] = useState<"play" | "players" | "settings" | "chat">("play");

  const me = useMemo(() => room?.players.find((p) => p.id === playerId), [room, playerId]);
  const isHost = me?.isHost;
  const currentPlayer = useMemo(
    () => room?.players.find((p) => p.id === room.currentPlayerId),
    [room]
  );
  const isMyTurn = room?.currentPlayerId === playerId;
  const modeMeta = GAME_MODES.find((m) => m.id === room?.settings.gameMode);

  if (!room || !me) return null;

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl(room.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const categories =
    promptPack?.categories?.length
      ? promptPack.categories
      : [...new Set(promptPack?.prompts.map((p) => p.category) || [])];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="glass flex flex-wrap items-center justify-between gap-4 rounded-3xl px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted">Truth or Dare</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl tracking-wide">{room.code}</h1>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
              {modeMeta?.label}
            </span>
            {room.level && (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-muted">
                {levelLabel(room.level)}
              </span>
            )}
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyInvite}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Invite
          </Button>
          {room.settings.voiceEnabled && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (voiceOn) {
                  actions.leaveVoice();
                  setVoiceOn(false);
                } else {
                  actions.joinVoice();
                  setVoiceOn(true);
                }
              }}
            >
              {voiceOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              Voice
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => actions.leaveRoom()}>
            <LogOut className="h-4 w-4" /> Leave
          </Button>
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto md:hidden">
        {(["play", "players", "settings", "chat"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm capitalize ${
              tab === t ? "bg-white text-ink" : "bg-white/5 text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1fr_340px]">
        <main className={`space-y-6 ${tab !== "play" && tab !== "settings" ? "hidden md:block" : ""}`}>
          {room.phase === "lobby" && (
            <div className="space-y-6">
              <div className="glass rounded-[2rem] p-8 text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-muted">Lobby</p>
                <h2 className="mt-3 font-display text-4xl text-gradient">Gather your crew</h2>
                <p className="mx-auto mt-3 max-w-md text-muted">
                  Share the code <span className="font-mono text-cream">{room.code}</span> or invite link.
                  Everyone ready? Host starts the night.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant={me.isReady ? "secondary" : "primary"}
                    size="lg"
                    onClick={() => actions.setReady(!me.isReady)}
                  >
                    {me.isReady ? "Unready" : "I'm Ready"}
                  </Button>
                  {isHost && (
                    <Button size="lg" variant="secondary" onClick={() => actions.startGame()}>
                      Start Game
                    </Button>
                  )}
                </div>
              </div>
              {(isHost || tab === "settings") && (
                <div className={tab === "settings" || isHost ? "block" : "hidden md:block"}>
                  {isHost && (
                    <AdminPanel
                      settings={room.settings}
                      categories={categories}
                      promptPack={promptPack}
                      onChange={actions.updateSettings}
                      onImport={actions.importPrompts}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {room.phase === "level_select" && (
            <LevelSelect
              enabled={room.settings.enabledLevels}
              isHost={!!isHost}
              onSelect={actions.selectLevel}
            />
          )}

          {(room.phase === "playing" ||
            room.phase === "spinning" ||
            room.phase === "revealing" ||
            room.phase === "result") && (
            <div className="space-y-8">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.25em] text-muted">
                  Round {room.round} · {currentPlayer?.nickname}&apos;s turn
                </p>
                <AnimatePresence mode="wait">
                  <motion.h2
                    key={room.currentPlayerId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 font-display text-3xl md:text-4xl"
                  >
                    {isMyTurn ? "Your move" : `Waiting on ${currentPlayer?.nickname}`}
                  </motion.h2>
                </AnimatePresence>
              </div>

              {room.phase === "spinning" && (
                <SpinWheel onSpin={actions.spin} disabled={!isMyTurn} />
              )}

              {room.phase === "playing" && room.settings.gameMode !== "random" && (
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <Button
                    variant="truth"
                    size="lg"
                    className="min-w-[160px]"
                    disabled={!isMyTurn}
                    onClick={() => actions.choose("truth")}
                  >
                    Truth
                  </Button>
                  <Button
                    variant="dare"
                    size="lg"
                    className="min-w-[160px]"
                    disabled={!isMyTurn}
                    onClick={() => actions.choose("dare")}
                  >
                    Dare
                  </Button>
                </div>
              )}

              {room.phase === "playing" && room.settings.gameMode === "random" && (
                <p className="text-center text-muted">Rolling a random challenge…</p>
              )}

              {room.currentChallenge && room.phase === "revealing" && (
                <div className="space-y-6">
                  <ChallengeCard challenge={room.currentChallenge} />
                  {isMyTurn && (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <Button size="lg" onClick={() => actions.action("complete")}>
                        Complete
                      </Button>
                      <Button
                        variant="secondary"
                        size="lg"
                        disabled={!room.settings.skippingEnabled || me.skipTokens <= 0}
                        onClick={() => actions.action("skip")}
                      >
                        Skip ({me.skipTokens})
                      </Button>
                      <Button variant="ghost" size="lg" onClick={() => actions.action("new_prompt")}>
                        New Prompt
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {room.phase === "ended" && (
            <div className="glass rounded-[2rem] p-10 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-muted">Game Over</p>
              <h2 className="mt-3 font-display text-5xl text-gradient">
                {room.players.find((p) => p.id === room.winnerId)?.nickname || "Night complete"}
              </h2>
              <p className="mt-3 text-muted">
                {room.winnerId ? "takes the crown." : "Thanks for playing."}
              </p>
              {isHost && (
                <Button className="mt-8" onClick={() => actions.returnToLobby()}>
                  Back to lobby
                </Button>
              )}
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <div className={`${tab === "players" || tab === "play" ? "block" : "hidden md:block"} space-y-3`}>
            <h3 className="px-1 text-xs uppercase tracking-[0.2em] text-muted">
              Players · {room.players.length}/{room.settings.maxPlayers}
            </h3>
            {room.players.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                isYou={p.id === playerId}
                isHostView={!!isHost}
                isCurrentTurn={p.id === room.currentPlayerId && room.phase !== "lobby"}
                onKick={() => actions.kick(p.id)}
                onTransfer={() => actions.transferHost(p.id)}
                onReact={(emoji) => actions.react(emoji, p.id)}
              />
            ))}
          </div>
          <div className={`${tab === "chat" || tab === "play" ? "block" : "hidden md:block"} h-[420px]`}>
            <ChatPanel
              messages={room.chat}
              onSend={actions.sendChat}
              onPin={actions.pinMessage}
              isHost={isHost}
              disabled={!room.settings.chatEnabled}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
