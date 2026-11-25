import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN = join(ROOT, "plugin");
const SKILL = "skills/setup-pstack/SKILL.md";

// setup-pstack writes this block word for word to ~/.claude/rules/omc-pstack-fy-delegates.md.
function delegateRule(path) {
  const rule = readFileSync(path, "utf8").match(/^```\n(# omc-pstack-fy delegates\n[\s\S]*?)^```$/m)?.[1];
  assert(rule, `${path} has no fenced block that starts with "# omc-pstack-fy delegates"`);
  return rule;
}

function named(rule, re, what) {
  const match = rule.match(re);
  assert(match, `the delegate rule names no ${what}`);
  return match.slice(1);
}

const lines = (path) => readFileSync(path, "utf8").split("\n");

describe("setup-pstack delegate rule", () => {
  const rule = delegateRule(join(PLUGIN, SKILL));

  test("the build leaves the rule's text as the overlay wrote it", () => {
    assert.equal(rule, delegateRule(join(ROOT, "overlays", SKILL)));
  });

  // A changed rule shows as other text on every machine that already has it, and setup-pstack then asks to overwrite it.
  test("keeps the text that installed copies hold", () => {
    const installed = "3938bcf918736956ca2e645c74de9f191fef92a5d660eb9dd61ec0dba6c4eaa8";
    assert.equal(createHash("sha256").update(rule).digest("hex"), installed, "The delegate rule's text changed. If that is intended, update this hash and say in the release notes that setup-pstack will ask to overwrite the installed file.");
  });

  test("names this marketplace's plugin cache folder and the plugin's manifest", () => {
    const [folder] = named(rule, /the copy under `~\/\.claude\/plugins\/cache\/([^/`]+)\/`/, "plugin cache folder");
    assert.equal(folder, JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "marketplace.json"), "utf8")).name);
    const [manifest] = named(rule, /whose `([^`]+)` has the highest semantic `version`/, "plugin manifest");
    assert(existsSync(join(PLUGIN, manifest)), `plugin/${manifest} is missing`);
    assert.equal(typeof JSON.parse(readFileSync(join(PLUGIN, manifest), "utf8")).version, "string");
  });

  test("names a heading that the plugin's delegate agent has", () => {
    const [heading] = named(rule, /the heading `(#+ [^`]+)`/, "heading");
    const [plugin, agent] = named(rule, /you are an `([\w-]+):([\w-]+)` delegate/, "delegate agent");
    assert.equal(plugin, JSON.parse(readFileSync(join(PLUGIN, ".claude-plugin", "plugin.json"), "utf8")).name);
    const path = join(PLUGIN, "agents", `${agent}.md`);
    assert(existsSync(path), `plugin/agents/${agent}.md is missing`);
    assert(lines(path).includes(`name: ${agent}`), `plugin/agents/${agent}.md is not named ${agent}`);
    assert(lines(path).includes(heading), `plugin/agents/${agent}.md has no line "${heading}"`);
  });

  test("names a fy-mode section that the plugin has", () => {
    const [section, skill] = named(rule, /read the \*\*([^*]+)\*\* section of the ([\w-]+) skill/, "section");
    const [file] = named(rule, /Use `(skills\/[^`]+)`/, "skill file");
    assert.equal(file, `skills/${skill}/SKILL.md`);
    const path = join(PLUGIN, file);
    assert(existsSync(path), `plugin/${file} is missing`);
    assert(lines(path).some((line) => /^#{1,6} /.test(line) && line.replace(/^#+ /, "") === section), `plugin/${file} has no "${section}" heading`);
  });
});
