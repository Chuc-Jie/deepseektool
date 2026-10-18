# 验证台

项目自带的行为测试与静态审计位于 `.workbuddy/research/`。该目录被 `.gitignore` 排除，属于本机工作区；本目录只记录运行方式，便于后续迁移到版本控制。

## 运行

1. 准备 jsdom。本机装在用户级 `%USERPROFILE%\.workbuddy\binaries\node\workspace\node_modules`；`run-all-verify.js` 会自动探测该路径。其他环境安装 jsdom 后设置 `NODE_PATH` 指向其 `node_modules`。**直接单跑某个 jsdom 测试时务必显式设置 `NODE_PATH`**，否则会报 `Cannot find module 'jsdom'`（v5.7.2 修正文档路径）。
2. 在仓库根运行：

   ```bash
   node .workbuddy/research/run-all-verify.js
   ```

脚本已改为基于 `__dirname` 的相对路径，不再依赖本机绝对目录。可用以下环境变量覆盖：

- `DSTOOL_SRC=<path>`：指定待测 `deepseektool.user.js`
- `GIT=<path>`：指定 `git` 可执行文件（反向对照使用）
- `NODE_PATH=<path>`：指定 jsdom 所在 `node_modules`

## 当前覆盖

`run-all-verify.js` 的 13 项脚本 + 版本核对：

1. 语法校验
2. 方案一致性审计
3. 代码导图专项审计
4. CSS 作用域 / 自包含
5. 代码导图 jsdom（含反向对照）
6. 按钮次序 jsdom（含反向对照）
7. 既有静态审计
8. 红线禁用词扫描
9. 对话导出回归
10. 表格列宽分配（性质断言 + 反向对照）
11. 设置面板依赖 / reset 覆盖面
12. 面板↔弹窗令牌同值
13. 表格宽度失效链路（宽屏 / resize / ResizeObserver → 重算 + 按钮定位 + 引用计数；13 条断言 + 反向对照）
14. 5 处版本号一致性

## 已知限制

- `.workbuddy/research/` 仍未纳入 git；外部贡献者 / CI 需要先把核心脚本迁入版本控制（或调整 `.gitignore`）。这一步涉及是否公开内部验证脚本的决策。
- 部分脚本依赖本机 jsdom；未安装时 jsdom 相关项会失败。
