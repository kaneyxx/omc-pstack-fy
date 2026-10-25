## What changed

<!-- The rules, overlays, or scripts this pull request changes. -->

## Why

<!-- The problem it fixes, as a fact a reviewer can check. Link the issue when there is one. -->

## How I verified it

<!-- After each command, write the line that shows its result. -->

- `node tools/build.mjs`
- `node --test tests/*.test.mjs`
- `node tools/sync.mjs --verify`
- `node tools/build.mjs --check --skip-release-lock`

## Checklist

- [ ] One rule or one fix. Anything bigger than a rule edit links its issue.
- [ ] Every new or changed rule has a true `why`.
- [ ] No hand edits to `vendor/` or `plugin/`. `plugin/` comes from `node tools/build.mjs` and is committed with the change.
- [ ] No release. I did not run `tools/release.mjs` or change `CHANGELOG.md`, `tools/version-lock.json`, or a version field.
- [ ] No personal paths, email addresses, tokens, or other private data.
- [ ] A problem in upstream wording went to upstream, not into a rule.

See [CONTRIBUTING.md](https://github.com/kaneyxx/omc-pstack-fy/blob/main/CONTRIBUTING.md) and the [pull request example](https://github.com/kaneyxx/omc-pstack-fy/blob/main/docs/contributing/pull-request-example.md).
