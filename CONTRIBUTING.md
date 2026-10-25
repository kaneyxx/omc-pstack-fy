# Contributing to omc-pstack-fy

Outside contributions are welcome. This file says what you can change, how to verify a change, and what happens after your pull request merges.

## Know what this project is

omc-pstack-fy is a translation and a bridge. It is not a fork of pstack's ideas. The skills, playbooks, and engineering rules in [pstack](https://github.com/cursor/plugins/tree/main/pstack) are Lauren Tan's, and [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (OMC) is Yeachan Heo's. This repo decides how pstack's text reads in Claude Code and how OMC hands code work to pstack. Every difference from upstream is a rule with a reason, so a reviewer can trace each changed sentence to the rule that changed it.

The repo has three layers. `vendor/` holds the upstream files at the commits pinned in `upstream.json`. `tools/rules/*.json` and `overlays/` hold every change. `node tools/build.mjs` builds `plugin/` from `vendor/` plus the rules and overlays, and `plugin/` is what Claude Code installs. [How the build works](README.md#how-the-build-works) lists each build step.

## Change only what is yours to change

| You can change | You must not change by hand |
| --- | --- |
| `tools/rules/*.json`, to change how upstream text reads in Claude Code | `vendor/`. Only `node tools/sync.mjs` writes it, and `node tools/sync.mjs --verify` fails on a hand edit. |
| `overlays/`, to add a file or to replace an upstream one | `plugin/`. Only `node tools/build.mjs` writes it, and `node tools/build.mjs --check` fails on a hand edit. |
| `docs/claude-code-mapping.md`, when a mapping is wrong or missing | `upstream.json`. The sync writes the pins. |
| `tools/*.mjs` and `tests/`, with a test for the behavior you change | `CHANGELOG.md`, `tools/version-lock.json`, and the `version` fields in `tools/rules.json`, `.claude-plugin/marketplace.json`, and `package.json`. `node tools/release.mjs` moves them. |
| `README.md`, `README.zh-TW.md`, and the files in `docs/` | The meaning of an upstream skill. [Report it upstream](#report-upstream-problems-upstream). |

When you change only the English in `README.md`, the maintainer updates `README.zh-TW.md` to match.

## Put each rule in its topic file

Each file in `tools/rules/` owns one topic, and its `about` field names it. The build applies the files in file-name order.

| File | Topic |
| --- | --- |
| `10-naming.json` | Install commands, the `omc-pstack-fy:` prefix, and the notes in the plugin README about this build |
| `30-excluded.json` | Mentions of skills the build leaves out |
| `40-core.json` | Global substitutions for Cursor names whose Claude Code form is right in every context |
| `50-core-skills.json` | poteto-mode's `SKILL.md`, the agents, setup-pstack, the panel and research skills, the plugin README, and the guide |
| `60-history.json` | Skills that read chat history or author skills, the help and teaching skills, the principles, and the bundled cursor-team-kit skills |
| `70-playbooks.json` | poteto-mode's playbooks, references, and scripts |
| `80-personal.json` | The owner's personal choices, which are not translations |

A rules file holds an `about` string and any of `edits`, `substitutions`, `allow`, and `forks`. [The rule edit example](docs/contributing/rule-edit-example.md) explains each field of an edit.

## Follow these principles

**Keep upstream's meaning.** Change the mechanism, never the rigor, as rule 1 of [the Claude Code mapping](docs/claude-code-mapping.md#rules-for-rewriting) says. People install this plugin to get pstack. A rule that changes what a skill asks for ships a different skill under Lauren's name.

**Give every rule a true `why`.** Each edit and each substitution carries a `why` that names the fact that makes the upstream text wrong in Claude Code. The `why` is the only record of the reason. When upstream rewords a passage, the next person reads the `why` to decide whether the rule still applies. [The rule edit example](docs/contributing/rule-edit-example.md) compares strong and weak ones.

**Use the lightest tool that fits.** Rule 2 of the mapping orders the tools. A global substitution comes first, but only for a mapping that is right in every context. An edit on one exact upstream passage comes next. A fork of a whole file comes last, only when edits would rewrite most of it. An edit fails the build when upstream rewords its passage, so each sync shows which rules to re-check. A fork pins the upstream file's hash, so someone must merge every upstream change into it by hand.

**Never invent Claude Code features.** Write only the tools, flags, and behavior that Claude Code has. A skill that tells the model to call a missing tool breaks in a user's session, and no check in CI sees it. When the mapping does not cover a case, write the plainest true sentence and say so in the pull request.

**Fail loudly.** A script or rule that cannot do its job stops with a message that names the file and the fix. A silent skip ships upstream text untranslated, and nobody notices until a user hits it. The build already works this way. An edit whose `find` text matches any number of times other than its `count`, which is 1 by default, stops the build with a `FAIL` line.

**Send one rule or one fix per pull request, with its verification.** The maintainer reviews every change before a release. A small pull request is quick to check and easy to revert on its own.

**Test behavior, not implementation.** Assert what a user of a script can observe, such as its output, its exit code, and the files it writes. Such a test fails when the behavior breaks and keeps passing when only the internals change. Tests use `node:test` and Node's built-in modules only. Add no dependencies, because `package.json` has none and a test checks that.

## Make a change

You need git and Node 22, the version CI uses. `node tools/sync.mjs --verify` fetches the pinned upstream commits from GitHub, so it also needs network access.

1. Fork the repository and create a branch from `main`.
2. Change a rule in `tools/rules/` or a file in `overlays/`. [The rule edit example](docs/contributing/rule-edit-example.md) walks through one edit. [The overlay skill template](docs/contributing/overlay-skill-template/README.md) shows how to add a skill.
3. Run `node tools/build.mjs`. The last line must be `Cursor names left for native rewrites: 0`. A `FAIL` line names the rule, the fork, or the OMC anchor to fix. A `NOTE` line about the release is expected, because the maintainer releases after merge.
4. Run `git diff --stat plugin/`. It should list only the files your change targets. An extra file often means a substitution matched more text than you meant.
5. Run `claude --plugin-dir ./plugin` from the repo root to try the built plugin in Claude Code for that session only. If you have omc-pstack-fy installed, disable it first with `claude plugin disable omc-pstack-fy@omc-pstack-fy` to avoid two copies of the same skill, and enable it again when you finish.
6. Run the tests with `node --test tests/*.test.mjs`.
7. Run `node tools/sync.mjs --verify` to confirm that `vendor/` still matches the pinned commits.
8. Run `node tools/build.mjs --check --skip-release-lock` to confirm that `plugin/` matches what the build writes.
9. Commit your change and the regenerated `plugin/` together.
10. Open a pull request against `main`. The template asks for what changed, why, and the commands you ran.

Write each commit subject as `type: summary`, with `feat`, `fix`, `rules`, `build`, or `docs` as the type, and give the pull request the same title. By default, `node tools/release.mjs` builds the release notes from the commit subjects since the last release, grouped by type, so a subject without a type lands under Other.

Syncing upstream with `node tools/sync.mjs pstack` or `node tools/sync.mjs omc` is the maintainer's job, so the only sync command you run is `node tools/sync.mjs --verify`. When a rebase stops on conflicts in `plugin/`, resolve the conflicts in `tools/rules/` and `overlays/` first, then run `node tools/build.mjs` and `git add plugin/` instead of resolving `plugin/` by hand. The build rewrites all of `plugin/`.

On a pull request, CI runs `node tools/sync.mjs --verify`, `node tools/build.mjs --check --skip-release-lock`, and the tests. The flag skips only the comparison of plugin content with the last release. A version that differs from the one in `tools/version-lock.json` still fails, and so does a stale or hand-edited `plugin/`.

The maintainer reviews the pull request and may ask for changes. After the merge, the maintainer runs `node tools/release.mjs`. It bumps the version, writes the `CHANGELOG.md` entry, tags the release, pushes, and creates the GitHub release. Claude Code updates an installed plugin only when its version changes, so users get your change with that release. Never run `node tools/release.mjs` yourself.

After a merge that changes `plugin/`, CI on `main` fails until the maintainer releases. A push to `main` runs `node tools/build.mjs --check`, which also compares `plugin/` with the last release. That red run is expected, and it does not mean your change is wrong.

## Open an issue first for anything bigger than a rule edit

Open an [issue](https://github.com/kaneyxx/omc-pstack-fy/issues) before you write a new skill or a new script. Open one too before you change the OMC bridge in `overlays/hooks/`, `tools/build.mjs`, or the owner's choices in the README's [Personal choices](README.md#personal-choices) section. Say what problem you hit and what you propose. A rule edit or a typo fix can go straight to a pull request.

To report a bug, include these facts:

- The omc-pstack-fy version. `claude plugin list` prints it as the `Version` line under `omc-pstack-fy@omc-pstack-fy`.
- The OMC version if you use OMC. The same list prints it under `oh-my-claudecode@omc`.
- The output of `claude --version`.
- What you ran, what you expected, and what happened, with the exact output.

## Write a pull request description a reviewer can check

A good description says what changed and why, and lists each command you ran with the result it printed. Link the issue when there is one. [The pull request example](docs/contributing/pull-request-example.md) shows a filled-in description for a small rule fix. The [pull request template](.github/pull_request_template.md) has the same headings.

You may write issues and pull requests in English or Traditional Chinese. Pull request titles and commit subjects become changelog entries, so write them in English.

## Report upstream problems upstream

This repo changes only how upstream is translated and bridged. A wording problem, a weak rule, or a bug in a pstack skill belongs in [cursor/plugins](https://github.com/cursor/plugins). A problem in OMC itself belongs in [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode). Report a problem here when the upstream text is right and its translation in `plugin/` is wrong, or when the bridge causes it.

## Keep personal data out

This repo is public. Commit under your own GitHub identity. To keep your email address out of the public history, set `user.email` to your GitHub noreply address. Keep personal paths, email addresses, tokens, and other private data out of rules, docs, tests, and fixtures. Write `~/` instead of your home folder, and use made-up values in fixtures.

## Expect a review before every release

The maintainer reviews every change before it ships in a release. A pull request that passes CI can still wait for review, come back with questions, or be declined when it does not fit the project.
