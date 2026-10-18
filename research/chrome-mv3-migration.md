# DeepSeek 功能增强工具箱 — Chrome MV3 扩展迁移调研

> 调研分支：`research/chrome-mv3-extension`
> 调研对象：`deepseektool.user.js` v5.7.3（7036 行，404 KB）
> 结论先行：**可行，改造成本集中在「存储异步化」与「菜单入口」，业务逻辑（DOM 操作）几乎可以原样复用**。推荐「单一源码 + 双发行」：保留 userscript，用构建脚本产出 Chrome MV3 包，而不是另起一份扩展代码。

---

## 1. 现状盘点

### 1.1 载体与规模

| 项 | 现状 |
| --- | --- |
| 载体 | Tampermonkey / ScriptCat 用户脚本，单 IIFE |
| 代码规模 | 7036 行 / 404 KB，无构建步骤、无 npm 依赖 |
| 运行时机 | `@run-at document-end`；`readyState === 'loading'` 时挂 `DOMContentLoaded`，否则立即 `init()` |
| 匹配范围 | `chat.deepseek.com`、`www.deepseek.com`、`deepseek.com` |
| 外部依赖 | `@require html2canvas@1.4.1`（cdn.jsdelivr.net） |
| 网络请求 | 无 `GM_xmlhttpRequest`、无 `@connect` |
| 页面 JS 依赖 | 无 `unsafeWindow`，只操作 DOM / CSS / 浏览器标准 API |
| 存储 | `GM_getValue` / `GM_setValue`，共 23 个键，全部为标量或 JSON 字符串 |
| 菜单入口 | `GM_registerMenuCommand` × 2：「脚本设置」「导出对话」 |
| 样式 | `GM_addStyle` × 2（主样式 + 文件夹面板样式），全部 `!important` 为主 |
| 下载 | `Blob` + `URL.createObjectURL` + `<a download>`（PNG / CSV / MD / JSON） |
| 剪贴板 | `navigator.clipboard.writeText` / `write(ClipboardItem)` |
| 后台需求 | 无。所有逻辑都在页面内，无定时任务、无跨标签页协调 |

### 1.2 与 MV3 直接相关的依赖

| 现有能力 | 使用点 | MV3 对应 | 改造难度 |
| --- | --- | --- | --- |
| `GM_addStyle(css)` | 2 处（主样式 ~900 行、文件夹面板） | 自建 `<style>` 注入或 `content_scripts.css` | 低 |
| `GM_getValue` | 23 处，其中 20+ 处在 IIFE **顶层同步读取** | `chrome.storage.local.get`（**异步**） | **中高** |
| `GM_setValue` | 54 处，散落在设置面板与功能代码中 | `chrome.storage.local.set` | 低（写入即弃） |
| `GM_registerMenuCommand` | 2 处 | 工具栏 popup / 页面内入口 / `chrome.commands` | 中 |
| `@require html2canvas` | PNG 导出 | 本地打包进 bundle | 低 |
| `@match` | 3 个域名 | `host_permissions` + `content_scripts.matches` | 低 |
| `@run-at document-end` | 初始化 | `content_scripts.run_at: "document_idle"` | 低 |
| `@grant none` 之外的沙箱 | 无 `unsafeWindow` | 默认 `ISOLATED` world 即可 | 低 |

### 1.3 值得注意的隐藏依赖

1. **控制面板图标走远程 CDN**：`https://api.iconify.design/mdi:*.svg`（约 20 个图标）。
   MV3 不禁止远程**图片**（禁止的是远程 JS/WASM），但上架 Chrome Web Store 时建议本地化：
   离线可用、无第三方请求、隐私声明更干净、避免被页面 CSP `img-src` 或广告拦截器影响。
2. **文件夹数据在子闭包 IIFE 顶层立即读取**：
   ```js
   const folderUnit = (() => {
       function loadData() { JSON.parse(GM_getValue(STORAGE_FOLDER_DATA, 'null')) ... }
       let data = loadData();
       ...
   })();
   ```
   存储改异步后，这段不能再在脚本顶层同步执行，必须延迟到 `await preloadStorage()` 之后。
3. **设置变量在顶层同步建立内存镜像**（`let foldThreshold = GM_getValue(...)` 等 20 余行）。
   不能简单把 `GM_getValue` 换成 `await`，需要一次 bootstrap 改造。
4. **验证台是「源码提取式」测试**：`tests/README.md` 说明测试会从 `deepseektool.user.js`
   提取函数体做 jsdom 验证（例如 `openControlPanel` 的面板分区）。**大拆模块会直接破坏现有验证台**，
   因此 M1 不建议做目录级重构。
5. **没有设置导入/导出功能**：油猴存储与扩展存储互相隔离（不同扩展的 IndexedDB 不可互读），
   现有用户升级到扩展后无法自动继承设置，需要专门设计迁移路径。
6. **双注入风险**：用户同时启用 userscript 和扩展时，两套实例会重复注入按钮、重复绑定监听、
   读写两套互不相通的存储。必须在扩展/文档层面明确「二选一」。

---

## 2. Chrome MV3 关键结论（2026 年现状）

MV2 已停止支持，新扩展只能用 MV3。与本项目相关的机制：

| 机制 | 结论 | 对本项目的影响 |
| --- | --- | --- |
| Content Script | 运行在页面中，默认为 `ISOLATED` world；可完整操作 DOM、CSS、标准 Web API | 业务逻辑可原样运行；无需 `MAIN` world |
| Service Worker | 事件驱动、可随时休眠，不能保存常驻状态 | 本项目无后台需求，可不声明 `background` |
| `chrome.storage.local` | 异步；配额 10 MB（Chrome 114+），`unlimitedStorage` 可解除 | 设置与文件夹数据足够；需异步改造 |
| `chrome.storage.sync` | 100 KB 总量 / 8 KB 单项 / 512 项 | 只适合设置同步，不适合文件夹数据 |
| 远程代码 | **禁止**执行远程托管的 JS/WASM；库必须打包进扩展 | html2canvas 必须本地打包 |
| CSP | 扩展页面 CSP 比 MV2 更严格；content script 的 JS 不受页面 CSP 限制 | 现有 `innerHTML` 用法可继续（页面若启用 Trusted Types 则与现状一样受限） |
| 更新 | Chrome Web Store 自动更新；开发者模式加载可手动刷新 | 发布流程与 userscript 的 GitHub Release 不同 |
| `chrome.userScripts` | Chrome 120+ 的官方用户脚本 API，面向脚本管理器类扩展，需用户手动开启开关 | 不适用于单一功能扩展，仅作为「保留 userscript」的注脚 |

---

## 3. 迁移方案对比

### 方案 A：原生 MV3 扩展，业务代码原样迁移（推荐）

- 新增 `manifest.json` + popup + 构建脚本，`deepseektool.user.js` 作为唯一业务源码。
- 通过一个 **GM 兼容层**把 4 个 API 映射到扩展能力；用构建时的常量或运行时探测切换。
- 优点：改造面最小、双发行可持续、现有测试与发布节奏不被打断。
- 缺点：仍保留单文件结构（但这是本项目测试体系决定的，不是缺点）。

### 方案 B：把脚本改成「MV3 + 用户脚本运行时」

即扩展内嵌一个 userscript 引擎（或依赖 `chrome.userScripts`）来执行原脚本。

- 优点：几乎不改脚本。
- 缺点：需要申请 `userScripts` 权限、用户手动开启开关、审核解释成本高；多一层运行时，
  调试困难；且该 API 的定位是脚本管理器，不是单功能扩展。**不推荐。**

### 方案 C：完全重写为模块化扩展（`src/` 目录 + TypeScript + 组件框架）

- 优点：长期架构最干净。
- 缺点：7036 行、大量依赖 DeepSeek DOM 细节的代码要重写/搬迁；现有源码提取式验证台全部失效；
  短期内回归风险最高。**不建议作为第一步**，可作为扩展稳定后的渐进式重构。

### 方案 D：保持 userscript，仅发布到更多脚本管理器

不满足「浏览器扩展」目标，不讨论。

**推荐 A**：先以最小改动产出可用的 MV3 包，验证真实用户场景，再决定是否做 C 的模块化。

---

## 4. 推荐架构

### 4.1 目录结构（M1 最小侵入）

```
deepseektool.user.js          # 唯一业务源码，保持 userscript 可发布
extension/
  manifest.json               # 静态声明
  popup.html / popup.js       # 工具栏入口：打开面板 / 导出对话
  icons/                      # 16/32/48/128 本地图标
  build.mjs                   # esbuild：注入兼容层 + 打包 html2canvas → dist/
  src/
    gm-adapter.js             # GM_* → chrome.* 兼容层（构建时拼接或 import）
    bootstrap.js              # 异步引导（可选，见 4.4）
dist/                         # 构建产物（gitignore；发布时打 zip）
```

如果不想引入 `src/`，也可以让 `build.mjs` 用 esbuild 的 `inject` / `define` 把兼容层
直接注入 `deepseektool.user.js`，源码保持零改动（但异步 bootstrap 仍需改源码，见 4.4）。

### 4.2 manifest 草案

```json
{
  "manifest_version": 3,
  "name": "DeepSeek 功能增强工具箱",
  "version": "5.7.3",
  "description": "代码块折叠与导图、表格优化与导出、对话导出、思考折叠、文件夹分组、宽屏模式。",
  "minimum_chrome_version": "111",
  "permissions": ["storage"],
  "host_permissions": ["https://chat.deepseek.com/*"],
  "content_scripts": [{
    "matches": ["https://chat.deepseek.com/*"],
    "js": ["content.js"],
    "run_at": "document_idle",
    "all_frames": false
  }],
  "action": {
    "default_popup": "popup.html",
    "default_icon": { "16": "icons/16.png", "32": "icons/32.png" }
  },
  "icons": { "16": "icons/16.png", "32": "icons/32.png", "48": "icons/48.png", "128": "icons/128.png" }
}
```

说明：

- **只匹配 `chat.deepseek.com`**。现有 `@match` 还包含两个营销站域名，但功能全部依赖对话页 DOM；
  上架时缩小 host 权限能显著降低审核阻力。若确认官网页面也有功能，再加回。
- `minimum_chrome_version` 可按实际 API 下调；本项目只用到 `storage`，Chrome 88+ 即可，
  设 111 是为 `world` 等后续可选能力留余地。
- 不需要 `background` service worker。popup 直接给 content script 发消息即可。
- 不需要 `web_accessible_resources`：html2canvas 打包进 content script，不向页面暴露脚本。
- 如果后续改用 `chrome.downloads`，再申请 `downloads`；M1 保留 `<a download>` 可先不申请。

### 4.3 GM 兼容层

```js
// gm-adapter.js（示意）
const IS_EXT = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

let _storageCache = Object.create(null);

async function preloadStorage() {
  if (!IS_EXT) return;
  _storageCache = await chrome.storage.local.get(null);
}

function GM_getValue(key, def) {
  if (!IS_EXT) return globalThis.GM_getValue(key, def);
  return Object.prototype.hasOwnProperty.call(_storageCache, key) ? _storageCache[key] : def;
}

function GM_setValue(key, val) {
  if (!IS_EXT) return globalThis.GM_setValue(key, val);
  _storageCache[key] = val;
  chrome.storage.local.set({ [key]: val });   // 异步写入，失败只影响持久化，不影响本次会话
}

function GM_addStyle(css) {
  if (!IS_EXT) return globalThis.GM_addStyle(css);
  const style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return style;
}
```

要点：

- `chrome.storage.local.get(null)` 一次读全量，建立同步内存镜像，后续 `GM_getValue` 全部命中缓存，
  **业务代码里的 23 处读取不需要逐处改成 await**。
- `GM_setValue` 保持「同步更新内存 + 异步落盘」，与现有「变量先改、再写存储」的代码习惯一致。
- 可选优化：对文件夹数据的频繁写入做 100–200 ms debounce，减少 `storage.local.set` 次数。
- 存储键名保持 `deepseek_*` 不变，便于未来做导入/导出与双端对照。

### 4.4 启动时序改造（唯一必须动源码的地方）

现状：

```js
let foldThreshold = GM_getValue(...);   // 顶层同步
...
const folderUnit = (() => { let data = loadData(); ... })();  // 顶层立即执行
GM_registerMenuCommand(...); GM_addStyle(`...`);
...
init();
```

改为：

```js
async function bootstrap() {
    await preloadStorage();          // 扩展下异步；userscript 下立即 resolve
    initSettings();                  // 原顶层 20 余行 GM_getValue
    createFolderUnit();              // 原 folderUnit IIFE 改为函数，在此调用
    registerMenu();                  // 扩展下改为 chrome.runtime.onMessage 监听
    injectStyles();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}
bootstrap();
```

影响面评估：

- 顶层变量声明改成 `let` + `initSettings()` 赋值，约 30 行；
- `folderUnit` 从 IIFE 改为工厂函数，约 5 行结构调整（内部逻辑不变）；
- `GM_registerMenuCommand` 的两处调用替换为消息监听；
- 其余 7000 行业务逻辑不动。

这是整个迁移中**唯一有回归风险的改动**，需要重点回归：首屏设置生效、文件夹数据加载、
旧键迁移（`deepseek_table_width_mode`）、面板打开/重建。

### 4.5 菜单命令的替代

现有两个命令：`脚本设置`、`导出对话`。

推荐组合：

1. **工具栏 popup**（主入口）：
   ```js
   // popup.js
   const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
   const ok = tab?.url?.startsWith('https://chat.deepseek.com/');
   // 两个按钮：打开设置 / 导出对话
   chrome.tabs.sendMessage(tab.id, { type: 'ds-toolbox', action: 'open-panel' });
   ```
2. **content script 消息监听**：
   ```js
   chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
       if (msg?.type !== 'ds-toolbox') return;
       if (msg.action === 'open-panel') openControlPanel();
       if (msg.action === 'export-chat') mdExportUnit.beginExportFlow();
       sendResponse({ ok: true });
   });
   ```
3. 可选：`chrome.commands` 提供快捷键（如 `Ctrl+Shift+E` 导出对话），但需处理与页面快捷键冲突。
4. 页面内已有入口（面板导航、表格/代码块按钮），popup 只是补齐原菜单能力。

注意：`chrome.tabs.sendMessage` 在页面刚加载、content script 尚未注入时会 reject，
popup 需要 try/catch 并提示「请刷新页面后重试」。

### 4.6 html2canvas 本地化

- 在 `package.json` 中锁定 `html2canvas@1.4.1`，esbuild 打包进 `content.js`（约 +200 KB min）。
- 代码中的 `window.html2canvas` 需要改为模块内引用。最小改动：在 bundle 入口写
  `window.html2canvas = html2canvas;`（content script 的 ISOLATED world 内可见），
  这样 7000 行里的两处 `window.html2canvas` 不用改。
- 保留版本锁定，html2canvas 1.4.1 已多年未更新，但现有导出代码依赖其渲染细节，迁移期不换库。

### 4.7 图标与远程资源本地化

- 控制面板的 `api.iconify.design/mdi:*` 图片改为本地 SVG（约 20 个图标），
  可内联为 data URI 或放 `icons/mdi/` 并在构建时内联。
- 扩展图标需本地 16/32/48/128 PNG。**不要直接使用 DeepSeek favicon**（商标风险），
  建议自绘一个中性工具箱图标。
- 面板「关于页」的前置条件文案需要从「安装 Tampermonkey / ScriptCat」改为「本扩展」。

### 4.8 下载与剪贴板

- `<a download>` + Blob 在 content script 中预期可用，M1 原样保留，实测后再决定是否换
  `chrome.downloads`（更可靠、能感知失败，但要加权限）。
- `navigator.clipboard.write` 在 content script 中需要用户手势与页面焦点，现有代码已有
  `canCopyImage()` 兜底，行为与 userscript 基本一致；若实测失败，可申请 `clipboardWrite`
  权限或改为 `chrome.offscreen` + `document.execCommand('copy')`（复杂度高，非必要不做）。

---

## 5. 存储方案与数据迁移

### 5.1 存储选型

| 数据 | 建议位置 | 理由 |
| --- | --- | --- |
| 20+ 个设置项 | `chrome.storage.local` | 简单、无同步配额压力；写入频率低 |
| 文件夹/归属数据 | `chrome.storage.local` | 可能随会话增长，`sync` 的 8 KB/项限制不适合 |
| 导出偏好（JSON 字符串） | `chrome.storage.local` | 与现有键一致 |

若未来要多设备同步设置，可把「设置项」镜像到 `chrome.storage.sync`，文件夹数据仍留在 local；
但需要处理冲突合并，M1 不建议做。

### 5.2 旧数据能否自动迁移？

**不能。** Tampermonkey / ScriptCat 的 `GM_setValue` 数据存储在各自扩展的私有 IndexedDB 中，
其他扩展无法访问；Manifest 也没有跨扩展存储读取能力。

**已确认决策（2026-10-18）：暂不投入做旧设置导入。** 设置项数量不多、重新配置成本低，
M1–M4 均不实现导出/导入功能；扩展首次安装页只需说明「设置需要在扩展内重新配置」。

背景：技术上唯一可行的迁移路径是「userscript 导出 JSON → 扩展粘贴导入」，
需要两端各加一段 UI（约 0.5–1 天）。若后续用户反馈强烈，可作为独立小版本追加。
跨扩展直接读取 TM/ScriptCat 存储属于越权，始终不采用。

### 5.3 双端并存策略

- 扩展与 userscript 使用同一套键名，但存储物理隔离，不会互相覆盖。
- 发布说明与扩展首次安装页需明确提示：**请禁用 userscript 后再启用扩展**，否则会重复注入。
- 可选增强：扩展启动时检测页面上是否已有 `#ds-control-panel-overlay` 或重复按钮，
  在控制台/页面角标提示「检测到用户脚本版本同时运行」。

---

## 6. 构建、测试与发布

### 6.1 构建

推荐 **esbuild**（零配置、单文件输出、快）：

```js
// extension/build.mjs（示意）
import { build } from 'esbuild';
await build({
  entryPoints: ['extension/src/content-entry.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['chrome111'],
  outfile: 'dist/content.js',
});
// 复制 manifest / popup / icons 到 dist/
```

`content-entry.js` 负责：注入 GM 兼容层 → 引入 html2canvas 并挂到 `window` → 引入
`deepseektool.user.js`（去掉 UserScript 头，或保留也无害）。

需要在仓库新增 `package.json`（仅 devDependencies：esbuild、html2canvas）。
注意：当前仓库没有 npm 构建链，`tests/README.md` 也提到验证台依赖本机 jsdom；
引入构建链后要明确 Node 版本与 `npm ci` 流程。

### 6.2 测试

| 层级 | 现状 | 迁移后 |
| --- | --- | --- |
| 静态/源码审计 | `.workbuddy/research/run-all-verify.js` 13 项 | 保留；对 `deepseektool.user.js` 继续有效 |
| jsdom 行为测试 | 同上 | 保留；GM 兼容层需提供 mock 分支 |
| 扩展 e2e | 无 | 新增 Playwright：`launchPersistentContext` + `--load-extension=dist`，验证注入、面板、导出 |
| 真实环境 | 人工在 DeepSeek 页面验证 | 必须保留，DeepSeek DOM 变化频繁 |

M1 的最低验收：在 Chrome 开发者模式加载 `dist/`，chat.deepseek.com 上
「设置面板可开、设置可持久化、代码块/表格/对话导出可用、刷新后设置不丢」。

### 6.3 发布

- **Chrome Web Store**：$5 开发者账号；需要隐私政策（声明不收集数据）、截图、权限理由
  （`storage` + `chat.deepseek.com` host 权限）、单用途说明。
- 审核关注点：
  - 远程代码：html2canvas 已本地打包，合规；
  - 远程图片：iconify 图标建议本地化，减少解释成本；
  - 商标：名称可描述兼容性，但不要用官方 logo、不要暗示官方出品；
  - 权限最小化：只申请实际使用的域名与 API。
- **发布范围（已确认）**：只上 Chrome Web Store；Edge Add-ons、Firefox、Safari 暂不提交。
- **版本号（已确认）**：扩展使用**独立版本线**，从 `0.1.0` 起步，不与 userscript 的
  `5.x` 同号。理由：两者发布节奏与审核周期不同，同号会强迫 userscript 跟着扩展的
  审核等待节奏走。CWS 每次上传仍必须递增扩展版本号。
- **更新**：CWS 自动更新有审核延迟（数小时到数天），与 userscript 的即时 Release 不同；
  这也是保留 userscript 渠道的主要原因之一。
- **GitHub Release**：现有 `.github/workflows/release.yml` 可增加一个 job 构建
  `deepseektool-extension-v0.1.0.zip` 并附加到 Release，方便无法访问商店的用户手动加载。
- **非商店分发**：提供 zip + 「加载已解压的扩展程序」说明；不建议自托管 CRX
  （Chrome 对非商店扩展限制多，且更新体验差）。

### 6.4 多浏览器（暂不做）

- **已确认**：当前只提交 Chrome Web Store，Edge / Firefox / Safari 不在本轮范围。
- Chromium 内核（Edge / Brave / Vivaldi）理论上可复用同一 MV3 包，后续若要提交只需各商店走一遍审核。
- Firefox MV3 差异较大（service worker 生命周期、`browser.*` 命名空间、host 权限授权方式），
  届时用 `webextension-polyfill` 抹平；Safari 优先级最低。

---

## 7. 分阶段实施计划

| 阶段 | 内容 | 预估 | 风险 |
| --- | --- | --- | --- |
| M0 | 本调研 + 方案确认 | 已完成 | — |
| M1 | 骨架：manifest / popup / 兼容层 / 异步 bootstrap / html2canvas 打包；能加载并跑通核心功能 | 2–3 天 | **存储异步化的初始化回归** |
| M2 | 菜单替代、图标本地化、关于页文案、下载/剪贴板实测与兜底 | 1–2 天 | 中低 |
| M3 | 双注入提示、Playwright e2e、回归验证台、真实页面实测 | 3–5 天 | 中 |
| M4 | 商店材料（隐私政策、截图、权限说明）、zip 发布、GitHub Release job | 1–2 天 + 审核等待 | 审核不确定 |

> 单人估算总计约 1.5–2 周（不含商店审核等待）。M1 结束时即可判断是否继续投入。

---

## 8. 风险清单与待实测项

### 8.1 技术风险

| # | 风险 | 影响 | 缓解 |
| --- | --- | --- | --- |
| 1 | 存储异步化改变初始化顺序 | 设置不生效、文件夹数据丢失 | 只改 bootstrap；加启动快照日志；重点回归旧键迁移 |
| 2 | 页面 CSP / Trusted Types 限制 `innerHTML` / `<style>` | 面板或样式失效 | 现有 userscript 已同环境运行，迁移后预期一致；M1 实测 |
| 3 | `<a download>` 在 content script 中被拦截 | 导出无文件 | 保留兜底提示；必要时改 `chrome.downloads` |
| 4 | `navigator.clipboard.write` 权限/焦点失败 | 复制图片失败 | 现有 `canCopyImage()` 已兜底；必要时申请 `clipboardWrite` |
| 5 | 与 userscript 同时运行 | 重复按钮、事件双触发、设置分裂 | 文档强提示 + 页面内检测提示 |
| 6 | 扩展更新有审核延迟 | 页面改版后修复不及时 | 保留 userscript 渠道；小步发布 |
| 7 | 源码提取式测试被破坏 | 回归覆盖下降 | M1 不拆文件；测试 harness 增加扩展构建产物分支 |
| 8 | 远程图标/字体被广告拦截或 CSP 阻止 | 面板图标缺失 | 图标本地化 |
| 9 | `chrome.storage.local` 写入频率 | 文件夹高频操作时 IO 抖动 | 写入 debounce；文件夹数据合并写 |
| 10 | 商店审核（商标/权限/远程资源） | 上架受阻 | 权限最小化、图标本地化、名称避免官方暗示 |

### 8.2 需要实机验证的问题

1. content script 插入的 `<style>` 是否被 DeepSeek 页面 CSP 限制（预期不受限）。
2. `Blob` + `<a download>` 在扩展 content script 中是否正常触发下载。
3. `navigator.clipboard.write([ClipboardItem])` 在扩展环境是否需要额外权限。
4. 离屏 `iframe.srcdoc` + html2canvas 在扩展中是否与 userscript 一致。
5. `chrome.storage.local.set` 在高频写入（拖动表格、文件夹操作）下的延迟与配额。
6. 扩展 popup 在 SPA 路由切换后能否稳定触达 content script。
7. 扩展与 userscript 同时启用时的具体冲突表现（用于编写提示文案）。
8. DeepSeek 页面的 `Content-Security-Policy` 响应头（本次 `curl` 被 429 拦截，未取到）。

---

## 9. 决策记录

已确认（2026-10-18）：

| # | 决策 | 结论 |
| --- | --- | --- |
| 1 | 发布渠道 | **保留 userscript 渠道**；扩展只上 Chrome Web Store，Edge/Firefox/Safari 暂不提交 |
| 2 | 旧设置迁移 | **不做**。设置项少、重配成本低；扩展内重新配置即可 |
| 3 | 图标 | **自绘中性图标**，不使用 DeepSeek 官方视觉元素；具体方案见第 11 节 |
| 4 | 版本号 | **扩展独立版本线**，从 `0.1.0` 起步，不与 userscript `5.x` 同号 |
| 5 | 域名范围 | 扩展只申请 `chat.deepseek.com`（权限最小化，推荐方案） |

暂缓/未定：

6. **设置多设备同步**：M1 不做 `chrome.storage.sync`，后续根据反馈再评估。
7. **扩展上架时间**：先把 M1 可加载包做出来，实机验证通过后再准备商店材料。

---

## 10. 结论

- 这个脚本**非常适合**迁移到 MV3：没有 `unsafeWindow`、没有跨域请求、没有后台常驻逻辑，
  核心是纯 DOM/CSS 操作，content script 可以原样承载。
- 真正的工作量只有三块：**异步存储引导**、**菜单入口替代**、**依赖与图标本地化**。
- 最大的隐性成本不是技术，而是：**两套发行渠道的长期维护**、**商店审核与更新节奏**；
  旧设置迁移已确认不做，用户升级时需要在扩展内重新配置。
- 建议先做 M1（2–3 天）产出可加载的扩展，用真实 DeepSeek 页面验证第 8.2 节的 8 个问题，
  再决定是否进入商店发布流程。

---

## 11. 图标方案调研（自绘）

### 11.1 约束

- Chrome 的 `manifest.icons` / `action.default_icon` 只接受位图（PNG），不接受 SVG；
  至少提供 16/32/48/128 四个尺寸。
- 图标是商店审核的商标风险点：**不能使用 DeepSeek 官方 logo、鲸鱼形象或品牌插画**，
  也不能让用户误以为这是官方扩展。
- 图标需要在 16px 下仍可辨识，因此图形必须粗、元素必须少、留白必须足。

### 11.2 生成方案对比

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| **SVG 源 + `sharp` 转 PNG** | 预编译二进制、Windows 免编译、构建链已用 Node、可复现 | 多一个 devDependency（libvips） | **采用** |
| SVG 源 + `@resvg/resvg-js` | Rust 渲染、质量高、同样预编译 | 多一个依赖，收益与 sharp 接近 | 备选 |
| `node-canvas` 绘制 | 纯 JS API 灵活 | Windows 需要 native 编译，CI 成本高 | 不采用 |
| ImageMagick / Inkscape | 无 Node 依赖 | 外部工具不可复现，CI 需额外安装 | 不采用 |
| 在线工具导出 PNG | 快 | 不可复现、无法随仓库演进、审核溯源差 | 不采用 |

### 11.3 设计与实现

- 设计：中性深蓝渐变圆角方块 + 白色对话气泡 + `</>` 代码符号。
  语义上对应"对话页的代码/工具增强"，与 DeepSeek 官方视觉元素无关联。
- 源文件：`extension/icons/icon.svg`（512×512，唯一需要提交的图标源）。
- 构建：`extension/build.mjs` 用 `sharp(svg).resize(size).png()` 生成
  `dist/icons/{16,32,48,128}.png`，PNG 作为构建产物不提交。
- 验证：
  1. `sharp().metadata()` 检查四个 PNG 的宽高；
  2. 浏览器打开 SVG 与 popup 页面做视觉检查；
  3. 16px 下确认气泡轮廓仍可辨认（`</>` 细节允许在 16px 下弱化）。

### 11.4 商标与命名

- 扩展名称保留「DeepSeek 功能增强工具箱」，用于描述兼容对象，属于常见的第三方兼容性命名；
  商店描述中会明确「非官方扩展，与 DeepSeek 无隶属关系」。
- 图标、商店截图、宣传图均不使用 DeepSeek 官方 logo 或品牌色作为主视觉。

---

## 12. M1 实施记录（2026-10-18）

### 12.1 已完成

- 建立 `extension/` 骨架：`manifest.json`、popup 三件套、GM 兼容层、content 入口、构建脚本。
- 构建链：esbuild + html2canvas（本地打包）+ sharp（SVG → PNG 图标）。
- 主脚本 **零改动**：`git diff ba17c2c -- deepseektool.user.js` 为空；
  userscript 渠道不受影响。
- 扩展版本线从 `0.1.0` 起步（已确认独立于 userscript 的 `5.x`）。
- 图标源文件 `extension/icons/icon.svg`，构建时生成 `dist/icons/{16,32,48,128}.png`。
- 详细构建/加载说明见 `extension/README.md`。

### 12.2 实现方式

```
content-entry.js
  ├─ await preloadStorage()        // chrome.storage.local.get(null) → 内存缓存
  ├─ window.html2canvas = ...      // 本地打包的 html2canvas
  └─ runUserScript()               // esbuild 打包步骤把 user.js 包成函数，延迟执行

deepseektool.user.js 中的 GM_*
  └─ esbuild inject → gm-shim.js（GM_getValue/GM_setValue/GM_addStyle/GM_registerMenuCommand）
```

这样不需要把顶层 20+ 处 `GM_getValue` 改成 `await`，也不需要拆 `folderUnit` IIFE；
原有的同步初始化顺序在预加载完成后原样执行。

### 12.3 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run build` | 成功，`dist/content.js` 749.2 KB（未压缩） |
| `node --check dist/content.js` | 通过 |
| manifest 引用完整性 | content.js / popup.html / 4 个 PNG 均存在 |
| GM 符号 | 产物中 `GM_getValue` 等各只有 1 处定义，用户脚本调用可解析到 shim |
| 远程代码 | `dist/content.js` 中无 `cdn.jsdelivr.net` 引用 |
| jsdom 冒烟 | 注入 1 个 `<style>`；`html` 类为 `ds-table-auto ds-code-bg ds-code-bg-1`；`window.html2canvas` 为 function；无报错 |
| 主脚本差异 | 相对 `master` 零 diff |

### 12.4 仍未验证（需真实 Chrome）

- 扩展加载与 popup → content script 消息链路
- DeepSeek 页面 CSP 下的样式注入、下载、剪贴板
- 表格/代码块 PNG、对话导出、文件夹持久化的真实行为
- 与用户脚本同时启用时的冲突表现

### 12.5 下一步

M2：菜单/文案收尾（关于页安装条件改为扩展）、面板图标本地化、
下载与剪贴板实测兜底；随后按第 8.2 节逐项实测，通过后再准备 M4 商店材料。

### 12.6 P1 修复（2026-10-18）

- **多标签设置同步**：`gm-shim` 监听 `chrome.storage.onChanged`，更新内存缓存；
  本标签写入通过 pending 去重，不回环。主脚本新增 `loadSettings()` 与
  `applyRuntimeSettings()`，收到 `ds-storage-changed` 后重新读取并热应用
  （宽屏、表格、代码块、思考折叠、文件夹开关、面板重建）。
- **帮助页环境文案**：content-entry 在 `documentElement.dataset.dsRuntime` 标记扩展运行时；
  帮助页据此在「扩展说明」与「用户脚本安装说明」之间切换。
- **验证**：jsdom 冒烟 8/8 通过——外部修改宽屏/代码块背景即时生效、本标签写入不触发重放、
  扩展帮助文案正确；现有验证台 13 项脚本 + 版本核对全部通过。
