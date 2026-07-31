"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="flex w-full flex-col gap-2">
      {label && (
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
          {label}
        </span>
      )}
      <input
        id={inputId}
        className={cn(
          "h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-cream outline-none transition placeholder:text-white/25 focus:border-[color:var(--color-accent)]/50 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(255,77,109,0.12)]",
          className
        )}
        {...props}
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
