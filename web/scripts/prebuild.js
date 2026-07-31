#!/usr/bin/env node
/** Ensures @tod/shared is built before Next.js (Vercel monorepo). */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const sharedDist = path.join(__dirname, "../shared/dist/index.js");
if (!fs.existsSync(sharedDist)) {
  console.log("[prebuild] building @tod/shared…");
  execSync("npm run build -w shared", { stdio: "inherit", cwd: path.join(__dirname, "..") });
} else {
  // Always rebuild to pick up type changes
  execSync("npm run build -w shared", { stdio: "inherit", cwd: path.join(__dirname, "..") });
}
