"use client";

import { AVATAR_COLORS } from "@tod/shared";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Avatar color">
      {AVATAR_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          // The swatch stays 32px but the hit area is a full 44px square.
          className="flex h-11 w-11 items-center justify-center rounded-full"
        >
          <span
            className={cn(
              "block h-8 w-8 rounded-full ring-offset-2 ring-offset-ink transition",
              value === c ? "scale-110 ring-2 ring-white" : "opacity-70"
            )}
            style={{ background: c }}
          />
        </button>
      ))}
    </div>
  );
}
