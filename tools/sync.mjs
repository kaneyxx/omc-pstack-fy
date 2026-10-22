#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = join(ROOT, "vendor");
const PIN = join(ROOT, "upstream.json");
const USAGE = `node tools/sync.mjs [pstack|omc] [--ref <sha|tag|branch>]   vendor an upstream at a ref and pin it (default pstack;
                                                         pstack follows main, omc its newest release tag)
node tools/sync.mjs --verify                             check vendor/ still matches every pinned commit
node tools/sync.mjs --latest                             report, as Markdown, which upstream has newer vendored files (exit 3 when one has)`;
// vendor/ is data, not a working tree. Upstream's .gitignore would hide files from this repo, and Finder litters .DS_Store.
const SKIP = new Set([".DS_Store", ".gitignore"]);
export const NEWER = 3;

function parseArgs(argv) {
  const options = { name: "pstack", ref: undefined, verify: false, latest: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help") options.help = true;
    else if (arg === "--verify") options.verify = true;
    else if (arg === "--latest") options.latest = true;
    else if (arg === "--ref" && argv[i + 1] && !argv[i + 1].startsWith("-")) options.ref = argv[++i];
    else if (arg === "pstack" || arg === "omc") options.name = arg;
    else throw new Error(`unknown or incomplete argument ${JSON.stringify(arg)}\n${USAGE}`);
  }
  return options;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.stderr ?? result.error}`);
  return result.stdout.trim();
}

// A path in upstream.json is a file, a folder (every file under it), or a glob whose * stays inside one folder.
export function matcher(paths) {
  const patterns = paths.map((path) => {
    const body = path.replace(/\/$/, "").split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*");
    return new RegExp(`^${body}(/.*)?$`);
  });
  return (file) => patterns.some((pattern) => pattern.test(file));
}

// Where an upstream lives in vendor/: its own folder, or vendor/ itself for pstack, whose paths are already folders.
const home = (pin) => join(VENDOR, pin.into ?? "");
// The vendor/ entries an upstream owns, which a sync replaces whole.
const owned = (pin) => (pin.into ? [pin.into] : [...new Set(pin.paths.map((path) => path.split("/")[0]))]);

function walk(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path).flatMap((name) => {
    if (SKIP.has(name) || name === ".git") return [];
    const child = join(path, name);
    return statSync(child).isDirectory() ? walk(child) : [child];
  });
}

const hashes = (base, files) =>
  new Map(files.map((file) => [relative(base, file).split(sep).join("/"), createHash("sha256").update(readFileSync(file)).digest("hex")]));

// The files a checkout holds for an upstream's paths.
function fetched(dir, pin) {
  const wanted = matcher(pin.paths);
  return new Map([...hashes(dir, walk(dir))].filter(([file]) => wanted(file)));
}

// Every file in the vendor/ entries an upstream owns, unfiltered, so a stray file or a hand edit there still counts as drift.
const vendored = (pin) => hashes(home(pin), owned(pin).flatMap((entry) => walk(join(VENDOR, entry))));

function fetchUpstream(pin, ref, dir) {
  mkdirSync(dir, { recursive: true });
  const git = (...args) => run("git", ["-C", dir, ...args]);
  git("init", "-q");
  git("remote", "add", "origin", `${pin.repository}.git`);
  git("sparse-checkout", "set", "--no-cone", ...pin.paths.map((path) => `/${path.replace(/\/$/, "")}`));
  git("fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", ref);
  git("checkout", "-q", "FETCH_HEAD");
  const version = JSON.parse(readFileSync(join(dir, pin.versionFile), "utf8")).version;
  // The version lands in upstream.json and in a public issue, so text that is not a version stops here.
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(version))) throw new Error(`${pin.versionFile} in ${pin.repository} has version ${JSON.stringify(version)}, not X.Y.Z`);
  return { sha: git("rev-parse", "HEAD"), committedAt: git("log", "-1", "--format=%cI"), version };
}

const RELEASE = /^v?\d+\.\d+\.\d+$/;
// Below 0 when version a is older than b, 0 when equal, above 0 when newer. A leading v is ignored.
const compare = (a, b) => {
  const [x, y] = [a, b].map((version) => version.replace(/^v/, "").split(".").map(Number));
  return x.map((n, i) => n - y[i]).find((n) => n !== 0) ?? 0;
};

// The newest X.Y.Z release tag, with or without a leading v. Prereleases are skipped.
export function newest(tags) {
  return tags.filter((tag) => RELEASE.test(tag ?? "")).sort(compare).at(-1);
}

function newestTag(pin) {
  const tags = run("git", ["ls-remote", "--tags", "--refs", `${pin.repository}.git`]).split("\n").map((line) => line.split("refs/tags/")[1]);
  return newest(tags) ?? fail(`${pin.repository} has no release tags`);
}

function fail(message) {
  throw new Error(message);
}

const tracked = (pin) => (pin.track === "release" ? newestTag(pin) : pin.track);

// REA pins the exact upstream tree by content hash, so a later sync can prove what changed.
function reaFingerprint(source) {
  const result = spawnSync("rea", ["import-reference-source", source, "--detail", "summary", "--outline-depth", "0", "--format", "json"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const { manifest } = JSON.parse(result.stdout);
  return { version: run("rea", ["--version"]), manifest_id: manifest.manifest_id, root_sha256: manifest.root_sha256 };
}

function differences(want, have) {
  return [...new Set([...want.keys(), ...have.keys()])].sort().filter((file) => want.get(file) !== have.get(file));
}

function verify(pins, dir) {
  const known = new Set(Object.values(pins).flatMap(owned));
  const stray = readdirSync(VENDOR).filter((entry) => !SKIP.has(entry) && !known.has(entry)).map((entry) => `vendor/${entry} (no upstream owns it)`);
  const drifted = Object.entries(pins).flatMap(([name, pin]) => {
    const checkout = join(dir, name);
    fetchUpstream(pin, pin.ref, checkout);
    return differences(fetched(checkout, pin), vendored(pin)).map((file) => `vendor/${pin.into ? `${pin.into}/` : ""}${file}`);
  });
  drifted.unshift(...stray);
  for (const path of drifted.slice(0, 20)) console.log(path);
  if (drifted.length > 0) throw new Error("vendor/ differs from upstream.json. Never edit vendor/. Put changes in tools/rules/ or overlays/.");
  console.log(`vendor/ matches ${Object.entries(pins).map(([name, pin]) => `${name} ${pin.ref.slice(0, 7)}`).join(" and ")}.`);
}

// Copy beside vendor/ and rename, so a failed copy never leaves vendor/ replaced while upstream.json still pins the old commit.
function sync(pins, name, ref, dir) {
  const pin = pins[name];
  const target = ref ?? tracked(pin);
  const { sha, committedAt, version } = fetchUpstream(pin, target, dir);
  const rea = pin.rea ? Object.fromEntries(pin.paths.map((path) => [path, reaFingerprint(join(dir, path))])) : undefined;
  const staged = join(VENDOR, `.${name}.staged`);
  rmSync(staged, { recursive: true, force: true });
  for (const file of fetched(dir, pin).keys()) cpSync(join(dir, file), join(staged, pin.into ?? "", file));
  for (const entry of owned(pin)) {
    rmSync(join(VENDOR, entry), { recursive: true, force: true });
    if (existsSync(join(staged, entry))) renameSync(join(staged, entry), join(VENDOR, entry));
  }
  rmSync(staged, { recursive: true, force: true });
  const tag = pin.track === "release" ? { tag: RELEASE.test(target) ? target : undefined } : {};
  pins[name] = { ...pin, ref: sha, ...tag, committedAt, version, ...(rea ? { rea } : {}) };
  writeFileSync(PIN, `${JSON.stringify(pins, null, 2)}\n`);
  const from = pin.ref ? `${pin.ref.slice(0, 7)} (v${pin.version})` : "nothing";
  console.log(`vendor/ ${name}: ${from} -> ${sha.slice(0, 7)} (v${version})`);
  if (rea && Object.values(rea).includes(null)) console.log("rea is not installed, so upstream.json has no REA fingerprint.");
  console.log("Next: node tools/build.mjs, then review `git diff --stat vendor/ plugin/`.");
}

const NEXT = [
  "## Next",
  "",
  "1. `node tools/sync.mjs <name>` for each upstream above that differs.",
  "2. `node tools/build.mjs`. Fix each FAIL line in `tools/rules/`, `overlays/`, or `tools/omc.json`.",
  "3. `node --test tests/*.test.mjs`.",
  "4. `node tools/release.mjs minor`.",
].join("\n");

// One Markdown section per upstream, for the upstream issue. Only vendored files count, so commits to the rest of an upstream
// repository stay quiet.
export function latest(pins, dir) {
  return Object.entries(pins).map(([name, pin]) => {
    const target = tracked(pin);
    const checkout = join(dir, name);
    const { sha, version } = fetchUpstream(pin, target, checkout);
    const changed = differences(fetched(checkout, pin), vendored(pin));
    const where = `[${target}](${pin.repository}/tree/${sha})`;
    const pinned = `Pinned v${pin.version} (${pin.ref.slice(0, 7)}).`;
    if (changed.length === 0) return { name, newer: false, section: `## ${name}\n\n${pinned} The vendored files match ${where}.` };
    // A pin past the newest release, such as a fix taken from a commit, is not behind it.
    if (pin.track === "release" && compare(version, pin.version) <= 0) {
      return { name, newer: false, section: `## ${name}\n\n${pinned} The newest release, ${where}, is not newer, so there is nothing to sync.` };
    }
    const list = changed.slice(0, 30).map((file) => `- \`${file}\``);
    if (changed.length > 30) list.push(`- and ${changed.length - 30} more`);
    const section = `## ${name}\n\n${pinned} ${where} is v${version}, and ${changed.length} vendored files differ:\n\n${list.join("\n")}\n\nRun \`node tools/sync.mjs ${name}\`.`;
    return { name, newer: true, section };
  });
}

function main() {
  const dir = mkdtempSync(join(tmpdir(), "omc-pstack-fy-sync-"));
  try {
    const options = parseArgs(process.argv.slice(2));
    const pins = JSON.parse(readFileSync(PIN, "utf8"));
    if (options.help) console.log(USAGE);
    else if (options.verify) verify(pins, dir);
    else if (options.latest) {
      const upstreams = latest(pins, dir);
      const newer = upstreams.some((upstream) => upstream.newer);
      console.log([...upstreams.map(({ section }) => section), ...(newer ? [NEXT] : [])].join("\n\n"));
      process.exitCode = newer ? NEWER : 0;
    } else sync(pins, options.name, options.ref, dir);
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Tests import matcher and newest without running a sync. Node runs the real path, so compare against argv's real path too,
// or a run through a symlinked folder (such as /tmp on macOS) would do nothing.
export function isMain(url) {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(url);
  } catch {
    return false;
  }
}
if (isMain(import.meta.url)) main();
