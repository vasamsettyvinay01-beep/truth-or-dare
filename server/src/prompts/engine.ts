import path from "path";
import {
  type GameMode,
  type PromptPack,
  type PromptPackSummary,
  type PromptPickResult,
  type PromptQuery,
  type PromptRecord,
} from "@tod/shared";
import { loadPacksFromDir, normalizePack, PromptCatalog } from "./catalog";

const PROMPTS_DIR = path.resolve(__dirname, "../../prompts");

/**
 * Professional prompt engine for large multiplayer packs.
 * - Loads every JSON pack from server/prompts
 * - Indexed search / filter / weighted pick
 * - Room overlays for imported community packs
 * - Strict no-repeat during a session (configurable)
 */
export class PromptEngine {
  private catalog = new PromptCatalog();
  private roomOverlays = new Map<string, PromptRecord[]>();
  private roomCatalogs = new Map<string, PromptCatalog>();

  constructor(dir = PROMPTS_DIR) {
    this.reloadFromDisk(dir);
  }

  reloadFromDisk(dir = PROMPTS_DIR) {
    this.catalog.clear();
    const packs = loadPacksFromDir(dir);
    if (!packs.length) {
      console.warn(`[prompts] no packs found in ${dir}`);
    }
    for (const pack of packs) {
      this.catalog.addPack(pack);
      console.log(`[prompts] loaded ${pack.id}: ${pack.prompts.length} prompts`);
    }
    this.roomCatalogs.clear();
  }

  private catalogFor(roomId?: string): PromptCatalog {
    if (!roomId) return this.catalog;
    const overlay = this.roomOverlays.get(roomId);
    if (!overlay?.length) return this.catalog;

    let cached = this.roomCatalogs.get(roomId);
    if (!cached) {
      cached = new PromptCatalog();
      // Clone base by re-adding pack snapshot
      cached.addPack(this.catalog.toPack("base", "Base"));
      cached.addOverlayPrompts(overlay);
      this.roomCatalogs.set(roomId, cached);
    }
    return cached;
  }

  getPack(roomId?: string): PromptPack {
    return this.catalogFor(roomId).toPack(
      roomId ? `room-${roomId}` : "catalog",
      roomId ? "Room Prompt Pack" : "Truth or Dare Catalog"
    );
  }

  getSummary(roomId?: string): PromptPackSummary {
    return this.catalogFor(roomId).summary();
  }

  getCategories(roomId?: string): string[] {
    return this.catalogFor(roomId).getCategories();
  }

  query(query: PromptQuery, roomId?: string) {
    const cat = this.catalogFor(roomId);
    const result = cat.query(query);
    return {
      ...result,
      summary: cat.summary(),
    };
  }

  importPack(input: unknown, roomId: string): PromptPack {
    const pack = normalizePack(input);
    const existing = this.roomOverlays.get(roomId) || [];
    // Dedupe by id — imports replace same ids
    const byId = new Map(existing.map((p) => [p.id, p]));
    for (const p of pack.prompts) byId.set(p.id, p);
    this.roomOverlays.set(roomId, [...byId.values()]);
    this.roomCatalogs.delete(roomId);
    return this.getPack(roomId);
  }

  replaceRoomPack(input: unknown, roomId: string): PromptPack {
    const pack = normalizePack(input);
    this.roomOverlays.set(roomId, pack.prompts);
    this.roomCatalogs.delete(roomId);
    return this.getPack(roomId);
  }

  clearRoomPack(roomId: string) {
    this.roomOverlays.delete(roomId);
    this.roomCatalogs.delete(roomId);
  }

  pickPrompt(options: {
    roomId: string;
    type: PromptRecord["type"];
    level: PromptRecord["difficulty"];
    mode: GameMode;
    enabledCategories: string[];
    usedIds: Set<string>;
    remoteOnly?: boolean;
    categoryWeights?: Record<string, number>;
    strictNoRepeat?: boolean;
  }): PromptPickResult | null {
    return this.catalogFor(options.roomId).pick({
      type: options.type,
      difficulty: options.level,
      enabledCategories: options.enabledCategories,
      usedIds: options.usedIds,
      remoteOnly: options.remoteOnly,
      mode: options.mode,
      categoryWeights: options.categoryWeights,
      strictNoRepeat: options.strictNoRepeat ?? true,
      weighted: true,
    });
  }

  /** Convenience: pick or throw */
  mustPick(options: Parameters<PromptEngine["pickPrompt"]>[0]): PromptRecord {
    const result = this.pickPrompt(options);
    if (!result) {
      throw Object.assign(
        new Error(
          options.strictNoRepeat !== false
            ? "No unused prompts left for this filter — enable more categories or reuse is disabled"
            : "No prompts available for this filter"
        ),
        { code: "NO_PROMPTS" }
      );
    }
    return result.prompt;
  }
}

export const promptEngine = new PromptEngine();
