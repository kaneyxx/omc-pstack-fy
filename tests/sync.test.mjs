import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { carryForward, hasContract, matcher, newest, outgoingProblems, repin } from "../tools/sync.mjs";

describe("sync", () => {
  test("matches a file, a folder, and a glob that stays inside one folder", () => {
    const wanted = matcher(["LICENSE", "agents/", "pstack", "skills/*/SKILL.md"]);
    for (const path of ["LICENSE", "agents/executor.md", "pstack/skills/x/SKILL.md", "skills/ralph/SKILL.md"]) assert.ok(wanted(path), path);
    for (const path of ["LICENSE.md", "agentsx/a.md", "pstack-extra/a", "skills/ralph/notes.md", "skills/a/b/SKILL.md", "README.md"]) assert.ok(!wanted(path), path);
  });

  test("picks the newest X.Y.Z tag by number, skipping prereleases", () => {
    assert.equal(newest(["v5.7.5", "v5.7.10", "v5.10.0-rc.1", "v5.9.12", "latest"]), "v5.9.12");
    assert.equal(newest(["1.2.0", "v1.10.0"]), "v1.10.0");
    assert.equal(newest(["nightly"]), undefined);
  });

  describe("carrying a release forward when the pin moves", () => {
    const pin = { version: "5.7.7", ref: "abc", compatible: [{ version: "5.7.5", contract: "old" }] };

    test("records the release the pin leaves under the current contract hash and keeps the older entries", () => {
      assert.deepEqual(carryForward(pin, "5.7.8", "now"), [
        { version: "5.7.5", contract: "old" },
        { version: "5.7.7", contract: "now" },
      ]);
    });

    test("starts the list from an empty one", () => {
      assert.deepEqual(carryForward({ ...pin, compatible: [] }, "5.7.8", "now"), [{ version: "5.7.7", contract: "now" }]);
    });

    test("records the release even when the pin moves to an older one", () => {
      assert.deepEqual(carryForward(pin, "5.7.4", "now").map(({ version }) => version), ["5.7.5", "5.7.7"]);
    });

    test("keeps one entry per release, with the hash of the latest contract it passed", () => {
      const again = { version: "5.7.5", compatible: [{ version: "5.7.5", contract: "old" }, { version: "5.7.6", contract: "old" }] };
      assert.deepEqual(carryForward(again, "5.7.8", "now"), [
        { version: "5.7.6", contract: "old" },
        { version: "5.7.5", contract: "now" },
      ]);
    });

    test("ignores a leading v on either version", () => {
      assert.deepEqual(carryForward({ ...pin, version: "v5.7.7" }, "v5.7.8", "now").at(-1), { version: "5.7.7", contract: "now" });
      assert.deepEqual(carryForward(pin, "v5.7.7", "now"), pin.compatible);
    });

    test("leaves the list alone when the pin stays on its release", () => {
      assert.deepEqual(carryForward(pin, "5.7.7", "now"), pin.compatible);
    });

    test("does not change the pin it reads", () => {
      const before = structuredClone(pin);
      carryForward(pin, "5.7.8", "now");
      assert.deepEqual(pin, before);
    });

    test("leaves the list alone when the release the pin leaves has problems, even moving to an older one", () => {
      assert.deepEqual(carryForward(pin, "5.7.8", "now", ["a check failed"]), pin.compatible);
      assert.deepEqual(carryForward(pin, "5.7.4", "now", ["a check failed"]), pin.compatible);
    });

    test("keeps an entry that was recorded earlier for the release, even when it now has problems", () => {
      const listed = { ...pin, compatible: [{ version: "5.7.7", contract: "old" }] };
      assert.deepEqual(carryForward(listed, "5.7.8", "now", ["a check failed"]), listed.compatible);
    });
  });

  describe("the pin a sync writes", () => {
    const omc = { repository: "r", track: "release", version: "5.7.7", ref: "aaa", tag: "v5.7.7", compatible: [{ version: "5.7.5", contract: "old" }] };
    const found = { ref: "bbb", tag: "v5.7.8", committedAt: "2026-10-23T00:00:00Z", version: "5.7.8" };

    test("moves a pin with a contract to the fetched release and lists the release it leaves", () => {
      const moved = repin(omc, found, () => "now");
      assert.deepEqual({ ...moved, compatible: undefined }, { ...omc, ...found, compatible: undefined });
      assert.deepEqual(moved.compatible, [
        { version: "5.7.5", contract: "old" },
        { version: "5.7.7", contract: "now" },
      ]);
    });

    test("gives a pin without a contract no list, and never reads the contract", () => {
      const pstack = { repository: "r", track: "main", version: "0.15.29", ref: "aaa" };
      const moved = repin(pstack, { ref: "bbb", version: "0.15.30" }, () => assert.fail("read the contract"));
      assert.deepEqual(moved, { repository: "r", track: "main", version: "0.15.30", ref: "bbb" });
      assert.ok(!hasContract(pstack));
      assert.ok(hasContract(omc));
    });

    test("keeps the list when the sync lands on the same release", () => {
      assert.deepEqual(repin(omc, { ...found, version: "5.7.7" }, () => "now").compatible, omc.compatible);
    });

    test("does not change the pin it reads", () => {
      const before = structuredClone(omc);
      repin(omc, found, () => "now");
      assert.deepEqual(omc, before);
    });
  });

  describe("the release a sync leaves behind, checked in vendor/ before it is replaced", () => {
    const contract = {
      agents: ["executor"],
      skills: ["ralph"],
      anchors: [{ omc: "skills/ralph/SKILL.md", find: "7.5 **Mandatory Deslop Pass**", ours: "hooks/omc-bridge.md", why: "ralph's step 7.5 runs deslop." }],
    };
    const omc = {
      repository: "r",
      track: "release",
      into: "oh-my-claudecode",
      versionFile: ".claude-plugin/plugin.json",
      version: "5.7.7",
      ref: "aaa",
      compatible: [{ version: "5.7.5", contract: "now" }],
    };
    const found = { ref: "bbb", version: "5.7.5" };
    const made = [];
    after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
    const vendor = (ralph, shipped = "5.7.7") => {
      const dir = mkdtempSync(join(tmpdir(), "omc-sync-"));
      made.push(dir);
      const files = { "agents/executor.md": "", "skills/ralph/SKILL.md": ralph, ".claude-plugin/plugin.json": JSON.stringify({ version: shipped }) };
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      return dir;
    };
    const moved = (ralph, to = found) => repin(omc, to, () => "now", outgoingProblems(omc, to.version, vendor(ralph), contract));

    test("is recorded when the vendored release passes the contract", () => {
      assert.deepEqual(moved("7.5 **Mandatory Deslop Pass**").compatible, [
        { version: "5.7.5", contract: "now" },
        { version: "5.7.7", contract: "now" },
      ]);
    });

    test("is not recorded when the vendored release lost an anchored passage, though the pin still moves", () => {
      const pin = moved("7.5 **Deslop**");
      assert.deepEqual(pin.compatible, omc.compatible);
      assert.equal(pin.version, "5.7.5");
      assert.equal(pin.ref, "bbb");
    });

    test("is checked only when a sync leaves it behind, and only for a pin with a contract", () => {
      const failing = vendor("7.5 **Deslop**");
      assert.equal(outgoingProblems(omc, "5.7.5", failing, contract).length, 1);
      assert.deepEqual(outgoingProblems(omc, "v5.7.7", failing, contract), []);
      assert.deepEqual(outgoingProblems({ ...omc, version: undefined }, "5.7.5", failing, contract), []);
      const { compatible, ...pstack } = omc;
      assert.deepEqual(outgoingProblems(pstack, "5.7.5", failing, contract), []);
    });

    test("is not recorded when vendor/ holds another release than the pin names, or no readable version", () => {
      const passing = "7.5 **Mandatory Deslop Pass**";
      for (const shipped of ["5.7.6", null]) {
        const problems = outgoingProblems(omc, "5.7.5", vendor(passing, shipped), contract);
        assert.equal(problems.length, 1);
        assert.match(problems[0], /not the pinned 5\.7\.7/);
      }
      assert.deepEqual(outgoingProblems(omc, "5.7.5", vendor(passing, "v5.7.7"), contract), []);
    });

    test("keeps the list when the sync stays on the release, even though the vendored release fails", () => {
      assert.deepEqual(moved("7.5 **Deslop**", { ...found, version: "5.7.7" }).compatible, omc.compatible);
    });
  });
});

describe("sync against a local upstream", () => {
  const TOOLS = join(dirname(fileURLToPath(import.meta.url)), "..", "tools");
  const made = [];
  after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

  const put = (root, files) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  };
  // A run from a git hook inherits GIT_DIR, which would send these git calls to this repo. A run under node --test inherits
  // NODE_TEST_CONTEXT, which makes the nested `node --test` of the watch trial run its files in-process, whatever they do.
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_") && name !== "NODE_TEST_CONTEXT"));
  const git = (cwd, ...args) => {
    const config = ["user.name=t", "user.email=t@example.com", "commit.gpgsign=false", "core.hooksPath=/dev/null"].flatMap((pair) => ["-c", pair]);
    const result = spawnSync("git", [...config, ...args], { cwd, encoding: "utf8", env });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };

  function project(version = "1.2.3") {
    const root = mkdtempSync(join(tmpdir(), "omc-sync-verify-"));
    made.push(root);
    const repository = join(root, "upstream");
    const upstream = `${repository}.git`;
    const files = { "pstack/plugin.json": `{"version":"${version}"}\n`, "pstack/skills/arena/SKILL.md": "arena\n" };
    put(upstream, { ...files, "pstack/skills/arena/.gitignore": "upstream\n" });
    git(upstream, "init", "-q");
    git(upstream, "add", ".");
    git(upstream, "commit", "-q", "-m", "upstream");
    const pin = { repository, versionFile: "pstack/plugin.json", ref: git(upstream, "rev-parse", "HEAD"), paths: ["pstack"] };
    put(root, { "upstream.json": JSON.stringify({ pstack: pin }), ...Object.fromEntries(Object.entries(files).map(([path, text]) => [`vendor/${path}`, text])) });
    cpSync(TOOLS, join(root, "tools"), { recursive: true });
    return root;
  }

  const verify = (root) => {
    const result = spawnSync(process.execPath, ["tools/sync.mjs", "--verify"], { cwd: root, encoding: "utf8", env });
    return { status: result.status, lines: result.stdout.split("\n"), output: result.stdout + result.stderr };
  };

  test("accepts a vendor/ that matches upstream, though Finder wrote .DS_Store and upstream holds a .gitignore", () => {
    const root = project();
    put(root, { "vendor/.DS_Store": "", "vendor/pstack/.DS_Store": "", "vendor/pstack/skills/arena/.DS_Store": "" });
    const result = verify(root);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /^vendor\/ matches pstack [0-9a-f]{7}\.$/m);
  });

  test("fails on a .gitignore in vendor/ or in a folder upstream owns, and lists both", () => {
    const root = project();
    put(root, { "vendor/.gitignore": "*\n", "vendor/pstack/skills/arena/.gitignore": "*\n" });
    const result = verify(root);
    assert.equal(result.status, 1, result.output);
    assert(result.lines.includes("vendor/pstack/skills/arena/.gitignore"), result.output);
    assert(result.lines.some((line) => line.startsWith("vendor/.gitignore")), result.output);
  });

  // Upstream tags v1.0.0 and v1.1.0, and the stub gh publishes only `published`, newest first like real gh. The stub fails on any
  // other call, so a dropped flag fails the test, and on a missing token, as gh does in Actions.
  function released(published, pinned = "1.0.0", overrides = {}) {
    const root = project("1.0.0");
    const upstream = join(root, "upstream.git");
    git(upstream, "tag", "v1.0.0");
    put(upstream, { "pstack/plugin.json": '{"version":"1.1.0"}\n' });
    git(upstream, "commit", "-q", "-a", "-m", "release 1.1.0");
    git(upstream, "tag", "v1.1.0");
    const pins = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
    const ref = git(upstream, "rev-parse", `v${pinned}^{commit}`);
    put(root, {
      "upstream.json": JSON.stringify({ pstack: { ...pins.pstack, track: "release", version: pinned, ref, ...overrides } }),
      "vendor/pstack/plugin.json": `{"version":"${pinned}"}\n`,
    });
    const bin = mkdtempSync(join(tmpdir(), "omc-sync-gh-"));
    made.push(bin);
    put(bin, {
      gh: `#!/usr/bin/env node
const args = process.argv.slice(2);
const flag = (name) => args[args.indexOf(name) + 1];
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error("gh: set the GH_TOKEN environment variable");
  process.exit(1);
}
const asked = args[0] === "release" && args[1] === "list" && flag("-R") === process.env.STUB_REPO && flag("--json") === "tagName" && flag("--jq") === ".[].tagName";
if (!asked || !args.includes("--exclude-drafts") || !args.includes("--exclude-pre-releases")) {
  console.error("stub gh: unexpected call " + JSON.stringify(args));
  process.exit(1);
}
console.log(process.env.STUB_TAGS.split(",").join("\\n"));
`,
    });
    chmodSync(join(bin, "gh"), 0o755);
    const withGh = { ...env, PATH: [bin, dirname(process.execPath), env.PATH].join(delimiter), STUB_REPO: join(root, "upstream"), STUB_TAGS: published.join(",") };
    return { root, env: withGh };
  }

  function latest(published, pinned, edits = {}) {
    const { root, env: withGh } = released(published, pinned);
    put(root, edits);
    const result = spawnSync(process.execPath, ["tools/sync.mjs", "--latest"], { cwd: root, encoding: "utf8", env: { ...withGh, GH_TOKEN: "stub" } });
    return { status: result.status, output: result.stdout + result.stderr };
  }

  describe("--latest", { skip: process.platform === "win32" && "the stub gh is a POSIX script" }, () => {
    test("ignores a tag that has no published release", () => {
      const result = latest(["v1.0.0"]);
      assert.equal(result.status, 0, result.output);
      assert.doesNotMatch(result.output, /v1\.1\.0/);
    });

    test("reports a release once it is published", () => {
      const result = latest(["v1.1.0", "v1.0.0"]);
      assert.equal(result.status, 3, result.output);
      assert.match(result.output, /v1\.1\.0/);
    });

    test("finds nothing to sync when the pin is ahead of the newest published release", () => {
      const result = latest(["v1.0.0"], "1.1.0");
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /newest release.*is not newer/);
    });

    test("finds nothing to sync when the pin is at the newest release, though a vendored file was fixed by hand", () => {
      const result = latest(["v1.1.0", "v1.0.0"], "1.1.0", { "vendor/pstack/skills/arena/SKILL.md": "fixed\n" });
      assert.equal(result.status, 0, result.output);
      assert.match(result.output, /newest release.*is not newer/);
    });

    test("fails when nothing is published", () => {
      const result = latest([]);
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /has no published releases/);
    });
  });

  describe("sync", { skip: process.platform === "win32" && "the stub gh is a POSIX script" }, () => {
    const sync = (published, pinned, args = [], overrides = {}) => {
      const { root, env: withGh } = released(published, pinned, overrides);
      const files = ["upstream.json", "vendor/pstack/plugin.json"];
      const before = files.map((file) => readFileSync(join(root, file), "utf8"));
      const result = spawnSync(process.execPath, ["tools/sync.mjs", "pstack", ...args], { cwd: root, encoding: "utf8", env: { ...withGh, GH_TOKEN: "stub" } });
      const after = files.map((file) => readFileSync(join(root, file), "utf8"));
      return { status: result.status, output: result.stdout + result.stderr, unchanged: before.every((text, i) => text === after[i]), pin: JSON.parse(after[0]).pstack, vendored: after[1] };
    };

    test("moves a release pin forward to the newest published release", () => {
      const result = sync(["v1.1.0", "v1.0.0"], "1.0.0");
      assert.equal(result.status, 0, result.output);
      assert.equal(result.pin.version, "1.1.0");
      assert.equal(result.pin.tag, "v1.1.0");
      assert.match(result.vendored, /1\.1\.0/);
    });

    test("syncs again to the release it already has", () => {
      const result = sync(["v1.1.0", "v1.0.0"], "1.1.0");
      assert.equal(result.status, 0, result.output);
      assert.equal(result.pin.version, "1.1.0");
    });

    test("leaves a pin that follows a branch alone, whatever version the branch holds", () => {
      const result = sync(["v1.0.0"], "1.1.0", [], { track: "HEAD", version: "2.0.0" });
      assert.equal(result.status, 0, result.output);
      assert.equal(result.pin.version, "1.1.0");
    });

    test("refuses to move a release pin back to the newest published release, and writes nothing", () => {
      const result = sync(["v1.0.0"], "1.1.0");
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, /release of pstack is v1\.0\.0, which is older than the pin, v1\.1\.0\. Pass --ref v1\.0\.0 to move back/);
      assert.ok(result.unchanged, "upstream.json and vendor/ changed");
    });

    test("moves back to an older release when --ref names it", () => {
      const result = sync(["v1.0.0"], "1.1.0", ["--ref", "v1.0.0"]);
      assert.equal(result.status, 0, result.output);
      assert.equal(result.pin.version, "1.0.0");
      assert.match(result.vendored, /1\.0\.0/);
    });
  });

  // The workflow gives gh a token, and the trial runs without one, as it must. The trial pins the ref that `latest` found, so its
  // sync never calls gh. Dropping `--ref` there makes the sync call the stub, which fails without a token.
  describe("tools/watch.mjs", { skip: process.platform === "win32" && "the stub gh is a POSIX script" }, () => {
    test("syncs the release it found without a token", () => {
      const { root, env: withGh } = released(["v1.1.0", "v1.0.0"]);
      put(root, { ".gitignore": "upstream.git/\n", "plugin/stamp.txt": "x\n", "tests/ok.test.mjs": 'import assert from "node:assert/strict";\nimport { test } from "node:test";\ntest("runs without a token", () => assert.equal(process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN, undefined));\n' });
      git(root, "init", "-q");
      git(root, "add", ".");
      const result = spawnSync(process.execPath, ["tools/watch.mjs"], { cwd: root, encoding: "utf8", env: { ...withGh, GH_TOKEN: "stub" } });
      const output = result.stdout + result.stderr;
      assert.equal(result.status, 3, output);
      assert.match(output, /v1\.1\.0/);
      assert.doesNotMatch(output, /node tools\/sync\.mjs pstack` fails/);
      assert.doesNotMatch(output, /`node --test tests\/\*\.test\.mjs` fails/);
      assert.match(output, /`node tools\/build\.mjs` fails/);
    });
  });
});
