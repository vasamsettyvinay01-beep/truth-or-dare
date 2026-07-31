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
    <div className="flex flex-wrap gap-2">
      {AVATAR_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Color ${c}`}
          onClick={() => onChange(c)}
          className={cn(
            "h-8 w-8 rounded-full transition ring-offset-2 ring-offset-ink",
            value === c ? "ring-2 ring-white scale-110" : "opacity-70 hover:opacity-100"
          )}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
