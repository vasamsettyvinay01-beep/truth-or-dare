import { customAlphabet } from "nanoid";
import { v4 as uuid } from "uuid";
import {
  AVATAR_COLORS,
  DEFAULT_MAX_PLAYERS,
  DEFAULT_SKIP_TOKENS,
  LIMITS,
  ROOM_CODE_LENGTH,
  ROOM_IDLE_TTL_MS,
  RECONNECT_GRACE_MS,
  createDefaultSettings,
  sanitizeSettingsPartial,
  type ChallengeType,
  type ChatMessage,
  type CurrentChallenge,
  type GameLevel,
  type Player,
  type RoomPhase,
  type RoomPublic,
  type RoomSettings,
  type TurnAction,
} from "@tod/shared";
import { promptEngine } from "../prompts/engine";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", ROOM_CODE_LENGTH);

/** Long enough to survive a phone locking or a tab refresh in the lobby. */
const LOBBY_RECONNECT_GRACE_MS = 1000 * 90;
/** How long a room with nobody connected is kept alive for reconnects. */
const EMPTY_ROOM_TTL_MS = 1000 * 60 * 10;
/** A kicked player is locked out for long enough that they give up re-joining. */
const KICK_BAN_MS = 1000 * 60 * 5;

interface RoomInternal {
  code: string;
  phase: RoomPhase;
  hostId: string;
  settings: RoomSettings;
  players: Map<string, Player>;
  turnOrder: string[];
  currentTurnIndex: number;
  currentChallenge: CurrentChallenge | null;
  level: GameLevel | null;
  chat: ChatMessage[];
  usedPromptIds: Set<string>;
  round: number;
  createdAt: number;
  lastActivityAt: number;
  reconnectTokens: Map<string, string>; // token -> playerId
  voicePeers: Set<string>;
  winnerId: string | null;
  pendingSpin: ChallengeType | null;
  /** Re-rolls used by the player whose turn it currently is. */
  newPromptsThisTurn: number;
}

export interface RemovalResult {
  roomCode: string;
  room: RoomPublic | null;
  destroyed: boolean;
  kickedSocketId: string | null;
}

export type RoomHookEvent = { type: string; code: string; room?: RoomPublic | null };

/** Socket ids are server-side routing handles and must never reach other clients. */
function publicPlayer(p: Player): Player {
  return { ...p, socketId: null };
}

export class RoomManager {
  private rooms = new Map<string, RoomInternal>();
  private socketToRoom = new Map<string, string>();
  /** roomCode -> (playerId or socketId) -> ban expiry */
  private bans = new Map<string, Map<string, number>>();
  private ioHook: ((event: RoomHookEvent) => void) | null = null;
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.sweep(), 30_000);
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }

  setIoHook(fn: ((event: RoomHookEvent) => void) | null) {
    this.ioHook = fn;
  }

  roomCount(): number {
    return this.rooms.size;
  }

  /** Server-only lookup so socket ids stay out of broadcast payloads. */
  socketIdForPlayer(code: string, playerId: string): string | null {
    return this.getRoom(code)?.players.get(playerId)?.socketId ?? null;
  }

  private now() {
    return Date.now();
  }

  private touch(room: RoomInternal) {
    room.lastActivityAt = this.now();
  }

  private getRoom(code: string): RoomInternal | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  /** `key` is a playerId or a socket id — both identify a kicked participant. */
  private ban(code: string, key: string) {
    let list = this.bans.get(code);
    if (!list) {
      list = new Map();
      this.bans.set(code, list);
    }
    list.set(key, this.now() + KICK_BAN_MS);
  }

  private isBanned(code: string, key: string): boolean {
    const list = this.bans.get(code);
    if (!list) return false;
    const until = list.get(key);
    if (!until) return false;
    if (until <= this.now()) {
      list.delete(key);
      return false;
    }
    return true;
  }

  private ensureCategories(room: RoomInternal) {
    if (!room.settings.enabledCategories.length) {
      room.settings.enabledCategories = promptEngine.getCategories();
    }
  }

  toPublic(room: RoomInternal): RoomPublic {
    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      settings: { ...room.settings },
      players: [...room.players.values()].map(publicPlayer),
      turnOrder: [...room.turnOrder],
      currentTurnIndex: room.currentTurnIndex,
      currentPlayerId: room.turnOrder[room.currentTurnIndex] ?? null,
      currentChallenge: room.currentChallenge ? { ...room.currentChallenge } : null,
      level: room.level,
      chat: room.chat.slice(-LIMITS.maxChatHistory),
      usedPromptIds: [...room.usedPromptIds].slice(-LIMITS.maxUsedPromptIdsBroadcast),
      round: room.round,
      createdAt: room.createdAt,
      winnerId: room.winnerId,
    };
  }

  createRoom(opts: {
    socketId: string;
    nickname: string;
    color?: string;
    maxPlayers?: number;
    gameMode?: RoomSettings["gameMode"];
  }): { room: RoomPublic; playerId: string; reconnectToken: string } {
    let code = makeCode();
    while (this.rooms.has(code)) code = makeCode();

    const playerId = uuid();
    const color =
      opts.color && AVATAR_COLORS.includes(opts.color as (typeof AVATAR_COLORS)[number])
        ? opts.color
        : AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const player: Player = {
      id: playerId,
      socketId: opts.socketId,
      nickname: opts.nickname.trim().slice(0, LIMITS.nicknameMax),
      color,
      isHost: true,
      isReady: false,
      isConnected: true,
      skipTokens: DEFAULT_SKIP_TOKENS,
      completedChallenges: 0,
      score: 0,
      joinedAt: this.now(),
      lastSeenAt: this.now(),
    };

    const room: RoomInternal = {
      code,
      phase: "lobby",
      hostId: playerId,
      settings: createDefaultSettings({
        maxPlayers: opts.maxPlayers,
        gameMode: opts.gameMode,
        enabledCategories: promptEngine.getCategories(),
      }),
      players: new Map([[playerId, player]]),
      turnOrder: [],
      currentTurnIndex: 0,
      currentChallenge: null,
      level: null,
      chat: [],
      usedPromptIds: new Set(),
      round: 0,
      createdAt: this.now(),
      lastActivityAt: this.now(),
      reconnectTokens: new Map(),
      voicePeers: new Set(),
      winnerId: null,
      pendingSpin: null,
      newPromptsThisTurn: 0,
    };

    if (!Number.isFinite(room.settings.maxPlayers)) room.settings.maxPlayers = DEFAULT_MAX_PLAYERS;

    const reconnectToken = uuid();
    room.reconnectTokens.set(reconnectToken, playerId);
    this.rooms.set(code, room);
    this.socketToRoom.set(opts.socketId, code);

    this.pushSystem(room, `${player.nickname} created the room`);
    return { room: this.toPublic(room), playerId, reconnectToken };
  }

  joinRoom(opts: {
    code: string;
    socketId: string;
    nickname: string;
    color?: string;
    reconnectToken?: string;
  }): { room: RoomPublic; playerId: string; reconnectToken: string } {
    const room = this.getRoom(opts.code);
    if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" });
    this.touch(room);

    if (opts.reconnectToken) {
      const existingId = room.reconnectTokens.get(opts.reconnectToken);
      if (existingId) {
        if (this.isBanned(room.code, existingId)) {
          throw Object.assign(new Error("You were removed from this room"), { code: "KICKED" });
        }
        const existing = room.players.get(existingId);
        if (existing) {
          const wasConnected = existing.isConnected;
          if (existing.socketId && existing.socketId !== opts.socketId) {
            this.socketToRoom.delete(existing.socketId);
          }
          existing.socketId = opts.socketId;
          existing.isConnected = true;
          existing.lastSeenAt = this.now();
          this.socketToRoom.set(opts.socketId, room.code);
          // Reconnecting from a second tab shouldn't spam the room log.
          if (!wasConnected) this.pushSystem(room, `${existing.nickname} reconnected`);
          return { room: this.toPublic(room), playerId: existingId, reconnectToken: opts.reconnectToken };
        }
      }
    }

    if (this.isBanned(room.code, opts.socketId)) {
      throw Object.assign(new Error("You were removed from this room"), { code: "KICKED" });
    }
    if (room.phase !== "lobby" && room.phase !== "level_select") {
      throw Object.assign(new Error("Game already in progress"), { code: "GAME_IN_PROGRESS" });
    }
    const cap = Number.isFinite(room.settings.maxPlayers)
      ? room.settings.maxPlayers
      : DEFAULT_MAX_PLAYERS;
    if (room.players.size >= cap) {
      throw Object.assign(new Error("Room is full"), { code: "ROOM_FULL" });
    }

    const desiredNickname = opts.nickname.trim().slice(0, LIMITS.nicknameMax) || "Player";
    const nicknameTaken = [...room.players.values()].some(
      (p) => p.nickname.toLowerCase() === desiredNickname.toLowerCase()
    );
    if (nicknameTaken) {
      throw Object.assign(new Error("That nickname is already taken in this room"), {
        code: "NICKNAME_TAKEN",
      });
    }

    const playerId = uuid();
    const usedColors = new Set([...room.players.values()].map((p) => p.color));
    const available = AVATAR_COLORS.filter((c) => !usedColors.has(c));
    const color =
      opts.color &&
      (AVATAR_COLORS as readonly string[]).includes(opts.color) &&
      !usedColors.has(opts.color)
        ? opts.color
        : available[0] || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const player: Player = {
      id: playerId,
      socketId: opts.socketId,
      nickname: desiredNickname,
      color,
      isHost: false,
      isReady: false,
      isConnected: true,
      skipTokens: DEFAULT_SKIP_TOKENS,
      completedChallenges: 0,
      score: 0,
      joinedAt: this.now(),
      lastSeenAt: this.now(),
    };

    room.players.set(playerId, player);
    const reconnectToken = uuid();
    room.reconnectTokens.set(reconnectToken, playerId);
    this.socketToRoom.set(opts.socketId, room.code);
    this.pushSystem(room, `${player.nickname} joined`);

    return { room: this.toPublic(room), playerId, reconnectToken };
  }

  /**
   * A transport-level drop. Mobile browsers disconnect constantly (screen lock,
   * app switch, network handover), so the seat and the reconnect token are held
   * until the sweeper decides the player is really gone.
   */
  disconnectBySocket(
    socketId: string
  ): { roomCode: string; room: RoomPublic | null; destroyed: boolean } | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    const room = this.getRoom(code);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    const player = [...room.players.values()].find((p) => p.socketId === socketId);
    this.socketToRoom.delete(socketId);
    if (!player) {
      return { roomCode: code, room: this.toPublic(room), destroyed: false };
    }

    player.isConnected = false;
    player.socketId = null;
    player.lastSeenAt = this.now();
    room.voicePeers.delete(player.id);
    this.pushSystem(room, `${player.nickname} disconnected`);

    return { roomCode: code, room: this.toPublic(room), destroyed: false };
  }

  /** An explicit "Leave" tap. The seat is released straight away. */
  leaveBySocket(socketId: string): { roomCode: string; room: RoomPublic | null; destroyed: boolean } | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    const room = this.getRoom(code);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    const player = [...room.players.values()].find((p) => p.socketId === socketId);
    this.socketToRoom.delete(socketId);
    if (!player) {
      return { roomCode: code, room: this.toPublic(room), destroyed: false };
    }

    room.voicePeers.delete(player.id);
    return this.removePlayer(room, player.id);
  }

  private removePlayer(room: RoomInternal, playerId: string): RemovalResult {
    const player = room.players.get(playerId);
    if (!player) {
      return { roomCode: room.code, room: this.toPublic(room), destroyed: false, kickedSocketId: null };
    }

    const kickedSocketId = player.socketId;
    if (player.socketId) this.socketToRoom.delete(player.socketId);
    for (const [token, id] of room.reconnectTokens) {
      if (id === playerId) room.reconnectTokens.delete(token);
    }
    room.players.delete(playerId);
    room.voicePeers.delete(playerId);
    room.turnOrder = room.turnOrder.filter((id) => id !== playerId);
    if (room.currentTurnIndex >= room.turnOrder.length) room.currentTurnIndex = 0;

    this.pushSystem(room, `${player.nickname} left`);

    if (room.players.size === 0) {
      this.destroyRoom(room.code, "empty");
      return { roomCode: room.code, room: null, destroyed: true, kickedSocketId };
    }

    if (room.hostId === playerId) {
      const nextHost = [...room.players.values()].find((p) => p.isConnected) || [...room.players.values()][0];
      room.hostId = nextHost.id;
      nextHost.isHost = true;
      this.pushSystem(room, `${nextHost.nickname} is now the host`);
    }

    // Check win conditions after removal
    this.checkSurvivalWin(room);

    return { roomCode: room.code, room: this.toPublic(room), destroyed: false, kickedSocketId };
  }

  kick(hostSocketId: string, targetId: string): RemovalResult {
    const room = this.roomForSocket(hostSocketId);
    const host = this.playerForSocket(hostSocketId, room);
    if (host.id !== room.hostId) throw Object.assign(new Error("Only host can kick"), { code: "NOT_HOST" });
    if (targetId === host.id) throw Object.assign(new Error("Cannot kick yourself"), { code: "INVALID" });
    const code = room.code;
    const result = this.removePlayer(room, targetId);
    // Ban both handles: the id blocks token reconnects, the socket blocks an
    // instant re-join from the same tab.
    this.ban(code, targetId);
    if (result.kickedSocketId) this.ban(code, result.kickedSocketId);
    return result;
  }

  transferHost(hostSocketId: string, targetId: string) {
    const room = this.roomForSocket(hostSocketId);
    const host = this.playerForSocket(hostSocketId, room);
    if (host.id !== room.hostId) throw Object.assign(new Error("Only host can transfer"), { code: "NOT_HOST" });
    const target = room.players.get(targetId);
    if (!target) throw Object.assign(new Error("Player not found"), { code: "NOT_FOUND" });
    if (!target.isConnected) {
      throw Object.assign(new Error("That player is disconnected"), { code: "PLAYER_OFFLINE" });
    }
    host.isHost = false;
    target.isHost = true;
    room.hostId = targetId;
    this.pushSystem(room, `${target.nickname} is now the host`);
    return this.toPublic(room);
  }

  setReady(socketId: string, ready: boolean) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (room.phase !== "lobby") throw Object.assign(new Error("Not in lobby"), { code: "BAD_PHASE" });
    player.isReady = ready;
    this.touch(room);
    return this.toPublic(room);
  }

  updateSettings(socketId: string, partial: Partial<RoomSettings>) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host can change settings"), { code: "NOT_HOST" });
    if (room.phase !== "lobby") throw Object.assign(new Error("Settings locked during game"), { code: "BAD_PHASE" });

    // Never spread caller input: only known keys are copied, each clamped.
    const clean = sanitizeSettingsPartial(partial ?? {});
    const next: RoomSettings = { ...room.settings };

    if (clean.maxPlayers !== undefined && Number.isFinite(clean.maxPlayers)) {
      next.maxPlayers = Math.min(
        LIMITS.maxPlayersMax,
        Math.max(LIMITS.maxPlayersMin, Math.floor(clean.maxPlayers))
      );
    }
    if (clean.timerSeconds !== undefined && Number.isFinite(clean.timerSeconds)) {
      next.timerSeconds = Math.min(LIMITS.timerMaxSeconds, Math.max(0, Math.floor(clean.timerSeconds)));
    }
    if (clean.skippingEnabled !== undefined) next.skippingEnabled = Boolean(clean.skippingEnabled);
    if (clean.remoteOnly !== undefined) next.remoteOnly = Boolean(clean.remoteOnly);
    if (clean.voiceEnabled !== undefined) next.voiceEnabled = Boolean(clean.voiceEnabled);
    if (clean.chatEnabled !== undefined) next.chatEnabled = Boolean(clean.chatEnabled);
    if (clean.playerOrder !== undefined) next.playerOrder = clean.playerOrder;
    if (clean.gameMode !== undefined) next.gameMode = clean.gameMode;
    if (clean.theme !== undefined) next.theme = clean.theme;
    if (clean.enabledLevels !== undefined) next.enabledLevels = [...clean.enabledLevels];
    if (clean.enabledCategories !== undefined) next.enabledCategories = [...clean.enabledCategories];
    if (clean.categoryWeights !== undefined) {
      next.categoryWeights = { ...(room.settings.categoryWeights || {}), ...clean.categoryWeights };
    }
    next.remoteOnly = next.remoteOnly ?? true;
    next.categoryWeights = next.categoryWeights || {};

    room.settings = next;
    this.ensureCategories(room);
    this.touch(room);
    return this.toPublic(room);
  }

  startGame(socketId: string) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host can start"), { code: "NOT_HOST" });
    if (room.phase !== "lobby") throw Object.assign(new Error("Already started"), { code: "BAD_PHASE" });

    const connected = [...room.players.values()].filter((p) => p.isConnected);
    if (connected.length < 2) {
      throw Object.assign(new Error("Need at least 2 players"), { code: "NOT_ENOUGH_PLAYERS" });
    }
    const notReady = connected.filter((p) => !p.isReady && p.id !== room.hostId);
    if (notReady.length) {
      throw Object.assign(new Error("All players must be ready"), { code: "NOT_READY" });
    }

    // Host auto-ready
    player.isReady = true;

    // Team assignment
    if (room.settings.gameMode === "team_battle") {
      connected.forEach((p, i) => {
        p.team = i % 2 === 0 ? "A" : "B";
      });
    }

    // Couples pairing (simple sequential pairs)
    if (room.settings.gameMode === "couples") {
      for (let i = 0; i < connected.length; i += 2) {
        const a = connected[i];
        const b = connected[i + 1];
        if (a && b) {
          a.partnerId = b.id;
          b.partnerId = a.id;
        }
      }
    }

    room.phase = "level_select";
    room.round = 1;
    room.winnerId = null;
    room.usedPromptIds.clear();
    connected.forEach((p) => {
      p.eliminated = false;
      p.skipTokens = DEFAULT_SKIP_TOKENS;
      p.completedChallenges = 0;
      p.score = 0;
    });
    this.pushSystem(room, "Game starting — host is choosing the level");
    this.touch(room);
    return this.toPublic(room);
  }

  selectLevel(socketId: string, level: GameLevel) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host"), { code: "NOT_HOST" });
    if (room.phase !== "level_select") throw Object.assign(new Error("Wrong phase"), { code: "BAD_PHASE" });
    if (!room.settings.enabledLevels.includes(level)) {
      throw Object.assign(new Error("Level disabled"), { code: "LEVEL_DISABLED" });
    }

    room.level = level;
    const active = [...room.players.values()].filter((p) => p.isConnected && !p.eliminated);
    let order = active.map((p) => p.id);
    if (room.settings.playerOrder === "random") {
      order = shuffle(order);
    }
    room.turnOrder = order;
    room.currentTurnIndex = 0;
    room.currentChallenge = null;
    room.phase = room.settings.gameMode === "spin_wheel" ? "spinning" : "playing";
    this.pushSystem(room, `Level set to ${level.replace("_", " ")}. Let's go!`);
    this.touch(room);
    return this.toPublic(room);
  }

  chooseType(socketId: string, type: ChallengeType) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    this.assertCurrentPlayer(room, player);
    if (room.phase !== "playing") throw Object.assign(new Error("Wrong phase"), { code: "BAD_PHASE" });
    if (room.settings.gameMode === "random" || room.settings.gameMode === "spin_wheel") {
      throw Object.assign(new Error("Type is chosen by the game"), { code: "MODE_LOCK" });
    }
    this.assignPrompt(room, type);
    room.phase = "revealing";
    this.touch(room);
    return this.toPublic(room);
  }

  spin(socketId: string): { room: RoomPublic; type: ChallengeType; angle: number } {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    this.assertCurrentPlayer(room, player);
    if (room.phase !== "spinning") {
      throw Object.assign(new Error("Not spinning"), { code: "BAD_PHASE" });
    }
    const type: ChallengeType = Math.random() < 0.5 ? "truth" : "dare";
    const angle = 1800 + Math.random() * 720 + (type === "truth" ? 0 : 45);
    room.pendingSpin = type;
    this.assignPrompt(room, type);
    room.phase = "revealing";
    this.touch(room);
    return { room: this.toPublic(room), type, angle };
  }

  /** For random mode — auto pick when turn starts */
  ensureRandomPrompt(roomCode: string): RoomPublic | null {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== "playing") return null;
    if (room.settings.gameMode !== "random") return null;
    if (room.currentChallenge) return null;
    const type: ChallengeType = Math.random() < 0.5 ? "truth" : "dare";
    this.assignPrompt(room, type);
    room.phase = "revealing";
    return this.toPublic(room);
  }

  turnAction(socketId: string, action: TurnAction): { room: RoomPublic; confetti?: { playerId: string; nickname: string } } {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    this.assertCurrentPlayer(room, player);
    if (room.phase !== "revealing" || !room.currentChallenge) {
      throw Object.assign(new Error("No active challenge"), { code: "NO_CHALLENGE" });
    }

    let confetti: { playerId: string; nickname: string } | undefined;

    if (action === "new_prompt") {
      if (room.newPromptsThisTurn >= LIMITS.maxNewPromptsPerTurn) {
        throw Object.assign(new Error("No more re-rolls this turn"), { code: "REROLL_LIMIT" });
      }
      room.newPromptsThisTurn += 1;
      this.assignPrompt(room, room.currentChallenge.type, true);
      this.touch(room);
      return { room: this.toPublic(room) };
    }

    if (action === "skip") {
      if (!room.settings.skippingEnabled) {
        throw Object.assign(new Error("Skipping disabled"), { code: "SKIP_DISABLED" });
      }
      if (player.skipTokens <= 0) {
        throw Object.assign(new Error("No skip tokens left"), { code: "NO_SKIPS" });
      }
      player.skipTokens -= 1;
      this.pushSystem(room, `${player.nickname} skipped`);

      // Backing out is how you go out in the elimination modes.
      if (room.settings.gameMode === "survival" || room.settings.gameMode === "last_standing") {
        player.eliminated = true;
        this.pushSystem(room, `${player.nickname} is out`);
        if (this.checkSurvivalWin(room)) {
          room.currentChallenge = null;
          room.pendingSpin = null;
          this.touch(room);
          return { room: this.toPublic(room) };
        }
      }
    }

    if (action === "complete") {
      player.completedChallenges += 1;
      player.score += room.currentChallenge.type === "dare" ? 15 : 10;
      confetti = { playerId: player.id, nickname: player.nickname };
      this.pushSystem(room, `${player.nickname} completed a ${room.currentChallenge.type}`);
    }

    this.advanceTurn(room);
    this.touch(room);
    return { room: this.toPublic(room), confetti };
  }

  private advanceTurn(room: RoomInternal) {
    room.currentChallenge = null;
    room.pendingSpin = null;
    room.newPromptsThisTurn = 0;

    const activeIds = room.turnOrder.filter((id) => {
      const p = room.players.get(id);
      return p && p.isConnected && !p.eliminated;
    });

    if (activeIds.length <= 1 && (room.settings.gameMode === "survival" || room.settings.gameMode === "last_standing")) {
      const winner = activeIds[0] ? room.players.get(activeIds[0]) : null;
      room.winnerId = winner?.id ?? null;
      room.phase = "ended";
      if (winner) this.pushSystem(room, `${winner.nickname} wins!`);
      return;
    }

    if (!activeIds.length) {
      room.phase = "ended";
      return;
    }

    // Move to next active player
    let next = (room.currentTurnIndex + 1) % room.turnOrder.length;
    let guard = 0;
    while (guard < room.turnOrder.length) {
      const id = room.turnOrder[next];
      const p = room.players.get(id);
      if (p && p.isConnected && !p.eliminated) break;
      next = (next + 1) % room.turnOrder.length;
      guard++;
    }
    room.currentTurnIndex = next;
    if (next === 0) room.round += 1;

    if (room.settings.playerOrder === "random" && next === 0) {
      room.turnOrder = shuffle(activeIds);
      room.currentTurnIndex = 0;
    }

    room.phase = room.settings.gameMode === "spin_wheel" ? "spinning" : "playing";
  }

  /** Returns true when this check ended the game. */
  private checkSurvivalWin(room: RoomInternal): boolean {
    if (room.phase === "lobby" || room.phase === "level_select" || room.phase === "ended") return false;
    if (room.settings.gameMode !== "survival" && room.settings.gameMode !== "last_standing") return false;
    const alive = [...room.players.values()].filter((p) => p.isConnected && !p.eliminated);
    if (alive.length === 1) {
      room.winnerId = alive[0].id;
      room.phase = "ended";
      this.pushSystem(room, `${alive[0].nickname} is the last one standing!`);
      return true;
    }
    return false;
  }

  private assignPrompt(room: RoomInternal, type: ChallengeType, replace = false) {
    if (!room.level) throw Object.assign(new Error("No level"), { code: "NO_LEVEL" });
    if (!replace) room.newPromptsThisTurn = 0;
    const picked = promptEngine.pickPrompt({
      roomId: room.code,
      type,
      level: room.level,
      mode: room.settings.gameMode,
      enabledCategories: room.settings.enabledCategories,
      usedIds: room.usedPromptIds,
      remoteOnly: room.settings.remoteOnly,
      categoryWeights: room.settings.categoryWeights,
      strictNoRepeat: true,
    });
    if (!picked) {
      throw Object.assign(
        new Error("No unused prompts left — enable more categories or change difficulty"),
        { code: "NO_PROMPTS" }
      );
    }
    const prompt = picked.prompt;
    room.usedPromptIds.add(prompt.id);

    const timer =
      room.settings.timerSeconds > 0 ? this.now() + room.settings.timerSeconds * 1000 : null;

    room.currentChallenge = {
      promptId: prompt.id,
      type: prompt.type,
      text: prompt.prompt,
      category: prompt.category,
      level: prompt.difficulty,
      tags: prompt.tags,
      remoteFriendly: prompt.remoteFriendly,
      assignedAt: this.now(),
      timerEndsAt: timer,
    };
  }

  sendChat(socketId: string, text: string): ChatMessage {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (!room.settings.chatEnabled) throw Object.assign(new Error("Chat disabled"), { code: "CHAT_OFF" });
    const cleaned = String(text ?? "").trim().slice(0, LIMITS.chatMax);
    if (!cleaned) throw Object.assign(new Error("Empty message"), { code: "EMPTY" });
    const message: ChatMessage = {
      id: uuid(),
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
      text: cleaned,
      timestamp: this.now(),
      type: "chat",
    };
    room.chat.push(message);
    this.trimChat(room);
    this.touch(room);
    return message;
  }

  private trimChat(room: RoomInternal) {
    if (room.chat.length > LIMITS.maxChatHistory) {
      room.chat = room.chat.slice(-LIMITS.maxChatHistory);
    }
  }

  pinMessage(socketId: string, messageId: string) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host can pin"), { code: "NOT_HOST" });
    room.chat = room.chat.map((m) => ({
      ...m,
      pinned: m.id === messageId ? !m.pinned : m.pinned,
    }));
    this.touch(room);
    return this.toPublic(room);
  }

  react(socketId: string, emoji: string, targetPlayerId?: string) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (!room.settings.chatEnabled) throw Object.assign(new Error("Chat disabled"), { code: "CHAT_OFF" });
    const cleaned = String(emoji ?? "").trim().slice(0, LIMITS.reactionMax);
    if (!cleaned) throw Object.assign(new Error("Invalid reaction"), { code: "EMPTY" });
    const toId =
      typeof targetPlayerId === "string" && room.players.has(targetPlayerId) ? targetPlayerId : undefined;

    const message: ChatMessage = {
      id: uuid(),
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
      text: cleaned,
      timestamp: this.now(),
      type: "reaction",
      reaction: cleaned,
    };
    room.chat.push(message);
    this.trimChat(room);
    this.touch(room);
    return { message, fromId: player.id, emoji: cleaned, toId };
  }

  importPrompts(socketId: string, pack: unknown) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host"), { code: "NOT_HOST" });
    // Size is checked before importing: the merged pack also contains the base
    // catalog, and a rejected import must not disturb the room's existing pack.
    const incoming = (pack as { prompts?: unknown })?.prompts;
    if (Array.isArray(incoming) && incoming.length > LIMITS.maxPromptImport) {
      throw Object.assign(
        new Error(`Prompt pack too large (max ${LIMITS.maxPromptImport})`),
        { code: "PACK_TOO_LARGE" }
      );
    }

    const merged = promptEngine.importPack(pack, room.code);
    room.settings.enabledCategories = [
      ...new Set([...room.settings.enabledCategories, ...merged.categories]),
    ];
    this.pushSystem(room, `Prompt pack imported (${merged.prompts.length} prompts in catalog)`);
    this.touch(room);
    return { room: this.toPublic(room), pack: merged };
  }

  voiceJoin(socketId: string) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (!room.settings.voiceEnabled) throw Object.assign(new Error("Voice disabled"), { code: "VOICE_OFF" });
    room.voicePeers.add(player.id);
    this.touch(room);
    return { room: this.toPublic(room), peers: [...room.voicePeers] };
  }

  voiceLeave(socketId: string) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    room.voicePeers.delete(player.id);
    return { room: this.toPublic(room), peers: [...room.voicePeers] };
  }

  getRoomByCode(code: string): RoomPublic | null {
    const room = this.getRoom(code);
    return room ? this.toPublic(room) : null;
  }

  getRoomCodeForSocket(socketId: string): string | null {
    return this.socketToRoom.get(socketId) ?? null;
  }

  private roomForSocket(socketId: string): RoomInternal {
    const code = this.socketToRoom.get(socketId);
    if (!code) throw Object.assign(new Error("Not in a room"), { code: "NOT_IN_ROOM" });
    const room = this.getRoom(code);
    if (!room) throw Object.assign(new Error("Room not found"), { code: "ROOM_NOT_FOUND" });
    return room;
  }

  private playerForSocket(socketId: string, room: RoomInternal): Player {
    const player = [...room.players.values()].find((p) => p.socketId === socketId);
    if (!player) throw Object.assign(new Error("Player not found"), { code: "NOT_FOUND" });
    player.lastSeenAt = this.now();
    return player;
  }

  private assertCurrentPlayer(room: RoomInternal, player: Player) {
    const currentId = room.turnOrder[room.currentTurnIndex];
    if (player.id !== currentId) {
      throw Object.assign(new Error("Not your turn"), { code: "NOT_YOUR_TURN" });
    }
  }

  private pushSystem(room: RoomInternal, text: string) {
    room.chat.push({
      id: uuid(),
      playerId: "system",
      nickname: "System",
      color: "#94a3b8",
      text,
      timestamp: this.now(),
      type: "system",
    });
    this.trimChat(room);
  }

  returnToLobby(socketId: string) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host"), { code: "NOT_HOST" });
    room.phase = "lobby";
    room.level = null;
    room.currentChallenge = null;
    room.turnOrder = [];
    room.currentTurnIndex = 0;
    room.round = 0;
    room.winnerId = null;
    room.usedPromptIds.clear();
    for (const p of room.players.values()) {
      p.isReady = false;
      p.eliminated = false;
      p.partnerId = null;
      p.team = undefined;
    }
    this.pushSystem(room, "Returned to lobby");
    this.touch(room);
    return this.toPublic(room);
  }

  destroyRoom(code: string, reason: string) {
    const room = this.getRoom(code);
    if (!room) return;
    for (const p of room.players.values()) {
      if (p.socketId) this.socketToRoom.delete(p.socketId);
    }
    promptEngine.clearRoomPack(code);
    this.rooms.delete(code.toUpperCase());
    this.bans.delete(room.code);
    this.ioHook?.({ type: "destroyed", code: room.code, room: null });
    return reason;
  }

  private sweep() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      // A seat in the lobby is cheap to give up, so it is reclaimed sooner than
      // a seat mid-game where losing the player would break the turn order.
      const grace =
        room.phase === "lobby" || room.phase === "level_select"
          ? LOBBY_RECONNECT_GRACE_MS
          : RECONNECT_GRACE_MS;

      let swept = false;
      for (const p of [...room.players.values()]) {
        if (!p.isConnected && now - p.lastSeenAt > grace) {
          this.removePlayer(room, p.id);
          swept = true;
        }
      }
      if (!this.rooms.has(room.code)) continue;
      // destroyRoom fires its own event, so this only covers survivors.
      if (swept) this.ioHook?.({ type: "state", code: room.code, room: this.toPublic(room) });

      // Nothing should outlive a room everyone abandoned.
      const anyConnected = [...room.players.values()].some((p) => p.isConnected);
      if (!anyConnected && now - room.lastActivityAt > EMPTY_ROOM_TTL_MS) {
        this.destroyRoom(room.code, "empty");
        continue;
      }
      if (now - room.lastActivityAt > ROOM_IDLE_TTL_MS) {
        this.destroyRoom(room.code, "idle");
      }
    }
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const roomManager = new RoomManager();
