---
name: architect
description: "Sketch types, signatures, and module structure before code, then stay in the loop while implementation fills in. Use for /omc-pstack-fy:architect, 'architect this', 'design this', or non-trivial work where jumping to code would lock in the wrong shape."
disable-model-invocation: true
---

# Architect

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. The Skill tool may run another plugin's skill of that name, such as `oh-my-claudecode:<name>`, which is a different skill. Write `/omc-pstack-fy:<name>` only when the user should type it.

Before writing code, trace every system the change touches, then sketch two different shapes for it (types, signatures, module boundaries) and pick the one where each piece of state has one owner, each task has one way to do it, and callers need to know least. Redesign instead of patching if workarounds repeat.

For a large or contested design, run the [**arena**](../arena/SKILL.md) skill instead of sketching alone.
