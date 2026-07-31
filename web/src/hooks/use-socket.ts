"use client";

import { useEffect, useMemo } from "react";
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  ChallengeType,
  ChatMessage,
  GameLevel,
  PromptPack,
  RoomPublic,
  RoomSettings,
  TurnAction,
} from "@tod/shared";
import { connectSocket, getSocket, resolveSocketUrl } from "@/lib/socket";
import { clearAllSessions, clearSession, saveSession } from "@/lib/utils";
import { useGameStore } from "@/store/game-store";

/** Server codes mapped to something a player can act on. */
const FRIENDLY_ERRORS: Record<string, string> = {
  ROOM_NOT_FOUND: "That room code doesn't exist. Double-check it and try again.",
  ROOM_FULL: "This room is full. Ask the host to raise the player limit.",
  NICKNAME_TAKEN: "Someone already has that nickname. Pick another one.",
  NOT_HOST: "Only the host can do that.",
  NOT_YOUR_TURN: "Hold on — it's not your turn yet.",
  NO_LEVEL: "The host still needs to pick a level.",
  NO_PROMPTS: "No prompts left for these filters. Enable more categories.",
  ROOM_CLOSED: "The host closed this room.",
  INVALID_CODE: "Room codes are 6 characters, like ABC123.",
};

export function friendlyError(message: string, code?: string) {
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  return message || "Something went wrong. Try again.";
}

export function useSocketLifecycle() {
  const setStatus = useGameStore((s) => s.setStatus);
  const setFatalError = useGameStore((s) => s.setFatalError);
  const setRoom = useGameStore((s) => s.setRoom);
  const appendChat = useGameStore((s) => s.appendChat);
  const setPromptPack = useGameStore((s) => s.setPromptPack);
  const setError = useGameStore((s) => s.setError);
  const pushReaction = useGameStore((s) => s.pushReaction);
  const setSpin = useGameStore((s) => s.setSpin);
  const bumpConfetti = useGameStore((s) => s.bumpConfetti);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    const resolved = resolveSocketUrl();
    if (!resolved.ok) {
      setFatalError(resolved.reason);
      setStatus("unavailable");
      return;
    }

    setStatus("connecting");
    const socket = connectSocket();

    const onConnect = () => {
      setFatalError(null);
      setStatus("connected");
    };
    const onDisconnect = (reason: string) => {
      // "io client disconnect" is our own leaveRoom, not a network problem.
      setStatus(reason === "io client disconnect" ? "disconnected" : "reconnecting");
    };
    const onConnectError = () => setStatus("reconnecting");
    const onReconnectAttempt = () => setStatus("reconnecting");
    const onRoomState = (room: RoomPublic) => setRoom(room);
    const onChat = (message: ChatMessage) => appendChat(message);
    const onPack = (pack: PromptPack) => setPromptPack(pack);
    const onRoomError = (e: { message: string; code?: string }) =>
      setError(friendlyError(e.message, e.code));
    const onDestroyed = (reason: string) => {
      const code = useGameStore.getState().room?.code;
      if (code) clearSession(code);
      else clearAllSessions();
      setError(reason === "empty" ? "Everyone left, so the room closed." : "The host closed this room.");
      reset();
    };
    const onConfetti = () => bumpConfetti();
    const onReaction = ({ emoji }: { emoji: string }) => pushReaction(emoji);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.on("room:state", onRoomState);
    socket.on("chat:message", onChat);
    socket.on("prompts:pack", onPack);
    socket.on("room:error", onRoomError);
    socket.on("room:destroyed", onDestroyed);
    socket.on("game:confetti", onConfetti);
    socket.on("game:spin-result", setSpin);
    socket.on("player:reaction", onReaction);

    if (socket.connected) onConnect();

    // iOS Safari suspends sockets when a tab is backgrounded and never fires a
    // disconnect, so the player looks online but receives nothing. Nudge the
    // connection whenever the tab or network comes back.
    const revive = () => {
      if (document.visibilityState === "visible" && !socket.connected) {
        setStatus("reconnecting");
        socket.connect();
      }
    };
    document.addEventListener("visibilitychange", revive);
    window.addEventListener("online", revive);
    window.addEventListener("pageshow", revive);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.off("room:state", onRoomState);
      socket.off("chat:message", onChat);
      socket.off("prompts:pack", onPack);
      socket.off("room:error", onRoomError);
      socket.off("room:destroyed", onDestroyed);
      socket.off("game:confetti", onConfetti);
      socket.off("game:spin-result", setSpin);
      socket.off("player:reaction", onReaction);
      document.removeEventListener("visibilitychange", revive);
      window.removeEventListener("online", revive);
      window.removeEventListener("pageshow", revive);
    };
  }, [
    setStatus,
    setFatalError,
    setRoom,
    appendChat,
    setPromptPack,
    setError,
    pushReaction,
    setSpin,
    bumpConfetti,
    reset,
  ]);
}

type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: { message: string; code?: string } }) => void;

/**
 * Wraps an emit+ack. Without the timeout a dropped packet on a mobile network
 * leaves the button spinning forever with no way back.
 */
function ackPromise<T>(run: (ack: Ack<T>) => void, timeoutMs = 12000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("The server didn't respond. Check your connection and try again."));
    }, timeoutMs);

    run((res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (res.ok) resolve(res.data);
      else reject(new Error(friendlyError(res.error.message, res.error.code)));
    });
  });
}

interface JoinResult {
  room: RoomPublic;
  playerId: string;
  reconnectToken: string;
}

export function useGameActions() {
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const setError = useGameStore((s) => s.setError);
  const reset = useGameStore((s) => s.reset);

  // Stable identity keeps these usable inside effect dependency lists.
  return useMemo(() => ({
    async createRoom(payload: CreateRoomPayload) {
      const socket = connectSocket();
      const data = await ackPromise<JoinResult>((ack) =>
        socket.emit("room:create", payload, ack)
      );
      setSession(data.playerId, data.reconnectToken);
      setRoom(data.room);
      saveSession({
        playerId: data.playerId,
        reconnectToken: data.reconnectToken,
        nickname: payload.nickname,
        code: data.room.code,
      });
      return data;
    },

    async joinRoom(payload: JoinRoomPayload) {
      const socket = connectSocket();
      const data = await ackPromise<JoinResult>((ack) =>
        socket.emit("room:join", payload, ack)
      );
      setSession(data.playerId, data.reconnectToken);
      setRoom(data.room);
      saveSession({
        playerId: data.playerId,
        reconnectToken: data.reconnectToken,
        nickname: payload.nickname,
        code: data.room.code,
      });
      return data;
    },

    leaveRoom() {
      const room = useGameStore.getState().room;
      getSocket().emit("room:leave");
      if (room) clearSession(room.code);
      reset();
    },

    setReady(ready: boolean) {
      getSocket().emit("room:ready", ready);
    },

    startGame() {
      getSocket().emit("room:start");
    },

    updateSettings(partial: Partial<RoomSettings>) {
      getSocket().emit("room:settings", partial);
    },

    kick(playerId: string) {
      getSocket().emit("room:kick", playerId);
    },

    transferHost(playerId: string) {
      getSocket().emit("room:transfer-host", playerId);
    },

    selectLevel(level: GameLevel) {
      getSocket().emit("room:select-level", level);
    },

    choose(type: ChallengeType) {
      getSocket().emit("game:choose", type);
    },

    spin() {
      getSocket().emit("game:spin");
    },

    action(action: TurnAction) {
      getSocket().emit("game:action", action);
    },

    sendChat(text: string) {
      getSocket().emit("chat:send", text);
    },

    pinMessage(id: string) {
      getSocket().emit("chat:pin", id);
    },

    react(emoji: string, targetPlayerId?: string) {
      getSocket().emit("chat:react", emoji, targetPlayerId);
    },

    importPrompts(pack: PromptPack | { prompts: unknown[] } | unknown[]) {
      getSocket().emit("room:import-prompts", pack as PromptPack);
    },

    returnToLobby() {
      getSocket().emit("room:return-lobby");
    },

    joinVoice() {
      getSocket().emit("voice:join");
    },

    leaveVoice() {
      getSocket().emit("voice:leave");
    },

    clearError() {
      setError(null);
    },
  }), [setSession, setRoom, setError, reset]);
}
