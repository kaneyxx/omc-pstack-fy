# Changelog

## [1.8.1] - 2026-11-25

Built from upstream pstack v0.15.48 (https://github.com/cursor/plugins/tree/41e4009), checked against oh-my-claudecode v5.8.7 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/4c7f14f).

### Added

- `/omc-pstack-fy:setup-pstack` now offers to write `~/.claude/rules/omc-pstack-fy-delegates.md`. The rule has every `omc-pstack-fy:poteto-agent` delegate read fy-mode's **For delegates** section and follow it, even when its brief does not name the section. Say yes if you use `/omc-pstack-fy:fy-mode`. Setup asks first and writes nothing on a no. A file that already holds the rule is reported as current. A file with other text is shown as a difference, and setup asks before it overwrites it. Before, this file had to be written by hand on each machine.

### Changed

- fy-mode's **For delegates** section says the rule file counts the same as a brief that names the section.

### Fixed

- The first run of `/omc-pstack-fy:setup-pstack` on a new machine no longer shows a red `Error: Exit code 1`. The model rule and the `~/.claude/rules/` folder do not exist yet on a first run, and setup now checks for the file with a command that exits 0 either way.

### Build

- `tools/omc.json` pins the sentences in oh-my-claudecode's `deep-interview` and `plan` skills that say where specs and plans are saved. fy-mode's project check relies on `.omc/specs/` and `.omc/plans/`, so the build now fails when an OMC release rewrites either sentence. The list of compatible OMC releases is unchanged.

## [1.8.0] - 2026-11-25

Built from upstream pstack v0.15.48 (https://github.com/cursor/plugins/tree/41e4009), checked against oh-my-claudecode v5.8.7 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/4c7f14f).

### Added

- `/omc-pstack-fy:reframe`, from upstream pstack v0.15.47 and v0.15.48. Use it when you cannot name what you are building. It starts from your files and your own words. When your description could mean more than one problem, it first lists the two or three it could be and picks the likeliest. Then it gives 8 to 12 expert terms, ranked by how much each would change what gets built, each with a real project that uses it and a link it checked. It borrows terms from 2 or 3 neighboring fields, says where each analogy breaks, and rewrites your description with the new words. It runs only when you type it. The README, `/omc-pstack-fy:poteto-help`, and guide 02 each gain an entry for it.

### Changed

- The oh-my-claudecode check moves to v5.8.7. Version 5.8.4 stays compatible, and 5.8.5 and 5.8.6 are now recorded as compatible. The session-start note about a version mismatch no longer shows for 5.8.5, 5.8.6, or 5.8.7. Between v5.8.4 and v5.8.7, oh-my-claudecode changed the text of its `document-specialist` agent and of six of its skills. This plugin relies on none of those passages, and its bridge is unchanged.

## [1.7.3] - 2026-11-23

Built from upstream pstack v0.15.46 (https://github.com/cursor/plugins/tree/7a58391), checked against oh-my-claudecode v5.8.4 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/b93059f).

### Changed

- `/omc-pstack-fy:fy-mode` sends requirements, plans, and the run of a plan to oh-my-claudecode (OMC) when OMC is installed and enabled. Before, it listed OMC's `deep-interview`, `plan`, and `ralplan` with no trigger, so an agent could skip them.
- fy-mode checks the project once per request, before any code, plan, or playbook. A project passes when a spec in `.omc/specs/`, a plan in `.omc/plans/`, a README, a `CLAUDE.md`, or a design doc states its goal and its architecture. When either is missing, fy-mode runs `oh-my-claudecode:deep-interview` first. A new project lands there.
- A change to one or two existing files with an obvious approach goes ahead without the interview. The check is skipped for a question, for scholarly prose, and when you started an OMC workflow yourself. You can tell fy-mode to skip the interview. An unattended run skips it and labels its assumed goal and architecture as guesses.
- Work that needs more than one PR gets `oh-my-claudecode:ralplan` first, in place of poteto-mode's Multi-phase plan playbook. An OMC workflow runs a spec or a plan. Work that fits one PR still runs its poteto-mode playbook in the chat. `/omc-pstack-fy:poteto-mode` on its own is unchanged.

### Maintenance

- CI runs `actions/checkout` and `actions/setup-node` v7 on Node 24.

## [1.7.2] - 2026-11-23

Built from upstream pstack v0.15.46 (https://github.com/cursor/plugins/tree/7a58391), checked against oh-my-claudecode v5.8.4 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/b93059f).

### Fixed

- `/omc-pstack-fy:statechart` runs on native Windows, from upstream pstack v0.15.46. It stops TLC's process group without `/bin/sh`, and it reads TLC's `\r\n` line ends. Before, a spec with a broken rule could stop on Windows with "TLC exited 12 ... but its output names no rule that broke". On native Windows, run `node --disable-warning=ExperimentalWarning <skill dir>/scripts/statechart.ts` with Node 22.18 to 22.x, or Node 23.6 or later.

### Changed

- Upstream pstack v0.15.44 and v0.15.45 moved its Gemini panel seat to `gemini-4-neon-xhigh`. This plugin's default panels stay `fable high, opus high, sonnet high`, and an external `gemini:` entry you chose keeps its effort. You do not need to rerun `/omc-pstack-fy:setup-pstack`.

### Build

- `tools/release.mjs` stops when a read of a tag, `origin/main`, or a GitHub release fails. It builds and commits the version bump in a worktree, lists untitled note groups after the titled ones, and leaves a stale `plugin/` alone under `--dry-run`. `.claude/skills/verify-release/` checks the script under injected faults. None of this ships in the plugin.

## [1.7.1] - 2026-11-17

Built from upstream pstack v0.15.43 (https://github.com/cursor/plugins/tree/e1cc031), checked against oh-my-claudecode v5.8.4 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/b93059f).

### Changed

- Skill texts follow upstream pstack v0.15.43, which shortened them. poteto-mode now has short triggers and shorter Subagents, reply, and Playbooks sections. 14 of the principle skills, `unslop`, `technical-writing`, and the Opening a PR, Babysit, and Multi-phase plan playbooks are shorter too.
- No role runs above `xhigh`. `/omc-pstack-fy:setup-pstack` offers three budgets, `large`, `medium`, and `small`.
- Rerun `/omc-pstack-fy:setup-pstack` once. A rule file without the new `# defaults: 3` line comes from an older setup. The rerun turns an `unlimited` budget into `large`, drops the lines of retired roles, and keeps every model you chose, and tells you which values it replaced. Until you rerun it, poteto-mode keeps honoring your old lines and tells you once per session.
- `hardest tasks` stays, and this is the owner's choice, not upstream's. Upstream retired the role. This plugin keeps it at `fable xhigh`, so poteto-mode still sends the hardest changes to Fable. When a `fable` agent fails, at spawn or in its result, because Fable's usage limit or quota is reached, the same brief reruns on `opus` at the same effort, and the reply says so.
- That quota rule covers every `fable` entry. An arena runner seat and any other non-reviewer role reruns on `opus` even when that repeats a model. A reviewer panel drops its `fable` seat when `opus` would repeat another seat's model, and says that it ran one seat short. A pool that picks one entry moves to the next entry its own rule allows.
- Outside a panel, `fable` runs in three cases. A role line or a skill's default names it, you named it for the task, or two `opus xhigh` runs of the same brief failed its check.
- The `arena cross-judge pool` default stays `fable high, opus high, sonnet high`. Upstream dropped its Fable seat, because it counts Fable and Opus as one vendor. This plugin compares models, so `fable` is still a seat of its own.
- Another vendor's model now sits on three roles only, `interrogate reviewers`, `arena cross-judge pool`, and `second opinion`. `reflect tooling` is retired.
- `/omc-pstack-fy:reflect` is one file and starts no subagents. It reads the transcript itself, keeps only lessons that would change a future agent's work, and waits for your approval. An edit to a plugin skill still goes to a rule file.
- `/omc-pstack-fy:architect` is a short brief. It sketches two shapes and picks one. A large or contested design goes to `/omc-pstack-fy:arena`. It no longer has the "with checkpoint" mode. Ask in the prompt to see the design first.
- The Multi-phase plan playbook writes the plan and stops. Execution starts when you say go.

### Added

- `worker.md`, in the poteto-mode skill folder. Every agent that poteto-mode starts reads it first. It tells a worker that the kickoff's bar is the whole bar, to decide a reversible choice instead of asking, to open every PR ready for review, and to keep the PR body to 40 lines.

### Removed

- The Orchestrate playbook. Upstream pstack v0.15.43 deleted it. Large or cross-cutting work goes to `/omc-pstack-fy:figure-it-out`. With oh-my-claudecode installed and enabled, a standing multi-day program goes to OMC's ultragoal, team, or ralph.
- The `architect runners`, `reflect tooling`, and `reflect judgment, divergent, synthesizer` roles. `/omc-pstack-fy:setup-pstack` drops their lines on its next run, a `reflect tooling` line that named another vendor included.
- The `unlimited` budget.
- `check-plan.mjs` and its test, `architect`'s three reference files, and `reflect`'s four prompt templates. Upstream pstack v0.15.43 deleted them.

## [1.7.0] - 2026-11-16

Built from upstream pstack v0.15.42 (https://github.com/cursor/plugins/tree/bf0c7cd), checked against oh-my-claudecode v5.8.4 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/b93059f).

### Changed

- Default models follow upstream pstack v0.15.42. The code roles (`feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`) default to `opus xhigh`, up from `sonnet xhigh`. `hardest tasks` defaults to `fable xhigh`. `swarm workers` default to `opus high`. The four panel roles (`arena runners`, `arena cross-judge pool`, `architect runners`, `interrogate reviewers`) default to `fable high, opus high, sonnet high`, so each panel keeps three distinct models. `judgment and prose` stays at `opus xhigh`.
- Two defaults are the owner's choices, not upstream's. `hardest tasks` runs at `xhigh`, not upstream's `max`. `reflect tooling` defaults to `sonnet high`, not upstream's Opus, so reflect's three lenses never run on one model.
- A budget now moves each role's default effort. `large` keeps it, `unlimited` raises it one step, `medium` lowers it one step, and `small` lowers it two.
- Rerun `/omc-pstack-fy:setup-pstack` once. A rule file without the new `# defaults: 2` line comes from an older setup. The rerun replaces the old defaults it recognizes and keeps every value you chose yourself, and it never leaves a panel with fewer distinct models. Until you rerun it, poteto-mode keeps honoring your old lines and tells you once per session.
- poteto-mode no longer runs `/omc-pstack-fy:how` before it designs or debugs. Its playbooks trace the code directly. `/omc-pstack-fy:how` is now one read-only subagent that you invoke yourself.
- `/omc-pstack-fy:why` is now one short skill. It answers from the commits and PR discussions behind the code, cites what the authors wrote, and marks its own inferences. It starts from source control and looks further only when that trail is thin. `/omc-pstack-fy:recall` now starts its own investigator for each source.
- `/omc-pstack-fy:statechart` reports the spec's line and column when SANY cannot read it. In its charts, an arrow into a parent state with one way in enters through the parent's border.
- `/omc-pstack-fy:sharpen` asks the rewritten prompt to prototype any choice an experiment can settle.

### Removed

- The `how explorer`, `how explainer`, `why investigators`, and `why synthesizer` roles. `/omc-pstack-fy:setup-pstack` drops their lines on its next run.
- `how`'s two prompt templates and `why`'s 12 reference files. Upstream pstack v0.15.42 deleted them.

## [1.6.4] - 2026-11-11

Built from upstream pstack v0.15.36 (https://github.com/cursor/plugins/tree/1ba91fc), checked against oh-my-claudecode v5.8.4 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/b93059f).

### Changed

- The hook now treats oh-my-claudecode 5.8.4 as verified and 5.8.1 through 5.8.3 as compatible, so OMC 5.8.4 no longer gets the version note at session start. Upstream changed only two version strings in the vendored files. The plugin's skills, agents, and bridge text did not change.

## [1.6.3] - 2026-11-10

Built from upstream pstack v0.15.36 (https://github.com/cursor/plugins/tree/1ba91fc), checked against oh-my-claudecode v5.8.3 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/73e0d61).

### Changed

- The hook now treats oh-my-claudecode 5.8.3 as verified and 5.8.1 and 5.8.2 as compatible. OMC 5.8.0 added 35 skills, and 5.8.1 added `sdd`. Releases without them, 5.7.x and 5.8.0, now get the version note at session start, and updating OMC with `/plugin` clears it. They fail only the checks for the new skills, and the bridge relies on none of OMC's new skills.
- OMC 5.8 ships its own versions of 26 skills that share a name with this plugin's, among them `interrogate`, `how`, `why`, `arena`, and `reflect`. A bare name in the Skill tool runs OMC's copy, because ours set `disable-model-invocation: true`. The bridge and the routing note in each skill now say so, and still send the model to Read this plugin's `SKILL.md`. OMC workflows still run `/omc-pstack-fy:interrogate` at the final review gate and `/omc-pstack-fy:deslop` in place of ai-slop-cleaner.
- The READMEs name `/omc-pstack-fy:interrogate` in full, so it is not mistaken for OMC's `interrogate`.

## [1.6.2] - 2026-11-03

Built from upstream pstack v0.15.36 (https://github.com/cursor/plugins/tree/1ba91fc), checked against oh-my-claudecode v5.7.30 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/14cd0fe).

### Changed

- The hook now treats oh-my-claudecode 5.7.30 as verified and 5.7.29 as compatible, so OMC 5.7.30 no longer gets the version note at session start. Upstream changed only two version strings in the vendored files. The plugin's skills, agents, and bridge text did not change.

## [1.6.1] - 2026-11-02

Built from upstream pstack v0.15.36 (https://github.com/cursor/plugins/tree/1ba91fc), checked against oh-my-claudecode v5.7.29 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/083ae63).

### Changed

- The hook now treats oh-my-claudecode 5.7.29 as verified and 5.7.19 through 5.7.27 as compatible, so OMC 5.7.20 through 5.7.29 no longer get the version note at session start. The plugin's skills, agents, and bridge text did not change.
- A small upstream sync now releases as a patch. A sync that changes what this plugin does, or adds a skill or role, stays a minor. `upstream-watch` and `tools/sync.mjs --latest` recommend the level to match.

## [1.6.0] - 2026-10-29

Built from upstream pstack v0.15.36 (https://github.com/cursor/plugins/tree/1ba91fc), checked against oh-my-claudecode v5.7.19 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/e10206d).

### Changed

- `/omc-pstack-fy:interrogate` is upstream pstack's new adversarial review. Each `interrogate reviewers` entry runs one adversary that tries to break the change with a run against the real code. The lead reruns each finding's command, and only findings the rerun proves survive. The report lists the verified findings, what each adversary dropped and why, and whether the panel was same-vendor or cross-vendor. It applies no fixes.
- An `interrogate reviewers` entry from another vendor still runs read-only through `pstack-ask`. Its repros must write no files, a command it cannot run comes back marked not run, and the lead reruns every command in a worktree, never in your checkout. When the scope is not the current checkout, a Claude reviewer takes each external seat.
- In oh-my-claudecode workflows, the final review gate now runs OMC's own review (`code-reviewer` or its review skill) and `/omc-pstack-fy:interrogate` side by side, and the stricter verdict wins. Before, interrogate replaced OMC's review there. The new interrogate skips structure and maintainability, so OMC's review still covers them. Earlier review passes run `code-reviewer` alone, as before.
- The Orchestrate playbook is upstream's new agentic version. The coordinator spawns workers with the `Agent` tool, keeps the program's state in `~/.claude/projects/<slug>/omc-pstack-fy/orchestrate/<project-slug>/` with `notes.md` as its tracker, and calls no scripts and runs no polling loops. A worker's completion notification wakes it, and `gh pr view` and `gh pr checks` give live PR state, because Claude Code ships no PR or CI event subscription. Workers run as worktree subagents on this machine.
- `/omc-pstack-fy:arena`'s judge never runs on the parent's model. It tries entries from another vendor first, then Claude entries on another model. With no judge available, the coordinator picks the base alone and says so. `/omc-pstack-fy:setup-pstack` describes the same order.
- poteto-mode asks for a restatement of your goal in its first message on a task, and in each subagent brief and final report, through the `in-your-own-words` skill.

### Removed

- The `orch` scripts under poteto-mode's `scripts/orch/` and interrogate's four `references/` files. Upstream pstack v0.15.36 deleted them.

## [1.5.0] - 2026-10-28

Built from upstream pstack v0.15.34 (https://github.com/cursor/plugins/tree/519d36a), checked against oh-my-claudecode v5.7.19 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/e10206d).

### Changed

- `/omc-pstack-fy:statechart` is upstream pstack's new TypeScript compiler. Write a TLA+ spec and its config, then run `scripts/statechart SPEC.tla [--config FILE] [--view FILE] [--out DIR]`. It checks every rule with TLC, writes `report.md` and `chart.mmd`, and gives the shortest path to each state that breaks a rule. A view module passed with `--view` labels the states and steps in the reader's words.
- The command needs Node 22.18 or later in the 22 line, Node 23.6 or later, Bun 1.1.5 or later, or Deno 2.0 or later. With none of them, it names these versions and exits 127.
- When you ask for an image of a chart, or a chart is too large to read as text, the agent installs `pele@1.9.0` from npm outside your repo and writes an SVG, as the skill's `references/render.md` says.
- With `mise` installed and `TLA2TOOLS` unset, the first model check installs TLC and a Temurin JDK through mise even when `JAVA` is set. Before, setting `JAVA` skipped the JDK.
- The plugin README's note on what `/omc-pstack-fy:statechart` downloads now names the runtime, the JDK, and the `pele` install. It warns that the command runs the `--view` module as code, and that TLC runs Java `.class` files it finds beside the spec, so run it only on a spec folder and a view you trust.
- The bridge is checked against oh-my-claudecode v5.7.19. With OMC 5.7.14 through 5.7.19 installed, a session starts with no update reminder. The bridge routes work the same way as before.

### Removed

- `/omc-pstack-fy:statechart` no longer has `from-spec`, `from-chart`, `render`, `--png`, `--cover`, `--against`, `--against-config`, `--fixed`, `--expect-broken`, the `<Spec>.map.mjs` mapping file, `stories.md`, or `summary.json`. Upstream pstack v0.15.33 replaced them with the single command above.

## [1.4.2] - 2026-10-27

Built from upstream pstack v0.15.32 (https://github.com/cursor/plugins/tree/99b609a), checked against oh-my-claudecode v5.7.17 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/726fa45).

### Changed

- The bridge is checked against oh-my-claudecode v5.7.17. With OMC 5.7.14, 5.7.15, 5.7.16, or 5.7.17 installed, a session starts with no update reminder. The bridge routes work the same way as before.

## [1.4.1] - 2026-10-26

Built from upstream pstack v0.15.32 (https://github.com/cursor/plugins/tree/99b609a), checked against oh-my-claudecode v5.7.16 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/9e2dda5).

### Changed

- `/omc-pstack-fy:reflect` puts an approved edit to a plugin skill in a rule file, `.claude/rules/<plugin>-<skill>.md` for one project or `~/.claude/rules/<plugin>-<skill>.md` for every project. Before, it copied the skill to `.claude/skills/` and edited the copy. Claude Code loads that copy beside the plugin skill, so `/<plugin>:<skill>` and every skill that reads it by path kept the old text.
- Each rule opens with a condition, so it does nothing outside that skill. A rule that changes or removes a step quotes the step it replaces, and each edit records the plugin version it was written against.
- A `tune description` row for a plugin skill now goes to Backlog, because a rule cannot change a skill's description.

## [1.4.0] - 2026-10-26

Built from upstream pstack v0.15.32 (https://github.com/cursor/plugins/tree/99b609a), checked against oh-my-claudecode v5.7.16 (https://github.com/Yeachan-Heo/oh-my-claudecode/tree/9e2dda5).

### Changed

- The bridge is checked against oh-my-claudecode v5.7.16. With OMC 5.7.14, 5.7.15, or 5.7.16 installed, a session starts with no update reminder. The bridge routes work the same way as before.

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
