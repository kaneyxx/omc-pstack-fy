#!/usr/bin/env node
// The fake gh and claude behind shim.sh. gh keeps one JSON file per GitHub release in the world's gh/ folder and reads tags
// from the fixture's bare origin. claude tags HEAD the way `claude plugin tag` does. Anything else is written to the run's
// `unmodeled` file, so a call the fakes do not model stops the run with a FixtureError and never passes silently.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [tool, ...args] = process.argv.slice(2);
const { REAL_GIT, RELEASE_STATE, RELEASE_RUN } = process.env;
const ORIGIN = join(RELEASE_STATE, "origin.git");
const git = (...gitArgs) => execFileSync(REAL_GIT, gitArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const succeeds = (...gitArgs) => {
  try {
    git(...gitArgs);
    return true;
  } catch {
    return false;
  }
};
const stop = (message) => {
  console.error(message);
  process.exit(1);
};
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const flagValue = (flag) => args[args.indexOf(flag) + 1];

if (args[0] === "--version") {
  console.log(`fake ${tool} for the release fixture`);
} else if (tool === "gh" && args[0] === "release" && args[1] === "create") {
  const tag = args[2];
  const file = join(RELEASE_STATE, "gh", `${tag}.json`);
  if (existsSync(file)) stop(`a release with the same tag name already exists: ${tag}`);
  const onOrigin = succeeds("--git-dir", ORIGIN, "rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`);
  if (!onOrigin && args.includes("--verify-tag")) stop(`tag ${tag} doesn't exist in the repo, aborting due to --verify-tag flag`);
  // Without --verify-tag, GitHub creates a missing tag at the default branch's head.
  if (!onOrigin) git("--git-dir", ORIGIN, "tag", tag, "main");
  const commit = git("--git-dir", ORIGIN, "rev-parse", `refs/tags/${tag}^{commit}`);
  writeFileSync(file, `${JSON.stringify({ tag, commit, title: flagValue("--title"), notes: readFileSync(flagValue("--notes-file"), "utf8") }, null, 2)}\n`);
} else if (tool === "claude" && args[0] === "plugin" && args[1] === "tag") {
  const { name, version } = readJson(join(args[2], ".claude-plugin", "plugin.json"));
  const listed = readJson(join(".claude-plugin", "marketplace.json")).plugins.find((plugin) => plugin.name === name)?.version;
  if (listed !== version) stop(`plugin.json says ${version}, but the marketplace entry says ${listed}`);
  // Measured on Claude Code 2.1.327, the real tagger refuses only when the plugin folder or the marketplace file is dirty.
  if (git("status", "--porcelain", "--", args[2], join(".claude-plugin", "marketplace.json"))) stop(`${args[2]}/ or .claude-plugin/marketplace.json has uncommitted changes`);
  const tag = `${name}--v${version}`;
  if (succeeds("rev-parse", "-q", "--verify", `refs/tags/${tag}`)) stop(`tag ${tag} already exists`);
  git("tag", "-a", tag, "-m", flagValue("-m").replace("%s", version));
} else {
  appendFileSync(join(RELEASE_RUN, "unmodeled"), `the fake ${tool} does not model \`${tool} ${args.join(" ")}\`\n`);
  process.exit(97);
}
