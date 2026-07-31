"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pin, Send } from "lucide-react";
import type { ChatMessage } from "@tod/shared";
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
  const endRef = useRef<HTMLDivElement>(null);
  const pinned = useMemo(() => messages.filter((m) => m.pinned), [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
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
      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto px-4 py-3">
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
                <span className="text-xs font-semibold" style={{ color: m.color }}>
                  {m.nickname}
                </span>
                {isHost && (
                  <button
                    type="button"
                    className="opacity-0 transition group-hover:opacity-100"
                    onClick={() => onPin(m.id)}
                    title="Pin"
                  >
                    <Pin className="h-3 w-3 text-muted" />
                  </button>
                )}
              </div>
            )}
            <p className={cn(m.type === "reaction" ? "" : "text-cream/90")}>{m.text}</p>
          </motion.div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={disabled ? "Chat disabled" : "Say something…"}
          className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm outline-none focus:border-[color:var(--color-accent)]/40"
        />
        <Button type="submit" size="md" disabled={disabled || !text.trim()} className="px-4">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
