/**
 * Build the Long-Distance Chemistry pack (1000 remote-friendly prompts).
 * Usage: node prompts/generate-ld-chemistry.js
 */
const fs = require("fs");
const path = require("path");

const { BANK, DIFFICULTIES, TYPES, PER_CELL } = require("./_ld_shared");
require("./_ld_bank_1");
require("./_ld_bank_2");
require("./_ld_bank_3");
require("./_ld_bank_4");

const CATEGORIES = [
  "romance",
  "flirting",
  "crushes",
  "kissing",
  "dating",
  "relationships",
  "first_impressions",
  "confessions",
  "secrets",
  "green_flags",
  "red_flags",
  "jealousy",
  "dream_dates",
  "future_together",
  "compliments",
  "embarrassing_stories",
  "party_stories",
  "favorites",
  "this_or_that",
  "would_you_rather",
  "roleplay",
  "voice_challenges",
  "camera_challenges",
  "emoji_challenges",
  "storytelling",
];

const PHYSICAL_RE =
  /\b(kiss (their|someone'?s?|the) (hand|cheek|lips|forehead)|hold (someone'?s?|their) (hand|face|waist)|slow[- ]?dance|sit (closer|knee)|feed (someone|each other)|massage|in the (same )?room|person (on your left|across from you|next to you))\b/i;

function uniqueCheck(prompts) {
  const seen = new Set();
  const dupes = [];
  for (const p of prompts) {
    const key = p.prompt.trim().toLowerCase();
    if (seen.has(key)) dupes.push(p.prompt);
    seen.add(key);
  }
  return dupes;
}

function build() {
  const out = [];
  const gaps = [];

  for (const category of CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      for (const type of TYPES) {
        const list = BANK[category]?.[difficulty]?.[type] || [];
        if (list.length < PER_CELL) {
          gaps.push(`${category}/${difficulty}/${type}: have ${list.length}, need ${PER_CELL}`);
        }
        for (const prompt of list.slice(0, PER_CELL)) {
          out.push({ category, difficulty, type, prompt: String(prompt).trim() });
        }
      }
    }
  }

  if (gaps.length) {
    console.error("Missing prompts:\n" + gaps.join("\n"));
    process.exit(1);
  }

  const dupes = uniqueCheck(out);
  if (dupes.length) {
    console.error(`Duplicate prompts (${dupes.length}):`);
    for (const d of dupes.slice(0, 20)) console.error(" -", d);
    process.exit(1);
  }

  const physical = out.filter((p) => p.type === "dare" && PHYSICAL_RE.test(p.prompt));
  if (physical.length) {
    console.error(`Physical/in-person dares found (${physical.length}):`);
    for (const p of physical.slice(0, 15)) console.error(" -", p.prompt);
    process.exit(1);
  }

  const records = out.map((p, i) => ({
    id: `ldc-${i + 1}`,
    type: p.type,
    category: p.category,
    difficulty: p.difficulty,
    prompt: p.prompt,
    remoteFriendly: true,
    tags: [p.difficulty, p.type, p.category, "remote", "long_distance"],
    weight: 1,
  }));

  const pack = {
    id: "ld-chemistry-pack",
    name: "Long-Distance Chemistry",
    version: "1.0.0",
    description:
      "1000 original 18+ Truth or Dare prompts built for remote play — romance, flirting, vulnerability, voice/camera/emoji challenges, and roleplay. Every dare works over video, voice, or chat.",
    author: "Truth or Dare",
    locale: "en",
    categories: CATEGORIES,
    prompts: records,
  };

  const dest = path.join(__dirname, "ld-chemistry-pack.json");
  const gameDest = path.join(__dirname, "..", "server", "prompts", "ld-chemistry-pack.json");
  fs.writeFileSync(dest, JSON.stringify(pack, null, 2));
  fs.writeFileSync(gameDest, JSON.stringify(pack, null, 2));

  const byDiff = {};
  const byType = {};
  for (const r of records) {
    byDiff[r.difficulty] = (byDiff[r.difficulty] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
  }

  console.log(`Wrote ${records.length} prompts → ${dest}`);
  console.log(`Wrote game pack → ${gameDest}`);
  console.log(`Remote-friendly: ${records.filter((r) => r.remoteFriendly).length}/${records.length}`);
  console.log("Per difficulty:", byDiff);
  console.log("Per type:", byType);
  console.log("Categories:", CATEGORIES.length);
}

build();
