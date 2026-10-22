---
name: update
description: Update omc-pstack-fy to its newest version. Refreshes the marketplace, updates the plugin, and tells you to restart Claude Code.
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_SKILL_DIR}/scripts/omc-pstack-fy.mjs" update)
---

# Update omc-pstack-fy

Claude Code already ran this skill's update script, and its output replaces the block below. The script refreshes the omc-pstack-fy marketplace, then updates the plugin. It stops at the first command that fails.

```!
node "${CLAUDE_SKILL_DIR}/scripts/omc-pstack-fy.mjs" update || true
```

Report the result in the user's language, in a few short sentences.

- If the plugin updated, say which version it moved from and to, as the output states them.
- If the plugin was already current, say so and give the version.
- If the last line starts with `Update stopped.`, report the failing command and its error. If the output is anything other than update output, say the update did not run and quote what it shows. Run nothing yourself.

Unless the update failed, end by telling the user to restart Claude Code, or to run `/reload-plugins` to load the update in this session. Tell them even when the plugin was already current, because a running session keeps the version it loaded at start.
