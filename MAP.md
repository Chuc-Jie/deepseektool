# DeepSeek 功能增强工具箱 — 代码地图（MAP）

> 依据 `deepseektool.user.js`（@version 4.11.0）实际代码整理，描述模块划分、数据流与运行时调度。

## 1. 载体与元信息（头部注释）

| 项 | 值 | 说明 |
| --- | --- | --- |
| 运行载体 | Tampermonkey / ScriptCat userscript | 单 IIFE 主闭包 + `folderUnit` 子闭包 |
| `@match` | `chat.deepseek.com` / `www.deepseek.com` / `deepseek.com` | 仅 DeepSeek Web 注入 |
| `@run-at` | `document-end` | 见第 4 节：`readyState==='loading'` 挂 DOMContentLoaded，否则立即 `init()` |
| `@grant` | `GM_addStyle` / `GM_getValue` / `GM_setValue` / `GM_registerMenuCommand` | 无网络、无跨域 GM_xhr |
| `@require` | `html2canvas@1.4.1` | 仅 PNG 导出使用（启动不加载逻辑依赖） |
| 状态载体 | `GM_getValue`/`GM_setValue`（每次写入即时持久化） | 设置与文件夹数据分离两键 |

## 2. 状态与存储（GM_* 键 → 全局变量镜像）

> 模式：读取时 `let x = GM_getValue(KEY, 默认)` 建内存镜像；面板/开关改动时先写变量 → `GM_setValue` → 调即时重应用函数。

| 存储键 | 变量 | 默认 | 用途 / 面板控件 |
| --- | --- | --- | --- |
| `deepseek_fold_threshold` | `foldThreshold` | 20 | 代码块自动折叠阈值（0 禁用） |
| `deepseek_fold_preview_lines` | `previewLines` / `enablePreviewLines` | 0 | 折叠后保留预览行数 |
| `deepseek_table_buttons_enabled` | `tableButtonsEnabled` | true | 是否注入表格导出按钮 |
| `deepseek_table_buttons_always` | `tableButtonsAlways` | false | 导出按钮恒显（`html.ds-export-always`） |
| `deepseek_auto_collapse_thinking` | `autoCollapseThinking` | true | AI「已思考」自动折叠总开关 |
| `deepseek_simulate_click_thinking` | `simulateClickThinking` | true | 模拟点击 vs CSS 直接折叠 |
| `deepseek_table_theme_mode` | `tableThemeMode` | 'auto' | 表格配色：auto / dual |
| `deepseek_table_width_mode` | `tableWidthMode` | 'equal' | 列宽：equal / auto / equal-minwidth |
| `deepseek_wide_screen` | `wideScreen` | false | 宽屏模式（`--message-list-max-width:1000px`） |
| `deepseek_ctrl_enter` | `ctrlEnterEnabled` | false | Ctrl+Enter 发送快捷键 |
| `deepseek_folder_manager_enabled` | `folderManagerEnabled` | false | 对话文件夹总开关（opt-in） |
| `deepseek_folder_manager_data_v2` | `data`（folderUnit 内） | `{folders:[],links:{},expanded:{},collapsed:false}` | 文件夹/归属/树展开态/面板折叠态（独立键） |
| `deepseek_pin_group_collapsible` | `pinGroupCollapsible` | false | 原生「置顶」分组**折叠能力**开关（opt-in 子开关，依赖文件夹总开关） |
| `deepseek_pin_group_collapsed` | `pinGroupCollapsed`（folderUnit 内） | false | 原生「置顶」分组**折叠态**（仅能力开关开启时生效/持久化） |
| `deepseek_code_bg_enhance` | `codeBgEnhance` | true | 代码块背景加深总开关（`html.ds-code-bg`） |
| `deepseek_code_bg_level` | `codeBgLevel` | 'light' | 加深强度档位：light / medium / strong（`ds-code-bg-1/2/3`） |
| `deepseek_table_export_rounded` | `tableExportRounded` | true | PNG 导出表格四角圆角（`destination-in` 把四角裁成透明；关则直角矩形） |

## 3. 模块总览

```mermaid
flowchart LR
    subgraph Main["主 IIFE 闭包"]
        Panel["⚙️ 统一控制面板<br/>openControlPanel + 控件工厂"]
        Fold["代码块折叠<br/>addFoldButtonToCodeBlock"]
        CodeBg["代码块外观<br/>applyCodeBlockBg（html 类 + CSS 变量）"]
        Table["表格优化与导出<br/>applyTableStyles / 导出三格式"]
        Think["AI 思考折叠<br/>CSS 预隐藏 + capture 点击释放"]
        Keys["Ctrl+Enter 快捷键<br/>capture keydown"]
    end
    subgraph Folder["folderUnit 子闭包（可选）"]
        FData["独立存储 v2"]
        FPanel["文件夹面板 / 树形渲染"]
        FMenu["⋯ 菜单注入 + 级联浮层"]
    end
    DOM["页面 DOM"] --> Observer["统一 MutationObserver<br/>observeDOM 分流"]
    Observer --> Fold
    Observer --> Table
    Observer --> Think
    Observer --> Folder
    GM["GM 存储"] <--> Panel
    GM <--> FData
    Panel -->|"reapply 函数"| Fold & Table & Think
    Keys --> DOM
```

## 4. 初始化与统一 DOM 监听

### 4.1 `init()` 执行序列（幂等，仅一次）

1. 套用静态开关：`applyTableThemeClass` / `applyWideScreen` / `setTableButtonsAlways` / `applyCodeBlockBg`（写 `html` 类）。
2. 代码块：`cleanupLegacyWrappers()`（清旧 wrapper）→ `deduplicateButtons()` → `processAllExistingCodeBlocks()` 全量补折叠按钮。
3. 表格：`processAllTables()` 全量处理既有表格。
4. 思考：若开启 → `setupThinkContentHiding()`（注入预隐藏 style + 注册 capture click）+ `processAllThinkingSections()`。
5. 文件夹：若开启 → `folderUnit.on()` + `folderUnit.schedule()`（不等首轮 DOM 变化）。
6. `observeDOM()`：注册 body 级 MutationObserver。
7. `resize` 事件 → 100ms 节流 `processAllTables()`（配合表格 fixed 布局的视口宽联动）。

### 4.2 单一 MutationObserver 的分流（`observeDOM`）

对每次 `childList` mutation 的 `addedNodes` 做四路标记，互不串扰、增量处理：

| 信号 | 判定（matches/querySelector） | 处理 | 节流 / 防抖 |
| --- | --- | --- | --- |
| 代码块 | 新增 `pre` / 含 `pre` | 逐 `pre` `addFoldButtonToCodeBlock`（`data-fold-processed` 幂等） | 同步 |
| 表格 | 新增 `table,tbody,thead,tfoot,tr,td,th,.ds-markdown` | `scheduleTableProcess()` → `processAllTables` | 200ms 防抖 |
| 思考 | 新增 `.ds-think-content`（排除 `pre,.md-code-block` 内） | `processAllThinkingSections` | 150ms 延时 |
| 文件夹 | `folderManagerEnabled` 时任意 ELEMENT 新增（宽触发） | `folderUnit.schedule()` | 120ms 节流 |

防自循环：新增节点增量处理 + `data-*` 幂等标记；面板/标签自身的插入不会产生新的 childList 风暴（folder 注释：面板插入只多触发一次自稳 tick）。

## 5. 模块内部流程

### 5.1 代码块折叠

- **定位按钮容器** `findButtonContainer`：优先 `.code-info-button-text` → 兼容 `.ds-text-button` → 哈希容器兜底（选择器全面加固，不依赖哈希）。
- **自动折叠**：`foldThreshold>0 && 行数>阈值`。预览模式（`previewLines>0`）用 `maxHeight` 截断 + `.ds-fold-preview::after " ..."`；否则 `display:none`。
- **展开恢复**：记录 `origDisplay/origMaxHeight/origOverflow`，用户手动展开后不再被后续加载重置（`expandBlock`）。
- **重应用**：改阈值/预览行 → `reapplyFoldToAllCodeBlocks` 清标记重建按钮。

### 5.2 代码块外观（背景加深）

- **驱动方式**：`applyCodeBlockBg(on, level)` 只切 `html` 上的两个类——总开关 `ds-code-bg` + 强度档位 `ds-code-bg-1/2/3`；具体色值由 CSS 变量 `--ds-code-bg` / `--ds-code-bg-line` 承载（轻 `#f3f4f6`/`#e5e8ec`、中 `#eef1f5`/`#dde3e9`、强 `#e9edf2`/`#d8dfe7`）。纯样式模块，**无 MutationObserver 参与、无需重扫 DOM**。
- **作用范围**：`.md-code-block` 与其内 `.md-code-block-banner-wrap` / `.md-code-block-banner` 统一上底色，banner 另加 `1px` 底分隔线（消除官网「白顶条 + 灰代码体」割裂）。
- **主题隔离**：所有规则以 `body:not(.dark)` 限定，深色主题完全交还官网；分隔线仅使块高 +1px，无布局位移。

### 5.3 表格优化与导出

- **样式应用 `applyTableStyles`**：`maxWidth` 取自 `.ds-virtual-list-visible-items.clientWidth`；按 `tableWidthMode` 三策略（均分 / 内容比例自适应 / 均分+80px 下限，超出自动回落自适应并 Toast）；配色由 `html.ds-table-auto`（半透明叠加）或 `html.ds-table-dual`（浅/深双规则）类驱动；`overflow-wrap:anywhere`；仅改直接包裹的 `.ds-scroll-area`；完成后 `opacity:1` 淡入（消除闪烁）。
- **指纹稳定状态机**：`_tableFingerprints`（WeakMap）记录 `rows:cells`。首见立即应用；内容变化后重新进入稳定计数——连续 2 次指纹一致或 5s 超时后应用并 `done`，不再重复 reflow。
- **导出**：三格式共用 `getCleanTableClone`（深拷贝 + 清 fixed/宽度等内联样式 + 摘导出按钮/脚本标记）：
  - 📸 PNG：隔离 iframe（srcdoc + `collectTableStyles` 收集页面样式与兜底配色）→ `html2canvas scale:3` → blob 下载；**纸底**由 `getExportCanvasBg()` 跟随页面深浅（沿祖先链取首个不透明背景色，兜底 深 `#1a1a22`/浅 `#ffffff`）；**文字色**由 `collectTableStyles(sourceTable)` 抄取页面表格 `th`/`td` 的实际计算色写进兜底 `color`（iframe 无 `.ds-markdown` 祖先、不继承页面 color，不显式给色会在深色纸底上落回黑字）；**圆角**受开关 `tableExportRounded` 控制 —— `applyRoundedCorners` 用 `destination-in` 把四角裁成透明（半径按 `canvas宽/元素CSS宽` 换算并 clamp，且**须先 `setTransform(1,0,0,1,0,0)` 重置** html2canvas 残留的变换矩阵，否则蒙版错位、裁剪失效）；
  - 📄 CSV：UTF-8 BOM + 引号/逗号/换行转义；
  - 📝 MD：复制到剪贴板；保留 `code`/`**`/`*` 行内语法、`|` 转义、`<br>` 折为空格。
- **显隐**：`.table-internal-buttons` 默认 hover 显示；`html.ds-export-always`（`setTableButtonsAlways`）强制常显。

### 5.4 AI 思考过程自动折叠

- **预隐藏（零布局偏移）**：注入 `#ds-think-hide`：`.ds-think-content{display:none!important}`；document **capture 阶段**监听折叠区点击 → 移除该 style → 官方正常创建可视内容。
- **折叠执行** `processAllThinkingSections`：基于稳定的 `.ds-think-content` 类名 + 标题「已思考」向上找 wrapper；`simulateClickThinking` 开 → 模拟点击箭头（保持原生交互），关 → CSS 直接隐藏；`data-thinking-collapsed` / `dsScriptCollapsed` 防重。

### 5.5 对话文件夹管理（folderUnit 子闭包）

- **总开关**：控制面板开关 → `folderEnabledChanged(on|off)` → `folderUnit.on()/off()`；切换后若面板处于打开态会关闭重开，以刷新子开关置灰态。
- **子开关**：`pinGroupCollapsible`（存储键 `deepseek_pin_group_collapsible`，默认 false）控制「置顶分组可折叠」能力；设置面板该行在总开关未开时置灰不可点。切换即时生效 → `folderUnit.setPinCollapsible(bool)`：开启则 `bindPinClick()` + `applyPinCollapse()`，关闭则 `resetPinCollapseUi()`。
- **on**：注入主题 CSS 变量（浅/深随 `body.dark`）→ **若子开关开启**则绑定「置顶」折叠点击（`bindPinClick`）→ `ensurePanel`（面板插入「置顶」**分组容器**之后、整体随原生会话历史滚动；无置顶分组时兜底插列表最顶并临时补 22px 让开悬浮「多选」按钮）→ `renderFolders` + `refreshTags` + `injectMenus` + 归档隐藏已收会话（`syncArchiveVisibility`，置顶分组内的行豁免）。
- **面板锚点稳态判据（v4.9.2 修正）**：`ensurePanel` 的早退条件是**直接核对锚点**——有「置顶」分组时要求 `panel.previousElementSibling === pg`，无分组时要求 `panel === sc.firstChild`；不满足则走重挂迁移。旧判据「不在 pg 内即稳态」语义过宽，会让早期竞态被兜底挂到最顶的面板**永久卡在错误位置**。重挂逻辑带幂等保护（位置/`paddingTop` 确需变更时才动 DOM），避免无意义 mutation 触发 observer→schedule 自激循环。
- **数据模型**：`{folders, links(sid→fid), expanded, collapsed}`；改动路径 `…→ saveData() → renderFolders()/resyncFolders()`。
- **交互**：面板头点击整体折叠（`collapsed` 隐藏列表与「＋新建」）；树形就地展开；内嵌会话行点击跳官方会话（当前会话高亮，带自绘悬停 tooltip）；每行「移出」。
- **级联浮层**：⋯ 菜单注入「移动到文件夹」→ 悬停开 `#dsFolderPop`（列出文件夹 / ＋新建 / 移出）；**伪悬停门控**——用 `pointermove`/capture click 时间戳（`lastMenuOpenAt`/`lastRealMoveAt`）避免"点 ⋯ 时菜单项正好在指针下"误弹次级菜单；关闭只移除自己浮层，不藏官方 `.ds-floating-container`。
- **「置顶」分组折叠**（受子开关 `pinGroupCollapsible` 控制）：`findPinnedGroup` 定位原生「置顶」分组容器（缓存 `pinnedGroupEl`，`isConnected` 失效即重算；判据 = 容器内含 innerText 为「置顶」的 sticky 头）→ `findPinHeader` 取其中标题 → `applyPinCollapse` 加稳定类 `ds-pin-head` / 折叠类 `dsPinCollapsed`，并隐藏容器内除标题外的兄弟（被藏节点标 `data-ds-pin-hidden`，展开时只还原自己藏过的）；点击走 document 级捕获事件委托（不依赖官网 hash 类名），折叠态每轮 `schedule` 重放（抗 React 重建，仅子开关开启时）；状态存 `deepseek_pin_group_collapsed`，多选态下不响应。箭头经伪元素 `mask` 绘制（基础图形 = 下向 chevron `M3.5 6 8 10.5 12.5 6`），折叠态加 `dsPinCollapsed` 时 `rotate(-90deg)` 转为朝右——与「文件夹」头 `dsHeadCaret` 的图形、旋转角完全一致，语义统一为**展开 = ⌄、折叠 = ›**。
- **多选互斥**：`syncSelectModeLock` 检测列表根内 `.ds-checkbox`（普通态 0 / 原生多选态 >0，为多选专属标记）→ 面板加 `dsSelectModeHidden`（`display:none`）整区隐藏，退出多选自动恢复。
- **off（整体清理）**：`resetPinCollapseUi`（**无条件**解绑折叠点击 + 还原被折叠隐藏的原生节点与注入类名）、还原被归档隐藏的原生会话行、移除面板/标签/注入菜单项/临时样式/CSS 变量/自绘 tooltip；数据保留，再次开启可恢复。
- **路由**：URL 会话变化才重绘树（防 observer 自激循环）；导航切换后 `folderUnit.schedule()` 由外层驱动。

### 5.5 发送快捷键（Ctrl+Enter）

`document` capture `keydown`（`ctrlEnterEnabled` && 目标为 `TEXTAREA` && Enter）：

- `Ctrl/Cmd+Enter` → `preventDefault+stopPropagation` 后派发**不带修饰**的 Enter（让官方按 Enter 发送语义处理），`_supressNextEnter` 吞掉自身派发的一次；
- 纯 `Enter`（无修饰、非 Shift）→ `stopPropagation`（改为换行、不再发送）；
- `Shift+Enter` → 不拦截（保持原生换行）。

## 6. 典型运行序列

```mermaid
sequenceDiagram
    participant P as DeepSeek 页面
    participant M as 主闭包
    participant O as observeDOM(单一 MutationObserver)
    participant F as folderUnit（可选）
    participant G as GM 存储

    Note over P,G: 页面加载
    P->>M: document-end / DOMContentLoaded → init()
    M->>G: 读取全部设置键（GM_getValue）
    M->>P: 套用 html 主题/宽屏/恒显类 + 全量扫描既有 pre/table/思考
    alt 文件夹已开启
        M->>F: on() + schedule()
        F->>P: 注入面板 / 标签 / ⋯ 菜单 / 归档隐藏
    end
    M->>O: observe(document.body)

    Note over P,G: 流式回复 → 新增节点
    P-->>O: 新增 pre / tr,td / .ds-think-content / 任意元素
    O->>M: 增量：补折叠按钮（同步）
    O->>M: scheduleTableProcess（200ms）→ 表格指纹稳定后应用样式+按钮
    O->>M: processAllThinkingSections（150ms）
    alt 文件夹开启
        O->>F: schedule（120ms）→ 重扫/重绘树
    end

    Note over P,G: 用户操作面板（即时生效）
    P->>M: GM_registerMenuCommand → openControlPanel
    M->>G: GM_setValue 写入
    M->>P: reapply 函数即时重建（折叠/表格/思考/文件夹开关）

    Note over P,G: 表格导出（PNG/CSV/MD）
    P->>M: 点击 📸/📄/📝
    M->>M: getCleanTableClone 清洗克隆
    M->>G: PNG 走隔离 iframe + html2canvas；MD 走 clipboard
```
