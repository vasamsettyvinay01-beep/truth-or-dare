"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@tod/shared";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/** Thrown-free description of why the realtime server is unreachable. */
export type SocketUrlResolution =
  | { ok: true; url: string }
  | { ok: false; reason: string };

const RAW_URL = (process.env.NEXT_PUBLIC_SOCKET_URL || "").trim();

const DEFAULT_SERVER_PORT = "4001";

/** Hosts that only ever mean "the device running this browser". */
function isLoopbackHost(hostname: string) {
  return /^(localhost|127(?:\.\d+){1,3}|\[::1\]|::1|0\.0\.0\.0)$/i.test(hostname);
}

/**
 * Resolves the realtime server origin.
 *
 * Rules that keep mobile browsers working:
 * - A relative value ("" or "/") means "same origin as the page", which is what
 *   a reverse-proxy deployment uses.
 * - A loopback host is only reachable from the machine running the server. When
 *   the page itself arrived over the network — a phone opening the LAN address
 *   of a dev machine — localhost would point the phone at itself, so we reuse
 *   the host the page came from and keep the configured port.
 * - An https page may never talk to an http socket: iOS Safari and Android
 *   Chrome block that as mixed content, so we upgrade the scheme instead.
 */
export function resolveSocketUrl(): SocketUrlResolution {
  if (typeof window === "undefined") {
    return { ok: true, url: /^https?:\/\//i.test(RAW_URL) ? RAW_URL.replace(/\/+$/, "") : "" };
  }

  const page = window.location;
  const pageIsSecure = page.protocol === "https:";
  const pageIsLoopback = isLoopbackHost(page.hostname);

  if (!RAW_URL || RAW_URL === "/") {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, url: `${page.protocol}//${page.hostname}:${DEFAULT_SERVER_PORT}` };
    }
    // Static hosts cannot keep a Socket.IO connection alive. Without an
    // explicit API URL the client would hammer the page origin forever and
    // show a permanent "reconnecting" banner — especially visible on phones.
    if (/\.(vercel\.app|netlify\.app|pages\.dev)$/i.test(page.hostname)) {
      return {
        ok: false,
        reason:
          "The game server isn't configured for this deploy. Set NEXT_PUBLIC_SOCKET_URL to the public https URL of the realtime API and redeploy.",
      };
    }
    // Same-origin: valid when the socket server sits behind the same domain.
    return { ok: true, url: page.origin };
  }

  const trimmed = RAW_URL.replace(/\/+$/, "");

  if (trimmed.startsWith("/")) {
    return { ok: true, url: `${page.origin}${trimmed}` };
  }

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `${page.protocol}//${trimmed}`);
  } catch {
    return {
      ok: false,
      reason: `NEXT_PUBLIC_SOCKET_URL is not a valid URL: "${RAW_URL}".`,
    };
  }

  if (isLoopbackHost(target.hostname) && !pageIsLoopback) {
    if (pageIsSecure) {
      return {
        ok: false,
        reason:
          "The game server is configured as localhost, which phones cannot reach. Set NEXT_PUBLIC_SOCKET_URL to the public https URL of the server.",
      };
    }
    target.hostname = page.hostname;
  }

  if (pageIsSecure && target.protocol === "http:") {
    // Avoid a mixed-content block by upgrading to TLS.
    target.protocol = "https:";
  }

  const path = target.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${target.origin}${path}` };
}

export function getSocketUrl(): string {
  const resolved = resolveSocketUrl();
  return resolved.ok ? resolved.url : "";
}

export function getSocket(): AppSocket {
  if (typeof window === "undefined") {
    throw new Error("Socket is client-only");
  }

  if (!socket) {
    const resolved = resolveSocketUrl();
    const url = resolved.ok ? resolved.url : window.location.origin;

    socket = io(url, {
      autoConnect: false,
      // Polling first, then upgrade. Mobile carriers and captive proxies often
      // block a cold WebSocket handshake, and websocket-only leaves the player
      // stuck on "Connecting…" with no fallback.
      transports: ["polling", "websocket"],
      upgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 15000,
    });
  }

  return socket;
}

export function connectSocket(): AppSocket {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect();
}
