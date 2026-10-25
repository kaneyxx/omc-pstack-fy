# Pull request example

This is the description a contributor could write for a small rule fix. The edit it describes is real. It is the `skills/poteto-help/SKILL.md` edit in `tools/rules/30-excluded.json`. The pull request around it is an example, and its headings follow the [pull request template](../../.github/pull_request_template.md).

Title, which is also the commit subject:

```
fix: drop the make-bot-ui row from poteto-help
```

Description:

```markdown
## What changed

`tools/rules/30-excluded.json` gains one edit. It removes the "Build a page whose buttons wake a Grok Bot over a webhook" row from the table in `skills/poteto-help/SKILL.md`. `plugin/skills/poteto-help/SKILL.md` is regenerated in the same commit.

## Why

`tools/rules.json` excludes `skills/make-bot-ui/`, because it wakes a Grok Bot through Cursor Automations webhooks, which Claude Code does not have. poteto-help still listed it. The build pointed the row's link at the skill on GitHub, so the build passed, and the plugin offered `/make-bot-ui`, a command it does not ship.

No issue, because a rule edit can go straight to a pull request.

## How I verified it

- `node tools/build.mjs` ends with `Cursor names left for native rewrites: 0`.
- `grep -n make-bot-ui plugin/skills/poteto-help/SKILL.md` prints nothing. Before the change it printed the row.
- `node --test tests/*.test.mjs` reports `fail 0`.
- `node tools/sync.mjs --verify` reports that `vendor/` matches both pins.
- `node tools/build.mjs --check --skip-release-lock` reports `plugin/ is up to date (omc-pstack-fy 1.2.0).`

## Checklist

- [x] One rule or one fix.
- [x] The new rule has a true `why`.
- [x] No hand edits to `vendor/` or `plugin/`. `plugin/` comes from `node tools/build.mjs`.
- [x] No release. I did not run `tools/release.mjs` or change `CHANGELOG.md`, `tools/version-lock.json`, or a version field.
- [x] No personal paths, email addresses, tokens, or other private data.
- [x] Not an upstream problem. Upstream ships make-bot-ui, and only this build leaves it out.
```

## What makes it easy to review

The title says what the change does, in the `type: summary` form that [CONTRIBUTING.md](../../CONTRIBUTING.md#make-a-change) asks for. "What changed" names the rules file and the generated file, so the reviewer knows which diff to read first. "Why" states a fact the reviewer can check in `tools/rules.json`, and says why the build did not catch the problem. Each verification line gives the command and the result it printed, and the `grep` line shows the problem before and after. The checklist answers the questions a reviewer would otherwise ask.
