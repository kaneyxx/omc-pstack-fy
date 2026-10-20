---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /omc-pstack-fy:swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

## Start

Open a todo list with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
4. Pick the worker model from the `swarm workers` line in `~/.claude/rules/omc-pstack-fy-models.md`. If the rule or that line is missing, use `sonnet xhigh`. Pass the value's two words to the Agent tool as `model` and `effort`. For `inherit`, omit `model` so the workers run on the parent model. If the Agent tool rejects the value, use the default and say so. If it rejects the default, use the closest model and effort its schema lists. For a model race, name each arm's model up front. Pick each subagent's effort level for the job, per the Subagents section of the [**poteto-mode**](../poteto-mode/SKILL.md) skill.
5. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Spawn all N workers in one message with `subagent_type: "general-purpose"`, `isolation: "worktree"`, `run_in_background: true`, and the step 4 model and effort, with `model` left unset for `inherit`. The worktree gives each worker its own checkout on this machine, so workers never write over each other. Omit `isolation` only when a worker needs your own checkout, such as its uncommitted changes.

Name the branch or commit each worker checks out first, so each worker runs the code you mean.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.
