# Changelog

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
