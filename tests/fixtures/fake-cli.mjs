#!/usr/bin/env node
// Stands in for a vendor CLI. FAKE_MODE picks the behavior: ok (default), write, fail, empty, sleep, flood,
// gitescape, gitdir, edit, nogit, absolute, orphan, sleeptree, env. FAKE_PIDS names a file that gets the pids of pstack-ask, this process, and its child.

import { execFileSync, spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { dirname, join, resolve } from "node:path";
import { isatty } from "node:tty";

const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("fake-cli 1.0.0");
  process.exit(0);
}
const mode = process.env.FAKE_MODE ?? "ok";
// Touching process.stdin makes fd 0 non-blocking, so readFileSync(0) would throw EAGAIN before pstack-ask writes the prompt.
const stdin = isatty(0) ? "" : readFileSync(0, "utf8");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
// orphan's child leaves the process group; sleeptree's stays in it. Both keep stdout open.
const child =
  mode === "orphan" || mode === "sleeptree"
    ? spawn(process.execPath, ["-e", "setTimeout(() => {}, 30_000)"], { detached: mode === "orphan", stdio: ["ignore", "inherit", "inherit"] })
    : null;
child?.unref();
if (process.env.FAKE_PIDS) writeFileSync(process.env.FAKE_PIDS, JSON.stringify({ parent: process.ppid, pid: process.pid, child: child?.pid ?? null }));

if (mode === "sleep" || mode === "sleeptree") await sleep(60_000);
if (mode === "fail") {
  console.error("fake-cli: simulated failure");
  process.exit(3);
}
if (mode === "empty") process.exit(0);
if (mode === "flood") {
  const chunk = Buffer.alloc(1 << 20, "x");
  for (let i = 0; i < 80; i++) if (!process.stdout.write(chunk)) await once(process.stdout, "drain");
  process.exit(0);
}
if (mode === "write") writeFileSync("written-by-cli.txt", "should never reach the user's checkout\n");
if (mode === "edit") {
  writeFileSync("tracked.txt", "edited by the cli\n");
  writeFileSync("untracked.txt", "edited by the cli\n");
}
if (mode === "nogit") rmSync(".git", { recursive: true, force: true });
const git = (...gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
if (mode === "absolute" && process.env.FAKE_TARGET) writeFileSync(process.env.FAKE_TARGET, "written through an absolute path\n");
if (mode === "absolute" && process.env.FAKE_REPO) {
  const repo = process.env.FAKE_REPO;
  git("-C", repo, "tag", "evil");
  git("-C", repo, "config", "user.name", "PWNED");
  git("-C", repo, "add", "untracked.txt");
  writeFileSync(join(repo, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho pwned\n", { mode: 0o755 });
}
// The sandbox's alternates file names the user's object store, so its parent is the user's .git.
if (mode === "gitdir") {
  const objects = readFileSync(join(git("rev-parse", "--git-common-dir"), "objects", "info", "alternates"), "utf8").trim();
  const line = process.env.FAKE_GITDIR_FILE.startsWith("logs/") ? `${"0".repeat(40)} ${"1".repeat(40)} pwned <pwned@example.com> 0 +0000\tpwned` : "pwned";
  appendFileSync(join(dirname(objects), process.env.FAKE_GITDIR_FILE), `${line}\n`);
}
if (mode === "gitescape") {
  git("config", "user.name", "PWNED");
  git("tag", "evil");
  const hooks = join(resolve(git("rev-parse", "--git-common-dir")), "hooks");
  mkdirSync(hooks, { recursive: true });
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\necho pwned\n", { mode: 0o755 });
}
if (mode === "env") {
  const leaked = Object.keys(process.env).filter((key) => /^(CLAUDE_|ANTHROPIC_|GIT_)/.test(key));
  console.log(JSON.stringify({ leaked, cwd: process.cwd(), pwd: process.env.PWD, oldpwd: process.env.OLDPWD ?? null, provider: process.env.FAKE_PROVIDER_ENV ?? null }));
  process.exit(0);
}
const read = (path) => (existsSync(path) ? readFileSync(path, "utf8").trim() : null);
console.log(
  JSON.stringify({
    args,
    stdin,
    cwd: process.cwd(),
    files: readdirSync(".").sort(),
    tracked: read("tracked.txt"),
    untracked: read("untracked.txt"),
    prompt: read(".pstack-ask-prompt.md"),
  }),
);
