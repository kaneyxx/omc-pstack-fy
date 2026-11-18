// Checks five promises of tools/release.mjs by running the real file under injected faults.
// .claude/skills/verify-release/SKILL.md says what each promise means, what a failure here means, and how to update this file.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createLab, destroyLab, explore, NAME, RELEASE, runOnce } from "./fixtures/release/lab.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// The most faults on one path. CI runs 1. RELEASE_FAULT_DEPTH=2 is the deep run.
const DEPTH = Number(process.env.RELEASE_FAULT_DEPTH ?? 1);
const SOURCE = readFileSync(RELEASE, "utf8");

// What the current release.mjs is known to break. Each entry is a bug to fix in release.mjs, not a property to relax.
// `depth` is the fewest faults on a path that reach it, a fault in a what-if included. `start` names the search that
// reaches it, "feature" by default. The run fails when a violation matches no entry, and when an entry that should show
// up in that search at this depth does not.
const FINDINGS = [];
const known = (violation) => FINDINGS.some(({ is }) => is(violation));

// Broken copies of release.mjs. Each must break the property it names, or the check for that property proves nothing.
// `says` narrows the catch to one clause of the property. `fault` is the one kind of fault the search injects, and `depth`,
// 1 by default, is the most of them on a path, so each mutant costs a few runs. A mutant with no `fault` runs with none.
const MUTANTS = [
  {
    does: "pushes without --atomic",
    breaks: "P1",
    fault: { call: /^claude plugin tag /, mode: "kill-after" },
    edits: [['git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`)', 'git("push", "-q", "origin", "main", `refs/tags/${tag}`)']],
  },
  {
    does: "pushes main and the tag in two pushes",
    breaks: "P1",
    fault: { call: /^git push /, mode: "kill-after" },
    edits: [['git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`);', '(git("push", "-q", "origin", "main"), git("push", "-q", "origin", `refs/tags/${tag}`));']],
  },
  {
    does: "pushes in two pushes only when the release commit is not HEAD",
    breaks: "P1",
    fault: { call: /^(claude plugin tag |git push )/, mode: "kill-after" },
    depth: 2,
    edits: [['git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`);', '(commit === head ? git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`) : (git("push", "-q", "origin", "main"), git("push", "-q", "origin", `refs/tags/${tag}`)));']],
  },
  {
    does: "lets claude tag HEAD and does not check the tag",
    breaks: "P2",
    says: /points at the commit/,
    fault: { call: /^git merge -q --ff-only /, mode: "kill-after" },
    edits: [
      ['commit === head ? spawnSync("claude", ["plugin", "tag", "plugin", "-m", `${name} v%s`], { cwd: ROOT, encoding: "utf8" }) : { error: { code: "ENOENT" } }', 'spawnSync("claude", ["plugin", "tag", "plugin", "-m", `${name} v%s`], { cwd: ROOT, encoding: "utf8" })'],
      ['if (git("rev-parse", `${tag}^{commit}`) !== commit) throw new Error(`tag ${tag} does not point at the release commit`);', ""],
    ],
  },
  {
    does: "leaves tools/version-lock.json out of the release commit",
    breaks: "P2",
    says: /version-lock\.json says/,
    edits: [['run("git", ["add", "-A"], { cwd: dir });', 'run("git", ["add", "-A", ":(exclude)tools/version-lock.json"], { cwd: dir });']],
  },
  {
    does: "deletes origin's tag after it creates the GitHub release",
    breaks: "P2",
    says: /a GitHub release exists/,
    edits: [['"--latest"]);', '"--latest"]), git("push", "-q", "origin", `:refs/tags/${tag}`);']],
  },
  {
    does: "skips the unfinished-release check in preflight",
    breaks: "P3",
    fault: { call: /^git merge -q --ff-only /, mode: "kill-after" },
    edits: [["if (half) throw new Error(`the v${half.version} release is not finished. Run \\`node tools/release.mjs --resume\\`.`);", ""]],
  },
  {
    does: "writes the bump into this tree instead of the worktree",
    breaks: "P4",
    fault: { call: /^node tools\/build\.mjs --release/, mode: "fail" },
    edits: [["const inside = (path) => join(dir, relative(ROOT, path));", "const inside = (path) => path;"]],
  },
  {
    does: "leaves a local tag on the commit that a rebase replaced",
    breaks: "P5",
    fault: { call: /^claude plugin tag /, mode: "kill-after" },
    edits: [['if (local && local !== commit && !remote) git("tag", "-d", tag);', ""]],
  },
  {
    does: "says `Commit or stash first.` on a clean tree when a local tag exists",
    breaks: "P5",
    says: /cannot be done/,
    fault: { call: /^claude plugin tag /, mode: "kill-after" },
    edits: [['if (git("status", "--porcelain")) throw new Error("the working tree is not clean. Commit or stash first.");\n    if (!ok("gh"', 'if (git("status", "--porcelain") || ok("git", ["rev-parse", "-q", "--verify", `refs/tags/${half.tag}`])) throw new Error("the working tree is not clean. Commit or stash first.");\n    if (!ok("gh"']],
  },
  {
    does: "stops after each of the tag, the push, and the GitHub release",
    breaks: "P5",
    says: /needs \d+ runs/,
    edits: [
      ['if (git("rev-parse", `${tag}^{commit}`) !== commit) throw new Error(`tag ${tag} does not point at the release commit`);', 'if (git("rev-parse", `${tag}^{commit}`) !== commit) throw new Error(`tag ${tag} does not point at the release commit`);\n  if (!local) throw new Error(RESUME);'],
      ['git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`);', '{\n    git("push", "-q", "--atomic", "origin", "main", `refs/tags/${tag}`);\n    throw new Error(RESUME);\n  }'],
      ['"--latest"]);', '"--latest"]);\n      throw new Error(RESUME);'],
      ["function publish(", 'const RESUME = "Run `node tools/release.mjs --resume`.";\nfunction publish('],
    ],
  },
  {
    does: "drops the local tag on every --resume, and asks for --resume after it tags",
    breaks: "P5",
    says: /comes back to a state/,
    edits: [
      ['if (local && local !== commit && !remote) git("tag", "-d", tag);', 'if (local && !remote) {\n    git("tag", "-d", tag);\n    throw new Error(RESUME);\n  }'],
      ['if (git("rev-parse", `${tag}^{commit}`) !== commit) throw new Error(`tag ${tag} does not point at the release commit`);', 'if (git("rev-parse", `${tag}^{commit}`) !== commit) throw new Error(`tag ${tag} does not point at the release commit`);\n  if (!local) throw new Error(RESUME);'],
      ["function publish(", 'const RESUME = "Run `node tools/release.mjs --resume`.";\nfunction publish('],
    ],
  },
];

function mutate(edits) {
  let text = SOURCE;
  for (const [from, to] of edits) {
    assert.equal(text.split(from).length, 2, `tools/release.mjs no longer has exactly one \`${from}\`. Rewrite this mutant against the new code.`);
    text = text.replace(from, () => to);
  }
  return text;
}

const told = (violations) => violations.map(({ text }) => text).join("\n\n");

function judge(t, violations, start) {
  const surprises = violations.filter((violation) => !known(violation));
  assert.equal(surprises.length, 0, `release.mjs breaks a promise in a way that is not a recorded finding.\n\n${told(surprises)}`);
  for (const { id, title, is } of FINDINGS.filter((finding) => finding.depth <= DEPTH && (finding.start ?? "feature") === start)) {
    const instances = violations.filter(is).sort((a, b) => a.steps.length - b.steps.length);
    assert.notEqual(instances.length, 0, `${id} no longer shows up. If release.mjs fixed it, delete ${id} from FINDINGS here and from .claude/skills/verify-release/SKILL.md.`);
    t.diagnostic(`${id}, a known bug in release.mjs, on ${instances.length} schedules. ${title}\n${instances[0].text}`);
  }
}

describe("release.mjs under faults", { concurrency: true }, () => {
  let lab;
  before(async () => {
    lab = await createLab();
  });
  after(() => lab && destroyLab(lab));

  // The first search starts with plugin/ up to date. Only the second reaches preflight's answer to a stale plugin/.
  for (const [start, where] of [["feature", "on every explored schedule"], ["stale", "from a stale plugin/"]]) {
    test(`keeps P1 to P5 ${where}, apart from the recorded findings`, async (t) => {
      assert.ok(Number.isInteger(DEPTH) && DEPTH >= 1, "RELEASE_FAULT_DEPTH must be a whole number of faults, 1 or more");
      const { violations, ...counts } = await explore(lab, { start, depth: DEPTH, everyKill: process.env.RELEASE_FAULT_EVERY_KILL === "1" });
      t.diagnostic(
        `${counts.points} fault points, with ${DEPTH === 1 ? "one fault" : `at most ${DEPTH} faults`} on a path. ${counts.same} are kill points that leave the same world as the one before, so they are not run. ` +
          `${counts.runs} runs of release.mjs, ${counts.worlds} distinct worlds, and the longest recovery takes ${counts.longest} runs.`,
      );
      judge(t, violations, start);
    });
  }

  test("finishes a release with plain git when claude is not on PATH", async () => {
    const { violations, runs } = await explore(lab, { claude: false, depth: 0 });
    assert.equal(runs, 1);
    assert.equal(violations.length, 0, told(violations));
  });

  test("lists the groups with a title first in the release notes, in title order", async () => {
    const script = `echo tidy > TIDY.md; "$REAL_GIT" add -A; "$REAL_GIT" commit -q -m "chore: tidy"
echo note > NOTES.md; "$REAL_GIT" add -A; "$REAL_GIT" commit -q -m "docs: a note"`;
    const { status, output, after } = await runOnce(lab, { start: "feature", script, args: ["patch"] });
    assert.equal(status, 0, output);
    assert.deepEqual(after.releases[`${NAME}--v1.0.1`].notes.match(/^### .+$/gm), ["### Added", "### Docs", "### chore"]);
  });

  test("--dry-run from a stale plugin/ names the build and changes nothing", async () => {
    const { status, output, before, after } = await runOnce(lab, { start: "stale", args: ["patch", "--dry-run"] });
    assert.deepEqual(after, before);
    assert.notEqual(status, 0);
    assert.match(output, /plugin\/ is stale\. Run `node tools\/build\.mjs`/);
  });

  for (const { does, breaks, says, fault, depth = fault ? 1 : 0, edits } of MUTANTS) {
    test(`a release.mjs that ${does} breaks ${breaks}`, async () => {
      const only = fault && ((call, mode) => mode === fault.mode && fault.call.test(call));
      const { violations } = await explore(lab, { source: mutate(edits), depth, only, until: breaks });
      const caught = violations.filter((violation) => violation.property === breaks && (!says || says.test(violation.what)) && !known(violation));
      assert.notEqual(caught.length, 0, `the search did not catch the mutant. It found:\n\n${told(violations) || "nothing"}`);
    });
  }
});

// The fixture runs a small stand-in for tools/build.mjs. This walks the stand-in and the real build through the steps of
// a release and requires the same answers at every step, so a change to the real release-lock contract fails here.
describe("the fixture's build", () => {
  const made = [];
  after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
  const temp = () => made[made.push(realpathSync(mkdtempSync(join(tmpdir(), "release-build-")))) - 1];
  const editJson = (path, change) => {
    const value = JSON.parse(readFileSync(path, "utf8"));
    change(value);
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  };
  const append = (path, text) => writeFileSync(path, `${readFileSync(path, "utf8")}${text}`);
  const VERSIONED = [
    ["tools/rules.json", (rules, version) => (rules.plugin.version = version)],
    [".claude-plugin/marketplace.json", (marketplace, version) => (marketplace.plugins.find(({ name }) => name === NAME).version = version)],
    ["package.json", (pkg, version) => (pkg.version = version)],
  ];

  function real() {
    const dir = temp();
    for (const path of ["tools", "vendor", "overlays", "plugin", ".claude-plugin", "upstream.json", "package.json"]) cpSync(join(ROOT, path), join(dir, path), { recursive: true });
    return { dir, content: "overlays/output-styles/fy.md", built: "plugin/output-styles/fy.md" };
  }

  function standIn() {
    const dir = temp();
    const files = { "tools/rules.json": { plugin: { name: NAME } }, ".claude-plugin/marketplace.json": { plugins: [{ name: NAME }] }, "package.json": {} };
    for (const [path, change] of VERSIONED) {
      change(files[path], "1.0.0");
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), JSON.stringify(files[path]));
    }
    cpSync(join(ROOT, "tests", "fixtures", "release", "build.mjs"), join(dir, "tools", "build.mjs"));
    mkdirSync(join(dir, "overlays"));
    writeFileSync(join(dir, "overlays", "SKILL.md"), "first\n");
    return { dir, content: "overlays/SKILL.md", built: "plugin/SKILL.md" };
  }

  // Each step may change the tree first, then runs one build. The order is the order release.mjs meets these states in.
  const STEPS = [
    ["--release records the lock", () => {}, "--release"],
    ["--check passes on what was released", () => {}, "--check"],
    ["a plain build accepts new content", ({ dir, content }) => append(join(dir, content), "\nmore\n"), ""],
    ["--check then asks for a release", () => {}, "--check"],
    ["--release takes the three bumped version fields", ({ dir }) => VERSIONED.forEach(([path, change]) => editJson(join(dir, path), (value) => change(value, "9.9.9"))), "--release"],
    ["--check passes on the new release", () => {}, "--check"],
    ["--check refuses a hand-edited plugin/", ({ dir, built }) => append(join(dir, built), "\nedited\n"), "--check"],
    ["a plain build refuses a bump that reached only tools/rules.json", ({ dir }) => editJson(join(dir, "tools/rules.json"), (rules) => (rules.plugin.version = "9.9.10")), ""],
  ];

  test("answers like tools/build.mjs at every step of a release", () => {
    const [expected, actual] = [real(), standIn()].map((side) => {
      const lock = () => JSON.parse(readFileSync(join(side.dir, "tools", "version-lock.json"), "utf8"));
      let last = {};
      return STEPS.map(([step, change, flag]) => {
        change(side);
        const { status } = spawnSync(process.execPath, ["tools/build.mjs", ...(flag ? [flag] : [])], { cwd: side.dir, encoding: "utf8" });
        const now = lock();
        const answer = { step, passes: status === 0, lockHasRulesVersion: now.version === JSON.parse(readFileSync(join(side.dir, "tools", "rules.json"), "utf8")).plugin.version, lockHashMoved: now.contentSha256 !== last.contentSha256 };
        last = now;
        return answer;
      });
    });
    assert.deepEqual(actual, expected);
    assert.deepEqual(expected.map(({ passes }) => passes), [true, true, true, false, true, true, false, false]);
  });
});
