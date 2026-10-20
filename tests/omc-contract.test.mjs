import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { omcProblems } from "../tools/omc.mjs";

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
