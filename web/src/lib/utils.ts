import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inviteUrl(code: string) {
  if (typeof window === "undefined") return `/join?code=${code}`;
  return `${window.location.origin}/join?code=${code}`;
}

export function storageKey(code: string) {
  return `tod:session:${code.toUpperCase()}`;
}

export interface SessionData {
  playerId: string;
  reconnectToken: string;
  nickname: string;
  code: string;
}

export function saveSession(data: SessionData) {
  try {
    localStorage.setItem(storageKey(data.code), JSON.stringify(data));
    localStorage.setItem("tod:last-room", data.code);
  } catch {
    /* ignore */
  }
}

export function loadSession(code?: string): SessionData | null {
  try {
    const c = code || localStorage.getItem("tod:last-room");
    if (!c) return null;
    const raw = localStorage.getItem(storageKey(c));
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  try {
    localStorage.removeItem(storageKey(code));
  } catch {
    /* ignore */
  }
}

export function levelLabel(level: string) {
  return level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
