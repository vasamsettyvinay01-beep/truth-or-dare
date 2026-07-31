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

export const GAME_MODES: { id: GameMode; label: string; description: string; icon: string; experimental?: boolean }[] = [
  { id: "classic", label: "Classic", description: "Take turns choosing Truth or Dare", icon: "Sparkles" },
  { id: "random", label: "Random", description: "The game chooses Truth or Dare for you", icon: "Shuffle" },
  { id: "spin_wheel", label: "Spin Wheel", description: "Spin to reveal your fate", icon: "Disc3" },
  {
    id: "survival",
    label: "Survival",
    description: "Experimental — skip or fail and you're out (elimination WIP)",
    icon: "Flame",
    experimental: true,
  },
  {
    id: "couples",
    label: "Couples",
    description: "Experimental — paired challenges (partner targeting WIP)",
    icon: "Heart",
    experimental: true,
  },
  {
    id: "team_battle",
    label: "Team Battle",
    description: "Experimental — team labels only (scoring WIP)",
    icon: "Swords",
    experimental: true,
  },
  {
    id: "last_standing",
    label: "Last Standing",
    description: "Experimental — last player remaining (elimination WIP)",
    icon: "Crown",
    experimental: true,
  },
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

/** Canonical difficulty — same values as GameLevel */
export type PromptDifficulty = GameLevel;

export const PROMPT_CATEGORIES = [
  "romance",
  "kissing",
  "crushes",
  "flirting",
  "dating",
  "relationships",
  "confessions",
  "embarrassing",
  "party",
  "first_impressions",
  "exes",
  "jealousy",
  "red_flags",
  "green_flags",
  "secrets",
] as const;

export type PromptCategoryId = (typeof PROMPT_CATEGORIES)[number] | string;

/**
 * Canonical prompt record for packs and the prompt engine.
 * Designed for large community packs and remote (video-call) play.
 */
export interface PromptRecord {
  id: string;
  type: ChallengeType;
  category: string;
  difficulty: PromptDifficulty;
  prompt: string;
  remoteFriendly: boolean;
  tags: string[];
  /** Relative pick weight (default 1). Higher = more likely when weighted. */
  weight?: number;
  couples?: boolean;
  team?: boolean;
}

/** @deprecated Use PromptRecord — kept for gradual migration */
export type PromptItem = PromptRecord & {
  /** @deprecated use difficulty */
  level?: GameLevel;
  /** @deprecated use prompt */
  text?: string;
};

export interface PromptPack {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  locale?: string;
  categories: string[];
  prompts: PromptRecord[];
}

export interface PromptPackSummary {
  id: string;
  name: string;
  version: string;
  description?: string;
  promptCount: number;
  categories: string[];
  tags: string[];
  difficulties: PromptDifficulty[];
  remoteFriendlyCount: number;
}

export interface PromptQuery {
  type?: ChallengeType;
  categories?: string[];
  difficulties?: PromptDifficulty[];
  tags?: string[];
  /** Case-insensitive match against prompt text, category, tags, id */
  search?: string;
  remoteOnly?: boolean;
  excludeIds?: string[];
  couples?: boolean | "any";
  team?: boolean | "any";
  limit?: number;
  offset?: number;
}

export interface PromptPickOptions {
  type: ChallengeType;
  difficulty: PromptDifficulty;
  enabledCategories: string[];
  usedIds: Iterable<string>;
  remoteOnly?: boolean;
  mode?: GameMode;
  /** Prefer category weights from room settings */
  categoryWeights?: Record<string, number>;
  difficultyWeight?: number;
  /** When pool exhausted, refuse repeats (default true for premium freshness) */
  strictNoRepeat?: boolean;
  weighted?: boolean;
}

export interface PromptPickResult {
  prompt: PromptRecord;
  poolSize: number;
  repeated: boolean;
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
  /** Prefer video-call / browser-safe dares */
  remoteOnly: boolean;
  /** Optional per-category pick weights (1 = default) */
  categoryWeights: Record<string, number>;
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
  tags: string[];
  remoteFriendly: boolean;
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
  "room:import-prompts": (pack: PromptPack | PromptRecord[] | { prompts: unknown[] }) => void;
  "room:return-lobby": () => void;
  "prompts:query": (
    query: PromptQuery,
    ack?: (res: AckResult<{ total: number; prompts: PromptRecord[]; summary: PromptPackSummary }>) => void
  ) => void;
  "prompts:export": (
    ack?: (res: AckResult<{ pack: PromptPack }>) => void
  ) => void;
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
  "prompts:summary": (summary: PromptPackSummary) => void;
}

export type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export function createDefaultSettings(overrides?: Partial<RoomSettings>): RoomSettings {
  const base: RoomSettings = {
    maxPlayers: DEFAULT_MAX_PLAYERS,
    timerSeconds: DEFAULT_TIMER_SECONDS,
    skippingEnabled: true,
    playerOrder: "sequential",
    enabledCategories: [],
    enabledLevels: ["cool", "spicy", "extreme", "no_boundaries"],
    remoteOnly: true,
    categoryWeights: {},
    gameMode: "classic",
    voiceEnabled: false,
    chatEnabled: true,
    theme: "midnight",
  };
  if (!overrides) return base;
  // Skip undefined so callers can pass `{ maxPlayers: undefined }` without wiping defaults.
  for (const key of Object.keys(overrides) as (keyof RoomSettings)[]) {
    const value = overrides[key];
    if (value !== undefined) {
      (base as unknown as Record<string, unknown>)[key as string] = value;
    }
  }
  return base;
}

/** Normalize legacy packs that used level/text into PromptRecord */
export function normalizePromptRecord(raw: Partial<PromptRecord> & {
  level?: string;
  text?: string;
  difficulty?: string;
  prompt?: string;
}, fallbackId: string): PromptRecord {
  const difficulty = normalizeDifficulty(raw.difficulty || raw.level || "cool");
  const prompt = String(raw.prompt ?? raw.text ?? "").trim();
  const category = slugCategory(String(raw.category || "party"));
  return {
    id: String(raw.id || fallbackId),
    type: raw.type === "dare" ? "dare" : "truth",
    category,
    difficulty,
    prompt,
    remoteFriendly: typeof raw.remoteFriendly === "boolean" ? raw.remoteFriendly : true,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    weight: typeof raw.weight === "number" && raw.weight > 0 ? raw.weight : 1,
    couples: raw.couples,
    team: raw.team,
  };
}

export function normalizeDifficulty(value: string): PromptDifficulty {
  const v = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (v === "cool" || v === "spicy" || v === "extreme" || v === "no_boundaries") return v;
  return "cool";
}

export function slugCategory(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export * from "./limits";
export * from "./validate";
