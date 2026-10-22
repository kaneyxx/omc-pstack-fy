#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RULES = join(ROOT, "tools", "rules.json");
const MARKETPLACE = join(ROOT, ".claude-plugin", "marketplace.json");
const PACKAGE = join(ROOT, "package.json");
const CHANGELOG = join(ROOT, "CHANGELOG.md");
const USAGE = `node tools/release.mjs <patch|minor|major|X.Y.Z> [--notes <file>] [--trailer <line>] [--dry-run] [--no-publish]
node tools/release.mjs --resume

patch  fixes and rule tweaks that change plugin content
minor  an upstream sync, or a new skill or role
major  a change that breaks existing role lines, settings, or commands

It checks, bumps tools/rules.json, the marketplace entry, and package.json, records the release in tools/version-lock.json,
prepends CHANGELOG.md, commits, tags {name}--v{version}, pushes main and the tag atomically, and creates the
GitHub release. --no-publish stops after the commit. --dry-run runs the checks and changes nothing.
--resume finishes a release whose commit exists but whose tag, push, or GitHub release does not.`;

function parseArgs(argv) {
  const options = { trailers: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith("--")) throw new Error(`${arg} needs a value`);
      return argv[++i];
    };
    if (arg === "--help") options.help = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--no-publish") options.noPublish = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--notes") options.notes = value();
    else if (arg === "--trailer") options.trailers.push(value());
    else if (!arg.startsWith("-") && !options.bump) options.bump = arg;
    else throw new Error(`unknown argument ${JSON.stringify(arg)}`);
  }
  if (options.help || options.resume) return options;
  if (!/^(patch|minor|major|\d+\.\d+\.\d+)$/.test(options.bump ?? "")) throw new Error("give patch, minor, major, or X.Y.Z");
  return options;
}

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
  if (result.status !== 0 && !allowFail) throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout ?? ""}${result.stderr ?? result.error}`);
  return result;
}

const git = (...args) => run("git", args).stdout.trim();
const ok = (command, args) => run(command, args, { allowFail: true }).status === 0;
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
// The last release is what HEAD records, never the working tree, so a half-applied bump cannot fool the next run.
const committedLock = () => {
  const shown = run("git", ["show", "HEAD:tools/version-lock.json"], { allowFail: true });
  return shown.status === 0 ? JSON.parse(shown.stdout) : {};
};
const parse = (version) => version.split(".").map(Number);
const newer = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
const localDate = () => new Date().toLocaleDateString("sv");
const tagFor = (name, version) => `${name}--v${version}`;

function nextVersion(bump, released) {
  if (/^\d/.test(bump)) {
    if (released && !newer(bump, released)) throw new Error(`${bump} is not newer than the last release, ${released}`);
    return bump;
  }
  if (!released) throw new Error("there is no release yet, so give the first version explicitly, such as 1.0.0");
  const [major, minor, patch] = parse(released);
  return bump === "major" ? `${major + 1}.0.0` : bump === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

// The tag's commit on origin, peeled through an annotated tag, or "" when origin has no such tag.
function remoteTagCommit(tag) {
  const lines = run("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`], { allowFail: true }).stdout.trim().split("\n");
  const peeled = lines.find((line) => line.endsWith("^{}")) ?? lines.find(Boolean) ?? "";
  return peeled.split(/\s+/)[0] ?? "";
}

// A release whose tag, push, or GitHub release is missing must be finished, never stacked on. The release commit is found
// by its subject, not assumed to be HEAD, so commits added or a rebase done after a failure cannot hide it.
function unfinished(name) {
  const lock = committedLock();
  if (!lock.version) return null;
  const commit = git("log", "-1", "--format=%H", "--fixed-strings", `--grep=release: ${name} v${lock.version}`);
  if (!commit) return null;
  const tag = tagFor(name, lock.version);
  const tagged = remoteTagCommit(tag) === commit;
  const merged = ok("git", ["merge-base", "--is-ancestor", commit, "origin/main"]);
  const published = ok("gh", ["release", "view", tag]);
  return tagged && merged && published ? null : { version: lock.version, tag, commit };
}

// Every check that CI runs, plus a clean, current main, so the release commit holds only the release.
function preflight(name, version, { publish }) {
  if (git("rev-parse", "--abbrev-ref", "HEAD") !== "main") throw new Error("release from main");
  if (git("status", "--porcelain")) throw new Error("the working tree is not clean. Commit or stash first.");
  run("git", ["fetch", "-q", "origin", "main"]);
  if (git("rev-list", "--count", "HEAD..origin/main") !== "0") throw new Error("main is behind origin/main. Pull first.");
  const half = unfinished(name);
  if (half) throw new Error(`the v${half.version} release is not finished. Run \`node tools/release.mjs --resume\`.`);
  const tag = tagFor(name, version);
  if (ok("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`])) throw new Error(`tag ${tag} already exists locally`);
  if (ok("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`])) throw new Error(`tag ${tag} already exists on origin`);
  if (publish && !ok("gh", ["auth", "status"])) throw new Error("gh is not signed in. Run `gh auth login` first.");
  run("node", ["tools/sync.mjs", "--verify"]);
  run("node", ["--test", ...git("ls-files", "tests/*.test.mjs").split("\n").filter(Boolean)]);
  run("node", ["tools/build.mjs"]);
  if (git("status", "--porcelain", "plugin")) throw new Error("plugin/ was stale. Commit the rebuilt plugin/ first, then release.");
  if (ok("node", ["tools/build.mjs", "--check"])) throw new Error("nothing to release: plugin content matches the last release.");
  return tag;
}

function notesFor(options, lastTag) {
  if (options.notes) return readFileSync(options.notes, "utf8").trim();
  const range = lastTag ? [`${lastTag}..HEAD`] : [];
  const subjects = git("log", ...range, "--format=%s").split("\n").filter((subject) => subject && !subject.startsWith("release:"));
  const groups = new Map();
  for (const subject of subjects) {
    const [, type = "other", scope] = subject.match(/^(\w+)(?:\((.+)\))?:/) ?? [];
    const text = subject.replace(/^\w+(\(.+\))?:\s*/, "");
    groups.set(type, [...(groups.get(type) ?? []), scope ? `${scope}: ${text}` : text]);
  }
  const titles = { feat: "Added", fix: "Fixed", rules: "Rules", build: "Build", docs: "Docs", other: "Other" };
  return [...groups]
    .sort(([a], [b]) => Object.keys(titles).indexOf(a) - Object.keys(titles).indexOf(b))
    .map(([type, items]) => `### ${titles[type] ?? type}\n\n${items.map((item) => `- ${item}`).join("\n")}`)
    .join("\n\n");
}

function prependChangelog(section) {
  let previous = "";
  try {
    previous = readFileSync(CHANGELOG, "utf8").replace(/^# Changelog\s*/, "").trim();
  } catch {}
  writeFileSync(CHANGELOG, `# Changelog\n\n${section.trim()}\n${previous ? `\n${previous}\n` : ""}`);
}

const sectionOf = (version) => {
  const text = readFileSync(CHANGELOG, "utf8");
  const start = text.indexOf(`## [${version}]`);
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const end = text.indexOf("\n## [", start + 1);
  return text.slice(start, end < 0 ? undefined : end).replace(/^## .*\n+/, "").trim();
};

// Tag the release commit, push main and the tag in one atomic push, then create the GitHub release. Each step is skipped
// when already done, so --resume can call this again after any failure, extra commits, or a rebase.
function publish(name, version, commit) {
  const tag = tagFor(name, version);
  const head = git("rev-parse", "HEAD");
  const remote = remoteTagCommit(tag);
  if (remote && remote !== commit) throw new Error(`origin's ${tag} points at ${remote.slice(0, 7)}, not the release commit ${commit.slice(0, 7)}. Fix it by hand.`);
  const local = run("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`], { allowFail: true }).stdout.trim();
  // A rebase after a rejected push rewrites the release commit, so a local-only tag on the old commit is moved.
  if (local && local !== commit && !remote) git("tag", "-d", tag);
  if (!local || (local !== commit && !remote)) {
    // Claude Code's tagger checks that plugin.json and the marketplace entry agree, but it tags HEAD. Plain git tags any other commit, or stands in when claude is absent.
    const tagged = commit === head ? spawnSync("claude", ["plugin", "tag", "plugin", "-m", `${name} v%s`], { cwd: ROOT, encoding: "utf8" }) : { error: { code: "ENOENT" } };
    if (tagged.error?.code === "ENOENT") git("tag", "-a", tag, "-m", `${name} v${version}`, commit);
    else if (tagged.status !== 0) throw new Error(`claude plugin tag failed\n${tagged.stdout}${tagged.stderr}`);
  }
  if (git("rev-parse", `${tag}^{commit}`) !== commit) throw new Error(`tag ${tag} does not point at the release commit`);
  const merged = ok("git", ["merge-base", "--is-ancestor", commit, "origin/main"]);
  if (remote !== commit || !merged) git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`);
  if (!ok("gh", ["release", "view", tag])) {
    const dir = mkdtempSync(join(tmpdir(), "omc-pstack-fy-release-"));
    try {
      writeFileSync(join(dir, "notes.md"), `${sectionOf(version)}\n`);
      run("gh", ["release", "create", tag, "--verify-tag", "--title", `${name} v${version}`, "--notes-file", join(dir, "notes.md"), "--latest"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  console.log(`released ${name} v${version}: ${tag}`);
}

function release(options, name) {
  const released = committedLock().version;
  const version = nextVersion(options.bump, released);
  const tag = preflight(name, version, { publish: !options.noPublish && !options.dryRun });
  const { pstack: pin, omc } = readJson(join(ROOT, "upstream.json"));
  const upstreamVersion = readJson(join(ROOT, "vendor", "pstack", "plugin.json")).version;
  const notes = notesFor(options, released ? tagFor(name, released) : undefined);
  const section = `## [${version}] - ${localDate()}\n\nBuilt from upstream pstack v${upstreamVersion} (${pin.repository}/tree/${pin.ref.slice(0, 7)}), checked against oh-my-claudecode v${omc.version} (${omc.repository}/tree/${omc.ref.slice(0, 7)}).\n\n${notes}\n`;
  if (options.dryRun) {
    console.log(`checks pass. Would release ${name} ${released ? `v${released}` : "(first release)"} -> v${version}, tag ${tag}\n\n${section}`);
    return;
  }

  try {
    const rules = readJson(RULES);
    rules.plugin.version = version;
    writeJson(RULES, rules);
    const marketplace = readJson(MARKETPLACE);
    marketplace.plugins.find((plugin) => plugin.name === name).version = version;
    writeJson(MARKETPLACE, marketplace);
    writeJson(PACKAGE, { ...readJson(PACKAGE), version });
    run("node", ["tools/build.mjs", "--release"]);
    run("node", ["tools/build.mjs", "--check"]);
    prependChangelog(section);
    git("add", "-A");
    git("commit", "-q", "-m", [`release: ${name} v${version}`, ...(options.trailers.length ? ["", ...options.trailers] : [])].join("\n"));
  } catch (error) {
    // Nothing is committed yet, so put the tree back the way preflight found it.
    run("git", ["reset", "-q", "--hard", "HEAD"], { allowFail: true });
    run("git", ["clean", "-fq", "--", "CHANGELOG.md"], { allowFail: true });
    throw error;
  }
  console.log(`committed release ${name} v${version}`);
  if (options.noPublish) {
    console.log("Next: node tools/release.mjs --resume");
    return;
  }
  publish(name, version, git("rev-parse", "HEAD"));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return console.log(USAGE);
  const { name } = readJson(RULES).plugin;
  if (options.resume) {
    run("git", ["fetch", "-q", "origin", "main"]);
    const half = unfinished(name);
    if (!half) return console.log("nothing to resume: the last release is tagged, pushed, and published.");
    if (git("status", "--porcelain")) throw new Error("the working tree is not clean. Commit or stash first.");
    if (!ok("gh", ["auth", "status"])) throw new Error("gh is not signed in. Run `gh auth login` first.");
    if (!ok("node", ["tools/build.mjs", "--check"])) throw new Error("plugin/ does not match the release. Fix main so `node tools/build.mjs --check` passes, then resume.");
    return publish(name, half.version, half.commit);
  }
  release(options, name);
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
