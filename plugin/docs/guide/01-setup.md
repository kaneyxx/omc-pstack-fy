# Set up pstack

In this page you install the plugin, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the plugin

Run `/plugin marketplace add kaneyxx/omc-pstack-fy`, then `/plugin install omc-pstack-fy@omc-pstack-fy`. Claude Code prefixes plugin commands with the plugin name, and every command in this guide already carries it, such as [`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md).

## Pick your models

Run:

```text
/omc-pstack-fy:setup-pstack
```

[`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. It writes `~/.claude/rules/omc-pstack-fy-models.md`, a small rule every pstack skill reads.

The defaults run at `xhigh` reasoning, the same as the `large` budget. `unlimited` lifts every role to `max`. `medium` and `small` lower the reasoning and spend fewer tokens.

You only override what you care about. A role with no line in the rule keeps the skill's default. To restore a default, delete that role's line. A rerun of [`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md) keeps any role whose model differs from the default. When a default changes, a rule written before the change still pins the old default, so delete those role lines, or delete the file, then run [`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md) again.

You might be wondering how to keep a role on your chat's own model. Set it to `inherit` and pstack omits the subagent `model` field, so the subagent inherits your parent chat model. `inherit` is not a model name. For a panel role the value is a list, and one subagent runs per entry, so the list length sets the panel size. Setup also configures `swarm workers`, the default model for every [`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md) worker unless a race names a model for each arm.

## Accept the verification offers, or don't

At the end of setup, [`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md) looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/omc-pstack-fy:create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.claude/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run [`/omc-pstack-fy:create-verification-skill`](../../skills/create-verification-skill/SKILL.md) yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers it in depth.

If you're new to pstack, say yes. An agent that can check its own work keeps going until the check passes. An agent that can't hands every result back to you to check by hand. Of everything in this guide, the verification skill pays off the most.

Then setup offers once to generate a formal verification skill with [`/omc-pstack-fy:create-formal-verification-skill`](../../skills/create-formal-verification-skill/SKILL.md), unless the project already has one. Tests check the cases someone thought to write. A formal verification skill checks one key property of your code, such as "a job never runs twice at once", in every case within a stated scope. Say yes when your code has concurrency, retries, a state machine, or a parser, where a bug is costly and tests rarely reach the case that breaks. Otherwise say no, and run it later if that changes. [Verify and ship](./06-verify-and-ship.md#prove-a-property-with-a-formal-verification-skill) covers it.

After setup, start a new chat. The model rule applies to new sessions.

## Keep the cost in check

pstack spends extra tokens on subagents and review panels. That's the price of the rigor. To spend fewer:

- Rerun [`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md) and pick a smaller reasoning budget or cheaper models. A strong model in the main chat with cheaper, faster models in the code roles is a good split.
- Set a role to `inherit` so it runs on the chat's own model.
- Shorten a panel list. Each entry runs one subagent.
- Save [`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) for work that needs rigor. A small, obvious edit doesn't.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/omc-pstack-fy:poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If [`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. [`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) stays on for the whole chat, because a loaded skill stays in context for the rest of the session. Compaction keeps only the start of a long skill, so run [`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) again after a compaction or in a new session.

Next: [Route work through `/omc-pstack-fy:poteto-mode`](./02-poteto-mode.md).
