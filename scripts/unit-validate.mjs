/**
 * Unit checks for shared validation helpers (no server required).
 * Usage: node scripts/unit-validate.mjs
 */
import assert from "node:assert/strict";
import {
  createDefaultSettings,
  sanitizeAvatarColor,
  sanitizeCreatePayload,
  sanitizeJoinPayload,
  sanitizeReaction,
  sanitizeSettingsPartial,
  sanitizeChatText,
  LIMITS,
} from "../shared/dist/index.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.log(`  FAIL  ${name} — ${e.message}`);
    process.exitCode = 1;
  }
}

console.log("\nValidation unit checks\n");

check("undefined maxPlayers does not wipe default", () => {
  const s = createDefaultSettings({ maxPlayers: undefined, gameMode: undefined });
  assert.equal(s.maxPlayers, 12);
  assert.equal(s.gameMode, "classic");
});

check("sanitizeCreatePayload clamps players", () => {
  const p = sanitizeCreatePayload({ nickname: "  Vinay  ", maxPlayers: 99, color: "#22d3ee" });
  assert.equal(p.nickname, "Vinay");
  assert.equal(p.maxPlayers, LIMITS.maxPlayersMax);
});

check("sanitizeJoinPayload rejects short codes", () => {
  assert.throws(() => sanitizeJoinPayload({ nickname: "A", code: "AB" }));
});

check("sanitizeAvatarColor rejects CSS injection", () => {
  const c = sanitizeAvatarColor("red); url(https://evil)");
  assert.match(c, /^#[0-9a-f]{6}$/i);
});

check("sanitizeReaction allowlist", () => {
  assert.equal(sanitizeReaction("🔥"), "🔥");
  assert.throws(() => sanitizeReaction("<script>"));
});

check("sanitizeSettingsPartial strips unknown keys", () => {
  const s = sanitizeSettingsPartial({ maxPlayers: 8, isHost: true, __proto__: { x: 1 }, evil: 1 });
  assert.equal(s.maxPlayers, 8);
  assert.equal("isHost" in s, false);
  assert.equal("evil" in s, false);
});

check("sanitizeChatText caps length", () => {
  const t = sanitizeChatText("x".repeat(500));
  assert.equal(t.length, LIMITS.chatMax);
});

console.log(`\n${passed} passed\n`);
