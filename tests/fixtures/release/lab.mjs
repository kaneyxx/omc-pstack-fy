// Runs the real tools/release.mjs in throwaway repos, injects a fault at every external call it makes, and checks five
// promises after every run. .claude/skills/verify-release/SKILL.md says what this covers and how to read a failure.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const RELEASE = join(HERE, "..", "..", "..", "tools", "release.mjs");
export const NAME = "omc-pstack-fy";
const TARGET = "1.0.1";
const MODES = ["fail", "kill-before", "kill-after"];
// The most release.mjs runs the documented recovery may need after the last fault.
const BOUND = 3;
const COMMANDS = { release: ["patch"], resume: ["--resume"] };
const ELSEWHERE = "docs: a change from someone else";
const RUN_TIMEOUT_MS = 60000;

// A problem with the fixture or the fakes, never a verdict on release.mjs.
class FixtureError extends Error {}

const tagOf = (version) => `${NAME}--v${version}`;
const subjectOf = (version) => `release: ${NAME} v${version}`;
const versionIn = (subject) => subject.match(new RegExp(`^release: ${NAME} v(\\d+\\.\\d+\\.\\d+)$`))?.[1];
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha1 = (bytes) => createHash("sha1").update(bytes).digest("hex");

function exec(command, args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let hung = false;
    const timer = setTimeout(() => ((hung = true), child.kill("SIGKILL")), RUN_TIMEOUT_MS);
    let stdout = "";
    let output = "";
    child.stdout.on("data", (chunk) => ((stdout += chunk), (output += chunk)));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (status, signal) => (clearTimeout(timer), resolve({ status, signal, hung, stdout, output })));
  });
}

function pool(size) {
  let active = 0;
  const waiting = [];
  return async (task) => {
    if (active >= size) await new Promise((go) => waiting.push(go));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

// A world is one folder. state/ holds the maintainer's clone in work/, the bare origin.git, and the fake GitHub's releases
// in gh/. run/ and tmp/ are scratch for one run.
const scratch = (dir) => ({ RELEASE_STATE: join(dir, "state"), RELEASE_RUN: join(dir, "run"), TMPDIR: join(dir, "tmp") });
const workOf = (dir) => join(dir, "state", "work");

const runShell = (lab, dir, script, cwd = workOf(dir)) => exec(lab.shell, ["-ec", script], { cwd, env: { ...lab.env, ...scratch(dir) } });

async function sh(lab, dir, script, cwd) {
  const result = await runShell(lab, dir, script, cwd);
  if (result.status !== 0) throw new FixtureError(`a fixture step ${result.hung ? "hung" : "failed"} in ${dir}\n${script}\n${result.output}`);
  return result.stdout;
}

export async function createLab() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "release-lab-")));
  try {
    return await fillLab(root);
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

// The env is built from nothing, so no token, git setting, or PATH entry of the developer reaches a child. PATH holds only
// the stand-ins, so a tool without a stand-in cannot run at all.
async function fillLab(root) {
  for (const name of ["bin", "bin-without-claude", "home", "template", "w"]) mkdirSync(join(root, name));
  const shell = existsSync("/bin/dash") ? "/bin/dash" : "/bin/sh";
  const shim = `#!${shell}\n${readFileSync(join(HERE, "shim.sh"), "utf8")}`;
  for (const tool of ["git", "gh", "node", "claude"]) writeFileSync(join(root, "bin", tool), shim, { mode: 0o755 });
  for (const tool of ["git", "gh", "node"]) writeFileSync(join(root, "bin-without-claude", tool), shim, { mode: 0o755 });
  const execPath = (await exec("git", ["--exec-path"], { cwd: root, env: process.env })).stdout.trim();
  if (!existsSync(join(execPath, "git")) || !existsSync("/bin/cp")) throw new FixtureError("the fixture needs git's own binary under `git --exec-path` and /bin/cp");
  const env = {
    PATH: join(root, "bin"),
    HOME: join(root, "home"),
    LC_ALL: "C",
    TZ: "UTC",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: join(root, "home", "gitconfig"),
    GIT_TEMPLATE_DIR: join(root, "template"),
    GIT_CEILING_DIRECTORIES: root,
    GIT_TERMINAL_PROMPT: "0",
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_AUTHOR_DATE: "2001-01-01T00:00:00Z",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_DATE: "2001-01-01T00:00:00Z",
    GH_REPO: "release-fixture.invalid/none/none",
    GH_CONFIG_DIR: join(root, "home", "gh"),
    REAL_GIT: join(execPath, "git"),
    REAL_NODE: process.execPath,
    RELEASE_FAKES: join(HERE, "fakes.mjs"),
  };
  // No git command may leave a background job behind, because the next step copies the world.
  writeFileSync(env.GIT_CONFIG_GLOBAL, "[gc]\n\tauto = 0\n[maintenance]\n\tauto = false\n");
  // Half the cores, because node --test runs the other test files beside this one, and some of them time their children.
  const lab = { root, shell, env, tagged: new Map(), forks: 0, limit: pool(Math.max(1, Math.floor(availableParallelism() / 2))) };
  await assertStandIns(lab);
  lab.base = await released(lab);
  return lab;
}

export const destroyLab = (lab) => rmSync(lab.root, { recursive: true, force: true });

// The real gh must never run. Resolve gh and claude the way release.mjs will, through PATH, and require the fakes to answer.
async function assertStandIns(lab) {
  const dir = join(lab.root, "w", "probe");
  resetScratch(dir);
  const resolve = (tool, PATH) => exec(tool, ["--version"], { cwd: lab.root, env: { ...lab.env, ...scratch(dir), PATH } }).catch((error) => ({ error }));
  for (const [tool, bin] of [["gh", "bin"], ["claude", "bin"], ["gh", "bin-without-claude"]]) {
    const answer = await resolve(tool, join(lab.root, bin));
    if (answer.error || !answer.stdout.startsWith(`fake ${tool} `)) throw new FixtureError(`${tool} does not resolve to the fixture's fake, so nothing ran`);
  }
  if ((await resolve("claude", join(lab.root, "bin-without-claude"))).error?.code !== "ENOENT") throw new FixtureError("claude resolves to something in the lab that runs without claude");
}

function resetScratch(dir) {
  for (const name of ["run", "tmp"]) {
    rmSync(join(dir, name), { recursive: true, force: true });
    mkdirSync(join(dir, name), { recursive: true });
  }
  writeFileSync(join(dir, "run", "count"), "0\n");
  writeFileSync(join(dir, "run", "trace"), "");
}

const FILES = {
  "tools/rules.json": json({ plugin: { name: NAME, version: "0.0.0" } }),
  ".claude-plugin/marketplace.json": json({ name: NAME, plugins: [{ name: NAME, source: "./plugin", version: "0.0.0" }] }),
  "package.json": json({ name: NAME, version: "0.0.0" }),
  "upstream.json": json({
    pstack: { repository: "https://example.invalid/pstack", ref: "1".repeat(40) },
    omc: { version: "5.0.0", repository: "https://example.invalid/omc", ref: "2".repeat(40) },
  }),
  "vendor/pstack/plugin.json": json({ version: "0.1.0" }),
  "overlays/SKILL.md": "first\n",
};

// The world every exploration starts from. The real release.mjs made its 1.0.0 release, so origin has the tag and the release.
async function released(lab) {
  const dir = join(lab.root, "w", "base");
  mkdirSync(join(dir, "state", "gh"), { recursive: true });
  for (const [path, text] of Object.entries({ ...FILES, "tools/release.mjs": readFileSync(RELEASE, "utf8"), "tools/build.mjs": readFileSync(join(HERE, "build.mjs"), "utf8") })) {
    mkdirSync(dirname(join(workOf(dir), path)), { recursive: true });
    writeFileSync(join(workOf(dir), path), text);
  }
  await sh(
    lab,
    dir,
    `"$REAL_GIT" init -q --bare -b main ../origin.git
"$REAL_GIT" init -q -b main .
"$REAL_GIT" remote add origin ../origin.git
"$REAL_NODE" tools/build.mjs
"$REAL_GIT" add -A
"$REAL_GIT" commit -q -m "feat: first content"
"$REAL_GIT" push -q -u origin main`,
  );
  const first = await invoke(lab, lab.env, dir, ["1.0.0"], null);
  if (first.status !== 0) throw new FixtureError(`the fixture's first release failed\n${first.output}`);
  await sh(lab, dir, `"$REAL_GIT" gc -q; "$REAL_GIT" --git-dir=../origin.git gc -q`);
  return { dir };
}

async function invoke(lab, env, dir, args, fault, trace = false) {
  resetScratch(dir);
  if (trace) mkdirSync(join(dir, "trace"));
  const faults = { FAULT_AT: String(fault?.at ?? 0), FAULT_MODE: fault?.mode ?? "", RELEASE_TRACE: trace ? join(dir, "trace") : "" };
  const result = await exec(process.execPath, [join("tools", "release.mjs"), ...args], { cwd: workOf(dir), env: { ...env, ...scratch(dir), ...faults } });
  const unmodeled = join(dir, "run", "unmodeled");
  if (existsSync(unmodeled)) throw new FixtureError(`release.mjs made a call the fixture does not model\n${readFileSync(unmodeled, "utf8")}`);
  const calls = readFileSync(join(dir, "run", "trace"), "utf8").split("\n").filter(Boolean);
  // A hang is a verdict on release.mjs, not on the fixture. attempt() records it as a counterexample.
  if (result.hung) return { ...result, calls };
  const killed = result.signal === "SIGKILL";
  if (killed !== Boolean(fault?.mode.startsWith("kill")) || (fault && calls.length < fault.at)) {
    throw new FixtureError(`the planned fault ${JSON.stringify(fault)} is not what happened to \`release.mjs ${args.join(" ")}\`, which made ${calls.length} calls and ended with ${result.signal ?? result.status}\n${result.output}`);
  }
  return { ...result, calls };
}

function fingerprint(dir) {
  const hash = createHash("sha1");
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      hash.update(`${join(at, entry.name).slice(dir.length)}\0`);
      if (entry.isDirectory()) walk(join(at, entry.name));
      else hash.update(readFileSync(join(at, entry.name)));
    }
  };
  walk(dir);
  return hash.digest("hex");
}

// A kill adds nothing of its own, so it leaves the world as it was at that instant. The traced run copied the world before
// and after every call. A kill point whose copy equals the copy before it would leave the same world as the kill point
// before it, so only the points where the copy changed need a real kill.
function killPoints(dir, calls) {
  const changed = [];
  let last;
  for (let at = 1; at <= calls; at++) {
    for (const mode of ["kill-before", "kill-after"]) {
      const copy = join(dir, "trace", `${at}.${mode}`);
      if (!existsSync(copy)) throw new FixtureError(`the traced run left no copy of the world at ${at}.${mode}`);
      const now = fingerprint(copy);
      if (last !== undefined && now !== last) changed.push({ at, mode });
      last = now;
    }
  }
  rm(join(dir, "trace"), { recursive: true, force: true }).catch(() => {});
  return changed;
}

const OBSERVE = `
echo @status; "$REAL_GIT" status --porcelain --untracked-files=all
echo @refs; "$REAL_GIT" for-each-ref --format='%(refname) %(objectname) %(*objectname)'
echo @log; "$REAL_GIT" log --format='%H %s' main
echo @origin-refs; "$REAL_GIT" --git-dir=../origin.git for-each-ref --format='%(refname) %(objectname) %(*objectname)'
echo @origin-log; "$REAL_GIT" --git-dir=../origin.git log --format='%H %s' main
`;

// Everything about a world that release.mjs can read or change. Two worlds with the same observation count as one state.
async function observe(lab, dir) {
  const sections = {};
  let current;
  for (const line of (await sh(lab, dir, OBSERVE)).split("\n")) {
    if (line.startsWith("@")) sections[(current = line.slice(1))] = [];
    else if (line) sections[current].push(line);
  }
  const refs = (lines) => Object.fromEntries(lines.map((line) => line.split(" ")).map(([name, object, peeled]) => [name, peeled || object]));
  const log = (lines) => lines.map((line) => ({ sha: line.slice(0, 40), subject: line.slice(41) }));
  const origin = { refs: refs(sections["origin-refs"]), log: log(sections["origin-log"]) };
  const tagged = {};
  for (const [name, commit] of Object.entries(origin.refs)) {
    if (!name.startsWith("refs/tags/")) continue;
    if (!lab.tagged.has(commit)) {
      const show = `"$REAL_GIT" show -s --format=%s ${commit}; "$REAL_GIT" show ${commit}:tools/version-lock.json || echo "{}"`;
      const [subject, ...lock] = (await sh(lab, dir, show, join(dir, "state", "origin.git"))).split("\n");
      lab.tagged.set(commit, { subject, lock: JSON.parse(lock.join("\n")).version });
    }
    tagged[commit] = lab.tagged.get(commit);
  }
  const content = (path) => (existsSync(join(workOf(dir), path)) ? sha1(readFileSync(join(workOf(dir), path))) : "gone");
  const gh = join(dir, "state", "gh");
  return {
    head: readFileSync(join(workOf(dir), ".git", "HEAD"), "utf8").trim(),
    status: sections.status,
    dirty: Object.fromEntries(sections.status.map((line) => [line.slice(3), content(line.slice(3))])),
    refs: refs(sections.refs),
    log: log(sections.log),
    origin,
    tagged,
    releases: Object.fromEntries(readdirSync(gh).sort().map((file) => [file.slice(0, -".json".length), JSON.parse(readFileSync(join(gh, file), "utf8"))])),
  };
}

function fork(lab, from) {
  const dir = join(lab.root, "w", String(lab.forks++));
  cpSync(join(from.dir, "state"), join(dir, "state"), { recursive: true });
  return dir;
}

// What a person does between runs. None of these is a call release.mjs makes, so none gets a fault.
const MANUAL = {
  pull: { text: "The maintainer runs `git pull --rebase`.", script: `"$REAL_GIT" pull -q --rebase origin main` },
  commit: { text: "The maintainer commits what `git status` shows, as the message says.", script: `"$REAL_GIT" add -A; "$REAL_GIT" commit -q -m "chore: commit before the release"` },
  stash: { text: "The maintainer runs `git stash`, as the message says.", script: `"$REAL_GIT" stash -q` },
  note: { text: "The maintainer commits an unrelated file on top.", script: `echo note > NOTES.md; "$REAL_GIT" add -A; "$REAL_GIT" commit -q -m "docs: a note"` },
  feature: {
    text: "The maintainer commits new plugin content on top, with plugin/ rebuilt.",
    script: `echo more >> overlays/SKILL.md; "$REAL_NODE" tools/build.mjs; "$REAL_GIT" add -A; "$REAL_GIT" commit -q -m "feat: more content"`,
  },
  stale: {
    text: "The maintainer commits new plugin content on top, without a rebuild of plugin/.",
    script: `echo more >> overlays/SKILL.md; "$REAL_GIT" add -A; "$REAL_GIT" commit -q -m "feat: more content"`,
  },
  land: {
    text: "Someone else's commit lands on origin/main.",
    script: `cd ../origin.git
export GIT_INDEX_FILE="$RELEASE_RUN/land.index"
"$REAL_GIT" read-tree main
blob=$(echo elsewhere | "$REAL_GIT" hash-object -w --stdin)
"$REAL_GIT" update-index --add --cacheinfo 100644,"$blob",ELSEWHERE.md
commit=$("$REAL_GIT" commit-tree "$("$REAL_GIT" write-tree)" -p main -m "${ELSEWHERE}")
"$REAL_GIT" update-ref refs/heads/main "$commit"`,
  },
};

const tagsOf = (refs) => new Map(Object.entries(refs).filter(([name]) => name.startsWith("refs/tags/")).map(([name, commit]) => [name.slice("refs/tags/".length), commit]));
const releasesIn = (log) => log.map(({ sha, subject }) => ({ sha, subject, version: versionIn(subject) })).filter(({ version }) => version);

function finished(obs, { sha, version }) {
  const tag = tagOf(version);
  return tagsOf(obs.origin.refs).get(tag) === sha && obs.origin.log.some((commit) => commit.sha === sha) && obs.releases[tag] !== undefined;
}

// P1, P2, and P3 as facts about one world. Each entry says what is wrong in the words of release.mjs.
function invariants(obs) {
  const broken = [];
  const originTags = tagsOf(obs.origin.refs);
  const onMain = new Set(obs.origin.log.map(({ sha }) => sha));
  for (const { sha, subject, version } of releasesIn(obs.origin.log)) {
    const tag = tagOf(version);
    if (originTags.get(tag) !== sha) broken.push({ property: "P1", what: `origin/main has the commit \`${subject}\`, but origin's tag ${tag} ${originTags.has(tag) ? "points at another commit" : "does not exist"}` });
  }
  for (const [tag, commit] of originTags) {
    const version = tag.slice(`${NAME}--v`.length);
    if (!onMain.has(commit)) broken.push({ property: "P1", what: `origin has the tag ${tag}, but origin/main does not contain its commit` });
    const { subject, lock } = obs.tagged[commit];
    if (subject !== subjectOf(version)) broken.push({ property: "P2", what: `origin's tag ${tag} points at the commit \`${subject}\`, not \`${subjectOf(version)}\`` });
    else if (lock !== version) broken.push({ property: "P2", what: `origin's tag ${tag} points at a commit whose tools/version-lock.json says ${lock}` });
  }
  for (const tag of Object.keys(obs.releases)) {
    if (!originTags.has(tag)) broken.push({ property: "P2", what: `a GitHub release exists for ${tag}, but origin has no such tag` });
  }
  const local = releasesIn(obs.log);
  for (let i = 0; i + 1 < local.length; i++) {
    if (!finished(obs, local[i + 1])) broken.push({ property: "P3", what: `\`${local[i].subject}\` sits on top of \`${local[i + 1].subject}\`, which lacks its tag, its push, or its GitHub release` });
  }
  return broken;
}

// P4. When the release command fails on its own, not by a kill, and has made no release commit, HEAD and the working tree
// are as they were. release.mjs names one exception itself. Preflight rebuilds a stale plugin/ and says to commit it.
function rollback(before, after, step) {
  if (step.run !== "release" || step.status === 0 || step.signal) return [];
  if (releasesIn(after.log).length > releasesIn(before.log).length) return [];
  const stale = /plugin\/ was stale\. Commit the rebuilt plugin\/ first/.test(step.output);
  const tree = (obs) => JSON.stringify([obs.head, obs.refs["refs/heads/main"], obs.status.filter((line) => !stale || !line.slice(3).startsWith("plugin/")), stale ? null : obs.dirty]);
  if (tree(before) === tree(after)) return [];
  const moved = after.head !== before.head || after.refs["refs/heads/main"] !== before.refs["refs/heads/main"];
  const left = moved ? "HEAD moved" : `\`git status --porcelain\` shows ${after.status.map((line) => line.trim()).join(", ") || "nothing, where it showed changes before"}`;
  return [{ property: "P4", what: `the release failed before its commit, and ${left}` }];
}

const hasReleaseCommit = (obs) => releasesIn(obs.log).some(({ version }) => version === TARGET);
const originMoved = (obs) => obs.origin.log.some(({ subject }) => subject === ELSEWHERE);

// What is still missing before the target version counts as released. Empty when the release is complete.
function missing(obs) {
  const tag = tagOf(TARGET);
  const commit = tagsOf(obs.origin.refs).get(tag);
  const gaps = [];
  if (!commit) gaps.push(`origin has no tag ${tag}`);
  else if (!obs.origin.log.some(({ sha }) => sha === commit)) gaps.push("origin/main does not contain the tagged commit");
  if (!obs.releases[tag]) gaps.push(`no GitHub release exists for ${tag}`);
  if (commit && !obs.log.some(({ sha }) => sha === commit)) gaps.push("local main does not contain the tagged commit");
  if (obs.status.length > 0) gaps.push("the working tree is not clean");
  return [...gaps, ...invariants(obs).map(({ what }) => what)];
}

// The next step release.mjs names in its own output. The first match wins. A branch without `command` reruns the same
// command. Two branches mean the message allows two readings, and both must lead to a finished release. A run that names
// no step is rerun, as --resume when the release commit exists.
const INSTRUCTIONS = [
  { says: /Run `node tools\/release\.mjs --resume`/, branches: [{ command: "resume" }] },
  { says: /Pull first\./, branches: [{ manual: "pull" }] },
  { says: /Commit or stash first\./, branches: [{ manual: "commit" }, { manual: "stash" }] },
  { says: /Commit the rebuilt plugin\/ first, then release\./, branches: [{ manual: "commit" }] },
  { says: /Run `gh auth login` first\.|passes, then resume\./, branches: [{}] },
  { says: /! \[rejected\]/, branches: [{ manual: "pull", command: "resume" }] },
];

// Explores the worlds that faults can reach, starting one unpushed commit of new plugin content after the 1.0.0 release.
// A node is a world plus the command the maintainer runs next. From each node the command runs once without a fault,
// then once per call with that call failing, and once per kill point that changes the world.
//   start   the MANUAL step that makes that commit. "stale" leaves plugin/ as the 1.0.0 release built it.
//   source  the text of release.mjs to run. The default is the real file.
//   depth   the most faults on one path. A fault in a what-if counts.
//   only    narrows the faults to the calls and modes it accepts. Such a search kills at every kill point it accepts.
//   until   stops the search at the first violation of this property.
//   claude  false removes claude from PATH, so release.mjs tags with plain git.
//   everyKill  kills at every kill point, without the shortcut that killPoints() explains. It exists to check the shortcut.
// Before a --resume, someone else's commit may land on origin/main once. Two what-ifs branch off every unfinished release.
// An unrelated commit on top must not stop the recovery, and new plugin content on top must not get a release of its own.
// No what-if branches off a world that the maintainer reached by committing or stashing, or by the unrelated commit.
export async function explore(lab, { start = "feature", source = readFileSync(RELEASE, "utf8"), depth = 1, only, until, claude = true, everyKill = Boolean(only) } = {}) {
  const wanted = only ?? (() => true);
  const env = { ...lab.env, PATH: join(lab.root, claude ? "bin" : "bin-without-claude") };
  const worlds = new Map();
  const nodes = new Map();
  const edges = [];
  const probed = new Set();
  const tally = { runs: 0, points: 0, same: 0 };
  let stopped = false;

  const intern = async (dir) => {
    const obs = await observe(lab, dir);
    const key = sha1(JSON.stringify(obs));
    if (worlds.has(key)) rm(dir, { recursive: true, force: true }).catch(() => {});
    else worlds.set(key, { key, dir, obs });
    return worlds.get(key);
  };

  // One run of release.mjs from a copy of the world, with at most one fault.
  const run = (world, command, fault, trace) =>
    lab.limit(async () => {
      const dir = fork(lab, world);
      tally.runs++;
      const result = await invoke(lab, env, dir, COMMANDS[command], fault, trace);
      const step = { run: command, fault, status: result.status, signal: result.signal, hung: result.hung, output: result.output, calls: result.calls };
      return { step, changed: trace && !result.hung ? killPoints(dir, result.calls.length) : [], world: await intern(dir) };
    });

  // A step a person takes between runs. When release.mjs named it and it cannot be done, the result has no world.
  const manual = (world, name, { prepare, named = false } = {}) =>
    lab.limit(async () => {
      const dir = fork(lab, world);
      resetScratch(dir);
      prepare?.(dir);
      const { status, output } = await runShell(lab, dir, MANUAL[name].script);
      if (status !== 0 && !named) throw new FixtureError(`a what-if step failed in ${dir}\n${MANUAL[name].script}\n${output}`);
      return { step: { run: name, status, output }, world: status === 0 ? await intern(dir) : undefined };
    });

  const discover = (world, command, { whatIfs = true, leaf = false } = {}) => {
    const key = `${world.key} ${command}${whatIfs ? "" : " no-what-ifs"}${leaf ? " leaf" : ""}`;
    if (nodes.has(key)) return { key };
    const node = { key, world, command, whatIfs, leaf, plans: [] };
    nodes.set(key, node);
    return { key, node };
  };

  const record = (edge) => {
    edges.push(edge);
    if (until && (edge.broken.some(({ property }) => property === until) || (until === "P5" && edge.end && edge.end !== "done"))) stopped = true;
  };

  // Runs the node's command and records one edge per branch of the maintainer's next move.
  async function attempt(node, fault, trace = false) {
    if (stopped) return { found: [] };
    const { step, world, changed } = await run(node.world, node.command, fault, trace);
    const broken = [...invariants(world.obs), ...rollback(node.world.obs, world.obs, step)];
    const gaps = missing(world.obs);
    const found = [];
    if (step.hung) {
      record({ from: node.key, steps: [step], broken, end: `release.mjs hangs. The fixture killed it after ${RUN_TIMEOUT_MS / 1000} s` });
    } else if (node.leaf) {
      record({ from: node.key, steps: [step], broken });
    } else if (step.status === 0 && gaps.length === 0) {
      record({ from: node.key, steps: [step], broken, end: "done" });
    } else if (step.status === 0 && (node.command === "release" || hasReleaseCommit(world.obs))) {
      record({ from: node.key, steps: [step], broken, end: `release.mjs exits 0, but ${gaps.join(", and ")}` });
    } else {
      // An exit 0 here is --resume with nothing to resume, because the target release has not begun. The maintainer goes on to release.
      const told = INSTRUCTIONS.find(({ says }) => step.status !== 0 && says.test(step.output));
      const branches = told?.branches ?? [{ command: step.status === 0 || !hasReleaseCommit(world.obs) ? "release" : "resume" }];
      for (const branch of branches) {
        const moved = branch.manual ? await manual(world, branch.manual, { named: true }) : { world };
        const steps = moved.step ? [step, moved.step] : [step];
        if (!moved.world) {
          record({ from: node.key, steps, broken, end: "the step that the message names cannot be done" });
          continue;
        }
        const next = discover(moved.world, branch.command ?? node.command, { whatIfs: node.whatIfs && branch.manual !== "commit" && branch.manual !== "stash" });
        if (!fault && next.key === node.key) record({ from: node.key, steps, broken, end: "the same command in the same state can only fail the same way" });
        else record({ from: node.key, steps, broken, to: next.key });
        if (next.node) found.push(next.node);
      }
    }
    return { found, step, changed };
  }

  // Everything that follows from a node without a fault, and the faults to inject from it next.
  async function settle(node, inject) {
    const faulty = inject && !node.leaf;
    const clean = await attempt(node, null, faulty && !everyKill);
    if (stopped) return [];
    const { calls } = clean.step;
    if (faulty && !clean.step.hung) {
      const kills = everyKill ? calls.flatMap((_, i) => [{ at: i + 1, mode: "kill-before" }, { at: i + 1, mode: "kill-after" }]) : clean.changed;
      node.plans = [...calls.map((_, i) => ({ at: i + 1, mode: "fail" })), ...kills].filter(({ at, mode }) => wanted(calls[at - 1], mode));
      tally.points += calls.length * MODES.length;
      tally.same += calls.length * 2 - kills.length;
    }
    const branch = async (name, command, flags) => {
      const made = await manual(node.world, name);
      const next = discover(made.world, command, flags);
      record({ from: node.key, steps: [made.step], broken: invariants(made.world.obs), to: next.key });
      return next.node;
    };
    if (!node.whatIfs || node.leaf) return clean.found;
    const sides = [];
    if (node.command === "resume" && !originMoved(node.world.obs)) sides.push(branch("land", "resume"));
    if (hasReleaseCommit(node.world.obs) && missing(node.world.obs).length > 0 && !probed.has(node.world.key)) {
      probed.add(node.world.key);
      sides.push(branch("note", "resume", { whatIfs: false }));
      // While the path has room for one more fault and origin/main has not moved, the stacking attempt also runs with each
      // call failing.
      sides.push(
        branch("feature", "release", { leaf: true }).then(async (stacking) => {
          const refused = stacking && (await attempt(stacking, null)).step;
          if (refused && inject && !originMoved(node.world.obs)) await Promise.all(refused.calls.map((call, i) => wanted(call, "fail") && attempt(stacking, { at: i + 1, mode: "fail" })));
        }),
      );
    }
    const found = [...clean.found, ...(await Promise.all(sides))];
    return found.filter(Boolean);
  }

  const first = await manual(lab.base, start, { prepare: (dir) => writeFileSync(join(workOf(dir), "tools", "release.mjs"), source) });
  let level = [discover(first.world, "release").node];
  for (let faults = 0; level.length > 0; faults++) {
    const members = [];
    for (let batch = level; batch.length > 0; ) {
      members.push(...batch);
      batch = (await Promise.all(batch.map((node) => settle(node, faults < depth)))).flat();
    }
    level = (await Promise.all(members.flatMap((node) => node.plans.map((fault) => attempt(node, fault))))).flatMap(({ found }) => found);
  }
  return report(nodes, edges, { ...tally, worlds: worlds.size, nodes: nodes.size });
}

// Turns the explored graph into violations, each with the shortest run of steps that reaches it.
function report(nodes, edges, tally) {
  const rank = ({ steps: [first, ...rest] }) => [first.fault ? 1 : 0, first.fault?.at ?? 0, MODES.indexOf(first.fault?.mode), first.run, rest.map(({ run }) => run).join()];
  const compare = (a, b) => {
    const [x, y] = [rank(a), rank(b)];
    const at = x.findIndex((value, i) => value !== y[i]);
    return at < 0 ? 0 : x[at] < y[at] ? -1 : 1;
  };
  const sorted = [...edges].sort(compare);
  const out = new Map();
  for (const edge of sorted) out.set(edge.from, [...(out.get(edge.from) ?? []), edge]);
  const root = nodes.keys().next().value;
  const paths = new Map([[root, []]]);
  for (const queue = [root]; queue.length > 0; ) {
    const key = queue.shift();
    for (const edge of out.get(key) ?? []) {
      if (!edge.to || paths.has(edge.to)) continue;
      paths.set(edge.to, [...paths.get(key), ...edge.steps]);
      queue.push(edge.to);
    }
  }
  const violations = new Map();
  const add = (property, what, steps) => {
    const text = `${property} ${what}\n${narrate(steps)}`;
    if (!violations.has(text)) violations.set(text, { property, what, steps, text });
  };
  for (const edge of sorted) {
    // The first step of an edge makes the world that edge.broken describes. Any step after it is the maintainer's next move.
    for (const { property, what } of edge.broken) add(property, what, [...paths.get(edge.from), edge.steps[0]]);
    if (edge.end && edge.end !== "done") add("P5", `the documented recovery stops short. ${edge.end}`, [...paths.get(edge.from), ...edge.steps]);
  }
  // P5 also bounds the recovery, which is the fault-free runs from a node. recovery() returns the most runs that any
  // branch of it takes to a finished release, with that branch's steps. trail holds each node on the way and the steps
  // taken from it.
  const recovery = (key, trail) => {
    const loop = trail.findIndex((at) => at.key === key);
    if (loop >= 0) {
      add("P5", "the documented recovery comes back to a state it was already in", [...paths.get(key), ...trail.slice(loop).flatMap(({ steps }) => steps)]);
      return { runs: Infinity };
    }
    let worst = { runs: -Infinity };
    for (const edge of (out.get(key) ?? []).filter(({ steps: [first] }) => !first.fault && COMMANDS[first.run])) {
      const rest = edge.end === "done" ? { runs: 0, steps: [] } : edge.end ? { runs: Infinity } : recovery(edge.to, [...trail, { key, steps: edge.steps }]);
      if (1 + rest.runs > worst.runs) worst = { runs: 1 + rest.runs, steps: [...edge.steps, ...(rest.steps ?? [])] };
    }
    return worst;
  };
  let longest = 0;
  for (const [key, node] of nodes) {
    if (node.leaf) continue;
    const { runs, steps } = recovery(key, []);
    if (!Number.isFinite(runs)) continue;
    longest = Math.max(longest, runs);
    if (runs > BOUND) add("P5", `the documented recovery needs ${runs} runs of release.mjs, more than ${BOUND}`, [...paths.get(key), ...steps]);
  }
  return { violations: [...violations.values()], longest, ...tally };
}

const COMMAND_LINE = { release: "node tools/release.mjs patch", resume: "node tools/release.mjs --resume" };

// A counterexample as numbered steps in the words of release.mjs.
function narrate(steps) {
  const quote = (output) => {
    const said = output.split("\n").find((line) => line.startsWith("FAIL ")) ?? output.trim().split("\n").at(-1);
    return `\`${said}\`${said.endsWith(".") ? "" : "."}`;
  };
  const told = ({ fault, calls, signal, hung, status, output, run }) => {
    if (MANUAL[run]) return `${MANUAL[run].text}${status === 0 ? "" : ` It fails with ${quote(output)}`}`;
    const call = fault && `call ${fault.at}, \`${calls[fault.at - 1]}\``;
    const faulted = { fail: ` Its ${call}, exits 1 before it does anything.`, "kill-before": ` release.mjs is killed just before its ${call}.`, "kill-after": ` Its ${call}, finishes, and release.mjs is killed before it reads the result.` };
    const outcome = hung ? ` It does not exit within ${RUN_TIMEOUT_MS / 1000} s.` : signal ? "" : `${status === 0 ? " It exits 0 and prints" : " It stops with"} ${quote(output)}`;
    return `The maintainer runs \`${COMMAND_LINE[run]}\`.${fault ? faulted[fault.mode] : ""}${outcome}`;
  };
  return steps.map((step, i) => `${i + 1}. ${told(step)}`).join("\n");
}
