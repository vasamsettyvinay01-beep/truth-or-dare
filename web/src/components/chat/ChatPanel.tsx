"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pin, Send } from "lucide-react";
import { sanitizeAvatarColor, type ChatMessage } from "@tod/shared";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

export function ChatPanel({
  messages,
  onSend,
  onPin,
  isHost,
  disabled,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onPin: (id: string) => void;
  isHost?: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const pinned = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  const scrollToEnd = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    // Scroll the message list itself. scrollIntoView would drag the whole page
    // on mobile and push the composer under the keyboard.
    list.scrollTop = list.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages.length, scrollToEnd]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText("");
    requestAnimationFrame(scrollToEnd);
  };

  return (
    <div className="glass flex h-full min-h-[320px] flex-col rounded-3xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="font-display text-sm tracking-wide">Room Chat</h3>
        {pinned.length > 0 && (
          <div className="mt-2 space-y-1">
            {pinned.map((m) => (
              <div key={m.id} className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                📌 {m.nickname}: {m.text}
              </div>
            ))}
          </div>
        )}
      </div>
      <div
        ref={listRef}
        className="scrollbar-thin flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
        role="log"
        aria-live="polite"
        aria-label="Room chat messages"
      >
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "group rounded-2xl px-3 py-2 text-sm",
              m.type === "system" && "bg-white/5 text-muted",
              m.type === "reaction" && "bg-transparent text-center text-2xl",
              m.type === "chat" && "bg-white/[0.03]"
            )}
          >
            {m.type === "chat" && (
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span
                  className="text-xs font-semibold"
                  style={{ color: sanitizeAvatarColor(m.color) }}
                >
                  {m.nickname}
                </span>
                {isHost && (
                  <button
                    type="button"
                    // Visible by default: touch devices have no hover state.
                    className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-50 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    onClick={() => onPin(m.id)}
                    aria-label={m.pinned ? "Unpin message" : "Pin message"}
                  >
                    <Pin className="h-3.5 w-3.5 text-muted" aria-hidden />
                  </button>
                )}
              </div>
            )}
            <p className={cn(m.type === "reaction" ? "" : "text-cream/90")}>{m.text}</p>
          </motion.div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Chat message
        </label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          maxLength={280}
          autoComplete="off"
          enterKeyHint="send"
          placeholder={disabled ? "Chat disabled" : "Say something…"}
          // 16px prevents iOS Safari from zooming the page on focus.
          className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-base outline-none focus:border-[color:var(--color-accent)]/40"
        />
        <Button
          type="submit"
          size="md"
          disabled={disabled || !text.trim()}
          className="shrink-0 px-4"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </div>
  );
}
