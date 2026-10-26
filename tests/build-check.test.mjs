import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP = "--skip-release-lock";
const BUILD_TIMEOUT_MS = 120000;
const LOCK_FAIL = /^FAIL plugin content changed since the v\d+\.\d+\.\d+ release\. Run `node tools\/release\.mjs patch\|minor\|major` before pushing\.$/m;
const NOT_COPIED = new Set([".git", ".omc", ".claude", "node_modules"]);
const LOCAL_ONLY = /\.local\.md$/;
const OVERLAY = "output-styles/fy.md";

const editJson = (dir, path, change) => {
  const file = join(dir, path);
  const json = JSON.parse(readFileSync(file, "utf8"));
  change(json);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
};

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function temp(prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

function scratch(from = ROOT) {
  const dir = temp("omc-pstack-fy-build-");
  cpSync(from, dir, { recursive: true, filter: (source) => !NOT_COPIED.has(basename(source)) && !LOCAL_ONLY.test(basename(source)) });
  return dir;
}

function build(dir, ...args) {
  const result = spawnSync(process.execPath, ["tools/build.mjs", ...args], { cwd: dir, encoding: "utf8", timeout: BUILD_TIMEOUT_MS });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr };
}

// The lock records what this tree builds, so the copy starts released whatever state the real tree is in.
function released() {
  const dir = scratch();
  const lock = build(dir, "--release");
  assert.equal(lock.status, 0, lock.output);
  const checked = build(dir, "--check");
  assert.equal(checked.status, 0, checked.output);
  return dir;
}

const failLines = (stdout) => stdout.split("\n").filter((line) => line.startsWith("FAIL ") && !LOCK_FAIL.test(line));

const changes = {
  "a rule": (dir) => {
    const file = join(dir, "tools", "rules", "10-naming.json");
    const topic = JSON.parse(readFileSync(file, "utf8"));
    topic.edits[0].replace = `> Changed by a contributor.\n\n${topic.edits[0].replace}`;
    writeFileSync(file, `${JSON.stringify(topic, null, 2)}\n`);
  },
  "an overlay": (dir) => appendFileSync(join(dir, "overlays", OVERLAY), "\nChanged by a contributor.\n"),
};

const OTHER_PROBLEMS = {
  "a package.json version mismatch": {
    change: (dir) => editJson(dir, "package.json", (pkg) => (pkg.version = "0.0.0")),
    fail: /^FAIL package\.json is at 0\.0\.0, not \d+\.\d+\.\d+$/m,
  },
  "a marketplace.json version mismatch": {
    change: (dir) => editJson(dir, ".claude-plugin/marketplace.json", (marketplace) => (marketplace.plugins[0].version = "0.0.0")),
    fail: /^FAIL \.claude-plugin\/marketplace\.json lists omc-pstack-fy at 0\.0\.0, not \d+\.\d+\.\d+$/m,
  },
  "a new Cursor name": {
    // The build refuses to write plugin/ while the ratchet fails, so the baseline allows the name for one build.
    change: (dir) => {
      const baseline = join(dir, "tools", "denylist-baseline.json");
      const original = readFileSync(baseline, "utf8");
      appendFileSync(join(dir, "overlays", OVERLAY), "\nSee cursor-team-kit.\n");
      writeFileSync(baseline, original.replace('"cursor-team-kit": 0', '"cursor-team-kit": 1'));
      const rebuilt = build(dir);
      assert.equal(rebuilt.status, 0, rebuilt.output);
      writeFileSync(baseline, original);
    },
    fail: /^FAIL Cursor name cursor-team-kit rose from 0 to 1\./m,
  },
  "an oh-my-claudecode pin that vendor/ does not hold": {
    change: (dir) => editJson(dir, "upstream.json", (upstream) => (upstream.omc.version = "0.0.0")),
    fail: /^FAIL vendor\/oh-my-claudecode\/\.claude-plugin\/plugin\.json says \d+\.\d+\.\d+, but upstream\.json pins oh-my-claudecode 0\.0\.0\./m,
  },
  "an oh-my-claudecode agent that tools/omc.json does not list": {
    change: (dir) => {
      const agents = join(dir, "vendor", "oh-my-claudecode", "agents");
      cpSync(join(agents, "executor.md"), join(agents, "zz-new-agent.md"));
    },
    fail: /^FAIL oh-my-claudecode \d+\.\d+\.\d+ adds the zz-new-agent agent\./m,
  },
};

describe("build --check --skip-release-lock", () => {
  for (const [what, change] of Object.entries(changes)) {
    test(`after ${what} changes plugin/, --check demands a release and ${SKIP} accepts the rebuilt plugin/`, () => {
      const dir = released();
      change(dir);
      const rebuilt = build(dir);
      assert.equal(rebuilt.status, 0, rebuilt.output);

      const strict = build(dir, "--check");
      assert.equal(strict.status, 1, strict.output);
      assert.match(strict.stdout, LOCK_FAIL);

      const skipped = build(dir, "--check", SKIP);
      assert.equal(skipped.status, 0, skipped.output);
      assert.doesNotMatch(skipped.stdout, /FAIL/);
      assert.match(skipped.stdout, /^plugin\/ is up to date \(omc-pstack-fy \d+\.\d+\.\d+\)\.$/m);
    });
  }

  test("a hand-edit to plugin/ still fails", () => {
    const dir = released();
    changes["a rule"](dir);
    assert.equal(build(dir).status, 0);
    appendFileSync(join(dir, "plugin", OVERLAY), "Hand-edited.\n");

    const result = build(dir, "--check", SKIP);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stdout, new RegExp(`^plugin/${OVERLAY}$`, "m"));
    assert.match(result.stdout, /^plugin\/ is out of date\./m);
    assert.doesNotMatch(result.stdout, LOCK_FAIL);
  });

  test("a plugin/ that was not rebuilt after a source change still fails", () => {
    const dir = released();
    changes["an overlay"](dir);

    const result = build(dir, "--check", SKIP);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stdout, new RegExp(`^plugin/${OVERLAY}$`, "m"));
    assert.match(result.stdout, /^plugin\/ is out of date\./m);
  });

  for (const [what, { change, fail }] of Object.entries(OTHER_PROBLEMS)) {
    test(`${what} still fails`, () => {
      const dir = released();
      change(dir);

      const result = build(dir, "--check", SKIP);
      assert.equal(result.status, 1, result.output);
      assert.match(result.stdout, fail);
    });
  }

  test(`every other problem prints the same FAIL lines with and without ${SKIP}, apart from the release-lock line`, () => {
    for (const [what, { change }] of Object.entries(OTHER_PROBLEMS)) {
      const dir = released();
      change(dir);

      const strict = build(dir, "--check");
      const skipped = build(dir, "--check", SKIP);
      assert.equal(strict.status, 1, `${what}\n${strict.output}`);
      assert.equal(skipped.status, 1, `${what}\n${skipped.output}`);
      const expected = failLines(strict.stdout);
      assert.notEqual(expected.length, 0, `${what}\n${strict.output}`);
      assert.deepEqual(failLines(skipped.stdout), expected, what);
    }
  });

  test("a version moved without a release fails with and without the flag", () => {
    const dir = released();
    const moved = "9.9.9";
    editJson(dir, "tools/rules.json", (rules) => (rules.plugin.version = moved));
    editJson(dir, ".claude-plugin/marketplace.json", (marketplace) => (marketplace.plugins[0].version = moved));
    editJson(dir, "package.json", (pkg) => (pkg.version = moved));
    const rebuilt = build(dir);
    assert.equal(rebuilt.status, 0, rebuilt.output);

    for (const flags of [["--check"], ["--check", SKIP]]) {
      const result = build(dir, ...flags);
      assert.equal(result.status, 1, `${flags.join(" ")}\n${result.output}`);
      assert.match(result.stdout, /^FAIL tools\/rules\.json says v9\.9\.9, but the last release is v\d+\.\d+\.\d+\. Let `node tools\/release\.mjs` move the version\.$/m);
    }
  });

  test("anything under plugin/ the build did not write fails, whatever its name or kind", () => {
    const dir = released();
    const junk = ["plugin/.DS_Store", "plugin/.gitkeep", "plugin/skills/update/scripts/node_modules/pkg/index.js"];
    for (const path of junk) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), "planted\n");
    }
    // A checkout without submodules leaves a gitlink as an empty folder, and an install fetches its content.
    const submodule = "plugin/skills/sub";
    mkdirSync(join(dir, submodule));
    // The link reads the same bytes as the file it replaces.
    const link = "plugin/hooks/hooks.json";
    const overlay = join(dir, "overlays", "hooks", "hooks.json");
    assert.deepEqual(readFileSync(join(dir, link)), readFileSync(overlay));
    rmSync(join(dir, link));
    symlinkSync("../../overlays/hooks/hooks.json", join(dir, link));
    // Following this link finds the same files, so only its kind gives it away.
    const folder = "plugin/skills/arena";
    cpSync(join(dir, folder), join(dir, "arena-copy"), { recursive: true });
    rmSync(join(dir, folder), { recursive: true });
    symlinkSync("../../arena-copy", join(dir, folder));
    const planted = [...junk, submodule, link, folder];

    for (const flags of [["--check"], ["--check", SKIP]]) {
      const result = build(dir, ...flags);
      const lines = result.stdout.split("\n");
      assert.equal(result.status, 1, `${flags.join(" ")}\n${result.output}`);
      for (const path of planted) assert(lines.includes(path), `${flags.join(" ")} lists ${path}\n${result.output}`);
      assert(lines.some((line) => line.startsWith("plugin/ is out of date.")), `${flags.join(" ")}\n${result.output}`);
    }

    const rebuilt = build(dir);
    assert.equal(rebuilt.status, 0, rebuilt.output);
    for (const path of [...junk, submodule]) assert.equal(lstatSync(join(dir, path), { throwIfNoEntry: false }), undefined, path);
    assert(lstatSync(join(dir, link)).isFile(), link);
    assert(lstatSync(join(dir, folder)).isDirectory(), folder);
    const checked = build(dir, "--check");
    assert.equal(checked.status, 0, checked.output);
  });

  test(`${SKIP} without --check exits non-zero, says why, and leaves plugin/ alone`, () => {
    const dir = scratch();
    const file = join(dir, "plugin", OVERLAY);
    appendFileSync(file, "Hand-edited.\n");
    const before = readFileSync(file, "utf8");

    const result = build(dir, SKIP);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stdout, /^FAIL --skip-release-lock only applies to --check\./m);
    assert.equal(readFileSync(file, "utf8"), before);
  });
});

describe("scratch copy", () => {
  test("leaves out private local files and agent state", () => {
    const source = temp("omc-pstack-fy-source-");
    const kept = [".claude-plugin/marketplace.json", "docs/guide.md", "README.md"];
    const left = ["scratch.local.md", "docs/notes.local.md", ".omc/state.json", ".claude/settings.local.json", "docs/.claude/skills.md", "node_modules/pkg/index.js"];
    for (const path of [...kept, ...left]) {
      mkdirSync(dirname(join(source, path)), { recursive: true });
      writeFileSync(join(source, path), "private\n");
    }

    const copy = scratch(source);
    const copied = readdirSync(copy, { recursive: true }).filter((path) => statSync(join(copy, path)).isFile());
    assert.deepEqual(copied.sort(), [...kept].sort());
  });
});
