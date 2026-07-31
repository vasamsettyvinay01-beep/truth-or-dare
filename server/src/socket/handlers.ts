import type { Server, Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@tod/shared";
import { promptEngine } from "../prompts/engine";
import { roomManager } from "../rooms/manager";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function errPayload(e: unknown) {
  const err = e as { code?: string; message?: string };
  return {
    code: err.code || "ERROR",
    message: err.message || "Something went wrong",
  };
}

function broadcastRoom(io: AppServer, code: string) {
  const room = roomManager.getRoomByCode(code);
  if (room) io.to(code).emit("room:state", room);
}

export function registerSocketHandlers(io: AppServer) {
  io.on("connection", (socket: AppSocket) => {
    socket.emit("prompts:pack", promptEngine.getPack());
    socket.emit("prompts:summary", promptEngine.getSummary());

    socket.on("prompts:query", (query, ack) => {
      try {
        const roomCode = roomManager.getRoomCodeForSocket(socket.id) || undefined;
        const result = promptEngine.query(query || {}, roomCode);
        ack?.({ ok: true, data: result });
      } catch (e) {
        ack?.({ ok: false, error: errPayload(e) });
      }
    });

    socket.on("prompts:export", (ack) => {
      try {
        const roomCode = roomManager.getRoomCodeForSocket(socket.id) || undefined;
        ack?.({ ok: true, data: { pack: promptEngine.getPack(roomCode) } });
      } catch (e) {
        ack?.({ ok: false, error: errPayload(e) });
      }
    });

    socket.on("room:create", (payload, ack) => {
      try {
        const nickname = payload?.nickname?.trim();
        if (!nickname) throw Object.assign(new Error("Nickname required"), { code: "BAD_INPUT" });
        const result = roomManager.createRoom({
          socketId: socket.id,
          nickname,
          color: payload.color,
          maxPlayers: payload.maxPlayers,
          gameMode: payload.gameMode,
        });
        socket.join(result.room.code);
        ack?.({ ok: true, data: result });
        socket.emit("room:state", result.room);
      } catch (e) {
        const error = errPayload(e);
        ack?.({ ok: false, error });
        socket.emit("room:error", error);
      }
    });

    socket.on("room:join", (payload, ack) => {
      try {
        const nickname = payload?.nickname?.trim();
        const code = payload?.code?.trim().toUpperCase();
        if (!nickname || !code) throw Object.assign(new Error("Code and nickname required"), { code: "BAD_INPUT" });
        const result = roomManager.joinRoom({
          code,
          socketId: socket.id,
          nickname,
          color: payload.color,
          reconnectToken: payload.reconnectToken,
        });
        socket.join(result.room.code);
        ack?.({ ok: true, data: result });
        broadcastRoom(io, result.room.code);
      } catch (e) {
        const error = errPayload(e);
        ack?.({ ok: false, error });
        socket.emit("room:error", error);
      }
    });

    socket.on("room:leave", () => {
      const result = roomManager.leaveBySocket(socket.id);
      if (!result) return;
      socket.leave(result.roomCode);
      if (result.destroyed) {
        io.to(result.roomCode).emit("room:destroyed", "empty");
      } else if (result.room) {
        io.to(result.roomCode).emit("room:state", result.room);
      }
    });

    socket.on("room:ready", (ready) => {
      try {
        const room = roomManager.setReady(socket.id, !!ready);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:start", () => {
      try {
        const room = roomManager.startGame(socket.id);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:settings", (partial) => {
      try {
        const room = roomManager.updateSettings(socket.id, partial);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:kick", (playerId) => {
      try {
        const result = roomManager.kick(socket.id, playerId);
        if (result.destroyed) {
          io.to(result.roomCode).emit("room:destroyed", "empty");
        } else if (result.room) {
          io.to(result.roomCode).emit("room:state", result.room);
          // Notify kicked player's sockets via state absence — client handles locally
        }
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:transfer-host", (playerId) => {
      try {
        const room = roomManager.transferHost(socket.id, playerId);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:select-level", (level) => {
      try {
        let room = roomManager.selectLevel(socket.id, level);
        const maybe = roomManager.ensureRandomPrompt(room.code);
        if (maybe) room = maybe;
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:return-lobby", () => {
      try {
        const room = roomManager.returnToLobby(socket.id);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("room:import-prompts", (pack) => {
      try {
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
        const room = roomManager.chooseType(socket.id, type);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("game:spin", () => {
      try {
        const { room, type, angle } = roomManager.spin(socket.id);
        io.to(room.code).emit("game:spin-result", { type, angle });
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("game:action", (action) => {
      try {
        const { room, confetti } = roomManager.turnAction(socket.id, action);
        if (confetti) io.to(room.code).emit("game:confetti", confetti);
        const maybe = roomManager.ensureRandomPrompt(room.code);
        broadcastRoom(io, (maybe || room).code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("chat:send", (text) => {
      try {
        const message = roomManager.sendChat(socket.id, text);
        const code = roomManager.getRoomCodeForSocket(socket.id);
        if (code) io.to(code).emit("chat:message", message);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("chat:pin", (messageId) => {
      try {
        const room = roomManager.pinMessage(socket.id, messageId);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("chat:react", (emoji, targetPlayerId) => {
      try {
        const { message, fromId, toId } = roomManager.react(socket.id, emoji, targetPlayerId);
        const code = roomManager.getRoomCodeForSocket(socket.id);
        if (code) {
          io.to(code).emit("chat:message", message);
          io.to(code).emit("player:reaction", { fromId, emoji, toId });
        }
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("voice:join", () => {
      try {
        const { room, peers } = roomManager.voiceJoin(socket.id);
        io.to(room.code).emit("voice:peers", peers);
        broadcastRoom(io, room.code);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("voice:leave", () => {
      try {
        const { room, peers } = roomManager.voiceLeave(socket.id);
        io.to(room.code).emit("voice:peers", peers);
      } catch (e) {
        socket.emit("room:error", errPayload(e));
      }
    });

    socket.on("voice:signal", (payload) => {
      try {
        const code = roomManager.getRoomCodeForSocket(socket.id);
        if (!code) return;
        const room = roomManager.getRoomByCode(code);
        if (!room) return;
        const target = room.players.find((p) => p.id === payload.to);
        if (target?.socketId) {
          io.to(target.socketId).emit("voice:signal", { from: socket.id, data: payload.data });
        }
      } catch {
        /* ignore */
      }
    });

    // A dropped transport is not a departure: the player keeps their seat and
    // reconnect token until the room manager's grace period expires.
    socket.on("disconnect", () => {
      const result = roomManager.disconnectBySocket(socket.id);
      if (!result) return;
      if (result.destroyed) {
        io.to(result.roomCode).emit("room:destroyed", "empty");
      } else if (result.room) {
        io.to(result.roomCode).emit("room:state", result.room);
      }
    });
  });
}
