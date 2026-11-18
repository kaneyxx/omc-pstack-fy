---
name: verify-release
description: "Check `tools/release.mjs` and the release-lock part of `tools/build.mjs` against five promises about a release that fails halfway. The check runs the real script in throwaway repos and injects a fault at every external call. Use it before you change or review either file, and when `tests/release.test.mjs` fails. Use it when a release stopped partway, or when someone asks whether `main`, the tag, and the GitHub release can fall out of step."
---

# Verify the release script

Claude Code installs this plugin from `main` and from the release tag, so a release that stops halfway reaches every user. `tools/release.mjs` makes five promises about that case in its comments and messages. `tests/release.test.mjs` checks them by running the real `tools/release.mjs`, byte for byte, in throwaway git repos whose `origin` is a local bare repo. The check never touches this repo, GitHub, or your `gh` login. The search is `tests/fixtures/release/lab.mjs`. The stand-ins for `git`, `gh`, `claude`, `node`, and the build sit beside it.

## The five promises

| | Promise | Harm when it breaks | Code |
| --- | --- | --- | --- |
| P1 | `origin/main` never holds a commit `release: omc-pstack-fy vX` without the tag `omc-pstack-fy--vX` on that commit. Origin never holds that tag while `origin/main` lacks its commit. | Users on `main` get a version with no tag, or the tag points at code `main` does not have. | `publish()`, the `--atomic` push |
| P2 | Origin's tag `omc-pstack-fy--vX` points at the commit whose subject is `release: omc-pstack-fy vX` and whose `tools/version-lock.json` says X. A GitHub release for X exists only when origin has that tag. | The tag installs content that was never released as X. | `unfinished()`, the tag checks in `publish()`, `--verify-tag` |
| P3 | No release lands on top of a release that still lacks its tag, its push, or its GitHub release. | The older version is never tagged or published, and `--resume` no longer finds it. | `preflight()` with `unfinished()` |
| P4 | When `node tools/release.mjs patch` fails on its own before the release commit, `HEAD` and the working tree are as they were. | A half bump stays in the tree, and the next run refuses to start. | the `catch` in `release()`, and the worktree that preflight builds in |
| P5 | After a fault at any point, doing what `release.mjs` says next ends with the tag, `main`, and the GitHub release present and consistent, within 3 runs of `release.mjs`. | The maintainer holds a half release, and no command finishes it. | the `--resume` branch of `main()`, `publish()`, and every message that names a next step |

P4 has one exception that `release.mjs` names itself. Preflight rebuilds a stale `plugin/`, leaves it in the tree, and says `Commit the rebuilt plugin/ first, then release.`

## See whether a change touches the verified code

The check covers these files as they were at the sync commit `362ad25`.

| File | Covered | Not covered |
| --- | --- | --- |
| `tools/release.mjs` | `committedLock()`, `remoteTagCommit()`, `unfinished()`, `preflight()`, `publish()`, `release()` with its `catch`, and the `--resume` branch of `main()`, driven by `patch` and by `--resume` | `--dry-run`, `--no-publish`, `--notes`, `--trailer`, `minor`, `major`, an explicit `X.Y.Z`, and what `notesFor()` writes |
| `tools/build.mjs` | `resolveVersion()`, `checkMarketplace()`, the version line of `checkPackage()`, and the `--check` comparison of `plugin/` with what the build generates. `tests/fixtures/release/build.mjs` stands in for them. | Everything else the build does |

Any edit to `tools/release.mjs` or `tools/build.mjs` since the sync commit means you rerun the check and recheck this file, even when the edit looks unrelated to the tables above. This command lists those edits, uncommitted ones included.

```bash
git diff --stat 362ad25 -- tools/release.mjs tools/build.mjs
```

No output means the check still describes the code. Any output means the covered code may have moved after the last confirmation, so run the check and then follow [Move the sync commit](#move-the-sync-commit).

## Run the check

```bash
node --test tests/release.test.mjs
```

CI runs this command with the rest of `tests/`. It allows one fault on each path and takes about 40 seconds on an 8-core Mac.

After any change to `tools/release.mjs`, also run the deep search, which allows two faults on each path. It takes about 3.5 minutes.

```bash
RELEASE_FAULT_DEPTH=2 node --test tests/release.test.mjs
```

A depth of 3 has never been run to the end, so no pass covers three faults on a path.

A passing run prints a line of counts for each of the two searches, then each known finding that the depth reaches in that search, with its shortest counterexample. Those findings are bugs in `release.mjs` that are still open. They are listed under [Known findings](#known-findings).

## Read a failure

| The run says | It means | Do this |
| --- | --- | --- |
| `FixtureError`, with text such as `release.mjs made a call the fixture does not model`, `the planned fault ... is not what happened`, `a fixture step failed`, or `a what-if step failed` | The fixture cannot model this run. It is out of date with `release.mjs`, or `release.mjs` made different calls on the same input, or a step the fixture takes on its own failed. `a fixture step failed` can also come from `release.mjs`, when it leaves a repository the fixture cannot read, such as one with no local `main`. | Read the run that came before the error. If `release.mjs` left the repository that way, treat it as a counterexample. Otherwise fix the fixture under `tests/fixtures/release/`. A new `gh` or `claude` call needs a case in `fakes.mjs` or `shim.sh`. A run that changes between two tries on the same input breaks the fault plan, so find what varies. |
| `release.mjs breaks a promise in a way that is not a recorded finding`, then `P1` to `P5` and numbered steps | The search found a counterexample. Two kinds of P5 name themselves. `release.mjs hangs` means it did not exit within 60 seconds. `the step that the message names cannot be done` means the maintainer did what the output said, and that step failed, as `git commit` does on a clean tree. | Read the steps against `tools/release.mjs`. If a real maintainer, real git, and real GitHub can take each step, it is a bug. Fix `release.mjs`, or report it and add it to `FINDINGS`. If a step cannot happen outside the fixture, fix the fixture and say why in the commit. Never edit a promise to make the run pass. |
| `F1 no longer shows up`, or another finding id | `release.mjs` no longer has that bug, or the search no longer reaches it. | Read the diff of `tools/release.mjs`. If the bug is fixed, delete the finding from `FINDINGS` in `tests/release.test.mjs` and from this file. If not, the search lost a path, so fix the search. |
| `the search did not catch the mutant` | The check for that promise can no longer fail, or the mutant's faults no longer lead to the break. | For one run, call `explore()` in the mutant loop of `tests/release.test.mjs` with `depth: 2` and without `only` and `until`. If that search catches the mutant, update its `fault` or `depth`. If not, the check is broken, so fix it before you trust a pass. |
| `tools/release.mjs no longer has exactly one ...` | The line a mutant rewrites has changed. | Rewrite that mutant's `edits` against the new line. |
| `the runbook in SKILL.md finishes the release from where F1 stops` fails | The runbook step for F1 no longer works, or the run no longer reaches F1. | Read the failed assertion. Fix the runbook in this file and the steps in the test together. |
| `answers like tools/build.mjs at every step of a release` fails | The stand-in build and the real build disagree. | Change `tests/fixtures/release/build.mjs` to match `tools/build.mjs`, then run the check again. |

## Known findings

The current `release.mjs` breaks its promises in two ways. The check passes while these stay as recorded. Each one is a bug to fix in `release.mjs`. The depth is the fewest faults on a path in the search that reach the finding. A run at a lower depth does not show it.

**F1. `Commit or stash first.` leads to a dead end.** It breaks P5. Depth 1.

1. The maintainer runs `node tools/release.mjs patch`. The process is killed after `node tools/build.mjs --release` and before `git commit`. A crash or Ctrl-C does the same.
2. The maintainer runs `node tools/release.mjs patch`. It stops with `the working tree is not clean. Commit or stash first.`
3. The maintainer commits.
4. `node tools/release.mjs patch` stops with `nothing to release: plugin content matches the last release.` `node tools/release.mjs --resume` prints `nothing to resume: the last release is tagged, pushed, and published.`

`HEAD` now holds a `tools/version-lock.json` for the new version with no release commit, no tag, and no GitHub release, and neither command moves on. `git stash` in step 3 lets the release finish and leaves the half bump in the stash. The step that works is `git reset --hard HEAD`, which the message does not name. F1 is likely. The real `node tools/build.mjs --check` takes seconds, and a Ctrl-C during it lands in this window.

**F5. A failed read in `unfinished()` calls a finished release unfinished.** It breaks P5. Depth 1, in the search from a stale `plugin/`.

1. `HEAD` holds a stale `plugin/`. The maintainer runs `node tools/release.mjs patch`. `git ls-remote` for the tag of v1.0.0 fails, and the run stops with ``the v1.0.0 release is not finished. Run `node tools/release.mjs --resume`.``
2. Someone else's commit lands on `origin/main`.
3. The maintainer runs `node tools/release.mjs --resume`. It prints `nothing to resume: the last release is tagged, pushed, and published.`
4. `node tools/release.mjs patch` stops with `main is behind origin/main. Pull first.` The maintainer pulls.
5. `node tools/release.mjs patch` stops with `plugin/ was stale. Commit the rebuilt plugin/ first, then release.` The maintainer commits.
6. `node tools/release.mjs patch` releases v1.0.1.

The recovery takes 4 runs, one more than P5 allows, because the `--resume` in step 3 has nothing to do. `unfinished()` reads a failed `git ls-remote` as "origin has no tag". By the code, it reads a failed `git merge-base --is-ancestor` or `gh release view` the same way. From an up-to-date `plugin/` the same path takes 3 runs, so only the search from a stale `plugin/` shows it. F5 is not new. The search from a stale `plugin/` finds it in the code before the F4 fix too. The harm is one wasted run. A fix makes each of the three reads tell a failure from "no". `git ls-remote` without `--exit-code` already exits 0 when the tag is missing. `gh release view` exits 1 in both cases, so it needs another call, which the fakes would also have to model.

## When a real release stops partway

These steps come from the runs above. Use them until F1 and F5 are fixed.

- **No commit `release: omc-pstack-fy vX` exists, and `git status` shows changes.** Check that the changes are only the bump, which is the three version fields, `tools/version-lock.json`, `plugin/.claude-plugin/plugin.json`, and `CHANGELOG.md`. Then run `git reset --hard HEAD` and release again. Do not commit the changes.
- **The bump is already committed, in a commit that is not `release: omc-pstack-fy vX`.** This is where F1 leaves you after its step 3. `node tools/release.mjs patch` says `nothing to release`, and `git show --stat HEAD` lists `tools/version-lock.json`. Check that the commit holds only the bump files the bullet above names. If it holds other work too, stop, because the next step drops it. If you have not pushed that commit, run `git reset --hard HEAD~1`, then `node tools/release.mjs patch`. The test `the runbook in SKILL.md finishes the release from where F1 stops` runs these steps from both kill points that lead to F1. No run covers a pushed half bump.
- **Preflight says the last release is not finished, and `--resume` then says there is nothing to resume.** A read failed in the first run. This is F5. Run `node tools/release.mjs patch` again.
- **The release commit exists.** Run `node tools/release.mjs --resume`. If git rejects the push because `origin/main` moved, run `git pull --rebase`, then `--resume` again.

## What a pass covers

The search starts from one state. Release 1.0.0 is complete, `plugin/` is up to date, and local `main` is one unpushed commit of new plugin content ahead. A second search starts from the same commit with `plugin/` left as release 1.0.0 built it, so preflight finds `plugin/` stale. The command is `node tools/release.mjs patch`. Both searches follow the rules below.

- **Faults.** At most one fault in each run of `release.mjs`, at any of its external calls. The call exits 1 before it does anything, or `release.mjs` gets SIGKILL just before the call, or just after it.
- **Environment.** Before a `--resume`, someone else's commit lands on `origin/main` once. It changes no plugin file. It lands only on paths where the maintainer has not committed or stashed by hand, and where the unrelated commit of the what-ifs has not landed.
- **Maintainer.** After each run the maintainer does what the output says. `INSTRUCTIONS` in `tests/fixtures/release/lab.mjs` lists each message and its step. When a message allows two readings, as `Commit or stash first.` does, both must work. With no instruction, the maintainer reruns the command, as `--resume` once the release commit exists.
- **What-ifs.** From every unfinished release, an unrelated commit on top must not stop `--resume`, and new plugin content on top must not get a release of its own. While the path has room for one more fault and `origin/main` has not moved, that second release also runs once with each call failing. After the maintainer commits or stashes by hand, or after the unrelated commit, no what-if runs, in that state or in any later state on the path. Faults still do.
- **Depth.** Depth counts every fault on a path, a failing call in the second-release what-if included. CI allows one fault on a path. `RELEASE_FAULT_DEPTH=2` allows two.

A pass does not cover these.

- Three or more faults on one path.
- A command that takes effect and then reports failure, a command cut off halfway, a hang of a command that `release.mjs` calls, and two faults in one run. A hang of `release.mjs` itself is caught, after 60 seconds.
- A kill between two file writes that `release.mjs` makes with no external call between them.
- The first release, which runs only without faults to set up the fixture.
- Other start states, such as a `main` that is behind `origin/main`.
- Two copies of `release.mjs` running at once, and a tag or GitHub release deleted by hand.
- Real GitHub and the real `claude`. The fakes follow `gh release view`, `gh release create --verify-tag`, `gh auth status`, and `claude plugin tag` as Claude Code 2.1.327 behaves. `node tools/sync.mjs --verify` and the test suite always pass in the fixture.

Two shortcuts keep the run short. Two worlds count as one state when they have the same refs, the same commits on `main`, the same `git status` with the same changed file contents, and the same GitHub releases. A kill point is skipped when the world is byte for byte the same as at the kill point before it. To check the second shortcut, set `RELEASE_FAULT_EVERY_KILL=1`, which runs every kill point for real. That run must pass and print the same number of distinct worlds.

The search uses half of the machine's cores, because the other test files run beside it and some of them time their children. That is not enough when three full suites run at once on an 8-core Mac. Then the `orphan` test in `tests/pstack-ask.test.mjs` goes past its 5 second limit. One suite at a time passes.

## Change the check when a change is intended

1. For a new or changed message that tells the maintainer what to do, add or change its row in `INSTRUCTIONS` in `tests/fixtures/release/lab.mjs`.
2. For a new `gh` or `claude` call, model it in `tests/fixtures/release/fakes.mjs`.
3. For a new promise, add its check next to `invariants()` or `rollback()` in `lab.mjs`, and add a mutant to `MUTANTS` in `tests/release.test.mjs` that breaks it. Give the mutant `says` when it targets one clause of a promise.
4. For a fixed finding, delete it from `FINDINGS` and from this file. For F1, also delete the runbook step and its test.
5. Run both commands under [Run the check](#run-the-check).

## Mutants

Each promise, and each clause the table names, was seen to fail on a broken copy of `release.mjs`. CI runs every mutant on each run. `fault` in `MUTANTS` limits the search to one kind of fault, so each mutant costs 1 to 30 runs of `release.mjs`.

| Broken copy | Breaks | Clause the run must name | Faults on the path |
| --- | --- | --- | --- |
| pushes without `--atomic` | P1 | | 1 |
| pushes `main` and the tag in two pushes | P1 | | 1 |
| pushes in two pushes only when the release commit is not `HEAD` | P1 | | 2 |
| lets `claude` tag `HEAD` and drops the tag check | P2 | the tag points at another commit | 1 |
| leaves `tools/version-lock.json` out of the release commit | P2 | the tagged commit's lock names another version | 0 |
| deletes origin's tag after it creates the GitHub release | P2 | a GitHub release with no tag | 0 |
| skips the `unfinished()` check in `preflight()` | P3 | | 1 |
| drops `git reset --hard HEAD` from the `catch` | P4 | | 1 |
| leaves a local tag on a commit that a rebase replaced | P5 | | 1 |
| says `Commit or stash first.` on a clean tree when a local tag exists | P5 | the named step cannot be done | 1 |
| stops after each of the tag, the push, and the GitHub release | P5 | the recovery needs more than 3 runs | 0 |
| drops the local tag on every `--resume` and asks for `--resume` after it tags | P5 | the recovery comes back to a state | 0 |

The third mutant is reached only through the unrelated-commit what-if with a second fault after it. It guards the rule that faults land on every state, what-ifs included.

## Move the sync commit

The sync commit is `362ad25`. Move it only after you confirm that the check describes the code at the new commit.

1. Read `git diff 362ad25 -- tools/release.mjs tools/build.mjs`.
2. Update the tables in this file where a covered function was added, renamed, or removed.
3. Run both commands under [Run the check](#run-the-check), and `RELEASE_FAULT_EVERY_KILL=1 node --test tests/release.test.mjs`.
4. Replace `362ad25` in this file with the new commit.
