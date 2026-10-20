---
name: interrogate
description: "Use for \"interrogate\", \"adversarial review\", \"multi-model review\", \"challenge this\", \"stress test this code\", \"find blind spots\", or \"tear this apart\". Multiple LLM reviewers challenge changes from independent angles."
disable-model-invocation: true
---

# Interrogate

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

Spawn one reviewer per configured model to adversarially review code changes. The adversarial signal comes from model diversity, not assigned personas. The deliverable is a synthesized verdict. Do NOT auto-apply changes.

## Step 1, Scope

Identify what to review from context:

- If the user points at specific files or a diff, use that.
- If on a feature branch, run `git diff main...HEAD` (or the appropriate base branch) for the full changeset.
- If the user's message references recent work, gather the relevant files.

Package the diff or file contents with any surrounding context files the reviewers need to understand the code.

## Step 2, Intent

Before spawning reviewers, state the intent in one clear paragraph from the user's message, commit messages, the PR description if one exists, and the code. If you're unsure about the intent, ask the user before proceeding.

## Step 3, Spawn Reviewers

Launch all reviewers in a single message with the Agent tool, one per entry on the `interrogate reviewers` line in `~/.claude/rules/omc-pstack-fy-models.md`, labeled Reviewer A, B, and so on to match the entry count. If the rule or that line is missing, use the table defaults.

| Subagent | Default model |
|----------|---------------|
| Reviewer A | `opus xhigh` |
| Reviewer B | `sonnet xhigh` |

Each Claude reviewer gets `subagent_type: "general-purpose"`, with `model` and `effort` set from its configured entry, or from its table default when there is no configured line. Every reviewer prompt says "do not edit files", and you check `git status` once the reviewers return. Omit `model` for an `inherit` entry, so that reviewer runs on the parent model.

If the Agent tool rejects a configured entry, run that reviewer on the table default with the same model, or on Reviewer A's default when no default shares it, and say so. If it rejects a table default, spawn with the closest model and effort its schema lists (prefer the same model), and open a separate PR to update the default table. Do not block the review on the model issue. Never treat an `inherit` entry as a rejected one or apply either fallback to it.

Read `references/reviewer-prompt.md` and fill in the same template for every reviewer with the stated intent, the diff or file contents, the rubric from `references/rubric.md`, and the code-quality lens from `references/code-quality-review.md`. Pick each subagent's effort level for the job, per the Subagents section of the [**poteto-mode**](../poteto-mode/SKILL.md) skill.

An entry with a provider prefix, such as `gemini:gemini-2.5-pro`, is an external reviewer on another vendor's model. Read the [**pstack-ask**](../pstack-ask/SKILL.md) skill and follow it. It runs that reviewer read-only from a background Bash call, which goes in the same message as the `Agent` spawns. The external reviewer gets the same filled prompt as the Claude reviewers, and the text it writes is its findings. If its CLI is not installed, fails, or times out, run the Claude fallback that skill names and say so in one line.

## Step 4, Synthesize

As results come back, build a unified picture. Parse every reviewer's findings. Merge findings that describe the same issue differently, and note which models raised each one. Findings two or more models raised independently are the highest signal. Findings raised by more than one vendor weigh highest of all. Name the panel under Reviewers. "Cross-vendor panel (claude, codex)" is stronger evidence than "same-vendor panel (opus, sonnet)". Read a lone model's finding, but weight it accordingly. Note disagreements. If one model flags something and another explicitly says the opposite, that is context for the verdict.

## Step 5, Lead Judgment

You are the lead reviewer, a pragmatic senior engineer, not a neutral aggregator. Read `references/lead-judgment.md` for the full framework. Put every finding in one of four buckets, with the model(s) that raised it and a one-line rationale.

- **Act on**. Real issues affecting correctness, security, or maintainability given the actual goals. They would block a real PR.
- **Consider**. Legitimate, but you're not sure they outweigh the cost of addressing them now. Worth the user's attention.
- **Noted**. Technically valid but not actionable. Context-dependent, premature optimization, or low-impact at this stage.
- **Dismissed**. Wrong, nitpicky, or missing context, with a brief reason.

## Output Format

### Intent
> [The stated intent paragraph from Step 2]

### Reviewers
- Reviewer [label]: [model name], [N findings] (one bullet per reviewer)
- Panel: cross-vendor or same-vendor, such as "cross-vendor panel (claude, codex)", and any fallback line from the [**pstack-ask**](../pstack-ask/SKILL.md) skill

### Act On
[Each: description, which models raised it, why it matters.]

### Consider
[Each: description, which models raised it, the tradeoff.]

### Noted
[Brief list.]

### Dismissed
[Each with a brief rationale.]

### Agreement Map
[Where models agreed and diverged, and what that pattern tells us.]
