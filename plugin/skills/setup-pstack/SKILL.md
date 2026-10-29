---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects the models and effort levels your Agent tool takes and writes a rule file that overrides the skill defaults. Use for /omc-pstack-fy:setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

Write `~/.claude/rules/omc-pstack-fy-models.md`, a rule file that sets pstack's model and effort per role. Claude Code loads every rule file in `~/.claude/rules/` when a session starts, so every pstack skill sees it without being told where it lives.

## Steps

### 0. Pick a language

Before anything else, ask which language to run the setup in. Skip this step when the user's own messages already show English, Simplified Chinese, or Traditional Chinese, and use that one. A slash command alone shows no language. Prefer AskUserQuestion. Write the question in all three languages, as `Which language for setup? 选择设置语言 / 選擇設定語言`, with the header `Language` and exactly three options: `English`, `简体中文`, and `繁體中文`. Write every later question, option description, and message in the chosen language. Chinese follows the [**unslop-zh**](../unslop-zh/SKILL.md) skill, with mainland terms in Simplified Chinese and Taiwan terms in Traditional Chinese. Keep role labels, model aliases, effort levels, budget labels, provider names, commands, and paths as written, because the rule file and the skills read them in English. The rule file stays in English.

### 1. Detect available models

Read the `Agent` tool's schema in this session. That is the dependable source, because it lists exactly what a spawn accepts. Its `model` parameter lists the model aliases, such as `opus`, `sonnet`, `haiku`, and `fable`. Its `effort` parameter lists the effort levels, such as `low`, `medium`, `high`, `xhigh`, and `max`. The schema accepts any listed model with any listed effort. A Claude role value is `<model> <effort>`, such as `opus xhigh`, and a spawn passes the two words as `model` and `effort`. If you cannot read either list, ask the user to paste the models and effort levels their Agent tool takes. Never write a model or effort you have not confirmed. The alias `inherit` is always valid even though it is not a detected model.

The full role value grammar is `[<provider>:]<model> [<effort>]`. No provider means Claude, so every value above stays valid. A provider prefix names another vendor's CLI and a model it takes, such as `codex:gpt-5-codex high` or `gemini:gemini-2.5-pro`. The effort is optional there. Such an entry runs read-only through the [**pstack-ask**](../pstack-ask/SKILL.md) skill. An external entry may sit only on four roles, `interrogate reviewers`, `arena cross-judge pool`, `reflect tooling`, and `second opinion`. Writing code, exploring with tools, and using MCP servers stay on Claude.

Then detect which other vendors' CLIs are installed. Run `node <omc-pstack-fy root>/skills/pstack-ask/scripts/pstack-ask.mjs --detect`, where `<omc-pstack-fy root>` is `../..` from this skill's base directory. It prints, as JSON, which configured CLIs are installed. Offer only those providers. If the command fails or the script is missing, offer no other vendor and say so. This skill cannot list a vendor's models, so the user types the model for an external entry.

### 2. Load current state

The default role-to-value mapping is the rule shape shown in step 5 below. If `~/.claude/rules/omc-pstack-fy-models.md` already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from those defaults. A line whose role is not in step 5, such as `how critics`, is from a retired role. Drop it. A `second opinion` line is a role, even though step 5 shows it commented out. A commented line sets nothing. Mark an external entry as needing a choice when its provider was not detected, or when its role is not one of the four that allow one.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer AskUserQuestion over free text. Offer these four options with these exact labels, and name the current budget when the rule records one. With no rule, say that `large` matches the skill defaults.

- `unlimited — max reasoning`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Build the working table from the skill defaults, and on a re-run keep any role you changed by model, list, or alias (`inherit`). `unlimited`, `large`, `medium`, and `small` set the effort of every `<model> <effort>` value, panel entries included, to `max`, `xhigh`, `high`, or `medium`. The ladder is `max` > `xhigh` > `high` > `medium` > `low`. If step 1 did not detect the target effort, use the highest detected effort below it, else mark the role as needing a choice. `inherit` does not change. An external entry does not change either, because each vendor sets its own effort scale. So `unlimited` turns `opus xhigh` into `opus max` and `sonnet xhigh` into `sonnet max`. `large` keeps both defaults. `small` turns them into `opus medium` and `sonnet medium`.

**(c) Show the roles and confirm.** Show every role with its value, marking any model or effort not in the detected set as needing a choice. Also list each line step 2 dropped. Ask whether to accept as-is or change specific roles. For each role to change, offer the detected models plus `inherit` (this role runs on the parent chat model), then the effort. Prefer AskUserQuestion over free text. It takes at most four options per question, so offer the likeliest choices and accept a typed answer for the rest. For panel roles (arena runners, architect runners, interrogate reviewers) the value is a list, and one subagent runs per entry, `inherit` entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena runs one judge, never on the parent's model. It tries values from another vendor first, then values on another Claude model, each in list order, so order the list by preference. An `inherit` value never judges. `second opinion` is a pool of the same kind. The show-me-your-work audit reviewer and the eval judge pick one entry from it. Its default is unset, so they keep their current rule, sonnet under an opus parent and opus otherwise. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

For `interrogate reviewers`, `arena cross-judge pool`, `reflect tooling`, and `second opinion`, also offer each provider step 1 detected as installed. Then ask the user to type the model, and an effort if they want one. Never offer a provider on any other role. If the user asks for one there, refuse, say that other vendors run read-only on these four review roles only, and ask again.

### 4. Validate

Every Claude value written must be `inherit` or a `<model> <effort>` pair whose model and effort step 1 detected. Every external entry must name a provider step 1 detected as installed, and sit on one of the four roles that allow one. Refuse an external entry on any other role. If a chosen value is not available or not allowed, stop and ask again.

### 5. Write the rule

Write `~/.claude/rules/omc-pstack-fy-models.md` as a `# budget` line with the chosen label and its target effort, then one line per role, using the same labels poteto-mode uses. Create `~/.claude/rules/` first if it is missing. Give the file no frontmatter, because a rule file without a `paths` field loads in every session. Overwrite the whole file so re-runs stay idempotent. Write `second opinion` commented out, as shown, unless the user set it. Shape:

```
# omc-pstack-fy model configuration. One line per role. Delete or comment out a line to fall back to the skill default.
# A value is `[<provider>:]<model> [<effort>]`. No provider means Claude, passed to the Agent tool as `model` and `effort`. A provider runs that vendor's CLI read-only through pstack-ask, on interrogate reviewers, arena cross-judge pool, reflect tooling, and second opinion only.
# A value of `inherit` runs the role on the parent chat model (omit Agent `model`). `inherit` entries in a panel list still count toward its fan-out.
# budget: large (xhigh)
feature, refactoring: sonnet xhigh
bug-fix: sonnet xhigh
perf-issue: sonnet xhigh
hillclimb: sonnet xhigh
judgment and prose: opus xhigh
hardest tasks: opus xhigh
how explorer: sonnet xhigh
how explainer: opus xhigh
why investigators: sonnet xhigh
why synthesizer: opus xhigh
reflect tooling: sonnet xhigh
reflect judgment, divergent, synthesizer: opus xhigh
arena runners: opus xhigh, sonnet xhigh
arena cross-judge pool: opus xhigh, sonnet xhigh
swarm workers: sonnet xhigh
architect runners: opus xhigh, sonnet xhigh
interrogate reviewers: opus xhigh, sonnet xhigh
# second opinion: opus xhigh, codex:gpt-5-codex high
```

### 6. Confirm

Tell the user the rule was written and that it applies to new sessions, because Claude Code loads rule files when a session starts. Re-running this skill updates it.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /omc-pstack-fy:create-verification-skill." On yes, read the [**create-verification-skill**](../create-verification-skill/SKILL.md) skill and follow it. The Skill tool refuses omc-pstack-fy skills, so reading the file is how you run it. On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /omc-pstack-fy:create-formal-verification-skill." On yes, read the [**create-formal-verification-skill**](../create-formal-verification-skill/SKILL.md) skill and follow it, the same way as step 7. On no, move on without pushing.

### 9. The oh-my-claudecode bridge

Nothing to set up. While oh-my-claudecode is installed and enabled, omc-pstack-fy's SessionStart hook adds the bridge that hands its workflows' code units and deslop step to omc-pstack-fy and adds interrogate to their final code review, and disabling omc-pstack-fy removes it, so write no global config for it.
