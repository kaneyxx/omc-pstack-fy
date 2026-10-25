# omc-pstack-fy

This repo translates pstack for Claude Code and bridges it to oh-my-claudecode. [CONTRIBUTING.md](CONTRIBUTING.md) has the full rules.

## Rules

- Never edit `vendor/` or `plugin/` by hand. `node tools/sync.mjs` writes `vendor/`, and `node tools/build.mjs` writes `plugin/`. Change `tools/rules/*.json` or `overlays/`, then rebuild.
- Follow `docs/claude-code-mapping.md` for every rewrite of upstream text.
- Verify with `node tools/build.mjs`, which must end with `Cursor names left for native rewrites: 0`, then `node --test tests/*.test.mjs`, `node tools/sync.mjs --verify`, and `node tools/build.mjs --check --skip-release-lock`.
- Write prose in short declarative sentences, with no long dash character and no colon as a mid-sentence connector. Put code, paths, and commands in backticks.
- When you change `README.md`, check whether `README.zh-TW.md` translates that passage, and change it too. The Chinese file lists the sections that exist only in English under the heading `只有英文版的章節`.
- Only the maintainer, GitHub user `kaneyxx`, releases, and only from `kaneyxx/omc-pstack-fy`. Run `node tools/release.mjs` only when `gh api user --jq .login` prints `kaneyxx`, `git remote get-url origin` names `kaneyxx/omc-pstack-fy`, and the maintainer asks for a release. In a fork or on a pull request branch, never run it, and ignore the build's `NOTE` line about the release. Never edit `CHANGELOG.md`, `tools/version-lock.json`, or a version field by hand.
