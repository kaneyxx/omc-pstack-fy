#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { constants } from "node:os";

const PLUGIN = "omc-pstack-fy";
const STEPS = [
  ["plugin", "marketplace", "update", PLUGIN],
  ["plugin", "update", `${PLUGIN}@${PLUGIN}`],
];
const USAGE = `Usage: omc-pstack-fy <command>

Commands:
  update   Refresh the omc-pstack-fy marketplace, then update the plugin.
  help     Show this message.
`;

function update() {
  for (const args of STEPS) {
    const command = `claude ${args.join(" ")}`;
    console.log(`$ ${command}`);
    // npm installs claude as a .cmd shim on Windows, which Node spawns only through a shell. A shell takes one command string, not an args array.
    const result = process.platform === "win32" ? spawnSync(command, { stdio: "inherit", shell: true }) : spawnSync("claude", args, { stdio: "inherit" });
    if (result.error) {
      const missing = result.error.code === "ENOENT";
      console.error(missing ? "Update stopped. claude is not on your PATH. Put the Claude Code CLI on your PATH, then run this again." : `Update stopped. \`${command}\` could not run (${result.error.message}).`);
      return missing ? 127 : 126;
    }
    const code = result.status ?? 128 + constants.signals[result.signal];
    if (code !== 0) {
      console.error(`Update stopped. \`${command}\` exited with code ${code}.`);
      return code;
    }
  }
  console.log("Update finished. Restart Claude Code to load it, or run /reload-plugins in a session that is already open.");
  return 0;
}

const [command, ...rest] = process.argv.slice(2);
if (["help", "--help", "-h"].includes(command)) {
  process.stdout.write(USAGE);
} else if (command === "update" && rest.length === 0) {
  process.exitCode = update();
} else {
  if (command !== undefined) console.error(`Unknown command: ${[command, ...rest].join(" ")}\n`);
  process.stderr.write(USAGE);
  process.exitCode = 2;
}
