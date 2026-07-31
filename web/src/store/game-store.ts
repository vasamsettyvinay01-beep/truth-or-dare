"use client";

import { create } from "zustand";
import type {
  ChatMessage,
  ChallengeType,
  PromptPack,
  RoomPublic,
} from "@tod/shared";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "unavailable";

interface GameStore {
  connected: boolean;
  connecting: boolean;
  status: ConnectionStatus;
  /** Set when the deployment itself is misconfigured (bad socket URL, etc). */
  fatalError: string | null;
  playerId: string | null;
  reconnectToken: string | null;
  room: RoomPublic | null;
  promptPack: PromptPack | null;
  error: string | null;
  floatingReactions: { id: string; emoji: string; x: number }[];
  lastSpin: { type: ChallengeType; angle: number } | null;
  confettiNonce: number;
  setConnected: (v: boolean) => void;
  setConnecting: (v: boolean) => void;
  setStatus: (status: ConnectionStatus) => void;
  setFatalError: (message: string | null) => void;
  setSession: (playerId: string, reconnectToken: string) => void;
  setRoom: (room: RoomPublic | null) => void;
  appendChat: (message: ChatMessage) => void;
  setPromptPack: (pack: PromptPack) => void;
  setError: (error: string | null) => void;
  pushReaction: (emoji: string) => void;
  setSpin: (spin: { type: ChallengeType; angle: number } | null) => void;
  bumpConfetti: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  connecting: false,
  status: "idle",
  fatalError: null,
  playerId: null,
  reconnectToken: null,
  room: null,
  promptPack: null,
  error: null,
  floatingReactions: [],
  lastSpin: null,
  confettiNonce: 0,
  setConnected: (connected) => set({ connected }),
  setConnecting: (connecting) => set({ connecting }),
  setStatus: (status) =>
    set({
      status,
      connected: status === "connected",
      connecting: status === "connecting" || status === "reconnecting",
    }),
  setFatalError: (fatalError) => set({ fatalError }),
  setSession: (playerId, reconnectToken) => set({ playerId, reconnectToken }),
  setRoom: (room) => set({ room }),
  appendChat: (message) =>
    set((s) => {
      if (!s.room) return s;
      if (s.room.chat.some((m) => m.id === message.id)) return s;
      return { room: { ...s.room, chat: [...s.room.chat, message].slice(-120) } };
    }),
  setPromptPack: (promptPack) => set({ promptPack }),
  setError: (error) => set({ error }),
  pushReaction: (emoji) =>
    set((s) => ({
      floatingReactions: [
        ...s.floatingReactions.slice(-12),
        { id: `${Date.now()}-${Math.random()}`, emoji, x: 10 + Math.random() * 80 },
      ],
    })),
  setSpin: (lastSpin) => set({ lastSpin }),
  bumpConfetti: () => set((s) => ({ confettiNonce: s.confettiNonce + 1 })),
  reset: () =>
    set({
      playerId: null,
      reconnectToken: null,
      room: null,
      error: null,
      lastSpin: null,
      floatingReactions: [],
    }),
}));
