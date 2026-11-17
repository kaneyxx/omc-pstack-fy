---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /omc-pstack-fy:arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. The Skill tool may run another plugin's skill of that name, such as `oh-my-claudecode:<name>`, which is a different skill. Write `/omc-pstack-fy:<name>` only when the user should type it.

Open a todo list with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft, Verify) before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners from the `arena runners` line in `~/.claude/rules/omc-pstack-fy-models.md`, by default `fable high`, `opus high`, and `sonnet high`. Each entry is `<model> <effort>`, passed to the Agent tool as `model` and `effort`. An `inherit` entry is the parent model, so omit `model`. If the Agent tool rejects an entry, use the same model at the closest effort its schema lists or drop the seat, keep at least two runners, and say so. Spawn more for multiple design directions, and repeat one model when the work is generation-bound, not judgment-sensitive. Pick each subagent's effort level per the Subagents section of the [**poteto-mode**](../poteto-mode/SKILL.md) skill.
4. Give each candidate its own output location (a git worktree where possible, through the Agent tool's `isolation: "worktree"` and a brief that names the commit to check out first, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Spawn all N subagents in one message with `run_in_background: true`, each with the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, spawn one judge from the `arena cross-judge pool` line in `~/.claude/rules/omc-pstack-fy-models.md`, by default `fable high`, `opus high`, `sonnet high`. The judge never runs on the parent's model. Use the first entry from another vendor, else the first Claude entry on another model. Fable and the other Claude models are one vendor, so a Claude judge under a Claude parent is a same-vendor judge. An `inherit` entry is the parent model, so it never judges. For a Claude entry, spawn the judge with `subagent_type: "general-purpose"` and the entry's `model` and `effort`. Its brief says "do not edit files", and you check `git status` after it returns. For an external entry, such as `gemini:gemini-2.5-pro`, read the [**pstack-ask**](../pstack-ask/SKILL.md) skill and run the judge through it, read-only. Its throwaway copy may not reach the candidates' folders, so inline each candidate, or its diff, in its prompt under its path label. If its CLI is not installed, fails, or times out, run the Claude fallback that skill names and say so in one line. If you do not know the parent's model, use the first entry and say that the model check did not run. If the Agent tool rejects an entry, use the same model at the closest effort its schema lists, then the next such entry, or skip the judge, and say so. While you read in Phase D, the judge scores each candidate, by path label, on each rubric criterion and recommends a base.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge when Phase C ran one. Agreement on the base confirms the pick. Name the panel in the synthesis note. "Cross-vendor panel (claude, codex)" is stronger evidence than "same-vendor panel (opus, sonnet)". Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. Runners write the artifact, so they stay on Claude. Name the panel that converged, such as "same-vendor panel (opus, sonnet)". If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict or that Phase C skipped the judge, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.
