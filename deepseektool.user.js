// ==UserScript==
// @name         DeepSeek 功能增强工具箱
// @namespace    https://github.com/Chuc-Jie/deepseektool
// @version      4.8.0
// @description  一站式管理：代码块折叠、表格优化导出、自动折叠AI思考过程、对话文件夹分组。所有设置即时生效，选择器全面加固。
// @tag          工具
// @tag          优化
// @tag          DeepSeek
// @author       友野YouyEr
// @icon         https://fe-static.deepseek.com/chat/favicon.svg
// @match        https://chat.deepseek.com/*
// @match        https://www.deepseek.com/*
// @match        https://deepseek.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @require      https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 存储键与全局变量 ====================
    const STORAGE_FOLD_THRESHOLD = 'deepseek_fold_threshold';
    const STORAGE_PREVIEW_LINES = 'deepseek_fold_preview_lines';
    const STORAGE_TABLE_BUTTONS_ENABLED = 'deepseek_table_buttons_enabled';
    const STORAGE_TABLE_BUTTONS_ALWAYS = 'deepseek_table_buttons_always';  // 导出按钮恒定显示（默认关）
    const STORAGE_AUTO_COLLAPSE_THINKING = 'deepseek_auto_collapse_thinking';
    const STORAGE_SIMULATE_CLICK_THINKING = 'deepseek_simulate_click_thinking';
    const STORAGE_TABLE_THEME_MODE = 'deepseek_table_theme_mode';
    const STORAGE_TABLE_WIDTH_MODE = 'deepseek_table_width_mode';
    const STORAGE_WIDE_SCREEN = 'deepseek_wide_screen';
    const STORAGE_FOLDER_MANAGER = 'deepseek_folder_manager_enabled';   // 对话文件夹管理总开关（默认关）
    const STORAGE_FOLDER_DATA = 'deepseek_folder_manager_data_v2';      // 文件夹+归属数据（新键，不与旧独立脚本互相干扰）
    const STORAGE_CTRL_ENTER = 'deepseek_ctrl_enter';                   // 发送快捷键：Ctrl+Enter（默认关）

    let foldThreshold = GM_getValue(STORAGE_FOLD_THRESHOLD, 20);
    let previewLines = GM_getValue(STORAGE_PREVIEW_LINES, 0);
    let enablePreviewLines = previewLines > 0;
    let tableButtonsEnabled = GM_getValue(STORAGE_TABLE_BUTTONS_ENABLED, true);
    let tableButtonsAlways = GM_getValue(STORAGE_TABLE_BUTTONS_ALWAYS, false);  // 导出按钮恒定常显（默认关）
    let autoCollapseThinking = GM_getValue(STORAGE_AUTO_COLLAPSE_THINKING, true);
    let simulateClickThinking = GM_getValue(STORAGE_SIMULATE_CLICK_THINKING, true);
    let tableThemeMode = GM_getValue(STORAGE_TABLE_THEME_MODE, 'auto');
    let tableWidthMode = GM_getValue(STORAGE_TABLE_WIDTH_MODE, 'equal');
    let wideScreen = GM_getValue(STORAGE_WIDE_SCREEN, false);
    let folderManagerEnabled = GM_getValue(STORAGE_FOLDER_MANAGER, false);  // 对话文件夹管理（默认关，opt-in）
    let ctrlEnterEnabled = GM_getValue(STORAGE_CTRL_ENTER, false);          // Ctrl+Enter 发送（默认关，opt-in）

    const btnTextFold = '折叠';
    const btnTextUnfold = '展开';

    // ==================== SVG 图标 (代码块折叠) ====================
    const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/></svg>`;
    const ICON_CHEVRON_UP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/></svg>`;

    // ==================== 通用 Toast ====================
    function showToast(message, duration = 2000) {
        const existingToast = document.getElementById('ds-fold-toast');
        if (existingToast) existingToast.remove();
        const toast = document.createElement('div');
        toast.id = 'ds-fold-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); color: white;
            padding: 10px 20px; border-radius: 8px; font-size: 14px;
            font-family: system-ui, -apple-system, sans-serif; z-index: 10001;
            opacity: 0; transition: opacity 0.2s; pointer-events: none; white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '1', 10);
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 200); }, duration);
    }

    // ==================== 发送快捷键：Ctrl+Enter 发送 / Enter 换行（可开关，默认关） ====================
    // 来自社区 PR（wha4up）并在 v4.7.0 复核。DeepSeek 原生为“Enter 发送、Shift+Enter 换行”；
    // 开启后：纯 Enter → stopPropagation 让官方改用“仅换行”；Ctrl/Cmd+Enter → 以不带修饰的 Enter 事件
    // 再次触发，让官方按 Enter(发送/换行)处理，从而在打字区按【Ctrl+Enter】等效发送。
    let _supressNextEnter = false;
    document.addEventListener('keydown', (e) => {
        if (!ctrlEnterEnabled) return;
        if (e.target && e.target.tagName !== 'TEXTAREA') return;
        if (e.key !== 'Enter') return;
        if (_supressNextEnter) { _supressNextEnter = false; return; }
        if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd+Enter → 视同 Enter（发送/换行取决于表单当前语义），不携带 ctrl/meta
            e.preventDefault();
            e.stopPropagation();
            _supressNextEnter = true;
            e.target.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
                bubbles: true, cancelable: true, composed: true,
                ctrlKey: false, metaKey: false, shiftKey: false,
            }));
        } else if (!e.shiftKey) {
            // 开启模式下把“纯 Enter”改视为换行，不再发送
            e.stopPropagation();
        }
        // Shift+Enter 保持原生语义（换行）不做拦截
    }, true);
    // ==================== 统一控制面板 ====================
    function openControlPanel() {
        const existingOverlay = document.getElementById('ds-control-panel-overlay');
        if (existingOverlay) existingOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ds-control-panel-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.45); backdrop-filter: blur(6px);
            z-index: 10001; display: flex; align-items: center; justify-content: center;
        `;

        const panel = document.createElement('div');
        panel.className = 'ds-panel';

        /* ===== 左侧导航 ===== */
        const sidebar = document.createElement('aside');
        sidebar.className = 'ds-p-sidebar';

        const NAV_ITEMS = [
            { key: 'fold', icon: 'code-tags', label: '代码块折叠' },
            { key: 'table', icon: 'table-large', label: '表格优化导出' },
            { key: 'thinking', icon: 'brain', label: 'AI 思考折叠' },
            { key: 'wide', icon: 'monitor', label: '宽屏模式' },
            { key: 'chat', icon: 'send', label: '聊天发送' },
            { key: 'folder', icon: 'folder-outline', label: '对话文件夹' },
        ];
        const NAV_EXTRA = [
            { key: 'help', icon: 'help-circle-outline', label: '帮助中心' },
            { key: 'about', icon: 'information-outline', label: '关于' },
        ];

        // iconify 图标：左侧导航 / logo（深蓝底固定亮色）；右侧标题需随主题取色
        const ICON_HOST = 'https://api.iconify.design/mdi:';
        const isPanelDark = () => document.body.classList.contains('dark');
        const mdiNavUrl = (name) => ICON_HOST + name + '.svg?color=%23e6eaf2';
        const mdiHeadUrl = (name) => ICON_HOST + name + '.svg?color=' + (isPanelDark() ? '%23e4e4e8' : '%231e293b');
        function makeIconImg(name, cls, url) {
            const im = document.createElement('img');
            im.className = cls; im.src = url(name); im.alt = '';
            im.draggable = false;
            return im;
        }

        // 外链卡片（帮助/关于页）：整卡可点跳外链，target=_blank
        function createLinkCard(title, desc, href, iconName) {
            const a = document.createElement('a');
            a.className = 'ds-link-card';
            a.href = href;
            a.target = '_blank';
            a.rel = 'noopener';
            a.appendChild(makeIconImg(iconName, 'ds-link-card-ic', mdiHeadUrl));
            const tx = document.createElement('span');
            tx.className = 'ds-link-card-tx';
            const t = document.createElement('span');
            t.className = 'ds-link-card-title';
            t.textContent = title;
            tx.appendChild(t);
            if (desc) {
                const d = document.createElement('span');
                d.className = 'ds-link-card-desc';
                d.textContent = desc;
                tx.appendChild(d);
            }
            a.appendChild(tx);
            return a;
        }
        function createLinkCardGrid(cards) {
            const g = document.createElement('div');
            g.className = 'ds-link-grid';
            cards.forEach(c => g.appendChild(c));
            return g;
        }

        const logo = document.createElement('div');
        logo.className = 'ds-p-logo';
        const logoIc = document.createElement('span');
        logoIc.className = 'ds-p-logo-ic';
        logoIc.appendChild(makeIconImg('cog', 'ds-p-logo-ic-img', mdiNavUrl));
        const logoTx = document.createElement('div');
        logoTx.className = 'ds-p-logo-tx';
        logoTx.innerHTML = '<div class="ds-p-logo-t">脚本设置</div><div class="ds-p-logo-s">DeepSeek 功能增强工具箱</div>';
        logo.appendChild(logoIc);
        logo.appendChild(logoTx);
        sidebar.appendChild(logo);

        const navBtns = [];
        function renderNav(items) {
            items.forEach(item => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ds-p-nav';
                btn.dataset.target = item.key;
                const ind = document.createElement('span');
                ind.className = 'ds-p-nav-ind';
                const bd = document.createElement('span');
                bd.className = 'ds-p-nav-bd';
                bd.appendChild(makeIconImg(item.icon, 'ds-p-nav-ic', mdiNavUrl));
                const lab = document.createElement('span');
                lab.className = 'ds-p-nav-label';
                lab.textContent = item.label;
                bd.appendChild(lab);
                btn.appendChild(ind);
                btn.appendChild(bd);
                sidebar.appendChild(btn);
                navBtns.push(btn);
            });
        }
        renderNav(NAV_ITEMS);
        const navDivider = document.createElement('div');
        navDivider.className = 'ds-p-nav-divider';
        sidebar.appendChild(navDivider);
        renderNav(NAV_EXTRA);
        panel.appendChild(sidebar);

        /* ===== 右侧主区 ===== */
        const main = document.createElement('div');
        main.className = 'ds-p-main';

        const topbar = document.createElement('div');
        topbar.className = 'ds-p-topbar';
        const closeX = document.createElement('button');
        closeX.type = 'button';
        closeX.className = 'ds-p-close';
        closeX.textContent = '✕';
        closeX.setAttribute('aria-label', '关闭设置');
        closeX.addEventListener('click', () => overlay.remove());
        topbar.appendChild(closeX);
        main.appendChild(topbar);

        const scroll = document.createElement('div');
        scroll.className = 'ds-p-scroll';

        /* ===== 分区定义（控件工厂返回完整行式 .ds-setting-item） ===== */
        const sections = [
            { key: 'fold', icon: 'code-tags', title: '代码块折叠', sub: '长代码自动收起，随手展开', build: () => [
                createNumberSetting('自动折叠阈值', '代码行数超过该值时自动折叠（0 = 禁用）', '行', foldThreshold, value => {
                    foldThreshold = value;
                    GM_setValue(STORAGE_FOLD_THRESHOLD, value);
                    reapplyFoldToAllCodeBlocks();
                    showToast(`折叠阈值已更新为 ${value === 0 ? '关闭' : value}`);
                }),
                createNumberSetting('折叠预览行数', '折叠后显示的行数（0 = 完全隐藏）', '行', previewLines, value => {
                    previewLines = value;
                    enablePreviewLines = value > 0;
                    GM_setValue(STORAGE_PREVIEW_LINES, value);
                    reapplyFoldToAllCodeBlocks();
                    showToast(`预览行数已更新为 ${value === 0 ? '关闭（完全隐藏）' : value}`);
                }),
            ] },
            { key: 'table', icon: 'table-large', title: '表格优化导出', sub: '宽度修复 · 主题配色 · PNG / CSV / Markdown 导出', build: () => [
                createToggleSetting('表格导出按钮', '悬停表格显示 📸 📄 📝 导出按钮', tableButtonsEnabled, checked => {
                    tableButtonsEnabled = checked;
                    GM_setValue(STORAGE_TABLE_BUTTONS_ENABLED, checked);
                    toggleTableButtons(checked);
                    showToast(`表格导出按钮已${checked ? '开启' : '关闭'}`);
                }),
                createToggleSetting('持续显示导出按钮', '无需悬停，表格上的导出按钮始终可见（需上一项开启）', tableButtonsAlways, checked => {
                    tableButtonsAlways = checked;
                    GM_setValue(STORAGE_TABLE_BUTTONS_ALWAYS, checked);
                    setTableButtonsAlways(checked);
                    showToast(`导出按钮已改为${checked ? '常显' : '悬停显示'}`);
                }),
                createSelectSetting('表格主题适配', '自动：半透明叠加色通用 · 双模式：浅色/深色各自优化', [
                    { value: 'auto', label: '自动适应（透明叠加）' },
                    { value: 'dual', label: '双模式（浅色 / 深色）' },
                ], tableThemeMode, value => {
                    tableThemeMode = value;
                    GM_setValue(STORAGE_TABLE_THEME_MODE, value);
                    applyTableThemeClass(value);
                    showToast(`表格主题已切换为${value === 'auto' ? '自动适应' : '双模式'}`);
                }),
                createSelectSetting('表格列宽策略', '均分：等宽 · 自适应：按内容比例 · 均分+保护：等宽且不低于 80px', [
                    { value: 'equal', label: '均分列宽' },
                    { value: 'auto', label: '自适应（内容比例）' },
                    { value: 'equal-minwidth', label: '均分 + 最小宽度保护' },
                ], tableWidthMode, value => {
                    tableWidthMode = value;
                    GM_setValue(STORAGE_TABLE_WIDTH_MODE, value);
                    document.querySelectorAll('.ds-markdown table').forEach(t => applyTableStyles(t));
                    showToast('列宽策略已切换');
                }),
            ] },
            { key: 'thinking', icon: 'brain', title: 'AI 思考折叠', sub: '「已思考」区域自动收起', build: () => [
                createToggleSetting('自动折叠思考区域', 'AI 开始思考后自动收起「已思考」过程', autoCollapseThinking, checked => {
                    autoCollapseThinking = checked;
                    GM_setValue(STORAGE_AUTO_COLLAPSE_THINKING, checked);
                    reapplyThinkingSections();
                    showToast(`自动折叠思考区域已${checked ? '开启' : '关闭'}`);
                }),
                createToggleSetting('模拟点击折叠', '通过模拟点击箭头折叠（保持原生交互）；关闭后用 CSS 直接折叠', simulateClickThinking, checked => {
                    simulateClickThinking = checked;
                    GM_setValue(STORAGE_SIMULATE_CLICK_THINKING, checked);
                    showToast(`模拟点击折叠已${checked ? '开启' : '关闭'}（新产生的思考生效）`);
                }),
            ] },
            { key: 'wide', icon: 'monitor', title: '宽屏模式', sub: '消息区扩展至全宽，减少左右留白', build: () => [
                createToggleSetting('启用宽屏布局', '消息区扩展至全宽，减少左右留白', wideScreen, checked => {
                    wideScreen = checked;
                    GM_setValue(STORAGE_WIDE_SCREEN, checked);
                    applyWideScreen(checked);
                    showToast(`宽屏模式已${checked ? '开启' : '关闭'}`);
                }),
            ] },
            { key: 'chat', icon: 'send', title: '聊天发送', sub: '回车发送与快捷键', build: () => [
                createToggleSetting('Ctrl+Enter 发送', '改为 Ctrl+Enter 发送、Enter 换行；关闭时恢复官方（Enter 发送 / Shift+Enter 换行）', ctrlEnterEnabled, checked => {
                    ctrlEnterEnabled = checked;
                    GM_setValue(STORAGE_CTRL_ENTER, checked);
                    if (!checked) showToast('已恢复 Enter 发送，Shift+Enter 换行');
                    else showToast('已开启 Ctrl+Enter 发送，Enter 换行');
                }),
            ] },
            { key: 'folder', icon: 'folder-outline', title: '对话文件夹', sub: '左侧历史栏分组管理（可选模块）', build: () => [
                createToggleSetting('启用文件夹分组', '在左侧对话历史栏加入「文件夹」分组面板，可通过会话 ⋯ 菜单移入/移出；关闭即整体移除（含已应用的分组/标签）', folderManagerEnabled, checked => {
                    folderManagerEnabled = checked;
                    GM_setValue(STORAGE_FOLDER_MANAGER, checked);
                    folderEnabledChanged(checked);
                }),
            ] },
            {
                key: 'help', icon: 'help-circle-outline', title: '帮助中心', sub: '前置条件 · 使用小贴士',
                build: () => [
                    createInfoIntro('前置安装条件', '请先安装以下任一用户脚本管理器，再在 DeepSeek 对话页打开本面板：'),
                    createLinkCardGrid([
                        createLinkCard('Tampermonkey（油猴）', '全球最流行的用户脚本管理器', 'https://www.tampermonkey.net/', 'shield-check-outline'),
                        createLinkCard('ScriptCat（脚本猫）', '国产脚本管理器 · 中文界面友好 · 推荐', 'https://scriptcat.org/zh-CN', 'web'),
                    ]),
                    createInfoIntro('打开方法', '点击浏览器工具栏 Tampermonkey / ScriptCat 图标 → 本脚本 →「脚本设置」'),
                    createInfoIntro('立即生效 · 自动保存', '改动设置即时生效、无需刷新；配置自动保存，下次打开页面保持。'),
                    createInfoIntro('功能失效排查', 'DeepSeek 大版本迭代可能导致个别功能失效；如遇异常欢迎反馈适配。'),
                ],
            },
            {
                key: 'about', icon: 'information-outline', title: '关于', sub: '版本 · 许可 · 相关链接 · 致谢',
                build: () => [
                    createInfoIntro('版本', 'DeepSeek 功能增强工具箱 v4.8.0'),
                    createInfoIntro('许可', 'MIT License · 完全开源，可自由使用与修改'),
                    createLinkCardGrid([
                        createLinkCard('GitHub 脚本仓库', '源码 · 更新日志 · Issues', 'https://github.com/Chuc-Jie/deepseektool', 'github'),
                        createLinkCard('ScriptCat 主页', '安装页 · 评论区', 'https://scriptcat.org/zh-CN', 'web'),
                    ]),
                    createInfoIntro('致谢', '感谢每一位反馈与建议的用户。'),
                ],
            },
        ];
        const pages = [];
        sections.forEach(sec => {
            const page = document.createElement('section');
            page.className = 'ds-p-page';
            page.dataset.page = sec.key;
            const head = document.createElement('div');
            const titleEl = document.createElement('h2');
            titleEl.appendChild(makeIconImg(sec.icon, 'ds-p-hic', mdiHeadUrl));
            const titleSpan = document.createElement('span');
            titleSpan.className = 'ds-p-title-text';
            titleSpan.textContent = sec.title;
            titleEl.appendChild(titleSpan);
            const subEl = document.createElement('div');
            subEl.className = 'ds-p-sub';
            subEl.textContent = sec.sub;
            head.appendChild(titleEl);
            head.appendChild(subEl);
            page.appendChild(head);
            sec.build().forEach(item => page.appendChild(item));
            scroll.appendChild(page);
            pages.push(page);
        });
        main.appendChild(scroll);

        // 底部操作条
        const footer = document.createElement('div');
        footer.className = 'ds-p-footer';
        footer.innerHTML = `
            <span class="ds-p-reset" id="ds-panel-reset">恢复默认设置</span>
            <button type="button" class="ds-p-btn" id="ds-panel-close-btn">关闭面板</button>
        `;
        main.appendChild(footer);
        panel.appendChild(main);

        /* ===== 分区切换 ===== */
        function showPage(key) {
            pages.forEach(p => p.classList.toggle('active', p.dataset.page === key));
            navBtns.forEach(b => b.classList.toggle('active', b.dataset.target === key));
        }
        navBtns.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.target)));
        showPage('fold');   // 默认展开第一分区

        footer.querySelector('#ds-panel-close-btn').addEventListener('click', () => overlay.remove());
        footer.querySelector('#ds-panel-reset').addEventListener('click', () => {
            if (confirm('确定恢复所有设置为默认值？')) {
                foldThreshold = 20; GM_setValue(STORAGE_FOLD_THRESHOLD, 20);
                previewLines = 0; enablePreviewLines = false; GM_setValue(STORAGE_PREVIEW_LINES, 0);
                tableButtonsEnabled = true; GM_setValue(STORAGE_TABLE_BUTTONS_ENABLED, true);
                autoCollapseThinking = true; GM_setValue(STORAGE_AUTO_COLLAPSE_THINKING, true);
                simulateClickThinking = true; GM_setValue(STORAGE_SIMULATE_CLICK_THINKING, true);
                tableThemeMode = 'auto'; GM_setValue(STORAGE_TABLE_THEME_MODE, 'auto');
                tableWidthMode = 'equal'; GM_setValue(STORAGE_TABLE_WIDTH_MODE, 'equal');
                wideScreen = false; GM_setValue(STORAGE_WIDE_SCREEN, false);
                ctrlEnterEnabled = false; GM_setValue(STORAGE_CTRL_ENTER, false);
                tableButtonsAlways = false; GM_setValue(STORAGE_TABLE_BUTTONS_ALWAYS, false); setTableButtonsAlways(false);
                if (folderManagerEnabled) {           // 默认关闭 → 恢复默认需停用并整体清理
                    folderManagerEnabled = false;
                    GM_setValue(STORAGE_FOLDER_MANAGER, false);
                    folderUnit.off();
                }
                applyTableThemeClass('auto');
                applyWideScreen(false);
                reapplyFoldToAllCodeBlocks();
                toggleTableButtons(true);
                reapplyThinkingSections();
                document.querySelectorAll('.ds-markdown table').forEach(t => applyTableStyles(t));
                showToast('已恢复默认设置');
                overlay.remove();
                setTimeout(() => openControlPanel(), 300);
            }
        });

        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
            // 点击面板外部关闭所有下拉
            if (!e.target.closest('.ds-custom-select')) {
                document.querySelectorAll('.ds-custom-select-dropdown').forEach(d => d.style.display = 'none');
            }
        });
    }

    // 控件工厂

    // 行式设置项外壳：label + 描述 在左、控件在右
    function createSettingRow(labelText, description, controlEl) {
        const item = document.createElement('div');
        item.className = 'ds-setting-item';
        const labelBlock = document.createElement('div');
        labelBlock.className = 'ds-setting-label';
        const t = document.createElement('div');
        t.className = 'ds-setting-title';
        t.textContent = labelText;
        labelBlock.appendChild(t);
        if (description) {
            const d = document.createElement('small');
            d.textContent = description;
            labelBlock.appendChild(d);
        }
        const ctrl = document.createElement('div');
        ctrl.className = 'ds-setting-ctrl';
        ctrl.appendChild(controlEl);
        item.appendChild(labelBlock);
        item.appendChild(ctrl);
        return item;
    }

    function createNumberSetting(labelText, description, unit, currentValue, onChange) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex; gap:6px; align-items:center;';
        const input = document.createElement('input');
        input.type = 'number'; input.value = currentValue; input.min = 0; input.step = 1;
        input.className = 'ds-panel-input';
        input.addEventListener('change', () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            input.value = val;
            onChange(val);
        });
        wrap.appendChild(input);
        if (unit) {
            const u = document.createElement('span');
            u.className = 'ds-panel-unit';
            u.textContent = unit;
            wrap.appendChild(u);
        }
        return createSettingRow(labelText, description, wrap);
    }

    function createToggleSetting(labelText, description, checked, onToggle) {
        const label = document.createElement('label');
        label.className = 'ds-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        if (checked) input.checked = true;
        const slider = document.createElement('span');
        slider.className = 'ds-slider';
        label.appendChild(input);
        label.appendChild(slider);
        input.addEventListener('change', () => onToggle(input.checked));
        return createSettingRow(labelText, description, label);
    }

    function createSelectSetting(labelText, description, options, selectedValue, onChange) {
        const container = document.createElement('div');
        container.className = 'ds-custom-select';
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'ds-custom-select-trigger';
        const dropdown = document.createElement('div');
        dropdown.className = 'ds-custom-select-dropdown';
        dropdown.style.display = 'none';
        let selectedLabel = '';
        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'ds-custom-select-option';
            item.textContent = opt.label;
            item.dataset.value = opt.value;
            if (opt.value === selectedValue) {
                item.classList.add('active');
                selectedLabel = opt.label;
            }
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                // 更新选中态
                dropdown.querySelectorAll('.ds-custom-select-option').forEach(o => o.classList.remove('active'));
                item.classList.add('active');
                trigger.textContent = opt.label;
                dropdown.style.display = 'none';
                onChange(opt.value);
            });
            dropdown.appendChild(item);
        });
        trigger.textContent = selectedLabel;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // 关闭所有其他下拉
            document.querySelectorAll('.ds-custom-select-dropdown').forEach(d => d.style.display = 'none');
            dropdown.style.display = 'block';
        });

        container.appendChild(trigger);
        container.appendChild(dropdown);
        return createSettingRow(labelText, description, container);
    }

    // 说明性字（帮助/关于页）：竖向小标题 + 描述段，供 build() 返回
    function createInfoIntro(labelText, text) {
        const block = document.createElement('div');
        block.className = 'ds-info';
        const h = document.createElement('div');
        h.className = 'ds-info-title';
        h.textContent = labelText;
        const p = document.createElement('div');
        p.className = 'ds-info-body';
        p.textContent = text;
        block.appendChild(h);
        block.appendChild(p);
        return block;
    }

    // 设置变动后的刷新函数
    function reapplyFoldToAllCodeBlocks() {
        document.querySelectorAll('pre').forEach(pre => {
            pre.removeAttribute('data-fold-processed');
            if (pre.dataset.origDisplay) {
                pre.style.display = pre.dataset.origDisplay;
                delete pre.dataset.origDisplay;
            }
            if (pre.dataset.origMaxHeight) {
                pre.style.maxHeight = pre.dataset.origMaxHeight;
                pre.style.overflow = pre.dataset.origOverflow || '';
                delete pre.dataset.origMaxHeight;
                delete pre.dataset.origOverflow;
            }
            pre.classList.remove('ds-fold-preview');
            const btn = pre.parentElement?.querySelector('.ds-fold-btn');
            if (btn) btn.remove();
            addFoldButtonToCodeBlock(pre);
        });
    }

    function toggleTableButtons(enabled) {
        document.querySelectorAll('.ds-markdown table').forEach(table => {
            const btnContainer = table.querySelector('.table-internal-buttons');
            if (enabled) {
                if (!btnContainer) {
                    table.removeAttribute('data-internal-buttons-added');
                    addButtonsToTable(table);
                }
            } else {
                if (btnContainer) {
                    btnContainer.remove();
                    table.removeAttribute('data-internal-buttons-added');
                }
            }
        });
    }

    function reapplyThinkingSections() {
        if (autoCollapseThinking) {
            setupThinkContentHiding();
            processAllThinkingSections();
        } else {
            // 关闭时移除预隐藏样式
            if (_thinkHideStyle) {
                _thinkHideStyle.remove();
                _thinkHideStyle = null;
            }
        }
    }

    function applyTableThemeClass(mode) {
        const html = document.documentElement;
        html.classList.remove('ds-table-auto', 'ds-table-dual');
        html.classList.add(mode === 'auto' ? 'ds-table-auto' : 'ds-table-dual');
    }

    function applyWideScreen(on) {
        document.documentElement.classList.toggle('ds-wide-screen', on);
    }

    // 导出按钮“恒显”开关：切换 html.ds-export-always 让 .table-internal-buttons 不再依赖悬停即可见
    function setTableButtonsAlways(on) {
        document.documentElement.classList.toggle('ds-export-always', !!on);
    }

    // ==================== 菜单命令 ====================
    GM_registerMenuCommand('脚本设置', openControlPanel);

    // ==================== 全局样式 ====================
    GM_addStyle(`
        /* 代码块折叠 */
        .ds-fold-btn {
            background: transparent; border: none; border-radius: 12px;
            font-size: 13px; padding: 4px 8px; cursor: pointer;
            transition: all 0.2s; font-family: system-ui, sans-serif;
            user-select: none; display: inline-flex; align-items: center; gap: 2px;
            opacity: 0.7;
        }
        .ds-fold-btn:hover { background: rgba(128,128,128,0.2); opacity: 1; }
        .ds-fold-btn .fold-icon { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }
        .ds-fold-btn svg { width: 20px; height: 20px; display: block; }
        .ds-fold-preview::after { content: " ..."; display: block; text-align: center; color: inherit; opacity: 0.6; margin-top: 4px; }

        /* ===== 设置面板 — 左右布局（深浅双主题） ===== */
        .ds-panel {
            width: min(920px, 94vw); height: min(640px, 84vh);
            display: flex; overflow: hidden;
            border-radius: 18px;
            box-shadow: 0 24px 64px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.18);
            font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            /* 浅色默认值 */
            --dsp-content-bg: #f7f8fa;
            --dsp-topbar-bg: #ffffff;
            --dsp-title: #0f172a;
            --dsp-text: #1e293b;
            --dsp-sub: #64748b;
            --dsp-line: #eef1f5;
            --dsp-ctrl-bg: #ffffff;
            --dsp-ctrl-border: #d7dce3;
            --dsp-accent: #6366f1;
            --dsp-accent-deep: #4f46e5;
            --dsp-accent-soft: rgba(99,102,241,.08);
            --dsp-switch-off: #cbd5e1;
            --dsp-scroll-thumb: rgba(100,116,139,.3);
            --dsp-scroll-thumb-hover: rgba(100,116,139,.52);
            --dsp-opt-hover: rgba(99,102,241,.06);
            --dsp-opt-active: rgba(99,102,241,.12);
            color: var(--dsp-text);
        }
        body.dark .ds-panel {
            --dsp-content-bg: #1a1a24;
            --dsp-topbar-bg: #1e1e2d;
            --dsp-title: #f1f2f6;
            --dsp-text: #e4e4e8;
            --dsp-sub: rgba(255,255,255,.46);
            --dsp-line: rgba(255,255,255,.08);
            --dsp-ctrl-bg: rgba(255,255,255,.06);
            --dsp-ctrl-border: rgba(255,255,255,.14);
            --dsp-accent-soft: rgba(99,102,241,.24);
            --dsp-switch-off: rgba(255,255,255,.22);
            --dsp-scroll-thumb: rgba(255,255,255,.16);
            --dsp-scroll-thumb-hover: rgba(255,255,255,.3);
            --dsp-opt-hover: rgba(99,102,241,.16);
            --dsp-opt-active: rgba(99,102,241,.3);
        }
        .ds-panel *, .ds-panel *::before, .ds-panel *::after { box-sizing: border-box; }

        /* 左导航 — 深蓝渐变（两主题一致） */
        .ds-p-sidebar {
            width: 224px; flex-shrink: 0;
            background: linear-gradient(180deg, #1b2437 0%, #0f1622 100%);
            display: flex; flex-direction: column; gap: 2px;
            padding: 18px 12px 16px 8px;
            overflow-y: auto; user-select: none; -webkit-user-select: none;
            scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent;
        }
        .ds-p-sidebar::-webkit-scrollbar { width: 5px; }
        .ds-p-sidebar::-webkit-scrollbar-track { background: transparent; }
        .ds-p-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,.14); border-radius: 4px; }
        .ds-p-logo {
            display: flex; align-items: center; gap: 10px;
            padding: 2px 10px 18px 12px; color: #fff;
        }
        .ds-p-logo-ic { width: 22px; height: 22px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
        .ds-p-logo-ic-img { width: 22px; height: 22px; display: block; }
        .ds-p-logo-t { font-size: 15px; font-weight: 700; letter-spacing: .2px; }
        .ds-p-logo-s { font-size: 11px; color: rgba(255,255,255,.42); margin-top: 2px; }
        .ds-p-nav {
            display: flex; align-items: center; width: 100%;
            padding: 0; border: none; background: transparent; cursor: pointer;
            font-family: inherit; text-align: left; outline: none;
        }
        .ds-p-nav-ind {
            flex-shrink: 0; width: 3px; height: 24px; border-radius: 3px;
            margin: 0 8px 0 4px; background: transparent;
            transition: background .2s ease;
        }
        .ds-p-nav-bd {
            flex: 1; display: flex; align-items: center; gap: 10px;
            padding: 9px 12px 9px 4px; border-radius: 9px;
            color: rgba(255,255,255,.62); font-size: 14px; font-weight: 500;
            transition: background .18s ease, color .18s ease;
        }
        .ds-p-nav-ic { width: 18px; height: 18px; display: block; flex: none; }
        .ds-p-nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .ds-p-nav-divider { height: 1px; background: rgba(255,255,255,.08); margin: 8px 10px 10px 16px; flex-shrink: 0; }
        .ds-p-nav:hover .ds-p-nav-bd { background: rgba(255,255,255,.06); color: #fff; }
        .ds-p-nav.active .ds-p-nav-ind { background: #818cf8; }
        .ds-p-nav.active .ds-p-nav-bd { background: rgba(99,102,241,.24); color: #fff; }

        /* 右主区 */
        .ds-p-main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--dsp-content-bg); }
        .ds-p-topbar {
            flex-shrink: 0; height: 46px;
            display: flex; align-items: center; justify-content: flex-end;
            padding: 0 14px; background: var(--dsp-topbar-bg);
            border-bottom: 1px solid var(--dsp-line);
        }
        .ds-p-close {
            border: none; background: transparent; cursor: pointer;
            color: var(--dsp-sub); font-size: 18px; line-height: 1;
            padding: 6px 8px; border-radius: 7px; transition: background .15s, color .15s;
        }
        .ds-p-close:hover { background: var(--dsp-accent-soft); color: var(--dsp-text); }
        .ds-p-scroll { flex: 1; overflow-y: auto; padding: 20px 26px 12px; scrollbar-width: thin; scrollbar-color: transparent transparent; }
        .ds-p-scroll:hover { scrollbar-color: var(--dsp-scroll-thumb) transparent; }
        .ds-p-scroll::-webkit-scrollbar { width: 8px; }
        .ds-p-scroll::-webkit-scrollbar-track { background: transparent; }
        .ds-p-scroll::-webkit-scrollbar-thumb {
            background: var(--dsp-scroll-thumb); border-radius: 999px;
            border: 2px solid transparent; background-clip: padding-box;
            transition: background .15s;
        }
        .ds-p-scroll:hover::-webkit-scrollbar-thumb { background: var(--dsp-scroll-thumb-hover); background-clip: padding-box; border-color: transparent; }

        /* 分区页 */
        .ds-p-page { display: none; }
        .ds-p-page.active { display: block; animation: dsFadeUp .28s ease forwards; }
        @keyframes dsFadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .ds-p-page h2 {
            margin: 0 0 4px; font-size: 21px; font-weight: 700;
            display: flex; align-items: center; gap: 9px;
            color: var(--dsp-title); letter-spacing: -.2px;
            user-select: none; -webkit-user-select: none;
        }
        .ds-p-hic { width: 24px; height: 24px; flex: none; }
        /* 帮助/关于：说明字块 */
        .ds-info { padding: 12px 2px; }
        .ds-info + .ds-info { border-top: 1px solid var(--dsp-line); }
        .ds-info-title { font-size: 13px; font-weight: 600; color: var(--dsp-text); margin-bottom: 4px; user-select: none; -webkit-user-select: none; }
        .ds-info-body { font-size: 13px; color: var(--dsp-sub); line-height: 1.7; user-select: text; }
        /* 帮助/关于：外链卡片组 */
        .ds-link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin: 6px 0 2px; }
        .ds-link-card {
            display: flex; align-items: center; gap: 11px;
            padding: 12px 14px; border-radius: 11px; text-decoration: none;
            background: var(--dsp-ctrl-bg); border: 1px solid var(--dsp-ctrl-border);
            transition: border-color .15s, box-shadow .15s, transform .15s;
        }
        .ds-link-card:hover { border-color: var(--dsp-accent); box-shadow: 0 0 0 3px var(--dsp-accent-soft); transform: translateY(-1px); }
        .ds-link-card-ic { width: 24px; height: 24px; flex: none; }
        .ds-link-card-tx { min-width: 0; display: flex; flex-direction: column; }
        .ds-link-card-title { font-size: 13.5px; font-weight: 600; color: var(--dsp-text); line-height: 1.3; }
        .ds-link-card-desc { font-size: 12px; color: var(--dsp-sub); margin-top: 2px; line-height: 1.45; }
        .ds-p-sub {
            font-size: 13px; color: var(--dsp-sub);
            padding-bottom: 12px; margin-bottom: 6px;
            border-bottom: 1px solid var(--dsp-line);
            user-select: text;
        }

        /* 行式设置项 */
        .ds-setting-item {
            display: flex; align-items: center; justify-content: space-between;
            gap: 20px; padding: 15px 0;
            border-bottom: 1px solid var(--dsp-line);
        }
        .ds-setting-item:last-child { border-bottom: none; }
        .ds-setting-label { min-width: 0; }
        .ds-setting-title { font-size: 14.5px; font-weight: 600; color: var(--dsp-text); user-select: none; -webkit-user-select: none; }
        .ds-setting-label small {
            display: block; margin-top: 3px; font-size: 12px; font-weight: 400;
            color: var(--dsp-sub); line-height: 1.55; user-select: text;
        }
        .ds-setting-ctrl { flex-shrink: 0; margin-left: 12px; }

        /* Switch（参考 slider 风格） */
        .ds-switch { position: relative; display: inline-block; width: 44px; height: 24px; cursor: pointer; flex-shrink: 0; }
        .ds-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
        .ds-slider {
            position: absolute; top: 0; left: 0; right: 0; bottom: 0;
            background: var(--dsp-switch-off); transition: background .2s ease; border-radius: 24px;
        }
        .ds-slider::before {
            content: ""; position: absolute; height: 18px; width: 18px;
            left: 3px; bottom: 3px; background: #fff; transition: transform .2s ease;
            border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,.22);
        }
        .ds-switch input:checked + .ds-slider { background: var(--dsp-accent); }
        .ds-switch input:checked + .ds-slider::before { transform: translateX(20px); }
        .ds-switch input:focus-visible + .ds-slider { outline: 2px solid var(--dsp-accent); outline-offset: 2px; }

        /* 数字输入 / 单位 */
        .ds-setting-ctrl input[type="number"] {
            width: 96px; padding: 7px 10px;
            border: 1px solid var(--dsp-ctrl-border); border-radius: 8px;
            background: var(--dsp-ctrl-bg); color: var(--dsp-text);
            font-size: 13.5px; font-family: inherit; outline: none;
            transition: border-color .15s, box-shadow .15s;
        }
        .ds-setting-ctrl input[type="number"]:focus {
            border-color: var(--dsp-accent);
            box-shadow: 0 0 0 3px var(--dsp-accent-soft);
        }
        .ds-panel-unit { font-size: 13px; color: var(--dsp-sub); }

        /* 自定义下拉（深浅自适应） */
        .ds-custom-select { position: relative; min-width: 178px; }
        .ds-custom-select-trigger {
            width: 100%; padding: 8px 30px 8px 12px;
            border: 1px solid var(--dsp-ctrl-border); border-radius: 8px;
            background: var(--dsp-ctrl-bg); color: var(--dsp-text);
            font-size: 13.5px; font-family: inherit; cursor: pointer;
            text-align: left; outline: none; transition: border-color .15s, box-shadow .15s;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat; background-position: right 11px center;
            -webkit-appearance: none; appearance: none;
        }
        .ds-custom-select-trigger:focus { border-color: var(--dsp-accent); box-shadow: 0 0 0 3px var(--dsp-accent-soft); }
        .ds-custom-select-dropdown {
            position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10002;
            background: var(--dsp-ctrl-bg); border: 1px solid var(--dsp-ctrl-border);
            border-radius: 9px; overflow: hidden;
            box-shadow: 0 10px 28px rgba(0,0,0,.18);
            max-height: 210px; overflow-y: auto;
        }
        .ds-custom-select-option {
            padding: 9px 12px; font-size: 13.5px; cursor: pointer;
            color: var(--dsp-text); transition: background .1s;
        }
        .ds-custom-select-option:hover { background: var(--dsp-opt-hover); }
        .ds-custom-select-option.active { background: var(--dsp-opt-active); font-weight: 600; }

        /* 底部操作条 */
        .ds-p-footer {
            flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
            padding: 12px 18px; border-top: 1px solid var(--dsp-line);
            background: var(--dsp-topbar-bg);
        }
        .ds-p-reset {
            font-size: 12.5px; color: var(--dsp-sub); cursor: pointer;
            user-select: none; -webkit-user-select: none; transition: color .15s;
        }
        .ds-p-reset:hover { color: var(--dsp-accent); }
        .ds-p-btn {
            padding: 8px 22px; border: none; border-radius: 9px;
            background: var(--dsp-accent); color: #fff;
            font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background .15s;
        }
        .ds-p-btn:hover { background: var(--dsp-accent-deep); }

        /* 响应式：窄屏导航转横排、设置项纵向 */
        @media (max-width: 640px) {
            .ds-panel { flex-direction: column; height: 92vh; }
            .ds-p-sidebar { width: 100%; flex-direction: row; flex-wrap: wrap; padding: 10px 10px 6px; overflow-y: visible; max-height: 150px; }
            .ds-p-logo { display: none; }
            .ds-p-nav { width: auto; flex: 1 0 calc(50% - 8px); }
            .ds-p-nav-bd { padding: 7px 10px; }
            .ds-p-nav-ind { display: none; }
            .ds-p-scroll { padding: 18px 18px 8px; }
            .ds-setting-item { flex-direction: column; align-items: flex-start; gap: 10px; }
            .ds-setting-ctrl { margin-left: 0; width: 100%; }
            .ds-custom-select { min-width: 100%; }
            .ds-setting-ctrl input[type="number"] { width: 100%; }
        }

        /* 宽屏模式 — 增大消息区最大宽度，左右留白自动均分 */
        html.ds-wide-screen [class*="ds-virtual-list-items"][style*="--message-list-max-width"] {
            --message-list-max-width: 1000px !important;
        }

        /* 表格样式 — 公共布局（不涉及颜色，所有模式共用） */
        .ds-markdown table {
            opacity: 0;  /* 初始透明，JS 完成处理后再显示，消除闪烁 */
            transition: opacity 0.12s ease-in;
            table-layout: fixed;
            width: 100% !important; border-collapse: separate !important;
            border-spacing: 0 !important; margin: 1em 0 !important;
            border-radius: 12px !important; overflow: hidden !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important; position: relative;
        }
        .ds-markdown th, .ds-markdown td {
            padding: 12px 16px !important;
            vertical-align: top !important; font-size: 14px !important; line-height: 1.5 !important;
        }
        .ds-markdown th {
            font-weight: 600 !important; letter-spacing: 0.02em !important;
        }
        .ds-markdown tbody tr { transition: background-color 0.2s !important; }

        /* === Plan A：透明叠加色（自动适应浅色/深色） === */
        html.ds-table-auto .ds-markdown th,
        html.ds-table-auto .ds-markdown td {
            border: 1px solid rgba(128,128,128,0.2) !important;
        }
        html.ds-table-auto .ds-markdown th {
            background: rgba(128,128,128,0.08) !important;
            border-bottom: 1px solid rgba(128,128,128,0.2) !important;
        }
        html.ds-table-auto .ds-markdown tbody tr:nth-child(even) {
            background-color: rgba(128,128,128,0.04) !important;
        }
        html.ds-table-auto .ds-markdown tbody tr:hover {
            background-color: rgba(79,70,229,0.06) !important;
        }

        /* === Plan B 浅色模式 === */
        html.ds-table-dual body:not(.dark) .ds-markdown th,
        html.ds-table-dual body:not(.dark) .ds-markdown td {
            border: 1px solid #e5e7eb !important;
        }
        html.ds-table-dual body:not(.dark) .ds-markdown th {
            background: #f3f4f6 !important;
            border-bottom: 1px solid #e5e7eb !important; color: #1f2937 !important;
        }
        html.ds-table-dual body:not(.dark) .ds-markdown tbody tr:nth-child(even) {
            background-color: #fafafa !important;
        }
        html.ds-table-dual body:not(.dark) .ds-markdown tbody tr:hover {
            background-color: #eff6ff !important;
        }

        /* === Plan B 深色模式 === */
        html.ds-table-dual body.dark .ds-markdown th,
        html.ds-table-dual body.dark .ds-markdown td {
            border: 1px solid #2d2d3d !important;
        }
        html.ds-table-dual body.dark .ds-markdown th {
            background: #1e1e2d !important;
            border-bottom: 1px solid #2d2d3d !important; color: #e4e4e8 !important;
        }
        html.ds-table-dual body.dark .ds-markdown tbody tr:nth-child(even) {
            background-color: rgba(255,255,255,0.03) !important;
        }
        html.ds-table-dual body.dark .ds-markdown tbody tr:hover {
            background-color: rgba(79,70,229,0.1) !important;
        }

        /* 导出按钮 — 公共布局 */
        .table-internal-buttons {
            position: absolute; bottom: 12px; right: 12px;
            display: flex; flex-direction: column; gap: 8px; z-index: 10;
            opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s;
            pointer-events: none;
        }
        .ds-markdown table:hover .table-internal-buttons,
        .table-internal-buttons:hover { opacity: 1; visibility: visible; pointer-events: auto; }
        /* 恒显开关：开启后导出按钮始终可见，不再依赖悬停 */
        html.ds-export-always .table-internal-buttons { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
        .internal-export-btn {
            width: 32px; height: 32px; border-radius: 8px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: all 0.2s; font-size: 16px;
            position: relative;
        }
        .internal-export-btn:active { transform: scale(0.98); }
        .internal-export-btn .export-btn-ic { width: 16px; height: 16px; display: block; pointer-events: none; }
        .internal-export-btn::after {
            content: attr(data-tooltip); position: absolute; right: 40px; top: 50%;
            transform: translateY(-50%); font-size: 12px; padding: 4px 8px; border-radius: 6px;
            white-space: nowrap; opacity: 0; visibility: hidden; transition: 0.1s;
            pointer-events: none;
        }
        .internal-export-btn:hover::after { opacity: 1; visibility: visible; }

        /* 导出按钮 — Plan A 自动 */
        html.ds-table-auto .internal-export-btn {
            background: rgba(128,128,128,0.12); border: 1px solid rgba(128,128,128,0.24);
        }
        html.ds-table-auto .internal-export-btn:hover {
            background: rgba(128,128,128,0.2); border-color: rgba(128,128,128,0.36);
        }
        html.ds-table-auto .internal-export-btn::after {
            background: rgba(0,0,0,0.82); color: white;
        }

        /* 导出按钮 — Plan B 浅色 */
        html.ds-table-dual body:not(.dark) .internal-export-btn {
            background: rgba(255,255,255,0.95); border: 1px solid #e2e8f0;
        }
        html.ds-table-dual body:not(.dark) .internal-export-btn:hover {
            background: #fff; border-color: #cbd5e1;
        }
        html.ds-table-dual body:not(.dark) .internal-export-btn::after {
            background: #1f2937; color: white;
        }

        /* 导出按钮 — Plan B 深色 */
        html.ds-table-dual body.dark .internal-export-btn {
            background: rgba(45,45,58,0.95); border: 1px solid #3d3d4a;
        }
        html.ds-table-dual body.dark .internal-export-btn:hover {
            background: #3d3d4a; border-color: #5d5d6a;
        }
        html.ds-table-dual body.dark .internal-export-btn::after {
            background: #e4e4e8; color: #1a1a22;
        }
    `);

    // ==================== 代码块折叠逻辑 ====================
    const processedAttr = 'data-fold-processed';

    function getLineCount(preEl) {
        const text = preEl.innerText || preEl.textContent || '';
        let lines = text.split('\n');
        if (lines.length && lines[lines.length-1] === '') lines.pop();
        return lines.length;
    }

    function getLineHeight(preEl) {
        const style = window.getComputedStyle(preEl);
        let lh = style.lineHeight;
        if (lh === 'normal') lh = parseFloat(style.fontSize) * 1.2 + 'px';
        return parseFloat(lh);
    }

    function shouldUsePreviewMode(preEl) {
        if (!enablePreviewLines) return false;
        return getLineCount(preEl) > previewLines;
    }

    function collapseBlock(preEl, btn) {
        if (shouldUsePreviewMode(preEl)) {
            const lh = getLineHeight(preEl);
            const maxH = lh * previewLines;
            if (!preEl.dataset.origMaxHeight) {
                preEl.dataset.origMaxHeight = preEl.style.maxHeight || '';
                preEl.dataset.origOverflow = preEl.style.overflow || '';
            }
            preEl.style.maxHeight = maxH + 'px';
            preEl.style.overflow = 'hidden';
            preEl.classList.add('ds-fold-preview');
        } else {
            if (!preEl.dataset.origDisplay) {
                preEl.dataset.origDisplay = window.getComputedStyle(preEl).display;
            }
            preEl.style.display = 'none';
            preEl.classList.remove('ds-fold-preview');
        }
        const iconDiv = btn.querySelector('.fold-icon');
        if (iconDiv) iconDiv.innerHTML = ICON_CHEVRON_UP;
        btn.querySelector('span').textContent = btnTextUnfold;
        btn.setAttribute('aria-label', '展开代码块');
    }

    function expandBlock(preEl, btn) {
        if (preEl.dataset.origMaxHeight !== undefined) {
            preEl.style.maxHeight = preEl.dataset.origMaxHeight || '';
            preEl.style.overflow = preEl.dataset.origOverflow || '';
            preEl.classList.remove('ds-fold-preview');
        }
        if (preEl.dataset.origDisplay !== undefined) {
            preEl.style.display = preEl.dataset.origDisplay || '';
        } else {
            preEl.style.display = '';
        }
        const iconDiv = btn.querySelector('.fold-icon');
        if (iconDiv) iconDiv.innerHTML = ICON_CHEVRON_DOWN;
        btn.querySelector('span').textContent = btnTextFold;
        btn.setAttribute('aria-label', '折叠代码块');
    }

    function findButtonContainer(preEl) {
        const codeBlock = preEl.closest('.md-code-block');
        if (!codeBlock) return null;
        // 优先通过 .code-info-button-text（"复制"/"下载"文字）定位按钮容器
        const textSpan = codeBlock.querySelector('.code-info-button-text');
        if (textSpan) {
            const btn = textSpan.closest('[role="button"], .ds-button');
            if (btn && btn.parentElement) return btn.parentElement;
        }
        // 兼容旧版 .ds-text-button
        const oldBtn = codeBlock.querySelector('.ds-text-button');
        if (oldBtn) return oldBtn.parentElement;
        // 最后尝试已知的哈希容器名
        const hashContainer = codeBlock.querySelector('.efa13877');
        if (hashContainer) return hashContainer;
        return null;
    }

    function createFoldButton(preEl) {
        if (!preEl.dataset.origDisplay) preEl.dataset.origDisplay = window.getComputedStyle(preEl).display;
        const shouldAutoFold = foldThreshold > 0 && getLineCount(preEl) > foldThreshold;
        let isFolded = false;
        if (shouldAutoFold) {
            if (shouldUsePreviewMode(preEl)) {
                const lh = getLineHeight(preEl);
                const maxH = lh * previewLines;
                if (!preEl.dataset.origMaxHeight) {
                    preEl.dataset.origMaxHeight = preEl.style.maxHeight || '';
                    preEl.dataset.origOverflow = preEl.style.overflow || '';
                }
                preEl.style.maxHeight = maxH + 'px';
                preEl.style.overflow = 'hidden';
                preEl.classList.add('ds-fold-preview');
            } else {
                preEl.style.display = 'none';
                preEl.classList.remove('ds-fold-preview');
            }
            isFolded = true;
        }

        const btn = document.createElement('button');
        btn.className = 'ds-fold-btn';
        const iconDiv = document.createElement('div');
        iconDiv.className = 'fold-icon';
        iconDiv.innerHTML = isFolded ? ICON_CHEVRON_UP : ICON_CHEVRON_DOWN;
        const textSpan = document.createElement('span');
        textSpan.textContent = isFolded ? btnTextUnfold : btnTextFold;
        btn.appendChild(iconDiv);
        btn.appendChild(textSpan);
        btn.setAttribute('aria-label', isFolded ? '展开代码块' : '折叠代码块');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            let currentlyFolded;
            if (preEl.dataset.origMaxHeight !== undefined && preEl.style.maxHeight && preEl.style.maxHeight !== 'none') {
                currentlyFolded = true;
            } else if (preEl.style.display === 'none') {
                currentlyFolded = true;
            } else {
                currentlyFolded = false;
            }
            if (currentlyFolded) expandBlock(preEl, btn);
            else collapseBlock(preEl, btn);
        });
        return btn;
    }

    function addFoldButtonToCodeBlock(preEl) {
        if (preEl.hasAttribute(processedAttr)) return;
        const targetContainer = findButtonContainer(preEl);
        if (targetContainer) {
            if (targetContainer.querySelector('.ds-fold-btn')) {
                preEl.setAttribute(processedAttr, 'true');
                return;
            }
            targetContainer.appendChild(createFoldButton(preEl));
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'ds-fold-btn-wrapper';
            wrapper.style.textAlign = 'right';
            wrapper.style.marginBottom = '6px';
            wrapper.appendChild(createFoldButton(preEl));
            preEl.parentNode.insertBefore(wrapper, preEl);
        }
        preEl.setAttribute(processedAttr, 'true');
    }

    function processAllExistingCodeBlocks() {
        document.querySelectorAll('pre').forEach(block => {
            if (!block.hasAttribute(processedAttr)) addFoldButtonToCodeBlock(block);
        });
    }

    function cleanupLegacyWrappers() {
        document.querySelectorAll('.ds-fold-btn-wrapper').forEach(w => w.remove());
    }

    function deduplicateButtons() {
        // 通过按钮文字或类名找到按钮容器，去重其中的折叠按钮
        const seen = new Set();
        // 新版按钮：.code-info-button-text
        document.querySelectorAll('.code-info-button-text').forEach(span => {
            const btn = span.closest('[role="button"], .ds-button');
            if (!btn) return;
            const container = btn.parentElement;
            if (!container || seen.has(container)) return;
            seen.add(container);
            const btns = container.querySelectorAll('.ds-fold-btn');
            if (btns.length > 1) for (let i = 1; i < btns.length; i++) btns[i].remove();
        });
        // 旧版按钮：.ds-text-button
        document.querySelectorAll('.ds-text-button').forEach(btn => {
            const container = btn.parentElement;
            if (!container || seen.has(container)) return;
            seen.add(container);
            const btns = container.querySelectorAll('.ds-fold-btn');
            if (btns.length > 1) for (let i = 1; i < btns.length; i++) btns[i].remove();
        });
    }



    // ==================== 表格优化逻辑 ====================
    // 根据内容文本长度计算列宽百分比（采样表头+前5行）
    function calcColumnWeights(table, colCount) {
        const weights = new Array(colCount).fill(0);
        const rows = table.querySelectorAll('tr');
        const limit = Math.min(rows.length, 6);
        for (let r = 0; r < limit; r++) {
            const cells = rows[r].cells;
            for (let c = 0; c < Math.min(cells.length, colCount); c++) {
                const len = (cells[c].textContent || '').length;
                if (len > weights[c]) weights[c] = len;
            }
        }
        for (let c = 0; c < colCount; c++) {
            if (weights[c] < 1) weights[c] = 1;
        }
        const total = weights.reduce((a, b) => a + b, 0);
        return weights.map(w => ((w / total) * 100).toFixed(2) + '%');
    }

    function applyTableStyles(table) {
        // maxWidth 约束：所有模式统一，表格宽度不得超过容器
        const vc = document.querySelector('.ds-virtual-list-visible-items');
        let maxW;
        if (vc) {
            maxW = vc.clientWidth + 'px';
            table.style.maxWidth = maxW;
            vc.style.overflowX = 'visible';
            vc.style.maxWidth = '100%';
        } else {
            maxW = '100%';
            table.style.maxWidth = maxW;
        }

        // 列宽策略
        if (tableWidthMode === 'auto') {
            // 自适应模式：根据内容比例分配列宽，严格限制在 maxWidth 内
            table.style.tableLayout = 'fixed';
            table.style.width = maxW;
            const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
            if (headerRow && headerRow.cells.length) {
                const pcts = calcColumnWeights(table, headerRow.cells.length);
                for (let i = 0; i < pcts.length; i++) {
                    headerRow.cells[i].style.width = pcts[i];
                    headerRow.cells[i].style.minWidth = '';
                }
            }
        } else if (tableWidthMode === 'equal-minwidth') {
            table.style.width = '100%';
            const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
            const colCount = headerRow ? headerRow.cells.length : 1;
            // 计算可用容器宽度
            const containerWidth = vc ? vc.clientWidth : (table.parentElement ? table.parentElement.clientWidth : window.innerWidth);
            if (colCount * 80 > containerWidth) {
                // 总最小宽度超出容器 → 自动切换自适应模式（内容比例分配）
                table.style.tableLayout = 'fixed';
                table.style.width = maxW;
                if (headerRow) {
                    const pcts = calcColumnWeights(table, colCount);
                    for (let i = 0; i < pcts.length; i++) {
                        headerRow.cells[i].style.width = pcts[i];
                        headerRow.cells[i].style.minWidth = '';
                    }
                }
                if (!table.dataset.dsWidthWarned) {
                    table.dataset.dsWidthWarned = '1';
                    showToast(`列数较多（${colCount}列），已自动切换为自适应列宽`, 3000);
                }
            } else {
                table.style.tableLayout = 'fixed';
                const per = (100 / colCount).toFixed(2) + '%';
                for (let i = 0; i < colCount; i++) {
                    headerRow.cells[i].style.width = per;
                    headerRow.cells[i].style.minWidth = '80px';
                }
            }
        } else {
            // equal
            table.style.width = '100%';
            table.style.tableLayout = 'fixed';
            const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
            if (headerRow && headerRow.cells.length) {
                const per = (100 / headerRow.cells.length).toFixed(2) + '%';
                for (let i = 0; i < headerRow.cells.length; i++) {
                    headerRow.cells[i].style.width = per;
                    headerRow.cells[i].style.minWidth = '';
                }
            }
        }

        if (getComputedStyle(table).position !== 'relative') table.style.position = 'relative';

        table.querySelectorAll('th,td').forEach(cell => {
            cell.style.whiteSpace = 'normal';
            cell.style.overflowWrap = 'anywhere';
            cell.style.wordBreak = 'break-word';
        });

        // 仅处理直接包裹表格的 .ds-scroll-area 容器，避免破坏祖先布局
        const scrollArea = table.closest('.ds-scroll-area');
        if (scrollArea) {
            if (!scrollArea.dataset.dsOrigOverflowX) {
                scrollArea.dataset.dsOrigOverflowX = scrollArea.style.overflowX || '';
            }
            scrollArea.style.overflowX = 'visible';
        }

        // 所有处理完成，显示表格
        table.style.opacity = '1';
    }

    // 深拷贝表格并清洗脚本注入的内联样式/辅助节点，供各导出格式（PNG/CSV/MD）复用；
    // 使导出内容回归“auto”布局、不污染页面 DOM，也避免各导出路径各自复制一份清洗逻辑。
    function getCleanTableClone(table) {
        const clone = table.cloneNode(true);
        // 恢复默认可见性，并移除导出按钮容器与脚本注入标记
        clone.style.opacity = '1';
        const btns = clone.querySelector('.table-internal-buttons');
        if (btns) btns.remove();
        clone.removeAttribute('data-internal-buttons-added');
        // 清洗 applyTableStyles 注入的内联样式（含 fixed 布局相关），让导出内容用到干净样式
        clone.style.tableLayout = '';
        clone.style.width = '';
        clone.style.maxWidth = '';
        clone.style.position = '';
        clone.querySelectorAll('th,td').forEach(cell => {
            cell.style.width = '';
            cell.style.whiteSpace = '';
            cell.style.overflowWrap = '';
            cell.style.wordBreak = '';
        });
        return clone;
    }

    async function exportTableAsPNG(table) {
        if (!window.html2canvas) { alert('html2canvas 未加载'); return; }
        let iframe = null;
        try {
            // 深拷贝表格并清洗注入样式（PNG/CSV/MD 共用导出主体）
            const clone = getCleanTableClone(table);

            // 收集页面上表格相关样式（全局注入 + DeepSeek 变量）
            const styles = collectTableStyles();

            // 构建隔离 iframe
            iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;';
            iframe.srcdoc = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${styles}</style></head>
<body style="margin:16px;">${clone.outerHTML}</body></html>`;

            document.body.appendChild(iframe);

            // 等待 iframe 加载完成
            await new Promise((resolve, reject) => {
                iframe.onload = resolve;
                iframe.onerror = reject;
                setTimeout(resolve, 3000); // 超时保护
            });

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            const iframeTable = iframeDoc.querySelector('table');
            if (!iframeTable) throw new Error('iframe 中未找到表格元素');

            const canvas = await html2canvas(iframeTable, {
                scale: 3,   // 提升 PNG 导出分辨率（v4.7.0）
                backgroundColor: '#ffffff',
                logging: false,
            });

            // 导出
            canvas.toBlob(blob => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.download = `table_${Date.now()}.png`;
                    a.href = url;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                } else {
                    // toBlob 返回 null，回退 dataURL
                    try {
                        const dataUrl = canvas.toDataURL('image/png');
                        fetch(dataUrl).then(r => r.blob()).then(blob => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.download = `table_${Date.now()}.png`;
                            a.href = url;
                            a.click();
                            setTimeout(() => URL.revokeObjectURL(url), 100);
                        }).catch(() => alert('导出PNG失败：无法生成图片数据'));
                    } catch (_) {
                        alert('导出PNG失败：canvas 被污染，无法导出');
                    }
                }
            }, 'image/png');

        } catch (e) {
            console.error('PNG导出异常:', e);
            alert('导出PNG失败：' + (e.message || '未知错误'));
        } finally {
            if (iframe) setTimeout(() => iframe.remove(), 200);
        }
    }

    // 收集页面上表格所需的样式，注入 iframe
    function collectTableStyles() {
        let css = '';

        const isDark = document.body.classList.contains('dark');
        const mode = tableThemeMode;

        // 从页面提取表格相关样式（.ds-markdown 表格部分，含脚本注入的规则）
        for (const sheet of document.styleSheets) {
            try {
                for (const rule of sheet.cssRules || []) {
                    const txt = rule.cssText;
                    if (txt.includes('table') || txt.includes('th') || txt.includes('td') ||
                        txt.includes('.ds-markdown') || txt.includes('.md-code-block')) {
                        // 跳过脚本自己注入的 fixed 布局和导出按钮样式
                        if (txt.includes('table-layout: fixed') || txt.includes('table-internal-buttons')) continue;
                        css += txt + '\n';
                    }
                }
            } catch (_) {
                // 跨域样式表无法读取，忽略
            }
        }

        // 基础表格样式（兜底，根据当前主题模式选择配色）
        const bodyBg = getComputedStyle(document.body).backgroundColor || '#ffffff';
        css += /*css*/`
            body { background: ${bodyBg}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
            table {
                width: 100%; border-collapse: separate; border-spacing: 0;
                margin: 1em 0; border-radius: 12px; overflow: hidden;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            th, td {
                padding: 12px 16px; vertical-align: top;
                font-size: 14px; line-height: 1.5;
                white-space: normal; word-wrap: break-word;
            }
            th { font-weight: 600; }
            /* 单元格内联代码的兜底样式（PNG iframe 导出图里的 code） */
            table code {
                background: rgba(128,128,128,0.1); padding: 2px 4px;
                border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em;
            }
            ${mode === 'auto' ? /* 自动透明叠加 */`
                th, td { border: 1px solid rgba(128,128,128,0.2); }
                th { background: rgba(128,128,128,0.08); border-bottom: 1px solid rgba(128,128,128,0.2); }
                tbody tr:nth-child(even) { background-color: rgba(128,128,128,0.04); }
            ` : isDark ? /* 双模式 — 深色 */`
                th, td { border: 1px solid #2d2d3d; }
                th { background: #1e1e2d; border-bottom: 1px solid #2d2d3d; color: #e4e4e8; }
                tbody tr:nth-child(even) { background-color: rgba(255,255,255,0.03); }
            ` : /* 双模式 — 浅色 */`
                th, td { border: 1px solid #e5e7eb; }
                th { background: #f3f4f6; border-bottom: 1px solid #e5e7eb; color: #1f2937; }
                tbody tr:nth-child(even) { background-color: #fafafa; }
            `}
        `;

        return css;
    }

    function exportTableAsCSV(table) {
        const clone = getCleanTableClone(table);   // 基于清洗克隆，避免读取页面注入样式/按钮
        const rows = [];
        const thead = clone.querySelector('thead');
        if (thead) thead.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('th').forEach(th => rd.push(getCellText(th)));
            if (rd.length) rows.push(rd);
        });
        const tbody = clone.querySelector('tbody');
        if (tbody) tbody.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('td').forEach(td => rd.push(getCellText(td)));
            if (rd.length) rows.push(rd);
        });
        else clone.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('td,th').forEach(c => rd.push(getCellText(c)));
            if (rd.length) rows.push(rd);
        });
        if (!rows.length) { alert('无数据'); return; }
        const csv = rows.map(r => r.map(c => {
            if (c.includes(',') || c.includes('"') || c.includes('\n')) c = '"' + c.replace(/"/g,'""') + '"';
            return c;
        }).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `table_${Date.now()}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 100);
    }

    // 导出为 Markdown 表格并复制到剪贴板（📝）
    function exportTableAsMD(table) {
        const clone = getCleanTableClone(table);
        const rows = [];
        const thead = clone.querySelector('thead');
        if (thead) thead.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('th').forEach(th => rd.push(getCellTextForMarkdown(th)));
            if (rd.length) rows.push(rd);
        });
        // 有表头时追加分隔行
        if (rows.length) rows.push(rows[0].map(() => '---'));
        const tbody = clone.querySelector('tbody');
        if (tbody) tbody.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('td').forEach(td => rd.push(getCellTextForMarkdown(td)));
            if (rd.length) rows.push(rd);
        });
        else clone.querySelectorAll('tr').forEach((tr, idx) => {
            const rd = []; tr.querySelectorAll('td,th').forEach(c => rd.push(getCellTextForMarkdown(c)));
            if (!rd.length) return;
            if (idx === 0 && rows.length === 0) rows.push(rd.map(() => '---')); // 无表头：首行后补分隔
            rows.push(rd);
        });
        if (!rows.length) { alert('无数据'); return; }
        const md = rows.map(r => '| ' + r.join(' | ') + ' |').join('\n');
        navigator.clipboard.writeText(md)
            .then(() => showToast('表格已复制为 Markdown'))
            .catch(() => alert('复制失败，请手动复制'));
    }

    // 提取带 Markdown 行内语法（`code` / **加粗** / *斜体*）的单元格文本，并对管道符做转义；
    // 单元格内的 <br> 因会破坏表格“一行一格”结构，这里折叠为普通空格（与 CSV 的换行保留策略不同）
    function getCellTextForMarkdown(cell) {
        let text = '';
        cell.childNodes.forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
            else if (n.nodeName === 'BR') text += '\n';
            else if (n.nodeType === Node.ELEMENT_NODE) {
                if (n.tagName === 'CODE') text += '`' + n.textContent + '`';
                else if (n.tagName === 'STRONG' || n.tagName === 'B') text += '**' + n.textContent + '**';
                else if (n.tagName === 'EM' || n.tagName === 'I') text += '*' + n.textContent + '*';
                else text += getCellTextForMarkdown(n);
            }
        });
        return text.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, ' ').trim()
            .replace(/\|/g, '\\|');
    }

    function getCellText(cell) {
        let t = '';
        cell.childNodes.forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
            else if (n.nodeName === 'BR') t += '\n';
            else if (n.nodeType === Node.ELEMENT_NODE) t += getCellText(n);
        });
        // 保留 <br> 产生的换行，压缩其他空白字符
        t = t.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').trim();
        return t;
    }

    function addButtonsToTable(table) {
        if (!tableButtonsEnabled || table.getAttribute('data-internal-buttons-added') === 'true') return;
        table.setAttribute('data-internal-buttons-added', 'true');
        const bc = document.createElement('div');
        bc.className = 'table-internal-buttons';

        // 导出按钮图标（iconify mdi SVG）；emoji 作加载失败兜底（二者择一，不叠加）
        const makeExportBtn = (emoji, icon, tooltip, onClick) => {
            const b = document.createElement('button');
            b.className = 'internal-export-btn';
            b.setAttribute('data-tooltip', tooltip);
            const showEmoji = () => { b.innerHTML = ''; b.textContent = emoji; };
            const im = document.createElement('img');
            im.className = 'export-btn-ic';
            im.alt = '';
            im.draggable = false;
            im.src = 'https://api.iconify.design/mdi:' + icon + '.svg?color=%235b6472';
            im.addEventListener('error', showEmoji);
            b.appendChild(im);
            b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
            return b;
        };

        const pngBtn = makeExportBtn('📸', 'image-outline', '导出为 PNG', () => exportTableAsPNG(table));
        const csvBtn = makeExportBtn('📄', 'file-delimited-outline', '导出为 CSV', () => exportTableAsCSV(table));
        const mdBtn  = makeExportBtn('📝', 'language-markdown', '导出为 Markdown', () => exportTableAsMD(table));

        bc.appendChild(pngBtn); bc.appendChild(csvBtn); bc.appendChild(mdBtn);
        table.appendChild(bc);
    }

    // 表格指纹追踪：记录每个表格的稳定计数，连续 2 次指纹不变即视为稳定
    const _tableFingerprints = new WeakMap();  // table → { fp, count, firstSeen }

    const STABLE_COUNT_NEEDED = 2;    // 连续稳定次数阈值
    const MAX_WAIT_MS = 5000;         // 最长等待时间，超时强制应用
    const TABLE_DEBOUNCE_MS = 200;    // Observer 批处理间隔

    function getTableFingerprint(table) {
        const rows = table.querySelectorAll('tr').length;
        const cells = table.querySelectorAll('td,th').length;
        return rows + ':' + cells;
    }

    function processAllTables() {
        let anyUnstable = false;
        const now = Date.now();

        document.querySelectorAll('.ds-markdown').forEach(container => {
            container.style.overflowX = 'visible';
            container.style.maxWidth = '100%';
            container.querySelectorAll('table').forEach(table => {
                const fp = getTableFingerprint(table);
                const state = _tableFingerprints.get(table);

                if (!state) {
                    // 首次见到：立即应用并标记完成
                    _tableFingerprints.set(table, { fp, count: STABLE_COUNT_NEEDED, firstSeen: now, done: true });
                    applyTableStyles(table);
                    addButtonsToTable(table);
                    return;
                }

                if (state.done) {
                    // 已稳定应用过，指纹未变则跳过
                    if (fp === state.fp) return;
                    // 指纹变了（流式输出新增行/列），重置重新等待
                    state.fp = fp;
                    state.count = 0;
                    state.done = false;
                    anyUnstable = true;
                    return;
                }

                if (fp !== state.fp) {
                    // 指纹变化：重置计数，重新等待稳定
                    state.fp = fp;
                    state.count = 0;
                    anyUnstable = true;
                    return;
                }

                // 指纹相同：增加稳定计数
                state.count++;
                const timedOut = (now - state.firstSeen) > MAX_WAIT_MS;
                if (state.count >= STABLE_COUNT_NEEDED || timedOut) {
                    // 达到稳定阈值或超时兜底：应用样式并标记完成
                    state.count = STABLE_COUNT_NEEDED;
                    state.done = true;
                    if (timedOut) state.firstSeen = now;   // 重置计时，防止永久超时
                    applyTableStyles(table);
                    addButtonsToTable(table);
                } else {
                    anyUnstable = true;
                }
            });
        });

        if (anyUnstable) {
            scheduleTableProcess();
        }
    }

    let _tableDebounceTimer = null;
    function scheduleTableProcess() {
        clearTimeout(_tableDebounceTimer);
        _tableDebounceTimer = setTimeout(processAllTables, TABLE_DEBOUNCE_MS);
    }

    // ==================== AI思考区域自动折叠逻辑 ====================
    function collapseThinkingSection(container) {
        if (!autoCollapseThinking || container.hasAttribute('data-thinking-collapsed')) return;
        container.setAttribute('data-thinking-collapsed', 'true');

        if (simulateClickThinking) {
            // 模拟点击折叠箭头（保持原生交互）
            let clickableArrow = null;
            const icons = container.querySelectorAll('.ds-icon');
            if (icons.length >= 2) clickableArrow = icons[icons.length-1];
            else if (icons.length === 1) clickableArrow = icons[0];
            if (!clickableArrow) {
                const svg = container.querySelector('svg');
                if (svg && svg.parentElement) clickableArrow = svg.parentElement;
            }
            if (clickableArrow && typeof clickableArrow.click === 'function') {
                setTimeout(() => clickableArrow.click(), 100);
            }
        } else {
            // CSS 直接折叠：隐藏思考内容区域
            const thinkContent = findThinkContent(container);
            if (thinkContent) {
                thinkContent.dataset.dsScriptCollapsed = 'true';
                thinkContent.style.display = 'none';
            }
        }
    }

    // 从标题栏容器向上找到对应的 .ds-think-content 元素
    function findThinkContent(titleBar) {
        // 向上查找 collapsible 包装器，再找其中的 think content
        let parent = titleBar.parentElement;
        while (parent && parent !== document.body) {
            const tc = parent.querySelector('.ds-think-content');
            if (tc) return tc;
            parent = parent.parentElement;
        }
        return null;
    }

    let _thinkHideStyle = null;
    let _thinkCaptureAdded = false;

    // 预隐藏思考内容（CSS 拦截），消除展开→折叠的布局偏移
    function setupThinkContentHiding() {
        if (!autoCollapseThinking) return;
        // 注入 !important 样式使 .ds-think-content 初始不可见
        if (!_thinkHideStyle) {
            _thinkHideStyle = document.createElement('style');
            _thinkHideStyle.id = 'ds-think-hide';
            _thinkHideStyle.textContent = '.ds-think-content { display: none !important; }';
            document.head.appendChild(_thinkHideStyle);
        }
        // 用户点击箭头时，在 capture 阶段提前移除 CSS，让 DeepSeek 正常创建可视内容
        if (!_thinkCaptureAdded) {
            _thinkCaptureAdded = true;
            document.addEventListener('click', function dsThinkCapture(e) {
                const clickable = e.target.closest('[class*="_5ab5d64"], [class*="c2b72bb8"]');
                if (!clickable) return;
                if (_thinkHideStyle) {
                    _thinkHideStyle.remove();
                    _thinkHideStyle = null;
                }
            }, true);
        }
    }

    function processAllThinkingSections() {
        if (!autoCollapseThinking) return;
        // 基于稳定的 .ds-think-content 类名定位思考区域
        document.querySelectorAll('.ds-think-content').forEach(thinkContent => {
            // 排除代码块内的文本（避免脚本源码中的"已思考"文字误匹配）
            if (thinkContent.closest('pre, .md-code-block')) return;
            if (thinkContent.dataset.dsScriptCollapsed === 'true') return;

            // 向上查找包含标题栏的 collapsible 包装器
            let wrapper = thinkContent.parentElement;
            while (wrapper && wrapper !== document.body) {
                const titleBar = wrapper.querySelector('div[class*="_5ab5d64"]');
                if (titleBar && titleBar.textContent && titleBar.textContent.includes('已思考')) {
                    if (simulateClickThinking) {
                        collapseThinkingSection(titleBar);
                    } else {
                        // CSS 回退：直接隐藏 think content
                        if (!titleBar.hasAttribute('data-thinking-collapsed')) {
                            titleBar.setAttribute('data-thinking-collapsed', 'true');
                            thinkContent.dataset.dsScriptCollapsed = 'true';
                            thinkContent.style.display = 'none';
                        }
                    }
                    return;
                }
                wrapper = wrapper.parentElement;
            }

            // 未找到标题栏时，CSS 回退模式下直接隐藏
            if (!simulateClickThinking) {
                thinkContent.dataset.dsScriptCollapsed = 'true';
                thinkContent.style.display = 'none';
            }
        });
    }

    // ==================== 对话文件夹管理（并入自独立脚本，folderManagerEnabled 关闭时完全不注入） ====================
    // 封装为独立子闭包 folderUnit，与原脚本最大兼容、不污染外层命名空间；不自持 observer，
    // 启停/持续扫描由外层统一开关与 observeDOM 驱动（见 init / observeDOM / openControlPanel）。
    const folderUnit = (() => {

        /* ==================== 存储（沿用主脚本独立键 v2；v0.9.2 起数据结构含 expanded 展开态） ==================== */
        function loadData() {
            try {
                const d = JSON.parse(GM_getValue(STORAGE_FOLDER_DATA, 'null'));
                if (d && Array.isArray(d.folders) && d.links) {
                    if (!d.expanded || typeof d.expanded !== 'object') d.expanded = {};
                    if (typeof d.collapsed !== 'boolean') d.collapsed = false;   // 面板整体折叠态（v4.7.0 新增）
                    return d;
                }
            } catch (e) { /* ignore */ }
            return { folders: [], links: {}, expanded: {}, collapsed: false };
        }
        let data = loadData();
        function saveData() { GM_setValue(STORAGE_FOLDER_DATA, JSON.stringify(data)); }

        const genId = () => 'f_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const sessionIdOf = (a) => {
            const m = (a.getAttribute('href') || '').match(/\/s\/([^/?#]+)/);
            return m ? m[1] : null;
        };
        const folderNameOf = (fid) => (data.folders.find((x) => x.id === fid) || {}).name || '';
        const nativeNodeFor = (sid) => document.querySelector(`a[href$="/s/${sid}"]`);

        const PALETTE = ['#7aa2ff', '#ff9e7a', '#7affb0', '#ffd27a', '#d27aff', '#7affe0', '#ff7ab0', '#a0ff7a'];
        const folderColor = (id) => {
            let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
            return PALETTE[h % PALETTE.length];
        };
        function shadeHex(hex, amt) {
            const n = parseInt(hex.slice(1), 16);
            let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
            if (amt < 0) { const f = 1 + amt; r *= f; g *= f; b *= f; }
            else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
            return `rgb(${r | 0},${g | 0},${b | 0})`;
        }
        function parseRGB(s) {
            const m = s.match(/(\d+)\D+(\d+)\D+(\d+)/);
            return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
        }

        /* ---------- 主题（保留原脚本逻辑：随官网深/浅色） ---------- */
        function isDark() {
            const m = document.documentElement.getAttribute('data-mode');
            if (m !== null && m !== '') return m !== 'light';
            const bg = getComputedStyle(document.body).backgroundColor;
            const c = parseRGB(bg);
            if (c) return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) < 140;
            return !window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        function applyTheme() {
            const dark = isDark();
            const r = document.documentElement.style;
            const v = dark
                ? {
                    '--ds-text': '#e8eaed', '--ds-sub': '#9aa0a6',
                    '--ds-hover': 'rgba(255,255,255,.08)', '--ds-active-bg': 'rgba(122,162,255,.18)',
                    '--ds-accent': '#7aa2ff', '--ds-divider': 'rgba(255,255,255,.12)',
                    '--ds-border': 'rgba(255,255,255,.14)',
                }
                : {
                    '--ds-text': '#0f1115', '--ds-sub': '#81858c',
                    '--ds-hover': 'rgba(0,0,0,.05)', '--ds-active-bg': 'rgba(56,108,255,.12)',
                    '--ds-accent': '#3a6cff', '--ds-divider': 'rgba(0,0,0,.10)',
                    '--ds-border': 'rgba(0,0,0,.14)',
                };
            for (const k in v) r.setProperty(k, v[k]);
        }

        /* ---------- 动态样式（v0.9.2 树形样式；on 注入 / off 移除） ---------- */
        const FOLDER_CSS_ID = 'ds-folder-css';
        const FOLDER_CSS = `
        #dsFolderPanel{
            font-size:14px; color:var(--ds-text); font-family:inherit;
            margin:2px 0 4px; padding:22px 8px 8px 0;  /* 顶部预留原生「多选」按钮悬浮行，避免面板内容压在其下造成视觉错位 */
            background:transparent; border:none; box-shadow:none; border-radius:0;
            user-select:none;
        }
        #dsFolderPanel .dsfh{display:flex; align-items:center; justify-content:space-between; margin:2px 0 6px; padding-left:10px;}
        #dsFolderPanel .dsfh .dsHeadTitle{display:flex; align-items:center; gap:6px; cursor:pointer; padding:3px 8px 3px 0; margin-left:-8px; border-radius:6px; user-select:none;}
        #dsFolderPanel .dsfh .dsHeadTitle:hover{background:var(--ds-hover);}
        #dsFolderPanel .dsHeadCaret{width:15px;height:15px;flex:0 0 auto;color:var(--ds-sub);transition:transform .15s ease;}
        #dsFolderPanel.collapsed .dsHeadCaret{transform:rotate(-90deg);}   /* 折叠态箭头朝右 */
        #dsFolderPanel .dsfh b{font-weight:500; font-size:12px; color:var(--ds-sub); letter-spacing:.4px;}
        #dsFolderPanel .dsNew{background:transparent; color:var(--ds-sub);
            border:1px solid var(--ds-divider); border-radius:100px;
            padding:3px 10px; cursor:pointer; font-size:12px; font-weight:500;}
        #dsFolderPanel .dsNew:hover{background:var(--ds-hover); color:var(--ds-text);}
        /* 去掉区内自设 300px 独立滚动：让整个文件夹区随原生会话历史一起滚，内部不再单独出滚动条 */
        #dsFolderPanel .dsList{display:flex; flex-direction:column; gap:2px;}
        #dsFolderPanel.collapsed .dsList{display:none;}   /* 面板整体折叠（点标题收起） */
        #dsFolderPanel.collapsed .dsNew{display:none;}    /* 折叠态也不展示「＋ 新建」，只留标题行可展开 */
        #dsFolderPanel.collapsed .dsfh{margin-bottom:0;}  /* 收起后挤掉与列表的间隙，仅留标题行 */
        #dsFolderPanel.collapsed .dsHeadTitle{margin-right:0;}  /* 标题占满整行便于再点开 */
        #dsFolderPanel .dsItem{display:flex; align-items:center; gap:8px; padding:7px 10px; border-radius:8px;
            min-height:35px; box-sizing:border-box;
            cursor:pointer; color:var(--ds-text);}
        #dsFolderPanel .dsItem:hover{background:var(--ds-hover);}
        #dsFolderPanel .dsItem.active{background:var(--ds-active-bg); color:var(--ds-accent);}
        #dsFolderPanel .dsItem .dsName{flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;}
        #dsFolderPanel .dsItem .dsCount{opacity:.5; font-size:12px; font-weight:600; margin-left:6px; flex:0 0 auto;}
        #dsFolderPanel .dsItem .dsOps{display:flex; gap:6px; flex:0 0 auto; visibility:hidden; margin-left:auto;}
        #dsFolderPanel .dsItem:hover .dsOps{visibility:visible;}
        #dsFolderPanel .dsOps button{background:none; border:none; color:var(--ds-sub); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:5px;}
        #dsFolderPanel .dsOps button:hover{background:var(--ds-hover); color:var(--ds-text);}
        #dsFolderPanel .dsEmpty{opacity:.5; font-size:12.5px; padding:6px 10px;}

        /* v0.9.0+ 树形文件夹：箭头 / 会话内嵌行 */
        #dsFolderPanel .dsCaret{width:20px; height:20px; flex:0 0 auto; background:none; border:none;
            padding:0; margin:0; cursor:pointer; color:var(--ds-sub); border-radius:5px; display:flex; align-items:center; justify-content:center;}
        #dsFolderPanel .dsCaret:hover{background:var(--ds-hover); color:var(--ds-text);}
        #dsFolderPanel .dsFoldBody{display:flex; flex-direction:column;}
        #dsFolderPanel .dsConvRow{display:flex; align-items:center; gap:8px; padding:7px 10px 7px 30px; border-radius:8px;
            min-height:32px; box-sizing:border-box; cursor:pointer; color:var(--ds-text); font-size:13px;}
        #dsFolderPanel .dsConvRow:hover{background:var(--ds-hover);}
        #dsFolderPanel .dsConvRow.on{color:var(--ds-accent);}
        #dsFolderPanel .dsConvTitle{flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
        #dsFolderPanel .dsOut{background:none; border:1px solid var(--ds-divider); color:var(--ds-sub);
            border-radius:7px; padding:2px 9px; cursor:pointer; font-size:12px; flex:0 0 auto;}
        #dsFolderPanel .dsOut:hover{color:#ff8585; border-color:#ff8585;}

        /* 自绘标题 tooltip：配色/圆角/字号/内边距对齐官网 .ds-tooltip（实测 rgb(44,44,46) / #fff / 12px / 4px 8px / radius 10px） */
        .dsFolderTip{position:fixed; z-index:3000; background:#2c2c2e; color:#fff;
            font-size:12px; line-height:1.5; padding:4px 8px; border-radius:10px;
            max-width:560px; pointer-events:none; word-break:break-all;}

        .dsTag{display:inline-block; margin-left:6px; font-size:11px; font-weight:600;
            padding:1px 6px; border-radius:5px; vertical-align:middle; line-height:1.4;}

        /* 文件夹选择浮层 */
        #dsFolderPop .dsmpItem{padding:8px 12px; border-radius:8px; cursor:pointer; color:var(--ds-text);
            display:flex; align-items:center; gap:8px; font-size:13.5px;}
        #dsFolderPop .dsmpItem:hover{background:var(--ds-hover);}
        #dsFolderPop .dsmpSep{height:1px; background:var(--ds-border); margin:4px 0;}

        /* 鼠标从官方菜单项滑到「移动到文件夹」后，官方项高亮态残留 */
        .ds-dropdown-menu:has([data-ds-move]:hover) .ds-dropdown-menu-option:not([data-ds-move]){
            background:transparent !important; box-shadow:none !important; outline:none !important;
        }`;
        function injectCss() {
            if (document.getElementById(FOLDER_CSS_ID)) return;
            const st = document.createElement('style');
            st.id = FOLDER_CSS_ID;
            st.textContent = FOLDER_CSS;
            document.head.appendChild(st);
        }
        function removeCss() { const st = document.getElementById(FOLDER_CSS_ID); if (st) st.remove(); }

        /* ---------- 状态（v0.9.x 树形模型：无全局筛选/抽屉；展开态持久化于 data.expanded） ---------- */
        let fCurrentMenuSid = null;   // 当前打开三点菜单所属的会话
        let lastMenuOpenAt = 0;       // 最近一次点击打开官方 ⋯ 菜单的时刻（capture click 记录）
        let lastRealMoveAt = 0;       // 最近一次真实指针位移时刻（捕获阶段记录）
        document.addEventListener('pointermove', () => { lastRealMoveAt = Date.now(); }, { capture: true, passive: true });
        const isExpanded = (id) => data.expanded[id] !== false;   // 默认展开
        const toggleExpanded = (id) => { data.expanded[id] = !isExpanded(id); };

        /* ---------- 面板定位（挂点沿用 v0.8.1/v0.9.x 稳定方案） ---------- */
        function findNewChatBtn() {
            const texts = ['开启新对话', '新对话', '开始新对话'];
            const span = [...document.querySelectorAll('span')].find((x) => texts.includes(x.textContent.trim()));
            if (span) return span.closest('[class*="ds-button"]') || span.parentElement;
            return [...document.querySelectorAll('button,div,a')].find((x) => texts.includes((x.textContent || '').trim())) || null;
        }
        function findScrollContainer() {
            // 优先：从任意会话链接向上找 overflow:auto/scroll 祖先（列表滚动容器）
            const link = document.querySelector('a[href^="/a/chat/s/"]');
            if (link) {
                let el = link.parentElement;
                while (el) {
                    const cs = getComputedStyle(el);
                    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return el;
                    el = el.parentElement;
                }
            }
            // 兜底：链接尚未渲染（SPA 加载/导航竞态）时，从「新对话」按钮向上找侧栏根，
            // 再于其后代中定位唯一的滚动容器——避免误插到滚动容器外被钉死在顶部。
            const btn = findNewChatBtn();
            let root = btn;
            while (root && root !== document.body) {
                const s = [...root.querySelectorAll('*')].find((d) => {
                    const cs = getComputedStyle(d);
                    return cs.overflowY === 'auto' || cs.overflowY === 'scroll';
                });
                if (s) return s;
                root = root.parentElement;
            }
            return null;
        }
        function ensurePanel() {
            applyTheme();
            let panel = document.getElementById('dsFolderPanel');
            if (panel) {
                // 已存在：沿祖先链判断是否已在滚动容器内。面板经「置顶」sticky 行挂入其所在内容包装层
                // （如 _3098d02，overflow:visible），真正的列表 scroller（_6d215eb ds-scroll-area）在其
                // 上方若干层——只查直接父级会误判为"未挂载"，导致每轮 schedule 重挂 + renderFolders 重建
                // .dsList（真实 mutation）→ observer → schedule 的无限刷新循环。
                let inScroller = false;
                let anc = panel.parentElement;
                while (anc && anc !== document.body) {
                    const ov = getComputedStyle(anc).overflowY;
                    if (ov === 'auto' || ov === 'scroll') { inScroller = true; break; }
                    anc = anc.parentElement;
                }
                if (inScroller) return;   // 已随列表滚动 → 稳态零扫描早退
                // 面板在文档中但不在滚动容器内（误插残留/容器被替换）→ 继续走下方重挂
            }
            const sc = findScrollContainer();
            if (!sc) return;   // 侧栏/滚动容器尚未就绪：暂不挂载，等下次 schedule 重试（避免误插容器外被钉死）
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'dsFolderPanel';
                panel.innerHTML = `
                <div class="dsfh">
                    <span class="dsHeadTitle" title="${data.collapsed ? '展开全部' : '折叠全部'}" role="button" tabindex="0">
                        <svg class="dsHeadCaret" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg><b>文件夹</b>
                    </span>
                    <button class="dsNew" title="新建文件夹">＋ 新建</button>
                </div>
                <div class="dsList"></div>`;
                const headTitle = panel.querySelector('.dsHeadTitle');
                const foldAll = () => { data.collapsed = !data.collapsed; saveData(); setCollapsedUI(); };
                headTitle.addEventListener('click', foldAll);
                headTitle.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); foldAll(); }
                });
                panel.querySelector('.dsNew').addEventListener('click', () => {
                    data.collapsed = false;          // 新建时自动展开，方便立即看到新夹
                    setCollapsedUI();                 // 先反映（含保存 collapsed）
                    onCreateFolder();
                });
            }
            // 挂入/重挂入滚动容器（若面板此前被误插到别处则自动迁移，修复升级前的残留）
            const titleRow = [...sc.querySelectorAll('div')].find((d) => {
                const cs = getComputedStyle(d);
                return cs.position === 'sticky' && d.clientHeight > 0 && d.clientHeight < 60;
            });
            if (titleRow && titleRow.parentElement) {
                titleRow.insertAdjacentElement('afterend', panel);
            } else {
                sc.insertBefore(panel, sc.firstChild); // 兜底
            }
            setCollapsedUI();   // 挂载后再应用折叠态（原在创建块调用时面板未入 DOM，getElementById 找不到 → no-op，导致刷新后 data.collapsed 不生效）
            renderFolders();
        }

        /* ---- 面板整体折叠态 UI（数据在 data.collapsed；纯 class 由 CSS 控制显示） ---- */
        function setCollapsedUI() {
            const panel = document.getElementById('dsFolderPanel');
            if (!panel) return;
            panel.classList.toggle('collapsed', !!data.collapsed);
            const t = panel.querySelector('.dsHeadTitle');
            if (t) t.title = data.collapsed ? '展开全部' : '折叠全部';
        }

        /* ---- 归档可见性：已收进文件夹的会话从原生历史列表隐藏（避免点它时官方滚回原位） ---- */
        const archivedIds = () => Object.keys(data.links);
        function syncArchiveVisibility() {
            const all = document.querySelectorAll('a[href^="/a/chat/s/"]');
            const set = new Set(archivedIds());
            all.forEach((a) => {
                const sid = sessionIdOf(a);
                if (sid && set.has(sid)) {
                    if (a.style.display !== 'none') a.style.display = 'none';
                } else if (a.style.display === 'none') {
                    a.style.display = '';
                }
            });
        }

        /* ---------- 树形渲染 ---------- */
        /* 文件夹行图标：折叠 = 空心文件夹；展开 = 打开文件夹（实心） */
        const ICON_FOLDER_CLOSED = "<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linejoin=\"round\"><path d=\"M3.2 6.2A1.7 1.7 0 0 1 4.9 4.5h4.6l2 2.2h7.6a1.7 1.7 0 0 1 1.7 1.7v9.6a1.7 1.7 0 0 1-1.7 1.7H4.9a1.7 1.7 0 0 1-1.7-1.7V6.2Z\"/></svg>";
        const ICON_FOLDER_OPEN = "<svg width=\"15\" height=\"15\" viewBox=\"0 0 48 48\" fill=\"none\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M18.561296999999968 6.675137999999947 C20.10129699999993 6.675137999999947 21.214296999999988 6.655137999999965 22.263296999999966 6.95513799999992 C23.14329699999996 7.195137999999929 23.972296999999912 7.595137999999906 24.708296999999902 8.145137999999974 C25.586296999999945 8.78513799999996 26.2612969999999 9.675137999999947 27.21229699999992 10.885137999999984 L28.316296999999963 12.28513799999996 C28.489296999999965 12.505137999999988 28.578296999999907 12.625137999999993 28.64729699999998 12.695137999999929 C28.653296999999952 12.70513799999992 28.659296999999924 12.71513799999991 28.663296999999943 12.71513799999991 C28.67029699999989 12.71513799999991 28.67829699999993 12.71513799999991 28.68829699999992 12.71513799999991 C28.792296999999962 12.725137999999902 28.93529699999999 12.725137999999902 29.21629699999994 12.725137999999902 H31.78629699999999 C33.304296999999906 12.725137999999902 34.39429699999994 12.71513799999991 35.33429699999999 12.945137999999929 C37.98429699999997 13.605137999999897 40.054296999999906 15.675137999999947 40.71429699999999 18.325137999999924 C40.90429699999993 19.105137999999897 40.9342969999999 19.9751379999999 40.9342969999999 21.105137999999897 C41.88429699999995 22.145137999999974 42.544296999999915 23.44513799999993 42.784296999999924 24.865138 C42.96429699999999 25.885137999999984 42.824297 26.915137999999956 42.574297 28.005137999999874 C42.3142969999999 29.09513800000002 41.89429699999994 30.415137999999956 41.38429699999995 32.055138000000056 C40.604296999999974 34.515137999999865 40.114296999999965 36.155137999999965 39.17429699999991 37.44513799999993 C38.02429699999993 39.03513799999985 36.39429699999994 40.2251379999999 34.534296999999924 40.84513800000002 C33.614296999999965 41.155137999999965 32.62529699999993 41.265137999999865 31.412296999999967 41.305138000000056 C31.322296999999935 41.31513800000005 31.229296999999974 41.32513800000004 31.134296999999947 41.32513800000004 H29.179296999999906 C29.033296999999948 41.32513800000004 28.885296999999923 41.32513800000004 28.73429699999997 41.32513800000004 H19.135296999999923 C18.568296999999916 41.32513800000004 18.03229699999997 41.32513800000004 17.52529699999991 41.32513800000004 C16.134296999999947 41.31513800000005 14.95629699999995 41.29513799999984 13.955296999999973 41.21513799999991 C12.57729699999993 41.10513800000001 11.375296999999932 40.865138 10.266296999999895 40.305138000000056 C8.497297000000003 39.395137999999974 7.060296999999991 37.96513799999991 6.158296999999948 36.19513799999993 C5.593296999999893 35.08513800000003 5.356296999999927 33.88513799999998 5.243296999999984 32.505137999999874 C5.1332969999999705 31.145137999999974 5.134296999999947 29.46513799999991 5.134296999999947 27.365138 V17.675137999999947 C5.134296999999947 16.095137999999906 5.132296999999994 14.805137999999943 5.218296999999893 13.755137999999988 C5.305296999999996 12.685137999999938 5.492296999999894 11.70513799999992 5.9562969999999495 10.795137999999952 C6.680296999999996 9.375137999999993 7.835296999999969 8.225137999999902 9.256296999999904 7.495137999999997 C10.167296999999962 7.035137999999961 11.141296999999895 6.845137999999906 12.211296999999945 6.755137999999988 C13.260296999999923 6.675137999999947 14.554296999999906 6.675137999999947 16.134296999999947 6.675137999999947 H18.561296999999968 z M20.65729699999997 22.325138000000038 C17.73829699999999 22.325138000000038 16.777296999999976 22.35513800000001 16.002297 22.665137999999956 C15.240296999999941 22.96513799999991 14.56729699999994 23.45513799999992 14.04929699999991 24.09513800000002 C13.523296999999957 24.745137999999884 13.204296999999997 25.645137999999974 12.324297000000001 28.435137999999938 C11.695296999999982 30.425137999999947 11.260296999999923 31.805138000000056 11.023296999999957 32.88513799999998 C10.787296999999967 33.95513799999992 10.800297 34.505137999999874 10.89729699999998 34.88513799999998 C11.141296999999895 35.81513800000005 11.73429699999997 36.63513799999998 12.556296999999972 37.145137999999974 C12.884296999999947 37.35513800000001 13.406296999999995 37.525137999999856 14.496296999999913 37.62513799999999 C15.339296999999988 37.70513799999992 16.385296999999923 37.71513799999991 17.76829699999996 37.7251379999999 C18.181296999999972 37.7251379999999 18.622297000000003 37.7251379999999 19.094296999999983 37.7251379999999 H28.96029699999997 C31.627297 37.7251379999999 32.59429699999998 37.69513799999993 33.39429699999994 37.42513799999995 C34.544296999999915 37.04513799999984 35.544296999999915 36.31513800000005 36.26429699999994 35.33513800000003 C36.77429699999993 34.62513799999999 37.09429699999998 33.68513799999994 37.94429699999989 30.9751379999999 C38.48429699999997 29.275137999999856 38.854296999999974 28.10513800000001 39.0642969999999 27.185137999999938 C39.284296999999924 26.275137999999856 39.294296999999915 25.795137999999838 39.23429699999997 25.4751379999999 C39.08429699999999 24.615138 38.64429699999994 23.83513800000003 37.99429699999996 23.265137999999865 C37.98429699999997 23.255137999999874 37.97429699999998 23.245137999999884 37.954297 23.235137999999893 C37.74429699999996 23.045137999999838 37.49429699999996 22.885137999999984 37.23429699999997 22.745137999999884 C36.954297 22.60513800000001 36.49429699999996 22.46513799999991 35.554296999999906 22.395137999999974 C34.614296999999965 22.325138000000038 33.38429699999995 22.325138000000038 31.610296999999946 22.325138000000038 H20.65729699999997 z M16.134296999999947 10.27513799999997 C14.49429699999996 10.27513799999997 13.37329699999998 10.27513799999997 12.504296999999951 10.345137999999906 C11.657296999999971 10.415137999999956 11.210296999999969 10.545137999999952 10.891296999999895 10.70513799999992 C10.148296999999957 11.085137999999915 9.543296999999939 11.685137999999938 9.16429699999992 12.435137999999938 C9.002296999999999 12.755137999999988 8.875296999999932 13.195137999999929 8.806296999999972 14.045137999999952 C8.735296999999946 14.915137999999956 8.73429699999997 16.03513799999996 8.73429699999997 17.675137999999947 V27.84513800000002 C8.7852969999999 27.685137999999938 8.838296999999898 27.515137999999865 8.892296999999985 27.34513800000002 C9.67829699999993 24.865138 10.191296999999963 23.135137999999984 11.257296999999994 21.825138000000038 C12.16429699999992 20.70513799999992 13.340296999999964 19.845137999999906 14.675297 19.315137999999934 C16.24429699999996 18.69513799999993 18.048296999999934 18.7251379999999 20.65729699999997 18.7251379999999 H31.610296999999946 C33.33429699999999 18.7251379999999 34.72429699999998 18.7251379999999 35.83429699999999 18.805137999999943 C36.284296999999924 18.845137999999906 36.73429699999997 18.895137999999974 37.15429699999993 18.9751379999999 C36.75429699999995 17.7251379999999 35.74429699999996 16.76513799999998 34.454297 16.435137999999938 C34.054296999999906 16.335137999999915 33.52429699999993 16.325137999999924 31.78629699999999 16.325137999999924 H28.875296999999932 C28.51529699999992 16.325137999999924 28.103296999999998 16.305137999999943 27.70229699999993 16.19513799999993 C27.278296999999952 16.075137999999924 26.87929699999995 15.875137999999993 26.524296999999933 15.615138000000002 C26.07729699999993 15.295137999999952 25.746296999999913 14.845137999999906 25.485296999999946 14.515137999999979 L24.381296999999904 13.105137999999897 C23.305296999999996 11.735137999999893 22.965296999999964 11.325137999999924 22.576296999999954 11.045137999999952 C22.191296999999963 10.755137999999988 21.757296999999994 10.545137999999952 21.297296999999958 10.415137999999956 C20.833296999999902 10.295137999999952 20.30329699999993 10.27513799999997 18.561296999999968 10.27513799999997 H16.134296999999947 z\" fill=\"currentColor\"/></svg>";

        function renderFolders() {
            const list = document.querySelector('#dsFolderPanel .dsList');
            if (!list) return;
            syncArchiveVisibility();
            list.innerHTML = '';

            // 树形：生成当前会话 on 状态快照
            const currentOn = new Set();
            { const h = location.pathname.match(/\/s\/([^/]+)/); if (h) currentOn.add(h[1]); }

            data.folders.forEach((f) => {
                const sids = Object.keys(data.links).filter((k) => data.links[k] === f.id);

                // 文件夹树行
                const row = document.createElement('div');
                row.className = 'dsItem';
                row.innerHTML = `
                    <button class="dsCaret" title="${isExpanded(f.id) ? '收起' : '展开'}">${isExpanded(f.id) ? ICON_FOLDER_OPEN : ICON_FOLDER_CLOSED}</button>
                    <span class="dsName"></span>
                    <span class="dsCount">${sids.length}</span>
                    <span class="dsOps">
                        <button data-act="rename">改名</button>
                        <button data-act="del">删除</button>
                    </span>`;
                row.querySelector('.dsName').textContent = f.name;
                row.querySelector('.dsCaret').addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    toggleExpanded(f.id); saveData(); renderFolders();
                });
                // 点文件夹行（排除箭头与操作钮）：切换展开/折叠
                row.addEventListener('click', (ev) => {
                    if (ev.target.dataset.act) return;
                    if (ev.target.classList.contains('dsCaret')) return;
                    toggleExpanded(f.id); saveData(); renderFolders();
                });
                row.querySelector('[data-act="rename"]').addEventListener('click', (ev) => { ev.stopPropagation(); onRenameFolder(f); });
                row.querySelector('[data-act="del"]').addEventListener('click', (ev) => { ev.stopPropagation(); onDeleteFolder(f); });
                list.appendChild(row);

                // 展开时：内嵌该文件夹内会话行
                if (sids.length && isExpanded(f.id)) {
                    const wrap = document.createElement('div');
                    wrap.className = 'dsFoldBody';
                    wrap.dataset.folder = f.id;
                    for (const sid of sids) {
                        const native = nativeNodeFor(sid);
                        if (!native) continue;
                        const on = currentOn.has(sid);
                        const cr = document.createElement('div');
                        cr.className = 'dsConvRow' + (on ? ' on' : '');
                        cr.innerHTML = `<span class="dsConvTitle"></span>`;
                        const cvT = cr.querySelector('.dsConvTitle');
                        cvT.textContent = titleOf(native);
                        bindTitleTip(cvT, titleOf(native));   // 自绘 tooltip（官方质感），仅标题溢出时触发
                        cr.addEventListener('click', (e) => {
                            if (currentOn.has(sid)) return; // 已是当前会话：避免触发原生重载/回滚
                            const n = nativeNodeFor(sid);
                            if (n) n.click();
                        });
                        const out = document.createElement('button');
                        out.className = 'dsOut';
                        out.textContent = '移出';
                        out.addEventListener('click', (ev) => {
                            ev.stopPropagation();
                            delete data.links[sid];
                            saveData(); renderFolders();
                        });
                        cr.appendChild(out);
                        wrap.appendChild(cr);
                    }
                    list.appendChild(wrap);
                }
            });

            if (data.folders.length === 0) {
                const e = document.createElement('div');
                e.className = 'dsEmpty';
                e.textContent = '还没有文件夹，点「+ 新建」';
                list.appendChild(e);
            }
        }

        /* ---------- 自绘标题 tooltip（对齐官网 .ds-tooltip：bg #2c2c2e / #fff / 12px / 4px 8px / radius 10px；仅标题溢出时触发） ---------- */
        let _dsConvTip = null;
        function ensureConvTip() {
            if (_dsConvTip && _dsConvTip.isConnected) return _dsConvTip;
            _dsConvTip = document.createElement('div');
            _dsConvTip.className = 'dsFolderTip';
            document.body.appendChild(_dsConvTip);
            return _dsConvTip;
        }
        function hideConvTip() { if (_dsConvTip) _dsConvTip.style.display = 'none'; }
        function positionConvTip(anchor) {
            const t = ensureConvTip();
            const a = anchor.getBoundingClientRect();
            t.style.display = 'block';
            t.style.left = '0px'; t.style.top = '0px';
            const tw = t.offsetWidth, th = t.offsetHeight;
            let left = a.left + 8;
            if (left + tw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tw - 12);
            let top = a.bottom + 6;
            if (top + th > window.innerHeight - 8) top = a.top - th - 6;
            t.style.left = left + 'px';
            t.style.top = top + 'px';
        }
        function bindTitleTip(el, fullText) {
            el.addEventListener('mouseenter', () => {
                const s = getComputedStyle(el);
                // 官网会话 tooltip 也仅当标题溢出（被省略号截断）时显示
                if (s.scrollWidth > s.clientWidth || s.textOverflow === 'ellipsis') {
                    ensureConvTip().textContent = fullText;
                    positionConvTip(el);
                }
            });
            el.addEventListener('mousemove', () => { if (_dsConvTip && _dsConvTip.style.display !== 'none') positionConvTip(el); });
            el.addEventListener('mouseleave', hideConvTip);
        }

        /* ---- 树形与标签同步（共用）：数据改动后的重建入口 ---- */
        function resyncFolders() { refreshTags(); renderFolders(); }

        /* ---------- 文件夹操作 ---------- */
        function onCreateFolder() {
            const name = prompt('新建文件夹名称：', '新建文件夹');
            if (name === null) return;
            const t = name.trim(); if (!t) return;
            data.folders.push({ id: genId(), name: t });
            saveData(); renderFolders();
        }
        function onRenameFolder(f) {
            const name = prompt('重命名文件夹：', f.name);
            if (name === null) return;
            const t = name.trim(); if (!t) return;
            f.name = t; saveData(); renderFolders();
        }
        function onDeleteFolder(f) {
            if (!confirm(`删除文件夹「${f.name}」？其中的对话会回到「全部对话」。`)) return;
            data.folders = data.folders.filter((x) => x.id !== f.id);
            for (const k of Object.keys(data.links)) if (data.links[k] === f.id) delete data.links[k];
            delete data.expanded[f.id];
            saveData(); refreshTags(); renderFolders();
        }

        /* ---------- 标签 / 标题 ---------- */
        function titleOf(a) {
            const t = a.querySelector('div.c08e6e93');
            return ((t ? t.textContent : a.textContent) || '').trim() || '未命名对话';
        }
        function refreshTags() {
            const dark = isDark();
            document.querySelectorAll('a[href^="/a/chat/s/"]').forEach((a) => {
                const sid = sessionIdOf(a);
                const fid = data.links[sid] || null;
                const titleEl = a.querySelector('div.c08e6e93');
                if (!titleEl) return;
                const existing = titleEl.querySelector('.dsTag');
                if (fid) {
                    const name = folderNameOf(fid);
                    const c = folderColor(fid);
                    if (!existing) {
                        const tag = document.createElement('span');
                        tag.className = 'dsTag'; tag.textContent = name;
                        tag.style.background = c + '30';
                        tag.style.color = dark ? c : shadeHex(c, -0.48);
                        titleEl.appendChild(tag);
                    } else if (existing.textContent !== name || existing.dataset.fid !== fid) {
                        existing.textContent = name; existing.dataset.fid = fid;
                        existing.style.background = c + '30';
                        existing.style.color = dark ? c : shadeHex(c, -0.48);
                    }
                } else if (existing) { existing.remove(); }
            });
        }

        /* ---------- 官方三点菜单注入 ---------- */
        function escapeHtml(s) {
            return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }
        // 记录当前打开菜单所属会话（关闭时不记录）。按下/点击三点按钮即视为打开官方菜单：
        // React portal 可复用浮层容器会在重现菜单时，若该项恰在指针正下方而指针没动，也会合成 mouseenter。
        // 这里分别记住「按下时刻」与「最近一次真实指针位移」，供 openOnHover 判定是否为“伪悬停”。
        document.addEventListener('pointerdown', (e) => {
            if (!folderManagerEnabled) return;
            if (e.target.closest('#dsFolderPop, [data-ds-move]')) return;   // 我们自己的浮层/项不算打开官方菜单
            lastMenuOpenAt = Date.now();
        }, true);
        document.addEventListener('click', (e) => {
            if (!folderManagerEnabled) return;
            const btn = e.target.closest('[class*="ds-button"]');
            if (!btn) return;
            const link = btn.closest('a[href^="/a/chat/s/"]');
            if (!link) return;
            const sid = sessionIdOf(link);
            if (sid) fCurrentMenuSid = sid;
        }, true);

        function injectMoveToFolder(menu) {
            if (menu.querySelector('[data-ds-move]')) return;
            const item = document.createElement('div');
            item.className = 'ds-dropdown-menu-option ds-dropdown-menu-option--none';
            item.setAttribute('role', 'menuitem');
            item.dataset.dsMove = '1';
            item.innerHTML = `
                <div class="ds-dropdown-menu-option__icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
                </div>
                <div class="ds-dropdown-menu-option__label">移动到文件夹</div>`;
            // 鼠标从官方菜单项滑到本项后，官方项的高亮态残留修复
            const clearNativeHighlight = () => {
                menu.querySelectorAll('.ds-dropdown-menu-option').forEach((o) => {
                    if (o === item) return;
                    o.removeAttribute('data-highlighted');
                    if (o.getAttribute('data-state') === 'active') o.setAttribute('data-state', '');
                    o.removeAttribute('aria-selected');
                    [...o.classList].forEach((c) => { if (/highlight|active/i.test(c)) o.classList.remove(c); });
                });
            };
            item.addEventListener('mouseenter', clearNativeHighlight);
            item.addEventListener('pointerenter', clearNativeHighlight);
            // 悬停即展开次级菜单（仿 Windows 右键二级菜单）
            const openOnHover = () => {
                if (document.getElementById('dsFolderPop')) return;
                // 防「伪悬停」误展开：点击三点按钮重现当前菜单时，若该项恰在指针正下方而指针没动，
                // 浏览器仍会合成一个 mouseenter。判定——菜单刚被打开(pointerdown 距今 <300ms)且
                // 自该打开后没有任何真实指针位移(lastRealMoveAt 停在更早) —— 视为伪事件，先不展开，
                // 等用户真正把光标移入该项才 `mouseenter`/`pointerenter`（届时已有新位移）自然打开。v4.7.0
                if (Date.now() - lastMenuOpenAt < 300 && lastRealMoveAt < lastMenuOpenAt) return;
                cancelClosePopup();
                if (fCurrentMenuSid) openFolderPopup(fCurrentMenuSid, item);
            };
            item.addEventListener('mouseenter', openOnHover);
            item.addEventListener('pointerenter', openOnHover);
            item.addEventListener('mouseleave', scheduleClosePopup);
            item.addEventListener('mouseenter', cancelClosePopup);
            item.addEventListener('click', (ev) => {
                ev.preventDefault(); ev.stopPropagation();
                if (document.getElementById('dsFolderPop')) return;
                if (fCurrentMenuSid) openFolderPopup(fCurrentMenuSid, item);
            });
            menu.appendChild(item);
        }

        // 悬停意图计时：离开浮层/锚点后稍候再关，避免穿梭 4px 间隙闪烁
        let dsPopupCloseTimer = null;
        function scheduleClosePopup() { clearTimeout(dsPopupCloseTimer); dsPopupCloseTimer = setTimeout(closeFolderPopup, 220); }
        function cancelClosePopup() { clearTimeout(dsPopupCloseTimer); dsPopupCloseTimer = null; }
        function closeFolderPopup() {
            clearTimeout(dsPopupCloseTimer); dsPopupCloseTimer = null;
            const p = document.getElementById('dsFolderPop'); if (p) p.remove();
        }
        function openFolderPopup(sid, anchor) {
            closeFolderPopup();
            const dark = isDark();
            const pop = document.createElement('div');
            pop.id = 'dsFolderPop';
            pop.style.cssText = `position:fixed;z-index:2000;background:${dark ? '#2a2e3a' : '#ffffff'};
                border:1px solid var(--ds-border);border-radius:10px;padding:5px;min-width:175px;
                box-shadow:0 10px 30px rgba(0,0,0,.4);font-size:13.5px;color:var(--ds-text);
                max-height:calc(100vh - 16px);overflow:auto;`;
            let html = '';
            for (const f of data.folders) {
                html += `<div class="dsmpItem" data-fid="${f.id}">
                    <span style="width:9px;height:9px;border-radius:50%;background:${folderColor(f.id)};display:inline-block;"></span>${escapeHtml(f.name)}</div>`;
            }
            html += `<div class="dsmpSep"></div>
                <div class="dsmpItem" data-fid="__new__">+ 新建文件夹…</div>
                <div class="dsmpItem" data-fid="__none__">移出文件夹（未分类）</div>`;
            pop.innerHTML = html;
            document.body.appendChild(pop);

            // 级联定位：锚点右侧展开，放不下翻左侧，垂直对齐夹紧在视口内
            const r = anchor.getBoundingClientRect();
            const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 4;
            let left = r.right + gap;
            if (left + pw > window.innerWidth - 8) { left = r.left - pw - gap; if (left < 8) left = 8; }
            let top = r.top - 2;
            top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';

            pop.addEventListener('mouseenter', cancelClosePopup);
            pop.addEventListener('mouseleave', scheduleClosePopup);
            pop.addEventListener('click', (ev) => {
                const it = ev.target.closest('.dsmpItem');
                if (!it) return;
                let fid = it.dataset.fid;
                if (fid === '__new__') {
                    const name = prompt('新建文件夹名称：', '新建文件夹');
                    if (name === null) return;
                    const t = name.trim(); if (!t) return;
                    fid = genId(); data.folders.push({ id: fid, name: t });
                } else if (fid === '__none__') {
                    delete data.links[sid];
                } else {
                    data.links[sid] = fid;
                }
                saveData();
                // 收敛「移动」：仅移除我们自己的浮层，绝不把祖级官方浮层容器 .ds-floating-container 设 display:none。
                // 原因：官方该容器跨会话复用（React portal 只在首开时创建、之后复用），若我们用内联 none 藏死它，
                // 之后再次点 ⋯ 菜单只会渲染进这个永久隐藏的容器 → 表现为“菜单点不开/无反应”。
                // 官方菜单的关闭由 DeepSeek 自身的点击/ESC 语义处理，这里不越权接管。
                closeFolderPopup();
                resyncFolders();
            });
            setTimeout(() => document.addEventListener('click', closeFolderPopup, { once: true }), 0);
        }
        function injectMenus() {
            if (!folderManagerEnabled) return;
            document.querySelectorAll('.ds-dropdown-menu[role="menu"]').forEach((menu) => {
                const t = menu.textContent || '';
                if (!/重命名/.test(t) || !/删除/.test(t)) return; // 仅会话菜单
                injectMoveToFolder(menu);
            });
        }

        /* ---------- 由外层驱动的刷新（取代原自持 observer；v0.9.2 导航守卫防自循环） ---------- */
        let folderPending = null;
        let folderLastSid = (location.pathname.match(/\/s\/([^/]+)/) || [])[1] || null;   // 高亮/重绘守卫
        function schedule() {
            if (!folderManagerEnabled) return;
            if (folderPending) return;
            folderPending = setTimeout(() => {
                folderPending = null;
                ensurePanel();
                refreshTags();
                injectMenus();
                // 导航切换后重绘树（仅当 url 会话变化才做，避免 observer 自激循环）
                const cur = (location.pathname.match(/\/s\/([^/]+)/) || [])[1] || null;
                if (cur !== folderLastSid) { folderLastSid = cur; renderFolders(); }
                syncArchiveVisibility(); // 外部新增会话行也要按归档立即隐藏（仅改 display，不引循环）
            }, 120);
        }
        function cancelSchedule() { if (folderPending) { clearTimeout(folderPending); folderPending = null; } }

        /* ---------- on / off（外层开关驱动） ---------- */
        function on() {
            injectCss();
            applyTheme();
            schedule();
        }
        function off() {
            cancelSchedule();
            fCurrentMenuSid = null;
            closeFolderPopup();
            if (_dsConvTip) { _dsConvTip.remove(); _dsConvTip = null; }   // 清掉自绘 tooltip 残留节点
            // 复位归档隐藏：把 syncArchiveVisibility 藏起来的官方会话行全部还原（不越权动原生结构）
            document.querySelectorAll('a[href^="/a/chat/s/"]').forEach((a) => { a.style.display = ''; });
            document.querySelectorAll('[data-ds-move]').forEach((el) => el.remove());
            document.querySelectorAll('.dsTag').forEach((el) => el.remove());
            const panel = document.getElementById('dsFolderPanel'); if (panel) panel.remove();
            removeCss();
            // 移除注入的 --ds-* CSS 变量（复原官网原生配色源）
            const rs = document.documentElement.style;
            ['--ds-text','--ds-sub','--ds-hover','--ds-active-bg','--ds-accent','--ds-divider','--ds-border']
                .forEach((k) => rs.removeProperty(k));
        }
        function refreshData() { data = loadData(); renderFolders(); refreshTags(); }

        return { on, off, schedule, refreshData, isDark };
    })();

    // hold the ref so disabled switching can re-load stored folder list later
    const folderEnabledChanged = (nowEnabled) => {
        if (nowEnabled) { folderUnit.on(); showToast('对话文件夹管理已开启'); }
        else { folderUnit.off(); showToast('对话文件夹管理已关闭'); }
    };

    // ==================== 统一 DOM 监听（合并多个 observer，添加节流） ====================
    let _domObserver = null;
    function observeDOM() {
        if (_domObserver) return;
        _domObserver = new MutationObserver(mutations => {
            let hasNewCodeBlocks = false;
            let hasNewTables = false;
            let hasNewThinking = false;
            let folderNeedsRescan = false;   // 对话文件夹：出现新的会话链接/三点菜单时刷新

            for (const m of mutations) {
                if (m.type !== 'childList' || !m.addedNodes.length) continue;
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    // 代码块检测
                    if (!hasNewCodeBlocks) {
                        if (node.matches && node.matches('pre')) { hasNewCodeBlocks = true; }
                        else if (node.querySelectorAll) {
                            if (node.querySelector('pre')) hasNewCodeBlocks = true;
                            // 只查直接子级 pre，深度遍历留给具体处理
                        }
                    }

                    // 表格检测（含增量行/列，防范流式输出中仅新增 tr/td/th 的情况）
                    if (!hasNewTables) {
                        if (node.matches && node.matches('table,tbody,thead,tfoot,tr,td,th,.ds-markdown')) hasNewTables = true;
                        else if (node.querySelectorAll && (node.querySelector('table') || node.querySelector('.ds-markdown'))) hasNewTables = true;
                    }

                    // 思考区域检测（排除代码块内的文本）
                    if (!hasNewThinking && autoCollapseThinking) {
                        if (node.closest && node.closest('pre, .md-code-block')) continue;
                        if (node.classList && node.classList.contains('ds-think-content')) {
                            hasNewThinking = true;
                        } else if (node.querySelectorAll && node.querySelector('.ds-think-content')) {
                            hasNewThinking = true;
                        }
                    }

                    // 对话文件夹：用于纠偏官网虚拟列表/菜单复用等不一定会 emit 匹配文件的情况，与原独立脚本一致、
                    // 使用宽触发——任何 ELEMENT 新增都计划重扫。schedule 自带 120ms 节流，且 ensurePanel/refreshTags/
                    // applyHiding/标签注入都是幂等操作（不产生新的 childList），面板自身的插入也只多触发一次自稳 tick，不会自循环。
                    if (folderManagerEnabled && !folderNeedsRescan) folderNeedsRescan = true;
                }
            }

            if (hasNewCodeBlocks) {
                document.querySelectorAll('pre').forEach(pre => {
                    if (!pre.hasAttribute(processedAttr)) addFoldButtonToCodeBlock(pre);
                });
            }
            if (hasNewTables) scheduleTableProcess();
            if (hasNewThinking) setTimeout(processAllThinkingSections, 150);
            if (folderNeedsRescan) folderUnit.schedule();
        });
        _domObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ==================== 初始化 ====================
    function init() {
        applyTableThemeClass(tableThemeMode);
        applyWideScreen(wideScreen);
        setTableButtonsAlways(tableButtonsAlways);
        cleanupLegacyWrappers();
        deduplicateButtons();
        processAllExistingCodeBlocks();
        processAllTables();
        if (autoCollapseThinking) {
            setupThinkContentHiding();
            processAllThinkingSections();
        }
        if (folderManagerEnabled) {
            folderUnit.on();
            folderUnit.schedule();   // 页面加载即应用（不等会话链接出现前的首轮 DOM 变化）
        }
        observeDOM();

        // resize 节流处理表格
        window.addEventListener('resize', () => {
            clearTimeout(window._resizeFix);
            window._resizeFix = setTimeout(processAllTables, 100);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();