import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = join(ROOT, "plugin");
const SCRIPT = join(PLUGIN, "hooks", "omc-bridge.mjs");
const OMC = "oh-my-claudecode@omc";
const SKILLS = ["poteto-mode", "interrogate", "deslop"].map((name) => join(PLUGIN, "skills", name, "SKILL.md"));
const VERIFIED = JSON.parse(readFileSync(join(PLUGIN, "hooks", "omc-version.json"), "utf8")).verified;

// A fake HOME and a project directory, so the bridge reads only the files a test writes.
function sandbox({ installed = true, version = VERIFIED } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "omc-bridge-test-")));
  const home = join(dir, "home");
  const project = join(dir, "project");
  mkdirSync(join(home, ".claude", "plugins"), { recursive: true });
  mkdirSync(join(project, ".claude"), { recursive: true });
  if (installed) writeJson(join(home, ".claude", "plugins", "installed_plugins.json"), { version: 2, plugins: { [OMC]: [{ scope: "user", version }] } });
  return { home, project };
}

function writeJson(path, value) {
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value));
}

const enabled = (value) => ({ enabledPlugins: { [OMC]: value } });

// The parent's Claude Code variables are dropped, so each test sets exactly the ones it means to.
function bridge(box, { stdin = JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: box.project }), cwd = ROOT, env = {} } = {}) {
  const { CLAUDE_CONFIG_DIR, CLAUDE_PROJECT_DIR, ...inherited } = process.env;
  const run = spawnSync(process.execPath, [SCRIPT], {
    cwd,
    encoding: "utf8",
    env: { ...inherited, HOME: box.home, USERPROFILE: box.home, ...env },
    ...(stdin === null ? { stdio: ["ignore", "pipe", "pipe"] } : { input: stdin }),
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "");
  return run.stdout;
}

function context(stdout) {
  const output = JSON.parse(stdout);
  assert.equal(output.hookSpecificOutput.hookEventName, "SessionStart");
  return output.hookSpecificOutput.additionalContext;
}

const startup = (box, source = "startup") => JSON.stringify({ hook_event_name: "SessionStart", source, cwd: box.project });

describe("omc-bridge", () => {
  test("hooks.json runs the bridge at session start and after compaction", () => {
    const hooks = JSON.parse(readFileSync(join(PLUGIN, "hooks", "hooks.json"), "utf8")).hooks.SessionStart;
    assert.equal(hooks.length, 1);
    for (const source of ["startup", "resume", "clear", "compact"]) assert.match(source, new RegExp(`^(${hooks[0].matcher})$`));
    assert.equal(hooks[0].hooks[0].command, 'node "${CLAUDE_PLUGIN_ROOT}/hooks/omc-bridge.mjs"');
  });

  test("prints nothing when oh-my-claudecode is not installed", () => {
    assert.equal(bridge(sandbox({ installed: false })), "");
  });

  test("injects the bridge with absolute skill paths when oh-my-claudecode is installed", () => {
    const text = context(bridge(sandbox()));
    for (const path of SKILLS) {
      assert.ok(existsSync(path), `${path} exists`);
      assert.ok(text.includes(`\`${path}\``), `the bridge names ${path}`);
    }
    assert.ok(text.includes("omc-pstack-fy:poteto-agent"));
    assert.ok(!text.includes("{{"), "every placeholder is filled");
    assert.ok(!text.includes("checked against"), "no version note when the installed OMC is the verified one");
    assert.equal(JSON.parse(bridge(sandbox())).systemMessage, undefined);
    assert.ok(text.split(/\s+/).length <= 350, "the bridge stays short, because every session pays for it");
  });

  test("tells the model and, at startup only, the user when the installed OMC is older than the verified one", () => {
    const box = sandbox({ version: "0.0.1" });
    const output = JSON.parse(bridge(box, { stdin: startup(box) }));
    assert.match(output.hookSpecificOutput.additionalContext, new RegExp(`checked against oh-my-claudecode ${VERIFIED}, and 0\\.0\\.1 is installed`));
    assert.match(output.systemMessage, /Update oh-my-claudecode with \/plugin/);
    const compacted = JSON.parse(bridge(box, { stdin: startup(box, "compact") }));
    assert.match(compacted.hookSpecificOutput.additionalContext, /keep OMC's own choice/);
    assert.equal(compacted.systemMessage, undefined);
  });

  test("keeps the bridge and gives no wrong advice when the installed version is unreadable", () => {
    const box = sandbox({ version: 5.8 });
    const output = JSON.parse(bridge(box, { stdin: startup(box) }));
    assert.ok(output.hookSpecificOutput.additionalContext.includes("omc-pstack-fy:poteto-agent"));
    assert.match(output.systemMessage, /Check both plugins with \/plugin/);
    const [major, minor, patch] = VERIFIED.split(".").map(Number);
    const prerelease = sandbox({ version: `${major}.${minor}.${patch + 1}-rc.1` });
    assert.match(JSON.parse(bridge(prerelease, { stdin: startup(prerelease) })).systemMessage, /Update omc-pstack-fy once/);
    const candidate = sandbox({ version: `${VERIFIED}-rc.1` });
    assert.match(JSON.parse(bridge(candidate, { stdin: startup(candidate) })).systemMessage, /Check both plugins/);
    assert.equal(JSON.parse(bridge(sandbox({ version: `v${VERIFIED}` }))).systemMessage, undefined, "a leading v is the same version");
  });

  test("tells the user only at startup, defaulting to startup when the input has no source", () => {
    const box = sandbox({ version: "0.0.1" });
    for (const source of ["resume", "clear", "compact"]) assert.equal(JSON.parse(bridge(box, { stdin: startup(box, source) })).systemMessage, undefined, source);
    assert.ok(JSON.parse(bridge(box, { stdin: JSON.stringify({ cwd: box.project }) })).systemMessage);
  });

  test("uses this project's own OMC install over the user's", () => {
    const box = sandbox({ installed: false });
    const installs = [{ scope: "user", version: VERIFIED }, { scope: "project", projectPath: box.project, version: "0.0.1" }];
    writeJson(join(box.home, ".claude", "plugins", "installed_plugins.json"), { version: 2, plugins: { [OMC]: installs } });
    assert.match(context(bridge(box)), /0\.0\.1 is installed/);
  });

  test("asks for an omc-pstack-fy update when the installed OMC is newer than the verified one", () => {
    const box = sandbox({ version: "999.0.0" });
    assert.match(JSON.parse(bridge(box, { stdin: startup(box) })).systemMessage, /Update omc-pstack-fy once a release checked against 999\.0\.0 is out/);
  });

  test("prints nothing when the project disables oh-my-claudecode in settings.local.json", () => {
    const box = sandbox();
    writeJson(join(box.home, ".claude", "settings.json"), enabled(true));
    writeJson(join(box.project, ".claude", "settings.json"), enabled(true));
    writeJson(join(box.project, ".claude", "settings.local.json"), enabled(false));
    assert.equal(bridge(box), "");
  });

  test("injects the bridge when the user disables oh-my-claudecode but the project enables it", () => {
    const box = sandbox();
    writeJson(join(box.home, ".claude", "settings.json"), enabled(false));
    assert.equal(bridge(box), "");
    writeJson(join(box.project, ".claude", "settings.json"), enabled(true));
    assert.ok(context(bridge(box)).includes("omc-pstack-fy:poteto-agent"));
  });

  test("prints nothing and exits 0 when installed_plugins.json is malformed", () => {
    const box = sandbox();
    writeJson(join(box.home, ".claude", "plugins", "installed_plugins.json"), "{ not json");
    assert.equal(bridge(box), "");
  });

  test("skips a malformed settings file and reads the next scope", () => {
    const box = sandbox();
    writeJson(join(box.project, ".claude", "settings.local.json"), "{ not json");
    writeJson(join(box.project, ".claude", "settings.json"), enabled(false));
    assert.equal(bridge(box), "");
    writeJson(join(box.project, ".claude", "settings.json"), enabled(true));
    assert.ok(context(bridge(box)).includes("omc-pstack-fy:poteto-agent"));
  });

  test("prefers CLAUDE_PROJECT_DIR over the input cwd", () => {
    const box = sandbox();
    writeJson(join(box.project, ".claude", "settings.local.json"), enabled(false));
    const sub = join(box.project, "sub");
    mkdirSync(sub);
    const stdin = JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: sub });
    assert.equal(bridge(box, { stdin, env: { CLAUDE_PROJECT_DIR: box.project } }), "");
  });

  test("reads CLAUDE_CONFIG_DIR instead of ~/.claude when it is set", () => {
    const box = sandbox({ installed: false });
    const config = join(dirname(box.home), "config");
    mkdirSync(join(config, "plugins"), { recursive: true });
    writeJson(join(config, "plugins", "installed_plugins.json"), { version: 2, plugins: { [OMC]: [{ scope: "user" }] } });
    assert.equal(bridge(box), "");
    assert.ok(context(bridge(box, { env: { CLAUDE_CONFIG_DIR: config } })).includes("omc-pstack-fy:poteto-agent"));
  });

  test("ignores a project-scope install that belongs to another project", () => {
    const box = sandbox({ installed: false });
    const install = (projectPath) => writeJson(join(box.home, ".claude", "plugins", "installed_plugins.json"), { version: 2, plugins: { [OMC]: [{ scope: "project", projectPath }] } });
    install(join(dirname(box.home), "elsewhere"));
    assert.equal(bridge(box), "");
    install(box.project);
    assert.ok(context(bridge(box)).includes("omc-pstack-fy:poteto-agent"));
    const link = join(dirname(box.home), "link");
    symlinkSync(box.project, link);
    const stdin = JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd: link });
    assert.ok(context(bridge(box, { stdin })).includes("omc-pstack-fy:poteto-agent"), "a symlinked project matches its install");
  });

  test("works without stdin, reading settings from the current directory", () => {
    const box = sandbox();
    assert.ok(context(bridge(box, { stdin: null, cwd: box.project })).includes("omc-pstack-fy:poteto-agent"));
    writeJson(join(box.project, ".claude", "settings.local.json"), enabled(false));
    assert.equal(bridge(box, { stdin: null, cwd: box.project }), "");
  });
});
