const fs = require("fs");
const path = require("path");

// Load all banks (they mutate the shared BANK via add())
const { CATEGORIES, DIFFICULTIES, TYPES, PER_CELL, BANK } = require("./_bank-romance-kissing");
require("./_bank-crushes-flirting-dating");
require("./_bank-relationships-confessions-embarrassing-party");
require("./_bank-firstimpressions-exes-jealousy");
require("./_bank-redflags-greenflags-secrets");

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
        const slice = list.slice(0, PER_CELL);
        for (const prompt of slice) {
          out.push({ category, difficulty, type, prompt });
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
    console.error(`Duplicate prompts (${dupes.length}):`, dupes.slice(0, 10));
    process.exit(1);
  }

  // Stats
  const byCat = {};
  const byDiff = {};
  const byType = {};
  for (const p of out) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
    byDiff[p.difficulty] = (byDiff[p.difficulty] || 0) + 1;
    byType[p.type] = (byType[p.type] || 0) + 1;
  }

  const dest = path.join(__dirname, "adult-romance-pack.json");
  // intermediate `out` kept for stats; pack written below

  const PHYSICAL_RE =
    /\b(kiss (their|someone'?s?|the) (hand|cheek|lips|forehead)|hold (someone'?s?|their) (hand|face|waist)|slow[- ]?dance|forehead[- ]to[- ]forehead|sit knee[- ]to[- ]knee|feed (someone|each other)|massage|jumping jacks|rearrange your hair|press your forehead|kiss their hand)\b/i;

  const levelMap = {
    Cool: "cool",
    Spicy: "spicy",
    Extreme: "extreme",
    "No Boundaries": "no_boundaries",
  };

  const records = out.map((p, i) => {
    const difficulty = levelMap[p.difficulty];
    const category = p.category.toLowerCase().replace(/\s+/g, "_");
    const remoteFriendly = p.type === "truth" ? true : !PHYSICAL_RE.test(p.prompt);
    const tags = [difficulty, p.type, category, remoteFriendly ? "remote" : "in_person"];
    return {
      id: `ar-${i + 1}`,
      type: p.type,
      category,
      difficulty,
      prompt: p.prompt,
      remoteFriendly,
      tags,
      weight: 1,
    };
  });

  const gamePack = {
    id: "adult-romance-pack",
    name: "Adult Romance Pack",
    version: "2.0.0",
    description:
      "1080 original 18+ prompts focused on romance, flirting, chemistry, and emotional intimacy. Optimized for remote play.",
    author: "Truth or Dare",
    locale: "en",
    categories: [...new Set(records.map((r) => r.category))].sort(),
    prompts: records,
  };

  fs.writeFileSync(dest, JSON.stringify(gamePack, null, 2));
  const gameDest = path.join(__dirname, "..", "server", "prompts", "adult-romance-pack.json");
  fs.writeFileSync(gameDest, JSON.stringify(gamePack, null, 2));

  console.log(`Wrote ${records.length} prompts → ${dest}`);
  console.log(`Wrote game pack → ${gameDest}`);
  console.log(
    `Remote-friendly: ${records.filter((r) => r.remoteFriendly).length}/${records.length}`
  );
  console.log("Per category:", byCat);
  console.log("Per difficulty:", byDiff);
  console.log("Per type:", byType);
}

build();
