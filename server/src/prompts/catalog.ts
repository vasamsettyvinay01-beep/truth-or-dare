import path from "path";
import fs from "fs";
import {
  normalizePromptRecord,
  slugCategory,
  type ChallengeType,
  type GameMode,
  type PromptDifficulty,
  type PromptPack,
  type PromptPackSummary,
  type PromptPickOptions,
  type PromptPickResult,
  type PromptQuery,
  type PromptRecord,
} from "@tod/shared";

const PHYSICAL_DARE_RE =
  /\b(kiss (their|someone'?s?|the) (hand|cheek|lips|forehead)|hold (someone'?s?|their) (hand|face|waist)|slow[- ]?dance|forehead[- ]to[- ]forehead|sit knee[- ]to[- ]knee|feed (someone|each other)|massage|remove (one |an )?accessory|clothes inside[- ]out|jumping jacks|rearrange your hair|touch(ed|ing)?\b.*\b(arm|face|hand)\b)/i;

/**
 * Indexed, weighted prompt catalog optimized for thousands of prompts.
 * Supports multi-pack loading, search/filter, and strict no-repeat picking.
 */
export class PromptCatalog {
  private byId = new Map<string, PromptRecord>();
  private byTypeDifficulty = new Map<string, Set<string>>();
  private byCategory = new Map<string, Set<string>>();
  private byTag = new Map<string, Set<string>>();
  private remoteIds = new Set<string>();
  private searchBlob = new Map<string, string>();
  private packMeta: PromptPack[] = [];

  clear() {
    this.byId.clear();
    this.byTypeDifficulty.clear();
    this.byCategory.clear();
    this.byTag.clear();
    this.remoteIds.clear();
    this.searchBlob.clear();
    this.packMeta = [];
  }

  get size() {
    return this.byId.size;
  }

  addPack(pack: PromptPack) {
    const normalized = normalizePack(pack);
    // Replace prompts with same pack id first
    for (const [id, p] of this.byId) {
      if (id.startsWith(`${normalized.id}:`) || p.id.startsWith(`${normalized.id}-`)) {
        this.removeId(id);
      }
    }
    this.packMeta = this.packMeta.filter((m) => m.id !== normalized.id);
    this.packMeta.push({
      ...normalized,
      prompts: [], // meta only in list; prompts live in indexes
    });

    for (const prompt of normalized.prompts) {
      this.upsert(prompt);
    }
  }

  /** Merge a room-scoped custom pack without wiping base packs */
  addOverlayPrompts(prompts: PromptRecord[]) {
    for (const p of prompts) this.upsert(p);
  }

  removeIds(ids: Iterable<string>) {
    for (const id of ids) this.removeId(id);
  }

  private upsert(prompt: PromptRecord) {
    if (this.byId.has(prompt.id)) this.removeId(prompt.id);
    this.byId.set(prompt.id, prompt);

    const tdKey = `${prompt.type}:${prompt.difficulty}`;
    if (!this.byTypeDifficulty.has(tdKey)) this.byTypeDifficulty.set(tdKey, new Set());
    this.byTypeDifficulty.get(tdKey)!.add(prompt.id);

    if (!this.byCategory.has(prompt.category)) this.byCategory.set(prompt.category, new Set());
    this.byCategory.get(prompt.category)!.add(prompt.id);

    for (const tag of prompt.tags) {
      const t = tag.toLowerCase();
      if (!this.byTag.has(t)) this.byTag.set(t, new Set());
      this.byTag.get(t)!.add(prompt.id);
    }

    if (prompt.remoteFriendly) this.remoteIds.add(prompt.id);

    this.searchBlob.set(
      prompt.id,
      `${prompt.id} ${prompt.category} ${prompt.prompt} ${prompt.tags.join(" ")} ${prompt.difficulty} ${prompt.type}`.toLowerCase()
    );
  }

  private removeId(id: string) {
    const existing = this.byId.get(id);
    if (!existing) return;
    this.byId.delete(id);
    this.remoteIds.delete(id);
    this.searchBlob.delete(id);

    this.byTypeDifficulty.get(`${existing.type}:${existing.difficulty}`)?.delete(id);
    this.byCategory.get(existing.category)?.delete(id);
    for (const tag of existing.tags) {
      this.byTag.get(tag.toLowerCase())?.delete(id);
    }
  }

  getById(id: string) {
    return this.byId.get(id);
  }

  getCategories(): string[] {
    return [...this.byCategory.keys()].sort();
  }

  getTags(): string[] {
    return [...this.byTag.keys()].sort();
  }

  toPack(id = "catalog", name = "Prompt Catalog"): PromptPack {
    const prompts = [...this.byId.values()];
    return {
      id,
      name,
      version: "1.0.0",
      description: "Merged in-memory prompt catalog",
      categories: this.getCategories(),
      prompts,
    };
  }

  summary(id = "catalog", name = "Prompt Catalog"): PromptPackSummary {
    const prompts = [...this.byId.values()];
    const difficulties = [...new Set(prompts.map((p) => p.difficulty))];
    return {
      id,
      name,
      version: "1.0.0",
      description: `${prompts.length} prompts loaded`,
      promptCount: prompts.length,
      categories: this.getCategories(),
      tags: this.getTags(),
      difficulties,
      remoteFriendlyCount: this.remoteIds.size,
    };
  }

  query(q: PromptQuery): { total: number; prompts: PromptRecord[] } {
    let ids = this.candidateIds(q);

    if (q.search?.trim()) {
      const needle = q.search.trim().toLowerCase();
      ids = ids.filter((id) => this.searchBlob.get(id)?.includes(needle));
    }

    const exclude = new Set(q.excludeIds || []);
    if (exclude.size) ids = ids.filter((id) => !exclude.has(id));

    const total = ids.length;
    const offset = Math.max(0, q.offset || 0);
    const limit = q.limit == null ? total : Math.max(0, q.limit);
    const slice = ids.slice(offset, offset + limit).map((id) => this.byId.get(id)!);
    return { total, prompts: slice };
  }

  pick(options: PromptPickOptions): PromptPickResult | null {
    const used = new Set(options.usedIds);
    const baseQuery: PromptQuery = {
      type: options.type,
      difficulties: [options.difficulty],
      categories: options.enabledCategories.length ? options.enabledCategories : undefined,
      remoteOnly: options.remoteOnly,
    };

    const generalIds = this.candidateIds(baseQuery);
    let ids = generalIds.filter((id) => this.matchesMode(this.byId.get(id)!, options.mode));

    // Couples/team tagging covers only a handful of prompts, so treat it as a
    // preference: once the tagged ones are used the turn falls back to the
    // general pool instead of dead-ending the game with NO_PROMPTS.
    const softMode = options.mode === "couples" || options.mode === "team_battle";

    let pool = ids.filter((id) => !used.has(id));
    if (!pool.length && softMode) {
      ids = generalIds;
      pool = generalIds.filter((id) => !used.has(id));
    }

    let repeated = false;

    if (!pool.length) {
      if (options.strictNoRepeat !== false) {
        return null;
      }
      pool = ids;
      repeated = true;
    }

    if (!pool.length) return null;

    const weighted = options.weighted !== false;
    const chosenId = weighted
      ? this.weightedChoice(pool, options.categoryWeights, options.difficultyWeight)
      : pool[Math.floor(Math.random() * pool.length)];

    const prompt = this.byId.get(chosenId);
    if (!prompt) return null;
    return { prompt, poolSize: pool.length, repeated };
  }

  private matchesMode(p: PromptRecord, mode?: GameMode) {
    if (!mode) return true;
    if (mode === "couples") return !!p.couples || p.tags.includes("couples");
    if (p.couples) return false;
    if (mode === "team_battle") return !!p.team || p.tags.includes("team") || !p.couples;
    return true;
  }

  private candidateIds(q: PromptQuery): string[] {
    let set: Set<string> | null = null;

    const intersect = (next: Set<string> | undefined) => {
      if (!next) {
        set = new Set();
        return;
      }
      if (!set) set = new Set(next);
      else {
        const out = new Set<string>();
        for (const id of set) if (next.has(id)) out.add(id);
        set = out;
      }
    };

    if (q.type && q.difficulties?.length) {
      const union = new Set<string>();
      for (const d of q.difficulties) {
        const part = this.byTypeDifficulty.get(`${q.type}:${d}`);
        if (part) for (const id of part) union.add(id);
      }
      intersect(union);
    } else if (q.type) {
      const union = new Set<string>();
      for (const [key, ids] of this.byTypeDifficulty) {
        if (key.startsWith(`${q.type}:`)) for (const id of ids) union.add(id);
      }
      intersect(union);
    } else if (q.difficulties?.length) {
      const union = new Set<string>();
      for (const d of q.difficulties) {
        for (const type of ["truth", "dare"] as ChallengeType[]) {
          const part = this.byTypeDifficulty.get(`${type}:${d}`);
          if (part) for (const id of part) union.add(id);
        }
      }
      intersect(union);
    }

    if (q.categories?.length) {
      const union = new Set<string>();
      for (const c of q.categories) {
        const part = this.byCategory.get(slugCategory(c)) || this.byCategory.get(c);
        if (part) for (const id of part) union.add(id);
      }
      intersect(union);
    }

    if (q.tags?.length) {
      const union = new Set<string>();
      for (const t of q.tags) {
        const part = this.byTag.get(t.toLowerCase());
        if (part) for (const id of part) union.add(id);
      }
      intersect(union);
    }

    if (q.remoteOnly) {
      intersect(this.remoteIds);
    }

    if (!set) set = new Set(this.byId.keys());

    // Mode-agnostic couples/team filters from query
    let ids = [...set];
    if (q.couples === true) ids = ids.filter((id) => this.byId.get(id)?.couples);
    if (q.couples === false) ids = ids.filter((id) => !this.byId.get(id)?.couples);
    if (q.team === true) ids = ids.filter((id) => this.byId.get(id)?.team);
    if (q.team === false) ids = ids.filter((id) => !this.byId.get(id)?.team);

    return ids;
  }

  private weightedChoice(
    ids: string[],
    categoryWeights?: Record<string, number>,
    difficultyBoost = 1
  ) {
    let total = 0;
    const weights: number[] = new Array(ids.length);
    for (let i = 0; i < ids.length; i++) {
      const p = this.byId.get(ids[i])!;
      const catW = categoryWeights?.[p.category] ?? 1;
      const w = Math.max(0.01, (p.weight ?? 1) * Math.max(0.01, catW) * Math.max(0.01, difficultyBoost));
      weights[i] = w;
      total += w;
    }
    let r = Math.random() * total;
    for (let i = 0; i < ids.length; i++) {
      r -= weights[i];
      if (r <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }
}

export function normalizePack(input: unknown): PromptPack {
  if (Array.isArray(input)) {
    const prompts = input.map((raw, i) => coerceRecord(raw, `imported-${i + 1}`));
    return {
      id: "imported-array",
      name: "Imported Prompts",
      version: "1.0.0",
      categories: [...new Set(prompts.map((p) => p.category))],
      prompts,
    };
  }

  const pack = input as Partial<PromptPack> & { prompts?: unknown[] };
  if (!pack?.prompts?.length) throw Object.assign(new Error("Invalid prompt pack"), { code: "INVALID_PACK" });

  const prompts = pack.prompts.map((raw, i) =>
    coerceRecord(raw, `${pack.id || "pack"}-${i + 1}`)
  );

  return {
    id: String(pack.id || "custom-pack"),
    name: String(pack.name || "Custom Pack"),
    version: String(pack.version || "1.0.0"),
    description: pack.description,
    author: pack.author,
    locale: pack.locale,
    categories: pack.categories?.length
      ? pack.categories.map(slugCategory)
      : [...new Set(prompts.map((p) => p.category))],
    prompts,
  };
}

function coerceRecord(raw: unknown, fallbackId: string): PromptRecord {
  const r = raw as Record<string, unknown>;
  const record = normalizePromptRecord(
    {
      id: typeof r.id === "string" ? r.id : undefined,
      type: r.type === "dare" ? "dare" : "truth",
      category: typeof r.category === "string" ? r.category : undefined,
      difficulty: String(r.difficulty || r.level || "cool"),
      level: typeof r.level === "string" ? r.level : undefined,
      prompt: String(r.prompt || r.text || ""),
      text: typeof r.text === "string" ? r.text : undefined,
      remoteFriendly: typeof r.remoteFriendly === "boolean" ? r.remoteFriendly : undefined,
      tags: Array.isArray(r.tags) ? r.tags.map(String) : undefined,
      weight: typeof r.weight === "number" ? r.weight : undefined,
      couples: r.couples === true,
      team: r.team === true,
    } as Parameters<typeof normalizePromptRecord>[0],
    fallbackId
  );

  if (!record.prompt) {
    throw Object.assign(new Error(`Prompt ${fallbackId} missing text`), { code: "INVALID_PROMPT" });
  }

  // Infer remoteFriendly for legacy dares when unset
  if (r.remoteFriendly == null && record.type === "dare" && PHYSICAL_DARE_RE.test(record.prompt)) {
    record.remoteFriendly = false;
  }

  if (!record.tags.length) {
    record.tags = inferTags(record);
  }

  return record;
}

function inferTags(p: PromptRecord): string[] {
  const tags = new Set<string>([p.difficulty, p.type, p.category]);
  if (p.remoteFriendly) tags.add("remote");
  else tags.add("in_person");

  const text = p.prompt.toLowerCase();
  if (/\b(flirt|chemistry|crush)\b/.test(text)) tags.add("flirty");
  if (/\b(confess|secret|admit)\b/.test(text)) tags.add("confession");
  if (/\b(embarrass|cringe|awkward)\b/.test(text)) tags.add("awkward");
  if (/\b(kiss|makeout|lips)\b/.test(text)) tags.add("kissing");
  if (/\b(ex|breakup)\b/.test(text)) tags.add("exes");
  if (/\b(jealous)\b/.test(text)) tags.add("jealousy");
  if (p.couples) tags.add("couples");
  if (p.team) tags.add("team");
  return [...tags];
}

export function loadPacksFromDir(dir: string): PromptPack[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const packs: PromptPack[] = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      packs.push(normalizePack(raw));
    } catch (e) {
      console.warn(`[prompts] skipped ${file}:`, (e as Error).message);
    }
  }
  return packs;
}

export type { PromptDifficulty };
