#!/usr/bin/env node
/**
 * Builds @tod/shared before Next.js compiles.
 *
 * Vercel installs from the monorepo root but runs the build from `web/`, so the
 * workspace command has to be issued against the repo root explicitly.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const sharedPkg = path.join(repoRoot, "shared", "package.json");

if (!fs.existsSync(sharedPkg)) {
  // Shared was published or vendored: nothing to build.
  console.log("[prebuild] shared workspace not present, skipping");
  process.exit(0);
}

console.log("[prebuild] building @tod/shared…");
execSync("npm run build --workspace shared", { stdio: "inherit", cwd: repoRoot });
