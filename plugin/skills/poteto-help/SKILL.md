---
name: poteto-help
description: Guides users through pstack setup, /omc-pstack-fy:poteto-mode, and picking the skill, playbook, or principle for a task. Type /omc-pstack-fy:poteto-help with a question.
disable-model-invocation: true
---

# Poteto help

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

Answer the user's question about pstack, hand them a prompt they can send, and link the file the answer came from. For a help question, don't start the work. The user asked how, and a pstack run spends real tokens, so let them send the prompt.

A message that asks for work, such as "use pstack to fix this bug", is not a help question. Read [`poteto-mode`](../poteto-mode/SKILL.md), do the work under it, and mention once that it stays loaded for the rest of the session and needs a fresh [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) after a compaction or in a new session.

This file maps questions to the skills and guide pages that hold the answers. Those files own the details. Read the file you route to before you quote it, and trust it when it disagrees with this map. The links here point into the installed plugin, which the user may not be able to open, so give the user the file's public copy: `https://github.com/kaneyxx/omc-pstack-fy/blob/main/plugin/` followed by its path.

## Find out what they need

Infer the need from the message and the conversation. A named situation, such as "which skill reviews a PR?", goes straight to its section. If the need is still unclear, ask one multiple-choice question with these options, then answer only the section they pick:

- Get set up
- Start a task with [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md)
- Pick a skill for a situation
- Fix a run that went wrong
- Make pstack my own

Check the state that changes the answer, and mention it only when it does:

- No `~/.claude/rules/omc-pstack-fy-models.md` means [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) hasn't run for this user, so every role uses its default model.
- No `verify-*` skill or other app harness in the project means agents have no scripted way to drive the app. Mention [`/omc-pstack-fy:create-verification-skill`](../create-verification-skill/SKILL.md) when the question is about proving a change works.
- No formal verification skill in the project means no property is checked past what tests reach. Mention [`/omc-pstack-fy:create-formal-verification-skill`](../create-formal-verification-skill/SKILL.md) when the question is about a race, an invariant, or another case tests rarely hit. When one exists and the code it covers changed after the commit it records as last in sync, mention [`/omc-pstack-fy:maintain-formal-verification-skill`](../maintain-formal-verification-skill/SKILL.md) if the question touches that code.

When the model rule is missing and it matters, ask whether the user wants to pick a model for each role and a reasoning budget now. It matters when the user is new, the question is about setup or cost, or the answer depends on which models run. Ask at most once per chat. If the need is also unclear, ask both questions together. Offer two choices:

- Now: give them [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) to type, and answer their question too.
- Later: answer their question, and add one line saying every role keeps its default model until they run [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md).

## Get set up

1. Install with `/plugin marketplace add kaneyxx/omc-pstack-fy`, then `/plugin install omc-pstack-fy@omc-pstack-fy`. Every command takes the `omc-pstack-fy:` prefix, such as [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md).
2. Run [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md). It asks for a reasoning budget, maps a model to each role, and writes a rule. Claude Code loads the rule when a session starts, so it applies to new sessions. Then it offers once each to generate a verification skill and a formal verification skill for the project, unless the project already has one.
3. Start a real task with [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md), a goal, and a check that can pass or fail.

Installing changes nothing until the user invokes a skill. Only [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) and the bundled [`/omc-pstack-fy:deslop`](../deslop/SKILL.md), [`/omc-pstack-fy:control-ui`](../control-ui/SKILL.md), and [`/omc-pstack-fy:control-cli`](../control-cli/SKILL.md) load from the user's words. The [README](../../README.md) and [guide page 1](../../docs/guide/01-setup.md) have the details. Offer to word their first prompt with them, per [`references/prompting.md`](references/prompting.md).

If cost is the worry, say where the tokens go and how to spend fewer. pstack spends extra tokens on subagents and review panels. Rerun [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) and pick a smaller budget or cheaper models. A role set to `inherit` runs on the session's model, which saves tokens when the session runs on a cheaper model. A shorter panel list runs fewer subagents, one for each entry. Save [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) for work that needs rigor.

omc-pstack-fy is a personal Claude Code build of pstack, the Cursor plugin by Lauren Tan. A step that needs a Cursor-only service, such as a webhook routine, is skipped with a one-line note.

Other tools can read the skills, because they use the Agent Skills format. But most workflow skills, including [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md), [`/omc-pstack-fy:how`](../how/SKILL.md), [`/omc-pstack-fy:why`](../why/SKILL.md), and [`/omc-pstack-fy:teach`](../teach/SKILL.md), spawn Claude Code subagents with per-role models, and `/loop` is a Claude Code command, so those parts may not work there.

## Start a task with [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md)

[`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) matches the task to a playbook, copies the playbook's steps into the todo list, and runs the other skills as the steps need them. A step it skips stays in the list as `skip: <reason>`. A good prompt states the goal and how to tell it's done. It doesn't list skills, because a hand-written sequence tends to drop or reorder steps the playbook would keep. Read [`references/prompting.md`](references/prompting.md) before you help word one. [Guide page 2](../../docs/guide/02-poteto-mode.md) has examples.

How long [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) stays on:

- Typing [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) loads the skill into the session. It stays in context on every later turn. There is no mode to switch on or off.
- A compaction keeps only the start of a long skill, or drops it, and a new session starts without it. Run [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) again after either one.

Link [Claude Code's skills docs](https://code.claude.com/docs/en/skills) when this comes up. Mid-session, "new task" makes the mode match a fresh playbook. [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) already uses `omc-pstack-fy:poteto-agent` for the subagents its playbook steps spawn. To get the same style from a subagent of your own, spawn it with `subagent_type: "omc-pstack-fy:poteto-agent"`.

## Pick a skill

The default answer is [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md), which runs most of the others when its steps need them. Name a skill directly when the user wants more or less of something than the playbook gives. Read the skill before you recommend it, and give one example prompt.

| The user wants to | Skill |
|---|---|
| Do any non-trivial task with rigor | [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) |
| Check that the agent understood their goal and the problem before it starts | [`/omc-pstack-fy:in-your-own-words`](../in-your-own-words/SKILL.md) |
| Get a prompt rewritten deeper, not bigger, before sending it: what a top professional would add, their raw material and methods, and an outside check. It returns the prompt and doesn't do the task | [`/omc-pstack-fy:sharpen`](../sharpen/SKILL.md) |
| Know how code works now, or where new code should live | [`/omc-pstack-fy:how`](../how/SKILL.md) |
| Know why code is shaped this way, or where a number came from | [`/omc-pstack-fy:why`](../why/SKILL.md) |
| Understand a change or subsystem, explained plainly | [`/omc-pstack-fy:teach`](../teach/SKILL.md) |
| Catch up on their own recent work on a topic | [`/omc-pstack-fy:recall`](../recall/SKILL.md) |
| Catch up on what changed in this chat since their last message, in plain words and small visuals, with every item waiting on them listed and decidable from the reply alone | [`/omc-pstack-fy:ketchup`](../ketchup/SKILL.md) |
| Catch up like [`/omc-pstack-fy:ketchup`](../ketchup/SKILL.md), in a short silent video of slides, with the waiting calls as text under it | [`/omc-pstack-fy:ketchup-video`](../ketchup-video/SKILL.md) |
| Know what a small diff could break outside itself | [`/omc-pstack-fy:blast-radius`](../blast-radius/SKILL.md) |
| Settle types and module shape before code that crosses a function boundary | [`/omc-pstack-fy:architect`](../architect/SKILL.md) |
| Get several attempts at one brief, merged into the best one | [`/omc-pstack-fy:arena`](../arena/SKILL.md) |
| Run parallel checks over slices, or race workers, each in its own worktree | [`/omc-pstack-fy:swarm`](../swarm/SKILL.md) |
| Have different models review a diff and try to break it | [`/omc-pstack-fy:interrogate`](../interrogate/SKILL.md) |
| Fix a bug test-first when a cheap local test exists | [`/omc-pstack-fy:tdd`](../tdd/SKILL.md) |
| Apply TypeScript rules to `.ts` or `.tsx` work | [`/omc-pstack-fy:typescript-best-practices`](../typescript-best-practices/SKILL.md) |
| Strip comments before review, using a reviewer that didn't write them | [`/omc-pstack-fy:no-comments`](../no-comments/SKILL.md) |
| Clean AI tells out of prose | [`/omc-pstack-fy:unslop`](../unslop/SKILL.md) |
| Write docs, an RFC, a README, a PR description, or a commit message to a standard | [`/omc-pstack-fy:technical-writing`](../technical-writing/SKILL.md) |
| Hear the last reply again in plain words | [`/omc-pstack-fy:bro`](../bro/SKILL.md) |
| Give agents a scripted way to drive the app and prove behavior | [`/omc-pstack-fy:create-verification-skill`](../create-verification-skill/SKILL.md) |
| Bring a verification skill and its feature map back in line with the app | [`/omc-pstack-fy:maintain-verification-skill`](../maintain-verification-skill/SKILL.md) |
| Formally verify a race, invariant, or other property that tests rarely reach | [`/omc-pstack-fy:create-formal-verification-skill`](../create-formal-verification-skill/SKILL.md) |
| Bring a formal verification back in line after the code it covers changed, and learn whether a failure is drift or a bug | [`/omc-pstack-fy:maintain-formal-verification-skill`](../maintain-formal-verification-skill/SKILL.md) |
| Show a PM or designer what the user sees as a chart checked by a TLA+ model, with the shortest path to each state that breaks a rule | [`/omc-pstack-fy:statechart`](../statechart/SKILL.md) |
| Vet a performance number before reporting or acting on it | [`/omc-pstack-fy:benchmark-checklist`](../benchmark-checklist/SKILL.md) |
| Run a large or cross-cutting change, or one to review after stepping away | [`/omc-pstack-fy:figure-it-out`](../figure-it-out/SKILL.md) |
| Keep a decision log during a run, and review it afterward | [`/omc-pstack-fy:show-me-your-work`](../show-me-your-work/SKILL.md) |
| Pick a model for each role and a reasoning budget | [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) |
| Turn their own working habits into a personal mode skill | [`/omc-pstack-fy:automate-me`](../automate-me/SKILL.md) |
| Turn what a finished task taught into skill edits | [`/omc-pstack-fy:reflect`](../reflect/SKILL.md) |
| Stop agents from repeating the same mistakes in this repo | [`/omc-pstack-fy:correct`](../correct/SKILL.md) |
| Find their way around pstack | [`/omc-pstack-fy:poteto-help`](SKILL.md) |

If a skill directory next to this one is missing from the table, read its frontmatter and route by its description. The `principle-*` directories are covered under principles below.

Close calls:

- [`/omc-pstack-fy:how`](../how/SKILL.md) explains what the code does. [`/omc-pstack-fy:why`](../why/SKILL.md) explains the reasons. [`/omc-pstack-fy:teach`](../teach/SKILL.md) runs one or both and explains the result plainly.
- [`/omc-pstack-fy:arena`](../arena/SKILL.md) gives every worker the same brief and merges the best parts. [`/omc-pstack-fy:swarm`](../swarm/SKILL.md) splits work into slices or a race and returns one report.
- [`/omc-pstack-fy:architect`](../architect/SKILL.md) implements right after it settles the design. Add "with checkpoint" to review the design before it writes code.
- [`/omc-pstack-fy:interrogate`](../interrogate/SKILL.md) reviews the diff. [`/omc-pstack-fy:blast-radius`](../blast-radius/SKILL.md) looks for breakage outside the diff and proves the one fact that makes the change safe.
- [`/omc-pstack-fy:recall`](../recall/SKILL.md) rebuilds context across recent chats. [`/omc-pstack-fy:ketchup`](../ketchup/SKILL.md) covers only this chat since the user's last message. Resuming one specific chat or branch is the Session pickup playbook.
- [`/omc-pstack-fy:figure-it-out`](../figure-it-out/SKILL.md) designs one rigorous run. The Orchestrate playbook runs a program that spans days and many PRs. The Autonomous run playbook drives one task to a finish condition.

Bundled with omc-pstack-fy, but not part of pstack:

- [`/omc-pstack-fy:deslop`](../deslop/SKILL.md) cleans AI slop out of the branch diff. [`/omc-pstack-fy:control-ui`](../control-ui/SKILL.md) and [`/omc-pstack-fy:control-cli`](../control-cli/SKILL.md) drive a web or Electron UI, or a CLI or TUI, to prove a change works. They come from another plugin in the same upstream repository, because [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) and its playbooks call them.

Not in pstack:

- `/loop` is a Claude Code command, and `skill-creator` is a separate skill for authoring skills.
- pstack has no `/orchestrate` skill. Orchestrate is a [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) playbook. If the slash menu shows `/orchestrate`, another plugin provides it.

## Playbooks and principles

Playbooks are step lists inside [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md), not skills, so they have no slash command. Inside [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md), describing the task picks one, and these phrases name one directly:

- "babysit this pr" or "check on pr 123" runs Babysit. It drives the PR to merge-ready and stops there. It doesn't merge unless the user asks to merge, land, or ship.
- "land the stack" runs Shipping.
- "take over this branch" runs Session pickup.
- "pause safely" runs Pause safely.
- "full autopilot on this queue" runs Autopilot-full. "stack them, don't ship" runs Autopilot-stack.
- "run the eval playbook" runs Eval.

The Playbooks section of [`poteto-mode`](../poteto-mode/SKILL.md) lists every playbook and when it applies. [Guide page 6](../../docs/guide/06-verify-and-ship.md) covers opening, babysitting, and landing a PR.

pstack has no planning skill. Claude Code's plan mode (shift+tab) works alongside it. For work that spans phases or stacked PRs, asking [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) for a plan runs the [Multi-phase plan playbook](../poteto-mode/playbooks/multi-phase-plan.md), which writes the plan and doesn't implement it. For a design question, the Prototype playbook or [`/omc-pstack-fy:architect`](../architect/SKILL.md) settles it in code first.

Principles are one-rule skills that [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) reads and cites in its replies. The user rarely invokes one. They steer with the names instead, as in "apply prove it works. show me the real output." Typing `/omc-pstack-fy:principle-<name>` still loads one on demand. [Guide page 8](../../docs/guide/08-principles.md) lists them.

## Fix a run that went wrong

| Symptom | Fix |
|---|---|
| The mode stopped applying after a few turns | A compaction cut the skill short, or this is a new session. Run [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) again. |
| A question got treated as the next step of the last task | Say "new task", or say the turn doesn't need the mode. |
| A new model choice had no effect | The rule from [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) loads when a session starts. Start a new one. |
| Runs cost more than expected | See the cost paragraph under Get set up. |
| A skill didn't load on its own | Only [`/omc-pstack-fy:setup-pstack`](../setup-pstack/SKILL.md) and the bundled [`/omc-pstack-fy:deslop`](../deslop/SKILL.md), [`/omc-pstack-fy:control-ui`](../control-ui/SKILL.md), and [`/omc-pstack-fy:control-cli`](../control-cli/SKILL.md) load from the user's words. The others load when the user types them or when [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md) runs them, and it doesn't run every skill. |
| Parallel agents overwrote each other | Give each agent its own worktree, with `isolation: "worktree"` on its `Agent` call. |
| An overnight run moved but finished nothing | `/loop` needs a check that can pass or fail, not a duration. See [guide page 7](../../docs/guide/07-overnight.md). |
| The reply claims success from a green build | Ask for the real command, flow, stored value, or profile. That's the prove-it-works principle. |

For a run that drifts, [`references/prompting.md`](references/prompting.md) has one-line steers. [Guide page 10](../../docs/guide/10-recipes-and-pitfalls.md) has more pitfalls and the recipes worth copying.

## Make pstack my own

- [`/omc-pstack-fy:automate-me`](../automate-me/SKILL.md) drafts a personal mode skill from the user's own history, to use alongside [`/omc-pstack-fy:poteto-mode`](../poteto-mode/SKILL.md).
- [`/omc-pstack-fy:reflect`](../reflect/SKILL.md) after a session turns its lessons into skill edits the user approves.
- `/omc-pstack-fy:poteto-mode write a skill for <workflow>` runs the authoring playbook. The eval playbook tests a skill change blind.
- Fix a misbehaving skill in its own PR, not inside the feature work where it went wrong.

[Guide page 9](../../docs/guide/09-make-it-yours.md) covers each of these.

## Reply

Lead with the answer. Give at most one example prompt in a code block, adapted from [`references/recipes.md`](references/recipes.md) when one fits, then the link to that file. Keep it short unless the user asked for the whole map.
