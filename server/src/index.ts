import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import type { ClientToServerEvents, PromptQuery, ServerToClientEvents } from "@tod/shared";
import { promptEngine } from "./prompts/engine";
import { registerSocketHandlers } from "./socket/handlers";

const PORT = Number(process.env.PORT || 4001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGINS || CLIENT_ORIGIN)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Exact origins plus optional wildcard hosts such as `https://*.vercel.app`,
 * which is what preview deployments need. Credentials are enabled, so a bare
 * `*` is only honoured when it is set deliberately.
 */
function originMatches(pattern: string, origin: string) {
  if (pattern === origin) return true;
  if (!pattern.includes("*")) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]*");
  return new RegExp(`^${escaped}$`).test(origin);
}

function isAllowedOrigin(origin?: string | null) {
  // Same-origin requests, curl and native apps send no Origin header.
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes("*")) return true;
  return ALLOWED_ORIGINS.some((pattern) => originMatches(pattern, origin));
}

const app = express();
// Render, Railway and Fly terminate TLS upstream; without this the server sees
// every request as plain http and secure-cookie/protocol checks misbehave.
app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, cb) {
      if (!isAllowedOrigin(origin)) {
        console.warn(`Blocked CORS origin: ${origin}`);
        cb(null, false);
        return;
      }
      cb(null, origin || true);
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "truth-or-dare",
    ts: Date.now(),
    prompts: promptEngine.getSummary(),
  });
});

app.get("/api/prompts", (req, res) => {
  const query: PromptQuery = {
    type: req.query.type === "dare" || req.query.type === "truth" ? req.query.type : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    remoteOnly: req.query.remoteOnly === "1" || req.query.remoteOnly === "true",
    categories:
      typeof req.query.category === "string"
        ? req.query.category.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    difficulties:
      typeof req.query.difficulty === "string"
        ? (req.query.difficulty.split(",").map((s) => s.trim()) as PromptQuery["difficulties"])
        : undefined,
    tags:
      typeof req.query.tag === "string"
        ? req.query.tag.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  };

  if (req.query.full === "1") {
    res.json(promptEngine.getPack());
    return;
  }

  res.json(promptEngine.query(query));
});

app.get("/api/prompts/summary", (_req, res) => {
  res.json(promptEngine.getSummary());
});

app.get("/api/prompts/export", (_req, res) => {
  const pack = promptEngine.getPack();
  res.setHeader("Content-Disposition", `attachment; filename="${pack.id}.json"`);
  res.json(pack);
});

app.post("/api/prompts/validate", (req, res) => {
  try {
    const pack = promptEngine.importPack(req.body, "__validate__");
    promptEngine.clearRoomPack("__validate__");
    res.json({ ok: true, promptCount: pack.prompts.length, categories: pack.categories });
  } catch (e) {
    res.status(400).json({ ok: false, error: (e as Error).message });
  }
});

app.use("/prompts", express.static(path.resolve(__dirname, "../prompts")));

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: (origin, cb) => {
      cb(null, isAllowedOrigin(origin) ? origin || true : false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Polling must stay enabled: mobile carriers and corporate proxies routinely
  // block the WebSocket handshake, and polling is the only way in for them.
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  // Phones background tabs aggressively; a longer ping timeout avoids dropping
  // a player who simply locked their screen for a few seconds.
  pingInterval: 25000,
  pingTimeout: 60000,
  // Replays missed events after a brief drop instead of resetting the client.
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  maxHttpBufferSize: 8e6,
});

registerSocketHandlers(io);

server.listen(PORT, "0.0.0.0", () => {
  const summary = promptEngine.getSummary();
  console.log(`♠ Truth or Dare server listening on :${PORT}`);
  console.log(`  Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`  Prompts loaded: ${summary.promptCount} (${summary.remoteFriendlyCount} remote-friendly)`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, closing server`);
  io.close(() => {
    server.close(() => process.exit(0));
  });
  // Don't hang a container restart on a stuck socket.
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
