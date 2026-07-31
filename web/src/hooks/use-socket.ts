"use client";

import { useEffect } from "react";
import type {
  CreateRoomPayload,
  JoinRoomPayload,
  ChallengeType,
  GameLevel,
  PromptPack,
  RoomSettings,
  TurnAction,
} from "@tod/shared";
import { connectSocket, getSocket } from "@/lib/socket";
import { clearSession, saveSession } from "@/lib/utils";
import { useGameStore } from "@/store/game-store";

export function useSocketLifecycle() {
  const setConnected = useGameStore((s) => s.setConnected);
  const setConnecting = useGameStore((s) => s.setConnecting);
  const setRoom = useGameStore((s) => s.setRoom);
  const appendChat = useGameStore((s) => s.appendChat);
  const setPromptPack = useGameStore((s) => s.setPromptPack);
  const setError = useGameStore((s) => s.setError);
  const pushReaction = useGameStore((s) => s.pushReaction);
  const setSpin = useGameStore((s) => s.setSpin);
  const bumpConfetti = useGameStore((s) => s.bumpConfetti);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    setConnecting(true);
    const socket = connectSocket();

    const onConnect = () => {
      setConnected(true);
      setConnecting(false);
    };
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", setRoom);
    socket.on("chat:message", appendChat);
    socket.on("prompts:pack", setPromptPack);
    socket.on("room:error", (e) => setError(e.message));
    socket.on("room:destroyed", (reason) => {
      setError(`Room closed (${reason})`);
      reset();
    });
    socket.on("game:confetti", () => bumpConfetti());
    socket.on("game:spin-result", setSpin);
    socket.on("player:reaction", ({ emoji }) => pushReaction(emoji));

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", setRoom);
      socket.off("chat:message", appendChat);
      socket.off("prompts:pack", setPromptPack);
      socket.off("room:error");
      socket.off("room:destroyed");
      socket.off("game:confetti");
      socket.off("game:spin-result");
      socket.off("player:reaction");
    };
  }, [
    setConnected,
    setConnecting,
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

function ackPromise<T>(
  run: (ack: (res: { ok: true; data: T } | { ok: false; error: { message: string } }) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    run((res) => {
      if (res.ok) resolve(res.data);
      else reject(new Error(res.error.message));
    });
  });
}

export function useGameActions() {
  const setSession = useGameStore((s) => s.setSession);
  const setRoom = useGameStore((s) => s.setRoom);
  const setError = useGameStore((s) => s.setError);
  const reset = useGameStore((s) => s.reset);

  return {
    async createRoom(payload: CreateRoomPayload) {
      const socket = getSocket();
      const data = await ackPromise<{
        room: NonNullable<ReturnType<typeof useGameStore.getState>["room"]>;
        playerId: string;
        reconnectToken: string;
      }>((ack) => socket.emit("room:create", payload, ack));
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
      const socket = getSocket();
      const data = await ackPromise<{
        room: NonNullable<ReturnType<typeof useGameStore.getState>["room"]>;
        playerId: string;
        reconnectToken: string;
      }>((ack) => socket.emit("room:join", payload, ack));
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

    importPrompts(pack: PromptPack) {
      getSocket().emit("room:import-prompts", pack);
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
  };
}
