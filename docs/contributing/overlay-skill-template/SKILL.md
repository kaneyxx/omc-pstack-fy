---
name: example-skill
description: "Template for a new omc-pstack-fy skill. Replace this sentence with what the skill does and when to use it, with the words a user types, such as /example-skill or a request in plain words."
disable-model-invocation: true
---

# Example skill

This file is the overlay skill template from `docs/contributing/overlay-skill-template/`. Replace every paragraph below with the skill's own text before you open a pull request.

Say in one paragraph what the skill does and when to use it. The model reads this file as instructions, so write short declarative sentences and commands.

## Steps

1. Write each step as one command, such as "Read the diff."
2. Name another skill the way pstack does, such as "Apply the **unslop** skill to the reply." The build links that mention to the other skill's `SKILL.md`.
3. Say what the skill reports when it finishes.
