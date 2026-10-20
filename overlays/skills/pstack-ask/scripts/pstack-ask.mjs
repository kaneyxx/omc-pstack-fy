#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const USAGE = `node pstack-ask.mjs <provider> --model <model> [--effort <effort>] --prompt-file <file> --out <file> [--timeout <seconds>]
node pstack-ask.mjs --detect
node pstack-ask.mjs --list`;
const EXIT = { ok: 0, failed: 1, "not-installed": 2, violation: 3, timeout: 4, breach: 5, usage: 64 };
const PLACEHOLDER = /\{(model|effort|prompt)\}/g;
const STARTED = Date.now();
const SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"];
const OUTPUT_LIMIT = 64 << 20;
const COPY_LIMIT = 10 << 20;
const EXIT_GRACE_MS = 2000;
const STALE_MS = 24 * 60 * 60 * 1000;
// Linux refuses one argument over 128 KiB with E2BIG, so a longer prompt travels in a file.
const ARG_LIMIT = 100_000;
const PROMPT_FILE = ".pstack-ask-prompt.md";
const PROMPT_POINTER = `Read ${PROMPT_FILE} in the current directory and follow it exactly.`;
// The sweep removes only folders holding this marker, so another program's pstack-ask-* folder is safe.
const MARKER = ".pstack-ask-sandbox";
// A model or effort lands in the vendor CLI's argv, so it must be a plain name that cannot pass for a flag.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const UNCONTAINED = "a process that leaves the CLI's process group can outlive the integrity check";
const strip = (env, prefix) => Object.fromEntries(Object.entries(env).filter(([key]) => !prefix.test(key)));
// Our own git calls ignore a caller's GIT_DIR or GIT_INDEX_FILE, and write nothing into the user's .git that the integrity
// check would read as a breach: no index refresh, no fsmonitor daemon files, no split-index sharedindex files.
const GIT_ENV = {
  ...strip(process.env, /^GIT_/),
  GIT_OPTIONAL_LOCKS: "0",
  GIT_CONFIG_COUNT: "2",
  GIT_CONFIG_KEY_0: "core.fsmonitor",
  GIT_CONFIG_VALUE_0: "false",
  GIT_CONFIG_KEY_1: "core.splitIndex",
  GIT_CONFIG_VALUE_1: "false",
};
const interrupted = new AbortController();

function parseArgs(argv, options) {
  const flags = { "--model": "model", "--effort": "effort", "--prompt-file": "promptFile", "--out": "out", "--timeout": "timeout" };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--detect" || arg === "--list" || arg === "--help") options.command = arg.slice(2);
    else if (arg in flags && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) options[flags[arg]] = argv[++i];
    else if (!arg.startsWith("-") && !options.provider) options.provider = arg;
    else throw new Error(`unknown or incomplete argument ${JSON.stringify(arg)}`);
  }
  options.timeout = Number(options.timeout);
  if (options.command) return options;
  if (!options.provider || !options.model || !options.promptFile || !options.out || !(options.timeout > 0)) {
    throw new Error("a provider, --model, --prompt-file, --out, and a positive --timeout are required");
  }
  for (const key of ["model", "effort"]) {
    if (options[key] !== undefined && !NAME.test(options[key])) throw new Error(`--${key} ${JSON.stringify(options[key])} must match ${NAME}`);
  }
  return options;
}

function summary(options, status, fields = {}) {
  return {
    provider: options.provider ?? null,
    model: options.model ?? null,
    effort: options.effort ?? null,
    status,
    exitCode: EXIT[status],
    durationMs: Date.now() - STARTED,
    out: options.out ? resolve(options.out) : null,
    isolated: false,
    violations: [],
    breach: [],
    verified: false,
    note: "",
    ...fields,
  };
}

// Shipped templates sit beside this script. The user's file overrides them field by field, so a fixed flag survives plugin updates.
function loadProviders() {
  const shipped = JSON.parse(readFileSync(join(HERE, "providers.json"), "utf8"));
  const userPath = process.env.OMC_PSTACK_FY_PROVIDERS ?? join(homedir(), ".claude", "omc-pstack-fy", "providers.json");
  const user = existsSync(userPath) ? JSON.parse(readFileSync(userPath, "utf8")) : {};
  const merged = { ...shipped.providers };
  for (const [name, fields] of Object.entries(user.providers ?? {})) merged[name] = { ...merged[name], ...fields };
  return merged;
}

function installed(provider) {
  const probe = spawnSync(provider.binary, provider.versionArgs ?? ["--version"], { encoding: "utf8", timeout: 15000 });
  if (probe.error || probe.status !== 0) return null;
  return (probe.stdout || probe.stderr).trim().split("\n")[0];
}

// An argument group is dropped when any placeholder in it has no value, so `["--effort", "{effort}"]` disappears without an effort.
function buildArgs(provider, values) {
  return provider.args.flatMap((part) => {
    const group = Array.isArray(part) ? part : [part];
    const missing = group.some((arg) => [...arg.matchAll(PLACEHOLDER)].some(([, key]) => !values[key]));
    if (missing && Array.isArray(part)) return [];
    if (missing) throw new Error(`template argument ${JSON.stringify(part)} needs a value it was not given`);
    return group.map((arg) => arg.replace(PLACEHOLDER, (_, key) => values[key]));
  });
}

function git(cwd, args, { input, env, encoding = "utf8", check = false } = {}) {
  const run = spawnSync("git", ["-C", cwd, ...args], { input, encoding, env: { ...GIT_ENV, ...env }, maxBuffer: 1 << 30 });
  if (check && run.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${String(run.stderr || run.error?.message || "").trim()}`);
  return run;
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// Resolves symlinks in the part of the path that exists, so /tmp and /private/tmp on macOS compare equal.
function realPath(path) {
  const missing = [];
  for (; !existsSync(path); path = dirname(path)) missing.unshift(basename(path));
  return join(realpathSync(path), ...missing);
}

function contains(parent, path) {
  const rel = relative(realPath(parent), realPath(resolve(path)));
  return !(rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
}

// A run killed with SIGKILL cannot clean up after itself, so every run removes this user's marked sandboxes a day old.
function sweep() {
  let names = [];
  try {
    names = readdirSync(tmpdir()).filter((name) => name.startsWith("pstack-ask-"));
  } catch {
    return;
  }
  for (const name of names) {
    const path = join(tmpdir(), name);
    try {
      const stat = lstatSync(path);
      const marked = lstatSync(join(path, MARKER), { throwIfNoEntry: false })?.isFile();
      if (stat.isDirectory() && stat.uid === process.getuid() && marked && Date.now() - stat.mtimeMs > STALE_MS) rmSync(path, { recursive: true, force: true });
    } catch {
      // An unreadable directory, or one a concurrent run just removed.
    }
  }
}

function markedTempDir(prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  writeFileSync(join(dir, MARKER), "");
  return dir;
}

// The CLI runs in an independent clone at HEAD with the user's uncommitted changes and regular untracked files copied in.
// A linked worktree would share the user's .git, so a CLI could rewrite its config, refs, and hooks from inside it.
// The clone sits in work/ beside the marker, so the marker is never one of the CLI's files.
function isolate(cwd, repo, notes) {
  const top = markedTempDir("pstack-ask-");
  const dir = join(top, "work");
  if (!repo) {
    mkdirSync(dir);
    return { dir, cwd: dir, repo: null, cleanup: () => rmSync(top, { recursive: true, force: true }) };
  }
  const scratch = markedTempDir("pstack-ask-scan-");
  const cleanup = () => [top, scratch].forEach((path) => rmSync(path, { recursive: true, force: true }));
  try {
    const head = git(repo, ["rev-parse", "--verify", "HEAD"], { check: true }).stdout.trim();
    git(repo, ["-c", "core.hooksPath=/dev/null", "clone", "--shared", "--no-checkout", "--quiet", "--template=", repo, dir], { check: true });
    git(dir, ["remote", "remove", "origin"], { check: true });
    git(dir, ["-c", "core.hooksPath=/dev/null", "checkout", "--detach", "--quiet", head], { check: true });
    const diff = git(repo, ["diff", "HEAD", "--binary", "--no-color", "--no-ext-diff", "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/"], {
      encoding: "buffer",
      check: true,
    }).stdout;
    if (diff.length > 0) git(dir, ["-c", "core.hooksPath=/dev/null", "apply", "--whitespace=nowarn"], { input: diff, check: true });

    const skipped = [];
    for (const path of git(repo, ["ls-files", "--others", "--exclude-standard", "-z"], { check: true }).stdout.split("\0").filter(Boolean)) {
      const stat = lstatSync(join(repo, path), { throwIfNoEntry: false });
      let skip = null;
      if (path.endsWith("/")) skip = "nested repository";
      else if (stat?.isSymbolicLink()) skip = "symlink";
      else if (!stat?.isFile()) skip = "not a regular file";
      else if (stat.size > COPY_LIMIT) skip = "over 10 MB";
      if (skip) {
        skipped.push(`${path} (${skip})`);
        continue;
      }
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      copyFileSync(join(repo, path), join(dir, path));
    }
    if (skipped.length > 0) {
      const more = skipped.length > 10 ? `, and ${skipped.length - 10} more` : "";
      notes.push(`did not copy untracked ${skipped.slice(0, 10).join(", ")}${more}`);
    }

    const prefix = git(cwd, ["rev-parse", "--show-prefix"], { check: true }).stdout.trim();
    const inside = existsSync(join(dir, prefix));
    if (!inside) notes.push(`${prefix} is not in the sandbox, which happens for an ignored directory, so the CLI ran at the repository root`);
    const objects = resolve(repo, git(repo, ["rev-parse", "--git-path", "objects"], { check: true }).stdout.trim());
    mkdirSync(join(scratch, "objects"));
    // Snapshots of the user's repository write their blobs and trees here, never into its object store.
    const scan = { GIT_OBJECT_DIRECTORY: join(scratch, "objects"), GIT_ALTERNATE_OBJECT_DIRECTORIES: JSON.stringify(objects) };
    return { dir, cwd: inside ? join(dir, prefix) : dir, repo, scratch, scan, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

// The tree `git add -A` would stage, built in a scratch copy of the index so the real one stays as it was.
// Paths .gitignore excludes are out of scope: a write there goes unseen.
// --ignore-errors keeps an unreadable file or an empty nested repository from failing the snapshot; git exits 1 for those.
function treeOf(dir, scratch, env = {}) {
  const index = join(scratch, `index-${randomUUID()}`);
  const real = resolve(dir, git(dir, ["rev-parse", "--git-path", "index"], { check: true }).stdout.trim());
  if (existsSync(real)) copyFileSync(real, index, constants.COPYFILE_EXCL);
  const scratchIndex = { ...env, GIT_INDEX_FILE: index };
  const added = git(dir, ["add", "-A", "--ignore-errors"], { env: scratchIndex });
  if (added.status !== 0 && added.status !== 1) throw new Error(`git add -A failed: ${String(added.stderr || added.error?.message).trim()}`);
  const tree = git(dir, ["write-tree"], { env: scratchIndex, check: true }).stdout.trim();
  rmSync(index, { force: true });
  return tree;
}

const changedPaths = (dir, before, after, env) =>
  before === after
    ? []
    : git(dir, ["diff", "--name-only", "--no-renames", "--ignore-submodules=none", "-z", before, after], { env, check: true })
        .stdout.split("\0")
        .filter(Boolean);

const describe = (path, stat) => (stat.isSymbolicLink() ? `-> ${readlinkSync(path)}` : stat.isFile() ? `${stat.mode} ${sha256(readFileSync(path))}` : `${stat.mode}`);

function listing(dir) {
  try {
    return new Map(readdirSync(dir).map((name) => [name, describe(join(dir, name), lstatSync(join(dir, name)))]));
  } catch (error) {
    return new Map(error.code === "ENOENT" || error.code === "ENOTDIR" ? [] : [["(unreadable)", error.code]]);
  }
}

// Every file under the git common dir: config, hooks, refs, reflogs, info/exclude, and the rest, by path, mode, and content.
// Object stores (objects/, and the ones under modules/ or lfs/) are left out: they are large, and a new object changes
// nothing until a ref, config, or hook seen here points at it. Lock files are transient. Index files are covered by the
// index check, or belong to another worktree whose own `git status` rewrites them.
function gitFiles(common) {
  const files = new Map();
  const walk = (dir) => {
    for (const name of readdirSync(join(common, dir))) {
      const path = dir ? `${dir}/${name}` : name;
      const stat = lstatSync(join(common, path), { throwIfNoEntry: false });
      if (!stat || name.endsWith(".lock") || (name === "objects" && stat.isDirectory()) || (name === "index" && stat.isFile())) continue;
      if (stat.isDirectory()) walk(path);
      else files.set(path, describe(join(common, path), stat));
    }
  };
  walk("");
  return files;
}

// What a CLI could change in the user's repository from outside its sandbox: refs, the git dir's files, a core.hooksPath
// outside it, the index, and the working tree.
function fingerprint(sandbox) {
  const { repo } = sandbox;
  const common = resolve(repo, git(repo, ["rev-parse", "--git-common-dir"], { check: true }).stdout.trim());
  const hooksPath = git(repo, ["config", "--path", "core.hooksPath"]).stdout.trim();
  const refs = git(repo, ["for-each-ref", "--format=%(refname) %(objectname)"], { check: true }).stdout.split("\n").filter(Boolean);
  const head = [["symbolic-ref", "-q", "HEAD"], ["rev-parse", "-q", "--verify", "HEAD"]].map((args) => git(repo, args).stdout.trim());
  return {
    refs: new Map([...refs.map((line) => line.split(" ")), ["HEAD", head.join(" ")]]),
    gitDir: gitFiles(common),
    hooks: hooksPath ? listing(resolve(repo, hooksPath)) : new Map(),
    index: sha256(git(repo, ["ls-files", "--stage", "-z"], { check: true }).stdout),
    tree: treeOf(repo, sandbox.scratch, sandbox.scan),
  };
}

function breaches(before, after, sandbox) {
  const changed = (a, b) => [...new Set([...a.keys(), ...b.keys()])].filter((key) => a.get(key) !== b.get(key));
  return [
    ...changed(before.refs, after.refs).map((ref) => `ref ${ref}`),
    ...changed(before.gitDir, after.gitDir).map((path) => `.git/${path}`),
    ...changed(before.hooks, after.hooks).map((name) => `hook ${name}`),
    ...(before.index === after.index ? [] : ["index"]),
    ...changedPaths(sandbox.repo, before.tree, after.tree, sandbox.scan).map((path) => `file ${path}`),
  ];
}

// The CLI leads its own process group, so one kill reaches everything it started that stayed in the group.
function runCli(binary, args, { cwd, env, input, timeoutMs }) {
  return new Promise((done) => {
    const child = spawn(binary, args, { cwd, env, detached: true, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let size = 0;
    let exited = null;
    let error = null;
    let grace;
    let settled = false;
    const timer = setTimeout(() => settle("timeout"), Math.min(timeoutMs, 2 ** 31 - 1));
    const stop = () => settle("interrupted");
    const settle = (reason = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      interrupted.signal.removeEventListener("abort", stop);
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        // The group already exited.
      }
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy();
      const text = (chunks) => Buffer.concat(chunks).toString("utf8");
      done({ reason, error, code: exited?.code ?? null, signal: exited?.signal ?? null, stdout: text(stdout), stderr: text(stderr) });
    };
    const collect = (chunks) => (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > OUTPUT_LIMIT) settle("too large");
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    // A CLI that exits without reading its stdin must not crash the bridge with EPIPE.
    child.stdin?.on("error", () => {});
    child.stdin?.end(input);
    child.on("error", (spawnError) => {
      error = spawnError;
      settle();
    });
    // A grandchild can hold stdout open after the CLI exits. The CLI's output is complete by then, so it only gets a short grace.
    child.on("exit", (code, signal) => {
      exited = { code, signal };
      clearTimeout(timer);
      if (!settled) grace = setTimeout(settle, EXIT_GRACE_MS);
    });
    child.on("close", () => settle());
    interrupted.signal.addEventListener("abort", stop);
    if (interrupted.signal.aborted) stop();
  });
}

async function ask(options) {
  const fields = { isolated: false, violations: [], breach: [], verified: false };
  const notes = [];
  const finish = (status, extra = {}) => summary(options, status, { ...fields, note: notes.filter(Boolean).join(". "), ...extra });

  if (!existsSync(options.promptFile)) return finish("usage", { note: `the prompt file ${options.promptFile} does not exist` });
  const top = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
  const repo = top.status === 0 ? top.stdout.trim() : null;
  if (repo && contains(repo, options.out)) return finish("usage", { note: `--out must be outside the repository at ${repo}, so writing it cannot change the checkout` });

  const providers = loadProviders();
  if (!Object.hasOwn(providers, options.provider)) return finish("not-installed", { note: `no provider named ${options.provider} in providers.json` });
  const provider = providers[options.provider];
  fields.verified = provider.verified === true;
  if (!installed(provider)) return finish("not-installed", { note: `${provider.binary} is not on PATH or did not answer ${(provider.versionArgs ?? ["--version"]).join(" ")}` });

  const effort = options.effort ? (provider.effort?.[options.effort] ?? options.effort) : undefined;
  const prompt = readFileSync(options.promptFile, "utf8");
  const viaFile = !provider.stdin && Buffer.byteLength(prompt) > ARG_LIMIT;
  const args = buildArgs(provider, { model: options.model, effort, prompt: provider.stdin ? undefined : viaFile ? PROMPT_POINTER : prompt });
  if (options.effort && !provider.args.flat().some((arg) => arg.includes("{effort}"))) notes.push(`${options.provider} takes no effort, so ${options.effort} was ignored`);
  if (!fields.verified) notes.push(`the ${options.provider} template is unverified; isolation still protects the checkout`);
  if (viaFile) notes.push(`the prompt is over ${ARG_LIMIT} bytes, so the CLI read it from ${PROMPT_FILE}`);

  const sandbox = isolate(process.cwd(), repo, notes);
  fields.isolated = sandbox.repo !== null;
  if (!fields.isolated) notes.push("not in a git repository, so the CLI saw only the prompt");
  notes.push(UNCONTAINED);
  // Pinned, so a CLI that deletes the sandbox's .git fails the snapshot instead of sending git up to an enclosing repository.
  const own = { GIT_DIR: join(sandbox.dir, ".git") };
  try {
    if (viaFile) writeFileSync(join(sandbox.cwd, PROMPT_FILE), prompt);
    const before = fields.isolated ? { sandbox: treeOf(sandbox.dir, sandbox.scratch, own), user: fingerprint(sandbox) } : null;
    // The CLI must not inherit the parent session's identity, or a GIT_ variable that points back at the user's repository.
    const env = { ...strip(process.env, /^(CLAUDE_|ANTHROPIC_|GIT_)/), ...provider.env, PWD: sandbox.cwd };
    delete env.OLDPWD;
    const run = await runCli(provider.binary, args, { cwd: sandbox.cwd, env, input: provider.stdin ? prompt : undefined, timeoutMs: options.timeout * 1000 });
    mkdirSync(dirname(resolve(options.out)), { recursive: true });
    writeFileSync(resolve(options.out), run.stdout);
    if (run.reason === "interrupted") return finish("failed", { note: "interrupted" });

    if (before) {
      try {
        fields.violations = changedPaths(sandbox.dir, before.sandbox, treeOf(sandbox.dir, sandbox.scratch, own), own);
      } catch (error) {
        fields.violations = [".git"];
        notes.push(`the sandbox's repository stopped working: ${error.message}`);
      }
      try {
        fields.breach = breaches(before.user, fingerprint(sandbox), sandbox);
      } catch (error) {
        fields.breach = [`repository unreadable: ${error.message}`];
      }
    }
    let status = fields.violations.length > 0 ? "violation" : "ok";
    if (run.reason === "timeout") {
      status = "timeout";
      notes.push(`killed after ${options.timeout}s`);
    } else if (run.reason === "too large") {
      status = "failed";
      notes.push("output too large");
    } else if (run.error) {
      status = "failed";
      notes.push(run.error.message);
    } else if (run.code !== 0 || !run.stdout.trim()) {
      status = "failed";
      notes.push(`exit ${run.code ?? run.signal}`, run.stderr.slice(-500));
    }
    if (fields.breach.length > 0) {
      status = "breach";
      notes.push("the CLI changed the user's repository outside its sandbox");
    }
    return finish(status);
  } finally {
    sandbox.cleanup();
  }
}

async function main() {
  const options = { timeout: 600 };
  try {
    parseArgs(process.argv.slice(2), options);
  } catch (error) {
    console.log(JSON.stringify(summary(options, "usage", { note: `${error.message}\n${USAGE}` })));
    return EXIT.usage;
  }
  if (options.command === "help") {
    console.log(USAGE);
    return 0;
  }
  if (options.command === "list" || options.command === "detect") {
    const providers = loadProviders();
    const rows = Object.entries(providers).map(([name, provider]) => ({
      provider: name,
      binary: provider.binary,
      verified: provider.verified === true,
      readOnly: provider.readOnly ?? null,
      ...(options.command === "detect" ? { version: installed(provider) } : {}),
    }));
    console.log(JSON.stringify(options.command === "detect" ? rows.filter(({ version }) => version) : rows));
    return 0;
  }
  sweep();
  // Node delivers a signal only while the event loop runs, which is while the CLI runs, so runCli sees it and the run cleans up.
  for (const signal of SIGNALS) process.on(signal, () => interrupted.abort());
  let result;
  try {
    result = await ask(options);
  } catch (error) {
    result = summary(options, "failed", { note: error.message });
  }
  console.log(JSON.stringify(result));
  return result.exitCode;
}

process.exitCode = await main();
