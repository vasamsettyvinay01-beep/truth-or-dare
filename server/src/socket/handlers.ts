import type { Server, Socket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@tod/shared";
import {
  LIMITS,
  sanitizeChallengeType,
  sanitizeChatText,
  sanitizeCreatePayload,
  sanitizeGameLevel,
  sanitizeJoinPayload,
  sanitizeMessageId,
  sanitizePlayerId,
  sanitizeReaction,
  sanitizeSettingsPartial,
  sanitizeTurnAction,
} from "@tod/shared";
import { promptEngine } from "../prompts/engine";
import { roomManager } from "../rooms/manager";
import { chatLimiter, connectLimiter, createLimiter, eventLimiter } from "../security/rate-limit";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function errPayload(e: unknown) {
  const err = e as { code?: string; message?: string };
  const code = typeof err.code === "string" ? err.code : "ERROR";
  // Never leak internal TypeError messages to clients.
  const safe =
    code !== "ERROR"
      ? err.message || "Something went wrong"
      : "Something went wrong";
  return { code, message: safe };
}

function rateLimited() {
  return { code: "RATE_LIMITED", message: "Too many requests — slow down a moment." };
}

function broadcastRoom(io: AppServer, code: string) {
  const room = roomManager.getRoomByCode(code);
  if (room) io.to(code).emit("room:state", room);
}

function clientKey(socket: AppSocket) {
  const ip = socket.handshake.address || "unknown";
  return `${ip}:${socket.id}`;
}

export function registerSocketHandlers(io: AppServer) {
  roomManager.setIoHook((event) => {
    if (event.type === "destroyed") {
      io.to(event.code).emit("room:destroyed", "empty");
    } else if (event.type === "state" && event.room) {
      io.to(event.code).emit("room:state", event.room);
    }
  });

  io.on("connection", (socket: AppSocket) => {
    if (!connectLimiter.take(socket.handshake.address || socket.id)) {
      socket.emit("room:error", rateLimited());
      socket.disconnect(true);
      return;
    }

    // Summary only on connect — full pack is large; clients request/export when needed.
    socket.emit("prompts:summary", promptEngine.getSummary());

    socket.on("prompts:query", (query, ack) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) {
          ack?.({ ok: false, error: rateLimited() });
          return;
        }
        const roomCode = roomManager.getRoomCodeForSocket(socket.id) || undefined;
        const result = promptEngine.query(query || {}, roomCode);
        ack?.({ ok: true, data: result });
      } catch (e) {
        ack?.({ ok: false, error: errPayload(e) });
      }
    });

    socket.on("prompts:export", (ack) => {
      try {
        if (!eventLimiter.take(clientKey(socket), 5)) {
          ack?.({ ok: false, error: rateLimited() });
          return;
        }
        const roomCode = roomManager.getRoomCodeForSocket(socket.id) || undefined;
        ack?.({ ok: true, data: { pack: promptEngine.getPack(roomCode) } });
      } catch (e) {
        ack?.({ ok: false, error: errPayload(e) });
      }
    });

    socket.on("room:create", (payload, ack) => {
      try {
        if (!createLimiter.take(socket.handshake.address || socket.id)) {
          const error = rateLimited();
          ack?.({ ok: false, error });
          socket.emit("room:error", error);
          return;
        }
        if (roomManager.roomCount() >= LIMITS.maxRooms) {
          throw Object.assign(new Error("Server is at capacity — try again shortly"), {
            code: "SERVER_FULL",
          });
        }
        const clean = sanitizeCreatePayload(payload);
        const result = roomManager.createRoom({
          socketId: socket.id,
          nickname: clean.nickname,
          color: clean.color,
          maxPlayers: clean.maxPlayers,
          gameMode: clean.gameMode,
        });
        socket.join(result.room.code);
        ack?.({ ok: true, data: result });
        socket.emit("room:state", result.room);
        socket.emit("prompts:pack", promptEngine.getPack(result.room.code));
      } catch (e) {
        const error = errPayload(e);
        ack?.({ ok: false, error });
        socket.emit("room:error", error);
      }
    });

    socket.on("room:join", (payload, ack) => {
      try {
        if (!eventLimiter.take(clientKey(socket), 2)) {
          const error = rateLimited();
          ack?.({ ok: false, error });
          socket.emit("room:error", error);
          return;
        }
        const clean = sanitizeJoinPayload(payload);
        const result = roomManager.joinRoom({
          code: clean.code,
          socketId: socket.id,
          nickname: clean.nickname,
          color: clean.color,
          reconnectToken: clean.reconnectToken,
        });
        socket.join(result.room.code);
        ack?.({ ok: true, data: result });
        broadcastRoom(io, result.room.code);
        socket.emit("prompts:pack", promptEngine.getPack(result.room.code));
      } catch (e) {
        const error = errPayload(e);
        ack?.({ ok: false, error });
        socket.emit("room:error", error);
      }
    });

    socket.on("room:leave", () => {
      try {
        const result = roomManager.leaveBySocket(socket.id);
        if (!result) return;
        socket.leave(result.roomCode);
        if (result.destroyed) {
          io.to(result.roomCode).emit("room:destroyed", "empty");
        } else if (result.room) {
          io.to(result.roomCode).emit("room:state", result.room);
        }
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:ready", (ready) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const room = roomManager.setReady(socket.id, !!ready);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:start", () => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const room = roomManager.startGame(socket.id);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:settings", (partial) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const clean = sanitizeSettingsPartial(partial);
        const room = roomManager.updateSettings(socket.id, clean);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:kick", (playerId) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const targetId = sanitizePlayerId(playerId);
        const result = roomManager.kick(socket.id, targetId);
        if (result.kickedSocketId) {
          const kicked = io.sockets.sockets.get(result.kickedSocketId);
          if (kicked) {
            kicked.leave(result.roomCode);
            kicked.emit("room:destroyed", "kicked");
          }
        }
        if (result.destroyed) {
          io.to(result.roomCode).emit("room:destroyed", "empty");
        } else if (result.room) {
          io.to(result.roomCode).emit("room:state", result.room);
        }
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:transfer-host", (playerId) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const room = roomManager.transferHost(socket.id, sanitizePlayerId(playerId));
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:select-level", (level) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        let room = roomManager.selectLevel(socket.id, sanitizeGameLevel(level));
        const maybe = roomManager.ensureRandomPrompt(room.code);
        if (maybe) room = maybe;
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:return-lobby", () => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const room = roomManager.returnToLobby(socket.id);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:import-prompts", (pack) => {
      try {
        if (!eventLimiter.take(clientKey(socket), 10)) {
          socket.emit("room:error", rateLimited());
          return;
        }
        const { room, pack: merged } = roomManager.importPrompts(socket.id, pack);
        io.to(room.code).emit("prompts:pack", merged);
        io.to(room.code).emit("prompts:summary", promptEngine.getSummary(room.code));
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("game:choose", (type) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const room = roomManager.chooseType(socket.id, sanitizeChallengeType(type));
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("game:spin", () => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const { room, type, angle } = roomManager.spin(socket.id);
        io.to(room.code).emit("game:spin-result", { type, angle });
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("game:action", (action) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const { room, confetti } = roomManager.turnAction(socket.id, sanitizeTurnAction(action));
        if (confetti) io.to(room.code).emit("game:confetti", confetti);
        const maybe = roomManager.ensureRandomPrompt(room.code);
        broadcastRoom(io, (maybe || room).code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("chat:send", (text) => {
      try {
        if (!chatLimiter.take(clientKey(socket))) {
          socket.emit("room:error", rateLimited());
          return;
        }
        const message = roomManager.sendChat(socket.id, sanitizeChatText(text));
        const code = roomManager.getRoomCodeForSocket(socket.id);
        if (code) io.to(code).emit("chat:message", message);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("chat:pin", (messageId) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const room = roomManager.pinMessage(socket.id, sanitizeMessageId(messageId));
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("chat:react", (emoji, targetPlayerId) => {
      try {
        if (!chatLimiter.take(clientKey(socket))) {
          socket.emit("room:error", rateLimited());
          return;
        }
        const cleanEmoji = sanitizeReaction(emoji);
        const toId =
          targetPlayerId === undefined || targetPlayerId === null || targetPlayerId === ""
            ? undefined
            : sanitizePlayerId(targetPlayerId);
        const { message, fromId, toId: tid } = roomManager.react(socket.id, cleanEmoji, toId);
        const code = roomManager.getRoomCodeForSocket(socket.id);
        if (code) {
          io.to(code).emit("chat:message", message);
          io.to(code).emit("player:reaction", { fromId, emoji: cleanEmoji, toId: tid });
        }
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("voice:join", () => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const { room, peers } = roomManager.voiceJoin(socket.id);
        io.to(room.code).emit("voice:peers", peers);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("voice:leave", () => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const { room, peers } = roomManager.voiceLeave(socket.id);
        io.to(room.code).emit("voice:peers", peers);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    // Voice is experimental / UI-stubbed on the client. Keep the relay tightly gated.
    socket.on("voice:signal", (payload) => {
      try {
        if (!eventLimiter.take(clientKey(socket))) return;
        const code = roomManager.getRoomCodeForSocket(socket.id);
        if (!code) return;
        const room = roomManager.getRoomByCode(code);
        if (!room?.settings.voiceEnabled) return;
        if (!payload || typeof payload !== "object") return;
        if (typeof payload.to !== "string") return;
        const to = sanitizePlayerId(payload.to);
        const dataJson = JSON.stringify(payload.data ?? null);
        if (dataJson.length > 32_000) return;
        const targetSocketId = roomManager.socketIdForPlayer(code, to);
        const me = room.players.find((p) => roomManager.socketIdForPlayer(code, p.id) === socket.id);
        if (targetSocketId) {
          io.to(targetSocketId).emit("voice:signal", {
            from: me?.id || socket.id,
            data: payload.data,
          });
        }
      } catch {
        /* ignore malformed signaling */
      }
    });

    socket.on("disconnect", () => {
      try {
        const result = roomManager.disconnectBySocket(socket.id);
        if (!result) return;
        if (result.destroyed) {
          io.to(result.roomCode).emit("room:destroyed", "empty");
        } else if (result.room) {
          io.to(result.roomCode).emit("room:state", result.room);
        }
      } catch {
        /* disconnect must never throw */
      }
    });
  });
}
