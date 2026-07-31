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

const LAST_ROOM_KEY = "tod:last-room";

export interface SessionData {
  playerId: string;
  reconnectToken: string;
  nickname: string;
  code: string;
  /** Epoch ms; entries older than SESSION_TTL_MS are treated as gone. */
  savedAt?: number;
}

/** Reconnect data is disposable. Anything older than this is discarded. */
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * sessionStorage keeps the reconnect token scoped to the tab and clears itself
 * when the browser session ends, so nothing about a player outlives the game.
 * Safari in private mode throws on access, hence the guards.
 */
function store(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveSession(data: SessionData) {
  const s = store();
  if (!s) return;
  try {
    s.setItem(storageKey(data.code), JSON.stringify({ ...data, savedAt: Date.now() }));
    s.setItem(LAST_ROOM_KEY, data.code);
  } catch {
    /* quota or private mode — reconnect simply won't be available */
  }
}

export function loadSession(code?: string): SessionData | null {
  const s = store();
  if (!s) return null;
  try {
    const c = code || s.getItem(LAST_ROOM_KEY);
    if (!c) return null;
    const raw = s.getItem(storageKey(c));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionData;
    if (!parsed?.reconnectToken || !parsed?.code) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > SESSION_TTL_MS) {
      clearSession(parsed.code);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(code: string) {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(storageKey(code));
    if (s.getItem(LAST_ROOM_KEY)?.toUpperCase() === code.toUpperCase()) {
      s.removeItem(LAST_ROOM_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Drops every trace of play from this tab. Used when a room is destroyed. */
export function clearAllSessions() {
  const s = store();
  if (!s) return;
  try {
    for (const key of Object.keys(s)) {
      if (key.startsWith("tod:")) s.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

export function levelLabel(level: string) {
  return level.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * navigator.clipboard is unavailable on insecure origins and in some in-app
 * browsers, where it rejects silently. Fall back to a hidden textarea so the
 * invite link can always be copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Web Share works better than clipboard inside iOS/Android in-app browsers. */
export async function shareOrCopy(text: string, title = "Join my Truth or Dare room") {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, text: title, url: text });
      return "shared" as const;
    }
  } catch (err) {
    // AbortError = user dismissed the sheet; not a failure worth reporting.
    if (err instanceof Error && err.name === "AbortError") return "cancelled" as const;
  }
  return (await copyText(text)) ? ("copied" as const) : ("failed" as const);
}
