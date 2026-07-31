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

/**
 * Resolves the realtime server origin.
 *
 * Rules that keep mobile browsers working:
 * - A relative value ("" or "/") means "same origin as the page", which is what
 *   a reverse-proxy deployment uses.
 * - An https page may never talk to an http socket: iOS Safari and Android
 *   Chrome block that as mixed content, so we upgrade the scheme instead.
 * - Falling back to localhost is only valid while developing on this machine.
 *   In production it would point every phone at itself, so we refuse it.
 */
export function resolveSocketUrl(): SocketUrlResolution {
  const isBrowser = typeof window !== "undefined";
  const pageIsSecure = isBrowser && window.location.protocol === "https:";

  if (!RAW_URL || RAW_URL === "/") {
    if (!isBrowser) return { ok: true, url: "" };
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, url: "http://localhost:4001" };
    }
    // Same-origin: valid when the socket server sits behind the same domain.
    return { ok: true, url: window.location.origin };
  }

  let url = RAW_URL.replace(/\/+$/, "");

  if (url.startsWith("/")) {
    return { ok: true, url: isBrowser ? `${window.location.origin}${url}` : url };
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `${pageIsSecure ? "https" : "http"}://${url}`;
  }

  if (pageIsSecure && url.startsWith("http://")) {
    const host = url.slice("http://".length);
    if (/^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host)) {
      return {
        ok: false,
        reason:
          "The game server is configured as localhost, which phones cannot reach. Set NEXT_PUBLIC_SOCKET_URL to the public https URL of the server.",
      };
    }
    // Avoid a mixed-content block by upgrading to TLS.
    url = `https://${host}`;
  }

  return { ok: true, url };
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
