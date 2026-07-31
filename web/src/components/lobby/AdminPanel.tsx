"use client";

import { useMemo, useRef, useState } from "react";
import {
  GAME_LEVELS,
  GAME_MODES,
  type GameLevel,
  type GameMode,
  type PromptPack,
  type PromptRecord,
  type RoomSettings,
} from "@tod/shared";
import { Download, Search, Upload } from "lucide-react";
import { Button } from "../ui/Button";
import { cn, levelLabel } from "@/lib/utils";
import { useGameStore } from "@/store/game-store";

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
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "truth" | "dare">("all");
  const [filterDifficulty, setFilterDifficulty] = useState<GameLevel | "all">("all");
  const [remoteFilter, setRemoteFilter] = useState<"all" | "remote" | "local">("all");

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

  const setCategoryWeight = (cat: string, weight: number) => {
    onChange({
      categoryWeights: {
        ...(settings.categoryWeights || {}),
        [cat]: weight,
      },
    });
  };

  const filteredPrompts = useMemo(() => {
    const list = promptPack?.prompts || [];
    const q = search.trim().toLowerCase();
    return list
      .filter((p) => {
        if (filterType !== "all" && p.type !== filterType) return false;
        if (filterDifficulty !== "all" && p.difficulty !== filterDifficulty) return false;
        if (remoteFilter === "remote" && !p.remoteFriendly) return false;
        if (remoteFilter === "local" && p.remoteFriendly) return false;
        if (settings.enabledCategories.length && !settings.enabledCategories.includes(p.category)) {
          return false;
        }
        if (!q) return true;
        const blob = `${p.prompt} ${p.category} ${(p.tags || []).join(" ")} ${p.id}`.toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 40);
  }, [promptPack, search, filterType, filterDifficulty, remoteFilter, settings.enabledCategories]);

  const stats = useMemo(() => {
    const list = promptPack?.prompts || [];
    return {
      total: list.length,
      remote: list.filter((p) => p.remoteFriendly).length,
      truths: list.filter((p) => p.type === "truth").length,
      dares: list.filter((p) => p.type === "dare").length,
    };
  }, [promptPack]);

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
    const parsed = JSON.parse(text);
    const pack = Array.isArray(parsed)
      ? ({ id: "imported", name: file.name, version: "1.0.0", categories: [], prompts: parsed } as PromptPack)
      : (parsed as PromptPack);
    if (!pack.prompts?.length) throw new Error("Invalid pack");
    onImport(pack);
  };

  return (
    <div className="glass space-y-6 overflow-hidden rounded-3xl p-4 sm:p-5">
      <div>
        <h3 className="font-display text-lg">Host Controls</h3>
        <p className="text-sm text-muted">
          Tune the room, filter prompt packs, and keep the night remote-friendly.
        </p>
        {promptPack && (
          <p className="mt-2 text-xs text-muted">
            Catalog · {stats.total} prompts · {stats.remote} remote · {stats.truths} truths · {stats.dares}{" "}
            dares
          </p>
        )}
      </div>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Game mode</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GAME_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange({ gameMode: m.id as GameMode })}
              aria-pressed={settings.gameMode === m.id}
              className={cn(
                "min-h-[48px] rounded-2xl border px-3 py-3 text-left transition",
                settings.gameMode === m.id
                  ? "border-[color:var(--color-accent)]/50 bg-[color:var(--color-accent)]/10"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              )}
            >
              <p className="text-sm font-medium">
                {m.label}
                {m.experimental ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-amber-200/80">
                    Experimental
                  </span>
                ) : null}
              </p>
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
            className="h-11 w-full accent-[color:var(--color-accent)]"
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
            className="h-11 w-full accent-[color:var(--color-accent)]"
          />
          <span className="text-muted">
            {settings.timerSeconds === 0 ? "Off" : `${settings.timerSeconds}s`}
          </span>
        </label>
      </section>

      <section className="flex flex-wrap gap-2">
        {(
          [
            ["skippingEnabled", "Skipping"],
            ["chatEnabled", "Chat"],
            ["remoteOnly", "Remote-only dares"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={settings[key]}
            onClick={() => onChange({ [key]: !settings[key] })}
            className={cn(
              "inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs",
              settings[key] ? "bg-emerald-400/15 text-emerald-300" : "bg-white/5 text-muted"
            )}
          >
            {label}: {settings[key] ? "On" : "Off"}
          </button>
        ))}
        <button
          type="button"
          disabled
          title="WebRTC voice is not wired up yet"
          className="inline-flex min-h-[40px] cursor-not-allowed items-center rounded-full bg-white/5 px-3.5 text-xs text-muted opacity-60"
        >
          Voice: Coming soon
        </button>
        <button
          type="button"
          aria-pressed={settings.playerOrder === "random"}
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
                "inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs",
                settings.enabledLevels.includes(l.id) ? "text-ink" : "bg-white/5 text-muted"
              )}
              style={settings.enabledLevels.includes(l.id) ? { background: l.color } : undefined}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-[0.18em] text-muted">Categories</p>
          <div className="flex gap-1">
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center rounded-full px-3 text-[11px] text-muted sm:hover:text-cream"
              onClick={() => onChange({ enabledCategories: [...categories] })}
            >
              Enable all
            </button>
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center rounded-full px-3 text-[11px] text-muted sm:hover:text-cream"
              onClick={() => onChange({ enabledCategories: categories.slice(0, 1) })}
            >
              Minimum
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggleCategory(c)}
              className={cn(
                "inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs capitalize",
                settings.enabledCategories.includes(c)
                  ? "bg-[color:var(--color-accent-2)]/20 text-violet-200"
                  : "bg-white/5 text-muted"
              )}
            >
              {c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Category weights</p>
          <div className="grid max-h-40 gap-2 overflow-y-auto scrollbar-thin sm:grid-cols-2">
            {settings.enabledCategories.map((c) => (
              <label key={c} className="flex items-center gap-2 text-xs capitalize">
                <span className="w-28 truncate text-muted">{c.replace(/_/g, " ")}</span>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.25}
                  aria-label={`Weight for ${c.replace(/_/g, " ")}`}
                  value={settings.categoryWeights?.[c] ?? 1}
                  onChange={(e) => setCategoryWeight(c, Number(e.target.value))}
                  className="h-10 min-w-0 flex-1 accent-[color:var(--color-accent)]"
                />
                <span className="w-8 text-right text-muted">
                  {(settings.categoryWeights?.[c] ?? 1).toFixed(2).replace(/\.00$/, "")}
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Theme (saved for later)</p>
        <p className="text-xs text-muted">
          Themes are stored on the room but the UI palette is still fixed. Coming soon.
        </p>
      </section>

      <section className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Prompt browser</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <label htmlFor="prompt-search" className="sr-only">
            Search prompts
          </label>
          <input
            id="prompt-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts, tags, categories…"
            // text-base keeps iOS from zooming the page on focus.
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-4 text-base outline-none focus:border-[color:var(--color-accent)]/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "truth", "dare"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilterType(t)}
              className={cn(
                "inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs capitalize",
                filterType === t ? "bg-white text-ink" : "bg-white/5 text-muted"
              )}
            >
              {t}
            </button>
          ))}
          {(["all", "cool", "spicy", "extreme", "no_boundaries"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setFilterDifficulty(d)}
              className={cn(
                "inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs capitalize",
                filterDifficulty === d ? "bg-white/20 text-cream" : "bg-white/5 text-muted"
              )}
            >
              {d === "all" ? "all levels" : levelLabel(d)}
            </button>
          ))}
          {(["all", "remote", "local"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRemoteFilter(r)}
              className={cn(
                "inline-flex min-h-[40px] items-center rounded-full px-3.5 text-xs capitalize",
                remoteFilter === r ? "bg-emerald-400/20 text-emerald-200" : "bg-white/5 text-muted"
              )}
            >
              {r === "local" ? "in-person" : r}
            </button>
          ))}
        </div>
        <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-2 scrollbar-thin">
          {filteredPrompts.length === 0 && (
            <p className="p-3 text-center text-xs text-muted">No prompts match these filters.</p>
          )}
          {filteredPrompts.map((p: PromptRecord) => (
            <div key={p.id} className="rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
                <span>{p.type}</span>
                <span>·</span>
                <span>{levelLabel(p.difficulty)}</span>
                <span>·</span>
                <span className="capitalize">{p.category.replace(/_/g, " ")}</span>
                {p.remoteFriendly ? (
                  <span className="text-emerald-300">remote</span>
                ) : (
                  <span className="text-amber-300">in-person</span>
                )}
              </div>
              <p className="text-sm text-cream/90">{p.prompt}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={exportPack}>
          <Download className="h-4 w-4" /> Export JSON
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> Import pack
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
              useGameStore
                .getState()
                .setError("Could not read that pack. Expected a pack object or an array of prompts.");
            }
            e.target.value = "";
          }}
        />
      </section>
    </div>
  );
}
