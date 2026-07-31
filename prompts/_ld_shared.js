const DIFFICULTIES = ["cool", "spicy", "extreme", "no_boundaries"];
const TYPES = ["truth", "dare"];
const PER_CELL = 5;
/** @type {Record<string, Record<string, { truth: string[]; dare: string[] }>>} */
const BANK = {};
function ensure(cat, diff) {
  if (!BANK[cat]) BANK[cat] = {};
  if (!BANK[cat][diff]) BANK[cat][diff] = { truth: [], dare: [] };
}
function add(cat, diff, type, prompts) {
  ensure(cat, diff);
  BANK[cat][diff][type].push(...prompts);
}
module.exports = { BANK, add, ensure, DIFFICULTIES, TYPES, PER_CELL };
