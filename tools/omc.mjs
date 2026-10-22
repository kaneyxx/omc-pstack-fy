import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The contract file, and the hash that pins it. An `upstream.json` compatible entry holds the hash of these bytes, so sync and build
// agree on what a release passed.
export const CONTRACT = join(dirname(fileURLToPath(import.meta.url)), "omc.json");
export const contractHash = () => createHash("sha256").update(readFileSync(CONTRACT)).digest("hex");
export const bare = (version) => String(version).replace(/^v/, "");

// The other releases the plugin can name as checked. They come from a pin's compatible list, and only the entries that passed the
// contract with this hash count. A release that passed an earlier contract says nothing about this one, so editing tools/omc.json
// drops every entry.
export function compatibleVersions(entries, contract, verified) {
  return entries.filter((entry) => entry.contract === contract && bare(entry.version) !== bare(verified)).map((entry) => bare(entry.version));
}

export const readContract = () => JSON.parse(readFileSync(CONTRACT, "utf8"));

// The build checks a pin's compatible list with this before it reads it, because a list that is not [{ version, contract }, ...]
// would crash it with a TypeError instead of failing with a message.
export const isCompatibleList = (entries) => Array.isArray(entries) && entries.every((entry) => typeof entry?.version === "string" && typeof entry?.contract === "string");

// The files of a vendored oh-my-claudecode release, in the shape the checks below take: omcFile reads one by path (undefined when
// the release lacks it), and the agent and skill rosters are what the release ships. A folder under skills/ without a SKILL.md is
// not a skill.
export function vendoredOmc(base) {
  const omcFile = (path) => (existsSync(join(base, path)) ? readFileSync(join(base, path), "utf8") : undefined);
  const list = (dir) => (existsSync(join(base, dir)) ? readdirSync(join(base, dir)) : []);
  return {
    omcFile,
    omcAgents: list("agents").filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)),
    omcSkills: list("skills").filter((name) => omcFile(`skills/${name}/SKILL.md`) !== undefined),
  };
}

function rosterProblems({ contract, version, omcAgents, omcSkills }) {
  const problems = [];
  const roster = (kind, listed, shipped) => {
    for (const name of shipped.filter((name) => !listed.includes(name))) {
      problems.push(`oh-my-claudecode ${version} adds the ${name} ${kind}. Decide whether omc-pstack-fy should route it, then list it under ${kind}s in tools/omc.json.`);
    }
    for (const name of listed.filter((name) => !shipped.includes(name))) {
      problems.push(`oh-my-claudecode ${version} has no ${name} ${kind}. Update what omc-pstack-fy says about it, then drop it from tools/omc.json.`);
    }
  };
  roster("agent", contract.agents, omcAgents);
  roster("skill", contract.skills, omcSkills);
  return problems;
}

const omcAnchorProblems = ({ omc, find, ours, why }, version, omcFile) =>
  omcFile(omc)?.includes(find) ? [] : [`oh-my-claudecode ${version} no longer has ${JSON.stringify(find)} in ${omc}. Re-check ${ours}: ${why}`];

const ourAnchorProblems = ({ find, ours, uses = find }, ourFile) =>
  ourFile(ours)?.includes(uses) ? [] : [`${ours} no longer says ${JSON.stringify(uses)}. Update or drop that anchor in tools/omc.json.`];

// The half of the contract about oh-my-claudecode alone: the agent and skill rosters, and each anchor's find text in its omc file.
// Whether a release passes it does not depend on our plugin files, so sync can run it on a release the build never saw.
export function omcSideProblems({ contract, version, omcFile, omcAgents, omcSkills }) {
  return [...rosterProblems({ contract, version, omcAgents, omcSkills }), ...contract.anchors.flatMap((anchor) => omcAnchorProblems(anchor, version, omcFile))];
}

// The same check on the release vendored at `base`. A release missing from base fails every roster and anchor line.
export const vendoredProblems = (base, version, contract = readContract()) => omcSideProblems({ contract, version, ...vendoredOmc(base) });

// Checks tools/omc.json against a vendored oh-my-claudecode release and the plugin files the build produced. Each problem names
// what to re-check, so an OMC release that renames a step the bridge relies on fails the build instead of passing silently.
export function omcProblems({ contract, version, omcFile, omcAgents, omcSkills, ourFile }) {
  return [
    ...rosterProblems({ contract, version, omcAgents, omcSkills }),
    ...contract.anchors.flatMap((anchor) => [...omcAnchorProblems(anchor, version, omcFile), ...ourAnchorProblems(anchor, ourFile)]),
  ];
}
