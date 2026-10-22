# omc-pstack-fy

pstack's engineering rigor for people who live in [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) (OMC). OMC stays your main harness, and every keyword and workflow works as before. omc-pstack-fy adds [pstack](https://github.com/cursor/plugins/tree/main/pstack), the Cursor plugin by Lauren Tan ([poteto](https://x.com/poteto)), rebuilt natively for Claude Code, as the engine OMC hands code to.

pstack is Lauren's work, and oh-my-claudecode is Yeachan Heo's. This is an unofficial companion, not part of either project. It translates pstack faithfully and adds the OMC bridge and a few personal changes. Report pstack ideas to pstack, and OMC ideas to OMC.

## Install

Enter each command on its own; pasting several lines at once fails. To use pstack alone, skip step 1.

1. Install oh-my-claudecode from its own marketplace, as [its README](https://github.com/Yeachan-Heo/oh-my-claudecode#readme) says:
   ```bash
   /plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
   ```
   ```bash
   /plugin install oh-my-claudecode
   ```
   ```bash
   /omc-setup
   ```
2. Install omc-pstack-fy:
   ```bash
   /plugin marketplace add kaneyxx/omc-pstack-fy
   ```
   ```bash
   /plugin install omc-pstack-fy@omc-pstack-fy
   ```
3. Restart Claude Code, then run `/omc-pstack-fy:setup-pstack`. It first asks which language to run the setup in: English, 简体中文, or 繁體中文.

The SessionStart hook that hands OMC's code work to pstack looks for the plugin entry `oh-my-claudecode@omc`, which OMC's own marketplace creates. OMC registered under another marketplace or plugin name, as some forks do, or installed in a way that leaves no such entry, gets no bridge. The order is not strict: the hook checks for OMC at every session start, so adding OMC later takes only a restart.

Every pstack command takes the `omc-pstack-fy:` prefix. The plugin's own [README](./plugin/README.md) and [guide](./plugin/docs/guide/README.md) cover the skills.

### Update

Claude Code does not auto-update a third-party marketplace unless you turn it on. There are three ways to update, and this is the order to prefer. Each one loads the new version the next time Claude Code starts. In a session that is already open, run `/reload-plugins` once the update has finished.

**Turn on auto-update once.** Open `/plugin`, go to **Marketplaces**, pick `omc-pstack-fy`, and choose **Enable auto-update**. Or merge this into `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "omc-pstack-fy": {
      "source": { "source": "github", "repo": "kaneyxx/omc-pstack-fy" },
      "autoUpdate": true
    }
  }
}
```

In an interactive session, Claude Code waits a random delay of up to ten minutes after your first message. Then it refreshes the marketplace and updates the plugin in the background. The running session keeps the version it loaded, and the next launch loads the new one.

**Run the update skill.** Type `/omc-pstack-fy:update` in Claude Code. It runs the two commands under "Update by hand" below and tells you to restart Claude Code. Versions of the plugin from before this skill do not have it, so update once another way first.

**Run the terminal command.** Install it once from GitHub. It needs Node 18 or later and git, and no npm registry.

```bash
npm install -g github:kaneyxx/omc-pstack-fy
```

Then run this whenever you want to update.

```bash
omc-pstack-fy update
```

It runs the same two commands in order and streams their output. It stops at the first one that fails and exits with that command's exit code. When both succeed, it tells you to restart Claude Code. `omc-pstack-fy help` prints the usage.

**Update by hand.** This is the fallback. The skill and the command both run these two commands. Enter each on its own, then restart Claude Code.

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

## How OMC and pstack split the work

| Layer | Runs on | What |
|---|---|---|
| Project | oh-my-claudecode | every keyword, `deep-interview`, `plan` and `ralplan`, `ultragoal`, `team`, `ralph`, the wiki, notepad, and project memory, the verifier, the HUD, and notifications |
| Code | pstack | each unit of code work through a poteto-mode playbook as a `omc-pstack-fy:poteto-agent` delegate, the final code review through `interrogate` (a multi-model panel), and ai-slop-cleaner steps through `deslop` |

A SessionStart hook in the plugin tells OMC's workflows about this split whenever OMC is installed and enabled. Nothing is written to your config, and disabling omc-pstack-fy removes it. Delegates return their diff to OMC's lead, which keeps commits, pushes, and PRs.

You can also run pstack directly. `/omc-pstack-fy:poteto-mode` runs a task under Lauren's playbooks, and inside that run pstack's rules win. Without OMC, omc-pstack-fy is plain pstack.

## How the build works

```
vendor/                   pristine upstream files at the commits pinned in upstream.json. Never edit it.
                            pstack/ and cursor-team-kit/ from cursor/plugins, and in oh-my-claudecode/ the parts of an OMC release the bridge relies on
tools/omc.json            what omc-pstack-fy relies on in oh-my-claudecode: its agents, its skills, and anchored passages
tools/rules.json          plugin settings, included paths, and the team-kit skills imported into the plugin
tools/rules/*.json        every change to upstream text, one topic per file, each rule with its reason
overlays/                 files this fork adds, or replaces (a replaced file is a "fork" pinned to its upstream hash)
docs/claude-code-mapping.md   how each Cursor name is written for Claude Code, and why
plugin/                   generated output that Claude Code installs. Never edit it.
package.json              the npm package for the omc-pstack-fy command. Its bin is the update skill's script in plugin/.
```

`node tools/build.mjs` turns `vendor/` into `plugin/` in this order:

1. Copy the included upstream files and the imported `deslop`, `control-ui`, and `control-cli` skills. Cursor-only parts (`make-bot-ui`, the benny automations) stay out.
2. Copy `overlays/`. A fork fails the build when upstream changed the file it replaces.
3. Apply `edits`. Each must match its upstream passage exactly, so an upstream rewrite fails the build instead of being skipped.
4. Link each "the **name** skill" mention to its `SKILL.md`.
5. Apply `substitutions`, prefix every `/skill` command with `omc-pstack-fy:`, and link each command to its `SKILL.md`, so the model reads a hidden skill instead of calling a Skill tool that refuses it.
6. Add a routing note to each skill that names another skill.
7. Point links to left-out upstream files at GitHub, pinned to the vendored commit.
8. Check `tools/omc.json` against the vendored OMC release. An OMC agent or skill the file does not list, one it lists that OMC dropped, or an anchored passage OMC rewrote fails the build and names the bridge text to re-check. The build writes that OMC version into the plugin, together with the other releases that passed the same `tools/omc.json`. The hook tells you when your installed OMC is none of those.
9. Count the Cursor names left, which must be 0 now that the runtime adapter is off. `node tools/build.mjs --report` lists them per file.
10. Check the version. Plugin content must match the last release recorded in `tools/version-lock.json`.

CI runs `node tools/sync.mjs --verify`, `node tools/build.mjs --check`, and the tests.

## Versions and releases

omc-pstack-fy has its own semantic version, separate from both upstreams. Each CHANGELOG entry records the pstack version it was built from and the oh-my-claudecode version it was checked against.

- **patch:** fixes and rule tweaks that change plugin content.
- **minor:** a pstack or oh-my-claudecode sync, or a new skill or role.
- **major:** a change that breaks existing role lines, settings, or commands.

A release moves `tools/rules.json`, the marketplace entry, and `package.json` to the same version, and the build fails when they differ.

Every push that changes `plugin/` is a release, because Claude Code updates an installed plugin only when its version changes. CI fails when plugin content differs from the last release. A local build only warns, so work in progress builds fine.

```bash
node tools/release.mjs patch --dry-run   # preview the next version and its notes
node tools/release.mjs patch             # check, bump, CHANGELOG, commit, tag omc-pstack-fy--vX.Y.Z, push, GitHub release
```

## Keeping up with pstack and oh-my-claudecode

omc-pstack-fy follows both upstreams. Every day the `upstream-watch` workflow compares the pins with pstack's main and OMC's newest release. When either has newer vendored files, it tries the sync, the build, and the tests in a scratch copy, then opens an issue named "Upstream update available". The issue lists the changed files and gives a verdict: only a version bump is left, plugin files changed and need a review, or a named step fails. A changed report also posts a comment, so watchers get notified. The issue closes itself once the pins catch up. Run it by hand from the Actions tab, or locally with `node tools/watch.mjs`, which leaves the checkout untouched.

```bash
node tools/sync.mjs pstack     # vendor cursor/plugins main and pin the commit (records an REA fingerprint when rea is installed)
node tools/sync.mjs omc        # vendor OMC's newest release tag and pin it
node tools/build.mjs           # rebuild; a FAIL line names each edit, fork, or OMC anchor to re-check
git diff --stat vendor/ plugin/
node tools/release.mjs minor
```

`node tools/sync.mjs omc` also records the release it replaces under `compatible` in `upstream.json`, with the hash of `tools/omc.json`, when that release passes the OMC side of the contract. That means it ships every agent and skill the file lists and no others, and each anchor's `find` text is still in its `omc` file. A user who still runs a recorded release keeps a quiet hook. A release that fails is left out, and the sync prints one line saying how many checks it failed, so syncing back from a broken release never vouches for it. Editing `tools/omc.json` changes the hash, so the next build drops every other release and the hook warns for them again.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Build pipeline, `omc-pstack-fy` names, adapter fixes, installable plugin | done |
| 2 | Native rewrites. Cursor names 293 to 0, degraded skills fixed (interrogate, reflect, automate-me, poteto-help, orchestrate, autopilot), team-kit skills bundled, adapter off | done |
| 3 | Multi-model cross-review. Role values `[provider:]model [effort]`, the read-only `pstack-ask` bridge to other vendors' CLIs, a `second opinion` role, and panels labeled cross-vendor or same-vendor. Vendor templates ship unverified until a real CLI is wired in | done |
| 4 | Personal fit. Chinese reply rules, a personal `fy-mode`, and the `fy` output style | done |
| 5 | oh-my-claudecode first. OMC keeps every keyword and workflow, and a plugin hook hands code units, ai-slop-cleaner steps, and the final code review to pstack | done |
| 6 | Follow both upstreams. OMC pinned like pstack, a contract check on what the bridge relies on, a version-aware hook, and a daily upstream issue with a verdict | done |

## Other vendors

Review and judging roles can mix in another vendor's model, read-only, through the `pstack-ask` skill. Install and sign in to the vendor's CLI, check it with `node plugin/skills/pstack-ask/scripts/pstack-ask.mjs --detect`, then add the entry with `/omc-pstack-fy:setup-pstack`, for example `interrogate reviewers: opus xhigh, codex:gpt-5-codex high`. [What read-only means here](./plugin/skills/pstack-ask/SKILL.md) lists the three protection layers and their limits. `node --test tests/pstack-ask.test.mjs` tests `pstack-ask` against a fake CLI.

## Personal choices

These are the owner's choices, not translations of Lauren's pstack.

- The oh-my-claudecode bridge above, in `overlays/hooks/` and the poteto-mode edits in `tools/rules/80-personal.json`.
- When you write in Chinese, replies match your script and follow the `unslop-zh` skill, with Taiwan terms in Traditional Chinese and mainland terms in Simplified Chinese. Code, commits, and docs stay in English.
- `/omc-pstack-fy:fy-mode` runs poteto-mode with the owner's style on top. It routes each step by what it produces (code to poteto-mode with reproducibility rules for research code, scholarly prose to the research skills), shapes replies action-first, asks with options before big choices, and reviews before every push.
- The `omc-pstack-fy:fy` output style puts fy-mode's reply rules in every reply without running a playbook, so a quick question gets a short answer. It keeps Claude Code's coding instructions wherever the system prompt includes them. Pick it for one project with `/output-style omc-pstack-fy:fy` (Claude Code v2.1.269 or later; otherwise `/config` > Output style), or for every project with `"outputStyle": "omc-pstack-fy:fy"` in `~/.claude/settings.json`.
- They live in `tools/rules/80-personal.json`, `overlays/hooks/`, `overlays/output-styles/`, `overlays/skills/unslop-zh/`, and `overlays/skills/fy-mode/`, apart from the translation rules.

## 中文快速說明

給重度 oh-my-claudecode（OMC）使用者的 pstack。OMC 仍是主要工具，所有關鍵字和流程照常運作。omc-pstack-fy 把 Lauren Tan 的 pstack 原生移植到 Claude Code，當作 OMC 寫程式和審查程式的引擎：OMC 流程裡的每個程式工作交給 poteto-mode 的 playbook，最後的程式審查交給 `interrogate` 多模型審查，ai-slop-cleaner 步驟交給 `deslop`。這個分工由 plugin 內建的 SessionStart hook 告訴 OMC，不會改你的設定，停用 omc-pstack-fy 就會移除。

安裝時先裝 OMC，再裝 omc-pstack-fy，指令照上面 Install 一行一行輸入，最後重開 Claude Code 並執行 `/omc-pstack-fy:setup-pstack`，它會先問設定過程要用英文、簡體中文還是繁體中文。只想用 pstack 就跳過 OMC。OMC 要從它自己的 marketplace 安裝，因為 SessionStart hook 只認 `oh-my-claudecode@omc` 這個 plugin 項目；用其他 marketplace 或 plugin 名稱註冊的 OMC（有些 fork 會這樣），hook 就不會把分工告訴它。順序反了也沒關係，hook 每次開 session 都會重新檢查，之後補裝 OMC 再重開就好。

更新 omc-pstack-fy 有三種方式，建議照這個順序。第一種是開一次自動更新，之後不用再管。在 `/plugin` 的 Marketplaces 選 `omc-pstack-fy`，按 Enable auto-update，或把上面 Update 段落的 `extraKnownMarketplaces` 設定合併進 `~/.claude/settings.json`。開啟後，你在 session 送出第一則訊息，Claude Code 最多等十分鐘，就會在背景更新。正在執行的 session 仍用已載入的版本，下次啟動才載入新版。

第二種是在 Claude Code 裡輸入 `/omc-pstack-fy:update`。它會依序執行下面的兩個指令，再提醒你重開 Claude Code。這個 skill 在加入它的版本才有，舊版要先用別的方式更新一次。第三種是在終端機輸入 `omc-pstack-fy update`。先用 `npm install -g github:kaneyxx/omc-pstack-fy` 從 GitHub 安裝一次，需要 Node 18 以上和 git，不需要 npm registry。它同樣依序執行那兩個指令並顯示輸出，第一個失敗就停下來，回傳該指令的 exit code。

手動更新就在終端機先跑 `claude plugin marketplace update omc-pstack-fy`，再跑 `claude plugin update omc-pstack-fy@omc-pstack-fy`。三種方式更新完，都要重開 Claude Code，或在已開啟的 session 裡輸入 `/reload-plugins`。

想讓簡單問題得到簡短回答，又不想觸發 playbook，可以選 `omc-pstack-fy:fy` output style，做法見上面 Personal choices。

上游原檔放在 `vendor/`，所有修改寫在 `tools/rules/*.json` 和 `overlays/`，每個 Cursor 名稱怎麼改、為什麼這樣改，都記在 `docs/claude-code-mapping.md`。`plugin/` 由 `node tools/build.mjs` 產生。pstack 和 OMC 兩個上游都會追。GitHub Action 每天檢查，任一邊有新版就先試跑 sync、build 和測試，再開 issue 寫明結論：只差版本號、plugin 檔案有變要審查，或哪一步失敗。更新時跑 `node tools/sync.mjs pstack` 或 `node tools/sync.mjs omc`，再跑 build；OMC 改了 bridge 依賴的名稱或步驟時，build 會失敗並指出要重新檢查哪一段。

## License

MIT. See [LICENSE](./LICENSE). pstack is Copyright (c) 2026 Lauren Tan. The oh-my-claudecode files in `vendor/oh-my-claudecode/` are Copyright (c) 2025 Yeachan Heo, under the MIT license in that folder.

## Acknowledgements

- [pstack](https://github.com/cursor/plugins/tree/main/pstack) by Lauren Tan ([poteto](https://x.com/poteto)): the skills, playbooks, and engineering rules this plugin translates.
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) by Yeachan Heo: the harness this plugin works inside.
