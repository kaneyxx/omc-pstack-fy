import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { carryForward, hasContract, matcher, newest, repin } from "../tools/sync.mjs";

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
});
