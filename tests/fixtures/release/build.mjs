#!/usr/bin/env node
// Stands in for tools/build.mjs in the release fixture. It keeps the contract that release.mjs relies on and drops the rest.
// The build copies overlays/ into plugin/ and writes the manifest. Like checkMarketplace() and checkPackage(), every mode
// fails when the marketplace entry or package.json disagrees with tools/rules.json. Like resolveVersion(), --release
// records the version and the hash of the generated files, without the manifest, in tools/version-lock.json, and --check
// fails when the version or that hash differs from the lock. --check also fails when plugin/ is not what the build generates.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, sep } from "node:path";

const MANIFEST = ".claude-plugin/plugin.json";
const LOCK = join("tools", "version-lock.json");
const args = new Set(process.argv.slice(2));
const checking = args.has("--check");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const { name, version } = readJson(join("tools", "rules.json")).plugin;
const problems = [];

const listed = readJson(join(".claude-plugin", "marketplace.json")).plugins.find((plugin) => plugin.name === name)?.version;
if (listed !== version) problems.push(`.claude-plugin/marketplace.json lists ${name} at ${listed}, not ${version}`);
const packaged = readJson("package.json").version;
if (packaged !== version) problems.push(`package.json is at ${packaged}, not ${version}`);

const files = new Map(readdirSync("overlays").sort().map((path) => [path, readFileSync(join("overlays", path))]));
const hash = createHash("sha256");
for (const [path, bytes] of files) hash.update(`${path}\0`).update(bytes);
const contentSha256 = hash.digest("hex");
files.set(MANIFEST, Buffer.from(`${JSON.stringify({ name, version }, null, 2)}\n`));

if (args.has("--release")) {
  if (problems.length === 0) writeFileSync(LOCK, `${JSON.stringify({ version, contentSha256 }, null, 2)}\n`);
} else if (checking) {
  const lock = existsSync(LOCK) ? readJson(LOCK) : {};
  if (lock.version !== version) problems.push(`tools/rules.json says v${version}, but the last release is v${lock.version ?? "none"}.`);
  else if (lock.contentSha256 !== contentSha256) problems.push(`plugin content changed since the v${version} release.`);
  const onDisk = new Map();
  for (const path of existsSync("plugin") ? readdirSync("plugin", { recursive: true }) : []) {
    if (statSync(join("plugin", path)).isFile()) onDisk.set(path.split(sep).join("/"), readFileSync(join("plugin", path)));
  }
  const drifted = [...new Set([...files.keys(), ...onDisk.keys()])].filter((path) => !files.get(path) || !onDisk.get(path)?.equals(files.get(path)));
  if (drifted.length > 0) problems.push("plugin/ is out of date.");
}

for (const problem of problems) console.log(`FAIL ${problem}`);
if (problems.length > 0) process.exit(1);
if (!checking) {
  rmSync("plugin", { recursive: true, force: true });
  for (const [path, bytes] of files) {
    mkdirSync(dirname(join("plugin", path)), { recursive: true });
    writeFileSync(join("plugin", path), bytes);
  }
}
