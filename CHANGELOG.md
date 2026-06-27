# DeepSeek 功能增强工具箱 — 更新日志

## v4.4.0 (2026-06-24)

### 新增
- **表格主题适配双方案**：解决表格硬编码浅色配色在深色模式下视觉错乱的问题
  - **方案 A「自动适应」**：使用 `rgba()` 半透明叠加色（如 `border: rgba(128,128,128,0.2)`），不区分浅色/深色，自动通透
  - **方案 B「双模式」**：通过 `body.dark` / `body:not(.dark)` 选择器为两种主题定义独立配色
  - 控制面板「表格优化导出」区新增「表格主题适配」下拉框，即时切换无需刷新
- **表格列宽策略三模式**：
  - **均分**：`table-layout: fixed` + 每列等宽（默认）
  - **自适应**：`table-layout: fixed` + 采样内容文本长度按比例分配列宽百分比
  - **均分+保护**：均分 + `min-width: 80px`，当 `80px × 列数 > 容器宽度` 时自动回落自适应并 Toast 提示
  - 控制面板「表格优化导出」区新增「表格列宽策略」下拉框
- **PNG 导出跟随主题**：`collectTableStyles` 运行时检测当前模式和 `body.dark` 状态，动态生成匹配的回退 CSS；iframe body 背景取计算值

### 修复
- **自适应模式溢出**：`table-layout: auto` 在内容较宽时无视 `max-width` 穿破容器（实测 6 列 100 行从 752px 溢出到 801px），改为 `fixed` + 内容比例分配方案彻底解决
- 移除所有无效的 `var(--ds-xxx)` CSS 变量引用（这些变量在 DeepSeek 中实际不存在，永远回落为浅色值）
- 三种列宽模式的 `width`/`maxWidth` 统一由 `applyTableStyles` 顶部提取 `maxW` 变量派发

### 架构
- `GM_addStyle` 表格 CSS 拆为三层：公共布局（无颜色）+ Plan A 规则 + Plan B 规则
- 通过 `html.ds-table-auto` / `html.ds-table-dual` 类切换，CSS 选择器自动生效
- 提取 `calcColumnWeights()` 公共函数，避免自适应和回落分支的代码重复

## v4.2.1 (2026-06-20)

### 修复（审计）
- **状态机加 done 标记**：已稳定表格不再每轮重复调用 applyTableStyles，消除冗余 reflow
- **超时 firstSeen 重置**：防止首次超时后进入永久超时状态导致每 200ms 重复应用
- **Observer 补检**：添加 `tbody`/`thead`/`tfoot` 匹配，覆盖框架批量插入场景
- **清理 wordWrap 死代码**：导出克隆清洗移除不再被设置的 wordWrap 属性

## v4.2.0 (2026-06-19)

### 优化
- **稳定性计数替代时间防抖**：表格处理从"等 500ms"改为"连续 2 次指纹不变即应用"，更精准响应；新增 5s 超时兜底
- **`overflow-wrap: anywhere`** 替代非标准 `word-break: break-word`，现代浏览器兼容更好

## v4.1.4 (2026-06-19)

### 修复
- **页面刷新后表格样式延迟**：首次见到表格立即应用样式，指纹稳定检查仅对已见过的表格生效，消除刷新后 ~500ms 的白等

## v4.1.3 (2026-06-19)

### 修复
- **PNG 导出修复**：解决表格 PNG 导出损坏问题。最终方案为隔离 iframe (srcdoc) 渲染，深克隆表格并清洗 fixed 内联样式，html2canvas 截图后通过 toBlob → blob URL 导出，导出图片中表格为 auto 布局。期间解决：data URL 截断、allowTaint canvas 污染、toBlob() 返回 null、多列 fixed 布局冲突等连锁问题。
- 新增 collectTableStyles() 自动收集页面 CSS 变量注入 iframe

## v4.1.2 (2026-06-19)

### 修复
- **表格流式输出**：新增表格指纹稳定检测，样式只在表格停止变化后才应用，解决流式输出中表格显示错乱
- MutationObserver 表格检测补全 `<tr>`/`<td>`/`<th>` 增量节点，防止仅行/列变化时漏检
- 表格处理防抖从 200ms 提升至 500ms，给流式渲染更充裕的稳定窗口

## v4.1.1 (2026-05-29)

### 修复
- 适配 DeepSeek 新版代码块按钮（`.ds-text-button` → `.code-info-button-text`），恢复折叠按钮在原生按钮组内的正常位置

## v4.1.0 (2026-05-29)

### 选择器加固
- 代码块折叠按钮容器不再依赖哈希类名，改用 `.ds-text-button` 父元素定位
- AI 思考区域改用稳定的 `.ds-think-content` 类名定位，移除 `querySelectorAll('*')` 全量扫描
- 文本扫描自动跳过 `<pre>` 和 `.md-code-block`，避免对话中的脚本源码误触发

### 功能修复
- **思考折叠回退**：关闭"模拟点击"时，改用 CSS 直接隐藏思考内容（之前该项关闭后折叠完全失效）
- **CSV 导出**：修复单元格内换行（`<br>`）被压缩消失的问题
- **表格样式**：仅修改最近的 `.ds-scroll-area` 容器，不再遍历祖先生改 `overflow`

### 性能优化
- 三个独立 MutationObserver 合并为一个，减少重复 DOM 遍历
- 表格处理增加 200ms 防抖，避免 AI 流式输出时频繁触发

### 其他
- 移除 CSS 中 `.efa13877 .ds-fold-btn` 硬编码选择器
- `deduplicateButtons` 改用按钮结构去重，不再依赖哈希类名
