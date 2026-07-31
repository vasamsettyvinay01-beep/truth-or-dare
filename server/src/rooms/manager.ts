import { customAlphabet } from "nanoid";
import { v4 as uuid } from "uuid";
import {
  AVATAR_COLORS,
  DEFAULT_SKIP_TOKENS,
  ROOM_CODE_LENGTH,
  ROOM_IDLE_TTL_MS,
  RECONNECT_GRACE_MS,
  createDefaultSettings,
  type ChallengeType,
  type ChatMessage,
  type CurrentChallenge,
  type GameLevel,
  type Player,
  type PromptPack,
  type RoomPhase,
  type RoomPublic,
  type RoomSettings,
  type TurnAction,
} from "@tod/shared";
import { promptEngine } from "../prompts/engine";

const makeCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", ROOM_CODE_LENGTH);

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
}

function publicPlayer(p: Player): Player {
  return { ...p };
}

export class RoomManager {
  private rooms = new Map<string, RoomInternal>();
  private socketToRoom = new Map<string, string>();
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    this.cleanupTimer = setInterval(() => this.sweep(), 30_000);
  }

  destroy() {
    clearInterval(this.cleanupTimer);
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
      chat: room.chat.slice(-100),
      usedPromptIds: [...room.usedPromptIds],
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
      nickname: opts.nickname.trim().slice(0, 20),
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
    };

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
        const existing = room.players.get(existingId);
        if (existing) {
          if (existing.socketId) this.socketToRoom.delete(existing.socketId);
          existing.socketId = opts.socketId;
          existing.isConnected = true;
          existing.lastSeenAt = this.now();
          this.socketToRoom.set(opts.socketId, room.code);
          this.pushSystem(room, `${existing.nickname} reconnected`);
          return { room: this.toPublic(room), playerId: existingId, reconnectToken: opts.reconnectToken };
        }
      }
    }

    if (room.phase !== "lobby" && room.phase !== "level_select") {
      throw Object.assign(new Error("Game already in progress"), { code: "GAME_IN_PROGRESS" });
    }
    if (room.players.size >= room.settings.maxPlayers) {
      throw Object.assign(new Error("Room is full"), { code: "ROOM_FULL" });
    }

    const playerId = uuid();
    const usedColors = new Set([...room.players.values()].map((p) => p.color));
    const available = AVATAR_COLORS.filter((c) => !usedColors.has(c));
    const color =
      opts.color && !usedColors.has(opts.color)
        ? opts.color
        : available[0] || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const player: Player = {
      id: playerId,
      socketId: opts.socketId,
      nickname: opts.nickname.trim().slice(0, 20) || "Player",
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

  leaveBySocket(socketId: string): { roomCode: string; room: RoomPublic | null; destroyed: boolean } | null {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    const room = this.getRoom(code);
    if (!room) {
      this.socketToRoom.delete(socketId);
      return null;
    }

    const player = [...room.players.values()].find((p) => p.socketId === socketId);
    if (!player) {
      this.socketToRoom.delete(socketId);
      return { roomCode: code, room: this.toPublic(room), destroyed: false };
    }

    player.isConnected = false;
    player.socketId = null;
    player.lastSeenAt = this.now();
    room.voicePeers.delete(player.id);
    this.socketToRoom.delete(socketId);
    this.pushSystem(room, `${player.nickname} disconnected`);

    // Immediate leave if still in lobby
    if (room.phase === "lobby" || room.phase === "level_select") {
      return this.removePlayer(room, player.id);
    }

    return { roomCode: code, room: this.toPublic(room), destroyed: false };
  }

  private removePlayer(
    room: RoomInternal,
    playerId: string
  ): { roomCode: string; room: RoomPublic | null; destroyed: boolean } {
    const player = room.players.get(playerId);
    if (!player) return { roomCode: room.code, room: this.toPublic(room), destroyed: false };

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
      return { roomCode: room.code, room: null, destroyed: true };
    }

    if (room.hostId === playerId) {
      const nextHost = [...room.players.values()].find((p) => p.isConnected) || [...room.players.values()][0];
      room.hostId = nextHost.id;
      nextHost.isHost = true;
      this.pushSystem(room, `${nextHost.nickname} is now the host`);
    }

    // Check win conditions after removal
    this.checkSurvivalWin(room);

    return { roomCode: room.code, room: this.toPublic(room), destroyed: false };
  }

  kick(hostSocketId: string, targetId: string) {
    const room = this.roomForSocket(hostSocketId);
    const host = this.playerForSocket(hostSocketId, room);
    if (host.id !== room.hostId) throw Object.assign(new Error("Only host can kick"), { code: "NOT_HOST" });
    if (targetId === host.id) throw Object.assign(new Error("Cannot kick yourself"), { code: "INVALID" });
    return this.removePlayer(room, targetId);
  }

  transferHost(hostSocketId: string, targetId: string) {
    const room = this.roomForSocket(hostSocketId);
    const host = this.playerForSocket(hostSocketId, room);
    if (host.id !== room.hostId) throw Object.assign(new Error("Only host can transfer"), { code: "NOT_HOST" });
    const target = room.players.get(targetId);
    if (!target) throw Object.assign(new Error("Player not found"), { code: "NOT_FOUND" });
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

    room.settings = {
      ...room.settings,
      ...partial,
      maxPlayers: Math.min(20, Math.max(2, partial.maxPlayers ?? room.settings.maxPlayers)),
      timerSeconds: Math.min(300, Math.max(0, partial.timerSeconds ?? room.settings.timerSeconds)),
    };
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
    if (room.phase !== "spinning" && room.settings.gameMode !== "spin_wheel") {
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

      if (room.settings.gameMode === "survival" || room.settings.gameMode === "last_standing") {
        // skips don't eliminate in this design — only failing would; treat skip as soft pass
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

  private checkSurvivalWin(room: RoomInternal) {
    if (room.phase === "lobby" || room.phase === "level_select" || room.phase === "ended") return;
    if (room.settings.gameMode !== "survival" && room.settings.gameMode !== "last_standing") return;
    const alive = [...room.players.values()].filter((p) => p.isConnected && !p.eliminated);
    if (alive.length === 1) {
      room.winnerId = alive[0].id;
      room.phase = "ended";
      this.pushSystem(room, `${alive[0].nickname} is the last one standing!`);
    }
  }

  private assignPrompt(room: RoomInternal, type: ChallengeType, replace = false) {
    if (!room.level) throw Object.assign(new Error("No level"), { code: "NO_LEVEL" });
    const prompt = promptEngine.pickPrompt({
      roomId: room.code,
      type,
      level: room.level,
      mode: room.settings.gameMode,
      enabledCategories: room.settings.enabledCategories,
      usedIds: room.usedPromptIds,
    });
    if (!prompt) throw Object.assign(new Error("No prompts available"), { code: "NO_PROMPTS" });
    if (!replace) room.usedPromptIds.add(prompt.id);
    else room.usedPromptIds.add(prompt.id);

    const timer =
      room.settings.timerSeconds > 0 ? this.now() + room.settings.timerSeconds * 1000 : null;

    room.currentChallenge = {
      promptId: prompt.id,
      type: prompt.type,
      text: prompt.text,
      category: prompt.category,
      level: prompt.level,
      assignedAt: this.now(),
      timerEndsAt: timer,
    };
  }

  sendChat(socketId: string, text: string): ChatMessage {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (!room.settings.chatEnabled) throw Object.assign(new Error("Chat disabled"), { code: "CHAT_OFF" });
    const cleaned = text.trim().slice(0, 300);
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
    if (room.chat.length > 200) room.chat = room.chat.slice(-150);
    this.touch(room);
    return message;
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
    const message: ChatMessage = {
      id: uuid(),
      playerId: player.id,
      nickname: player.nickname,
      color: player.color,
      text: emoji,
      timestamp: this.now(),
      type: "reaction",
      reaction: emoji,
    };
    room.chat.push(message);
    this.touch(room);
    return { message, fromId: player.id, emoji, toId: targetPlayerId };
  }

  importPrompts(socketId: string, pack: PromptPack) {
    const room = this.roomForSocket(socketId);
    const player = this.playerForSocket(socketId, room);
    if (player.id !== room.hostId) throw Object.assign(new Error("Only host"), { code: "NOT_HOST" });
    const merged = promptEngine.importPack(pack, room.code);
    room.settings.enabledCategories = [...new Set([...room.settings.enabledCategories, ...merged.categories])];
    this.pushSystem(room, `Custom prompt pack "${pack.name}" imported`);
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
    return reason;
  }

  private sweep() {
    const now = this.now();
    for (const room of this.rooms.values()) {
      // Remove long-disconnected players
      for (const p of [...room.players.values()]) {
        if (!p.isConnected && now - p.lastSeenAt > RECONNECT_GRACE_MS) {
          this.removePlayer(room, p.id);
        }
      }
      if (!this.rooms.has(room.code)) continue;
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
