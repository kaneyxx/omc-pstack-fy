# omc-pstack-fy

[English](README.md) | 繁體中文

omc-pstack-fy 把 pstack 嚴謹的工程做法帶給重度 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)（OMC）使用者。OMC 仍是你的主要工具，所有關鍵字和流程照常運作。[pstack](https://github.com/cursor/plugins/tree/main/pstack) 是 Lauren Tan（[poteto](https://x.com/poteto)）寫的 Cursor plugin。omc-pstack-fy 把它原生移植到 Claude Code，當作 OMC 處理程式工作的引擎。

pstack 是 Lauren 的作品，oh-my-claudecode 是 Yeachan Heo 的作品。這個專案是非官方的搭配套件，不屬於這兩個專案。它忠實翻譯 pstack，另外加上 OMC 橋接和幾項個人調整。對 pstack 有想法就回報給 pstack，對 OMC 有想法就回報給 OMC。

## 安裝

每個指令都要單獨輸入。一次貼上好幾行會失敗。只想用 pstack 的話，跳過步驟 1。

1. 依照 [OMC 的 README](https://github.com/Yeachan-Heo/oh-my-claudecode#readme)，從 OMC 自己的 marketplace 安裝 oh-my-claudecode：
   ```bash
   /plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
   ```
   ```bash
   /plugin install oh-my-claudecode
   ```
   ```bash
   /omc-setup
   ```
2. 安裝 omc-pstack-fy：
   ```bash
   /plugin marketplace add kaneyxx/omc-pstack-fy
   ```
   ```bash
   /plugin install omc-pstack-fy@omc-pstack-fy
   ```
3. 重開 Claude Code，再執行 `/omc-pstack-fy:setup-pstack`。它會先問設定過程要用英文、簡體中文還是繁體中文。

把 OMC 的程式工作交給 pstack 的是一個 SessionStart hook。它只認 `oh-my-claudecode@omc` 這個 plugin 項目，這個項目由 OMC 自己的 marketplace 建立。有些 fork 會用其他 marketplace 或 plugin 名稱註冊 OMC。這樣註冊的 OMC，hook 不會把它的程式工作交給 pstack。裝完沒有留下這個項目的 OMC 也一樣。安裝順序反了也沒關係。hook 每次 session 開始都會檢查 OMC，所以之後補裝 OMC，重開 Claude Code 就好。

每個 pstack 指令都要加上 `omc-pstack-fy:` 前綴。各個 skill 的說明見 plugin 自己的英文 [README](./plugin/README.md) 和[使用指南](./plugin/docs/guide/README.md)。

### 更新

除非你自己開啟，Claude Code 不會自動更新第三方 marketplace。更新有三種方式，另外還有手動更新可以備用。建議照下面的順序選。不論用哪一種，新版都會在下次啟動 Claude Code 時載入。在已經開著的 session 裡，等更新完成後輸入 `/reload-plugins`。

**開啟一次自動更新**。打開 `/plugin`，進入 **Marketplaces** 後選 `omc-pstack-fy`，再選 **Enable auto-update**。也可以把下面這段合併進 `~/.claude/settings.json`：

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

在互動式 session 裡，你送出第一則訊息後，Claude Code 會隨機等待最多十分鐘。接著它在背景重新整理 marketplace 並更新 plugin。執行中的 session 繼續用已載入的版本，下次啟動才會載入新版。

**執行 `update` skill**。在 Claude Code 裡輸入 `/omc-pstack-fy:update`。它會執行下面「手動更新」裡的兩個指令，再提醒你重開 Claude Code。加入這個 skill 之前的 plugin 版本沒有它，所以舊版要先用別的方式更新一次。

**執行終端機指令**。用 npx 直接從 GitHub 執行。它需要 Node 18 以上和 git，不會在全域安裝任何東西。

```bash
npx -y github:kaneyxx/omc-pstack-fy update
```

想改打 `omc-pstack-fy update` 的話，把下面這行 `alias` 加進 `~/.zshrc` 或 `~/.bashrc`：

```bash
alias omc-pstack-fy='npx -y github:kaneyxx/omc-pstack-fy'
```

它會依序執行同樣那兩個指令，並即時顯示輸出。遇到第一個失敗的指令，它就停下來，並以那個指令的 exit code 結束。兩個都成功時，它會提醒你重開 Claude Code。`omc-pstack-fy help` 會顯示用法。不要從 npm registry 安裝 `omc-pstack-fy`，因為那個名稱不屬於這個專案。

**手動更新**。這是備用做法。`update` skill 和終端機指令執行的都是這兩個指令。在終端機一次輸入一個，執行完再重開 Claude Code。

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

## OMC 和 pstack 怎麼分工

| 層 | 交給 | 負責什麼 |
|---|---|---|
| 專案 | oh-my-claudecode | 所有關鍵字、`deep-interview`、`plan` 和 `ralplan`、`ultragoal`、`team`、`ralph`、wiki、notepad、project memory、verifier、HUD，以及通知 |
| 程式 | pstack | 每個程式工作單元由 `omc-pstack-fy:poteto-agent` 子代理照 poteto-mode 的 playbook 執行。最後的程式審查交給 `interrogate`（多模型審查小組），ai-slop-cleaner 步驟交給 `deslop` |

只要 OMC 已安裝並啟用，plugin 內建的 SessionStart hook 就會把這個分工告訴 OMC 的流程。這個 hook 不會寫入你的設定，停用 omc-pstack-fy 就會移除這個分工。子代理把 diff 交回 OMC 的主代理，commit、push 和 PR 仍由主代理負責。

你也可以直接執行 pstack。`/omc-pstack-fy:poteto-mode` 會用 Lauren 的 playbook 執行一個任務。在這次執行裡，pstack 的規則優先。沒有 OMC 時，omc-pstack-fy 就是單純的 pstack。

## 個人選擇

下面這些是維護者自己的選擇，不是從 Lauren 的 pstack 翻譯來的。

- 上面的 oh-my-claudecode 橋接。它由 `overlays/hooks/` 和 `tools/rules/80-personal.json` 裡對 poteto-mode 的修改組成。
- 你用中文寫訊息時，回覆會配合你用繁體或簡體，並遵守 `unslop-zh` skill。繁體中文用台灣用語，簡體中文用中國大陸用語。程式碼、commit 和文件仍維持英文。
- `/omc-pstack-fy:fy-mode` 在 poteto-mode 上再套用維護者自己的風格。它依每個步驟的產出分派工作。程式碼交給 poteto-mode，研究用的程式碼另外要符合可重現性規則。學術文字交給研究類的 skill。回覆的第一行就是下一步行動或答案。遇到重大選擇，它會先列出選項再問你。每次 push 前，它都會先審查。
- `omc-pstack-fy:fy` output style 讓每則回覆都套用 fy-mode 的回覆規則，但不執行 playbook，所以簡單問題會得到簡短回答。只要 system prompt 裡有 Claude Code 的寫程式指示，它都會保留。只在一個專案使用時，輸入 `/output-style omc-pstack-fy:fy`。這個指令需要 Claude Code v2.1.269 以上，較舊的版本改在 `/config` 裡選 Output style。所有專案都要用時，在 `~/.claude/settings.json` 加上 `"outputStyle": "omc-pstack-fy:fy"`。
- 這些個人調整放在 `tools/rules/80-personal.json`、`overlays/hooks/`、`overlays/output-styles/`、`overlays/skills/unslop-zh/` 和 `overlays/skills/fy-mode/`，和翻譯規則分開。

## 只有英文版的章節

以下章節只有英文版，都在 README.md 裡。建置、發布版本和追蹤上游的細節寫在 [How the build works](README.md#how-the-build-works)、[Versions and releases](README.md#versions-and-releases) 和 [Keeping up with pstack and oh-my-claudecode](README.md#keeping-up-with-pstack-and-oh-my-claudecode)。開發進度寫在 [Roadmap](README.md#roadmap)，用其他廠商的模型做審查寫在 [Other vendors](README.md#other-vendors)。

建置和追蹤上游的重點如下。上游原檔放在 `vendor/`，所有修改寫在 `tools/rules/*.json` 和 `overlays/`。每個 Cursor 名稱怎麼改、為什麼這樣改，都記在 `docs/claude-code-mapping.md`。`plugin/` 由 `node tools/build.mjs` 產生。`upstream-watch` workflow 每天檢查 pstack 和 OMC 有沒有新版。任一邊有新版，它就先在暫存副本裡試跑 sync、build 和測試，再開 issue 寫明結論。結論可能是只差版本號、plugin 檔案有變要審查，或是哪一步失敗。同步上游時，先跑 `node tools/sync.mjs pstack` 或 `node tools/sync.mjs omc`，再跑 build。OMC 改了橋接依賴的名稱或步驟時，build 會失敗，並指出要重新檢查哪一段。

## 參與貢獻

歡迎參與貢獻。送出 pull request 前，先讀 [CONTRIBUTING.md](CONTRIBUTING.md)。裡面寫了哪些檔案可以改、怎麼驗證修改，以及修改合併後怎麼發布。CONTRIBUTING.md 只有英文版。你可以用英文或繁體中文寫 issue 和 pull request。pull request 的標題和 commit 主旨會變成 `CHANGELOG.md` 的條目，所以要用英文寫。

回報 bug 或提議新的 skill，到 [issue tracker](https://github.com/kaneyxx/omc-pstack-fy/issues) 開 issue。pstack skill 本身的用字問題，要回報到 [cursor/plugins](https://github.com/cursor/plugins)。OMC 本身的問題，要回報到 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)。這個專案只改它們的翻譯和橋接方式，不改上游本身。

## 授權

這個專案採用 MIT 授權，全文見 [LICENSE](./LICENSE)。pstack 的著作權標示為 Copyright (c) 2026 Lauren Tan。`vendor/oh-my-claudecode/` 裡的 oh-my-claudecode 檔案標示為 Copyright (c) 2025 Yeachan Heo，採用該資料夾裡的 MIT 授權。

## 致謝

- [pstack](https://github.com/cursor/plugins/tree/main/pstack)，作者是 Lauren Tan（[poteto](https://x.com/poteto)）。這個 plugin 翻譯的 skill、playbook 和工程規則都來自 pstack。
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)，作者是 Yeachan Heo。這個 plugin 在 oh-my-claudecode 裡運作。
