# Chrome MV3 扩展（M1 骨架）

这是 `deepseektool.user.js` 的 Chrome 扩展发行壳。**业务源码仍然只有仓库根目录的
`deepseektool.user.js`**，扩展通过构建脚本把同一份源码打包进来，不维护第二份实现。

## 构建

```bash
npm install          # 首次
npm run build        # 产出 dist/
npm run watch        # 监听源码，自动重建
npm run build:min    # 压缩版
```

要求 Node 18+（当前开发环境 Node 24）。构建依赖：esbuild、html2canvas、sharp。

## 本地加载

1. 打开 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本仓库的 `dist/` 目录
4. 打开或刷新 `https://chat.deepseek.com/`

修改源码后重新 `npm run build`，再到扩展页点击刷新按钮，并刷新 DeepSeek 页面。

## 目录

```
extension/
  manifest.json        MV3 声明（storage + chat.deepseek.com）
  popup.html/css/js    工具栏入口：打开设置面板 / 导出对话
  icons/icon.svg       品牌图标源（齿轮 + 鲸鱼融合；构建生成 PNG，popup/面板复用）
  src/gm-shim.js       GM_* → chrome.* 兼容层
  src/content-entry.js 预加载存储 → 挂载 html2canvas → 执行用户脚本
  build.mjs            esbuild 构建脚本
dist/                  构建产物（gitignore），加载扩展时选它
```

## 关键设计

- **单一源码**：扩展与 userscript 共用 `deepseektool.user.js`，通过兼容层与少量运行时分支适配，不维护第二份业务实现。
- **GM_* 兼容层**：通过 esbuild `inject` 把 `GM_getValue` / `GM_setValue` /
  `GM_addStyle` / `GM_registerMenuCommand` 绑定到 `src/gm-shim.js`。
- **存储预加载**：`chrome.storage.local.get(null)` 一次读入内存，`GM_getValue` 保持同步语义；
  `runUserScript()` 在预加载完成后才执行，避免顶层设置读取拿到默认值。
- **跨标签同步**：`chrome.storage.onChanged` 更新内存缓存并派发 `ds-storage-changed`，
  主脚本据此重新读取设置并热应用；本标签写入通过回环去重，不会重建面板。
- **环境文案**：content-entry 在页面根节点标记扩展运行时，帮助页自动切换为扩展版说明。
- **本地依赖**：html2canvas 打包进 `content.js`，无远程代码；扩展图标由 SVG 生成 PNG，
  面板/表格图标内联为 data URI，不请求第三方图标服务。
- **菜单替代**：popup 通过 `chrome.tabs.sendMessage` 触发原 `GM_registerMenuCommand` 的两个命令。

## 与用户脚本的关系

两者功能相同、存储互相隔离，**请二选一启用**。同时开启会重复注入按钮与监听器。
扩展版本号独立（当前 `0.1.0`），不跟随 userscript 的 `5.x`。

## M1 验证状态

已通过：

- `npm run build` 成功，`dist/content.js` 约 750 KB（未压缩）
- `node --check dist/content.js` 语法通过
- manifest 引用完整性检查通过
- jsdom 冒烟：样式注入、`html` 类名初始化、`window.html2canvas` 挂载均正常
- 主脚本 `deepseektool.user.js` 相对 `master` 零 diff

尚待实机验证（需要真实 Chrome + DeepSeek 页面）：

- 扩展能否正常加载、popup 能否触达 content script
- 页面 CSP 下 `<style>` 注入、`<a download>`、剪贴板图片复制
- 表格/代码块 PNG 导出、对话导出、文件夹数据持久化
- 与用户脚本同时启用时的冲突表现

更完整的调研与决策记录见 `../research/chrome-mv3-migration.md`。
