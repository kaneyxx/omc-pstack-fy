// Checks tools/omc.json against a vendored oh-my-claudecode release and the plugin files the build produced. Each problem names
// what to re-check, so an OMC release that renames a step the bridge relies on fails the build instead of passing silently.
export function omcProblems({ contract, version, omcFile, omcAgents, omcSkills, ourFile }) {
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
  for (const { omc, find, ours, uses = find, why } of contract.anchors) {
    if (!omcFile(omc)?.includes(find)) problems.push(`oh-my-claudecode ${version} no longer has ${JSON.stringify(find)} in ${omc}. Re-check ${ours}: ${why}`);
    if (!ourFile(ours)?.includes(uses)) problems.push(`${ours} no longer says ${JSON.stringify(uses)}. Update or drop that anchor in tools/omc.json.`);
  }
  return problems;
}
