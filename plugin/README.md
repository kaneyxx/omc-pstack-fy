# pstack

> **omc-pstack-fy** is a personal Claude Code build of [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan. Every command takes the `omc-pstack-fy:` prefix, such as [`/omc-pstack-fy:poteto-mode`](skills/poteto-mode/SKILL.md). Source and build rules live in [kaneyxx/omc-pstack-fy](https://github.com/kaneyxx/omc-pstack-fy).

i'm [poteto](https://x.com/poteto). i'm not a president or ceo, but i've worked with millions of lines of code at Meta, Netflix, and Cursor. i'm also on the react core team where i help build and maintain react compiler.

there's a growing sense that ai writes too much slop code. i agree. i don't want to ship like a team of twenty slop artists. throughput without quality is not a goal i aspire to. if you want to go fast, go deep first. 

**pstack is my answer.** these are the same skills i use every day to ship high quality code at Cursor. this turns claude code into a real engineering team. the goal is not to maximize loc, in fact it's the opposite. pstack helps you write less, but higher quality code.

**pstack gives you fearless parallelism.** when you can go deep on one agent and trust it to write good, verifiable code, you can truly parallelize with confidence. start multiple agents up with `poteto-mode` and trust that they'll apply rigorous engineering principles to their work.

**pstack plays to each model's strengths.** every frontier model has its strengths and weaknesses. use any claude model with omc-pstack-fy. in fact, many of my skills use multi-model workflows to take advantage of each model's unique strengths. the default panels here pair opus with sonnet. two models from one vendor share more blind spots than two vendors do, so their agreement is weaker evidence than a cross-vendor panel's.

fork it. improve it. make it yours. PRs are welcome! 

## install

```bash
/plugin marketplace add kaneyxx/omc-pstack-fy
/plugin install omc-pstack-fy@omc-pstack-fy
```

claude code leaves auto-update off for third-party marketplaces, so omc-pstack-fy stays on the version you installed. to turn it on, run `/plugin`, open the **marketplaces** tab, select `omc-pstack-fy`, and choose **enable auto-update**. to update once by hand, run [`/omc-pstack-fy:update`](skills/update/SKILL.md), which refreshes the marketplace and then updates the plugin.

claude code prefixes plugin commands and agents with the plugin name. every command here already carries it, such as [`/omc-pstack-fy:poteto-mode`](skills/poteto-mode/SKILL.md), and the delegate agent is `omc-pstack-fy:poteto-agent`. [`/omc-pstack-fy:setup-pstack`](skills/setup-pstack/SKILL.md) writes your model choices to `~/.claude/rules/omc-pstack-fy-models.md`. a few upstream steps need a cursor-only service, such as starting bugbot or a cursor automation. omc-pstack-fy skips those with a one-line note.

omc-pstack-fy is generated from a pinned upstream commit by `node tools/build.mjs` in [kaneyxx/omc-pstack-fy](https://github.com/kaneyxx/omc-pstack-fy). edit the rules or overlays there, never this folder.

## get started

two steps:

1. run [`/omc-pstack-fy:setup-pstack`](./skills/setup-pstack/SKILL.md), pick a reasoning budget, and choose which models you want.
2. use [`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) whenever you're doing anything that requires rigor.

new here? the [pstack guide](./docs/guide/README.md) walks you through a first real task, from setup and prompting through verification and overnight runs. stuck, or unsure which skill fits? ask [`/omc-pstack-fy:poteto-help`](./skills/poteto-help/SKILL.md).

that's it. the other skills are situational, and the mode skill uses them for you as needed. out of the box the mode splits work by model strength: code delegates (feature, refactoring, bug fix, perf, hillclimb) go to sonnet, while the hardest changes, prose, and judgment go to opus. the default panels pair opus with sonnet. [`/omc-pstack-fy:setup-pstack`](./skills/setup-pstack/SKILL.md) changes any of it.

## usage

use [`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) at the start of a task. it reads your request, picks from a set of playbooks, and runs the other skills as the steps need them.

start your message with [`/omc-pstack-fy:poteto-mode`](skills/poteto-mode/SKILL.md), then type your task, so claude code loads the skill with it.

### just use [`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md)

this skill is the main shortcut. i use it whenever i need the agent to do rigorous engineering work. it comes with twenty-three playbooks:

```
/omc-pstack-fy:poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even when idle. repro
first, then fix and verify.
```

```
/omc-pstack-fy:poteto-mode i'm going to bed. land the stack even if ci flakes. i want everything merged by
morning.
```

<details>
<summary>the twenty-three playbooks</summary>

| playbook | for |
|---|---|
| [investigation](./skills/poteto-mode/playbooks/investigation.md) | a read-only question. how does x work, why was y built this way, are we sure. |
| [bug fix](./skills/poteto-mode/playbooks/bug-fix.md) | reproduce a defect, root-cause it, and fix with runtime evidence. |
| [perf](./skills/poteto-mode/playbooks/perf-issue.md) | trace a measured slowness and improve it against a baseline. |
| [hillclimb](./skills/poteto-mode/playbooks/hillclimb.md) | sustained, scientific improvement of one metric against a target, looping hypotheses with before/after measurement and one commit per accepted win. |
| [runtime forensics](./skills/poteto-mode/playbooks/runtime-forensics.md) | diagnose a live symptom (leak, idle-cpu spin, glitch) from instrumentation. |
| [trace forensics](./skills/poteto-mode/playbooks/trace-forensics.md) | diagnose a captured profiling artifact (cpuprofile, trace, spindump, heap snapshot). |
| [feature](./skills/poteto-mode/playbooks/feature.md) | new or changed behavior, built from a named data shape. |
| [refactoring](./skills/poteto-mode/playbooks/refactoring.md) | a behavior-preserving change to structure or shape. |
| [prototype](./skills/poteto-mode/playbooks/prototype.md) | a throwaway sketch to make a design or behavioral decision cheaply, or to settle an empirical fork by observing it. |
| [visual parity](./skills/poteto-mode/playbooks/visual-parity.md) | pixel-exact ui equivalence between two implementations. |
| [authoring a skill](./skills/poteto-mode/playbooks/authoring-a-skill.md) | writing or editing a SKILL.md. |
| [eval](./skills/poteto-mode/playbooks/eval.md) | test how a skill or prompt change affects agent behavior, blinded. |
| [babysit](./skills/poteto-mode/playbooks/babysit.md) | drive a pr or a stack to merge-ready: conflicts, review threads, ci. |
| [shipping](./skills/poteto-mode/playbooks/shipping.md) | independently verify a green stack, then land the contiguous verified run bottom-up through github by default or origin when available. |
| [autonomous run](./skills/poteto-mode/playbooks/autonomous-run.md) | drive a long task to completion without stopping. |
| [orchestrate](./skills/poteto-mode/playbooks/orchestrate.md) | a standing project handed to one coordinator chat: multi-day, many stacked prs, fleets of subagents. |
| [autopilot-full](./skills/poteto-mode/playbooks/autopilot-full.md) | run independent prs to merged with one owner per pr. a swarm verifies each code-ready head, and every later change to the patch gets a fresh check. |
| [autopilot-stack](./skills/poteto-mode/playbooks/autopilot-stack.md) | build and verify one linear base-branch stack for the operator to review and land. |
| [session pickup](./skills/poteto-mode/playbooks/session-pickup.md) | resume or take over a prior agent's in-flight work. |
| [pause safely](./skills/poteto-mode/playbooks/pause-safely.md) | suspend in-flight work cleanly so it can be resumed later. |
| [multi-phase plan](./skills/poteto-mode/playbooks/multi-phase-plan.md) | work that spans phases or stacked PRs. |
| [worktree cleanup](./skills/poteto-mode/playbooks/worktree-cleanup.md) | reclaim disk by pruning merged or abandoned worktrees and stale ios simulators, safety-gated. |
| [opening a pr](./skills/poteto-mode/playbooks/opening-a-pr.md) | open a ready pr from small ordered commits with a conventional commits title and a briefing-style body. invoked at the end of every other playbook. |

</details>



when invoked it:

1. matches your task to a [playbook](./skills/poteto-mode/playbooks/) and opens a todo list whose first items are its steps, copied in verbatim.
2. routes to the other skills as the steps fire.
3. writes unslopped replies framed for the consumer and the maintainer.

the full rules and playbooks live in [`skills/poteto-mode/SKILL.md`](./skills/poteto-mode/SKILL.md).

[`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) stays on across turns by itself. a loaded skill stays in context for the rest of the session. compaction keeps only the start of a long skill, so run it again after a compaction or in a new session.

[`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) works extremely well with claude code's `/loop` command. you can make claude code work for many hours without sacrificing rigor.

## skills

[`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) runs most of these for you when a step needs them (`how`, `why`, `architect`, `arena`, `swarm`, `interrogate`, `unslop`, `no-comments`, `technical-writing`, `tdd`, and the principles). the table below is for when you want one directly:

```
/omc-pstack-fy:how do we cancel runs? do we have an n+1 when we look up every run to cancel?
```

```
/omc-pstack-fy:interrogate review this pr.
```

<details>
<summary>all skills</summary>

| skill | use it when |
|---|---|
| [`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) | default entry point for any non-trivial task. |
| [`/omc-pstack-fy:poteto-help`](./skills/poteto-help/SKILL.md) | you're new to pstack, or unsure which skill, playbook, or principle fits. finds out what you're trying to do, answers that part, and hands you a prompt to type. runs only when you type [`/omc-pstack-fy:poteto-help`](skills/poteto-help/SKILL.md). |
| [`/omc-pstack-fy:in-your-own-words`](./skills/in-your-own-words/SKILL.md) | you want the agent to play back your goal and the problem before it starts. runs only when you type [`/omc-pstack-fy:in-your-own-words`](skills/in-your-own-words/SKILL.md). |
| [`/omc-pstack-fy:sharpen`](./skills/sharpen/SKILL.md) | you want a prompt made deeper, not bigger, before you send it: what a top professional would do that you didn't ask for, the raw material they'd start from, their methods and tools, and an outside check that the result is right. hands back the rewritten prompt and leaves your choices open. doesn't do the task. runs only when you type [`/omc-pstack-fy:sharpen`](skills/sharpen/SKILL.md). |
| [`/omc-pstack-fy:how`](./skills/how/SKILL.md) | you want a walkthrough of how a subsystem works. |
| [`/omc-pstack-fy:why`](./skills/why/SKILL.md) | you want to know why something was built this way. discovers available MCPs at run time and queries each evidence category in parallel (source control, issue tracker, long-form docs, real-time chat, infra observability, error tracking, analytics warehouse). |
| [`/omc-pstack-fy:recall`](./skills/recall/SKILL.md) | you're starting or resuming work and want your recent context on a topic rebuilt from your own chat history and the shared record, handed back as a tight current-state brief. |
| [`/omc-pstack-fy:ketchup`](./skills/ketchup/SKILL.md) | you want what changed in this chat since your last message, in plain words and small visuals, with every item waiting on you listed and decidable from the reply alone, even when that makes the reply long. |
| [`/omc-pstack-fy:ketchup-video`](./skills/ketchup-video/SKILL.md) | you want the [`/omc-pstack-fy:ketchup`](skills/ketchup/SKILL.md) catch-up as a short silent video of slides, with the calls waiting on you as text under it. |
| [`/omc-pstack-fy:blast-radius`](./skills/blast-radius/SKILL.md) | you have a small-looking change and want to know what else it could break, with the one fact it's safe because of proven by running code, not asserted. |
| [`/omc-pstack-fy:architect`](./skills/architect/SKILL.md) | you're about to write code that crosses a function boundary and want the caller's usage, types, and module shape settled first. |
| [`/omc-pstack-fy:arena`](./skills/arena/SKILL.md) | you want N parallel attempts at the same thing, then to grab the best parts of each. |
| [`/omc-pstack-fy:swarm`](./skills/swarm/SKILL.md) | you want N parallel workers across different slices or races, then one aggregated report. |
| [`/omc-pstack-fy:interrogate`](./skills/interrogate/SKILL.md) | you have a diff and want different models to try to break it, including a strict code-quality lens. |
| [`/omc-pstack-fy:automate-me`](./skills/automate-me/SKILL.md) | you want your own `-mode` skill, drafted from how you've actually worked. |
| [`/omc-pstack-fy:setup-pstack`](./skills/setup-pstack/SKILL.md) | you want to pick which models pstack uses per role. detects your models and writes a config rule. |
| [`/omc-pstack-fy:reflect`](./skills/reflect/SKILL.md) | a long task landed and you want the recipe captured as a skill edit. |
| [`/omc-pstack-fy:correct`](./skills/correct/SKILL.md) | you keep correcting agents for the same mistakes. mines history for mistake classes, fixes each at the highest level that works (architecture, then types, lint, and ci, then tests, with docs last), and keeps a table pairing each rule with what enforces it. |
| [`/omc-pstack-fy:teach`](./skills/teach/SKILL.md) | you want to actually understand a change or subsystem, not just have it summarized. runs how + why and weaves one plain explanation, built up diagram by diagram. |
| [`/omc-pstack-fy:tdd`](./skills/tdd/SKILL.md) | you're fixing a bug and there's a cheap local test path. write the failing test first, then the fix. |
| [`/omc-pstack-fy:benchmark-checklist`](./skills/benchmark-checklist/SKILL.md) | you ran a benchmark or measured a speedup or regression. vets the number (limiter, tuning, errors, repeat runs, end-to-end relevance) before you report or act on it. |
| [`/omc-pstack-fy:no-comments`](./skills/no-comments/SKILL.md) | strip comments before review; spawns Comment Sicko, fixes accepted findings, offers encodings for claimed constraints. |
| [`/omc-pstack-fy:typescript-best-practices`](./skills/typescript-best-practices/SKILL.md) | you're reading or editing typescript. grounds the type-system-discipline principle in syntax. |
| [`/omc-pstack-fy:figure-it-out`](./skills/figure-it-out/SKILL.md) | no bundled playbook fits. designs a rigorous, auditable playbook for the task. |
| [`/omc-pstack-fy:show-me-your-work`](./skills/show-me-your-work/SKILL.md) | you want a reviewable decision trail. logs decisions to a tsv you can commit. |
| [`/omc-pstack-fy:create-verification-skill`](./skills/create-verification-skill/SKILL.md) | your project has no scripted way to prove app behavior. generates a project-local verify skill with a feature map, for any language or platform. |
| [`/omc-pstack-fy:maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md) | your verify skill's feature map has drifted from the app. source wave + one live pass, at most one PR of proven corrections. |
| [`/omc-pstack-fy:create-formal-verification-skill`](./skills/create-formal-verification-skill/SKILL.md) | tests can't reach the case that breaks a race, retry, state machine, parser, or unsafe code. verifies one property with the tool that fits and generates a project-local skill to recheck it on every change. |
| [`/omc-pstack-fy:maintain-formal-verification-skill`](./skills/maintain-formal-verification-skill/SKILL.md) | code your formal verification covers has changed since it was last checked. updates the model, harness, or properties to match the code, reruns, and says whether each failure is drift in the verification or a bug in the code. |
| [`/omc-pstack-fy:statechart`](./skills/statechart/SKILL.md) | someone who owns the behavior needs to see it, not read a spec. draws what the user sees as a mermaid statechart generated from a tla+ model, marks each state works, still wrong, or fixed by your open pr, and draws each bug tlc finds as a numbered path. also turns an agreed chart into a tla+ skeleton, or audits the code against an existing spec. |
| [`/omc-pstack-fy:unslop`](./skills/unslop/SKILL.md) | you're cleaning up writing. removes AI tells. |
| [`/omc-pstack-fy:bro`](./skills/bro/SKILL.md) | you want the last message restated in plain human language, no jargon. |
| [`/omc-pstack-fy:technical-writing`](./skills/technical-writing/SKILL.md) | layered doc standard (Diátaxis + Google developer style + STE + Global English) for docs, RFCs, readmes, PR descriptions, commit messages. |

</details>

**[`/omc-pstack-fy:statechart`](skills/statechart/SKILL.md) downloads tools the first time you use it.** with `mise` installed and `TLA2TOOLS` unset, the first model check installs tlc through mise, plus a temurin jdk unless `JAVA` is set, a few hundred mb with the jdk. the first png or `render` run installs two packages from npm into a cache folder. set `TLA2TOOLS`, and `JAVA` if `java` is not on your path, to skip the model-check download. it also runs a `<Spec>.map.mjs` beside a spec as javascript, so run it only on specs you trust. the skill's `SKILL.md` and `--help` describe what it installs.



### examples

mostly i type [`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) at the start of a task and let it route to a playbook. the other skills fire as the steps need them. a few i reach for directly.


<details>
<summary>all the examples</summary>

```
bug fix:           /omc-pstack-fy:poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even
                   when idle. repro first, then fix and verify.
perf:              /omc-pstack-fy:poteto-mode a big list takes a second or two to load even though we virtualize.
                   run a cpu trace and tell me why.
feature:           /omc-pstack-fy:poteto-mode build a small feature behind a feature flag. verify it really works.
prototype:         /omc-pstack-fy:poteto-mode build two prototypes of the markdown renderer so we can compare.
                   spawn an agent for each.
multi-phase:       /omc-pstack-fy:poteto-mode open source these skills as a plugin. nothing internal leaks, work
                   in a temp dir, show me the dependency graph first.
overnight run:     /omc-pstack-fy:poteto-mode i'm going to bed. land the stack even if ci flakes. i want
                   everything merged by morning.
babysit:           /omc-pstack-fy:poteto-mode check on pr 123. anything outstanding?
visual parity:     /omc-pstack-fy:poteto-mode the row spacing is too tall when this flag is on. the second image
                   is correct. repro and fix until it matches.
figure it out:     /omc-pstack-fy:poteto-mode i'm stepping away. migrate every caller from the synchronous store
                   to the new async one, keeping behavior identical. i want to trust it was done
                   right when i'm back.
how:               /omc-pstack-fy:how do we cancel runs? do we have an n+1 when we look up every run to cancel?
why:               /omc-pstack-fy:why is this feature flag not on yet?
architect:         design this instrumentation to be high signal with no false positives. /omc-pstack-fy:architect
                   this first.
arena:             /omc-pstack-fy:arena take my prompt to the arena verbatim. i want to compare their proposals
                   with yours.
swarm:             /omc-pstack-fy:swarm check every package under packages/ against its check.sh. one worker per
                   package. one report.
interrogate:       /omc-pstack-fy:interrogate review this pr.
tdd:               /omc-pstack-fy:tdd implement
unslop:            can we unslop and tighten the new changes?
reflect:           /omc-pstack-fy:reflect that took too long. capture what we learned so the next run doesn't
                   repeat it.
correct:           /omc-pstack-fy:correct
show-me-your-work: /omc-pstack-fy:show-me-your-work keep a decision trail i can review when i'm back.
automate-me:       /omc-pstack-fy:automate-me
help:              /omc-pstack-fy:poteto-help which skill should i use to review this branch?
```

</details>

## the `poteto-agent` and Comment Sicko subagents

[`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) runs in the chat that receives it. that chat owns the playbook, the todo list, and every subagent spawn.

pstack also ships [`subagent_type: "omc-pstack-fy:poteto-agent"`](./agents/poteto-agent.md) as the wrapper for delegates spawned during a run. it reads `poteto-mode` in full, including its inline principles index, before doing any work. substituting `general-purpose` skips that read and drifts. do not spawn `poteto-agent` to run the playbook itself.

[`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) and [`subagent_type: "omc-pstack-fy:poteto-agent"`](./agents/poteto-agent.md) route through the same wrapper.

pstack also ships [Comment Sicko](./agents/comment-sicko.md), a read-only comment reviewer available as `subagent_type: "omc-pstack-fy:comment-sicko"`. usually invoke it through [`/omc-pstack-fy:no-comments`](./skills/no-comments/SKILL.md), not directly.

## principles

twenty-four short skills, one principle each. `poteto-mode` indexes them inline and reads that index at task start. the standalone files are there so other skills can reference a principle by name, and so the index can point at the full rule for each.

<details>
<summary>all twenty-four principles</summary>

| principle | group | rule |
|---|---|---|
| [laziness-protocol](./skills/principle-laziness-protocol/SKILL.md) | core | Bias toward deletion and the smallest change that solves the problem. |
| [foundational-thinking](./skills/principle-foundational-thinking/SKILL.md) | core | Apply before writing logic: choosing core types and data structures, sequencing scaffold-vs-feature work, asking what concurrent actors share. Get the data structures right so downstream code becomes obvious. |
| [redesign-from-first-principles](./skills/principle-redesign-from-first-principles/SKILL.md) | core | Redesign as if the requirement had been a foundational assumption from day one, instead of bolting it on. |
| [attack-the-premise](./skills/principle-attack-the-premise/SKILL.md) | core | Apply when two or more fixes that share one premise have failed the same gate. Write the premise down and test it directly before you write another fix that assumes it. |
| [subtract-before-you-add](./skills/principle-subtract-before-you-add/SKILL.md) | core | Remove dead weight, redundant validators, and stub references first, then build on the simpler base. |
| [minimize-reader-load](./skills/principle-minimize-reader-load/SKILL.md) | core | Count layers between question and answer, and hidden state in the reader's head; collapse one-caller wrappers and shrink mutable scope. |
| [outcome-oriented-execution](./skills/principle-outcome-oriented-execution/SKILL.md) | core | Apply during planned rewrites and migrations with explicit phase boundaries. Converge on the target architecture; don't preserve smooth intermediate states with throwaway compatibility code. |
| [experience-first](./skills/principle-experience-first/SKILL.md) | core | Choose user delight over implementation convenience; ship fewer polished features over more rough ones. |
| [exhaust-the-design-space](./skills/principle-exhaust-the-design-space/SKILL.md) | core | Build 2-3 competing prototypes and compare side by side before committing. |
| [build-the-lever](./skills/principle-build-the-lever/SKILL.md) | core | Apply to any non-trivial work, not just bulk work: edits, migrations, analyses, checks. Build the tool that does it or proves it (codemod, script, generator, or a skill your subagents follow) instead of working by hand. The tool is the artifact a reviewer can rerun. |
| [model-the-domain](./skills/principle-model-the-domain/SKILL.md) | architecture | Encode the domain in a structure instead of scattered conditionals. |
| [boundary-discipline](./skills/principle-boundary-discipline/SKILL.md) | architecture | Concentrate guards at system boundaries (CLI, config, network, external APIs); trust internal types and keep business logic in pure functions. |
| [type-system-discipline](./skills/principle-type-system-discipline/SKILL.md) | architecture | Make illegal states unrepresentable, brand semantic primitives, parse external data at boundaries, exhaust variants, derive from authoritative schemas. |
| [make-operations-idempotent](./skills/principle-make-operations-idempotent/SKILL.md) | architecture | Converge to the same end state regardless of partial prior runs. |
| [migrate-callers-then-delete-legacy-apis](./skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | architecture | Migrate callers and delete the old API in the same wave instead of preserving compatibility layers. |
| [separate-before-serializing-shared-state](./skills/principle-separate-before-serializing-shared-state/SKILL.md) | architecture | Eliminate the sharing first; serialize structurally only when one shared writer is a real invariant. |
| [prove-it-works](./skills/principle-prove-it-works/SKILL.md) | verification | Apply after completing a task, before declaring done. Verify against the real artifact (run the feature, read the actual value, inspect the diff), not a proxy, self-report, or 'it compiles.'. |
| [fix-root-causes](./skills/principle-fix-root-causes/SKILL.md) | verification | Trace each symptom back to the first place the system went wrong and fix it there. A guard is a fix only when the state it handles is legitimate. |
| [sequence-verifiable-units](./skills/principle-sequence-verifiable-units/SKILL.md) | verification | Apply to multi-step work (sweeps, migrations, runs of similar edits) and to how you stack commits and PRs. Break work into small units that each end in a verifiable state, check each before the next, and order delivery so the sequence proves itself to a reviewer. |
| [test-behavior-not-implementation](./skills/principle-test-behavior-not-implementation/SKILL.md) | verification | Apply when you write, change, or keep a test. Assert what the code's users can observe, so the test fails when that behavior breaks and keeps passing when only the internals change. |
| [explain-the-number](./skills/principle-explain-the-number/SKILL.md) | verification | Apply before you trust, report, or act on a number you measured: a speedup, a regression, a throughput, a latency, or an eval result. Find what limits it, and rule out that it measured something other than the work you think. |
| [guard-the-context-window](./skills/principle-guard-the-context-window/SKILL.md) | delegation | Route bulk to subagents; keep summaries in the main thread, not raw payloads. |
| [never-block-on-the-human](./skills/principle-never-block-on-the-human/SKILL.md) | delegation | Proceed, present the result, let the human course-correct after the fact; reserve confirmation for irreversible actions. |
| [encode-lessons-in-structure](./skills/principle-encode-lessons-in-structure/SKILL.md) | meta | Encode the rule as a lint, metadata flag, runtime check, or script instead of more text. |

</details>

## borrowed skills

upstream keeps three skills that `poteto-mode` uses in a separate plugin. omc-pstack-fy bundles them, so they work out of the box:

- [`/omc-pstack-fy:deslop`](./skills/deslop/SKILL.md) cleans slop out of the diff before each commit.
- [`control-cli`](./skills/control-cli/SKILL.md) drives CLIs and TUIs.
- [`control-ui`](./skills/control-ui/SKILL.md) drives browser, Electron, and web UIs.

for writing a skill, `poteto-mode` uses the `skill-creator` skill when your session lists it. omc-pstack-fy doesn't bundle that one. without it, a skill is a `SKILL.md` with `name` and `description` frontmatter under `.claude/skills/<name>/`, or `~/.claude/skills/<name>/` for a personal skill.

## why are there no planning skills?

claude code already has a great plan mode (shift+tab) which works great with pstack. but personally, i don't believe in planning. the best spec is code. if you do want to make a plan, [`/omc-pstack-fy:poteto-mode`](./skills/poteto-mode/SKILL.md) covers it, but it's not a default. 

## make it yours

`poteto-mode` is my style. you may not want exactly that.

type [`/omc-pstack-fy:automate-me`](./skills/automate-me/SKILL.md). it mines your recent transcripts, drafts a `<your-name>-mode` skill from how you've actually worked, and routes through pstack underneath. you keep pstack as the base and end up with your own routing skill alongside `poteto-mode`.

models are configurable too. type [`/omc-pstack-fy:setup-pstack`](./skills/setup-pstack/SKILL.md). it detects the models you have access to and writes a small rule file, `~/.claude/rules/omc-pstack-fy-models.md`, mapping each role (code, judgment, the review panels) to a model and an effort. claude code loads it into every new session. every skill reads it and falls back to sensible defaults when the rule is absent, so you override only what you want.

when a default changes, a rule written before the change still pins the old default. delete those role lines, or delete the file, then run [`/omc-pstack-fy:setup-pstack`](skills/setup-pstack/SKILL.md) again. a rerun keeps any role whose model differs from the default.

> In **omc-pstack-fy**, [`/omc-pstack-fy:poteto-mode`](skills/poteto-mode/SKILL.md) works inside the oh-my-claudecode plugin. oh-my-claudecode is the main harness and keeps every keyword and workflow, and pstack is the engineering engine it hands code to. While oh-my-claudecode is installed and enabled, the plugin's SessionStart hook tells its workflows to run each code unit as a `omc-pstack-fy:poteto-agent` delegate under a poteto-mode playbook, the ai-slop-cleaner step as [`/omc-pstack-fy:deslop`](skills/deslop/SKILL.md), and the final code review as [`/omc-pstack-fy:interrogate`](skills/interrogate/SKILL.md).

## automations

upstream pstack also ships a dormant [benny automation pack](https://github.com/cursor/plugins/tree/99b609a72323b70204eab407c622f436e858e112/pstack/automations/benny). benny triages slack issue reports, then reproduces and fixes confirmed bugs with real ui evidence. it runs on cursor's automation service, so omc-pstack-fy leaves it out. claude code's `/schedule` runs cloud routines on a cron if you want to build a pipeline like it.

## license

MIT
