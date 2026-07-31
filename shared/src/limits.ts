/** Shared operational limits — keep server and client aligned. */

export const LIMITS = {
  nicknameMax: 20,
  nicknameMin: 1,
  chatMax: 300,
  reactionMax: 16,
  maxPlayersMin: 2,
  maxPlayersMax: 20,
  timerMaxSeconds: 300,
  roomCodeLength: 6,
  maxRooms: 500,
  maxPromptImport: 2000,
  maxPromptText: 2000,
  maxCategoryName: 40,
  maxTagLength: 32,
  maxTagsPerPrompt: 20,
  maxPackBytes: 1_500_000,
  maxHttpJsonBytes: 1_500_000,
  maxSocketBufferBytes: 1_000_000,
  maxChatHistory: 150,
  maxUsedPromptIdsBroadcast: 200,
  maxNewPromptsPerTurn: 3,
  maxCategoryWeight: 10,
} as const;

/** Allowed reaction glyphs (extend carefully). */
export const ALLOWED_REACTIONS = ["🔥", "😂", "💀", "❤️", "👀", "👏", "😮", "🙈"] as const;

export type AllowedReaction = (typeof ALLOWED_REACTIONS)[number];
