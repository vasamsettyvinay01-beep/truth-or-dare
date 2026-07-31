"use client";

import { useRef } from "react";
import {
  GAME_LEVELS,
  GAME_MODES,
  type GameLevel,
  type GameMode,
  type PromptPack,
  type RoomSettings,
} from "@tod/shared";
import { Download, Upload } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "@/lib/utils";

export function AdminPanel({
  settings,
  categories,
  promptPack,
  onChange,
  onImport,
}: {
  settings: RoomSettings;
  categories: string[];
  promptPack: PromptPack | null;
  onChange: (partial: Partial<RoomSettings>) => void;
  onImport: (pack: PromptPack) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleCategory = (cat: string) => {
    const set = new Set(settings.enabledCategories);
    if (set.has(cat)) set.delete(cat);
    else set.add(cat);
    onChange({ enabledCategories: [...set] });
  };

  const toggleLevel = (level: GameLevel) => {
    const set = new Set(settings.enabledLevels);
    if (set.has(level)) {
      if (set.size === 1) return;
      set.delete(level);
    } else set.add(level);
    onChange({ enabledLevels: [...set] });
  };

  const exportPack = () => {
    if (!promptPack) return;
    const blob = new Blob([JSON.stringify(promptPack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${promptPack.id || "prompt-pack"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const pack = JSON.parse(text) as PromptPack;
    if (!pack.prompts?.length) throw new Error("Invalid pack");
    onImport(pack);
  };

  return (
    <div className="glass space-y-6 rounded-3xl p-5">
      <div>
        <h3 className="font-display text-lg">Host Controls</h3>
        <p className="text-sm text-muted">Tune the room before you start.</p>
      </div>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Game mode</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GAME_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ gameMode: m.id as GameMode })}
              className={cn(
                "rounded-2xl border px-3 py-3 text-left transition",
                settings.gameMode === m.id
                  ? "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              )}
            >
              <p className="text-sm font-medium">{m.label}</p>
              <p className="mt-1 text-xs text-muted">{m.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted">Max players</span>
          <input
            type="range"
            min={2}
            max={20}
            value={settings.maxPlayers}
            onChange={(e) => onChange({ maxPlayers: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-muted">{settings.maxPlayers}</span>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted">Timer (sec)</span>
          <input
            type="range"
            min={0}
            max={180}
            step={5}
            value={settings.timerSeconds}
            onChange={(e) => onChange({ timerSeconds: Number(e.target.value) })}
            className="w-full"
          />
          <span className="text-muted">{settings.timerSeconds === 0 ? "Off" : `${settings.timerSeconds}s`}</span>
        </label>
      </section>

      <section className="flex flex-wrap gap-2">
        {(
          [
            ["skippingEnabled", "Skipping"],
            ["chatEnabled", "Chat"],
            ["voiceEnabled", "Voice"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ [key]: !settings[key] })}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs",
              settings[key] ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-muted"
            )}
          >
            {label}: {settings[key] ? "On" : "Off"}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({ playerOrder: settings.playerOrder === "random" ? "sequential" : "random" })
          }
          className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted"
        >
          Order: {settings.playerOrder}
        </button>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Levels</p>
        <div className="flex flex-wrap gap-2">
          {GAME_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => toggleLevel(l.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs",
                settings.enabledLevels.includes(l.id) ? "text-ink" : "bg-white/5 text-muted"
              )}
              style={
                settings.enabledLevels.includes(l.id)
                  ? { background: l.color }
                  : undefined
              }
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Categories</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs capitalize",
                settings.enabledCategories.includes(c)
                  ? "bg-[color:var(--color-accent-2)]/20 text-violet-200"
                  : "bg-white/5 text-muted"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Theme</p>
        <div className="flex flex-wrap gap-2">
          {(["midnight", "neon", "ember", "aurora"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ theme: t })}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs capitalize",
                settings.theme === t ? "bg-white text-ink" : "bg-white/5 text-muted"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={exportPack}>
          <Download className="h-4 w-4" /> Export prompts
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Import JSON
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              await importFile(file);
            } catch {
              alert("Could not import prompt pack");
            }
            e.target.value = "";
          }}
        />
      </section>
    </div>
  );
}
