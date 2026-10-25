# Overlay skill template

[`SKILL.md`](SKILL.md) is a minimal skill with the same frontmatter keys that the skills in `overlays/skills/` use. The build takes files only from `vendor/` and `overlays/`, so this copy never ships. Open an issue before you add a skill, as [CONTRIBUTING.md](../../../CONTRIBUTING.md) says.

## Add a skill

1. Pick a name of lowercase words joined by hyphens, at most 64 characters.
2. Copy `SKILL.md` to `overlays/skills/<name>/SKILL.md`. Copy only that file, because every file under `overlays/` ships in `plugin/`.
3. Set `name` in the frontmatter to the folder name. Replace the description and every paragraph of the body.
4. Run `node tools/build.mjs`. The skill appears at `plugin/skills/<name>/SKILL.md`.
5. Commit the overlay and the regenerated `plugin/` together.

## How the build registers it

A new skill needs no entry in `tools/rules.json` or `tools/rules/`. The build copies every file under `overlays/` into `plugin/` at the same path, so the folder is the registration. After the copy, the build treats the skill like an upstream one:

- It prefixes each command that names a plugin skill, such as `/unslop`, with `omc-pstack-fy:`, in the frontmatter too.
- It links each "the **name** skill" mention to that skill's `SKILL.md`.
- It adds the routing note under the H1 when the skill names another skill.

The build stops with a `FAIL` line in these cases:

- `name` differs from the folder name, or the folder name breaks the naming rule in step 1.
- The skill names another skill and has no H1 for the routing note.
- A relative link points at a file that is neither in `plugin/` nor upstream.
- The skill uses a Cursor name that no substitution rewrites, such as `cloud_base_branch`. The line reads `FAIL skills/<name> still uses the Cursor name cloud_base_branch, and the adapter is off`. Write the Claude Code names from [the mapping](../../claude-code-mapping.md).

`disable-model-invocation: true` stops the model from calling the skill through the Skill tool. The user types `/omc-pstack-fy:<name>`, and other skills reach it through the linked `SKILL.md`. Every overlay skill that is not a fork sets it. `overlays/skills/setup-pstack/SKILL.md` leaves it out, because it replaces an upstream skill that leaves it out.

## Replace an upstream file instead

An overlay at a path that upstream also has replaces the upstream file. That is a fork, the heaviest tool in rule 2 of the mapping. The build fails until the fork is registered with the sha256 of the upstream file it replaces. `tools/rules/50-core-skills.json` registers the fork of setup-pstack this way:

```json
  "forks": {
    "skills/setup-pstack/SKILL.md": "b45512f6ca5e96e81681984683b7472bfe892581da3a89a73cca4159438f29ed"
  }
```

To fork a pstack file, follow these steps:

1. Run `node tools/build.mjs`, then copy the built file `plugin/<path>` to `overlays/<path>`. The built file already has every rule edit applied.
2. If the copy is a `SKILL.md` with a routing note under its H1, delete that note. It is the paragraph that starts with "Most omc-pstack-fy skills set". The build adds the note again, so a copy that keeps it ships the note twice.
3. Delete every edit in `tools/rules/` whose `file` is `<path>`. An edit cannot target an overlay, so each edit left fails the build once, as in this line:

	```
	FAIL edit target skills/how/SKILL.md (tools/rules/50-core-skills.json) is an overlay. Make the change in overlays/skills/how/SKILL.md instead.
	```

4. Register the fork in the `forks` field of the topic's rules file, with the hash that `shasum -a 256 vendor/pstack/<path>` prints. The build compares that hash with the sha256 of the vendored upstream file.
5. Make your change in the overlay, then run `node tools/build.mjs` again.

When upstream changes that file, the hash stops matching and the build fails. Merge the upstream change into the overlay, then set the new hash that the `FAIL` line prints.
