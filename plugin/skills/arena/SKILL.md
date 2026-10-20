---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /omc-pstack-fy:arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

Open a todo list with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft, Verify) before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners. Use the `arena runners` line in `~/.claude/rules/omc-pstack-fy-models.md`. If the rule or that line is missing, default to one each on `opus xhigh` and `sonnet xhigh`. Each entry is `<model> <effort>`, passed to the Agent tool as `model` and `effort`. An `inherit` entry in this line or the cross-judge line means the parent model, so omit `model` for it. If the Agent tool rejects a configured entry, run that seat on the default with the same model, or on `opus xhigh` when no default shares it, and say so. If it rejects a default, use the closest model and effort its schema lists. Spawn more runners when the arena covers multiple design directions. Use the same model N times when the work is generation-bound rather than judgment-sensitive. Pick each subagent's effort level for the job, per the Subagents section of the [**poteto-mode**](../poteto-mode/SKILL.md) skill.
4. Give each candidate its own output location (a git worktree where possible, through the Agent tool's `isolation: "worktree"`, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Spawn all N subagents in one message with `run_in_background: true`, each with the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, choose one model from the `arena cross-judge pool` line in `~/.claude/rules/omc-pstack-fy-models.md`. If the rule or that line is missing, choose from `opus xhigh` and `sonnet xhigh`. Prefer a different vendor from the parent's when the pool offers one, else a different model, such as sonnet under an opus parent. For a Claude entry, spawn one judge subagent with `subagent_type: "general-purpose"` on that model. Its brief says "do not edit files", and you check `git status` after it returns. For an external entry, such as `gemini:gemini-2.5-pro`, read the [**pstack-ask**](../pstack-ask/SKILL.md) skill and run the judge through it, read-only. Its throwaway worktree may not reach the candidates' folders, so inline each candidate, or its diff, in its prompt under its path label. It sees the rubric and the candidates by path label, scores each criterion, and recommends a base with rationale. It runs in parallel with your reading in Phase D. Don't spawn it while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge. Agreement on the base confirms the pick. Name the panel in the synthesis note. "Cross-vendor panel (claude, codex)" is stronger evidence than "same-vendor panel (opus, sonnet)". Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. Runners write the artifact, so they stay on Claude. Name the panel that converged, such as "same-vendor panel (opus, sonnet)". If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.
