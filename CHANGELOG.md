# Changelog

## [1.3.1] - 2026-10-26

Built from upstream pstack v0.15.32 (https://github.com/cursor/plugins/tree/99b609a), checked against oh-my-claudecode v5.7.14 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/5632614).

### Changed

- `/omc-pstack-fy:fy-mode` keeps every commit green. A bug fix still runs its new test before the fix and sees it fail. Then it commits the test and the fix together, and it quotes the failing command and assertion.
- `/omc-pstack-fy:fy-mode` has a **For delegates** section. It lists the fy-mode rules a delegate follows, such as the integrity and research code rules, and the lead names it in the brief of every agent that writes code or commits.
- A pull request fails CI when it changes `tools/version-lock.json` or `CHANGELOG.md`.

### Fixed

- `node tools/build.mjs --check` fails on anything under `plugin/` that the build did not write. That includes a symlink with matching bytes, a stray `.DS_Store`, and the empty folder a git submodule leaves in a checkout.
- `node tools/sync.mjs --verify` fails on a `.gitignore` in `vendor/` that no sync wrote. Before, the build copied such a file into `plugin/` and the check passed.
- The test stand-in for a vendor CLI no longer fails with `EAGAIN` when the machine is busy.

## [1.3.0] - 2026-10-25

Built from upstream pstack v0.15.32 (https://github.com/cursor/plugins/tree/99b609a), checked against oh-my-claudecode v5.7.14 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/5632614).

### Added

- `/omc-pstack-fy:ketchup-video` catches you up like `/omc-pstack-fy:ketchup`. It shows what happened in a short silent video of slides, with the calls waiting on you as text under it.
- Unlike upstream pstack, `/omc-pstack-fy:ketchup-video` links the video file by its absolute path instead of embedding it. It renders with a tool that is already installed, such as ffmpeg, never installs one, and gives only the calls when none is installed.
- `/omc-pstack-fy:statechart` has a `render CHART.mmd` command. It draws one Mermaid chart as a PNG without running TLC, so the chart can come from `from-spec`, from `from-chart`, or from a person.
- `from-spec --cover` trims an overview that is too large to read. It keeps the shortest path to each settled state plus every bug path, and prints what it leaves out.
- `from-spec` takes `--config`, `--fixed-config`, and `--against-config` to name the config of each model.
- `from-spec` checks each PROPERTY in the config in its own TLC run, and `--expect-broken` accepts a PROPERTY too. The charts do not draw a PROPERTY, so `stories.md` names its TLC counterexample.
- `--theme light`, `dark`, or `classic` sets the colors of each PNG that `--png` or `render` draws.

### Changed

- `/omc-pstack-fy:statechart` charts any system that moves between states, such as a product flow, a protocol, or a service. Before, it charted only what an app's user sees.
- The `from-spec` overview draws every state unless you pass `--cover`. Before, a mapping with `readerActions` trimmed it on its own.
- `--against` checks the agreed spec only with its own config, `AGREED.cfg` or the file you pass to `--against-config`. It no longer falls back to the config of the code model, and it stops with exit code 2 when that config is missing.
- `/omc-pstack-fy:statechart` now uses `--expect-broken` to check a goal that the system must be able to reach. It writes a rule that says the goal never happens, and the path that breaks that rule is a way to the goal.
- With `mise` installed and `TLA2TOOLS` unset, the first `from-spec` or `from-chart` run installs TLC 1.7.4 through mise, plus a Temurin 25 JDK unless `JAVA` is set. With the JDK the download is a few hundred MB. Before, the command stopped until you set `TLA2TOOLS`, and setting it still uses your own TLC.
- `--png` draws with Pele and resvg instead of `npx @mermaid-js/mermaid-cli`. The first `--png` or `render` run installs `pele@1.8.0` and `@resvg/resvg-js@2.6.2` from npm into `~/.cache/statechart/`, or `$XDG_CACHE_HOME/statechart/` when that is set, with exact versions and install scripts off.
- The sample model in `scripts/model/OutputFolder.*` is gone from `/omc-pstack-fy:statechart`.
- When the check is a TLA+ model, `/omc-pstack-fy:create-formal-verification-skill` now writes a skill that reads every result with `/omc-pstack-fy:statechart`. The generated skill sits in your project, outside the plugin, so it tells the agent to search the plugin cache, `~/.claude/plugins/cache/omc-pstack-fy/` by default, for `skills/statechart/SKILL.md`, to take the copy with the highest `version` when several match, and to skip the chart when omc-pstack-fy is not installed.
- `/omc-pstack-fy:reflect` never edits a skill under `plugins/cache/`. It names a copy in `.claude/skills/<skill>/` or `~/.claude/skills/<skill>/` before you approve, edits that copy after, and never opens a PR or pushes.
- `/omc-pstack-fy:swarm` numbers its Phase A steps 1 to 4. Picking the worker model moves from step 4 to step 3, and giving each worker its own output moves from step 5 to step 4.
- The bridge needed no change for oh-my-claudecode v5.7.14. The startup notice stays quiet on 5.7.5, 5.7.7, and 5.7.14, and any other release still gets the notice.

### Fixed

- The `watch-pr` script that the Babysit and Shipping playbooks run no longer puts a fork's pull request in your stack as a parent when the fork's branch has the same name as your base branch. A fork that opens `main` against `main` no longer sends the stack walk into a loop that crashes.
- `watch-pr` no longer waits past `--timeout`. Each wait between polls ends at the deadline.
- `orch frontier set` in the Orchestrate playbook uses the one open pull request of a branch that also has closed or merged ones. Before, it stopped with "multiple pull requests".
- `check-plan.mjs` in the multi-phase plan playbook no longer fails a plan for a colon, a curly quote, or a long dash inside a code span that uses two or more backticks.
- `worktree-audit.sh` in the worktree cleanup playbook reads the date of each worktree's last chat with GNU `stat` and `date`, as on Linux or with Homebrew's gnubin. Before, it missed that date there, so a worktree with a chat in the last four days could be listed as safe to prune.

### Docs

- The plugin README says how to turn on auto-update, in `/plugin` > Marketplaces > `omc-pstack-fy` > Enable auto-update. It also says to run `/omc-pstack-fy:update` to update once by hand.
- The plugin README lists what `/omc-pstack-fy:statechart` downloads on first use, and warns that the skill runs the `<Spec>.map.mjs` beside a spec as JavaScript. Run it only on specs you trust.

### Update

From this release on, `/omc-pstack-fy:update` is enough. Run it in Claude Code, then restart Claude Code or run `/reload-plugins`. If you are on 1.1.1 or older, which has no update skill, run `npx -y github:kaneyxx/omc-pstack-fy update` in a terminal instead.

## [1.2.0] - 2026-10-22

Built from upstream pstack v0.15.30 (https://github.com/cursor/plugins/tree/eb4db2b), checked against oh-my-claudecode v5.7.7 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/057ac16).

### Added

- `/omc-pstack-fy:update` updates omc-pstack-fy in one step. It refreshes the marketplace, updates the plugin, and tells you to restart Claude Code.
- `npx -y github:kaneyxx/omc-pstack-fy update` does the same from a terminal, straight from GitHub, with nothing installed globally. It needs Node 18 or later and git. The README shows an alias, so you can type `omc-pstack-fy update`. Do not install `omc-pstack-fy` from the npm registry, because that name does not belong to this project.

### Docs

- The README now leads with turning on auto-update once, in `/plugin` > Marketplaces > `omc-pstack-fy` > Enable auto-update, or with `"autoUpdate": true` in `settings.json`.

### Update

This release adds the update skill, so get it with the npx command above, or by hand. By hand, run these in a terminal, one at a time, then restart Claude Code:

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

From the next release on, `/omc-pstack-fy:update` or the npx command is enough.

## [1.1.1] - 2026-10-22

Built from upstream pstack v0.15.30 (https://github.com/cursor/plugins/tree/eb4db2b), checked against oh-my-claudecode v5.7.7 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/057ac16).

### Fixed

- The startup notice no longer asks you to update oh-my-claudecode when your release passed the same bridge contract. OMC 5.7.5 and 5.7.7 are both quiet now. A newer OMC release, or an older one that was never checked, still gets the notice.

### Maintenance

- `node tools/sync.mjs omc` records the release it replaces as compatible only after checking it against `tools/omc.json`. Editing that file drops every recorded release, so the notice comes back until the new contract is checked.

### Update

Run these in a terminal, one at a time, then restart Claude Code:

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

## [1.1.0] - 2026-10-22

Built from upstream pstack v0.15.30 (https://github.com/cursor/plugins/tree/eb4db2b), checked against oh-my-claudecode v5.7.7 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/057ac16).

### Added

- `/omc-pstack-fy:statechart`, from upstream pstack v0.15.30. It draws what an app's user sees as a Mermaid statechart generated from a TLA+ model, and marks each bug TLC finds as a numbered path.

### Changed

- Chinese replies match the script you write. Write Simplified Chinese and replies come in Simplified Chinese with mainland terms. Write Traditional Chinese and replies keep Taiwan terms. Both follow the `unslop-zh` skill. This holds in poteto-mode, fy-mode, and the `fy` output style.
- `/omc-pstack-fy:setup-pstack` first asks which language to run in: English, 简体中文, or 繁體中文. It skips the question when your message already shows the language. The rule file it writes stays in English.
- Checked against oh-my-claudecode v5.7.7. The bridge needed no change.

### Maintenance

- The upstream watch runs daily. When pstack or oh-my-claudecode has a newer version, CI tries the sync, and the issue says whether the update needs only a version bump or real work.

### Update

Run these in a terminal, one at a time, then restart Claude Code:

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

## [1.0.1] - 2026-10-21

Built from upstream pstack v0.15.29 (https://github.com/cursor/plugins/tree/88d4751), checked against oh-my-claudecode v5.7.5 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/6688a30).

### Added

- The `omc-pstack-fy:fy` output style. It puts fy-mode's reply rules in every reply without running a playbook, so a quick question gets a short answer, and it keeps Claude Code's coding instructions. Pick it for one project with `/output-style omc-pstack-fy:fy`, or for every project with `"outputStyle": "omc-pstack-fy:fy"` in `~/.claude/settings.json`.

### Docs

- The README now says how to update an installed copy.
- The README spells out the install order and why OMC must come from its own marketplace.

### Update

Run these in a terminal, one at a time, then restart Claude Code:

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

## [1.0.0] - 2026-10-20

Built from upstream pstack v0.15.29 (https://github.com/cursor/plugins/tree/88d4751), checked against oh-my-claudecode v5.7.5 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/6688a30).

First release of omc-pstack-fy: pstack's engineering rigor for people who live in [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (OMC). [pstack](https://github.com/cursor/plugins/tree/main/pstack) is Lauren Tan's work, and OMC is Yeachan Heo's. This unofficial companion rebuilds pstack natively for Claude Code and makes it the engine OMC hands code to.

### Install

```bash
/plugin marketplace add kaneyxx/omc-pstack-fy
/plugin install omc-pstack-fy@omc-pstack-fy
```

Install oh-my-claudecode as its README says, then run `/omc-pstack-fy:setup-pstack`. Keep using OMC as before; its workflows now hand code to pstack. To run pstack directly, use `/omc-pstack-fy:poteto-mode` or `/omc-pstack-fy:fy-mode`.

### What is in it

- **OMC first, pstack for the code.** OMC keeps every keyword and workflow: interviews, plans, ultragoal, team, ralph, the wiki, memory, and the verifier. A SessionStart hook in the plugin tells OMC's workflows to hand each code unit to a poteto-mode playbook, ai-slop-cleaner steps to `deslop`, and the final code review to `interrogate`. It writes nothing to your config, and disabling the plugin removes it.
- **Follows both upstreams.** OMC is pinned like pstack, at its newest release. `tools/omc.json` lists the OMC agents, skills, and passages the bridge relies on, and the build fails when an OMC release changes one of them. The hook tells you at startup when your installed OMC differs from the version the bridge was checked against. A weekly workflow opens an issue when pstack or OMC has newer files.
- **pstack, native to Claude Code.** All 56 upstream skills (minus the Cursor-only `make-bot-ui`), both agents, and the guide, with every Cursor name rewritten for Claude Code (293 to 0) and no runtime adapter. `deslop`, `control-ui`, and `control-cli` from cursor-team-kit are bundled. `docs/claude-code-mapping.md` records each decision.
- **Built, not hand-copied.** `tools/build.mjs` generates the plugin from pinned upstream commits through checked edits, substitutions, and overlays. An upstream rewrite of an edited passage fails the build instead of being skipped. `tools/sync.mjs` updates either upstream in one command, and `tools/release.mjs` cuts a release.
- **Cross-vendor review, read-only.** Review and judging roles accept `[provider:]model [effort]`, such as `codex:gpt-5-codex high`. The `pstack-ask` skill runs another vendor's CLI in a throwaway clone, checks the user's repository before and after, and reports any change as `breach`. Vendor command templates ship unverified until a real CLI is wired in.
- **Personal choices**, kept apart from the translation: replies in Traditional Chinese (Taiwan) under `unslop-zh`, and `fy-mode`, which routes each step by what it produces, with research code held to reproducibility rules and scholarly writing sent to the research skills.

### Known limits

- No vendor CLI has been run for real yet, and there is no OS sandbox. The integrity check runs once, when the CLI exits.
- The hook does not read managed settings, so it cannot see OMC disabled there.
- `orch` and `watch-pr` need bun.
