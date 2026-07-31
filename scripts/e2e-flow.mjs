/**
 * End-to-end multiplayer smoke test.
 *
 * Drives two Socket.IO clients through the full game flow against a running
 * server, including the mobile-critical case of a transport drop followed by a
 * reconnect with the saved token.
 *
 * Usage: node scripts/e2e-flow.mjs [serverUrl]
 */
import { io } from "socket.io-client";

const URL = process.argv[2] || process.env.SOCKET_URL || "http://localhost:4001";
const TIMEOUT = 12000;

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function connect(label) {
  return new Promise((resolve, reject) => {
    const socket = io(URL, {
      transports: ["polling", "websocket"],
      reconnection: false,
      timeout: TIMEOUT,
    });
    const timer = setTimeout(() => reject(new Error(`${label} connect timeout`)), TIMEOUT);
    socket.on("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(new Error(`${label} connect_error: ${err.message}`));
    });
  });
}

function emitAck(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} ack timeout`)), TIMEOUT);
    socket.emit(event, ...args, (res) => {
      clearTimeout(timer);
      if (res?.ok) resolve(res.data);
      else reject(new Error(res?.error?.message || `${event} failed`));
    });
  });
}

/** Resolves with the first room:state matching `predicate`. */
function waitForState(socket, predicate, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("room:state", handler);
      reject(new Error(`timeout waiting for ${label}`));
    }, TIMEOUT);
    const handler = (room) => {
      if (!predicate(room)) return;
      clearTimeout(timer);
      socket.off("room:state", handler);
      resolve(room);
    };
    socket.on("room:state", handler);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The connection starts on polling and upgrades a moment later. */
function waitForUpgrade(socket, ms = 5000) {
  return new Promise((resolve) => {
    if (socket.io.engine.transport.name === "websocket") return resolve("websocket");
    const timer = setTimeout(() => resolve(socket.io.engine.transport.name), ms);
    socket.io.engine.once("upgrade", (transport) => {
      clearTimeout(timer);
      resolve(transport.name);
    });
  });
}

async function main() {
  console.log(`\nTruth or Dare — end-to-end flow against ${URL}\n`);

  const hostSocket = await connect("host");
  check("host socket connects", hostSocket.connected);
  const transport = await waitForUpgrade(hostSocket);
  check("polling connection upgrades to websocket", transport === "websocket", `got ${transport}`);

  // 1. Create a room.
  const created = await emitAck(hostSocket, "room:create", {
    nickname: "HostPlayer",
    color: "#a78bfa",
    maxPlayers: 6,
    gameMode: "classic",
  });
  const code = created.room.code;
  check("room is created with a 6-character code", /^[A-Z0-9]{6}$/.test(code), code);
  check("creator is host", created.room.players[0].isHost);
  check("reconnect token is issued", typeof created.reconnectToken === "string");

  // 2. Second player joins from a separate connection.
  const guestSocket = await connect("guest");
  const hostSeesGuest = waitForState(hostSocket, (r) => r.players.length === 2, "guest to appear");
  const joined = await emitAck(guestSocket, "room:join", {
    code,
    nickname: "GuestPlayer",
    color: "#22d3ee",
  });
  check("guest joins the room", joined.room.code === code);
  const twoPlayerState = await hostSeesGuest;
  check("host receives real-time player list update", twoPlayerState.players.length === 2);

  // 3. Duplicate nickname is rejected.
  const dupSocket = await connect("dup");
  let dupError = null;
  try {
    await emitAck(dupSocket, "room:join", { code, nickname: "GuestPlayer" });
  } catch (e) {
    dupError = e.message;
  }
  check("duplicate nickname is rejected", !!dupError, dupError || "no error raised");
  dupSocket.disconnect();

  // 4. Unknown room code fails cleanly.
  const badSocket = await connect("bad");
  let badError = null;
  try {
    await emitAck(badSocket, "room:join", { code: "ZZZZZZ", nickname: "Nobody" });
  } catch (e) {
    badError = e.message;
  }
  check("unknown room code is rejected", !!badError, badError || "no error raised");
  badSocket.disconnect();

  // 5. Ready up and start.
  hostSocket.emit("room:ready", true);
  guestSocket.emit("room:ready", true);
  await waitForState(hostSocket, (r) => r.players.every((p) => p.isReady), "all players ready");
  check("both players report ready", true);

  const levelSelect = waitForState(guestSocket, (r) => r.phase === "level_select", "level select");
  hostSocket.emit("room:start");
  await levelSelect;
  check("host can start the game", true);

  // 6. Level selection reaches every client.
  const playing = waitForState(guestSocket, (r) => r.phase === "playing", "playing phase");
  hostSocket.emit("room:select-level", "spicy");
  const playingState = await playing;
  check("level selection propagates to all players", playingState.level === "spicy");

  // 7. The current player picks a type and everyone sees the same prompt.
  const currentId = playingState.currentPlayerId;
  const currentSocket = currentId === created.playerId ? hostSocket : guestSocket;
  const otherSocket = currentSocket === hostSocket ? guestSocket : hostSocket;

  const revealOnOther = waitForState(otherSocket, (r) => r.phase === "revealing", "reveal on other client");
  currentSocket.emit("game:choose", "truth");
  const revealed = await revealOnOther;
  check("prompt is revealed to the non-acting player", !!revealed.currentChallenge?.text);
  check("prompt matches the requested level", revealed.currentChallenge?.level === "spicy");
  const firstPromptId = revealed.currentChallenge.promptId;

  // 8. Completing advances the turn.
  const advanced = waitForState(
    otherSocket,
    (r) => r.currentPlayerId !== currentId,
    "turn to advance"
  );
  currentSocket.emit("game:action", "complete");
  const advancedState = await advanced;
  check("turn advances to the next player", advancedState.currentPlayerId !== currentId);

  // 9. Prompts do not repeat within a game.
  const nextSocket = advancedState.currentPlayerId === created.playerId ? hostSocket : guestSocket;
  const secondReveal = waitForState(hostSocket, (r) => r.phase === "revealing", "second reveal");
  nextSocket.emit("game:choose", "truth");
  const second = await secondReveal;
  check("a fresh prompt is served", second.currentChallenge.promptId !== firstPromptId);

  // 10. Chat delivers to the other player.
  const chatReceived = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("chat timeout")), TIMEOUT);
    guestSocket.on("chat:message", (m) => {
      if (m.type === "chat" && m.text === "hello from host") {
        clearTimeout(timer);
        resolve(m);
      }
    });
  });
  hostSocket.emit("chat:send", "hello from host");
  await chatReceived;
  check("chat messages reach other players", true);

  // 11. The mobile case: drop the transport, then rejoin with the saved token.
  const guestId = joined.playerId;
  const dropSeen = waitForState(
    hostSocket,
    (r) => r.players.some((p) => p.id === guestId && !p.isConnected),
    "guest to be marked disconnected"
  );
  guestSocket.disconnect();
  const stateAfterDrop = await dropSeen;
  check(
    "a dropped player keeps their seat",
    stateAfterDrop.players.some((p) => p.id === guestId),
    `players: ${stateAfterDrop.players.map((p) => p.nickname).join(", ")}`
  );
  await sleep(300);

  const guestAgain = await connect("guest-reconnect");
  const rejoined = await emitAck(guestAgain, "room:join", {
    code,
    nickname: "GuestPlayer",
    reconnectToken: joined.reconnectToken,
  });
  check("reconnect restores the same player id", rejoined.playerId === guestId);
  check("reconnect does not duplicate the player", rejoined.room.players.length === 2,
    `${rejoined.room.players.length} players`);
  check("in-progress room state is restored", rejoined.room.phase !== "lobby");

  // 12. Leaving explicitly frees the seat immediately.
  const guestGone = waitForState(hostSocket, (r) => r.players.length === 1, "guest removal");
  guestAgain.emit("room:leave");
  await guestGone;
  check("explicit leave removes the player right away", true);

  // 13. Last player leaving destroys the room and its state.
  const destroyed = new Promise((resolve) => {
    hostSocket.on("room:destroyed", resolve);
    setTimeout(resolve, 2000);
  });
  hostSocket.emit("room:leave");
  await destroyed;

  const probe = await connect("probe");
  let gone = false;
  try {
    await emitAck(probe, "room:join", { code, nickname: "Ghost" });
  } catch {
    gone = true;
  }
  check("room state is discarded when everyone leaves", gone);

  probe.disconnect();
  guestAgain.disconnect();
  hostSocket.disconnect();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nFATAL: ${err.message}\n`);
  process.exit(1);
});
