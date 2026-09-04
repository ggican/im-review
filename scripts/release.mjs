#!/usr/bin/env node
/**
 * Bump app version (package.json + Tauri + Cargo), commit, tag, and push.
 *
 * Usage:
 *   node scripts/release.mjs patch|minor|major [--dry-run] [--no-push]
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const bump = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
const noPush = process.argv.includes("--no-push");

if (!["patch", "minor", "major"].includes(bump)) {
  console.error(
    "Usage: node scripts/release.mjs <patch|minor|major> [--dry-run] [--no-push]",
  );
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...opts,
  });
}

function runCapture(cmd, args) {
  return run(cmd, args, { capture: true }).trim();
}

function parseSemver(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!m) throw new Error(`Invalid semver: ${version}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function bumpSemver(version, kind) {
  const v = parseSemver(version);
  if (kind === "major") {
    v.major += 1;
    v.minor = 0;
    v.patch = 0;
  } else if (kind === "minor") {
    v.minor += 1;
    v.patch = 0;
  } else {
    v.patch += 1;
  }
  return `${v.major}.${v.minor}.${v.patch}`;
}

function writeJsonVersion(filePath, next) {
  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  data.version = next;
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function writeCargoVersion(filePath, next) {
  const raw = readFileSync(filePath, "utf8");
  const updated = raw.replace(/^version\s*=\s*"[^"]+"/m, `version = "${next}"`);
  if (updated === raw) {
    throw new Error(`Could not find version in ${filePath}`);
  }
  writeFileSync(filePath, updated);
}

const status = runCapture("git", ["status", "--porcelain"]);
if (status && !dryRun) {
  console.error(
    "Working tree is dirty. Commit or stash changes before releasing.",
  );
  console.error(status);
  process.exit(1);
}

const branch = runCapture("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
if (branch !== "main" && branch !== "master" && !dryRun) {
  console.error(`Release from main/master only (current branch: ${branch}).`);
  process.exit(1);
}

const pkgPath = path.join(root, "package.json");
const tauriPath = path.join(root, "src-tauri/tauri.conf.json");
const cargoPath = path.join(root, "src-tauri/Cargo.toml");

const current = JSON.parse(readFileSync(pkgPath, "utf8")).version;
const next = bumpSemver(current, bump);
const tag = `v${next}`;

console.log(`Release ${bump}: ${current} → ${next} (tag ${tag})`);

if (dryRun) {
  console.log("Dry run only — no files changed.");
  process.exit(0);
}

writeJsonVersion(pkgPath, next);
writeJsonVersion(tauriPath, next);
writeCargoVersion(cargoPath, next);

// Keep JSON files Prettier-clean (JSON.stringify expands arrays differently).
run("pnpm", [
  "exec",
  "prettier",
  "--write",
  "package.json",
  "src-tauri/tauri.conf.json",
]);

// Cargo.lock package version entry for this crate
const lockPath = path.join(root, "src-tauri/Cargo.lock");
try {
  const lock = readFileSync(lockPath, "utf8");
  const lockUpdated = lock.replace(
    /(name = "im-review"\nversion = ")[^"]+(")/,
    `$1${next}$2`,
  );
  if (lockUpdated !== lock) {
    writeFileSync(lockPath, lockUpdated);
  }
} catch {
  // optional
}

run("git", [
  "add",
  "package.json",
  "src-tauri/tauri.conf.json",
  "src-tauri/Cargo.toml",
  "src-tauri/Cargo.lock",
]);

run("git", [
  "commit",
  "-m",
  `chore(release): ${tag}\n\nBump package, Tauri, and Cargo versions.`,
]);

run("git", ["tag", "-a", tag, "-m", `Release ${tag}`]);

if (noPush) {
  console.log(`Created commit + tag ${tag} locally (not pushed).`);
  process.exit(0);
}

run("git", ["push", "origin", "HEAD"]);
run("git", ["push", "origin", tag]);

console.log(`\nReleased ${tag}`);
console.log(
  "GitHub Actions → Release will build the macOS .app/.dmg draft release.",
);
console.log(
  `https://github.com/ggican/im-review/actions/workflows/release.yml`,
);
