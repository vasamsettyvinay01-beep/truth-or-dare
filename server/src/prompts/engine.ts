import path from "path";
import fs from "fs";
import type { ChallengeType, GameLevel, GameMode, PromptItem, PromptPack } from "@tod/shared";

const PROMPTS_DIR = path.resolve(__dirname, "../../prompts");

export class PromptEngine {
  private pack: PromptPack;
  private customPacks: Map<string, PromptPack> = new Map();

  constructor() {
    this.pack = this.loadCorePack();
  }

  private loadCorePack(): PromptPack {
    const file = path.join(PROMPTS_DIR, "core-pack.json");
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as PromptPack;
  }

  getPack(): PromptPack {
    return this.mergePacks();
  }

  getCategories(): string[] {
    return [...new Set(this.getPack().prompts.map((p) => p.category))].sort();
  }

  importPack(pack: PromptPack, roomId: string): PromptPack {
    if (!pack?.prompts?.length) {
      throw new Error("Invalid prompt pack");
    }
    const normalized: PromptPack = {
      id: pack.id || `custom-${roomId}`,
      name: pack.name || "Custom Pack",
      version: pack.version || "1.0.0",
      description: pack.description,
      categories: pack.categories?.length
        ? pack.categories
        : [...new Set(pack.prompts.map((p) => p.category))],
      prompts: pack.prompts.map((p, i) => ({
        ...p,
        id: p.id || `custom-${roomId}-${i}`,
      })),
    };
    this.customPacks.set(roomId, normalized);
    return this.mergePacks(roomId);
  }

  clearRoomPack(roomId: string) {
    this.customPacks.delete(roomId);
  }

  private mergePacks(roomId?: string): PromptPack {
    const custom = roomId ? this.customPacks.get(roomId) : undefined;
    if (!custom) return this.pack;
    return {
      id: "merged",
      name: `${this.pack.name} + ${custom.name}`,
      version: "merged",
      categories: [...new Set([...this.pack.categories, ...custom.categories])],
      prompts: [...this.pack.prompts, ...custom.prompts],
    };
  }

  pickPrompt(options: {
    roomId: string;
    type: ChallengeType;
    level: GameLevel;
    mode: GameMode;
    enabledCategories: string[];
    usedIds: Set<string>;
  }): PromptItem | null {
    const pack = this.mergePacks(options.roomId);
    let pool = pack.prompts.filter((p) => {
      if (p.type !== options.type) return false;
      if (p.level !== options.level) return false;
      if (options.enabledCategories.length && !options.enabledCategories.includes(p.category)) {
        return false;
      }
      if (options.usedIds.has(p.id)) return false;
      if (options.mode === "couples" && !p.couples) return false;
      if (options.mode === "team_battle" && p.couples) return false;
      if (options.mode !== "couples" && p.couples) return false;
      return true;
    });

    // Soft fallback: ignore used ids if pool empty
    if (!pool.length) {
      pool = pack.prompts.filter((p) => {
        if (p.type !== options.type) return false;
        if (p.level !== options.level) return false;
        if (options.enabledCategories.length && !options.enabledCategories.includes(p.category)) {
          return false;
        }
        if (options.mode === "couples" && !p.couples) return false;
        if (options.mode !== "couples" && p.couples) return false;
        return true;
      });
    }

    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export const promptEngine = new PromptEngine();
