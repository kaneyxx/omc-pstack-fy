import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "plugin", "skills", "pstack-ask", "scripts", "pstack-ask.mjs");
const FAKE = join(ROOT, "tests", "fixtures", "fake-cli.mjs");
const FIELDS = ["provider", "model", "effort", "status", "exitCode", "durationMs", "out", "isolated", "violations", "verified", "note", "breach"];
const POINTER = "Read .pstack-ask-prompt.md in the current directory and follow it exactly.";
const UNCONTAINED = "a process that leaves the CLI's process group can outlive the integrity check";

function sandbox() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "pstack-ask-test-")));
  const repo = join(dir, "repo");
  const tmp = join(dir, "tmp");
  mkdirSync(tmp);
  const git = (...args) => spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  spawnSync("git", ["init", "-q", repo]);
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(repo, "tracked.txt"), "committed\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  writeFileSync(join(repo, "tracked.txt"), "uncommitted edit\n");
  writeFileSync(join(repo, "untracked.txt"), "brand new\n");
  const fake = { binary: process.execPath, versionArgs: [FAKE, "--version"], verified: true };
  const providers = {
    providers: {
      fake: { ...fake, stdin: true, args: [FAKE, ["--model", "{model}"], ["--effort", "{effort}"]], effort: { xhigh: "high" }, env: { FAKE_PROVIDER_ENV: "set" } },
      fakearg: { ...fake, stdin: false, args: [FAKE, ["--model", "{model}"], "-p", "{prompt}"] },
      broken: { ...fake, stdin: true, args: [FAKE, "{effort}"] },
      missing: { binary: "pstack-ask-no-such-cli", args: [] },
    },
  };
  writeFileSync(join(dir, "providers.json"), JSON.stringify(providers));
  writeFileSync(join(dir, "prompt.md"), "review this diff\n");
  return { dir, repo, tmp, git };
}

const sha = (path) => (existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null);

// Everything a run must leave alone in the user's repository, including its object store.
function repoState(box) {
  const hooks = join(box.repo, ".git", "hooks");
  return {
    status: box.git("status", "--porcelain=v1", "--untracked-files=all").stdout,
    diff: box.git("diff", "HEAD").stdout,
    untracked: sha(join(box.repo, "untracked.txt")),
    refs: box.git("for-each-ref", "--format=%(refname) %(objectname)").stdout,
    head: box.git("symbolic-ref", "HEAD").stdout + box.git("rev-parse", "HEAD").stdout,
    config: sha(join(box.repo, ".git", "config")),
    hooks: readdirSync(hooks).map((name) => `${name} ${sha(join(hooks, name))}`),
    objects: readdirSync(join(box.repo, ".git", "objects"), { recursive: true }).sort(),
  };
}

const sandboxes = (box) => readdirSync(box.tmp).filter((name) => name.startsWith("pstack-ask-"));
const environment = (box, extra = {}) => ({ ...process.env, TMPDIR: box.tmp, OMC_PSTACK_FY_PROVIDERS: join(box.dir, "providers.json"), ...extra });

async function ask(box, args, { cwd = box.repo, mode = "ok", env = {}, breach = false } = {}) {
  const before = { repo: repoState(box), sandboxes: sandboxes(box) };
  const run = spawn(process.execPath, [SCRIPT, ...args], { cwd, env: environment(box, { FAKE_MODE: mode, ...env }) });
  let stdout = "";
  run.stdout.on("data", (chunk) => (stdout += chunk));
  const code = await new Promise((done) => run.on("close", done));
  const summary = JSON.parse(stdout.trim().split("\n").at(-1));
  assert.deepEqual(Object.keys(summary).sort(), [...FIELDS].sort(), "every contract field is present");
  if (!breach) {
    assert.deepEqual(summary.breach, [], "the bridge's own git commands never read as a breach");
    assert.deepEqual(repoState(box), before.repo, "the user's repository is untouched");
  }
  assert.deepEqual(
    sandboxes(box).filter((name) => !before.sandboxes.includes(name)),
    [],
    "the run's sandbox is removed",
  );
  return { code, summary };
}

const standard = (box, provider = "fake", extra = []) => [provider, "--model", "m1", "--prompt-file", join(box.dir, "prompt.md"), "--out", join(box.dir, "out.txt"), ...extra];
const output = (box) => JSON.parse(readFileSync(join(box.dir, "out.txt"), "utf8"));
const readPids = (path) => JSON.parse(readFileSync(path, "utf8"));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  // On Linux a killed process lingers as a zombie until its new parent reaps it.
  try {
    return readFileSync(`/proc/${pid}/stat`, "utf8").split(") ").at(-1)[0] !== "Z";
  } catch {
    return true;
  }
};

async function waitFor(check, ms = 10_000) {
  for (const deadline = Date.now() + ms; Date.now() < deadline; await new Promise((done) => setTimeout(done, 20))) {
    try {
      if (check()) return true;
    } catch {
      // Not ready yet.
    }
  }
  return false;
}

// Each test owns its repository and TMPDIR, so they run side by side, one per core so timing checks hold on a small CI runner.
describe("pstack-ask", { concurrency: availableParallelism() }, () => {
  test("runs the CLI in an isolated clone that holds the user's uncommitted and untracked changes", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box, "fake", ["--effort", "xhigh"]));
    assert.equal(code, 0);
    assert.equal(summary.status, "ok");
    assert.equal(summary.isolated, true);
    assert.deepEqual(summary.breach, []);
    const seen = output(box);
    assert.deepEqual(seen.args, ["--model", "m1", "--effort", "high"]);
    assert.equal(seen.stdin, "review this diff\n");
    assert.equal(seen.tracked, "uncommitted edit");
    assert.equal(seen.untracked, "brand new");
    assert.ok(seen.cwd.startsWith(join(box.tmp, "pstack-ask-")), seen.cwd);
    assert.ok(!seen.files.includes(".pstack-ask-sandbox"), "the sweep marker is not among the CLI's files");
    assert.equal(box.git("worktree", "list").stdout.trim().split("\n").length, 1, "no worktree is linked to the user's repository");
    assert.ok(summary.note.includes(UNCONTAINED), summary.note);
  });

  test("drops an argument group whose placeholder has no value", async () => {
    const box = sandbox();
    await ask(box, standard(box));
    assert.deepEqual(output(box).args, ["--model", "m1"]);
  });

  test("passes the prompt as an argument when the template does not use stdin", async () => {
    const box = sandbox();
    const { code } = await ask(box, standard(box, "fakearg"));
    assert.equal(code, 0);
    assert.deepEqual(output(box).args, ["--model", "m1", "-p", "review this diff\n"]);
    assert.equal(output(box).stdin, "");
  });

  test("an argument prompt over 100,000 bytes travels in a file in the CLI's directory", async () => {
    const box = sandbox();
    const prompt = `${"review this diff ".repeat(7000)}\n`;
    writeFileSync(join(box.dir, "prompt.md"), prompt);
    const { code, summary } = await ask(box, standard(box, "fakearg"));
    assert.equal(code, 0, summary.note);
    assert.deepEqual(summary.violations, []);
    assert.deepEqual(output(box).args, ["--model", "m1", "-p", POINTER]);
    assert.equal(output(box).prompt, prompt.trim());
  });

  test("cursor's template ends its options before the positional prompt", async () => {
    const shipped = JSON.parse(readFileSync(join(dirname(SCRIPT), "providers.json"), "utf8"));
    assert.deepEqual(shipped.providers.cursor.args.slice(-2), ["--", "{prompt}"]);
  });

  test("reports a violation when the CLI writes, and the write never reaches the checkout", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box), { mode: "write" });
    assert.equal(code, 3);
    assert.equal(summary.status, "violation");
    assert.deepEqual(summary.violations, ["written-by-cli.txt"]);
    assert.equal(existsSync(join(box.repo, "written-by-cli.txt")), false);
  });

  test("edit: a change to an already modified or untracked file is a violation", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box), { mode: "edit" });
    assert.equal(code, 3);
    assert.equal(summary.status, "violation");
    assert.deepEqual(summary.violations, ["tracked.txt", "untracked.txt"]);
  });

  test("a CLI that deletes the sandbox's .git is a violation, not ok", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box), { mode: "nogit" });
    assert.equal(code, 3);
    assert.deepEqual(summary.violations, [".git"]);
    assert.match(summary.note, /sandbox's repository stopped working/);
  });

  test("gitescape: git config, tags, and hooks written from the sandbox stay in the sandbox", async () => {
    const box = sandbox();
    const { summary } = await ask(box, standard(box), { mode: "gitescape" });
    assert.ok(["ok", "violation"].includes(summary.status), summary.note);
    assert.deepEqual(summary.breach, []);
    assert.equal(box.git("config", "user.name").stdout.trim(), "test");
    assert.equal(box.git("tag").stdout, "");
    assert.equal(existsSync(join(box.repo, ".git", "hooks", "pre-commit")), false);
  });

  test("absolute: a write into the user's repository through an absolute path is a breach", async () => {
    const box = sandbox();
    const target = join(box.repo, "tracked.txt");
    const { code, summary } = await ask(box, standard(box), { mode: "absolute", env: { FAKE_TARGET: target }, breach: true });
    assert.equal(code, 5);
    assert.equal(summary.status, "breach");
    assert.deepEqual(summary.breach, ["file tracked.txt"]);
    assert.equal(readFileSync(target, "utf8"), "written through an absolute path\n");
  });

  test("absolute: a ref, config, hook, or index change in the user's repository is a breach", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box), { mode: "absolute", env: { FAKE_REPO: box.repo }, breach: true });
    assert.equal(code, 5);
    assert.deepEqual([...summary.breach].sort(), [".git/config", ".git/hooks/pre-commit", ".git/refs/tags/evil", "index", "ref refs/tags/evil"]);
  });

  for (const file of ["info/exclude", "description", "logs/HEAD"]) {
    test(`gitdir: a write to .git/${file} through the path in the sandbox's alternates file is a breach`, async () => {
      const box = sandbox();
      const { code, summary } = await ask(box, standard(box), { mode: "gitdir", env: { FAKE_GITDIR_FILE: file }, breach: true });
      assert.equal(code, 5);
      assert.equal(summary.status, "breach");
      assert.deepEqual(summary.breach, [`.git/${file}`]);
    });
  }

  test("orphan: a grandchild holding stdout does not hold the run past a short grace", async () => {
    const box = sandbox();
    const pids = join(box.dir, "pids.json");
    try {
      const { code, summary } = await ask(box, standard(box), { mode: "orphan", env: { FAKE_PIDS: pids } });
      assert.ok(summary.durationMs < 5000, `took ${summary.durationMs} ms`);
      assert.equal(code, 0, summary.note);
      assert.equal(summary.status, "ok");
      assert.equal(output(box).tracked, "uncommitted edit");
    } finally {
      if (existsSync(pids)) process.kill(readPids(pids).child, "SIGKILL");
    }
  });

  test("sleeptree: the timeout kills the CLI's whole process group", async () => {
    const box = sandbox();
    const pids = join(box.dir, "pids.json");
    const { code, summary } = await ask(box, standard(box, "fake", ["--timeout", "2"]), { mode: "sleeptree", env: { FAKE_PIDS: pids } });
    assert.equal(code, 4);
    assert.equal(summary.status, "timeout");
    const { pid, child } = readPids(pids);
    assert.ok(await waitFor(() => !alive(pid) && !alive(child)), "the CLI and its grandchild are dead");
  });

  test("env: the CLI gets no CLAUDE_, ANTHROPIC_, or GIT_ variable, and PWD is its cwd", async () => {
    const box = sandbox();
    const env = { CLAUDE_PSTACK_PROBE: "1", ANTHROPIC_PSTACK_PROBE: "1", GIT_DIR: join(box.dir, "nowhere"), OLDPWD: box.dir };
    const { code, summary } = await ask(box, standard(box), { mode: "env", env });
    assert.equal(code, 0, summary.note);
    assert.equal(summary.isolated, true, "the bridge's own git calls ignore GIT_DIR");
    const seen = output(box);
    assert.deepEqual(seen.leaked, []);
    assert.equal(seen.pwd, seen.cwd);
    assert.equal(seen.oldpwd, null);
    assert.equal(seen.provider, "set");
  });

  test("runs from the matching subdirectory, or from the root when an ignored directory has no match", async () => {
    const box = sandbox();
    mkdirSync(join(box.repo, "sub"));
    writeFileSync(join(box.repo, "sub", "inner.txt"), "inner\n");
    box.git("add", "sub");
    box.git("commit", "-q", "-m", "sub");
    const { code } = await ask(box, standard(box), { cwd: join(box.repo, "sub") });
    assert.equal(code, 0);
    const seen = output(box);
    assert.ok(seen.cwd.startsWith(join(box.tmp, "pstack-ask-")) && seen.cwd.endsWith(`${sep}sub`), seen.cwd);
    assert.deepEqual(seen.files, ["inner.txt"]);

    writeFileSync(join(box.repo, ".git", "info", "exclude"), "build/\n");
    mkdirSync(join(box.repo, "build"));
    const ignored = await ask(box, standard(box), { cwd: join(box.repo, "build") });
    assert.equal(ignored.summary.status, "ok");
    assert.match(ignored.summary.note, /build\/ is not in the sandbox/);
    assert.ok(output(box).files.includes("tracked.txt"));
  });

  test("skips untracked symlinks, nested repositories, and large files with a note", async () => {
    const box = sandbox();
    symlinkSync("tracked.txt", join(box.repo, "link"));
    const nested = join(box.repo, "nested");
    spawnSync("git", ["init", "-q", nested]);
    writeFileSync(join(nested, "inner.txt"), "inner\n");
    spawnSync("git", ["-C", nested, "add", "."]);
    spawnSync("git", ["-C", nested, "-c", "user.email=t@example.com", "-c", "user.name=t", "commit", "-q", "-m", "init"]);
    writeFileSync(join(box.repo, "big.bin"), Buffer.alloc((10 << 20) + 1));
    const { code, summary } = await ask(box, standard(box));
    assert.equal(code, 0, summary.note);
    assert.equal(summary.status, "ok");
    assert.match(summary.note, /link \(symlink\)/);
    assert.match(summary.note, /nested\/ \(nested repository\)/);
    assert.match(summary.note, /big\.bin \(over 10 MB\)/);
    const { files } = output(box);
    for (const name of ["link", "nested", "big.bin"]) assert.ok(!files.includes(name), name);
    assert.ok(files.includes("untracked.txt"));
  });

  test("reports failed for a non-zero exit or empty output", async () => {
    const box = sandbox();
    assert.equal((await ask(box, standard(box), { mode: "fail" })).summary.status, "failed");
    assert.equal((await ask(box, standard(box), { mode: "empty" })).summary.status, "failed");
  });

  test("output over 64 MB is cut off and reported as failed", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box), { mode: "flood" });
    assert.equal(code, 1);
    assert.match(summary.note, /output too large/);
  });

  test("kills the CLI at the timeout", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box, "fake", ["--timeout", "0.5"]), { mode: "sleep" });
    assert.equal(code, 4);
    assert.equal(summary.status, "timeout");
  });

  test("a SIGTERM mid-run kills the CLI, removes the sandbox, and reports interrupted", async () => {
    const box = sandbox();
    const pids = join(box.dir, "pids.json");
    const pending = ask(box, standard(box), { mode: "sleep", env: { FAKE_PIDS: pids } });
    assert.ok(await waitFor(() => readPids(pids).pid), "the CLI started");
    process.kill(readPids(pids).parent, "SIGTERM");
    const { code, summary } = await pending;
    assert.equal(code, 1);
    assert.equal(summary.status, "failed");
    assert.equal(summary.note, "interrupted");
    assert.ok(await waitFor(() => !alive(readPids(pids).pid)), "the CLI is dead");
  });

  test("reports not-installed for a missing binary, an unknown provider, or an Object.prototype name", async () => {
    const box = sandbox();
    assert.equal((await ask(box, standard(box, "missing"))).code, 2);
    assert.equal((await ask(box, standard(box, "nobody"))).summary.status, "not-installed");
    const { code, summary } = await ask(box, standard(box, "constructor"));
    assert.equal(code, 2);
    assert.equal(summary.status, "not-installed");
  });

  test("outside a git repository the CLI sees only the prompt", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box), { cwd: box.dir });
    assert.equal(code, 0);
    assert.equal(summary.isolated, false);
    assert.equal(output(box).tracked, null);
  });

  test("rejects incomplete arguments, a missing prompt file, and --out inside the repository with a usage status", async () => {
    const box = sandbox();
    const incomplete = await ask(box, ["fake", "--model"]);
    assert.equal(incomplete.code, 64);
    assert.equal(incomplete.summary.status, "usage");
    const noPrompt = await ask(box, ["fake", "--model", "m1", "--prompt-file", join(box.dir, "nope.md"), "--out", join(box.dir, "out.txt")]);
    assert.equal(noPrompt.code, 64);
    assert.match(noPrompt.summary.note, /nope\.md/);
    const inRepo = await ask(box, ["fake", "--model", "m1", "--prompt-file", join(box.dir, "prompt.md"), "--out", join(box.repo, "reviews", "out.txt")]);
    assert.equal(inRepo.code, 64);
    assert.equal(existsSync(join(box.repo, "reviews")), false);
  });

  test("a caught exception still prints every contract field", async () => {
    const box = sandbox();
    const { code, summary } = await ask(box, standard(box, "broken"));
    assert.equal(code, 1);
    assert.equal(summary.status, "failed");
    assert.match(summary.note, /needs a value/);
  });

  test("removes marked pstack-ask temp folders older than a day, and only those", async () => {
    const box = sandbox();
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const folder = (name, { marked, old }) => {
      const path = join(box.tmp, name);
      mkdirSync(path);
      if (marked) writeFileSync(join(path, ".pstack-ask-sandbox"), "");
      if (old) utimesSync(path, dayAgo, dayAgo);
      return path;
    };
    const stale = folder("pstack-ask-old", { marked: true, old: true });
    const fresh = folder("pstack-ask-fresh", { marked: true, old: false });
    const foreign = folder("pstack-ask-foreign", { marked: false, old: true });
    await ask(box, standard(box));
    assert.equal(existsSync(stale), false);
    assert.equal(existsSync(fresh), true);
    assert.equal(existsSync(foreign), true, "a folder without the marker belongs to someone else");
  });

  test("rejects a model or effort that is not a plain name with a usage status", async () => {
    const box = sandbox();
    for (const [flag, value] of [
      ["--model", "-oProxyCommand=evil"],
      ["--model", "gpt 5"],
      ["--model", "m1;rm"],
      ["--effort", "high --yolo"],
    ]) {
      const args = ["fake", "--model", "m1", "--prompt-file", join(box.dir, "prompt.md"), "--out", join(box.dir, "out.txt"), flag, value];
      const { code, summary } = await ask(box, args);
      assert.equal(code, 64, `${flag} ${value}`);
      assert.equal(summary.status, "usage");
    }
    assert.equal((await ask(box, standard(box, "fake", ["--model", "openrouter/vendor-x:v1.2@latest+beta"]))).code, 0);
  });

  test("--detect lists only installed CLIs", async () => {
    const box = sandbox();
    const run = spawnSync(process.execPath, [SCRIPT, "--detect"], { encoding: "utf8", env: environment(box) });
    const names = JSON.parse(run.stdout).map(({ provider }) => provider);
    assert.ok(names.includes("fake"));
    assert.ok(!names.includes("missing"));
  });
});
