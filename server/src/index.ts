import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@tod/shared";
import { promptEngine } from "./prompts/engine";
import { registerSocketHandlers } from "./socket/handlers";

const PORT = Number(process.env.PORT || 4001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "truth-or-dare", ts: Date.now() });
});

app.get("/api/prompts", (_req, res) => {
  res.json(promptEngine.getPack());
});

app.get("/api/prompts/export", (_req, res) => {
  const pack = promptEngine.getPack();
  res.setHeader("Content-Disposition", `attachment; filename="${pack.id}.json"`);
  res.json(pack);
});

// Serve raw prompt files for inspection / download
app.use("/prompts", express.static(path.resolve(__dirname, "../prompts")));

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  transports: ["websocket", "polling"],
});

registerSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`♠ Truth or Dare server listening on :${PORT}`);
  console.log(`  Client origin: ${CLIENT_ORIGIN}`);
});
