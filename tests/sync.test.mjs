import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { matcher, newest } from "../tools/sync.mjs";

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
});
