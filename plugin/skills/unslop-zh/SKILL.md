---
name: unslop-zh
description: Cut AI tells and mainland usage from Traditional Chinese (Taiwan) writing.
disable-model-invocation: true
---

# Unslop zh

Most omc-pstack-fy skills set `disable-model-invocation: true`, so the Skill tool refuses them. A refusal never means skip the step. To run a skill this one names, as `/omc-pstack-fy:<name>` or as the **<name>** skill, Read `../<name>/SKILL.md` from this skill's base directory and follow it. Write `/omc-pstack-fy:<name>` only when the user should type it.

Edit Chinese text to remove AI patterns and mainland usage. Scan for the patterns below, then rewrite. Preserve meaning and match the intended tone.

Run this skill with the [**unslop**](../unslop/SKILL.md) skill. Every unslop rule still applies to Chinese unless it is about English words or punctuation. For punctuation in Chinese text, this skill decides.

## Patterns to detect and fix

Rule numbers are stable ids that other skills cite. A removed rule leaves a gap.

### Communication artifacts

1. **Filler openers and closers.** 「好的！」「當然！」「沒問題！」「希望這對你有幫助」「如有其他問題，歡迎隨時詢問」「總之」「綜上所述」「值得注意的是」. Delete them. Open with the answer and stop when it ends.

### Language

2. **Inflated words.** 至關重要, 深入探討, 全方位, 賦能, 抓手, 閉環, 打造, 助力. Use the plain word or say what happens. 「至關重要」 becomes 「重要」 or the reason it matters. 「打造一個工具」 becomes 「寫一個工具」. 「助力團隊」 becomes what the change does for the team.
3. **Translationese.** Use the verb directly.
   - 「進行一個重構的動作」 becomes 「重構」.
   - 「對程式碼進行重構」 becomes 「重構程式碼」.
   - 「作為一個開發者，你會…」 becomes 「開發者會…」.
   - 「被系統所拒絕」 becomes 「系統拒絕了它」.
   - 「基於效能的考量」 becomes 「為了效能」.
   - Stacked 的, as in 「我們的專案的設定的檔案」, becomes 「專案設定檔」. Keep at most one 的 per noun phrase.

### Terminology

4. **Taiwan terms, not mainland usage.** Write Traditional characters and the word Taiwan uses. A quoted name or quoted text stays as written. So does text the user asked for in Simplified Chinese, and text inside a code or data file. Several pairs below hold only in the software sense that their row names.

| Mainland | Taiwan |
| --- | --- |
| 信息 | 資訊 |
| 消息 (a message) | 訊息. 消息 as news, such as 好消息, stays. |
| 軟件 | 軟體 |
| 硬件 | 硬體 |
| 默認 | 預設 |
| 設置 | 設定 |
| 視頻 | 影片 |
| 質量 (quality) | 品質. 質量 as physical mass stays. |
| 項目 (a project) | 專案. 項目 as an item, such as 清單項目, stays. |
| 用戶 | 使用者 |
| 菜單 | 選單 |
| 屏幕 | 螢幕 |
| 打印 | 列印 |
| 鏈接 | 連結 |
| 搜索 | 搜尋 |
| 登錄 | 登入 |
| 網絡 | 網路 |
| 服務器 | 伺服器 |
| 文檔 | 文件 |
| 文件 (a file) | 檔案 |
| 文件夾 | 資料夾 |
| 數據 (data in software) | 資料. Research usage such as 實驗數據 stays. |
| 數據庫 | 資料庫 |
| 代碼 | 程式碼 |
| 程序 (a program) | 程式 |
| 運行 | 執行 |
| 支持 (a feature is supported) | 支援. 支持 as backing a view stays. |
| 實現 (implement) | 實作 |
| 兼容 | 相容 |
| 通過 (by means of) | 透過 |
| 接口 | 介面 |
| 調用 | 呼叫 |
| 返回 (a return value) | 回傳 |
| 函數 (a code function) | 函式. A math function, such as 損失函數, stays. |
| 變量 | 變數 |
| 字段 | 欄位 |
| 對象 (in code) | 物件 |
| 字符串 | 字串 |
| 數組 | 陣列 |
| 循環 (a code loop) | 迴圈. 循環 as a cycle stays. |
| 異步 | 非同步 |
| 線程 | 執行緒 |
| 內存 | 記憶體 |
| 緩存 | 快取 |
| 模塊 | 模組 |
| 註釋 | 註解 |
| 調試 | 除錯 |
| 日志 | 日誌 |

In Taiwan 文件 means a document, so a mainland 文件 that means a file becomes 檔案.

### Punctuation

5. **Full-width punctuation.** Chinese sentences use full-width marks: ，。、；：？！. Quotes are 「」, and a quote inside a quote is 『』. No half-width comma or period and no curly quotes inside Chinese.
6. **Space between Chinese and Latin.** One space between a Chinese character and a Latin letter, a number, or inline code. 「用Node 22跑`npm test`」 becomes 「用 Node 22 跑 `npm test`」. No space next to full-width punctuation.
7. **No 「——」.** Avoid the Chinese dash entirely, as unslop rule 13 does the em dash. End the sentence with 。 or use ，.
8. **Colon.** 「：」 is fine before a list or an example, not as a mid-sentence connector. 「原因：快取沒有清掉」 becomes 「原因是快取沒有清掉。」

### Sentences and verbatim text

9. **Short sentences.** One point per sentence, ended with 。. A run of clauses joined by ，, each able to stand alone, splits into sentences.
10. **Verbatim text stays verbatim.** Code, commands, paths, identifiers, and error text stay in English as written, in backticks. Never translate a quoted error message or an API name. Quote `ENOENT: no such file or directory` as is, never as 「找不到檔案或目錄」. Name `useEffect`, never 「使用效果」.
