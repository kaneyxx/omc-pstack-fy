import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { compatibleVersions, contractHash, isCompatibleList, omcProblems, omcSideProblems, readContract, vendoredOmc, vendoredProblems } from "../tools/omc.mjs";

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

describe("the oh-my-claudecode side of the contract", () => {
  const side = ({ agents = ["executor", "verifier"], skills = ["ralph"], ralph = "7.5 **Mandatory Deslop Pass**" } = {}) =>
    omcSideProblems({ contract, version: "9.9.9", omcFile: (path) => (path === "skills/ralph/SKILL.md" ? ralph : undefined), omcAgents: agents, omcSkills: skills });

  test("passes a release that ships the listed roster and every anchored passage", () => {
    assert.deepEqual(side(), []);
  });

  test("fails a release that lacks an anchored passage", () => {
    const [found, ...rest] = side({ ralph: "7.5 **Deslop**" });
    assert.deepEqual(rest, []);
    assert.match(found, /9\.9\.9 no longer has "7\.5 \*\*Mandatory Deslop Pass\*\*" in skills\/ralph\/SKILL\.md\./);
  });

  test("fails a release that lacks the anchored file", () => {
    assert.equal(omcSideProblems({ contract, version: "9.9.9", omcFile: () => undefined, omcAgents: ["executor", "verifier"], omcSkills: ["ralph"] }).length, 1);
  });

  test("fails a release with an extra or a missing agent or skill", () => {
    assert.match(side({ agents: ["executor", "verifier", "builder"] })[0], /adds the builder agent/);
    assert.match(side({ agents: ["executor"] })[0], /has no verifier agent/);
    assert.match(side({ skills: ["ralph", "refit"] })[0], /adds the refit skill/);
    assert.match(side({ skills: [] })[0], /has no ralph skill/);
  });

  test("says what the build says about the release, and leaves our plugin files to the build", () => {
    for (const release of [{}, { ralph: "gone" }, { agents: [], skills: ["x"] }]) assert.deepEqual(side(release), problems(release));
    assert.equal(problems({ bridge: "nothing" }).length, side().length + 1);
  });

  describe("on a vendored tree", () => {
    const made = [];
    after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
    const vendor = (files) => {
      const dir = mkdtempSync(join(tmpdir(), "omc-contract-"));
      made.push(dir);
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      return dir;
    };
    const tree = { "agents/executor.md": "", "agents/verifier.md": "", "skills/ralph/SKILL.md": "7.5 **Mandatory Deslop Pass**" };

    test("reads the agents, the skills that have a SKILL.md, and any file by path", () => {
      const { omcFile, omcAgents, omcSkills } = vendoredOmc(vendor({ ...tree, "agents/notes.txt": "", "skills/scratch/notes.md": "x", "docs/CLAUDE.md": "hello" }));
      assert.deepEqual(omcAgents.sort(), ["executor", "verifier"]);
      assert.deepEqual(omcSkills, ["ralph"]);
      assert.equal(omcFile("docs/CLAUDE.md"), "hello");
      assert.equal(omcFile("docs/missing.md"), undefined);
    });

    test("passes a matching tree and fails one that lost an anchor, gained an agent, or does not exist", () => {
      assert.deepEqual(vendoredProblems(vendor(tree), "9.9.9", contract), []);
      assert.equal(vendoredProblems(vendor({ ...tree, "skills/ralph/SKILL.md": "rewritten" }), "9.9.9", contract).length, 1);
      assert.match(vendoredProblems(vendor({ ...tree, "agents/builder.md": "" }), "9.9.9", contract)[0], /adds the builder agent/);
      assert.equal(vendoredProblems(join(tmpdir(), "omc-contract-missing"), "9.9.9", contract).length, 4);
    });
  });
});

describe("a compatible list", () => {
  test("accepts an empty list and entries with a version and a contract", () => {
    assert.ok(isCompatibleList([]));
    assert.ok(isCompatibleList([{ version: "5.7.5", contract: "abc" }]));
  });

  test("rejects what would crash the build or write a bogus version", () => {
    for (const bad of [undefined, null, {}, "5.7.5", [null], [{ version: "5.7.5" }], [{ contract: "abc" }], [{ version: 575, contract: "abc" }]]) assert.ok(!isCompatibleList(bad), JSON.stringify(bad));
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

describe("contract hash", () => {
  const fixture = () => ({
    about: "What omc-pstack-fy relies on.",
    agents: ["executor", "verifier"],
    skills: ["ralph"],
    anchors: [
      { omc: "skills/ralph/SKILL.md", find: "7.5 **Mandatory Deslop Pass**", ours: "hooks/omc-bridge.md", uses: "ralph step 7.5", why: "ralph's step 7.5 runs deslop." },
      { omc: "docs/CLAUDE.md", find: "Route code to `executor`", ours: "hooks/omc-bridge.md", why: "The bridge quotes this line." },
    ],
  });
  const edited = (edit) => {
    const changed = fixture();
    edit(changed);
    return contractHash(changed);
  };

  test("is a sha256 digest, and the default is the contract file", () => {
    assert.match(contractHash(fixture()), /^[0-9a-f]{64}$/);
    assert.equal(contractHash(), contractHash(readContract()));
  });

  test("stays the same when only prose or this plugin's own text changes", () => {
    const edits = {
      "the about text changes": (contract) => (contract.about = "A fixed typo."),
      "an anchor's why is corrected": (contract) => (contract.anchors[0].why = "A corrected reason."),
      "every anchor's why is rewritten": (contract) => contract.anchors.forEach((anchor) => (anchor.why = "Rewritten.")),
      "an anchor's ours file moves": (contract) => (contract.anchors[0].ours = "hooks/other.md"),
      "an anchor's uses text changes": (contract) => (contract.anchors[0].uses = "ralph step 8"),
      "an anchor gains a uses text": (contract) => (contract.anchors[1].uses = "the quoted line"),
    };
    const base = contractHash(fixture());
    for (const [change, edit] of Object.entries(edits)) assert.equal(edited(edit), base, change);
  });

  test("changes when a check reads something different", () => {
    const edits = {
      "an agent is added": (contract) => contract.agents.push("critic"),
      "an agent is dropped": (contract) => contract.agents.pop(),
      "an agent is renamed": (contract) => (contract.agents[0] = "builder"),
      "a skill is added": (contract) => contract.skills.push("plan"),
      "a skill is dropped": (contract) => contract.skills.pop(),
      "an anchor's omc file moves": (contract) => (contract.anchors[0].omc = "skills/ralph/OTHER.md"),
      "an anchor's find text changes": (contract) => (contract.anchors[0].find = "7.5 **Deslop Pass**"),
      "an anchor is added": (contract) => contract.anchors.push({ omc: "a.md", find: "x", ours: "b.md" }),
      "an anchor is dropped": (contract) => contract.anchors.pop(),
    };
    const base = contractHash(fixture());
    for (const [change, edit] of Object.entries(edits)) assert.notEqual(edited(edit), base, change);
  });

  test("changes when a field is added, so a new field is checked until someone calls it prose", () => {
    const base = contractHash(fixture());
    assert.notEqual(edited((contract) => (contract.requires = ["5.7"])), base, "top-level field");
    assert.notEqual(edited((contract) => (contract.anchors[0].since = "5.7.5")), base, "anchor field");
    assert.notEqual(edited((contract) => (contract.anchors[0].note = "Read by a later check.")), base, "anchor field with a prose-sounding name");
  });

  test("skips only fields that never change whether a release passes", () => {
    const release = ({ ralph = "7.5 **Mandatory Deslop Pass**", agents = ["executor", "verifier"] }) => ({
      omcFile: (path) => ({ "skills/ralph/SKILL.md": ralph, "docs/CLAUDE.md": "Route code to `executor`" })[path],
      omcAgents: agents,
      omcSkills: ["ralph"],
    });
    const releases = { "passes": {}, "lost an anchored passage": { ralph: "rewritten" }, "dropped an agent": { agents: ["executor"] } };
    const problemCount = (contract, name) => omcSideProblems({ contract, version: "9.9.9", ...release(releases[name]) }).length;
    assert.equal(problemCount(fixture(), "passes"), 0);
    assert.ok(problemCount(fixture(), "lost an anchored passage") > 0);
    assert.ok(problemCount(fixture(), "dropped an agent") > 0);

    const reworded = (value) => (typeof value === "string" ? `${value} (reworded)` : [...value, "reworded"]);
    const fields = [];
    for (const key of Object.keys(fixture()).filter((key) => key !== "anchors")) fields.push([key, (contract) => (contract[key] = reworded(contract[key]))]);
    fixture().anchors.forEach((anchor, index) => {
      for (const key of Object.keys(anchor)) fields.push([`anchors[${index}].${key}`, (contract) => (contract.anchors[index][key] = reworded(contract.anchors[index][key]))]);
    });
    const base = contractHash(fixture());
    const skipped = fields.filter(([, edit]) => edited(edit) === base);
    assert.ok(skipped.length > 0, "the hash skips something");
    for (const [field, edit] of skipped) {
      const changed = fixture();
      edit(changed);
      for (const name of Object.keys(releases)) assert.equal(problemCount(changed, name), problemCount(fixture(), name), `${field} on a release that ${name}`);
    }
  });
});
