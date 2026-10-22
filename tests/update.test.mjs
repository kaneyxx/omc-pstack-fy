import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = join(ROOT, "plugin", "skills", "update");
const SCRIPT = join(SKILL_DIR, "scripts", "omc-pstack-fy.mjs");
const PACKAGE = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const MARKETPLACE_UPDATE = "plugin marketplace update omc-pstack-fy";
const PLUGIN_UPDATE = "plugin update omc-pstack-fy@omc-pstack-fy";
const RESTART = "Restart Claude Code to load it, or run /reload-plugins in a session that is already open.";
const posix = { skip: process.platform === "win32" && "the stub claude is a POSIX script" };

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

function tempDir(prefix) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  made.push(dir);
  return dir;
}

function sandbox() {
  const dir = tempDir("omc-pstack-fy-update-");
  const bin = join(dir, "bin");
  const log = join(dir, "calls.log");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "claude"),
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2).join(" ");
appendFileSync(process.env.STUB_LOG, args + "\\n");
if (process.env.STUB_FAIL_ON && args.includes(process.env.STUB_FAIL_ON)) {
  console.error("stub claude: failing " + args);
  process.exit(Number(process.env.STUB_EXIT ?? 1));
}
console.log("stub claude: ok " + args);
`,
  );
  chmodSync(join(bin, "claude"), 0o755);
  const calls = () => (existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : []);
  const run = (script, args, { env = {}, cwd = dir, path = [bin, dirname(process.execPath), process.env.PATH] } = {}) =>
    spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", env: { ...process.env, PATH: path.join(delimiter), STUB_LOG: log, ...env } });
  return { dir, bin, calls, run };
}

describe("omc-pstack-fy update", posix, () => {
  test("runs the marketplace update, then the plugin update, streams their output, and ends with the restart line", () => {
    const box = sandbox();
    const result = box.run(SCRIPT, ["update"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(box.calls(), [MARKETPLACE_UPDATE, PLUGIN_UPDATE]);
    const lines = result.stdout.trim().split("\n");
    assert.deepEqual(lines, [
      `$ claude ${MARKETPLACE_UPDATE}`,
      `stub claude: ok ${MARKETPLACE_UPDATE}`,
      `$ claude ${PLUGIN_UPDATE}`,
      `stub claude: ok ${PLUGIN_UPDATE}`,
      `Update finished. ${RESTART}`,
    ]);
  });

  test("stops at the first failure, skips the second command, and exits with the failing code", () => {
    const box = sandbox();
    const result = box.run(SCRIPT, ["update"], { env: { STUB_FAIL_ON: "marketplace", STUB_EXIT: "3" } });
    assert.equal(result.status, 3);
    assert.deepEqual(box.calls(), [MARKETPLACE_UPDATE]);
    assert.match(result.stderr, /stub claude: failing/);
    assert.match(result.stderr, /Update stopped\. `claude plugin marketplace update omc-pstack-fy` exited with code 3\./);
    assert.ok(!result.stdout.includes("Update finished"));
  });

  test("exits with the code of a failing second command after the first one ran", () => {
    const box = sandbox();
    const result = box.run(SCRIPT, ["update"], { env: { STUB_FAIL_ON: "plugin update", STUB_EXIT: "7" } });
    assert.equal(result.status, 7);
    assert.deepEqual(box.calls(), [MARKETPLACE_UPDATE, PLUGIN_UPDATE]);
    assert.match(result.stderr, /Update stopped\. `claude plugin update omc-pstack-fy@omc-pstack-fy` exited with code 7\./);
    assert.ok(!result.stdout.includes("Update finished"));
  });

  test("gives the same result from any working directory", () => {
    const box = sandbox();
    const elsewhere = tempDir("omc-pstack-fy-cwd-");
    const result = box.run(SCRIPT, ["update"], { cwd: elsewhere });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(box.calls(), [MARKETPLACE_UPDATE, PLUGIN_UPDATE]);
  });

  test("stops with 127 and says so when claude is not on the PATH", () => {
    const box = sandbox();
    const result = box.run(SCRIPT, ["update"], { path: [join(box.dir, "empty")] });
    assert.equal(result.status, 127);
    assert.match(result.stderr, /Update stopped\. claude is not on your PATH\./);
    assert.deepEqual(box.calls(), []);
  });

  for (const flag of ["help", "--help", "-h"]) {
    test(`${flag} prints the usage and exits 0 without running claude`, () => {
      const box = sandbox();
      const result = box.run(SCRIPT, [flag]);
      assert.equal(result.status, 0);
      assert.match(result.stdout, /^Usage: omc-pstack-fy <command>\n/);
      assert.match(result.stdout, /^ {2}update {3}/m);
      assert.deepEqual(box.calls(), []);
    });
  }

  for (const args of [[], ["upgrade"], ["update", "--force"], ["--version"]]) {
    test(`${JSON.stringify(args)} prints the usage to stderr and exits 2 without running claude`, () => {
      const box = sandbox();
      const result = box.run(SCRIPT, args);
      assert.equal(result.status, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /Usage: omc-pstack-fy <command>/);
      if (args.length > 0) assert.ok(result.stderr.startsWith(`Unknown command: ${args.join(" ")}\n`));
      assert.deepEqual(box.calls(), []);
    });
  }
});

describe("the /omc-pstack-fy:update skill", () => {
  const body = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
  const frontmatter = body.match(/^---\n([\s\S]*?)\n---/)[1];
  const field = (name) => frontmatter.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1];
  const injected = body.match(/^```!\n(.*)\n```$/m)[1];

  test("never runs on the model's own initiative", () => {
    assert.equal(field("disable-model-invocation"), "true");
  });

  test("injects the update script with || true so the model sees a failure, and allowed-tools pre-approves exactly the script command", () => {
    const command = 'node "${CLAUDE_SKILL_DIR}/scripts/omc-pstack-fy.mjs" update';
    assert.equal(injected, `${command} || true`);
    assert.equal(field("allowed-tools"), `Bash(${command})`);
  });

  test("runs the script that package.json installs as the omc-pstack-fy command", () => {
    const script = injected.match(/"\$\{CLAUDE_SKILL_DIR\}\/(.*)"/)[1];
    assert.equal(join(SKILL_DIR, script), join(ROOT, PACKAGE.bin["omc-pstack-fy"]));
    assert.ok(existsSync(SCRIPT));
  });

  test("leaves the two commands to the script, so they have one home", () => {
    assert.ok(!body.includes("claude plugin"));
  });
});

describe("the npm package", () => {
  test("ships the update script as an executable bin with a node shebang, and nothing else but npm's own files", () => {
    assert.deepEqual(PACKAGE.bin, { "omc-pstack-fy": "plugin/skills/update/scripts/omc-pstack-fy.mjs" });
    assert.ok(readFileSync(SCRIPT, "utf8").startsWith("#!/usr/bin/env node\n"));
    if (process.platform !== "win32") assert.ok((statSync(SCRIPT).mode & 0o111) !== 0, "the script is executable");
    const cache = tempDir("omc-pstack-fy-npm-");
    const packed = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts", "--cache", cache], { cwd: ROOT, encoding: "utf8", env: { ...process.env, npm_config_update_notifier: "false" } });
    assert.equal(packed.status, 0, packed.stderr);
    const paths = JSON.parse(packed.stdout)[0].files.map(({ path }) => path).sort();
    assert.deepEqual(paths, ["LICENSE", "README.md", "package.json", "plugin/skills/update/scripts/omc-pstack-fy.mjs"]);
  });

  test("has no dependencies and no install scripts", () => {
    for (const key of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "scripts"]) assert.equal(PACKAGE[key], undefined, key);
  });

  test("installs a working omc-pstack-fy command into a global prefix", posix, () => {
    const box = sandbox();
    const pack = spawnSync("npm", ["pack", "--json", "--ignore-scripts", "--cache", join(box.dir, "npm-cache"), "--pack-destination", box.dir], { cwd: ROOT, encoding: "utf8", env: { ...process.env, npm_config_update_notifier: "false" } });
    assert.equal(pack.status, 0, pack.stderr);
    const tarball = join(box.dir, JSON.parse(pack.stdout)[0].filename);
    const prefix = join(box.dir, "prefix");
    const install = spawnSync("npm", ["install", "--global", "--prefix", prefix, "--offline", "--cache", join(box.dir, "npm-cache"), "--no-audit", "--no-fund", "--ignore-scripts", tarball], { cwd: box.dir, encoding: "utf8" });
    assert.equal(install.status, 0, install.stderr);
    const command = join(prefix, "bin", "omc-pstack-fy");
    const env = { ...process.env, PATH: [box.bin, dirname(process.execPath), process.env.PATH].join(delimiter), STUB_LOG: join(box.dir, "calls.log") };
    const update = spawnSync(command, ["update"], { cwd: box.dir, encoding: "utf8", env });
    assert.equal(update.status, 0, update.stderr);
    assert.deepEqual(box.calls(), [MARKETPLACE_UPDATE, PLUGIN_UPDATE]);
    const help = spawnSync(command, ["--help"], { cwd: box.dir, encoding: "utf8", env });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /^Usage: omc-pstack-fy <command>/);
  });
});
