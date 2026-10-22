import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { carryForward, hasContract, matcher, newest, outgoingProblems, repin } from "../tools/sync.mjs";

describe("sync", () => {
  test("matches a file, a folder, and a glob that stays inside one folder", () => {
    const wanted = matcher(["LICENSE", "agents/", "pstack", "skills/*/SKILL.md"]);
    for (const path of ["LICENSE", "agents/executor.md", "pstack/skills/x/SKILL.md", "skills/ralph/SKILL.md"]) assert.ok(wanted(path), path);
    for (const path of ["LICENSE.md", "agentsx/a.md", "pstack-extra/a", "skills/ralph/notes.md", "skills/a/b/SKILL.md", "README.md"]) assert.ok(!wanted(path), path);
  });

  test("picks the newest X.Y.Z tag by number, skipping prereleases", () => {
    assert.equal(newest(["v5.7.5", "v5.7.10", "v5.10.0-rc.1", "v5.9.12", "latest", undefined]), "v5.9.12");
    assert.equal(newest(["1.2.0", "v1.10.0"]), "v1.10.0");
    assert.equal(newest(["nightly"]), undefined);
  });

  describe("carrying a release forward when the pin moves", () => {
    const pin = { version: "5.7.7", ref: "abc", compatible: [{ version: "5.7.5", contract: "old" }] };

    test("records the release the pin leaves under the current contract hash and keeps the older entries", () => {
      assert.deepEqual(carryForward(pin, "5.7.8", "now"), [
        { version: "5.7.5", contract: "old" },
        { version: "5.7.7", contract: "now" },
      ]);
    });

    test("starts the list from an empty one", () => {
      assert.deepEqual(carryForward({ ...pin, compatible: [] }, "5.7.8", "now"), [{ version: "5.7.7", contract: "now" }]);
    });

    test("records the release even when the pin moves to an older one", () => {
      assert.deepEqual(carryForward(pin, "5.7.4", "now").map(({ version }) => version), ["5.7.5", "5.7.7"]);
    });

    test("keeps one entry per release, with the hash of the latest contract it passed", () => {
      const again = { version: "5.7.5", compatible: [{ version: "5.7.5", contract: "old" }, { version: "5.7.6", contract: "old" }] };
      assert.deepEqual(carryForward(again, "5.7.8", "now"), [
        { version: "5.7.6", contract: "old" },
        { version: "5.7.5", contract: "now" },
      ]);
    });

    test("ignores a leading v on either version", () => {
      assert.deepEqual(carryForward({ ...pin, version: "v5.7.7" }, "v5.7.8", "now").at(-1), { version: "5.7.7", contract: "now" });
      assert.deepEqual(carryForward(pin, "v5.7.7", "now"), pin.compatible);
    });

    test("leaves the list alone when the pin stays on its release", () => {
      assert.deepEqual(carryForward(pin, "5.7.7", "now"), pin.compatible);
    });

    test("does not change the pin it reads", () => {
      const before = structuredClone(pin);
      carryForward(pin, "5.7.8", "now");
      assert.deepEqual(pin, before);
    });

    test("leaves the list alone when the release the pin leaves has problems, even moving to an older one", () => {
      assert.deepEqual(carryForward(pin, "5.7.8", "now", ["a check failed"]), pin.compatible);
      assert.deepEqual(carryForward(pin, "5.7.4", "now", ["a check failed"]), pin.compatible);
    });

    test("keeps an entry that was recorded earlier for the release, even when it now has problems", () => {
      const listed = { ...pin, compatible: [{ version: "5.7.7", contract: "old" }] };
      assert.deepEqual(carryForward(listed, "5.7.8", "now", ["a check failed"]), listed.compatible);
    });
  });

  describe("the pin a sync writes", () => {
    const omc = { repository: "r", track: "release", version: "5.7.7", ref: "aaa", tag: "v5.7.7", compatible: [{ version: "5.7.5", contract: "old" }] };
    const found = { ref: "bbb", tag: "v5.7.8", committedAt: "2026-10-23T00:00:00Z", version: "5.7.8" };

    test("moves a pin with a contract to the fetched release and lists the release it leaves", () => {
      const moved = repin(omc, found, () => "now");
      assert.deepEqual({ ...moved, compatible: undefined }, { ...omc, ...found, compatible: undefined });
      assert.deepEqual(moved.compatible, [
        { version: "5.7.5", contract: "old" },
        { version: "5.7.7", contract: "now" },
      ]);
    });

    test("gives a pin without a contract no list, and never reads the contract", () => {
      const pstack = { repository: "r", track: "main", version: "0.15.29", ref: "aaa" };
      const moved = repin(pstack, { ref: "bbb", version: "0.15.30" }, () => assert.fail("read the contract"));
      assert.deepEqual(moved, { repository: "r", track: "main", version: "0.15.30", ref: "bbb" });
      assert.ok(!hasContract(pstack));
      assert.ok(hasContract(omc));
    });

    test("keeps the list when the sync lands on the same release", () => {
      assert.deepEqual(repin(omc, { ...found, version: "5.7.7" }, () => "now").compatible, omc.compatible);
    });

    test("does not change the pin it reads", () => {
      const before = structuredClone(omc);
      repin(omc, found, () => "now");
      assert.deepEqual(omc, before);
    });
  });

  describe("the release a sync leaves behind, checked in vendor/ before it is replaced", () => {
    const contract = {
      agents: ["executor"],
      skills: ["ralph"],
      anchors: [{ omc: "skills/ralph/SKILL.md", find: "7.5 **Mandatory Deslop Pass**", ours: "hooks/omc-bridge.md", why: "ralph's step 7.5 runs deslop." }],
    };
    const omc = { repository: "r", track: "release", into: "oh-my-claudecode", version: "5.7.7", ref: "aaa", compatible: [{ version: "5.7.5", contract: "now" }] };
    const found = { ref: "bbb", version: "5.7.5" };
    const made = [];
    after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));
    const vendor = (ralph) => {
      const dir = mkdtempSync(join(tmpdir(), "omc-sync-"));
      made.push(dir);
      for (const [path, text] of Object.entries({ "agents/executor.md": "", "skills/ralph/SKILL.md": ralph })) {
        mkdirSync(dirname(join(dir, path)), { recursive: true });
        writeFileSync(join(dir, path), text);
      }
      return dir;
    };
    const moved = (ralph, to = found) => repin(omc, to, () => "now", outgoingProblems(omc, to.version, vendor(ralph), contract));

    test("is recorded when the vendored release passes the contract", () => {
      assert.deepEqual(moved("7.5 **Mandatory Deslop Pass**").compatible, [
        { version: "5.7.5", contract: "now" },
        { version: "5.7.7", contract: "now" },
      ]);
    });

    test("is not recorded when the vendored release lost an anchored passage, though the pin still moves", () => {
      const pin = moved("7.5 **Deslop**");
      assert.deepEqual(pin.compatible, omc.compatible);
      assert.equal(pin.version, "5.7.5");
      assert.equal(pin.ref, "bbb");
    });

    test("is checked only when a sync leaves it behind, and only for a pin with a contract", () => {
      const failing = vendor("7.5 **Deslop**");
      assert.equal(outgoingProblems(omc, "5.7.5", failing, contract).length, 1);
      assert.deepEqual(outgoingProblems(omc, "v5.7.7", failing, contract), []);
      assert.deepEqual(outgoingProblems({ ...omc, version: undefined }, "5.7.5", failing, contract), []);
      const { compatible, ...pstack } = omc;
      assert.deepEqual(outgoingProblems(pstack, "5.7.5", failing, contract), []);
    });

    test("keeps the list when the sync stays on the release, even though the vendored release fails", () => {
      assert.deepEqual(moved("7.5 **Deslop**", { ...found, version: "5.7.7" }).compatible, omc.compatible);
    });
  });
});
