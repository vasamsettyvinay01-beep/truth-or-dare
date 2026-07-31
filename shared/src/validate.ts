import {
  AVATAR_COLORS,
  GAME_LEVELS,
  GAME_MODES,
  ROOM_CODE_LENGTH,
  type ChallengeType,
  type CreateRoomPayload,
  type GameLevel,
  type GameMode,
  type JoinRoomPayload,
  type PlayerOrder,
  type RoomSettings,
  type TurnAction,
} from "./index";
import { ALLOWED_REACTIONS, LIMITS as L } from "./limits";

function bad(message: string, code = "BAD_INPUT"): never {
  throw Object.assign(new Error(message), { code });
}

export function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== "string") bad("Nickname required");
  const nickname = raw.trim().slice(0, L.nicknameMax);
  if (nickname.length < L.nicknameMin) bad("Nickname required");
  return nickname;
}

export function sanitizeRoomCode(raw: unknown): string {
  if (typeof raw !== "string") bad("Invalid room code", "INVALID_CODE");
  const code = raw.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, ROOM_CODE_LENGTH);
  if (code.length !== ROOM_CODE_LENGTH) bad("Room codes are 6 characters", "INVALID_CODE");
  return code;
}

export function sanitizeAvatarColor(raw: unknown, fallback?: string): string {
  if (typeof raw === "string" && (AVATAR_COLORS as readonly string[]).includes(raw)) {
    return raw;
  }
  if (fallback && (AVATAR_COLORS as readonly string[]).includes(fallback)) return fallback;
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function sanitizeGameMode(raw: unknown): GameMode | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") bad("Invalid game mode");
  if (!GAME_MODES.some((m) => m.id === raw)) bad("Invalid game mode");
  return raw as GameMode;
}

export function sanitizeMaxPlayers(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) bad("Invalid max players");
  return Math.min(L.maxPlayersMax, Math.max(L.maxPlayersMin, Math.floor(n)));
}

export function sanitizeCreatePayload(payload: unknown): CreateRoomPayload {
  if (!payload || typeof payload !== "object") bad("Invalid payload");
  const p = payload as Record<string, unknown>;
  return {
    nickname: sanitizeNickname(p.nickname),
    color: sanitizeAvatarColor(p.color),
    maxPlayers: sanitizeMaxPlayers(p.maxPlayers),
    gameMode: sanitizeGameMode(p.gameMode),
  };
}

export function sanitizeJoinPayload(payload: unknown): JoinRoomPayload {
  if (!payload || typeof payload !== "object") bad("Invalid payload");
  const p = payload as Record<string, unknown>;
  return {
    code: sanitizeRoomCode(p.code),
    nickname: sanitizeNickname(p.nickname),
    color: sanitizeAvatarColor(p.color),
    reconnectToken:
      typeof p.reconnectToken === "string" && p.reconnectToken.length > 0 && p.reconnectToken.length <= 80
        ? p.reconnectToken
        : undefined,
  };
}

const LEVEL_IDS = new Set(GAME_LEVELS.map((l) => l.id));
const MODE_IDS = new Set(GAME_MODES.map((m) => m.id));
const ORDERS = new Set<PlayerOrder>(["sequential", "random"]);
const THEMES = new Set(["midnight", "neon", "ember", "aurora"]);

export function sanitizeSettingsPartial(partial: unknown): Partial<RoomSettings> {
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) bad("Invalid settings");
  const src = partial as Record<string, unknown>;
  const out: Partial<RoomSettings> = {};

  if ("maxPlayers" in src) {
    const n = sanitizeMaxPlayers(src.maxPlayers);
    if (n !== undefined) out.maxPlayers = n;
  }
  if ("timerSeconds" in src) {
    const n = typeof src.timerSeconds === "number" ? src.timerSeconds : Number(src.timerSeconds);
    if (!Number.isFinite(n)) bad("Invalid timer");
    out.timerSeconds = Math.min(L.timerMaxSeconds, Math.max(0, Math.floor(n)));
  }
  if ("skippingEnabled" in src) out.skippingEnabled = Boolean(src.skippingEnabled);
  if ("remoteOnly" in src) out.remoteOnly = Boolean(src.remoteOnly);
  if ("voiceEnabled" in src) out.voiceEnabled = Boolean(src.voiceEnabled);
  if ("chatEnabled" in src) out.chatEnabled = Boolean(src.chatEnabled);
  if ("playerOrder" in src) {
    if (typeof src.playerOrder !== "string" || !ORDERS.has(src.playerOrder as PlayerOrder)) {
      bad("Invalid player order");
    }
    out.playerOrder = src.playerOrder as PlayerOrder;
  }
  if ("gameMode" in src) {
    const mode = sanitizeGameMode(src.gameMode);
    if (mode) out.gameMode = mode;
  }
  if ("theme" in src) {
    if (typeof src.theme !== "string" || !THEMES.has(src.theme)) bad("Invalid theme");
    out.theme = src.theme as RoomSettings["theme"];
  }
  if ("enabledLevels" in src) {
    if (!Array.isArray(src.enabledLevels)) bad("Invalid levels");
    const levels = src.enabledLevels.filter((x): x is GameLevel => typeof x === "string" && LEVEL_IDS.has(x as GameLevel));
    if (!levels.length) bad("At least one level required");
    out.enabledLevels = levels;
  }
  if ("enabledCategories" in src) {
    if (!Array.isArray(src.enabledCategories)) bad("Invalid categories");
    out.enabledCategories = src.enabledCategories
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().slice(0, L.maxCategoryName))
      .filter(Boolean)
      .slice(0, 80);
  }
  if ("categoryWeights" in src) {
    if (!src.categoryWeights || typeof src.categoryWeights !== "object" || Array.isArray(src.categoryWeights)) {
      bad("Invalid category weights");
    }
    const weights: Record<string, number> = {};
    for (const [k, v] of Object.entries(src.categoryWeights as Record<string, unknown>)) {
      const key = String(k).trim().slice(0, L.maxCategoryName);
      const n = typeof v === "number" ? v : Number(v);
      if (!key || !Number.isFinite(n)) continue;
      weights[key] = Math.min(L.maxCategoryWeight, Math.max(0, n));
    }
    out.categoryWeights = weights;
  }

  return out;
}

export function sanitizeChallengeType(raw: unknown): ChallengeType {
  if (raw === "truth" || raw === "dare") return raw;
  bad("Invalid challenge type");
}

export function sanitizeTurnAction(raw: unknown): TurnAction {
  if (raw === "complete" || raw === "skip" || raw === "new_prompt") return raw;
  bad("Invalid action");
}

export function sanitizeGameLevel(raw: unknown): GameLevel {
  if (typeof raw === "string" && LEVEL_IDS.has(raw as GameLevel)) return raw as GameLevel;
  bad("Invalid level");
}

export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== "string") bad("Empty message", "EMPTY");
  const cleaned = raw.trim().slice(0, L.chatMax);
  if (!cleaned) bad("Empty message", "EMPTY");
  return cleaned;
}

export function sanitizeReaction(raw: unknown): string {
  if (typeof raw !== "string") bad("Invalid reaction");
  const emoji = raw.trim().slice(0, L.reactionMax);
  if (!(ALLOWED_REACTIONS as readonly string[]).includes(emoji)) {
    bad("Reaction not allowed");
  }
  return emoji;
}

export function sanitizePlayerId(raw: unknown): string {
  if (typeof raw !== "string" || !/^[0-9a-f-]{36}$/i.test(raw)) bad("Invalid player id");
  return raw;
}

export function sanitizeMessageId(raw: unknown): string {
  if (typeof raw !== "string" || raw.length < 8 || raw.length > 80) bad("Invalid message id");
  return raw;
}

/** Only apply defined override keys so `undefined` cannot wipe defaults. */
export function mergeDefined<T extends object>(base: T, overrides?: Partial<T>): T {
  if (!overrides) return { ...base };
  const next = { ...base };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const value = overrides[key];
    if (value !== undefined) next[key] = value as T[keyof T];
  }
  return next;
}

export function assertKnownMode(mode: string): mode is GameMode {
  return MODE_IDS.has(mode as GameMode);
}
