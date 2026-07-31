"use client";

import { AVATAR_COLORS, type Player } from "@tod/shared";
import { cn } from "@/lib/utils";
import { Crown, WifiOff } from "lucide-react";

function safeColor(color: string) {
  return (AVATAR_COLORS as readonly string[]).includes(color) ? color : AVATAR_COLORS[0];
}

export function Avatar({
  player,
  size = "md",
  showHost,
}: {
  player: Pick<Player, "nickname" | "color" | "isHost" | "isConnected" | "eliminated">;
  size?: "sm" | "md" | "lg";
  showHost?: boolean;
}) {
  const sizes = { sm: "h-8 w-8 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-xl" };
  const color = safeColor(player.color);
  return (
    <div className="relative">
      <div
        className={cn(
          "flex items-center justify-center rounded-full font-display font-bold text-ink shadow-[0_0_24px_rgba(0,0,0,0.35)]",
          sizes[size],
          player.eliminated && "opacity-40 grayscale",
          !player.isConnected && "opacity-50"
        )}
        style={{
          background: `linear-gradient(145deg, ${color}, color-mix(in oklab, ${color} 55%, black))`,
        }}
      >
        {player.nickname.slice(0, 2).toUpperCase()}
      </div>
      {showHost && player.isHost && (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 p-0.5 text-ink">
          <Crown className="h-3 w-3" />
        </span>
      )}
      {!player.isConnected && (
        <span className="absolute -bottom-1 -right-1 rounded-full bg-ink p-0.5 text-muted">
          <WifiOff className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}
