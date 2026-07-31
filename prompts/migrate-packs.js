/**
 * Migrates legacy prompt JSON into the canonical PromptRecord schema
 * and rewrites packs under server/prompts + prompts/.
 */
const fs = require("fs");
const path = require("path");

const PHYSICAL_RE =
  /\b(kiss (their|someone'?s?|the) (hand|cheek|lips|forehead)|hold (someone'?s?|their) (hand|face|waist)|slow[- ]?dance|forehead[- ]to[- ]forehead|sit knee[- ]to[- ]knee|feed (someone|each other)|massage|remove (one |an )?accessory|clothes inside[- ]out|jumping jacks|rearrange your hair|press your forehead|kiss their hand|on the cheek if they consent|hand and lean in)\b/i;

function slug(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function difficulty(v) {
  const x = slug(v);
  if (["cool", "spicy", "extreme", "no_boundaries"].includes(x)) return x;
  return "cool";
}

function inferTags(rec) {
  const tags = new Set([rec.difficulty, rec.type, rec.category]);
  tags.add(rec.remoteFriendly ? "remote" : "in_person");
  const t = rec.prompt.toLowerCase();
  if (/\b(flirt|chemistry|crush)\b/.test(t)) tags.add("flirty");
  if (/\b(confess|secret|admit)\b/.test(t)) tags.add("confession");
  if (/\b(embarrass|cringe|awkward)\b/.test(t)) tags.add("awkward");
  if (/\b(kiss|makeout|lips)\b/.test(t)) tags.add("kissing");
  if (/\b(jealous)\b/.test(t)) tags.add("jealousy");
  if (/\b(ex|breakup)\b/.test(t)) tags.add("exes");
  if (/\b(party)\b/.test(t)) tags.add("party");
  if (/\b(roleplay|act out|mime)\b/.test(t)) tags.add("roleplay");
  if (/\b(compliment|toast)\b/.test(t)) tags.add("social");
  if (rec.couples) tags.add("couples");
  if (rec.team) tags.add("team");
  return [...tags];
}

function toRecord(raw, fallbackId) {
  const prompt = String(raw.prompt ?? raw.text ?? "").trim();
  const type = raw.type === "dare" ? "dare" : "truth";
  let remoteFriendly =
    typeof raw.remoteFriendly === "boolean" ? raw.remoteFriendly : type === "truth" ? true : !PHYSICAL_RE.test(prompt);

  // Truths are always remote-friendly for video chat
  if (type === "truth") remoteFriendly = true;

  const rec = {
    id: String(raw.id || fallbackId),
    type,
    category: slug(raw.category || "party"),
    difficulty: difficulty(raw.difficulty || raw.level || "cool"),
    prompt,
    remoteFriendly,
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags.map(String) : [],
    weight: typeof raw.weight === "number" && raw.weight > 0 ? raw.weight : 1,
  };
  if (raw.couples) rec.couples = true;
  if (raw.team) rec.team = true;
  if (!rec.tags.length) rec.tags = inferTags(rec);
  return rec;
}

function migrateFile(inputPath, outPath, meta) {
  const raw = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  let promptsRaw;
  let baseMeta = { ...meta };

  if (Array.isArray(raw)) {
    promptsRaw = raw;
  } else {
    promptsRaw = raw.prompts || [];
    baseMeta = {
      id: raw.id || meta.id,
      name: raw.name || meta.name,
      version: raw.version || meta.version || "1.0.0",
      description: raw.description || meta.description,
      author: raw.author || meta.author,
      locale: raw.locale || "en",
    };
  }

  const prompts = promptsRaw.map((p, i) => toRecord(p, `${baseMeta.id}-${i + 1}`));
  const pack = {
    ...baseMeta,
    categories: [...new Set(prompts.map((p) => p.category))].sort(),
    prompts,
  };

  fs.writeFileSync(outPath, JSON.stringify(pack, null, 2));
  const remote = prompts.filter((p) => p.remoteFriendly).length;
  console.log(
    `Migrated ${path.basename(outPath)}: ${prompts.length} prompts (${remote} remote-friendly)`
  );
  return pack;
}

const root = path.resolve(__dirname, "..");
const serverPrompts = path.join(root, "server", "prompts");

migrateFile(
  path.join(serverPrompts, "core-pack.json"),
  path.join(serverPrompts, "core-pack.json"),
  {
    id: "core-pack",
    name: "Core Pack",
    version: "2.0.0",
    description: "Default Truth or Dare prompts across all levels (remote-first).",
    author: "Truth or Dare",
  }
);

const adultSrcCandidates = [
  path.join(root, "prompts", "adult-romance-pack.json"),
  path.join(serverPrompts, "adult-romance-pack.json"),
];
const adultSrc = adultSrcCandidates.find((p) => fs.existsSync(p));
if (adultSrc) {
  const pack = migrateFile(adultSrc, path.join(serverPrompts, "adult-romance-pack.json"), {
    id: "adult-romance-pack",
    name: "Adult Romance Pack",
    version: "2.0.0",
    description:
      "1080 original 18+ prompts focused on romance, flirting, chemistry, and emotional intimacy. Optimized for remote play.",
    author: "Truth or Dare",
  });
  // Also write canonical flat+pack to prompts/
  fs.writeFileSync(
    path.join(root, "prompts", "adult-romance-pack.json"),
    JSON.stringify(pack, null, 2)
  );
}

console.log("Done.");
