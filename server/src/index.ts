import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { LIMITS, type ClientToServerEvents, type PromptQuery, type ServerToClientEvents } from "@tod/shared";
import { promptEngine } from "./prompts/engine";
import { roomManager } from "./rooms/manager";
import { registerSocketHandlers } from "./socket/handlers";
import { httpLimiter } from "./security/rate-limit";

const PORT = Number(process.env.PORT || 4001);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGINS || CLIENT_ORIGIN)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Exact origins plus optional single-label wildcards such as
 * `https://truth-or-dare-*-vasamsettyvinay01-beeps-projects.vercel.app`.
 * A bare `*` is refused in production even if configured.
 */
function originMatches(pattern: string, origin: string) {
  if (pattern === origin) return true;
  if (!pattern.includes("*")) return false;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]*");
  return new RegExp(`^${escaped}$`).test(origin);
}

function isPrivateNetworkOrigin(origin: string) {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  return (
    /^(localhost|127(?:\.\d+){1,3}|\[::1\])$/i.test(hostname) ||
    /\.local$/i.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function isAllowedOrigin(origin?: string | null) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes("*")) {
    if (IS_PRODUCTION) {
      console.warn("Refusing CLIENT_ORIGINS=* in production");
      return false;
    }
    return true;
  }
  if (!IS_PRODUCTION && isPrivateNetworkOrigin(origin)) return true;
  return ALLOWED_ORIGINS.some((pattern) => originMatches(pattern, origin));
}

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

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

app.use(express.json({ limit: LIMITS.maxHttpJsonBytes }));

app.use((req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  if (!httpLimiter.take(key)) {
    res.status(429).json({ ok: false, error: "Too many requests" });
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  const summary = promptEngine.getSummary();
  res.json({
    ok: true,
    service: "truth-or-dare",
    version: process.env.npm_package_version || "1.0.0",
    uptimeSec: Math.floor(process.uptime()),
    ts: Date.now(),
    rooms: roomManager.roomCount(),
    prompts: summary.promptCount,
    remoteFriendly: summary.remoteFriendlyCount,
  });
});

app.get("/api/prompts", (req, res) => {
  const query: PromptQuery = {
    type: req.query.type === "dare" || req.query.type === "truth" ? req.query.type : undefined,
    search: typeof req.query.search === "string" ? req.query.search.slice(0, 80) : undefined,
    remoteOnly: req.query.remoteOnly === "1" || req.query.remoteOnly === "true",
    categories:
      typeof req.query.category === "string"
        ? req.query.category.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)
        : undefined,
    difficulties:
      typeof req.query.difficulty === "string"
        ? (req.query.difficulty.split(",").map((s) => s.trim()) as PromptQuery["difficulties"])
        : undefined,
    tags:
      typeof req.query.tag === "string"
        ? req.query.tag.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20)
        : undefined,
    limit: req.query.limit ? Math.min(100, Math.max(1, Number(req.query.limit) || 20)) : 20,
    offset: req.query.offset ? Math.max(0, Number(req.query.offset) || 0) : 0,
  };

  // Full pack downloads are host/admin style — keep available but never default.
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
    const bodySize = JSON.stringify(req.body ?? {}).length;
    if (bodySize > LIMITS.maxPackBytes) {
      res.status(413).json({ ok: false, error: "Pack too large" });
      return;
    }
    const pack = promptEngine.importPack(req.body, "__validate__");
    promptEngine.clearRoomPack("__validate__");
    if (pack.prompts.length > LIMITS.maxPromptImport) {
      res.status(400).json({ ok: false, error: `Too many prompts (max ${LIMITS.maxPromptImport})` });
      return;
    }
    res.json({ ok: true, promptCount: pack.prompts.length, categories: pack.categories });
  } catch (e) {
    res.status(400).json({ ok: false, error: "Invalid prompt pack" });
  }
});

// JSON packs only — do not expose markdown docs from the prompts folder.
app.use(
  "/prompts",
  express.static(path.resolve(__dirname, "../prompts"), {
    extensions: ["json"],
    index: false,
    setHeaders(res) {
      res.setHeader("Cache-Control", "public, max-age=300");
    },
  })
);

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: (origin, cb) => {
      cb(null, isAllowedOrigin(origin) ? origin || true : false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"],
  allowUpgrades: true,
  pingInterval: 25000,
  pingTimeout: 60000,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
  maxHttpBufferSize: LIMITS.maxSocketBufferBytes,
});

registerSocketHandlers(io);

server.listen(PORT, "0.0.0.0", () => {
  const summary = promptEngine.getSummary();
  console.log(`♠ Truth or Dare server listening on :${PORT}`);
  console.log(
    `  Allowed origins: ${ALLOWED_ORIGINS.join(", ")}${IS_PRODUCTION ? "" : " (+ any local network address)"}`
  );
  console.log(`  Prompts loaded: ${summary.promptCount} (${summary.remoteFriendlyCount} remote-friendly)`);
});

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, closing server`);
  try {
    for (const [, socket] of io.sockets.sockets) {
      socket.emit("room:destroyed", "shutdown");
    }
  } catch {
    /* ignore */
  }
  roomManager.destroy();
  io.close(() => {
    server.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection", reason instanceof Error ? reason.message : reason);
});
process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err.message);
  shutdown("uncaughtException");
});
