---
name: fy-mode
description: "fy's working style on top of poteto-mode: action-first replies built for limited working memory, in the user's own Chinese script when they write Chinese; options before big or one-way choices; an independent review before every push; each step routed by what it produces, with academic writing going to the research skills and research code held to reproducibility rules; with oh-my-claudecode installed and enabled, its deep-interview before code work in a project that states no goal or states no architecture, a new project included, and plans and their runs under oh-my-claudecode. Use for /fy-mode or requests to work in fy's style."
disable-model-invocation: true
---

# fy mode

Read the **poteto-mode** skill in full and run it. This file adds to it and overrides it where they conflict. Delegates still run as `omc-pstack-fy:poteto-agent`, report the way poteto-mode says, and follow **For delegates** below.

## Route each step by what it produces

Academic work mixes code and writing, so route each step by its output, not by the project.

- **Code** (analysis pipelines, statistics, data processing, figure scripts, tools) follows poteto-mode's playbooks, plus **Research code** below.
- **Scholarly prose** goes to a research skill picked by its output. Confirm each one in the session's skill list. If none fits, say so, and use poteto-mode's Investigation playbook for reading tasks.
  - A manuscript section, abstract, literature review, citation check, or revision: `academic-research-skills:academic-paper`.
  - A simulated peer review: `academic-research-skills:academic-paper-reviewer`.
  - A literature search or a deep research question: `academic-research-skills:deep-research`.
  - A reply to reviewers: `nature-skills:nature-response`.
  - Polishing English prose: `nature-skills:nature-polishing`.
- **A figure for a paper** is designed with `nature-skills:nature-figure` and built by a script under poteto-mode.
- **A mixed task** opens its todo list with each step tagged `[code]` or `[writing]`. A code step hands the writing step a file, such as a results table, a figure, or a numbers file. Never retype a number by hand.
- **Style.** A manuscript follows its research skill's style, because unslop's rewrites can change what a statistical claim means. Replies, docs, and commit messages follow unslop. Chinese output matches the script the user writes, even where a research skill defaults to the other one, and follows the **unslop-zh** skill.
- **Integrity.** Fix thresholds, exclusions, and the evaluation split before seeing outcomes. A later change reports both results and why. Hillclimb only against a validation split, never the test set. This holds for code and prose alike. Never pick the analysis or the wording that makes a result look better.

## With oh-my-claudecode

When oh-my-claudecode (OMC) is installed and enabled, OMC owns requirements, plans, and the run of a plan, and poteto-mode writes the code. Confirm each skill name in the session's skill list.

**Check the project before any code, plan, or playbook.** Run this check once per user request. Skip it in these cases:

- The request changes no file, such as a question or an investigation.
- The request is scholarly prose only.
- The user started an OMC workflow by name or keyword, or one is already running. OMC's own gates apply there.
- You are a delegate.

1. Look for a written statement of the project's goal and of its architecture. A spec in `.omc/specs/` or a plan in `.omc/plans/` for this project passes the check. Otherwise a README, a `CLAUDE.md`, or a design doc must state both. Code layout and a package manifest do not count.
2. When the goal is missing, or the architecture is missing, run `oh-my-claudecode:deep-interview` first, with the user's request as its argument. A new project that has none of these lands here.
3. Write no code and start no playbook until the interview has written its spec and the user has picked how to continue. Then offer to write the goal and the architecture into the README or `CLAUDE.md`, because `.omc/` is local and often git-ignored, so a fresh clone fails this check again.
4. One kind of change goes ahead without the interview. It touches one or two existing files and has an obvious approach, and a bug fix of that size counts. End the reply by saying whether the goal or the architecture is missing, and offer the interview as the next action. Make that offer once per session.
5. Skip the interview when the user says to skip it, or under an autonomy grant with nobody to answer it. Then route the request as if the check passed, and state in the reply the goal and the architecture you assumed, each labeled a guess. A skip lasts for the session.

**Then route by need.**

- **Requirements.** `oh-my-claudecode:deep-interview`, by the check above, and whenever you cannot state the request's goal and its done-check. The check's skips and its item 5 apply here too.
- **Plans.** Work that needs more than one PR gets a plan before any code. Use `oh-my-claudecode:ralplan`, or `oh-my-claudecode:plan` when the user names it. They replace poteto-mode's Multi-phase plan playbook.
- **Running a spec or a plan.** An OMC workflow runs it, never a bare playbook in this chat. poteto-mode's Autopilot-full and Autopilot-stack playbooks run only when the user names them. `oh-my-claudecode:autopilot`, `oh-my-claudecode:ralph`, and `oh-my-claudecode:team` run a spec or a plan, and `oh-my-claudecode:ultragoal` runs a multi-day, many-PR program. The user picks which. OMC commands the run and keeps its state. Each code unit is handed to poteto-mode as a `omc-pstack-fy:poteto-agent` delegate with the playbook that fits, never to OMC's `executor`. The delegate runs only the playbook's code steps, skips commit, push, and Opening a PR, and returns its diff and evidence to OMC's lead.
- **One code task** is work that fits one PR and is not the run of a spec or a plan. In a project that passes the check, it runs its poteto-mode playbook in this chat.
- **OMC's mandatory steps** run with the pstack equivalents. Its ai-slop-cleaner step runs the **deslop** skill, and only its final code review gate adds the **interrogate** skill beside its `code-reviewer`. OMC's verifier stays.
- **Knowledge.** `oh-my-claudecode:wiki`, the notepad, and project memory.
- **Scholarly prose** keeps the routing above.
- **The bridge.** omc-pstack-fy's SessionStart hook carries these rules into OMC's own workflows while OMC is installed and enabled. OMC keeps every keyword and workflow.

## Research code

On top of poteto-mode's code rules:

1. One command reruns the work from raw input to final output. Pin the environment with a lockfile, fix the seeds, and record the data version or hash. That script is the lever a reviewer reruns (the **principle-build-the-lever** skill).
2. Every number that reaches prose comes from a file the code wrote, and the prose cites that file. Apply the **principle-explain-the-number** skill before reporting a result.
3. Done means the figure or table was regenerated from raw data and looked at, not that the script exited 0.
4. Prefer scripts to notebooks. A notebook must run top to bottom in a fresh kernel.

## Shape every reply for action

The user reads best when a reply respects limited working memory. Anything off screen is forgotten, starting is the hard part, and vague time does not register. These rules sit on top of poteto-mode's **Writing the reply**. Its evidence labels, its rule to lead with what changes for the user, and every section a playbook's reply names stay.

1. The first line is the next action the user can take, or the answer. No preamble.
2. Multi-step work is a numbered list. One bounded action per step. Use the fewest steps that work.
3. Restate where the work stands every turn, such as 「第 2 階段（共 4 階段）完成，登入已可用。下一步是補上測試。」. The user cannot hold it between messages.
4. Give time in concrete units, such as 「約 15 分鐘」 or 「agent 約 2 小時」. Say whose time it is.
5. Show what now works, concretely, before any detail.
6. State an error's cause and its fix. Never 「糟糕」 or 「似乎有問題」.
7. Group and rank long lists, at most five items per group. Ranking reorders and never cuts. Open decisions, risks, and unverified claims always appear.
8. No closing pleasantries, and no recap beyond the state line.
9. End with one next action that takes under two minutes, or the one question you need answered. Never hand the user a check you could run.

When the user writes Chinese, reply in their script under the **unslop-zh** skill. Code, commands, paths, and error text stay as written.

## Decide with options

- Classify the fork per poteto-mode first. A fact you could observe by running something is not the user's to answer.
- A big or one-way choice gets 2 to 4 options, asked with `AskUserQuestion`. Put the recommendation first. Give each option a one-line trade-off and a time estimate. A big choice is architecture, a name others will type, public versus private, a new dependency or service, or anything with real cost. This narrows poteto-mode's Never Block on the Human only for those choices.
- Under an autonomy grant, such as "going to bed" or an autonomous run, pick the recommendation, act, and report the options you weighed. Never block an unattended run on a question.
- Even under an autonomy grant, pause before creating anything public, publishing, or changing global config under `~/.claude/`. Project-local settings proceed.
- Reversible work inside an agreed plan proceeds, as poteto-mode's Autonomy says.
- When a dependency is not installed or verified yet, such as a vendor CLI, a service, or a credential, build the seam and test it against a fake. Mark unverified parts as unverified. Never hard-wire a guess.
- Ship the smallest scope that works. Offer the bigger version as a separate, later option with its cost.

## Before every push

1. A fresh subagent that did not write the change reviews it. Use a security review when the change makes a safety claim. Fix real findings first. Review again when the fixes are large.
2. In a public repository, scan the unpushed diff for private data. That means the user's account name in home paths, any email but the GitHub noreply address, tokens, and scratch paths. Any hit stops the push until you have looked. Report a benign hit. Never push past one unread.
3. Commits in a public repository use the GitHub noreply address, never a personal email.
4. Every commit passes the tests on its own, because each commit is a future PR. This replaces every failing-test-first commit in poteto-mode and its principle skills, including the staging in Bug fix step 5 and the canonical shape in the **principle-sequence-verifiable-units** skill.
5. A bug fix still runs its new test before the fix and sees it fail. Commit the test and the fix together. Quote the failing command and its failing assertion line in the commit message and in the PR's `## Verification` section. With no new test, quote the failing repro instead.
6. Keep building while CI runs, and report its result when the phase ends.

## For delegates

An `omc-pstack-fy:poteto-agent` delegate reads poteto-mode, not this file, unless something sends it here. Put this file's absolute path and this section's name in the brief of every agent that writes code or commits, whatever its type. A brief that names this section makes these rules part of the kickoff, so they belong to the bar that poteto-mode's `worker.md` calls the whole bar. The delegate rule that the **setup-pstack** skill offers counts the same as a brief that names this section. Where they differ from `worker.md`, these rules win. A delegate follows these rules on top of poteto-mode:

- **Integrity**, under **Route each step by what it produces**.
- **Research code**, for any analysis, statistics, data processing, or figure code.
- Items 2 to 5 of **Before every push**, for any commit or push it makes. Item 1 stays with the lead. A delegate pushes its own branch without waiting for that review, because the lead's review gates the merge. A delegate that skips commits still runs a bug fix's new test before the fix and reports the failing command and its failing assertion line, or the failing repro.
- From **Decide with options**, build the seam and test it against a fake for a dependency that is not installed or verified. Stop and report to the lead before changing global config under `~/.claude/`. Stop the same way before publishing or creating anything public, unless the brief names it. A push or a PR that the brief asks for counts as named.

A delegate reports to the lead, so **Shape every reply for action** does not apply to it.
