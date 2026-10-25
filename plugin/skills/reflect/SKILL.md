---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

Mine the current conversation for durable learnings, then route them into skill edits.

Invoke when the user says "reflect" or "/omc-pstack-fy:reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Before fanning out, find this conversation's transcript in the workspace's project folder, `~/.claude/projects/<slug>/`. The slug is the workspace path with every character that is not a letter or digit changed to `-`, so `/Users/you/my_proj` is `-Users-you-my-proj`. Do not glob across `~/.claude/projects/*/`. That crosses workspace boundaries and reads private chats from unrelated projects.

```bash
ls -t ~/.claude/projects/<slug>/*.jsonl ~/.claude/projects/<slug>/*/subagents/*.jsonl 2>/dev/null | head -10
```

That covers sessions (`<session>.jsonl`) and their subagents (`<session>/subagents/<agent>.jsonl`). The newest session file is usually this one, but another session in the same workspace can be newer, so check. Each line is a JSON object with a `type`. A human message is a `type: "user"` line whose `message.content` is a string or a list of `text` blocks. Tool results are `type: "user"` lines too, but their content is `tool_result` blocks, so they are not human messages. Skip `isMeta: true` lines as well, because they carry injected text such as a skill body. For each candidate, find the first human message. Take the file whose first human message contains the conversation's opening user prompt. If none matches, pass a tight digest of the session instead.

## 2. Spawn three reviewers in parallel

One message, three `Agent` calls, `subagent_type: "general-purpose"`. Reviewers need MCP access to look up the tickets, chat threads, and observability traces the transcript references, and a general-purpose agent keeps the session's MCP servers.

Each reviewer and the synthesizer name a role line in the `omc-pstack-fy-models.md` rule and a default. A role value is `<model> <effort>`, such as `opus xhigh`. Set `model` and `effort` from that line's value, or from the default if the rule or the line is missing. Leave `model` unset when the value is `inherit`, so the agent runs on the parent's model. If the Agent tool rejects a value, use the default and say so. Then adjust each subagent's effort for the job, per the Subagents section of the [**poteto-mode**](../poteto-mode/SKILL.md) skill.

| Lens | Role line | Default | Prompt template |
|---|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `opus xhigh` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `sonnet xhigh` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `opus xhigh` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript path or digest where marked. Reviewers return findings in the `Agent` response body.

The configured role lines decide each lens's model, as poteto-mode's Subagents section says. Only the `reflect tooling` line may name another vendor, such as `gemini:gemini-2.5-pro`. When it does, read the [**pstack-ask**](../pstack-ask/SKILL.md) skill and run the Tooling lens through it, read-only, from a background Bash call in the same message as the two `Agent` calls. Its prompt is the filled template, and the text it writes is its findings. Its throwaway worktree may not reach the transcript, so fill in the digest as well as the path. If its CLI is unavailable, run the Claude fallback that skill names. If the Tooling lens runs on the parent's own model, say so in the summary, because one model is then checking its own blind spots. Name the panel in the summary. "Cross-vendor panel (claude, codex)" is stronger evidence than "same-vendor panel (opus, sonnet)".

## 3. Synthesize

One `Agent` call, `subagent_type: "general-purpose"`, `model` and `effort` from the `reflect judgment, divergent, synthesizer` line (default `opus xhigh`). It spot-verifies citations through MCP, and a general-purpose agent keeps the session's MCP servers. Pass `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. It returns an Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker without waiting. Only the Accepted list waits for approval.

Never edit a skill under `plugins/cache/`. Before approval, show its destination, `.claude/skills/<skill>/` or `~/.claude/skills/<skill>/`. After approval, copy the skill folder there and edit the copy. Never open a PR or push.

Follow each approved row's Routing exactly. The rows below hand work to the `skill-creator` skill when the session lists it, because it runs the test loop a skill change needs. Without it, the parent makes the edit directly, and a new skill is a `SKILL.md` with `name` and `description` frontmatter under `.claude/skills/<kebab-name>/`, or `~/.claude/skills/<kebab-name>/` for a personal skill.

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to `skill-creator` and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to `skill-creator` and run its description-optimization loop.
- `new skill via skill-creator: <kebab-name>`: hand creation to `skill-creator`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.
- Panel: the model each reviewer ran on, the panel's name, such as "cross-vendor panel (claude, codex)", and any fallback line from the [**pstack-ask**](../pstack-ask/SKILL.md) skill.
