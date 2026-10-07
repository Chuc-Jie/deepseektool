# RELEASE.md — 发版更新清单

> **用途**：每次发版（尤其是版本号变更）时，照此清单逐项核对，避免遗漏。
> **由来**：本项目历史上多次出现「改了版本号但漏了某份文档」「新增功能没写进说明」的情况，
> 故把清单固化成文档，发版时逐条打勾。

---

## 〇、先决定版本号

| 变更性质 | 版本位 | 示例 |
|---|---|---|
| 新增**大功能** / 破坏性变更 | **major** | `4.11.1 → 5.0.0`（新增「对话导出」） |
| 新增小功能 / 小开关 | **minor** | `4.11.1 → 4.12.0` |
| 修 bug / 改文案 / 调样式 | **patch** | `4.11.1 → 4.11.2` |

> ⚠️ **铁律：版本号提升必须与它要发布的那份代码改动在同一次推送里。**
>
> `release.yml` 的防重复守卫是「该版本号的 GitHub Release 是否已存在」（`gh release view v<version>`）。
> 若**先推「版本号 + 文档」、再推实际代码改动**，Release 会在第一次推送时就按该版本号生成并锁定，
> 之后同版本号的推送会被判 `changed=false` **静默跳过**（**工作流仍显示绿色成功**）——
> 后续改动**永远进不了任何 Release**。
>
> 判据（推送前自问）：**「这次推的东西里，有改动 `deepseektool.user.js` 的内容吗？」**
> 有 → `@version` 必须同步 +1，且与代码改动在**同一次提交**里。

---

## 一、版本号同步（**5 处，缺一不可**）

| # | 文件 | 位置 | 形式 |
|---|---|---|---|
| 1 | `deepseektool.user.js` | 头部注释 | `// @version      5.0.0` |
| 2 | `deepseektool.user.js` | 关于页 | `createInfoIntro('版本', 'DeepSeek 功能增强工具箱 v5.0.0')` |
| 3 | `README.md` | **第 1 行标题** | `## DeepSeek 功能增强工具箱 v5.0.0` |
| 4 | `MAP.md` | **第 3 行引文** | `> 依据 \`deepseektool.user.js\`（@version 5.0.0）实际代码整理…` |
| 5 | `CHANGELOG.md` | 文件顶部新增条目 | `## v5.0.0 (YYYY-MM-DD)` |

> `scriptcat-description.md` **不含版本号**（它是发布页文案），无需改版本号，但要改功能内容（见 §三）。

### 一键核对命令

```bash
# 应当只剩 CHANGELOG/README 历史条目里的旧版本号
grep -rn "4\.11\.1" --include="*.md" --include="*.js" . | grep -v "^\./\.git/"
```

用脚本核对更可靠（历史条目会大量包含旧版本号，肉眼容易误判）：

```bash
node -e "const f=require('fs');const u=f.readFileSync('deepseektool.user.js','utf8');
const m=u.match(/@version\s+([\d.]+)/)[1];const a=u.match(/功能增强工具箱 v([\d.]+)/)[1];
const r=f.readFileSync('README.md','utf8').split('\n')[0].match(/v([\d.]+)/)[1];
const p=f.readFileSync('MAP.md','utf8').match(/@version ([\d.]+)/)[1];
const c=f.readFileSync('CHANGELOG.md','utf8').match(/## v([\d.]+)/)[1];
console.log('@version',m,'| 关于页',a,'| README',r,'| MAP',p,'| CHANGELOG',c);
console.log([m,a,r,p,c].every(x=>x===m)?'✓ 5 处一致':'✗ 不一致');"
```

---

## 二、`@description` 与功能一句话（易漏）

| 文件 | 位置 | 要点 |
|---|---|---|
| `deepseektool.user.js` | `// @description` | 一句话功能罗列，**新增大功能必须写进去** |
| `scriptcat-description.md` | 引用块（`>` 开头那段） | 同样是功能一句话 |
| `scriptcat-description.md` | 「📖 简介」段 | 若新增功能改变了产品定位，需同步 |

---

## 三、功能内容同步（新功能/新设置项）

| 文件 | 需更新的位置 |
|---|---|
| `README.md` | ①「一、脚本概述」的核心模块编号列表（新增模块要进列表，并调整「四大核心模块」这类计数）<br>②「二、功能详情」新增 `2.x` 小节<br>③「六、版本历史」顶部新增条目 |
| `MAP.md` | ① §2 存储键表（新增的 `STORAGE_*` 一行）<br>② §3 模块总览的 mermaid 图（新增子闭包/模块）<br>③ §5 内部流程新增 `5.x` 小节<br>④ §6 典型运行序列（若调度有变） |
| `scriptcat-description.md` | ①「✨ 功能一览」表新增一行<br>②「🧩 功能说明」新增 `###` 小节<br>③「⚙️ 控制面板一览」表新增该分区的设置项行 |
| `CHANGELOG.md` | 新增版本条目：**变更摘要 + 根因/实现要点**（沿用现有条目的写法：先结论后细节） |

### 新增存储键 / 权限 / 依赖时额外注意

| 情况 | 要改的地方 |
|---|---|
| 新增 `STORAGE_*` 常量 | `MAP.md` §2 表；`deepseektool.user.js` 头部常量区（含注释与默认值） |
| 新增 `@grant` | `deepseektool.user.js` 头部；`scriptcat-description.md`「兼容性」段（如需说明） |
| 新增 `@require`（外部依赖） | `deepseektool.user.js` 头部；`scriptcat-description.md`「🛠️ 兼容性」的「外部依赖」行 |
| 新增 `@match` | `deepseektool.user.js` 头部；`scriptcat-description.md`「🛠️ 兼容性」的「适用站点」行 |

---

## 四、辅助文档（**不在 git 里，极易漏**）

| 文件 | 位置 | 内容 |
|---|---|---|
| `.codebuddy/CODEBUDDY.md` | 「二、当前状态」表 | `@version`、`HEAD`、核实日期、未完成事项 |
| `.codebuddy/CODEBUDDY.md` | 「三、工程约定」 | 「N 处版本号必须同步」的清单（若有增减） |
| `.workbuddy/handoff/README.md` | 「五、当前状态与唯一待办」 | `@version`、`HEAD`、待办 |
| `.workbuddy/memory/MEMORY.md` | 脚本工程约定 | 版本发布同步范围（若有增减） |

> 这两个文件被 `.gitignore` 排除，`git status` 看不到改动，**最容易漏**。

---

## 五、发布动作

| # | 动作 | 备注 |
|---|---|---|
| 1 | 本地提交（含版本号与全部文档） | 按 Git 流程：代码改动先分支 → 实测 → `merge --ff-only`；纯文档可直提 master |
| 2 | **推送到远程** | 由用户执行，AI 不 push |
| 3 | GitHub Release | **自动**：`release.yml` 监听 master 上的 `deepseektool.user.js` 变更，读 `@version` 建 tag 与 Release（已存在则跳过） |
| 4 | ScriptCat 发布页 | **手动**：运行 `scriptcat-update` 技能，填「脚本代码 / 详细说明 / 更新日志」三处，**绝不点「发布更新」** |
| 5 | 更新日志字数 | ScriptCat 发布页的更新日志有 **≤500 字**限制，从 `CHANGELOG.md` 对应条目**精简**后填入 |

---

## 六、发版前自检（建议按序执行）

```bash
# 1) 语法
node --check deepseektool.user.js

# 2) 5 处版本号一致（见 §一 的脚本）

# 3) 工作区与 HEAD
git status --short && git log --oneline -3

# 4) 功能是否已写入 4 份文档
grep -l "<新功能关键词>" README.md CHANGELOG.md MAP.md scriptcat-description.md

# 5) 项目自带的测试台（见 .workbuddy/research/）
#    静态审计 / 选择与弹窗 / 虚拟列表扫描 / 边界 / 静态规格 / 转换回归
```

---

## 七、历史踩坑（写在这里防止重犯）

| 坑 | 说明 |
|---|---|
| 只改 `@version` 忘改关于页 | 面板里显示的版本与脚本版本不一致 |
| 忘改 `MAP.md` 第 3 行 | MAP 声称的版本落后于代码 |
| 新增功能没进 `README` 概述列表 | 概述里「四大核心模块」计数与实际不符 |
| 新增存储键没进 MAP §2 表 | 后续维护者不知道键的存在 |
| 漏掉 `.codebuddy/` 与 `.workbuddy/handoff/` | 二者被 gitignore，`git status` 不提示 |
| 新增 `@require` 没更新「外部依赖」 | 用户不知道装了什么第三方库 |
| ScriptCat 更新日志超 500 字被截断 | 从 CHANGELOG 精简，不要整段粘贴 |
| 版本号被 CHANGELOG 历史条目干扰 | 核对脚本要只取「顶部条目」而非全文匹配 |
| 只改工作区忘了改历史 | 提交过的内容会留在 `.git` 里；需重写历史并清掉 `refs/original` 与 reflog 才真正消失 |
| 以为「本地 `git log` 干净」= 远程也干净 | 已推送的提交需 `--force-with-lease` 覆盖；`refs/remotes/origin/*` 在 force-push + fetch 前仍指向旧状态 |
| 提交信息里写了「为什么要改」的过程 | 提交信息只描述**改了什么**；涉及内部流程的信息放 gitignore 内的文档 |
| **版本号先推、代码改动后推** | Release 会按先推的版本号抢先创建（tag 指向旧提交），后推的同版本号改动被守卫**静默跳过**（工作流仍绿）。2026-10-07 实际发生：`v5.1.0` 的 tag 指向 `ead1fa5`，而按钮换位提交 `46f4bff` 比 Release 晚 13 分钟 → 只能靠升 `v5.1.1` 补救。**版本号必须与代码改动同一次推送**（见 §〇） |
| 查远程 tag / Release 用了 `git ls-remote` | 本机 https 走 schannel 会报 `CRYPT_E_NO_REVOCATION_CHECK` 而失败。改用 **`gh`**（自带 HTTP 栈）：`gh release list -R <owner>/<repo>`、`gh api repos/<owner>/<repo>/git/ref/tags/<tag>` |

