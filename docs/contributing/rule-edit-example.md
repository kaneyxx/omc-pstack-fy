# Rule edit example

This page walks through one real edit from `tools/rules/10-naming.json`. Use it as the model for your own edit.

## The edit

Upstream pstack's README tells contributors how cursor/plugins regenerates its own Claude Code copy. That paragraph is wrong in omc-pstack-fy, which has its own build. This edit replaces it:

```json
    {
      "file": "README.md",
      "find": "claude code installs a generated copy of pstack, including this readme and the guide, from [`harness/pstack/`](https://github.com/cursor/plugins/tree/main/harness/pstack) at the repository root. after you change pstack, run `node scripts/generate-pstack-harness-trees.mjs` from the repository root and commit the result. ci fails while the generated copy is out of date.",
      "replace": "omc-pstack-fy is generated from a pinned upstream commit by `node tools/build.mjs` in [kaneyxx/omc-pstack-fy](https://github.com/kaneyxx/omc-pstack-fy). edit the rules or overlays there, never this folder.",
      "why": "The upstream paragraph describes cursor/plugins' generator, which this build does not use."
    }
```

## Why each field looks the way it does

`file` is the path the file has in `plugin/`. For a pstack file, that is also its path under `vendor/pstack/`. Here `README.md` is `vendor/pstack/README.md`, the README that ships inside the plugin, not the README at the root of this repo.

`find` is one exact passage of upstream text, copied byte for byte from the vendored file. It must match exactly once, unless the edit sets a `count`. It covers the whole paragraph that is wrong and nothing more. A shorter `find` can start to match a second passage after an upstream change. A longer one breaks on upstream changes that have nothing to do with the edit. A `find` that spans lines writes each newline as `\n` in the JSON, as `"# pstack\n\ni'm [poteto]"` in `tools/rules/10-naming.json` does.

`replace` is the text that ships. It keeps upstream's lowercase voice, as rule 1 of [the Claude Code mapping](../claude-code-mapping.md#rules-for-rewriting) asks. It states what this build does instead, as rule 4 asks, and it never compares Cursor with Claude Code.

`why` names the fact that makes the upstream text wrong here. The next section says what makes a `why` strong.

Put the edit in the rules file whose `about` field names its topic. The build applies the files in `tools/rules/` in file-name order.

## How the build fails when upstream rewords the passage

The build counts the matches of `find` in the target file. Any count other than the expected one stops the build before it writes `plugin/`. Here is what the build printed when "this readme" became "the readme" in a scratch copy of `vendor/pstack/README.md`:

```
FAIL edit in README.md (tools/rules/10-naming.json) expected 1 match of "claude code installs a generated copy of pstack, including this readme", found 0
```

The line names the target file, the rules file, and the start of the `find` text. When a sync brings in a reworded passage, the line shows exactly which rule to re-check. A fuzzy match would keep rewriting text it was never written for, and nobody would see it.

## Write a why that a reviewer can check

A strong `why` states a fact about Claude Code or about this build that a reviewer can confirm, and says how that fact makes the upstream text wrong. When upstream changes the passage, the next person reads the `why` to decide whether the rule still applies.

The `why` above passes that test. It names what the upstream paragraph describes, the cursor/plugins generator. It names a fact a reviewer can check, that `node tools/build.mjs` does not use that generator. If this build ever adopted the generator, the same `why` would tell the next person to delete the edit.

A strong `why` can be short. The `why` "make-bot-ui is excluded." in `tools/rules/30-excluded.json` has three words, and a reviewer confirms it in the `exclude` list of `tools/rules.json`.

These are weak:

| Weak `why` | What is missing |
| --- | --- |
| "Update the README." | It restates the edit and gives no reason to check. |
| "Cursor-specific." | It says the text is about Cursor, but not what is wrong in Claude Code or what replaces it. |
| "Reads better." | A wording preference is upstream's call. Report it upstream instead of adding a rule. |

## Use the lightest tool that fits

Rule 2 of the mapping orders the tools from lightest to heaviest. A global substitution comes first, but only for a mapping that is right in every context, such as the ones in `tools/rules/40-core.json`. It runs on every Markdown file in the plugin that its rules file does not list under `except`. An edit like the one above comes next. A fork comes last, because it replaces a whole file and pins the upstream hash, as [the overlay skill template](overlay-skill-template/README.md#replace-an-upstream-file-instead) shows. Fork only when edits would rewrite most of the file.
