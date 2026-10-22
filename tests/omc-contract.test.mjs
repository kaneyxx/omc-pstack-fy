import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compatibleVersions, omcProblems } from "../tools/omc.mjs";

const contract = {
  agents: ["executor", "verifier"],
  skills: ["ralph"],
  anchors: [{ omc: "skills/ralph/SKILL.md", find: "7.5 **Mandatory Deslop Pass**", ours: "hooks/omc-bridge.md", uses: "ralph step 7.5", why: "ralph's step 7.5 runs deslop." }],
};

// A vendored OMC release and a plugin that satisfy the contract, with overrides for each case.
function problems({ agents = ["executor", "verifier"], skills = ["ralph"], ralph = "7.5 **Mandatory Deslop Pass**", bridge = "ralph step 7.5 runs deslop" } = {}) {
  return omcProblems({
    contract,
    version: "9.9.9",
    omcFile: (path) => (path === "skills/ralph/SKILL.md" ? ralph : undefined),
    omcAgents: agents,
    omcSkills: skills,
    ourFile: (path) => (path === "hooks/omc-bridge.md" ? bridge : undefined),
  });
}

describe("omc contract", () => {
  test("passes when the release matches the contract", () => {
    assert.deepEqual(problems(), []);
  });

  test("fails on an agent or skill the contract does not list, and on one the release dropped", () => {
    const found = problems({ agents: ["executor", "verifier", "builder"], skills: [] });
    assert.equal(found.length, 2);
    assert.match(found[0], /9\.9\.9 adds the builder agent\. Decide whether omc-pstack-fy should route it/);
    assert.match(found[1], /9\.9\.9 has no ralph skill/);
  });

  test("fails when OMC rewrites an anchored passage, naming the file to re-check", () => {
    const [found] = problems({ ralph: "7.5 **Deslop**" });
    assert.match(found, /no longer has "7\.5 \*\*Mandatory Deslop Pass\*\*" in skills\/ralph\/SKILL\.md\. Re-check hooks\/omc-bridge\.md: ralph's step 7\.5 runs deslop\./);
  });

  test("fails when our file stops using an anchor, so the list stays current", () => {
    const [found] = problems({ bridge: "deslop runs at the end" });
    assert.match(found, /hooks\/omc-bridge\.md no longer says "ralph step 7\.5"/);
  });
});

describe("compatible releases", () => {
  const entries = [
    { version: "5.7.4", contract: "old" },
    { version: "5.7.5", contract: "now" },
    { version: "5.7.6", contract: "now" },
    { version: "5.7.7", contract: "now" },
  ];

  test("keeps the releases that passed the current contract, in order, without the verified one", () => {
    assert.deepEqual(compatibleVersions(entries, "now", "5.7.7"), ["5.7.5", "5.7.6"]);
  });

  test("drops every release when the contract changed", () => {
    assert.deepEqual(compatibleVersions(entries, "edited", "5.7.8"), []);
  });

  test("returns an empty list for an empty one", () => {
    assert.deepEqual(compatibleVersions([], "now", "5.7.7"), []);
  });

  test("ignores a leading v and writes bare versions", () => {
    assert.deepEqual(compatibleVersions([{ version: "v5.7.5", contract: "now" }, { version: "v5.7.7", contract: "now" }], "now", "5.7.7"), ["5.7.5"]);
  });
});
