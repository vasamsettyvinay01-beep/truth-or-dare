/** Shared types & constants for Truth or Dare */

export type GameLevel = "cool" | "spicy" | "extreme" | "no_boundaries";
export type GameMode =
  | "classic"
  | "random"
  | "spin_wheel"
  | "survival"
  | "couples"
  | "team_battle"
  | "last_standing";
export type ChallengeType = "truth" | "dare";
export type RoomPhase =
  | "lobby"
  | "level_select"
  | "playing"
  | "spinning"
  | "revealing"
  | "result"
  | "ended";
export type PlayerOrder = "sequential" | "random";
export type TurnAction = "complete" | "skip" | "new_prompt";

export const GAME_LEVELS: { id: GameLevel; label: string; description: string; color: string }[] = [
  { id: "cool", label: "Cool", description: "Light, fun, everyone-friendly", color: "#38bdf8" },
  { id: "spicy", label: "Spicy", description: "Flirty and a little risky", color: "#f97316" },
  { id: "extreme", label: "Extreme", description: "Bold. Awkward. Unforgettable.", color: "#ef4444" },
  { id: "no_boundaries", label: "No Boundaries", description: "Adults only. No mercy.", color: "#a855f7" },
];

export const GAME_MODES: { id: GameMode; label: string; description: string; icon: string }[] = [
  { id: "classic", label: "Classic", description: "Take turns choosing Truth or Dare", icon: "Sparkles" },
  { id: "random", label: "Random", description: "The game chooses Truth or Dare for you", icon: "Shuffle" },
  { id: "spin_wheel", label: "Spin Wheel", description: "Spin to reveal your fate", icon: "Disc3" },
  { id: "survival", label: "Survival", description: "Fail or skip and you're out", icon: "Flame" },
  { id: "couples", label: "Couples", description: "Paired challenges for two", icon: "Heart" },
  { id: "team_battle", label: "Team Battle", description: "Compete in teams for glory", icon: "Swords" },
  { id: "last_standing", label: "Last Standing", description: "Last player remaining wins", icon: "Crown" },
];

export const AVATAR_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#f472b6",
  "#fb7185",
  "#fbbf24",
  "#34d399",
  "#60a5fa",
  "#c084fc",
  "#f87171",
  "#2dd4bf",
] as const;

export const DEFAULT_SKIP_TOKENS = 2;
export const DEFAULT_MAX_PLAYERS = 12;
export const DEFAULT_TIMER_SECONDS = 60;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_IDLE_TTL_MS = 1000 * 60 * 60; // 1 hour
export const RECONNECT_GRACE_MS = 1000 * 60 * 5; // 5 minutes

export interface PromptItem {
  id: string;
  type: ChallengeType;
  level: GameLevel;
  category: string;
  text: string;
  couples?: boolean;
  team?: boolean;
}

export interface PromptPack {
  id: string;
  name: string;
  version: string;
  description?: string;
  categories: string[];
  prompts: PromptItem[];
}

export interface Player {
  id: string;
  socketId: string | null;
  nickname: string;
  color: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  skipTokens: number;
  completedChallenges: number;
  score: number;
  team?: "A" | "B";
  eliminated?: boolean;
  partnerId?: string | null;
  joinedAt: number;
  lastSeenAt: number;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  nickname: string;
  color: string;
  text: string;
  timestamp: number;
  pinned?: boolean;
  type: "chat" | "system" | "reaction";
  reaction?: string;
}

export interface RoomSettings {
  maxPlayers: number;
  timerSeconds: number;
  skippingEnabled: boolean;
  playerOrder: PlayerOrder;
  enabledCategories: string[];
  enabledLevels: GameLevel[];
  gameMode: GameMode;
  voiceEnabled: boolean;
  chatEnabled: boolean;
  theme: "midnight" | "neon" | "ember" | "aurora";
}

export interface CurrentChallenge {
  promptId: string;
  type: ChallengeType;
  text: string;
  category: string;
  level: GameLevel;
  assignedAt: number;
  timerEndsAt: number | null;
}

export interface RoomPublic {
  code: string;
  phase: RoomPhase;
  hostId: string;
  settings: RoomSettings;
  players: Player[];
  turnOrder: string[];
  currentTurnIndex: number;
  currentPlayerId: string | null;
  currentChallenge: CurrentChallenge | null;
  level: GameLevel | null;
  chat: ChatMessage[];
  usedPromptIds: string[];
  round: number;
  createdAt: number;
  winnerId?: string | null;
}

export interface CreateRoomPayload {
  nickname: string;
  color?: string;
  maxPlayers?: number;
  gameMode?: GameMode;
}

export interface JoinRoomPayload {
  code: string;
  nickname: string;
  color?: string;
  reconnectToken?: string;
}

export interface ClientToServerEvents {
  "room:create": (payload: CreateRoomPayload, ack?: (res: AckResult<{ room: RoomPublic; playerId: string; reconnectToken: string }>) => void) => void;
  "room:join": (payload: JoinRoomPayload, ack?: (res: AckResult<{ room: RoomPublic; playerId: string; reconnectToken: string }>) => void) => void;
  "room:leave": () => void;
  "room:ready": (ready: boolean) => void;
  "room:start": () => void;
  "room:settings": (partial: Partial<RoomSettings>) => void;
  "room:kick": (playerId: string) => void;
  "room:transfer-host": (playerId: string) => void;
  "room:select-level": (level: GameLevel) => void;
  "room:import-prompts": (pack: PromptPack) => void;
  "room:return-lobby": () => void;
  "game:choose": (type: ChallengeType) => void;
  "game:spin": () => void;
  "game:action": (action: TurnAction) => void;
  "chat:send": (text: string) => void;
  "chat:pin": (messageId: string) => void;
  "chat:react": (emoji: string, targetPlayerId?: string) => void;
  "voice:signal": (payload: { to: string; data: unknown }) => void;
  "voice:join": () => void;
  "voice:leave": () => void;
}

export interface ServerToClientEvents {
  "room:state": (room: RoomPublic) => void;
  "room:error": (error: { code: string; message: string }) => void;
  "room:destroyed": (reason: string) => void;
  "chat:message": (message: ChatMessage) => void;
  "game:confetti": (payload: { playerId: string; nickname: string }) => void;
  "game:spin-result": (payload: { type: ChallengeType; angle: number }) => void;
  "player:reaction": (payload: { fromId: string; emoji: string; toId?: string }) => void;
  "voice:signal": (payload: { from: string; data: unknown }) => void;
  "voice:peers": (peerIds: string[]) => void;
  "prompts:pack": (pack: PromptPack) => void;
}

export type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function createDefaultSettings(overrides?: Partial<RoomSettings>): RoomSettings {
  return {
    maxPlayers: DEFAULT_MAX_PLAYERS,
    timerSeconds: DEFAULT_TIMER_SECONDS,
    skippingEnabled: true,
    playerOrder: "sequential",
    enabledCategories: [],
    enabledLevels: ["cool", "spicy", "extreme", "no_boundaries"],
    gameMode: "classic",
    voiceEnabled: false,
    chatEnabled: true,
    theme: "midnight",
    ...overrides,
  };
}
