"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Mic, MicOff, Copy, Check, LogOut } from "lucide-react";
import { useMemo, useState } from "react";
import { GAME_MODES } from "@tod/shared";
import { useGameStore } from "@/store/game-store";
import { useGameActions } from "@/hooks/use-socket";
import { inviteUrl, levelLabel, shareOrCopy } from "@/lib/utils";
import { ConnectionBadge } from "../ui/ConnectionStatus";
import { Button } from "../ui/Button";
import { PlayerCard } from "../lobby/PlayerCard";
import { AdminPanel } from "../lobby/AdminPanel";
import { ChatPanel } from "../chat/ChatPanel";
import { LevelSelect } from "../game/LevelSelect";
import { ChallengeCard } from "../game/ChallengeCard";
import { SpinWheel } from "../game/SpinWheel";

type RoomTab = "play" | "players" | "settings" | "chat";

export function RoomExperience() {
  const room = useGameStore((s) => s.room);
  const playerId = useGameStore((s) => s.playerId);
  const promptPack = useGameStore((s) => s.promptPack);
  const setError = useGameStore((s) => s.setError);
  const actions = useGameActions();
  const [copied, setCopied] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [tab, setTab] = useState<RoomTab>("play");

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
    const result = await shareOrCopy(inviteUrl(room.code));
    if (result === "failed") {
      setError(`Couldn't copy automatically. Share this code instead: ${room.code}`);
      return;
    }
    if (result === "cancelled") return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const categories =
    promptPack?.categories?.length
      ? promptPack.categories
      : [...new Set(promptPack?.prompts.map((p) => p.category) || [])];

  const mobileTabs: RoomTab[] = ["play", "players"];
  if (room.settings.chatEnabled) mobileTabs.push("chat");
  if (isHost) mobileTabs.push("settings");

  const activeTab: RoomTab = mobileTabs.includes(tab) ? tab : "play";
  const showMain = activeTab === "play" || activeTab === "settings";
  const showPlayers = activeTab === "players";
  const showChat = activeTab === "chat";

  return (
    <div className="safe-area mx-auto flex min-h-screen-safe w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6 md:px-8">
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.25em] text-muted">Truth or Dare</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="font-display text-xl tracking-wide sm:text-2xl">{room.code}</h1>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
              {modeMeta?.label}
            </span>
            {room.level && (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs capitalize text-muted">
                {levelLabel(room.level)}
              </span>
            )}
            <ConnectionBadge />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={copyInvite}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Invite"}
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
              {voiceOn ? <Mic className="h-4 w-4" aria-hidden /> : <MicOff className="h-4 w-4" aria-hidden />}
              Voice
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => actions.leaveRoom()}>
            <LogOut className="h-4 w-4" aria-hidden /> Leave
          </Button>
        </div>
      </header>

      {/* One panel at a time below lg, where a three-column layout cannot fit. */}
      <nav
        aria-label="Room sections"
        className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden"
      >
        {mobileTabs.map((t) => (
          <button
            key={t}
            type="button"
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
            className={`tap-target shrink-0 rounded-full px-4 text-sm capitalize transition ${
              tab === t ? "bg-white text-ink" : "bg-white/5 text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="grid flex-1 gap-4 sm:gap-6 lg:grid-cols-[1fr_340px]">
        <main className={`space-y-6 ${showMain ? "" : "hidden lg:block"}`}>
          {room.phase === "lobby" && (
            <div className="space-y-6">
              <div
                className={`glass rounded-[1.75rem] p-6 text-center sm:rounded-[2rem] sm:p-8 ${
                  activeTab === "settings" ? "hidden lg:block" : ""
                }`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-muted">Lobby</p>
                <h2 className="mt-3 font-display text-3xl text-gradient sm:text-4xl">
                  Gather your crew
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted sm:text-base">
                  Share the code <span className="font-mono text-cream">{room.code}</span> or invite link.
                  Everyone ready? Host starts the night.
                </p>
                <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center">
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
              {isHost && (
                <div className={activeTab === "settings" ? "block" : "hidden lg:block"}>
                  <AdminPanel
                    settings={room.settings}
                    categories={categories}
                    promptPack={promptPack}
                    onChange={actions.updateSettings}
                    onImport={actions.importPrompts}
                  />
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
                <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
                  <Button
                    variant="truth"
                    size="lg"
                    className="sm:min-w-[160px]"
                    disabled={!isMyTurn}
                    onClick={() => actions.choose("truth")}
                  >
                    Truth
                  </Button>
                  <Button
                    variant="dare"
                    size="lg"
                    className="sm:min-w-[160px]"
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
                    <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
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
            <div className="glass rounded-[1.75rem] p-6 text-center sm:rounded-[2rem] sm:p-10">
              <p className="text-xs uppercase tracking-[0.25em] text-muted">Game Over</p>
              <h2 className="mt-3 break-words font-display text-3xl text-gradient sm:text-5xl">
                {room.players.find((p) => p.id === room.winnerId)?.nickname || "Night complete"}
              </h2>
              <p className="mt-3 text-muted">
                {room.winnerId ? "takes the crown." : "Thanks for playing."}
              </p>
              {isHost && (
                <Button className="mt-8 w-full sm:w-auto" onClick={() => actions.returnToLobby()}>
                  Back to lobby
                </Button>
              )}
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <div className={`${showPlayers ? "block" : "hidden lg:block"} space-y-3`}>
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
          <div
            className={`${showChat ? "block" : "hidden lg:block"} h-[min(60vh,420px)] lg:h-[420px]`}
          >
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
