# Prompts worth copying

Swap in the real paths, skills, and done checks. Informal wording works.

## Understand

- `/omc-pstack-fy:poteto-mode read <thread>. restate the underlying issue in your own words, in plain english.`
- `/omc-pstack-fy:in-your-own-words <long or messy ask>`
- `/omc-pstack-fy:sharpen <the prompt you're about to send>`
- `/omc-pstack-fy:poteto-mode investigate why <symptom>. give me what we know, what data you used, and your best hypotheses. don't change any code yet.`
- `use /omc-pstack-fy:how to understand <subsystem>. then use /omc-pstack-fy:why to find out why it broke recently.`
- `/omc-pstack-fy:recall my work on <topic> from last week, then read <issue>.`
- `/omc-pstack-fy:teach me why you implemented it this way and not <other way>. what did you trade off?`
- `/omc-pstack-fy:poteto-mode take over this branch. read the decision log, find what's done, and continue. don't redo finished work.`

## Build

- Bug: `/omc-pstack-fy:poteto-mode <symptom>. repro first, then fix and verify.`
- Bug in an app: `/omc-pstack-fy:poteto-mode repro this with /verify-<app>. if it repros on main, fix it and show me a video as proof.`
- Bug with a cheap test: `/omc-pstack-fy:poteto-mode repro <bug> first. if there's a cheap test path, /omc-pstack-fy:tdd it. then fix and rerun.`
- Feature: `/omc-pstack-fy:poteto-mode add <behavior>. <current output> stays byte-identical. verify both.`
- Refactor: `/omc-pstack-fy:poteto-mode move <code> into one module, zero behavior change. record the current output first and prove it's unchanged after.`
- Perf: `/omc-pstack-fy:poteto-mode <operation> takes <time> on <fixture>. trace it, fix the measured cause, show me before and after.`

## Design and plan

- `/omc-pstack-fy:poteto-mode prototype a few options for <feature>. take screenshots or videos for me to compare.`
- `/omc-pstack-fy:poteto-mode we need <feature>. /omc-pstack-fy:architect it first, and answer open questions with prototypes. let me review before proceeding.`
- `/omc-pstack-fy:poteto-mode write a tutorial for how i would use <new package> first. then /omc-pstack-fy:teach me why it beats the current one.`
- `ask /omc-pstack-fy:arena for a second opinion on this thread and our approach.`
- `/omc-pstack-fy:poteto-mode turn this design into a plan. small verifiable PRs, each with its own verification steps.`
- `/omc-pstack-fy:poteto-mode plan the migration of <library> to <target>. small verifiable PRs. the result must match the original exactly, bugs included.`

## Review and ship

- `/omc-pstack-fy:interrogate the whole branch, but skeptically. don't change anything yet. no nitpicks unless it's a real bug or regression.` Read the dismissals too.
- `/omc-pstack-fy:create-formal-verification-skill prove <property> holds in <module>, even when <steps> interleave or retry.` After merges or refactors in that code: [`/omc-pstack-fy:maintain-formal-verification-skill`](../../maintain-formal-verification-skill/SKILL.md).
- `/omc-pstack-fy:swarm check every package under <dir> against its check script. one worker per package. one report.`
- `/omc-pstack-fy:poteto-mode open the pr. small ordered commits, evidence in the description.`
- `/omc-pstack-fy:poteto-mode babysit this pr. get it green.` For status only: `/omc-pstack-fy:poteto-mode check on pr <number>. anything outstanding?`
- `/omc-pstack-fy:poteto-mode land the stack.`

## Away and back

- `/omc-pstack-fy:poteto-mode im going to bed. <goal> in a fresh worktree off <base>. done means <checks>. keep a decision log. don't ask me before committing. /loop until done. if you're truly stuck after a few hours, stop and write up why.`
- `/omc-pstack-fy:show-me-your-work catch me up on what you did last night.` Read its Attention section first.
- [`/omc-pstack-fy:ketchup`](../../ketchup/SKILL.md) catches you up on this chat since your last message and lists every call that waits on you.
- `/omc-pstack-fy:poteto-mode full autopilot on this queue. each item is independent.`
- `/omc-pstack-fy:poteto-mode autopilot these changes but stack them, don't ship. i'll land the stack.`
- `/omc-pstack-fy:reflect capture what we learned so the next run doesn't repeat it.` Approve only edits that change a future decision.
- [`/omc-pstack-fy:bro`](../../bro/SKILL.md) restates the last reply in plain words.
