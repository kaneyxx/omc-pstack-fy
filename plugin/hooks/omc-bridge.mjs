#!/usr/bin/env node

// SessionStart hook. While oh-my-claudecode (OMC) is installed and enabled, it injects omc-bridge.md, which makes OMC's
// workflows hand code units and deslop to omc-pstack-fy and add interrogate to the final code review. When the installed OMC is neither the version
// the bridge was checked against nor another one that passed the same contract (omc-version.json, written by the build), it says
// so to the model and, at startup, to the user. A hook must never block a session, so any error, missing file, or unparsable JSON
// ends the script with exit 0 and no output.

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isatty } from "node:tty";
import { fileURLToPath } from "node:url";

const OMC = "oh-my-claudecode@omc";
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const skill = (name) => `\`${join(ROOT, "skills", name, "SKILL.md")}\``;

// A missing or unparsable file counts as absent, so one bad settings file cannot hide the others.
function readJson(path) {
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
  } catch {
    return undefined;
  }
}

function readInput() {
  try {
    return isatty(0) ? {} : JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}

// The OMC install that applies here (this project's own, else the user's), unless the most specific settings file that sets
// its enabledPlugins key turns it off, as in Claude Code. Managed settings are not read.
function omcInstall(project) {
  const config = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const installs = readJson(join(config, "plugins", "installed_plugins.json"))?.plugins?.[OMC];
  if (!Array.isArray(installs)) return undefined;
  // Compare real paths, so a project reached through a symlink still matches its own install.
  const real = (path) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };
  const user = (install) => !install.projectPath || install.scope === "user";
  const install = installs.find((install) => !user(install) && real(install.projectPath) === real(project)) ?? installs.find(user);
  if (!install) return undefined;
  for (const path of [join(project, ".claude", "settings.local.json"), join(project, ".claude", "settings.json"), join(config, "settings.json")]) {
    const enabled = readJson(path)?.enabledPlugins?.[OMC];
    if (enabled !== undefined) return enabled === false ? undefined : install;
  }
  return install;
}

// X.Y.Z as numbers, ignoring a -prerelease or +build suffix, or undefined for anything else.
const parse = (version) => {
  const match = typeof version === "string" ? version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/) : null;
  return match ? match.slice(1).map(Number) : undefined;
};

const bare = (version) => String(version).replace(/^v/, "");

// A note for the model whenever the installed version is neither the verified one nor in the compatible list, and advice for the
// user, which depends on which side is behind. A version it cannot read gets the note but no advice, rather than the wrong advice.
// A compatible list that is not an array counts as empty, and an entry that is not a string is ignored. An installed version that
// is not a string matches nothing.
function mismatch(installed, verified, compatible) {
  if (installed === undefined || !verified) return {};
  const checked = [verified, ...(Array.isArray(compatible) ? compatible.filter((version) => typeof version === "string") : [])];
  if (typeof installed === "string" && checked.some((version) => bare(version) === bare(installed))) return {};
  const [x, y] = [parse(installed), parse(verified)];
  const order = x && y ? x.map((n, i) => n - y[i]).find((n) => n !== 0) ?? 0 : undefined;
  const advice =
    order === undefined || order === 0
      ? "Check both plugins with /plugin."
      : order > 0
        ? `Update omc-pstack-fy once a release checked against ${installed} is out. Until then, OMC keeps its own choice wherever a name changed.`
        : "Update oh-my-claudecode with /plugin.";
  return {
    note: `\nThis bridge was checked against oh-my-claudecode ${verified}, and ${installed} is installed. Where an agent, step, or gate named here no longer exists, keep OMC's own choice for that step.\n`,
    user: `omc-pstack-fy's bridge was checked against oh-my-claudecode ${verified}, but ${installed} is installed. ${advice}`,
  };
}

try {
  const input = readInput();
  // Claude Code sets CLAUDE_PROJECT_DIR for hooks. Otherwise the hook input's cwd, or the current directory in a manual run.
  const install = omcInstall(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (install) {
    const bridge = readFileSync(join(HERE, "omc-bridge.md"), "utf8").replace(/\{\{skill:([a-z0-9-]+)\}\}/g, (_, name) => skill(name));
    // The version check must never cost the bridge itself.
    let note = "";
    let user;
    try {
      const stamp = readJson(join(HERE, "omc-version.json"));
      ({ note = "", user } = mismatch(install.version, stamp?.verified, stamp?.compatible));
    } catch {
      // No note.
    }
    const output = { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `${bridge}${note}` } };
    if (user && (input.source ?? "startup") === "startup") output.systemMessage = user;
    process.stdout.write(`${JSON.stringify(output)}\n`);
  }
} catch {
  // Stay silent and let the session start.
}
