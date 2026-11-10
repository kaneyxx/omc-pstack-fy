# omc-pstack-fy

[English](README.md) | [繁體中文](README.zh-TW.md) | 简体中文

omc-pstack-fy 把 pstack 严谨的工程方法带给重度 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)（OMC）用户。OMC 仍是你的主要工具，所有关键词和工作流照常运行。[pstack](https://github.com/cursor/plugins/tree/main/pstack) 是 Lauren Tan（[poteto](https://x.com/poteto)）写的 Cursor 插件。omc-pstack-fy 把它原生移植到 Claude Code，作为 OMC 处理代码工作的引擎。

pstack 是 Lauren 的作品，oh-my-claudecode 是 Yeachan Heo 的作品。本项目是非官方配套插件，不属于这两个项目。它忠实翻译 pstack，另外加上 OMC 桥接和几项个人调整。对 pstack 有想法就反馈给 pstack，对 OMC 有想法就反馈给 OMC。

## 安装

每条命令都要单独输入。一次粘贴多行会失败。只想用 pstack 的话，跳过第 1 步。

1. 按照 [OMC 的 README](https://github.com/Yeachan-Heo/oh-my-claudecode#readme)，从 OMC 自己的 marketplace 安装 oh-my-claudecode：
   ```bash
   /plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode
   ```
   ```bash
   /plugin install oh-my-claudecode
   ```
   ```bash
   /omc-setup
   ```
2. 安装 omc-pstack-fy：
   ```bash
   /plugin marketplace add kaneyxx/omc-pstack-fy
   ```
   ```bash
   /plugin install omc-pstack-fy@omc-pstack-fy
   ```
3. 重启 Claude Code，再运行 `/omc-pstack-fy:setup-pstack`。它会先问设置过程要用英文、简体中文还是繁体中文。

把 OMC 的代码工作交给 pstack 的是一个 SessionStart hook。它只认 `oh-my-claudecode@omc` 这个插件条目，这个条目由 OMC 自己的 marketplace 创建。有些 fork 会用其他 marketplace 或插件名注册 OMC。这样注册的 OMC 接不上桥接。如果 OMC 安装后没有留下这个条目，也一样。安装顺序反了也没关系。hook 在每次会话开始时都会检查 OMC，所以之后补装 OMC，重启 Claude Code 就行。

每个 pstack 命令都要加上 `omc-pstack-fy:` 前缀。各个 skill 的说明见插件自己的英文 [README](./plugin/README.md) 和[使用指南](./plugin/docs/guide/README.md)。

### 更新

除非你自己开启，Claude Code 不会自动更新第三方 marketplace。更新有三种方式，另外还有手动更新可以备用。建议按下面的顺序选。无论用哪一种，新版本都会在下次启动 Claude Code 时加载。在已经打开的会话里，等更新完成后输入 `/reload-plugins`。

**开启自动更新（只需设置一次）**。打开 `/plugin`，进入 **Marketplaces** 后选 `omc-pstack-fy`，再选 **Enable auto-update**。也可以把下面这段合并到 `~/.claude/settings.json`：

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

在交互式会话里，你发出第一条消息后，Claude Code 会随机等待最多十分钟。接着它在后台刷新 marketplace 并更新插件。运行中的会话继续使用已加载的版本，下次启动才会加载新版本。

**运行 `update` skill**。在 Claude Code 里输入 `/omc-pstack-fy:update`。它会运行下面“手动更新”里的两条命令，再提醒你重启 Claude Code。加入这个 skill 之前的插件版本没有它，所以旧版本要先用别的方式更新一次。

**运行终端命令**。用 npx 直接从 GitHub 运行。它需要 Node 18 及以上版本和 git，不会全局安装任何东西。

```bash
npx -y github:kaneyxx/omc-pstack-fy update
```

想改用 `omc-pstack-fy update` 的话，把下面这行 `alias` 加到 `~/.zshrc` 或 `~/.bashrc`：

```bash
alias omc-pstack-fy='npx -y github:kaneyxx/omc-pstack-fy'
```

它会依次运行同样的两条命令，并实时显示输出。遇到第一条失败的命令，它就停下来，并以那条命令的退出码退出。两条都成功时，它会提醒你重启 Claude Code。`omc-pstack-fy help` 会显示用法。不要从 npm registry 安装 `omc-pstack-fy`，因为那个名字不属于本项目。

**手动更新**。这是备用做法。`update` skill 和终端命令运行的都是这两条命令。在终端一次输入一条，运行完再重启 Claude Code。

```bash
claude plugin marketplace update omc-pstack-fy
```
```bash
claude plugin update omc-pstack-fy@omc-pstack-fy
```

## OMC 和 pstack 怎么分工

| 层 | 交给 | 负责什么 |
|---|---|---|
| 项目 | oh-my-claudecode | 所有关键词、`deep-interview`、`plan` 和 `ralplan`、`ultragoal`、`team`、`ralph`、wiki、notepad、project memory、verifier、HUD，以及通知 |
| 代码 | pstack | 每个代码工作单元由 `omc-pstack-fy:poteto-agent` 子代理按 poteto-mode 的 playbook 执行。最后的代码审查加跑 `/omc-pstack-fy:interrogate`（多模型审查小组），并保留 OMC 的 `code-reviewer`。ai-slop-cleaner 步骤交给 `deslop` |

只要 OMC 已安装并启用，插件内置的 SessionStart hook 就会把这个分工告诉 OMC 的工作流。这个 hook 不会写入你的配置，停用 omc-pstack-fy 就会移除这个分工。子代理把 diff 交回 OMC 的主代理，commit、push 和 PR 仍由主代理负责。

你也可以直接运行 pstack。`/omc-pstack-fy:poteto-mode` 会用 Lauren 的 playbook 执行一个任务。在这次运行里，pstack 的规则优先。没有 OMC 时，omc-pstack-fy 就是单纯的 pstack。

## 个人选择

下面这些是维护者自己的选择，不是从 Lauren 的 pstack 翻译来的。

- 上面的 oh-my-claudecode 桥接。它由 `overlays/hooks/` 和 `tools/rules/80-personal.json` 里对 poteto-mode 的修改组成。
- 你用中文写消息时，回复会配合你用繁体或简体，并遵守 `unslop-zh` skill。繁体中文用台湾用语，简体中文用中国大陆用语。代码、commit 和文档仍保持英文。
- `/omc-pstack-fy:fy-mode` 在 poteto-mode 上再套用维护者自己的风格。它按每个步骤的产出分派工作。代码交给 poteto-mode，科研代码另外要符合可复现性规则。学术文字交给科研类的 skill。回复的第一行就是下一步行动或答案。遇到重大选择，它会先列出选项再问你。每次 push 前，它都会先审查。
- `omc-pstack-fy:fy` output style 让每条回复都套用 fy-mode 的回复规则，但不执行 playbook，所以简单问题会得到简短回答。只要 system prompt 里有 Claude Code 的编程指令，它都会保留。只在一个项目使用时，输入 `/output-style omc-pstack-fy:fy`。这条命令需要 Claude Code v2.1.269 及以上版本，较旧的版本改在 `/config` 里选 Output style。所有项目都要用时，在 `~/.claude/settings.json` 里加上 `"outputStyle": "omc-pstack-fy:fy"`。
- 这些个人调整放在 `tools/rules/80-personal.json`、`overlays/hooks/`、`overlays/output-styles/`、`overlays/skills/unslop-zh/` 和 `overlays/skills/fy-mode/`，和翻译规则分开。

## 只有英文版的章节

以下章节只有英文版，都在 README.md 里。构建、发布版本和跟踪上游的细节写在 [How the build works](README.md#how-the-build-works)、[Versions and releases](README.md#versions-and-releases) 和 [Keeping up with pstack and oh-my-claudecode](README.md#keeping-up-with-pstack-and-oh-my-claudecode)。开发进度写在 [Roadmap](README.md#roadmap)，用其他厂商的模型做审查和评判写在 [Other vendors](README.md#other-vendors)。

构建和跟踪上游的要点如下。上游原始文件放在 `vendor/`，所有修改写在 `tools/rules/*.json` 和 `overlays/`。每个 Cursor 名称怎么改、为什么这样改，都记在 `docs/claude-code-mapping.md`。`plugin/` 由 `node tools/build.mjs` 生成。`upstream-watch` workflow 每天检查 pstack 和 OMC 有没有新版本。推送到 `main` 的修改涉及 `upstream.json` 时，它也会运行，所以同步完成后 issue 会自动关闭，不必手动运行。检查 OMC 时，它只看已发布的 GitHub Release。只有 tag 而没有 Release 的版本还不算新版本。任何一边的上游文件比 `vendor/` 里的新，它就先在临时副本里试跑 sync、build 和测试，再创建 issue 写明结论。结论可能是只差版本号、插件文件有变动要审查，或者哪一步失败。同步上游时，先运行 `node tools/sync.mjs pstack` 或 `node tools/sync.mjs omc`，再运行 build。OMC 改了桥接依赖的名称或步骤时，build 会失败，并指出要重新检查哪一段。

## 参与贡献

欢迎参与贡献。提交 pull request 前，先读 [CONTRIBUTING.md](CONTRIBUTING.md)。里面写了哪些文件可以改、怎么验证修改，以及修改合并后怎么发布。CONTRIBUTING.md 只有英文版。你可以用英文、繁体中文或简体中文写 issue 和 pull request。pull request 的标题和 commit 主题会变成 `CHANGELOG.md` 的条目，所以要用英文写。

报告 bug 或提议新的 skill，到 [issue tracker](https://github.com/kaneyxx/omc-pstack-fy/issues) 提 issue。pstack skill 本身的用词问题，要反馈到 [cursor/plugins](https://github.com/cursor/plugins)。OMC 本身的问题，要反馈到 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)。本项目只改它们的翻译和桥接方式，不改上游本身。

## 许可证

本项目采用 MIT 许可证，全文见 [LICENSE](./LICENSE)。pstack 的版权声明为 Copyright (c) 2026 Lauren Tan。`vendor/oh-my-claudecode/` 里的 oh-my-claudecode 文件标注为 Copyright (c) 2025 Yeachan Heo，采用该目录下的 MIT 许可证。

## 致谢

- [pstack](https://github.com/cursor/plugins/tree/main/pstack)，作者是 Lauren Tan（[poteto](https://x.com/poteto)）。这个插件翻译的 skill、playbook 和工程规则都来自 pstack。
- [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode)，作者是 Yeachan Heo。这个插件在 oh-my-claudecode 里运行。
