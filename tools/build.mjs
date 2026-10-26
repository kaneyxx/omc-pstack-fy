#!/usr/bin/env node

import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { compatibleVersions, contractHash, isCompatibleList, omcProblems, readContract, vendoredOmc } from "./omc.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_ROOT = join(ROOT, "vendor");
const VENDOR = join(VENDOR_ROOT, "pstack");
const RULES = join(ROOT, "tools", "rules");
const OVERLAYS = join(ROOT, "overlays");
const OUT = join(ROOT, "plugin");
const BASELINE = join(ROOT, "tools", "denylist-baseline.json");
const LOCK = join(ROOT, "tools", "version-lock.json");
const MARKETPLACE = join(ROOT, ".claude-plugin", "marketplace.json");
const PACKAGE = join(ROOT, "package.json");
const MANIFEST = ".claude-plugin/plugin.json";
const OMC_VERSION = "hooks/omc-version.json";
const ADAPTER = "docs/harness/claude-code.md";
const COMMAND = "node tools/build.mjs";
const LINK = /\]\(([^)\s]+)\)/g;
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A slash command starts a line or follows whitespace, emphasis, a quote, an opening bracket, or a backtick. Anything else is a path.
const BEFORE_COMMAND = String.raw`\s*"'(\[` + "`";
const ROUTE_KEY = "Run another pstack skill";
const { pstack: upstream, omc } = JSON.parse(readFileSync(join(ROOT, "upstream.json"), "utf8"));

// tools/rules.json holds the plugin settings. Each tools/rules/*.json file owns one topic's edits, substitutions, and forks,
// applied in file-name order, so parallel work never touches the same rules file.
function loadRules() {
  const base = JSON.parse(readFileSync(join(ROOT, "tools", "rules.json"), "utf8"));
  const topics = existsSync(RULES) ? readdirSync(RULES).filter((name) => name.endsWith(".json")).sort() : [];
  const merged = { ...base, edits: [], substitutions: [], allow: [], forks: { ...base.forks } };
  for (const name of topics) {
    const topic = JSON.parse(readFileSync(join(RULES, name), "utf8"));
    merged.edits.push(...(topic.edits ?? []).map((edit) => ({ ...edit, rules: name })));
    merged.substitutions.push(
      ...(topic.substitutions ?? []).map((rule) => ({ except: topic.except ?? [], optional: topic.optional ?? false, ...rule, rules: name })),
    );
    merged.allow.push(...(topic.allow ?? []).map((rule) => ({ ...rule, rules: name })));
    for (const [path, hash] of Object.entries(topic.forks ?? {})) {
      if (path in merged.forks) throw new Error(`fork ${path} is registered twice, again in tools/rules/${name}`);
      merged.forks[path] = hash;
    }
  }
  return merged;
}
const rules = loadRules();
// Flags: --check, --skip-release-lock (only with --check), --release, --report, --update-baseline.
const args = new Set(process.argv.slice(2));
const checking = args.has("--check");
const skippingLock = checking && args.has("--skip-release-lock");
const problems = [];
if (args.has("--skip-release-lock") && !checking) problems.push("--skip-release-lock only applies to --check. A plain build never fails on the release lock.");

// Cursor names that Claude Code does not understand. The adapter translates them at runtime until a native rewrite removes them.
// Counted terms ratchet: a build that adds a hit fails. The agent names only decide whether a skill needs the adapter.
// A vendor-qualified model such as `codex:gpt-5-codex` is a pstack-ask role value, not a Cursor slug, so the slug terms skip it.
const TERMS = [
  { key: "`Task`", re: /`Task`|\bTask (tool|subagent|call|spawn)/g },
  { key: "`AskQuestion`", re: /AskQuestion/g },
  { key: "todolist", re: /\btodolist\b/gi },
  { key: "generalPurpose", re: /generalPurpose/g },
  { key: "poteto-agent", re: /(?<![\w:-])poteto-agent/g, counted: false },
  { key: "comment-sicko", re: /(?<![\w:-])comment-sicko/g, counted: false },
  { key: "`readonly: true`", re: /readonly: (true|false)|readonly\/Ask/g },
  { key: "`environment: \"cloud\"`", re: /environment: "(cloud|local)"/g },
  { key: "cloud_base_branch", re: /cloud_base_branch/g },
  { key: "`resume`", re: /`resume`/g },
  { key: "`file_attachments`", re: /file_attachments/g },
  { key: "claude-", re: /(?<!:)\bclaude-[a-z]+-\d/g },
  { key: "grok-", re: /(?<!:)\bgrok-\d/g },
  { key: "gpt-", re: /(?<!:)\bgpt-\d/g },
  { key: "inherit-parent", re: /inherit-parent/g },
  { key: "pstack-models.mdc", re: /pstack-models\.mdc/g },
  { key: ".cursor/skills/", re: /\.cursor\/skills/g },
  { key: "~/.cursor/plugins/", re: /\.cursor\/plugins|\.cursor-plugin/g },
  { key: ".cursor/rules/", re: /\.cursor\/rules|always-applied rule/g },
  { key: "agent-transcripts", re: /agent-transcripts|\.cursor\/projects/g },
  { key: "Cursor-only features", re: /Bugbot|Cursor [Aa]utomation|cursor\.(sh|com)\/automations|[Cc]loud [Aa]gent|built-in PR tool/g },
  { key: "cursor-team-kit", re: /cursor-team-kit/g },
  { key: "create-skill", re: /(?<![\w-])create-skill\b/g },
  { key: "Cursor built-ins", re: /[Cc]ustom [Mm]ode|\/visualize|Cursor'?s? built-in|image.generation/g },
  { key: "other .cursor/ paths", re: /\.cursor\/(?!skills|plugins|rules|projects)|Application Support\/Cursor/g },
];

const toPosix = (path) => path.split(sep).join("/");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const under = (path, prefix) => path === prefix || path.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
const text = (entry) => entry.bytes.toString("utf8");
const markdown = (files) => [...files].filter(([path]) => path.endsWith(".md"));
const escape = (literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    if (name === ".DS_Store" || name === "node_modules" || name === ".gitkeep") return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function load(path) {
  return { bytes: readFileSync(path), executable: (statSync(path).mode & 0o111) !== 0 };
}

// Lists plugin/ as a checkout holds it, counting every name. The build writes only regular files, so a link, another
// non-regular file, or an empty folder (what a submodule leaves in a checkout without submodules) maps to null and counts as drift.
function installed(dir, base = dir) {
  if (!existsSync(dir)) return new Map();
  const entries = readdirSync(dir, { withFileTypes: true });
  if (entries.length === 0 && dir !== base) return new Map([[toPosix(relative(base, dir)), null]]);
  return new Map(
    entries.flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return [...installed(path, base)];
      return [[toPosix(relative(base, path)), entry.isFile() ? load(path) : null]];
    }),
  );
}

// Maps each plugin path to the vendored file it comes from. Imports bring skills from other upstream folders, such as cursor-team-kit.
const sources = new Map();

function select() {
  const included = (path) =>
    rules.include.some((prefix) => under(path, prefix)) &&
    !rules.exclude.some(({ path: prefix }) => under(path, prefix)) &&
    (rules.adapter || path !== ADAPTER);
  for (const path of walk(VENDOR).map((path) => toPosix(relative(VENDOR, path))).filter(included)) sources.set(path, join(VENDOR, path));
  for (const { from, to } of rules.imports ?? []) {
    const files = walk(join(VENDOR_ROOT, from));
    if (files.length === 0) problems.push(`import ${from} has no files in vendor/`);
    for (const source of files) sources.set(`${to}${toPosix(relative(join(VENDOR_ROOT, from), source))}`, source);
  }
  return new Map([...sources].map(([path, source]) => [path, load(source)]));
}

// A fork replaces an upstream file with overlays/<path>. Pinning the upstream hash makes an upstream change to that file fail the build until someone merges it.
function applyOverlays(files) {
  for (const [path, hash] of Object.entries(rules.forks)) {
    const source = sources.get(path) ?? join(VENDOR, path);
    if (!existsSync(join(OVERLAYS, path))) problems.push(`fork ${path} has no overlays/${path}`);
    if (!existsSync(source)) problems.push(`fork ${path}: upstream deleted it. Drop the fork, or keep the file as a plain overlay.`);
    else if (sha256(readFileSync(source)) !== hash) {
      problems.push(`fork ${path}: upstream changed it. Merge the change into overlays/${path}, then set its hash to ${sha256(readFileSync(source))}.`);
    }
  }
  const paths = walk(OVERLAYS).map((path) => toPosix(relative(OVERLAYS, path)));
  for (const path of paths) {
    if ((sources.has(path) || existsSync(join(VENDOR, path))) && !(path in rules.forks)) {
      problems.push(`overlays/${path} shadows an upstream file. Register it in rules.json forks with its upstream hash.`);
    }
    files.set(path, load(join(OVERLAYS, path)));
  }
  return new Set(paths);
}

// Edits run on upstream text, so an upstream rewrite of the matched passage fails loudly instead of silently skipping.
function applyEdits(files, ours) {
  for (const { file, find, replace, count = 1, rules: from } of rules.edits) {
    if (ours.has(file)) {
      problems.push(`edit target ${file} (tools/rules/${from}) is an overlay. Make the change in overlays/${file} instead.`);
      continue;
    }
    const entry = files.get(file);
    if (!entry) {
      problems.push(`edit target ${file} (tools/rules/${from}) is not in the tree`);
      continue;
    }
    const parts = text(entry).split(find);
    if (parts.length - 1 !== count) {
      problems.push(`edit in ${file} (tools/rules/${from}) expected ${count} match of ${JSON.stringify(find.slice(0, 70))}, found ${parts.length - 1}`);
      continue;
    }
    entry.bytes = Buffer.from(parts.join(replace));
  }
}

// Upstream names a skill in prose as "the **how** skill". Linking each mention to its SKILL.md tells the model what to Read,
// because the Skill tool refuses pstack's hidden skills.
function linkSkillMentions(files, skills) {
  const mention = new RegExp(`(?<!\\[)the \\*\\*(${skills.join("|")})\\*\\* skill(?![\\]\\w])`, "g");
  let linked = 0;
  for (const [path, entry] of markdown(files)) {
    const body = text(entry).replace(mention, (match, name) => {
      linked++;
      return `the [**${name}**](${posix.relative(posix.dirname(path), `skills/${name}/SKILL.md`)}) skill`;
    });
    entry.bytes = Buffer.from(body);
  }
  return linked;
}

// The Skill tool refuses a hidden skill and tells the model not to reproduce it, so a model reading "run `/omc-pstack-fy:deslop`"
// could skip the step. Linking each command to its SKILL.md gives the user the command and the model the file to Read.
function linkCommands(files, skills) {
  const command = new RegExp(`(?<!\\[)\`/${rules.plugin.name}:(${skills.join("|")})\`(?!\\]\\()`, "g");
  let linked = 0;
  for (const [path, entry] of markdown(files)) {
    const parts = text(entry).split(/(^```[\s\S]*?^```)/m);
    for (let i = 0; i < parts.length; i += 2) {
      parts[i] = parts[i].replace(command, (match, name) => {
        linked++;
        return `[${match}](${posix.relative(posix.dirname(path), `skills/${name}/SKILL.md`)})`;
      });
    }
    entry.bytes = Buffer.from(parts.join(""));
  }
  return linked;
}

// The skills whose files point the model at another skill, by command or by link.
function findRoutes(files, skills) {
  return skills.filter((skill) => {
    const others = skills.filter((name) => name !== skill);
    return markdown(files).some(
      ([path, entry]) =>
        under(path, `skills/${skill}`) &&
        others.some((name) => text(entry).includes(`${name}/SKILL.md)`) || text(entry).includes(`/${rules.plugin.name}:${name}`)),
    );
  });
}

// An `allow` rule keeps a justified mention, such as naming Cursor's Bugbot as one review bot among others.
function hits(path, entry, { key, re }) {
  const allowed = rules.allow.filter((rule) => rule.file === path && rule.key === key).reduce((sum, { count }) => sum + count, 0);
  return Math.max(0, (text(entry).match(re)?.length ?? 0) - allowed);
}

function checkAllowances(files) {
  for (const { file, key, count, rules: from } of rules.allow) {
    const term = TERMS.find((term) => term.key === key);
    const found = files.get(file) && term ? text(files.get(file)).match(term.re)?.length ?? 0 : 0;
    if (!term || found < count) problems.push(`allow ${key} x${count} in ${file} (tools/rules/${from}) is stale: found ${found}`);
  }
}

// Per skill, the Cursor names left after substitutions. Each needs the adapter until a native rewrite removes it.
function findCursorNames(files, skills) {
  const uses = new Map();
  for (const skill of skills) {
    const keys = new Set();
    for (const [path, entry] of markdown(files)) {
      if (under(path, `skills/${skill}`)) for (const term of TERMS) if (hits(path, entry, term) > 0) keys.add(term.key);
    }
    if (keys.size > 0) uses.set(skill, keys);
  }
  const adapter = files.get(ADAPTER) ? text(files.get(ADAPTER)) : "";
  for (const [skill, keys] of uses) {
    for (const key of keys) {
      if (!rules.adapter) problems.push(`skills/${skill} still uses the Cursor name ${key}, and the adapter is off`);
      else if (!adapter.includes(key)) problems.push(`the Claude Code adapter has no row for ${key}, used by skills/${skill}`);
    }
  }
  return uses;
}

function applySubstitutions(files, skills) {
  const command = new RegExp(`(?<![^${BEFORE_COMMAND}])/(${skills.join("|")})(?![\\w-])`, "g");
  const rewrites = [
    ...rules.substitutions.map(({ find, regex, replace, count, except, optional, rules: from }) => ({
      label: `${regex ?? find} (tools/rules/${from})`,
      re: new RegExp(regex ?? escape(find), "g"),
      replace,
      count,
      except,
      optional,
    })),
    { label: "/<skill> commands", re: command, replace: `/${rules.plugin.name}:$1`, except: [] },
  ];
  const counts = new Map(rewrites.map(({ label }) => [label, 0]));
  for (const [path, entry] of markdown(files)) {
    let body = text(entry);
    for (const { label, re, replace, except } of rewrites) {
      if (except.includes(path)) continue;
      counts.set(label, counts.get(label) + (body.match(re)?.length ?? 0));
      body = body.replace(re, replace);
    }
    entry.bytes = Buffer.from(body);
  }
  // A targeted substitution that matches nothing means upstream reworded it. An optional one, such as a global Cursor-name
  // translation, matching nothing only means upstream or a per-file rule no longer uses that name.
  for (const { label, count, optional } of rewrites) {
    const found = counts.get(label);
    if (count === undefined ? found === 0 && !optional : found !== count) {
      problems.push(`substitution ${JSON.stringify(label)} matched ${found} times${count === undefined ? "" : `, expected ${count}`}. Did upstream reword it?`);
    }
  }
  return counts;
}

// A skill with Cursor names gets the adapter line. A skill that only names other skills gets the shorter native routing note.
function injectGuidance(files, routes, uses) {
  const adapterLine =
    `In Claude Code, read [the Claude Code adapter](../../${ADAPTER}) once per session before you follow this skill. ` +
    "It maps the Cursor names in pstack skills to Claude Code.";
  const routingNote =
    `Most ${rules.plugin.name} skills set \`disable-model-invocation: true\`, so the Skill tool refuses them. A refusal never means skip the step. ` +
    `To run a skill this one names, as \`/${rules.plugin.name}:<name>\` or as the **<name>** skill, Read \`../<name>/SKILL.md\` from this skill's base directory and follow it. ` +
    `Write \`/${rules.plugin.name}:<name>\` only when the user should type it.`;
  const counts = { adapter: 0, routing: 0 };
  for (const skill of new Set([...uses.keys(), ...routes])) {
    const kind = uses.has(skill) ? "adapter" : "routing";
    const entry = files.get(`skills/${skill}/SKILL.md`);
    if (!/^# /m.test(text(entry))) problems.push(`skills/${skill}/SKILL.md has no H1 to put the ${kind} line under`);
    entry.bytes = Buffer.from(text(entry).replace(/^(# .*)\n+/m, `$1\n\n${kind === "adapter" ? adapterLine : routingNote}\n\n`));
    counts[kind]++;
  }
  return counts;
}

// Claude Code installs only plugin/, so a relative link to an upstream file the build leaves out points at that file on GitHub, pinned to the vendored commit.
// Upstream templates hold placeholder links such as `[PR #123](url)`, so only our own overlays fail on a link to nothing.
function rewriteLinks(files, ours) {
  const inTree = (path) => path === "." || files.has(path) || [...files.keys()].some((key) => key.startsWith(`${path}/`));
  for (const [path, entry] of markdown(files)) {
    const body = text(entry).replace(LINK, (link, href) => {
      const clean = href.replace(/[#?].*/, "");
      if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith("/")) return link;
      const target = posix.normalize(posix.join(posix.dirname(path), clean)).replace(/\/$/, "");
      if (inTree(target)) return link;
      if (!target.startsWith("..") && existsSync(join(VENDOR, target))) {
        const kind = statSync(join(VENDOR, target)).isDirectory() ? "tree" : "blob";
        return `](${upstream.repository}/${kind}/${upstream.ref}/${upstream.paths[0]}/${target}${href.slice(href.search(/[#?]|$/))})`;
      }
      if (ours.has(path) || target.startsWith("..")) problems.push(`${path} links to ${href}, which is neither in plugin/ nor upstream`);
      return link;
    });
    entry.bytes = Buffer.from(body);
  }
}

// Claude Code lists a skill by its frontmatter `name`, and the Agent Skills spec limits it to SKILL_NAME, so it must equal the folder name.
function checkSkillNames(files) {
  for (const [path, entry] of files) {
    const skill = path.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1];
    if (!skill) continue;
    const frontmatter = text(entry).match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const name = frontmatter.match(/^name:(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
    if (name !== skill) problems.push(`${path} has name ${JSON.stringify(name ?? "")}, not its folder name ${skill}`);
    if (!SKILL_NAME.test(skill) || skill.length > 64) problems.push(`skills/${skill} is not lowercase words joined by hyphens, at most 64 characters`);
  }
}

// tools/omc.json records what omc-pstack-fy relies on in the oh-my-claudecode release pinned in upstream.json. The build checks it
// against vendor/, and writes that release's version for the hook, which compares it with the installed OMC. Other releases that
// passed this same contract go in beside it, so the hook stays quiet for them.
function checkOmc(files) {
  const { omcFile, ...shipped } = vendoredOmc(join(VENDOR_ROOT, omc.into));
  problems.push(...omcProblems({ contract: readContract(), version: omc.version, omcFile, ...shipped, ourFile: (path) => files.get(path)?.bytes.toString("utf8") }));
  // The version comes from the vendored release itself, and must match the pin, so the hook never names a release that is not in vendor/.
  const verified = JSON.parse(omcFile(omc.versionFile) ?? "{}").version;
  if (verified !== omc.version) problems.push(`vendor/${omc.into}/${omc.versionFile} says ${verified}, but upstream.json pins oh-my-claudecode ${omc.version}. Run \`node tools/sync.mjs omc\`.`);
  const listed = omc.compatible ?? [];
  if (!isCompatibleList(listed)) problems.push(`upstream.json lists oh-my-claudecode's compatible releases as something other than [{ "version": ..., "contract": ... }, ...]. Restore it from git.`);
  const compatible = isCompatibleList(listed) ? compatibleVersions(listed, contractHash(), verified) : [];
  files.set(OMC_VERSION, { bytes: Buffer.from(`${JSON.stringify({ verified, compatible }, null, 2)}\n`), executable: false });
}

function checkMarketplace() {
  const marketplace = JSON.parse(readFileSync(MARKETPLACE, "utf8"));
  const entry = marketplace.plugins.find(({ name }) => name === rules.plugin.name);
  if (entry?.source !== "./plugin") problems.push(`.claude-plugin/marketplace.json must list ${rules.plugin.name} with source ./plugin`);
  if (entry?.version !== rules.plugin.version) problems.push(`.claude-plugin/marketplace.json lists ${rules.plugin.name} at ${entry?.version}, not ${rules.plugin.version}`);
  const install = `/plugin install ${rules.plugin.name}@${marketplace.name}`;
  if (!rules.substitutions.some(({ replace }) => replace === install)) problems.push(`no substitution installs with ${JSON.stringify(install)}`);
}

// The npm package ships one file out of plugin/, so its version tracks the plugin and its bin must be a file the build writes.
function checkPackage(files) {
  const pkg = JSON.parse(readFileSync(PACKAGE, "utf8"));
  if (pkg.version !== rules.plugin.version) problems.push(`package.json is at ${pkg.version}, not ${rules.plugin.version}`);
  const bin = pkg.bin?.[rules.plugin.name];
  if (!bin?.startsWith("plugin/") || !files.has(bin.slice("plugin/".length))) problems.push(`package.json bin ${rules.plugin.name} must point at a file in plugin/ that the build writes, not ${JSON.stringify(bin)}`);
}

// omc-pstack-fy has its own semantic version in tools/rules.json, moved only by tools/release.mjs, which records the released
// content here with --release. Claude Code refreshes an installed plugin only when its version changes, so plugin content
// that differs from the released content must not reach main without a release. A local build only warns, so work can go on.
// A contributor's pull request changes plugin/ through a rule or an overlay but cannot release, so the pull request run of
// --check adds --skip-release-lock. That skips only the content comparison. A version that differs from the lock still fails,
// because release.mjs moves the version and the lock in one commit, so no pull request moves the version. plugin/ must still
// equal what the build generates.
function resolveVersion(files) {
  const { version } = rules.plugin;
  if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) problems.push(`tools/rules.json plugin.version must be MAJOR.MINOR.PATCH, not ${JSON.stringify(version)}`);
  const hash = createHash("sha256");
  for (const [path, { bytes, executable }] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
    if (path !== MANIFEST) hash.update(`${path}\0${executable}\0`).update(bytes);
  }
  const contentSha256 = hash.digest("hex");
  const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : {};
  if (args.has("--release")) {
    if (checking) problems.push("--release and --check cannot be combined");
    const upstreamVersion = JSON.parse(readFileSync(join(VENDOR, "plugin.json"), "utf8")).version;
    const released = { version, contentSha256, upstream: { ref: upstream.ref, version: upstreamVersion }, omc: { ref: omc.ref, version: omc.version } };
    if (!checking) writeFileSync(LOCK, `${JSON.stringify(released, null, 2)}\n`);
  } else {
    let message;
    let note;
    if (lock.version !== version) {
      message = `tools/rules.json says v${version}, but the last release is v${lock.version ?? "none"}. Let \`node tools/release.mjs\` move the version.`;
    } else if (lock.contentSha256 !== contentSha256 && !skippingLock) {
      message = `plugin content changed since the v${version} release. Run \`node tools/release.mjs patch|minor|major\` before pushing.`;
      note = `plugin content changed since the v${version} release. The maintainer releases with \`node tools/release.mjs patch|minor|major\`. Contributors do not need to.`;
    }
    if (message) {
      if (checking) problems.push(message);
      else console.log(`NOTE ${note ?? message}`);
    }
  }
  return version;
}

function writeManifest(files, version) {
  const { name, description, author, homepage, repository, keywords } = rules.plugin;
  const manifest = { name, version, description, author, homepage, repository, license: "MIT", keywords };
  files.set(MANIFEST, { bytes: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`), executable: false });
}

function countCursorNames(files) {
  const counted = TERMS.filter(({ counted }) => counted !== false);
  const counts = Object.fromEntries(counted.map(({ key }) => [key, 0]));
  const report = [];
  for (const [path, entry] of markdown(files)) {
    if (path === ADAPTER) continue;
    const found = counted.map((term) => [term.key, hits(path, entry, term)]).filter(([, n]) => n > 0);
    for (const [key, n] of found) counts[key] += n;
    if (found.length > 0) report.push([found.reduce((sum, [, n]) => sum + n, 0), path, found.map(([key, n]) => `${key} x${n}`).join(", ")]);
  }
  if (args.has("--report")) {
    for (const [n, path, detail] of report.sort((a, b) => b[0] - a[0])) console.log(`${String(n).padStart(3)} ${path}  ${detail}`);
  }
  return counts;
}

// The baseline only goes down. Only the build writes it: first run, or an explicit --update-baseline after review.
function checkRatchet(counts) {
  if (!existsSync(BASELINE)) {
    if (checking) problems.push(`tools/denylist-baseline.json is missing. Run \`${COMMAND}\`.`);
    else writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const update = args.has("--update-baseline") && !checking;
  const keys = Object.keys(counts);
  if (!update && (keys.length !== Object.keys(baseline).length || keys.some((key) => !(key in baseline)))) {
    problems.push(`tools/denylist-baseline.json keys differ from TERMS. Review, then run \`${COMMAND} --update-baseline\`.`);
  }
  const lowered = [];
  for (const key of keys.filter((key) => key in baseline)) {
    if (counts[key] > baseline[key]) problems.push(`Cursor name ${key} rose from ${baseline[key]} to ${counts[key]}. Translate the new hits.`);
    if (counts[key] < baseline[key]) lowered.push(`${key} ${baseline[key]} -> ${counts[key]}`);
  }
  if (update && problems.length === 0) writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  else if (lowered.length > 0) console.log(`Cursor names went down (${lowered.join(", ")}). Run \`${COMMAND} --update-baseline\` to lock it in.`);
}

function fail() {
  for (const problem of problems) console.log(`FAIL ${problem}`);
  if (problems.length > 0) process.exit(1);
}

const files = select();
const ours = applyOverlays(files);
applyEdits(files, ours);
const skills = [...files.keys()].map((path) => path.match(/^skills\/([^/]+)\/SKILL\.md$/)?.[1]).filter(Boolean);
const linked = linkSkillMentions(files, skills);
const substituted = applySubstitutions(files, skills);
const linkedCommands = linkCommands(files, skills);
const routes = findRoutes(files, skills);
checkAllowances(files);
const uses = findCursorNames(files, skills);
const guided = injectGuidance(files, routes, uses);
rewriteLinks(files, ours);
checkSkillNames(files);
checkOmc(files);
checkMarketplace();
checkPackage(files);
fail();
const cursorNames = countCursorNames(files);
checkRatchet(cursorNames);
fail();
const version = resolveVersion(files);
writeManifest(files, version);
fail();

if (checking) {
  const onDisk = installed(OUT);
  const drifted = [...new Set([...files.keys(), ...onDisk.keys()])].sort().filter((path) => {
    const [want, have] = [files.get(path), onDisk.get(path)];
    return !want || !have || !want.bytes.equals(have.bytes) || want.executable !== have.executable;
  });
  for (const path of drifted.slice(0, 20)) console.log(`plugin/${path}`);
  if (drifted.length > 0) {
    console.log(`plugin/ is out of date. Run \`${COMMAND}\` and commit the result.`);
    process.exitCode = 1;
  } else console.log(`plugin/ is up to date (${rules.plugin.name} ${version}).`);
} else {
  rmSync(OUT, { recursive: true, force: true });
  for (const [path, { bytes, executable }] of files) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), bytes);
    chmodSync(join(OUT, path), executable ? 0o755 : 0o644);
  }
  const left = Object.values(cursorNames).reduce((sum, n) => sum + n, 0);
  console.log(`${rules.plugin.name} ${version} from upstream ${upstream.ref.slice(0, 7)}, checked against oh-my-claudecode ${omc.version}`);
  console.log(`${skills.length} skills, ${guided.adapter} with the adapter line, ${guided.routing} with the routing note, ${files.size} files`);
  console.log(`linked skill mentions: ${linked}, linked commands: ${linkedCommands}`);
  console.log(`substitutions: ${[...substituted].map(([label, n]) => `${label} x${n}`).join(", ")}`);
  console.log(`Cursor names left for native rewrites: ${left}`);
}
