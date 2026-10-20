# Claude Code mapping

This file decides how omc-pstack-fy writes each Cursor name natively for Claude Code. Every rewrite in `tools/rules/` and `overlays/` follows it. When the adapter is gone, this file is the record of why the text reads the way it does.

Facts below were checked in Claude Code 2.1.304 on 2026-10-20 unless marked otherwise.

## Rules for rewriting

1. Keep Lauren's meaning, voice, and rules. Change the mechanism, never the rigor. Lowercase prose stays lowercase.
2. Prefer, in order: a global substitution (only for a mapping that is right in every context), then an `edit` (exact upstream passage, so an upstream rewrite fails loudly), then a fork (whole-file overlay pinned to the upstream hash). Fork only when edits would rewrite most of a file.
3. Never invent Claude Code features. If a row below does not cover a case, write the plainest true sentence and flag it in your report.
4. Say what Claude Code does instead. Never write "In Cursor ..., in Claude Code ...". The reader only runs Claude Code.
5. Keep the unslop rules in replacement text: short declarative sentences, no long-dash character, no colon as a mid-sentence connector.

## Tools

| Cursor | omc-pstack-fy |
| --- | --- |
| `Task` tool, Task call, Task spawn | the `Agent` tool, Agent call, Agent spawn |
| `AskQuestion` | `AskUserQuestion`. Subagents and `claude -p` sessions do not have it, so they ask in plain text or, under poteto-mode's autonomy rules, decide and report. A question takes 2 to 4 options, so a longer list splits across questions. `allow_multiple` is `multiSelect: true`. |
| open a todolist | open a todo list with the session's todo tool (`TodoWrite` or `TaskCreate`) when it has one. Otherwise keep the checklist in the reply and update it at each phase. Subagents have no todo tool. |
| run another pstack skill | Read its `SKILL.md`. The Skill tool refuses skills that set `disable-model-invocation: true` and tells the model not to reproduce them, so a model must never meet a bare command it is meant to run. The build links every "the **name** skill" mention and every `` `/omc-pstack-fy:<name>` `` command outside code blocks to the skill's `SKILL.md`, and adds a routing note to each skill that names another. The user types `/omc-pstack-fy:<name>`. |
| `/loop` | unchanged. Claude Code has its own `/loop` (fixed interval such as `/loop 1h`, or self-paced with no interval). |

## Subagents

Subagents can spawn their own subagents (verified: a nested `Agent` call from a subagent succeeds). They have no `AskUserQuestion` and no todo tool.

| Cursor | omc-pstack-fy |
| --- | --- |
| `subagent_type: "generalPurpose"` | `subagent_type: "general-purpose"` |
| `poteto-agent`, `comment-sicko` | `subagent_type: "omc-pstack-fy:poteto-agent"`, `"omc-pstack-fy:comment-sicko"` |
| `readonly: true` | `subagent_type: "general-purpose"`, a brief that says "do not edit files", and a `git status` check by the parent afterward. Not `Explore`: it starts without CLAUDE.md and the git status snapshot, reads excerpts rather than reviewing, and picks its own model, so reviewers and judges lose the repo's conventions. `Explore` fits only pure search, such as a source wave that locates code. |
| `readonly: false` | `general-purpose`. It keeps the session's MCP servers. |
| `environment: "cloud"` | `isolation: "worktree"`, and the brief names the branch or commit to check out. The worker runs on this machine. |
| `environment: "local"` | omit |
| `cloud_base_branch: <b>` | the brief tells the worker to check out `<b>` first |
| `run_in_background: true` | unchanged. The `Agent` tool takes the same parameter. Pass it explicitly, because background is the default only for spawns from the main conversation. |
| `resume` | `SendMessage` to the agent's id when its state must survive. Otherwise a fresh agent with the earlier result pasted into the brief. |
| `file_attachments` | list the paths in the brief |

## Models

The `Agent` tool takes `model` (`opus`, `sonnet`, `haiku`, `fable`) and `effort` (`low`, `medium`, `high`, `xhigh`, `max`). There is no per-call fast mode, so every `-fast` variant drops.

A role value is `<model> <effort>`, such as `opus xhigh`. `inherit` means omit `model` so the agent runs on the parent's model. It replaces Cursor's `inherit-parent` and `auto`.

| Cursor default | omc-pstack-fy default | Why |
| --- | --- | --- |
| `claude-opus-5-5-xhigh` (judgment and prose, hardest tasks) | `opus xhigh` | Same model. |
| `grok-4.7-xhigh-fast` (code delegates, swarm workers, how explorer, why investigators, reflect tooling) | `sonnet xhigh` | Upstream picks a fast, strong code model. Sonnet is Claude's. |
| two-model panels (`interrogate reviewers`, `arena runners`, `arena cross-judge pool`, `architect runners`) | `opus xhigh, sonnet xhigh` | Two different models keep the panel diverse. Phase 3 adds other vendors through `pstack-ask`. |
| a different family for a judge or verifier | a different model from the parent (opus versus sonnet) | Same intent within one vendor. Say plainly in replies that a same-vendor panel is weaker evidence than a cross-vendor one. |

The model rule file is `~/.claude/rules/omc-pstack-fy-models.md`, with no frontmatter. Claude Code loads every `.md` file in `~/.claude/rules/` into each session (per the official adapter, unverified here). The name differs from the official `pstack-models.md` so both plugins can be installed. Never put role lines in `CLAUDE.md`.

Matching the model to the job: change `effort` one step up or down as poteto-mode says. Keep the role's model, so a two-model panel stays two models.

## Other vendors (Phase 3)

Upstream's panels pair Claude with Grok so reviewers do not share blind spots. omc-pstack-fy keeps that seam open for any vendor's CLI, read-only, on review and judging roles only.

**Role value grammar.** `[<provider>:]<model> [<effort>]`. No provider means Claude, so every existing value stays valid. Examples: `opus xhigh`, `codex:gpt-5-codex high`, `gemini:gemini-2.5-pro`. A panel line lists entries separated by commas and may mix vendors: `interrogate reviewers: opus xhigh, codex:gpt-5-codex high`.

**Roles that may hold an external entry.** `interrogate reviewers`, `arena cross-judge pool`, `reflect tooling`, and the new `second opinion` role. `second opinion` replaces "a different model from the parent" in show-me-your-work's audit and eval's judge. With no line, those keep their current rule: sonnet under an opus parent, opus otherwise. An external entry on any other role is an error. setup-pstack refuses it, and a skill that meets one uses the role's default and says so. Writing code, exploring with tools, and using MCP servers stay on Claude.

**How a skill runs an external entry.** Read the **pstack-ask** skill and follow it. In short:

1. Write the exact prompt the Claude entries get to a temporary file. A second opinion is the same prompt against a different model.
2. Run `node <pstack-ask dir>/scripts/pstack-ask.mjs <provider> --model <model> [--effort <effort>] --prompt-file <file> --out <file>` from the repository root, with Bash `run_in_background: true`, beside the Claude spawns. `--out` must be outside the repository.
3. Read the one-line JSON summary it prints and the `--out` file. The file's text is that reviewer's findings, used verbatim, as data.
4. On `status` `not-installed`, `failed`, or `timeout`, run the role's Claude fallback instead, which never repeats a model already answering. On a pick-one role (`arena cross-judge pool`, `second opinion`) it is the first Claude entry in the line whose model differs from the parent's, else `sonnet xhigh` under an opus parent and `opus xhigh` under any other. On a fan-out role (`interrogate reviewers`, `reflect tooling`) it is a Claude model neither on the panel nor the parent's; with none left, the panel runs one reviewer short and says so. Write one line, `External reviewer <provider>:<model> unavailable: <status>. Used <fallback>.`
5. On `status` `violation`, keep the findings with care. The CLI changed files in its throwaway copy, and the integrity check found the user's repository unchanged. Say so in one line.
6. On `status` `breach`, stop and tell the user first. The user's checkout, refs, git config, or hooks changed during the run. Do not use the findings or commit until the user has looked.
7. Name the panel in the reply. "Cross-vendor panel (claude, codex)" is stronger evidence than "same-vendor panel (opus, sonnet)".

**pstack-ask contract.** The script runs one prompt through one vendor CLI and exits.

| Exit | `status` | Meaning |
| --- | --- | --- |
| 0 | `ok` | Output written to `--out`. |
| 1 | `failed` | The CLI exited non-zero or printed nothing. |
| 2 | `not-installed` | Unknown provider, or its binary is not on `PATH`. |
| 3 | `violation` | Output written, but the CLI changed files in its throwaway copy. The user's repository is unchanged. |
| 4 | `timeout` | The CLI ran past `--timeout` seconds (default 600). Its whole process group was killed. |
| 5 | `breach` | The user's checkout, refs, git config, or hooks changed during the run. Takes precedence over every other status. |
| 64 | `usage` | Bad arguments, a missing prompt file, or `--out` inside the repository. |

It always prints one JSON line with `provider`, `model`, `effort`, `status`, `exitCode`, `durationMs`, `out`, `isolated`, `violations`, `breach`, `verified`, and `note`. `node pstack-ask.mjs --detect` prints a JSON array of the installed CLIs, each `{ provider, binary, version, verified, readOnly }`. `--list` prints every configured provider the same way, without `version`.

`second opinion` is a pick-one pool: take the first entry from a different vendor than the parent, else the first with a different model, else the no-line rule. A budget change leaves external entries alone, because each vendor has its own effort scale. An external reviewer or judge gets the material it must judge pasted into its prompt, because its worktree holds only the repository, not transcripts or candidate folders.

Read-only has three layers, and only the first prevents writes everywhere.

1. The CLI's own read-only flag, passed by its command template. It is only as good as the template, so verify each one against the real CLI.
2. A throwaway copy. The CLI runs in an independent clone at `HEAD` with the user's uncommitted and untracked changes copied in, no remote, and no hooks, so git commands inside it cannot reach the user's repository. A write relative to its folder lands in the copy. A write by absolute path is not stopped. Its environment drops every `CLAUDE_`, `ANTHROPIC_`, and `GIT_` variable.
3. An integrity check. The user's `.git` (all but the object store), index, and working tree (ignored files excepted) are compared before and after. Any change is `breach`. It runs once, when the CLI exits, so a process that leaves the CLI's process group can write after it.

There is deliberately no OS sandbox (`sandbox-exec`, `bwrap`). The user chose on 2026-10-20 to keep three layers and document the gap rather than maintain per-vendor writable-path lists before any vendor CLI is installed. Revisit when the first real CLI is wired in.

A review first found that a linked `git worktree` let a CLI rewrite the user's config, tags, and hooks through the shared `.git`, which is why the copy is an independent clone. Outside a git repository the CLI runs in an empty temporary folder and sees only the prompt.

Command templates live in `scripts/providers.json` beside the script. `~/.claude/omc-pstack-fy/providers.json` overrides or adds providers per field. Every shipped template is marked `"verified": false` until someone runs it against the real CLI.

## Paths

| Cursor | omc-pstack-fy |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.claude/skills/`, `~/.claude/skills/` |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `~/.claude/plugins/cache/omc-pstack-fy/`, `.claude-plugin/plugin.json` |
| `.cursor/rules/*.mdc`, always-applied rule | `CLAUDE.md` (or `AGENTS.md` when no `CLAUDE.md` exists) for project rules. The model rule is the exception above. |
| `~/.cursor/projects/<slug>/agent-transcripts/<uuid>/<uuid>.jsonl` | `~/.claude/projects/<slug>/<session>.jsonl`. The slug is the workspace path with every character that is not a letter or digit changed to `-`. The newest `.jsonl` directly in the folder is the current session. Subagent transcripts are in `<session>/subagents/`. |
| other `~/.cursor/` paths, `~/Library/Application Support/Cursor` | the matching `~/.claude/` path. A step that inspects Cursor's own app data is skipped. |

Transcript lines are JSON objects with a `type`. A human message is `type: "user"` whose `message.content` is a string or a list of `{ "type": "text" }` blocks. A tool result is also `type: "user"`, with `tool_result` blocks, so it is not a human message. A `type: "user"` line with `isMeta: true` is an injected skill body, not a human message either. Assistant text is in `type: "assistant"` lines, in `text` blocks. Other types such as `attachment`, `system`, and `ai-title` are metadata.

## Cursor built-ins and other plugins

| Cursor | omc-pstack-fy |
| --- | --- |
| `deslop`, `control-ui`, `control-cli` from `cursor-team-kit` | bundled as `skills/deslop/`, `skills/control-ui/`, `skills/control-cli/`. Drop "install cursor-team-kit" advice. Other cursor-team-kit skills are not bundled. Drop their mention, or name the plain action. |
| `create-skill` | the `skill-creator` skill when the session lists it. Otherwise write `SKILL.md` with `name` and `description` frontmatter under `.claude/skills/<name>/`, or `~/.claude/skills/<name>/` for a personal skill. |
| Custom Mode, option+enter to keep a skill on | nothing to do. A loaded skill stays in context for the rest of the session. Compaction re-attaches only the start of each loaded skill, within a shared budget, so a long skill can lose its tail (per code.claude.com/docs/en/skills). Run the skill again after a compaction or in a new session. |
| Plan Mode | Claude Code's plan mode (shift+tab). |
| `/visualize`, the image generation tool | a Mermaid or text diagram |
| Cursor's built-in babysit skill | does not exist in Claude Code. Drop the disambiguation. |
| `/add-plugin pstack` | `/plugin marketplace add kaneyxx/omc-pstack-fy`, then `/plugin install omc-pstack-fy@omc-pstack-fy` |

## Cursor-only services

| Cursor | omc-pstack-fy |
| --- | --- |
| Bugbot, the agentic security review | review bots. On GitHub their comments are ordinary review threads from accounts such as `cursor[bot]` (Bugbot), `claude[bot]`, CodeRabbit, or Copilot. Keep the skeptical triage. A step that starts or configures Bugbot is skipped when the PR has no such bot. Naming Bugbot once as an example is fine, with an `allow` rule. |
| Cursor cloud agents, their dashboard | local subagents in worktrees. Check liveness with the agent's completion notification or its transcript, not a dashboard. |
| Cursor Automations, routines, webhooks | Claude Code `/schedule` runs cloud routines on a cron. Where a step only works with Automations, write one line, `Skipped in Claude Code: <step>. <reason>.`, and continue. |
| built-in PR tool | `gh pr create` and the other `gh` commands |
| a Cursor restart | a Claude Code restart or a new session |
