# DeepSeek 功能增强工具箱 — 更新日志

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
