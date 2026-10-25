import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { describe, test } from "node:test";
import { cappedStat, failLines, issuePlan, publish, testFailures, tidy, verdict } from "../tools/watch.mjs";

const STAMP = "plugin/hooks/omc-version.json";
const COMMANDS = ["node tools/sync.mjs omc", "node tools/build.mjs", "node --test tests/*.test.mjs"];

const sync = (state) => verdict({ behind: ["omc"], problems: [], changed: [], stat: "", ...state });
const lines = (markdown) => markdown.split("\n");

describe("verdict", () => {
  test("is bookkeeping when plugin/ is unchanged or only the OMC version stamp moved", () => {
    for (const changed of [[], [STAMP]]) {
      const result = sync({ changed, stat: ` ${STAMP} | 2 +-` });
      assert.equal(result.kind, "bookkeeping");
      assert.match(result.summary, /bookkeeping minor release/);
      const at = lines(result.markdown).indexOf("node tools/sync.mjs omc");
      assert.deepEqual(lines(result.markdown).slice(at, at + 4), [...COMMANDS, "node tools/release.mjs minor"]);
      assert.doesNotMatch(result.markdown, /git diff --stat/);
    }
  });

  test("names one sync command per upstream that is behind", () => {
    const result = sync({ behind: ["pstack", "omc"] });
    const at = lines(result.markdown).indexOf("node tools/sync.mjs pstack");
    assert.deepEqual(lines(result.markdown).slice(at, at + 2), ["node tools/sync.mjs pstack", "node tools/sync.mjs omc"]);
  });

  test("asks for a review, with the changed files, when plugin/ changes beyond the stamp", () => {
    const stat = [` ${STAMP} | 2 +-`, " plugin/skills/refit/SKILL.md | 14 ++++++++++++++", " 2 files changed, 15 insertions(+), 1 deletion(-)"].join("\n");
    const result = sync({ changed: [STAMP, "plugin/skills/refit/SKILL.md"], stat });
    assert.equal(result.kind, "review");
    assert.match(result.summary, /Review them before releasing/);
    assert.ok(result.markdown.includes(stat));
    assert.match(result.markdown, /git diff --stat -- plugin\//);
  });

  test("names each failed stage, with its FAIL lines or failing tests and what to fix", () => {
    const result = sync({
      changed: [STAMP],
      problems: [
        { stage: "build", command: "node tools/build.mjs", lines: ["FAIL oh-my-claudecode 5.7.7 adds the refit skill. Decide whether omc-pstack-fy should route it."] },
        { stage: "tests", command: "node --test tests/*.test.mjs", lines: ["omc contract > passes when the release matches the contract"] },
      ],
    });
    assert.equal(result.kind, "broken");
    assert.equal(result.summary, "The build fails. The tests fail. Fix those before releasing.");
    assert.match(result.markdown, /FAIL oh-my-claudecode 5\.7\.7 adds the refit skill/);
    assert.match(result.markdown, /omc contract > passes when the release matches the contract/);
    assert.match(result.markdown, /Fix each FAIL line in `tools\/rules\/`, `overlays\/`, or `tools\/omc\.json`/);
    assert.match(result.markdown, /Fix each failing test/);
  });

  test("stops at a failed sync and says how to rerun it", () => {
    const result = sync({ behind: ["pstack", "omc"], problems: [{ stage: "sync", command: "node tools/sync.mjs omc", lines: ["FAIL git fetch failed"] }] });
    assert.equal(result.kind, "broken");
    assert.equal(result.summary, "The sync fails to run. Fix that before releasing.");
    assert.match(result.markdown, /### `node tools\/sync\.mjs omc` fails/);
    assert.match(result.markdown, /check `paths` and `versionFile` for that upstream in `upstream\.json`/);
  });

  test("caps a long list of FAIL lines", () => {
    const many = Array.from({ length: 45 }, (_, i) => `FAIL problem ${i}`);
    const { markdown } = sync({ problems: [{ stage: "build", command: "node tools/build.mjs", lines: many }] });
    assert.match(markdown, /FAIL problem 29\nand 15 more/);
    assert.doesNotMatch(markdown, /FAIL problem 30/);
  });
});

describe("failure lines", () => {
  test("keeps the FAIL lines, and falls back to the end of the output for a crash", () => {
    assert.deepEqual(failLines("building\nFAIL one\nnoise\nFAIL two\n"), ["FAIL one", "FAIL two"]);
    const crash = Array.from({ length: 15 }, (_, i) => `at frame ${i}`).join("\n");
    assert.deepEqual(failLines(crash), Array.from({ length: 10 }, (_, i) => `at frame ${i + 5}`));
  });

  test("reads the failing tests out of what node --test prints, keeping a failing test and dropping its failing suite", (t) => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "watch-test-")));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(
      join(dir, "a.test.mjs"),
      `import assert from "node:assert/strict";
import { describe, test } from "node:test";
describe("suite one", () => {
  test("passes", () => {});
  test("fails here", () => assert.equal(1, 2));
});
test("top level fails", () => { throw new Error("boom"); });
test("top level passes", () => {});
`,
    );
    writeFileSync(join(dir, "b.test.mjs"), "syntax error here(\n");
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const run = spawnSync(process.execPath, ["--test", "--test-reporter=tap", join(dir, "a.test.mjs"), join(dir, "b.test.mjs")], { encoding: "utf8", env });
    assert.notEqual(run.status, 0);
    assert.deepEqual(testFailures(tidy(run.stdout, dir)).sort(), ["b.test.mjs", "suite one > fails here", "top level fails"]);
  });

  test("reads no failures out of a passing run", () => {
    assert.deepEqual(testFailures("TAP version 13\n# Subtest: ok\nok 1 - ok\n1..1\n"), []);
  });
});

describe("report text", () => {
  test("drops the scratch folder and temp folder names, so an unchanged failure keeps the same issue body", () => {
    const dir = "/private/var/folders/xy/T/omc-pstack-fy-watch-AbC123/trial";
    const text = `file://${dir}/tools/build.mjs:12 at ${dir}/tests/x.test.mjs, in /tmp/omc-pstack-fy-sync-Zz9 and ${dir}`;
    assert.equal(tidy(text, dir), "tools/build.mjs:12 at tests/x.test.mjs, in <tmp> and .");
  });

  test("keeps the first files of a long stat and its summary line", () => {
    const files = Array.from({ length: 40 }, (_, i) => ` plugin/f${i}.md | 2 +-`);
    const stat = [...files, " 40 files changed, 40 insertions(+), 40 deletions(-)"].join("\n");
    const kept = cappedStat(stat);
    assert.equal(kept.length, 32);
    assert.equal(kept[29], " plugin/f29.md | 2 +-");
    assert.equal(kept[30], "... and 10 more files");
    assert.equal(kept[31], " 40 files changed, 40 insertions(+), 40 deletions(-)");
    assert.deepEqual(cappedStat(" plugin/a.md | 1 +\n 1 file changed, 1 insertion(+)"), [" plugin/a.md | 1 +", " 1 file changed, 1 insertion(+)"]);
  });
});

describe("issue plan", () => {
  const body = "## omc\n\nPinned v5.7.5.";
  const summary = "The contract holds. Only a bookkeeping minor release is left.";

  test("creates the issue, without a comment, when an upstream is newer and none is open", () => {
    assert.deepEqual(issuePlan({ open: [], body, newer: true, summary }), [{ act: "create" }]);
  });

  test("edits the newest open issue and comments when the body changed", () => {
    const open = [
      { number: 9, body: "old report" },
      { number: 4, body: "older report" },
    ];
    assert.deepEqual(issuePlan({ open, body, newer: true, summary }), [
      { act: "edit", number: 9 },
      { act: "comment", number: 9, text: `The upstream report changed. ${summary}` },
    ]);
  });

  test("does nothing when only an upstream commit SHA in a link moved", () => {
    const report = (sha) => `## pstack\n\nThe vendored files match [main](https://github.com/cursor/plugins/tree/${sha}).`;
    const open = [{ number: 9, body: report("a".repeat(40)) }];
    assert.deepEqual(issuePlan({ open, body: report("b".repeat(40)), newer: true, summary }), []);
  });

  test("does nothing when the body is unchanged, even with CRLF line endings or a trailing newline", () => {
    for (const stored of [body, `${body}\n`, body.replace(/\n/g, "\r\n")]) {
      assert.deepEqual(issuePlan({ open: [{ number: 9, body: stored }], body, newer: true, summary }), []);
    }
  });

  test("closes every open issue once the pins are current, and does nothing when none is open", () => {
    const open = [{ number: 9, body }, { number: 4, body }];
    assert.deepEqual(issuePlan({ open, body, newer: false, summary }), [{ act: "close", number: 9 }, { act: "close", number: 4 }]);
    assert.deepEqual(issuePlan({ open: [], body, newer: false, summary }), []);
  });
});

describe("publish", { skip: process.platform === "win32" && "the stub gh is a POSIX script" }, () => {
  const TITLE = "Upstream update available";
  const body = "## omc\n\nPinned v5.7.5.";
  const summary = "The contract holds. Only a bookkeeping minor release is left.";
  const ours = [
    { number: 2, title: TITLE, body },
    { number: 1, title: TITLE, body: "older report" },
  ];

  // Only `--author github-actions[bot]` finds the workflow's issues. A list without any author filter also returns an issue a
  // stranger opened with the same title. The token and repo are invalid so that a gh which escapes the stub can only fail.
  function stubGh(t) {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "watch-gh-")));
    const log = join(dir, "calls.log");
    mkdirSync(join(dir, "bin"));
    writeFileSync(
      join(dir, "bin", "gh"),
      `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require("node:fs");
const args = process.argv.slice(2);
const listing = args[0] === "issue" && args[1] === "list";
if (!listing) readFileSync(0);
appendFileSync(process.env.STUB_LOG, JSON.stringify(args) + "\\n");
if (listing) {
  const own = args[args.indexOf("--author") + 1] === "github-actions[bot]";
  const filtered = ["--app", "--search", "--author"].some((flag) => args.includes(flag));
  const stranger = { number: 7, title: ${JSON.stringify(TITLE)}, body: "opened by someone else" };
  console.log(JSON.stringify(own ? ${JSON.stringify(ours)} : filtered ? [] : [stranger, ...${JSON.stringify(ours)}]));
}
`,
    );
    chmodSync(join(dir, "bin", "gh"), 0o755);
    const saved = { PATH: process.env.PATH, STUB_LOG: process.env.STUB_LOG, GH_TOKEN: process.env.GH_TOKEN, GH_REPO: process.env.GH_REPO };
    process.env.PATH = [join(dir, "bin"), dirname(process.execPath), saved.PATH].join(delimiter);
    process.env.STUB_LOG = log;
    process.env.GH_TOKEN = "invalid";
    process.env.GH_REPO = "invalid/invalid";
    t.after(() => {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      rmSync(dir, { recursive: true, force: true });
    });
    return () => {
      const calls = (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []).map((line) => JSON.parse(line));
      assert.ok(calls.some(([noun, verb]) => noun === "issue" && verb === "list"), "the stub gh ran");
      return calls.filter(([, verb]) => verb !== "list").map((args) => args.slice(0, 3).join(" "));
    };
  }

  test("finds the issue the workflow opened, so an unchanged report opens no second one", (t) => {
    const changes = stubGh(t);
    publish({ newer: true, body, summary });
    assert.deepEqual(changes(), []);
  });

  test("edits the issue the workflow opened, and comments, when the report changed", (t) => {
    const changes = stubGh(t);
    publish({ newer: true, body: `${body}\n\nMore.`, summary });
    assert.deepEqual(changes(), ["issue edit 2", "issue comment 2"]);
  });

  test("closes the issues the workflow opened once the pins are current", (t) => {
    const changes = stubGh(t);
    publish({ newer: false, body, summary });
    assert.deepEqual(changes(), ["issue close 2", "issue close 1"]);
  });
});
