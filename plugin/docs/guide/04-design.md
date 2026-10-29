# Design before you write code

One attempt at a hard design locks in the first shape the model thought of. [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md) settles types and boundaries before implementation. [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md) runs several attempts at the same brief and merges the best parts. [`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md) has other models try to break the result. When the job is coverage rather than design synthesis, [`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md) fans out slices or races and aggregates their results.

The two most common design mistakes are taking the agent's first design and polishing a plan that no code has tested. This page fixes both. You plan through code. Prototypes answer the open questions, a README or tutorial sets the target, and the written plan comes last.

![Three robots draft competing bridge models at their own tables under /omc-pstack-fy:architect, /omc-pstack-fy:arena, and /omc-pstack-fy:interrogate panels, while a judge robot with a clipboard inspects skeptically.](./images/design.jpg)

## Settle the shape with [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md)

```text
/omc-pstack-fy:architect design the import pipeline before writing any code. i care most about how callers use it.
```

[`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md) grounds itself first, running [`/omc-pstack-fy:how`](../../skills/how/SKILL.md) over the code the design touches and [`/omc-pstack-fy:why`](../../skills/why/SKILL.md) when it moves ownership or layers. Then it runs [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md) to produce competing design sketches, with the caller's usage written first in each, followed by types, signatures, and a module map.

By default it proceeds straight from the synthesized design into implementation. If you want to see the design first, say so:

```text
/omc-pstack-fy:architect with checkpoint. stop and show me before implementing.
```

The design isn't sacred once code starts. If implementation shows the same workaround in unrelated places, or types that only compile with `any` or forced casts, [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md) treats that as proof the design is wrong. It scraps the sketch and starts over instead of patching around it.

## Fan out attempts with [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md)

```text
/omc-pstack-fy:arena take my prompt to the arena verbatim. i want to compare their proposals with yours.
```

[`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md) is the general tool underneath. N subagents attempt the same design or code brief in parallel, each writing to its own worktree or directory. A read-only judge on a model other than your chat's scores every candidate against a rubric. When no other model can run, the coordinator skips the judge and picks the base itself. The coordinator reads each candidate end to end, picks a base, grafts in the best ideas from the losers, and verifies the result.

```mermaid
flowchart LR
    A[One task] --> B[Configured panel]
    B --> C[Candidate 1]
    B --> D[Candidate 2]
    B --> E[Candidate N]
    C --> F[Cross-judge]
    D --> F
    E --> F
    F --> G[Pick a base]
    G --> H[Graft the best parts]
    H --> I[Verify]
```

The panel comes from your [`/omc-pstack-fy:setup-pstack`](../../skills/setup-pstack/SKILL.md) configuration, and you can adjust it per task. Ask for more candidates when the decision matters, fewer when it doesn't:

```text
/omc-pstack-fy:arena this, 5 candidates. the cache key format is expensive to change later.
```

## Cover slices and races with [`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md)

```text
/omc-pstack-fy:swarm check every package under packages/ against its check.sh. one worker per package. one report.
```

[`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md) fans N workers across independent slices, coverage matrices, gauntlet lanes, exploration partitions, or declared race arms. Each worker gets its own scope and check, then reports `PASS`, `ISSUES`, or `BLOCKED`. The parent waits for the workers and returns one compact report with any gaps or dropouts.

Reach for it when parallelism buys coverage or lets independent checks race. [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md) gives every worker the same design or code brief, then picks a base and grafts the best parts. [`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md) covers slices or runs a race with a selection rule declared up front. It does not use the base-selection and grafting ceremony.

## Break it with [`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md)

```text
/omc-pstack-fy:interrogate the whole branch, but skeptically. no nitpicks unless it's an actual bug or regression.
```

[`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md) gives the change and its intent to adversaries on the configured models, and each tries to break it with a run against the real code. Adversaries find different failures. The default panel pairs opus with sonnet, two Claude models, which share more blind spots than models from two vendors. A finding survives only when rerunning its command shows a failure that breaks the intent. The report lists every verified finding with the adversaries that found it, then what each adversary dropped and why, and applies nothing.

Read the Dropped list too. You can override the verdict.

## Prototype instead of debating

Never take the first design. Ask for a few, and pick from evidence you can see:

```text
/omc-pstack-fy:poteto-mode prototype a few options for the new dropdown menu. take screenshots or videos for me to compare.
```

The [Prototype playbook](../../skills/poteto-mode/playbooks/prototype.md) builds throwaway sketches in a scratch directory, puts the variants behind one switcher, drives each one, and captures screenshots or timings. It also works for behavior and algorithms, not just UI. Prototypes are planning with code. They let the agent answer its own open questions by running something instead of asking you, and they leave room for an option you wouldn't have thought of.

The same idea scales up to a real design. Pair [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md) with prototypes and keep a review gate:

```text
/omc-pstack-fy:poteto-mode we need rate limiting for external webhooks. /omc-pstack-fy:architect it first, and answer open questions with prototypes. let me review before proceeding.
```

Don't spend adversaries on an abstract plan. [`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md) drops every finding a run does not prove, so a plan with no code behind it gives them little to break. Let prototypes settle the questions, then review what got built.

## Write the README first for shared code

For a package or API that other code will use, start with the doc a user would read:

```text
/omc-pstack-fy:poteto-mode write a tutorial for how i would use the new config package first. then /omc-pstack-fy:teach me why it beats the current one.
```

Writing the tutorial first forces the caller's view. You describe the API to a hypothetical user and work back to the implementation. The doc also becomes a concrete target the agent checks its own work against. Name [`/omc-pstack-fy:technical-writing`](../../skills/technical-writing/SKILL.md) when the doc itself matters, so a tutorial stays a tutorial instead of drifting into reference and explanation at once.

## Plan after the design settles

pstack has no planning skill, on purpose. When you do want a written plan, ask for it once the design is settled:

```text
/omc-pstack-fy:poteto-mode turn this design into a plan. small verifiable PRs, each with its own verification steps.
```

The [Multi-phase plan playbook](../../skills/poteto-mode/playbooks/multi-phase-plan.md) settles any remaining open questions by prototype, then writes one section per PR, each ending in proof that the change works. A passing test suite alone doesn't count as that proof. The plan is the deliverable. The playbook doesn't implement it, and it names which execution playbook should run it next.

For a migration, state the bar in the prompt:

```text
/omc-pstack-fy:poteto-mode plan the migration of our ui library to the new styling system. small verifiable PRs, each with visual regression checks. the result must match the original exactly, bugs included.
```

"bugs included" keeps the migration from quietly fixing things on the way, which would make the old and new output impossible to compare. For a project that spans many days, you can commit the plan to the repo for a while so other agents see the work in progress. Delete it when the work lands.

## How much design work does a task deserve?

You might be wondering whether every change needs this. No. Most changes need none of it. A rough ladder:

- A small, finished change you're unsure about needs [`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md) alone.
- A change that crosses function boundaries or moves ownership earns [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md), which brings [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md) with it.
- A standalone decision where independent attempts would help, like naming, formats, or an algorithm, is [`/omc-pstack-fy:arena`](../../skills/arena/SKILL.md) directly.
- A coverage matrix, set of parallel checks, or race with declared arms is [`/omc-pstack-fy:swarm`](../../skills/swarm/SKILL.md).
- An open question you could answer by running something, like a layout, a timing, or an approach, gets a prototype, not a debate.
- A contested design that's expensive to reverse gets [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md), then [`/omc-pstack-fy:interrogate`](../../skills/interrogate/SKILL.md) before shipping.
- Work that spans several PRs gets a plan, written after the design settles.

[`/omc-pstack-fy:poteto-mode`](../../skills/poteto-mode/SKILL.md) already applies this ladder. Boundary-crossing work triggers [`/omc-pstack-fy:architect`](../../skills/architect/SKILL.md) on its own, so you reach for these directly mainly when you want more or less scrutiny than the default.

Next: [Build and clean the change](./05-build-and-clean.md).
