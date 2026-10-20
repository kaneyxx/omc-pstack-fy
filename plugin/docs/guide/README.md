# The pstack guide

pstack works best when you stop micromanaging the agent. You describe what you want and how you'll know it's done. [`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) picks the playbook, runs the other skills as the steps need them, and shows you the evidence. This guide teaches that habit with realistic prompts.

Here's what you'll learn:

1. [Set up pstack](./01-setup.md). Install the plugin and pick your models.
2. [Route work through `/omc-pstack-fy:poteto-mode`](./02-poteto-mode.md). Give it a goal and watch it pick a playbook.
3. [Understand the code](./03-understand.md). A read-only investigation, then [`/omc-pstack-fy:how`](../../skills/how/SKILL.md), [`/omc-pstack-fy:why`](../../skills/why/SKILL.md), [`/omc-pstack-fy:teach`](../../skills/teach/SKILL.md), and [`/omc-pstack-fy:recall`](../../skills/recall/SKILL.md) before you edit anything.
4. [Design the change](./04-design.md). [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md), [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md), [`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md), [`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md), prototypes, and plans before code locks in a shape.
5. [Build and clean the change](./05-build-and-clean.md). The build playbooks, [`/omc-pstack-fy:tdd`](../../skills/tdd/SKILL.md), [`/omc-pstack-fy:unslop`](../../skills/unslop/SKILL.md), and [`/omc-pstack-fy:no-comments`](../../skills/no-comments/SKILL.md).
6. [Verify and ship](./06-verify-and-ship.md). Prove behavior on the real app, formally verify what tests rarely reach, vet numbers with [`/omc-pstack-fy:benchmark-checklist`](../../skills/benchmark-checklist/SKILL.md), then open a focused PR and drive it to merged.
7. [Run work while you sleep](./07-overnight.md). Trust before loops, an overnight contract, a decision log you can audit, and coordinator sessions and scheduled routines that scale past one agent.
8. [Steer with principle names](./08-principles.md). The 24 names that redirect an agent mid-task.
9. [Make it yours](./09-make-it-yours.md). Your own mode, [`/omc-pstack-fy:correct`](../../skills/correct/SKILL.md) for repeated mistakes, and how to test a skill change.
10. [Recipes and pitfalls](./10-recipes-and-pitfalls.md). Prompts to copy and mistakes to skip.

Read the pages in order the first time. After that, each page stands alone.

When you're stuck, or can't tell which skill fits, type [`/omc-pstack-fy:poteto-help`](../../skills/poteto-help/SKILL.md) with your question:

```text
/omc-pstack-fy:poteto-help which skill should i use to review this branch?
```

It answers, hands you a prompt to send, and links the skill or guide page the answer came from. It doesn't start the work, because a pstack run spends real tokens, so you send the prompt when you're ready. It runs only when you type it.

## If you only remember one thing

Give the agent a goal and a way to check it, in your own words:

```text
/omc-pstack-fy:poteto-mode the export writes duplicate rows when a retry lands mid-run. repro first, then fix and verify.
```

You don't need to name a playbook or list skills. "repro first" and a checkable outcome are all the routing signal [`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) needs. It matches the Bug fix playbook, copies the steps into a todo list, and calls the right skills as each step fires.

Next: [Set up pstack](./01-setup.md).
