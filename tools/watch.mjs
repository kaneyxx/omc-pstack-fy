#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain, latest, NEWER } from "./sync.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TITLE = "Upstream update available";
const CLOSED = "The pins match the newest pstack and oh-my-claudecode.";
// The version the hook compares against the installed OMC. Every OMC sync rewrites it, so it alone does not call for a review.
const STAMP = "plugin/hooks/omc-version.json";
const BUILD = "node tools/build.mjs";
const TESTS = "node --test tests/*.test.mjs";
const LIMIT = 30;
const USAGE = `node tools/watch.mjs           print the upstream report with a verdict on whether syncing breaks anything
                                (exit 0 when the pins are current, 3 when an upstream is newer). The sync runs in a scratch
                                copy of the working tree, so nothing in this checkout changes.
node tools/watch.mjs --issue   also open, update, or close the "${TITLE}" issue with gh. Meant for the workflow: it only
                                touches issues that GitHub Actions opened.`;

const STAGES = {
  sync: { says: "The sync fails to run.", fix: "Rerun it. If it fails again, check `paths` and `versionFile` for that upstream in `upstream.json`." },
  build: { says: "The build fails.", fix: "Fix each FAIL line in `tools/rules/`, `overlays/`, or `tools/omc.json`, then rerun it." },
  tests: { says: "The tests fail.", fix: "Fix each failing test, or the code it covers, then rerun it." },
};

const fence = (lines, language = "") => ["```" + language, ...lines, "```"].join("\n");
const capped = (lines) => (lines.length > LIMIT ? [...lines.slice(0, LIMIT), `and ${lines.length - LIMIT} more`] : lines);

function parseArgs(argv) {
  const options = { issue: false };
  for (const arg of argv) {
    if (arg === "--help") options.help = true;
    else if (arg === "--issue") options.issue = true;
    else throw new Error(`unknown argument ${JSON.stringify(arg)}\n${USAGE}`);
  }
  return options;
}

// The tail of an output, for a crash that printed no FAIL line.
const tail = (output) => output.split("\n").filter((line) => line.trim()).slice(-10);

// build.mjs and sync.mjs print each problem as one FAIL line.
export function failLines(output) {
  const lines = output.split("\n").filter((line) => line.startsWith("FAIL "));
  return lines.length > 0 ? lines : tail(output);
}

// The failing tests in node's TAP output, as `suite > test`. Node prints a subtest before its parent, so a failing
// suite is dropped when one of its tests fails too.
export function testFailures(tap) {
  const stack = [];
  const failed = [];
  for (const line of tap.split("\n")) {
    const subtest = line.match(/^( *)# Subtest: (.*)$/);
    if (subtest) stack.splice(subtest[1].length / 4, Infinity, subtest[2]);
    const bad = line.match(/^( *)not ok \d+ - (.*?)(?: # .*)?$/);
    if (bad) failed.push([...stack.slice(0, bad[1].length / 4), bad[2]]);
  }
  const names = failed.filter((path) => !failed.some((other) => other.length > path.length && path.every((part, i) => other[i] === part)));
  return [...new Set(names.map((path) => path.join(" > ")))];
}

// GitHub caps an issue body at 65536 characters, so a big sync keeps only the first LIMIT files of the stat and its summary line.
export function cappedStat(stat) {
  const lines = stat.split("\n").filter(Boolean);
  if (lines.length <= LIMIT + 1) return lines;
  return [...lines.slice(0, LIMIT), `... and ${lines.length - LIMIT - 1} more files`, lines.at(-1)];
}

function kindOf({ problems, changed }) {
  if (problems.length > 0) return "broken";
  return changed.some((path) => path !== STAMP) ? "review" : "bookkeeping";
}

const VERDICTS = {
  bookkeeping: ({ changed, commands }) => ({
    summary: "The contract holds. Only a bookkeeping minor release is left.",
    body: [
      `\`${BUILD}\` and \`${TESTS}\` pass, and ${changed.length > 0 ? `\`plugin/\` changes only in \`${STAMP}\`` : "`plugin/` does not change"}.`,
      "Release it with:",
      fence([...commands, "node tools/release.mjs minor"], "sh"),
    ],
  }),
  review: ({ stat, commands }) => ({
    summary: "The contract holds, but the sync changes plugin files. Review them before releasing.",
    body: [
      `\`${BUILD}\` and \`${TESTS}\` pass, but the sync changes these \`plugin/\` files (\`git diff --stat -- plugin/\`):`,
      fence(cappedStat(stat)),
      "Review them, then release with:",
      fence([...commands, "git diff --stat -- plugin/", "node tools/release.mjs minor"], "sh"),
    ],
  }),
  broken: ({ problems, commands }) => ({
    summary: `${problems.map(({ stage }) => STAGES[stage].says).join(" ")} Fix ${problems.length > 1 ? "those" : "that"} before releasing.`,
    body: [
      ...problems.flatMap(({ stage, command, lines }) => [
        `### \`${command}\` fails`,
        STAGES[stage].fix,
        fence(capped(lines)),
      ]),
      "Reproduce it with:",
      fence(commands, "sh"),
    ],
  }),
};

// The verdict section of the issue. `problems` holds one { stage, command, lines } per failed stage, `changed` the plugin/
// files the build rewrote, and `stat` their git diff --stat.
export function verdict({ behind, problems, changed, stat }) {
  const commands = [...behind.map((name) => `node tools/sync.mjs ${name}`), BUILD, TESTS];
  const kind = kindOf({ problems, changed });
  const { summary, body } = VERDICTS[kind]({ problems, changed, stat, commands });
  const intro = "The sync ran in a scratch copy, then the build and the tests.";
  return { kind, summary, markdown: ["## Verdict", `**${summary}**`, intro, ...body].join("\n\n") };
}

// An open issue's body counts as unchanged when only line endings or trailing space differ, which GitHub rewrites, or a
// commit SHA in a link, which moves with every upstream commit even when the vendored files and the verdict stay the same.
const normal = (body) => body.replace(/\r\n/g, "\n").replace(/\/tree\/[0-9a-f]{40}\b/g, "/tree/<sha>").trim();

// What to do with the open issues titled TITLE. The comment on an edit is what notifies people, because an edit alone does not.
export function issuePlan({ open, body, newer, summary }) {
  if (!newer) return open.map(({ number }) => ({ act: "close", number }));
  const [current] = open;
  if (!current) return [{ act: "create" }];
  if (normal(current.body) === normal(body)) return [];
  return [{ act: "edit", number: current.number }, { act: "comment", number: current.number, text: `The upstream report changed. ${summary}` }];
}

function gh(args, input) {
  const result = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8", input });
  if (result.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} failed\n${result.stderr ?? result.error}`);
  return result.stdout;
}

const ACTIONS = {
  create: (_, body) => gh(["issue", "create", "--title", TITLE, "--body-file", "-"], body),
  edit: ({ number }, body) => gh(["issue", "edit", String(number), "--body-file", "-"], body),
  comment: ({ number, text }) => gh(["issue", "comment", String(number), "--body", text]),
  close: ({ number }) => gh(["issue", "close", String(number), "--comment", CLOSED]),
};

export function publish({ newer, body, summary }) {
  // The repo is public, so anyone can open an issue with this title. Only the workflow's own issues count. `--app` matches
  // nothing here, because the bot's login is `github-actions[bot]`.
  const listed = JSON.parse(gh(["issue", "list", "--state", "open", "--author", "github-actions[bot]", "--limit", "200", "--json", "number,title,body"]));
  const open = listed.filter(({ title }) => title === TITLE);
  for (const action of issuePlan({ open, body, newer, summary })) ACTIONS[action.act](action, body);
}

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed\n${result.stderr ?? result.error}`);
  return result.stdout.trimEnd();
}

// The working tree minus what .gitignore hides, so a local run tries the sync on edits that are not committed yet.
function copyTree(into) {
  const files = git(ROOT, "ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0").filter((file) => file && existsSync(join(ROOT, file)));
  for (const file of files) {
    mkdirSync(dirname(join(into, file)), { recursive: true });
    cpSync(join(ROOT, file), join(into, file));
  }
}

// Paths and temp folder names differ on every run, and a changing body would comment on the issue every day.
export const tidy = (text, dir) =>
  text.replaceAll(`file://${dir}/`, "").replaceAll(`${dir}/`, "").replaceAll(dir, ".").replace(/\S*omc-pstack-fy-sync-\w+/g, "<tmp>");

// Sync each upstream that is behind in a copy, then build and test it. Nothing here touches the checkout.
function trial(behind, dir) {
  copyTree(dir);
  git(dir, "init", "-q");
  git(dir, "add", "-A", "plugin");
  // The build and tests need no GitHub token, so a future script that runs upstream code never sees one.
  const { GH_TOKEN, GITHUB_TOKEN, ...env } = process.env;
  const run = (...args) => spawnSync(process.execPath, args, { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26, env });
  const problems = [];
  const check = (stage, command, result, lines = failLines) => {
    if (result.status !== 0) problems.push({ stage, command, lines: lines(tidy(`${result.stdout}\n${result.stderr}`, dir)) });
  };
  for (const name of behind) check("sync", `node tools/sync.mjs ${name}`, run("tools/sync.mjs", name));
  if (problems.length > 0) return { problems, changed: [], stat: "" };
  check("build", BUILD, run("tools/build.mjs"));
  const tests = readdirSync(join(dir, "tests")).filter((name) => name.endsWith(".test.mjs")).sort().map((name) => join("tests", name));
  check("tests", TESTS, run("--test", "--test-reporter=tap", ...tests), (output) => {
    const failed = testFailures(output);
    return failed.length > 0 ? failed : tail(output);
  });
  if (problems.length > 0) return { problems, changed: [], stat: "" };
  git(dir, "add", "-N", "--", "plugin");
  return {
    problems,
    changed: git(dir, "diff", "--name-only", "--", "plugin/").split("\n").filter(Boolean),
    stat: git(dir, "diff", "--stat=100,70", "--", "plugin/"),
  };
}

function report(pins, dir) {
  const upstreams = latest(pins, dir);
  const behind = upstreams.filter(({ newer }) => newer).map(({ name }) => name);
  const sections = upstreams.map(({ section }) => section);
  if (behind.length === 0) return { newer: false, body: sections.join("\n\n") };
  const { summary, markdown } = verdict({ behind, ...trial(behind, join(dir, "trial")) });
  return { newer: true, body: [...sections, markdown].join("\n\n"), summary };
}

function main() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "omc-pstack-fy-watch-")));
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) return console.log(USAGE);
    const result = report(JSON.parse(readFileSync(join(ROOT, "upstream.json"), "utf8")), dir);
    console.log(result.body);
    if (options.issue) publish(result);
    process.exitCode = result.newer ? NEWER : 0;
  } catch (error) {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (isMain(import.meta.url)) main();
