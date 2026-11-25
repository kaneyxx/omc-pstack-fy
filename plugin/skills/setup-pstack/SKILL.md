---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects the models and effort levels your Agent tool takes and writes a rule file that overrides the skill defaults. Use for /omc-pstack-fy:setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. The Skill tool may run another plugin's skill of that name, such as `oh-my-claudecode:<name>`, which is a different skill. Write `/omc-pstack-fy:<name>` only when the user should type it.

Write `~/.claude/rules/omc-pstack-fy-models.md`, a rule file that sets pstack's model and effort per role. Claude Code loads every rule file in `~/.claude/rules/` when a session starts, so every pstack skill sees it without being told where it lives. Step 10 offers a second rule file, `~/.claude/rules/omc-pstack-fy-delegates.md`, for people who use [`/omc-pstack-fy:fy-mode`](../fy-mode/SKILL.md).

## Steps

### 0. Pick a language

Before anything else, ask which language to run the setup in. Skip this step when the user's own messages already show English, Simplified Chinese, or Traditional Chinese, and use that one. A slash command alone shows no language. Prefer AskUserQuestion. Write the question in all three languages, as `Which language for setup? 选择设置语言 / 選擇設定語言`, with the header `Language` and exactly three options: `English`, `简体中文`, and `繁體中文`. Write every later question, option description, and message in the chosen language. Chinese follows the [**unslop-zh**](../unslop-zh/SKILL.md) skill, with mainland terms in Simplified Chinese and Taiwan terms in Traditional Chinese. Keep role labels, model aliases, effort levels, budget labels, provider names, commands, and paths as written, because the rule file and the skills read them in English. The rule file stays in English.

### 1. Detect available models

Read the `Agent` tool's schema in this session. That is the dependable source, because it lists exactly what a spawn accepts. Its `model` parameter lists the model aliases, such as `opus`, `sonnet`, `haiku`, and `fable`. Its `effort` parameter lists the effort levels, such as `low`, `medium`, `high`, `xhigh`, and `max`. The schema accepts any listed model with any listed effort. A Claude role value is `<model> <effort>`, such as `opus xhigh`, and a spawn passes the two words as `model` and `effort`. If you cannot read either list, ask the user to paste the models and effort levels their Agent tool takes. Never write a model or effort you have not confirmed. The alias `inherit` is always valid even though it is not a detected model.

The full role value grammar is `[<provider>:]<model> [<effort>]`. No provider means Claude, so every value above stays valid. A provider prefix names another vendor's CLI and a model it takes, such as `codex:gpt-5-codex high` or `gemini:gemini-2.5-pro`. The effort is optional there. Such an entry runs read-only through the [**pstack-ask**](../pstack-ask/SKILL.md) skill. An external entry may sit only on three roles, `interrogate reviewers`, `arena cross-judge pool`, and `second opinion`. Writing code, exploring with tools, and using MCP servers stay on Claude.

Then detect which other vendors' CLIs are installed. Run `node <omc-pstack-fy root>/skills/pstack-ask/scripts/pstack-ask.mjs --detect`, where `<omc-pstack-fy root>` is `../..` from this skill's base directory. It prints, as JSON, which configured CLIs are installed. Offer only those providers. If the command fails or the script is missing, offer no other vendor and say so. This skill cannot list a vendor's models, so the user types the model for an external entry.

### 2. Load current state

On a first run the model rule is missing, and the `~/.claude/rules/` folder often is too. That is normal, not an error. Check for the file with a command that exits 0 either way, such as `test -f ~/.claude/rules/omc-pstack-fy-models.md && echo present || echo missing`, and read it only when it is present. Do not check the folder, because step 5 creates it.

The default role-to-value mapping is the rule shape shown in step 5 below. If `~/.claude/rules/omc-pstack-fy-models.md` already exists, read it and treat its `# budget` line and its role values as the current choices. Otherwise start from those defaults. A line whose role is not in step 5, such as `architect runners`, `reflect tooling`, or `why investigators`, is from a retired role. Drop it. A `second opinion` line is a role, even though step 5 shows it commented out. A commented line sets nothing. Mark an external entry as needing a choice when its provider was not detected, or when its role is not one of the three that allow one.

A rule without the `# defaults: 3` line comes from an older setup. That setup wrote a line for every role, so some of its values are old defaults, not choices. Before step 3, replace these values:

- A `# budget: unlimited` line becomes `large`, because no role runs above `xhigh`.
- If the rule has no `# defaults: 2` line either, three more values are old defaults. A value matches whatever its effort, because the old budget step set every effort. A `sonnet` value in `feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`, or `swarm workers` takes the role's step 5 default. An `opus` value in `hardest tasks` takes the role's step 5 default. In a panel role (`arena runners`, `arena cross-judge pool`, `interrogate reviewers`), a list of exactly one `opus` entry and one `sonnet` entry, in either order, takes the role's step 5 list.

Every other value is the user's choice and stays, including a `sonnet` value in any other role, every `inherit` value, and every external entry. A `sonnet` entry in any other panel list stays too, because `sonnet` is still a default panel seat, and changing it could leave the panel with fewer distinct models. Tell the user which values you replaced.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer AskUserQuestion over free text. Offer these three options with these exact labels, and name the current budget when the rule records one. With no rule, say that `large` matches the skill defaults.

- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Apply it.** Build the working table from the skill defaults, and on a re-run keep any role you changed by model, list, or alias (`inherit`). Each role has a target effort, which is its default's effort moved by the budget. `large` keeps it, `medium` lowers it one step, and `small` lowers it two steps, on the ladder `xhigh` > `high` > `medium` > `low`. No role runs above `xhigh`, and a target at the bottom of the ladder stays there. Most defaults are at `xhigh`, and each budget label names where those land. `second opinion` has no default, so its target is the effort its budget label names. Set the effort of every `<model> <effort>` value in the role, panel entries included, to the role's target. If step 1 did not detect the target effort, use the highest detected effort below it, else mark the role as needing a choice. `inherit` does not change. An external entry does not change either, because each vendor sets its own effort scale. So `medium` turns `opus xhigh` into `opus high` and `opus high` into `opus medium`, and `small` turns them into `opus medium` and `opus low`.

**(c) Show the roles and confirm.** Show every role with its value, marking any model or effort not in the detected set as needing a choice. Also list each line step 2 dropped. Ask whether to accept as-is or change specific roles. For each role to change, offer the detected models plus `inherit` (this role runs on the parent chat model), then the effort, at `xhigh` or below. Prefer AskUserQuestion over free text. It takes at most four options per question, so offer the likeliest choices and accept a typed answer for the rest. For panel roles (arena runners, interrogate reviewers) the value is a list, and one subagent runs per entry, `inherit` entries included, so the list length sets the count. `arena cross-judge pool` is also a list, but Arena runs one judge, never on the parent's model. It tries values from another vendor first, then values on another Claude model, each in list order, so order the list by preference. Fable and the other Claude models are one vendor. An `inherit` value never judges. `second opinion` is a pool of the same kind. The show-me-your-work audit reviewer and the eval judge pick one entry from it. Its default is unset, so they keep their current rule, sonnet under an opus parent and opus otherwise. `swarm workers` is the default model for every worker unless a race or comparison assigns another model per arm.

For `interrogate reviewers`, `arena cross-judge pool`, and `second opinion`, also offer each provider step 1 detected as installed. Then ask the user to type the model, and an effort if they want one. Never offer a provider on any other role. If the user asks for one there, refuse, say that other vendors run read-only on these three review roles only, and ask again.

### 4. Validate

Every Claude value written must be `inherit` or a `<model> <effort>` pair whose model and effort step 1 detected, with the effort at `xhigh` or below. Every external entry must name a provider step 1 detected as installed, and sit on one of the three roles that allow one. Refuse an external entry on any other role. If a chosen value is not available or not allowed, stop and ask again.

### 5. Write the rule

Write `~/.claude/rules/omc-pstack-fy-models.md` as the `# defaults: 3` line, a `# budget` line with the chosen label and the effort that label names, then one line per role, using the same labels poteto-mode uses. Create `~/.claude/rules/` first if it is missing. Give the file no frontmatter, because a rule file without a `paths` field loads in every session. Overwrite the whole file so re-runs stay idempotent. Write `second opinion` commented out, as shown, unless the user set it. Shape:

```
# omc-pstack-fy model configuration. One line per role. Delete or comment out a line to fall back to the skill default.
# A value is `[<provider>:]<model> [<effort>]`. No provider means Claude, passed to the Agent tool as `model` and `effort`. A provider runs that vendor's CLI read-only through pstack-ask, on interrogate reviewers, arena cross-judge pool, and second opinion only.
# A value of `inherit` runs the role on the parent chat model (omit Agent `model`). `inherit` entries in a panel list still count toward its fan-out.
# defaults: 3
# budget: large (xhigh)
feature, refactoring: opus xhigh
bug-fix: opus xhigh
perf-issue: opus xhigh
hillclimb: opus xhigh
judgment and prose: opus xhigh
hardest tasks: fable xhigh
arena runners: fable high, opus high, sonnet high
arena cross-judge pool: fable high, opus high, sonnet high
swarm workers: opus high
interrogate reviewers: fable high, opus high, sonnet high
# second opinion: opus xhigh, codex:gpt-5-codex high
```

### 6. Confirm

Tell the user the rule was written and that it applies to new sessions, because Claude Code loads rule files when a session starts. Re-running this skill updates it. Then run step 10 and come back to step 7, because steps 7 and 8 can each start another skill that takes many turns. Step 10 runs once.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /omc-pstack-fy:create-verification-skill." On yes, read the [**create-verification-skill**](../create-verification-skill/SKILL.md) skill and follow it. The Skill tool refuses omc-pstack-fy skills, so reading the file is how you run it. On no, move on without pushing.

### 8. Offer a formal verification skill (optional)

Check whether the project already has a formal verification skill (a project skill that runs a model checker, a proof, or another verifier against the code). If not, offer once: "want a formal verification skill, so agents can prove a key property of your code holds in every case in scope, not only the cases tests reach? I can generate one with /omc-pstack-fy:create-formal-verification-skill." On yes, read the [**create-formal-verification-skill**](../create-formal-verification-skill/SKILL.md) skill and follow it, the same way as step 7. On no, move on without pushing.

### 9. The oh-my-claudecode bridge

Nothing to set up. While oh-my-claudecode is installed and enabled, omc-pstack-fy's SessionStart hook adds the bridge that hands its workflows' code units and deslop step to omc-pstack-fy and adds interrogate to their final code review, and disabling omc-pstack-fy removes it, so write no global config for it.

### 10. Offer the delegate rule (optional)

fy-mode's rules for delegates reach an `omc-pstack-fy:poteto-agent` delegate only when its brief names fy-mode's **For delegates** section. The rule file `~/.claude/rules/omc-pstack-fy-delegates.md` covers a brief that leaves the section out. An `omc-pstack-fy:poteto-agent` delegate loads the rule files its session loads, so it reads this one. The rule changes how every delegate works, and only people who use [`/omc-pstack-fy:fy-mode`](../fy-mode/SKILL.md) want that. So offer it, and write it only on a yes. Ask and report in the language from step 0. The rule file stays in English.

Check for the file the way step 2 checks the model rule. When it is present, read it and compare it with the text below. Line endings and a final newline do not count as a difference. If you compare with a command, use one that exits 0 either way. Prefer AskUserQuestion for each question.

- **Missing.** Say what the rule does in one or two sentences. It has every `omc-pstack-fy:poteto-agent` delegate read fy-mode's **For delegates** section and follow it, even when its brief does not name the section. Offer once to write it. On no, move on without pushing.
- **Present with exactly the text below.** Say it is current and move on.
- **Present with other text.** Show the difference and ask before you overwrite it. On no, leave the file as it is.

Write the file with no frontmatter and exactly this text, ending in one newline.

```
# omc-pstack-fy delegates

When your instructions include the heading `# Poteto subagent`, you are an `omc-pstack-fy:poteto-agent` delegate. Then, before any work, read the **For delegates** section of the fy-mode skill and follow it. Use `skills/fy-mode/SKILL.md` in the copy under `~/.claude/plugins/cache/omc-pstack-fy/` whose `.claude-plugin/plugin.json` has the highest semantic `version`. If that file has no **For delegates** section, ignore this rule. If your brief contradicts that section, follow your brief and name the conflict in your report.
```

After writing it, tell the user that it applies to new sessions.
