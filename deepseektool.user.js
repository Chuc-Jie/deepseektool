// ==UserScript==
// @name         DeepSeek 功能增强工具箱
// @namespace    https://github.com/Chuc-Jie/deepseektool
// @version      5.1.0
// @description  为 DeepSeek 对话页提供统一控制面板：代码块折叠与外观、代码块导出为图片（8 项样式可调）、表格优化及 PNG/CSV/Markdown 导出、对话导出为 Markdown（勾选 + 9 套模板）、AI 思考过程自动折叠、对话文件夹分组、宽屏模式与 Ctrl+Enter 发送。设置即时生效、无需刷新。
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
    const STORAGE_PIN_COLLAPSED = 'deepseek_pin_group_collapsed';       // 原生「置顶」分组折叠态（默认展开）
    const STORAGE_PIN_COLLAPSIBLE = 'deepseek_pin_group_collapsible';   // 原生「置顶」分组折叠能力开关（默认关，opt-in）
    const STORAGE_CODE_BG = 'deepseek_code_bg_enhance';                 // 代码块背景加深（默认开）
    const STORAGE_CODE_BG_LEVEL = 'deepseek_code_bg_level';             // 加深强度档位：light / medium / strong
    const STORAGE_TABLE_EXPORT_ROUNDED = 'deepseek_table_export_rounded'; // PNG 导出表格四角圆角（默认开）
    const STORAGE_MD_EXPORT_ENABLED = 'deepseek_md_export_enabled';       // 对话导出为 Markdown 总开关（默认开）
    const STORAGE_CODE_EXPORT_ENABLED = 'deepseek_code_export_enabled';   // 代码块「导出为图片」按钮总开关（默认开）
    const STORAGE_CODE_IMAGE_PREFS = 'deepseek_code_image_prefs';         // 代码块导图样式偏好（JSON，记住上次选择）
    // 说明：v4.12 起「含思考过程 / 仅导出 AI 回答」不再作为设置项，改为在导出弹窗里每次询问。
    // 因此**不得**再把旧键 deepseek_md_export_reasoning / _answer_only 读作默认值 ——
    // 那会形成一个「用户在设置里看不见、也关不掉」的隐形开关（曾导致「全选后只导出回答」的事故）。
    const STORAGE_MD_EXPORT_PREFS = 'deepseek_md_export_prefs';             // 弹窗「记住我的选择」落库（JSON）
    const STORAGE_MD_EXPORT_APPEND_DATE = 'deepseek_md_export_append_date'; // 文件名附加日期（默认开，避免重名覆盖）
    const LEGACY_MD_KEYS = ['deepseek_md_export_reasoning', 'deepseek_md_export_answer_only'];

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
    let pinGroupCollapsible = GM_getValue(STORAGE_PIN_COLLAPSIBLE, false);  // 置顶分组可折叠（默认关，opt-in）
    let codeBgEnhance = GM_getValue(STORAGE_CODE_BG, true);                 // 代码块背景加深（默认开）
    let codeBgLevel = GM_getValue(STORAGE_CODE_BG_LEVEL, 'light');          // 加深强度（默认轻档）
    let tableExportRounded = GM_getValue(STORAGE_TABLE_EXPORT_ROUNDED, true); // PNG 导出圆角（默认开）
    let mdExportEnabled = GM_getValue(STORAGE_MD_EXPORT_ENABLED, true);        // 对话导出 Markdown（默认开）
    let mdExportAppendDate = GM_getValue(STORAGE_MD_EXPORT_APPEND_DATE, true); // 文件名附加日期（默认开）
    let codeExportEnabled = GM_getValue(STORAGE_CODE_EXPORT_ENABLED, true);    // 代码块导图按钮（默认开）
    let codeImagePrefs = GM_getValue(STORAGE_CODE_IMAGE_PREFS, null);          // 导图样式偏好（对象或 JSON 字符串）

    const btnTextFold = '折叠';
    const btnTextUnfold = '展开';

    // ==================== SVG 图标 (代码块折叠) ====================
    const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/></svg>`;
    const ICON_CHEVRON_UP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/></svg>`;
    // 「导出为图片」按钮图标（内联 SVG，fill=currentColor 以随按钮文字色；与折叠按钮同为 20px）
    const ICON_EXPORT_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19,19H5V5H19M19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z"/></svg>`;

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
            { key: 'codebg', icon: 'format-color-fill', label: '代码块外观' },
            { key: 'table', icon: 'table-large', label: '表格优化导出' },
            { key: 'mdexport', icon: 'language-markdown', label: '对话导出' },
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
            { key: 'codebg', icon: 'format-color-fill', title: '代码块外观', sub: '背景加深 · 与正文拉开层次', build: () => [
                createToggleSetting('加深代码块背景', '浅色主题下代码块底色由近白的 #F9FAFB 加深，顶部工具条同色并补分隔线（深色主题不受影响）', codeBgEnhance, checked => {
                    codeBgEnhance = checked;
                    GM_setValue(STORAGE_CODE_BG, checked);
                    applyCodeBlockBg(checked, codeBgLevel);
                    showToast(`代码块背景加深已${checked ? '开启' : '关闭'}`);
                }),
                createSelectSetting('加深强度', '轻微 / 中等 / 明显三档底色，按屏幕与偏好自选（仅浅色主题生效）', [
                    { value: 'light', label: '轻微（#F3F4F6）' },
                    { value: 'medium', label: '中等（#EEF1F5）' },
                    { value: 'strong', label: '明显（#E9EDF2）' },
                ], codeBgLevel, value => {
                    codeBgLevel = value;
                    GM_setValue(STORAGE_CODE_BG_LEVEL, value);
                    applyCodeBlockBg(codeBgEnhance, value);
                    showToast('代码块背景强度已更新');
                }, !codeBgEnhance),
                createToggleSetting('代码块导出为图片按钮', '代码块右上角显示「导出」按钮：选择样式后将该代码块导出为图片（支持下载 PNG / 复制图片到剪贴板）', codeExportEnabled, checked => {
                    codeExportEnabled = checked;
                    GM_setValue(STORAGE_CODE_EXPORT_ENABLED, checked);
                    applyCodeExportButtons(checked);
                    showToast(`代码块导出按钮已${checked ? '开启' : '关闭'}`);
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
                createToggleSetting('导出图片圆角', 'PNG 导出时把表格四角裁成透明圆角；关闭则与旧版一致（图片中四角为直角矩形）', tableExportRounded, checked => {
                    tableExportRounded = checked;
                    GM_setValue(STORAGE_TABLE_EXPORT_ROUNDED, checked);
                    showToast(`导出图片圆角已${checked ? '开启' : '关闭'}`);
                }),
            ] },
            { key: 'mdexport', icon: 'language-markdown', title: '对话导出', sub: '勾选内容 → 选导出内容 → 选模板 → 导出 .md', build: () => [
                createToggleSetting('启用对话导出', '开启后会提供「选择内容并导出」入口，以及浏览器工具栏菜单命令；关闭则整体不可用', mdExportEnabled, checked => {
                    mdExportEnabled = checked;
                    GM_setValue(STORAGE_MD_EXPORT_ENABLED, checked);
                    if (!checked) mdExportUnit.stopSelection();
                    showToast(`对话导出已${checked ? '开启' : '关闭'}`);
                }),
                createToggleSetting('文件名附加日期', '在文件名后追加 `-YYYY-MM-DD-HH-mm`，避免同日多次导出互相覆盖（与插件格式一致）', mdExportAppendDate, checked => {
                    mdExportAppendDate = checked;
                    GM_setValue(STORAGE_MD_EXPORT_APPEND_DATE, checked);
                    showToast(checked ? '文件名将附加日期' : '文件名不带日期');
                }, !mdExportEnabled),
                createSettingRow('选择内容并导出', '进入勾选模式：手动勾选想导出的消息，点「导出选中 (n)」后在弹窗里选择导出内容与内容模板', (() => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'ds-md-export-run';
                    b.textContent = '开始选择';
                    b.addEventListener('click', () => {
                        if (!mdExportEnabled) { showToast('请先开启「启用对话导出」'); return; }
                        if (mdExportUnit.isSelecting()) mdExportUnit.stopSelection();
                        overlay.remove();          // 关掉设置面板，让位给勾选态
                        mdExportUnit.beginExportFlow();
                    });
                    return b;
                })()),
                createSettingRow('已记住的导出偏好', '上次勾选「记住我的选择」后保存的内容选项与模板；清除后弹窗将回到默认值', (() => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'ds-md-export-run';
                    b.textContent = '清除记忆';
                    b.addEventListener('click', () => {
                        mdExportUnit.clearPrefs();
                        showToast('已清除记住的导出偏好');
                    });
                    return b;
                })()),
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
                createToggleSetting('置顶分组可折叠', '点击原生「置顶」分组标题可收起/展开该组会话（需先开启上方文件夹分组）', pinGroupCollapsible, checked => {
                    pinGroupCollapsible = checked;
                    GM_setValue(STORAGE_PIN_COLLAPSIBLE, checked);
                    folderUnit.setPinCollapsible(checked);
                    showToast(checked ? '置顶分组折叠已开启' : '置顶分组折叠已关闭');
                }, !folderManagerEnabled),
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
                    createInfoIntro('版本', 'DeepSeek 功能增强工具箱 v5.1.0'),
                    createInfoIntro('许可', 'MIT License · 完全开源，可自由使用与修改'),
                    createLinkCardGrid([
                        createLinkCard('GitHub 脚本仓库', '源码 · 更新日志 · Issues', 'https://github.com/Chuc-Jie/deepseektool', 'github'),
                        createLinkCard('ScriptCat 主页', '安装页 · 评论区', 'https://scriptcat.org/zh-CN/script-show-page/5676', 'web'),
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
            // 分区内容统一包进白底卡片（antd List 质感），设置行/说明块的横向内边距由卡片统一承接
            const card = document.createElement('div');
            card.className = 'ds-p-card';
            sec.build().forEach(item => card.appendChild(item));
            page.appendChild(card);
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
                pinGroupCollapsible = false; GM_setValue(STORAGE_PIN_COLLAPSIBLE, false);
                codeBgEnhance = true; GM_setValue(STORAGE_CODE_BG, true);
                codeBgLevel = 'light'; GM_setValue(STORAGE_CODE_BG_LEVEL, 'light');
                tableExportRounded = true; GM_setValue(STORAGE_TABLE_EXPORT_ROUNDED, true);
                mdExportEnabled = true; GM_setValue(STORAGE_MD_EXPORT_ENABLED, true);
                mdExportUnit.clearPrefs();                  // 清掉「记住我的选择」+ v1 遗留键
                mdExportAppendDate = true; GM_setValue(STORAGE_MD_EXPORT_APPEND_DATE, true);
                mdExportUnit.stopSelection();               // 若正处勾选态则退出
                applyCodeBlockBg(true, 'light');
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
    function createSettingRow(labelText, description, controlEl, disabled) {
        const item = document.createElement('div');
        item.className = 'ds-setting-item';
        if (disabled) {
            item.classList.add('dsDisabled');
            item.setAttribute('aria-disabled', 'true');
        }
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

    function createToggleSetting(labelText, description, checked, onToggle, disabled) {
        const label = document.createElement('label');
        label.className = 'ds-switch';
        const input = document.createElement('input');
        input.type = 'checkbox';
        if (checked) input.checked = true;
        if (disabled) input.disabled = true;
        const slider = document.createElement('span');
        slider.className = 'ds-slider';
        label.appendChild(input);
        label.appendChild(slider);
        if (!disabled) input.addEventListener('change', () => onToggle(input.checked));
        return createSettingRow(labelText, description, label, disabled);
    }

    function createSelectSetting(labelText, description, options, selectedValue, onChange, disabled) {
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
        if (disabled) {
            trigger.disabled = true;
            trigger.classList.add('ds-select-disabled');
        }
        return createSettingRow(labelText, description, container, disabled);
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
            // 两类按钮都要一并清除再重建：只删折叠按钮会让导出按钮残留，
            // 且折叠按钮被删后 append 到末尾会造成两按钮顺序错乱。
            pre.parentElement?.querySelectorAll('.ds-fold-btn, .ds-code-export-btn')
                .forEach(b => b.remove());
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

    // 代码块背景加深：总开关 + 强度档位（仅接管浅色主题；深色主题保持官网原样）
    // 官网浅色下代码块为 #F9FAFB，几乎与白底无对比；这里加深并让顶部工具栏条同色、补 1px 底分隔线
    const CODE_BG_LEVEL_CLASS = { light: 'ds-code-bg-1', medium: 'ds-code-bg-2', strong: 'ds-code-bg-3' };
    function applyCodeBlockBg(on, level) {
        const html = document.documentElement;
        html.classList.toggle('ds-code-bg', !!on);
        Object.keys(CODE_BG_LEVEL_CLASS).forEach(k => html.classList.remove(CODE_BG_LEVEL_CLASS[k]));
        if (on) html.classList.add(CODE_BG_LEVEL_CLASS[level] || CODE_BG_LEVEL_CLASS.light);
    }

    // ==================== 菜单命令 ====================
    GM_registerMenuCommand('脚本设置', openControlPanel);
    GM_registerMenuCommand('导出对话', () => {
        mdExportUnit.beginExportFlow();
    });

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
        /* 代码块「导出为图片」按钮：沿用折叠按钮的视觉规范，保证同排观感一致 */
        .ds-code-export-btn {
            background: transparent; border: none; border-radius: 12px;
            font-size: 13px; padding: 4px 8px; cursor: pointer;
            transition: all 0.2s; font-family: system-ui, sans-serif;
            user-select: none; display: inline-flex; align-items: center; gap: 2px;
            opacity: 0.7;
        }
        .ds-code-export-btn:hover { background: rgba(128,128,128,0.2); opacity: 1; }
        .ds-code-export-btn .export-icon { width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; }
        .ds-code-export-btn svg { width: 20px; height: 20px; display: block; }
        /* 对话导出勾选态下整体隐藏，避免与勾选交互互相干扰（与 .table-internal-buttons 同策略） */
        .ds-md-selection-active .ds-code-export-btn { display: none !important; }
        .ds-fold-preview::after { content: " ..."; display: block; text-align: center; color: inherit; opacity: 0.6; margin-top: 4px; }

        /* ===== 设置面板 — 左右布局（深浅双主题） ===== */
        .ds-panel {
            width: min(920px, 94vw); height: min(640px, 84vh);
            display: flex; overflow: hidden;
            border-radius: 8px;
            box-shadow: 0 12px 40px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08);
            font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            /* 浅色默认值 */
            --dsp-content-bg: #f7f8fa;
            --dsp-topbar-bg: #ffffff;
            --dsp-title: #0f172a;
            --dsp-text: #1e293b;
            --dsp-sub: #64748b;
            --dsp-line: #f0f0f0;
            --dsp-ctrl-bg: #ffffff;
            --dsp-ctrl-border: #d9d9d9;
            --dsp-accent: #1677ff;
            --dsp-accent-deep: #0958d9;
            --dsp-accent-soft: rgba(22,119,255,.08);
            --dsp-switch-off: #cbd5e1;
            --dsp-scroll-thumb: rgba(100,116,139,.3);
            --dsp-scroll-thumb-hover: rgba(100,116,139,.52);
            --dsp-opt-hover: rgba(22,119,255,.06);
            --dsp-opt-active: rgba(22,119,255,.12);
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
            --dsp-accent-soft: rgba(22,119,255,.24);
            --dsp-switch-off: rgba(255,255,255,.22);
            --dsp-scroll-thumb: rgba(255,255,255,.16);
            --dsp-scroll-thumb-hover: rgba(255,255,255,.3);
            --dsp-opt-hover: rgba(22,119,255,.16);
            --dsp-opt-active: rgba(22,119,255,.3);
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
            padding: 9px 12px 9px 4px; border-radius: 6px;
            color: rgba(255,255,255,.62); font-size: 14px; font-weight: 500;
            transition: background .18s ease, color .18s ease;
        }
        .ds-p-nav-ic { width: 18px; height: 18px; display: block; flex: none; }
        .ds-p-nav-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .ds-p-nav-divider { height: 1px; background: rgba(255,255,255,.08); margin: 8px 10px 10px 16px; flex-shrink: 0; }
        .ds-p-nav:hover .ds-p-nav-bd { background: rgba(255,255,255,.06); color: #fff; }
        .ds-p-nav.active .ds-p-nav-ind { background: #4096ff; }
        .ds-p-nav.active .ds-p-nav-bd { background: rgba(22,119,255,.26); color: #fff; }

        /* 右主区 */
        .ds-p-main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--dsp-content-bg); }
        .ds-p-topbar {
            flex-shrink: 0; height: 48px;
            display: flex; align-items: center; justify-content: flex-end;
            padding: 0 16px; background: var(--dsp-topbar-bg);
            border-bottom: 1px solid var(--dsp-line);
        }
        .ds-p-close {
            border: none; background: transparent; cursor: pointer;
            color: var(--dsp-sub); font-size: 18px; line-height: 1;
            padding: 6px 8px; border-radius: 6px; transition: background .15s, color .15s;
        }
        .ds-p-close:hover { background: var(--dsp-accent-soft); color: var(--dsp-text); }
        .ds-p-scroll { flex: 1; overflow-y: auto; padding: 24px 24px 24px; scrollbar-width: thin; scrollbar-color: transparent transparent; }
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
            margin: 0 0 4px; font-size: 20px; font-weight: 700;
            display: flex; align-items: center; gap: 9px;
            color: var(--dsp-title); letter-spacing: -.2px;
            user-select: none; -webkit-user-select: none;
        }
        .ds-p-hic { width: 24px; height: 24px; flex: none; }
        /* 帮助/关于：说明字块 */
        .ds-info { padding: 12px 0; }
        .ds-info + .ds-info { border-top: 1px solid var(--dsp-line); }
        .ds-info-title { font-size: 13px; font-weight: 600; color: var(--dsp-text); margin-bottom: 4px; user-select: none; -webkit-user-select: none; }
        .ds-info-body { font-size: 13px; color: var(--dsp-sub); line-height: 1.7; user-select: text; }
        /* 帮助/关于：外链卡片组 */
        .ds-link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; margin: 6px 0 2px; }
        .ds-link-card {
            display: flex; align-items: center; gap: 11px;
            padding: 12px 14px; border-radius: 8px; text-decoration: none;
            background: var(--dsp-ctrl-bg); border: 1px solid var(--dsp-ctrl-border);
            transition: border-color .15s, box-shadow .15s, transform .15s;
        }
        .ds-link-card:hover { border-color: var(--dsp-accent); box-shadow: 0 0 0 3px var(--dsp-accent-soft); transform: translateY(-1px); }
        .ds-link-card-ic { width: 24px; height: 24px; flex: none; }
        .ds-link-card-tx { min-width: 0; display: flex; flex-direction: column; }
        .ds-link-card-title { font-size: 14px; font-weight: 600; color: var(--dsp-text); line-height: 1.3; }
        .ds-link-card-desc { font-size: 12px; color: var(--dsp-sub); margin-top: 2px; line-height: 1.45; }
        .ds-p-sub {
            font-size: 13px; color: var(--dsp-sub);
            padding-bottom: 0; margin-bottom: 16px;
            user-select: text;
        }
        /* 分区内容卡片（antd Card/List 质感：白底承载内容行，分隔线收进卡内，与 #f7f8fa 页底形成层次） */
        .ds-p-card {
            background: var(--dsp-ctrl-bg);
            border: 1px solid var(--dsp-line);
            border-radius: 8px;
            padding: 2px 16px;
        }

        /* 行式设置项 */
        .ds-setting-item {
            display: flex; align-items: center; justify-content: space-between;
            gap: 20px; padding: 14px 0;
            border-bottom: 1px solid var(--dsp-line);
        }
        .ds-setting-item:last-child { border-bottom: none; }
        .ds-setting-label { min-width: 0; }
        .ds-setting-title { font-size: 14px; font-weight: 600; color: var(--dsp-text); user-select: none; -webkit-user-select: none; }
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
        /* 依赖项未开启 → 子开关置灰不可点（Ant Design disabled 语义：降透明度 + not-allowed） */
        .ds-setting-item.dsDisabled { opacity: .5; }
        .ds-setting-item.dsDisabled .ds-setting-title,
        .ds-setting-item.dsDisabled small { cursor: not-allowed; }
        .ds-switch input:disabled + .ds-slider { cursor: not-allowed; }
        .ds-custom-select-trigger.ds-select-disabled { cursor: not-allowed; }

        /* 数字输入 / 单位 */
        .ds-setting-ctrl input[type="number"] {
            width: 96px; padding: 7px 10px;
            border: 1px solid var(--dsp-ctrl-border); border-radius: 6px;
            background: var(--dsp-ctrl-bg); color: var(--dsp-text);
            font-size: 14px; font-family: inherit; outline: none;
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
            border: 1px solid var(--dsp-ctrl-border); border-radius: 6px;
            background: var(--dsp-ctrl-bg); color: var(--dsp-text);
            font-size: 14px; font-family: inherit; cursor: pointer;
            text-align: left; outline: none; transition: border-color .15s, box-shadow .15s;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2394a3b8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat; background-position: right 11px center;
            -webkit-appearance: none; appearance: none;
        }
        .ds-custom-select-trigger:focus { border-color: var(--dsp-accent); box-shadow: 0 0 0 3px var(--dsp-accent-soft); }
        .ds-custom-select-dropdown {
            position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 10002;
            background: var(--dsp-ctrl-bg); border: 1px solid var(--dsp-ctrl-border);
            border-radius: 8px; overflow: hidden;
            box-shadow: 0 6px 16px rgba(0,0,0,.12);
            max-height: 210px; overflow-y: auto;
        }
        .ds-custom-select-option {
            padding: 9px 12px; font-size: 14px; cursor: pointer;
            color: var(--dsp-text); transition: background .1s;
        }
        .ds-custom-select-option:hover { background: var(--dsp-opt-hover); }
        .ds-custom-select-option.active { background: var(--dsp-opt-active); font-weight: 600; }

        /* 底部操作条 */
        .ds-p-footer {
            flex-shrink: 0; display: flex; align-items: center; justify-content: space-between;
            padding: 12px 24px; border-top: 1px solid var(--dsp-line);
            background: var(--dsp-topbar-bg);
        }
        .ds-p-reset {
            font-size: 12.5px; color: var(--dsp-sub); cursor: pointer;
            user-select: none; -webkit-user-select: none; transition: color .15s;
        }
        .ds-p-reset:hover { color: var(--dsp-accent); }
        .ds-p-btn {
            padding: 8px 22px; border: none; border-radius: 6px;
            background: var(--dsp-accent); color: #fff;
            font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background .15s;
        }
        .ds-p-btn:hover { background: var(--dsp-accent-deep); }

        /* 对话导出：设置页内的执行按钮 */
        .ds-md-export-run {
            padding: 8px 18px; border: 1px solid var(--dsp-accent); border-radius: 6px;
            background: transparent; color: var(--dsp-accent);
            font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
            transition: background .15s, color .15s;
            white-space: nowrap;
        }
        .ds-md-export-run:hover { background: var(--dsp-accent); color: #fff; }

        /* ==================== 对话导出：勾选模式 + 两步模态框 ====================
           这些元素挂在 body 上（不在 .ds-panel 内），故不继承 --dsp-* 变量，
           单独定义一组 --ds-md-* 变量并做深色主题覆盖。
           取值参照一套统一的设计令牌（品牌色 / 圆角 / 阴影 / 动效）。

           ⚠ 变量必须定义在 **body** 上，不能只挂在 .ds-md-controls/.ds-md-modal 上：
           勾选态的高亮（.ds-md-msg-selected）与复选框（.ds-md-cb-wrap/.ds-md-checkbox）
           是插进消息列表的，**并不位于那些容器内部**；一旦取不到变量，var() 会失效，
           整条声明被浏览器丢弃 —— 表现为「类名加上了但边框/阴影/背景全没有」。
           （自定义属性会继承，故挂 body 即可覆盖全部 .ds-md-* 元素；名称带前缀，不污染页面。） */
        body {
            --ds-md-surface: #ffffff;
            --ds-md-surface-2: #f8fafc;
            --ds-md-text: #181d26;
            --ds-md-sub: rgba(24, 29, 38, .78);
            --ds-md-tertiary: rgba(24, 29, 38, .58);
            --ds-md-border: #e0e2e6;
            --ds-md-border-strong: rgba(24, 29, 38, .18);
            --ds-md-accent: #1b61c9;
            --ds-md-accent-hover: #164fa8;
            --ds-md-accent-soft: rgba(27, 97, 201, .1);
            --ds-md-danger: #c24141;
            --ds-md-ring: rgba(27, 97, 201, .22);
            --ds-md-overlay: rgba(248, 251, 255, .74);
            --ds-md-shadow-xs: 0 0 1px rgba(0, 0, 0, .18), 0 1px 2px rgba(45, 127, 249, .18);
            --ds-md-shadow-sm: 0 0 1px rgba(0, 0, 0, .18), 0 1px 3px rgba(45, 127, 249, .22);
        }
        /* 字体与文字色只作用于自有组件，绝不落到 body 上（否则会改掉整站排版） */
        .ds-md-controls, .ds-md-modal, .ds-md-notice {
            font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            color: var(--ds-md-text);
        }
        body.dark {
            --ds-md-surface: rgba(15, 23, 34, .94);
            --ds-md-surface-2: rgba(21, 31, 46, .94);
            --ds-md-text: #eef3fb;
            --ds-md-sub: rgba(238, 243, 251, .76);
            --ds-md-tertiary: rgba(238, 243, 251, .56);
            --ds-md-border: rgba(216, 225, 240, .14);
            --ds-md-border-strong: rgba(216, 225, 240, .2);
            --ds-md-accent-soft: rgba(27, 97, 201, .24);
            --ds-md-overlay: rgba(8, 13, 20, .82);
            --ds-md-shadow-xs: 0 0 1px rgba(0, 0, 0, .28), 0 1px 2px rgba(45, 127, 249, .24);
            --ds-md-shadow-sm: 0 2px 4px rgba(0, 0, 0, .34), 0 10px 24px -20px rgba(45, 127, 249, .22);
        }
        .ds-md-controls *, .ds-md-controls *::before, .ds-md-controls *::after,
        .ds-md-modal *, .ds-md-modal *::before, .ds-md-modal *::after,
        .ds-md-notice *, .ds-md-notice *::before, .ds-md-notice *::after { box-sizing: border-box; }
        /* 勾选态元素只给「自身」设 box-sizing —— 不可波及后代：
           .ds-md-msg-selected 圈住的是整条消息（含表格 / 代码块），改其后代盒模型会破坏页面排版 */
        .ds-md-msg-selected, .ds-md-cb-wrap, .ds-md-checkbox { box-sizing: border-box; }

        /* 勾选态：隐藏表格内导出按钮（避免与勾选交互抢注意力，对齐插件隐藏 FAB 的做法） */
        .ds-md-selection-active .table-internal-buttons { display: none !important; }

        /* 勾选态控制条 —— 通栏贴底 + 毛玻璃 */
        .ds-md-controls {
            position: fixed; left: 0; right: 0; bottom: 0; z-index: 10003;
            display: flex; justify-content: center; align-items: center; gap: 12px;
            padding: 12px;
            background: color-mix(in srgb, var(--ds-md-surface) 82%, var(--ds-md-surface-2) 18%);
            border-top: 1px solid var(--ds-md-border);
            box-shadow: var(--ds-md-shadow-xs);
            -webkit-backdrop-filter: saturate(180%) blur(4px);
            backdrop-filter: saturate(180%) blur(4px);
        }
        .ds-md-controls button {
            font: inherit; font-size: 14px; font-weight: 600;
            padding: 10px 20px; border-radius: 12px;
            border: 1px solid var(--ds-md-border);
            background: var(--ds-md-surface); color: var(--ds-md-text);
            cursor: pointer; white-space: nowrap;
            transition: background-color 120ms cubic-bezier(.2, 0, 0, 1), border-color 120ms cubic-bezier(.2, 0, 0, 1), color 120ms cubic-bezier(.2, 0, 0, 1), transform 120ms cubic-bezier(.2, 0, 0, 1), box-shadow 120ms cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-controls .ds-md-select-all:hover:not(:disabled),
        .ds-md-controls .ds-md-select-user:hover:not(:disabled),
        .ds-md-controls .ds-md-select-ai:hover:not(:disabled) {
            background: var(--ds-md-surface-2); border-color: var(--ds-md-border-strong); box-shadow: var(--ds-md-shadow-xs);
        }
        .ds-md-controls button:disabled { cursor: not-allowed; opacity: .55; box-shadow: none; }
        .ds-md-controls button:focus, .ds-md-controls button:focus-visible { outline: 0; }
        .ds-md-controls .ds-md-export-selected {
            background: var(--ds-md-accent); border-color: var(--ds-md-accent); color: #fff;
            box-shadow: var(--ds-md-shadow-xs);
        }
        .ds-md-controls .ds-md-export-selected:hover:not(:disabled) {
            background: var(--ds-md-accent-hover); border-color: var(--ds-md-accent-hover); box-shadow: var(--ds-md-shadow-sm);
        }
        .ds-md-controls .ds-md-export-selected:active:not(:disabled) { transform: scale(.98); }
        .ds-md-controls .ds-md-export-selected:disabled {
            background: var(--ds-md-surface-2); border-color: var(--ds-md-border); color: var(--ds-md-tertiary);
        }
        .ds-md-controls .ds-md-cancel-sel {
            background: transparent; border-color: transparent; color: var(--ds-md-sub);
        }
        .ds-md-controls .ds-md-cancel-sel:hover { background: var(--ds-md-surface-2); }
        /* 提示文字贴在「取消」按钮右侧 */
        .ds-md-controls .ds-md-cancel-wrap { position: relative; display: inline-flex; align-items: center; }
        .ds-md-controls .ds-md-sel-hint {
            position: absolute; left: calc(100% + 10px); top: 50%; transform: translateY(-50%);
            white-space: nowrap; pointer-events: none; line-height: 1;
            font-size: 13px; font-weight: 600; color: var(--ds-md-danger, #c24141);
        }
        .ds-md-controls .ds-md-sel-hint.is-ok { color: var(--ds-md-sub); font-weight: 500; }

        /* 扫描中：隐藏复选框（避免勾到半成品） */
        .ds-md-selection-scanning .ds-md-cb-wrap { display: none !important; }

        /* 右上角提示条（对齐插件 components/feedback/notice.css） */
        @keyframes dsMdNoticeIn { from { opacity: 0; transform: translateX(20px) scale(.95); } to { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes dsMdNoticeOut { from { opacity: 1; transform: translateX(0) scale(1); } to { opacity: 0; transform: translateX(20px) scale(.95); } }
        @keyframes dsMdNoticeSpin { to { transform: rotate(360deg); } }
        .ds-md-notice {
            position: fixed; top: 18px; right: 18px; z-index: 10005;
            max-width: min(360px, calc(100vw - 24px));
            padding: 10px 14px;
            background: color-mix(in srgb, var(--ds-md-surface) 88%, var(--ds-md-surface-2) 12%);
            -webkit-backdrop-filter: saturate(165%) blur(4px);
            backdrop-filter: saturate(165%) blur(4px);
            border: 1px solid var(--ds-md-border);
            border-radius: 16px;
            box-shadow: var(--ds-md-shadow-xs);
            color: var(--ds-md-text);
            transform-origin: right center;
            animation: dsMdNoticeIn 280ms cubic-bezier(.16, 1, .3, 1) forwards;
        }
        .ds-md-notice.closing { animation: dsMdNoticeOut 180ms cubic-bezier(.2, 0, 0, 1) forwards; pointer-events: none; }
        .ds-md-notice-content { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ds-md-notice-spinner { width: 20px; height: 20px; flex: none; display: flex; align-items: center; justify-content: center; }
        .ds-md-notice-ring {
            box-sizing: border-box; width: 100%; height: 100%;
            border: 2px solid var(--ds-md-border);
            border-top-color: var(--ds-md-accent);
            border-right-color: var(--ds-md-accent-soft);
            border-radius: 50%;
            animation: dsMdNoticeSpin .9s linear infinite;
        }
        .ds-md-notice-message { font-size: 14px; font-weight: 600; line-height: 1.35; letter-spacing: .1px; word-break: break-word; }
        @media (max-width: 640px) {
            .ds-md-notice { top: 12px; right: 12px; max-width: calc(100vw - 16px); padding: 9px 12px; border-radius: 12px; }
            .ds-md-notice-spinner { width: 18px; height: 18px; }
        }

        /* 每条消息的复选框（右上/左上角） */
        .ds-md-cb-wrap { position: absolute; z-index: 10; }
        .ds-md-cb-wrap.ds-md-cb-user { top: 5px; left: 5px; }
        .ds-md-cb-wrap.ds-md-cb-ai { top: 5px; right: 5px; }
        .ds-md-checkbox {
            appearance: none; -webkit-appearance: none; width: 20px; height: 20px; margin: 0;
            border: 2px solid var(--ds-md-text); border-radius: 8px;
            background-color: var(--ds-md-surface); cursor: pointer; position: relative;
            transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
        }
        .ds-md-checkbox:hover { border-color: var(--ds-md-accent); }
        .ds-md-checkbox:checked {
            background-color: var(--ds-md-accent); border-color: var(--ds-md-accent);
            box-shadow: var(--ds-md-shadow-xs);
        }
        .ds-md-checkbox:checked::after {
            content: "✔"; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: #f9fcff; font-size: 14px; line-height: 1;
        }

        /* 选中高亮（用户右对齐气泡 / AI 居中） */
        .ds-md-msg-selected {
            border: 2px solid var(--ds-md-border-strong) !important;
            border-radius: 12px;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-md-border-strong) 60%, transparent 40%);
            background-color: color-mix(in srgb, var(--ds-md-surface-2) 82%, transparent 18%);
            padding-top: 10px; padding-bottom: 10px;
            position: relative; overflow: hidden; box-sizing: border-box;
        }
        .ds-md-msg-selected.ds-md-msg-user {
            display: block; width: fit-content; max-width: min(850px, 100%);
            margin-left: auto; margin-right: 0; word-wrap: break-word;
            border-color: var(--ds-md-border) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-md-border) 72%, transparent 28%);
            background-color: color-mix(in srgb, var(--ds-md-surface-2) 90%, transparent 10%);
        }
        .ds-md-msg-selected.ds-md-msg-ai {
            max-width: 850px; padding-top: 20px; margin-left: auto; margin-right: auto;
            word-wrap: break-word;
            border-color: var(--ds-md-accent) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-md-accent) 62%, transparent 38%);
            background-color: color-mix(in srgb, var(--ds-md-accent) 6%, var(--ds-md-surface-2) 94%);
        }

        /* 两步模态框 —— 对齐插件 dialog.css：780px / 24px 圆角 / 浅色毛玻璃遮罩 / 滑入动画 */
        @keyframes dsMdOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dsMdDialogIn { from { opacity: 0; transform: scale(.94) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes dsMdStepIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes dsMdStepBack { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
        .ds-md-modal {
            position: fixed; inset: 0; z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            background: var(--ds-md-overlay);
            -webkit-backdrop-filter: saturate(160%) blur(4px);
            backdrop-filter: saturate(160%) blur(4px);
            animation: dsMdOverlayIn 180ms cubic-bezier(.2, 0, 0, 1) forwards;
        }
        .ds-md-dialog {
            width: 92%; max-width: 780px; max-height: 80vh;
            display: flex; flex-direction: column; overflow: hidden;
            background: var(--ds-md-surface);
            border: 1px solid var(--ds-md-border);
            border-radius: 24px;
            box-shadow: var(--ds-md-shadow-xs);
            animation: dsMdDialogIn 280ms cubic-bezier(.16, 1, .3, 1) forwards;
        }
        .ds-md-dlg-header {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 20px 28px;
        }
        .ds-md-dlg-title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: .1px; color: var(--ds-md-text); }
        .ds-md-dlg-close {
            width: 32px; height: 32px; display: grid; place-items: center; flex: none;
            border: 0; background: transparent; cursor: pointer; padding: 0;
            font-size: 15px; line-height: 1; color: var(--ds-md-sub);
            border-radius: 8px;
            transition: background-color 120ms cubic-bezier(.2, 0, 0, 1), color 120ms cubic-bezier(.2, 0, 0, 1), box-shadow 120ms cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-dlg-close:hover { background: var(--ds-md-surface-2); color: var(--ds-md-text); box-shadow: var(--ds-md-shadow-xs); }
        .ds-md-dlg-close:focus, .ds-md-dlg-close:focus-visible { outline: 0; }
        .ds-md-dlg-body { padding: 12px 32px 32px; overflow-y: auto; flex: 1; min-height: 0; }
        .ds-md-step-content { display: flex; flex-direction: column; }
        .ds-md-step-template.step-slide-in { animation: dsMdStepIn .3s cubic-bezier(.16, 1, .3, 1) forwards; }
        .ds-md-step-content.step-slide-back { animation: dsMdStepBack .25s cubic-bezier(.16, 1, .3, 1) forwards; }
        .ds-md-dlg-sub {
            margin: 0 0 24px; text-align: center;
            font-size: 14px; font-weight: 500; line-height: 1.4; color: var(--ds-md-sub);
        }
        .ds-md-field { margin-bottom: 18px; }
        .ds-md-field-label { font-size: 12px; font-weight: 600; color: var(--ds-md-sub); margin-bottom: 8px; letter-spacing: .02em; }

        /* 格式按钮：3 列大卡（对齐插件 .format-btn：48px 图标 + 28px 内边距 + hover 上浮） */
        .ds-md-format-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .ds-md-fmt-btn {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 28px 20px; cursor: pointer; font: inherit;
            border: 1px solid var(--ds-md-border); border-radius: 16px;
            background: var(--ds-md-surface-2); color: var(--ds-md-text);
            position: relative; user-select: none;
            transition: transform 180ms cubic-bezier(.2, 0, 0, 1), border-color 180ms cubic-bezier(.2, 0, 0, 1), background-color 180ms cubic-bezier(.2, 0, 0, 1), box-shadow 180ms cubic-bezier(.2, 0, 0, 1), color 180ms cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-fmt-btn::before {
            content: ""; width: 48px; height: 48px; margin-bottom: 14px; border-radius: 10px;
            background-color: #322b26;   /* Markdown 品牌色（插件 --icon-md-primary） */
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'%3E%3Cpath d='M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41M6.81 15.19v-3.66l1.92 2.35 1.92-2.35v3.66h1.93V8.81h-1.93l-1.92 2.35-1.92-2.35H4.89v6.38h1.92M19.69 12h-1.92V8.81h-1.92V12h-1.93l2.89 3.28z'/%3E%3C/svg%3E");
            background-repeat: no-repeat; background-position: center; background-size: 30px 30px;
        }
        .ds-md-fmt-btn > span { font-size: 14px; font-weight: 600; color: var(--ds-md-text); transition: color 180ms cubic-bezier(.2, 0, 0, 1); }
        .ds-md-fmt-btn:hover, .ds-md-fmt-btn.is-active {
            border-color: var(--ds-md-accent);
            background: color-mix(in srgb, var(--ds-md-accent-soft) 60%, var(--ds-md-surface-2) 40%);
            transform: translateY(-1px); box-shadow: var(--ds-md-shadow-xs);
        }
        .ds-md-fmt-btn:hover > span, .ds-md-fmt-btn.is-active > span { color: var(--ds-md-accent); }
        .ds-md-fmt-btn:active { transform: translateY(0); }
        .ds-md-fmt-btn:focus, .ds-md-fmt-btn:focus-visible { outline: 0; }

        /* 页脚小开关（对齐插件 .common-toggle-switch：自绘 44×24 胶囊） */
        .ds-md-switch {
            appearance: none; -webkit-appearance: none;
            position: relative; flex: none;
            width: 44px; height: 24px; margin: 0;
            border: 1px solid var(--ds-md-border);
            border-radius: 12px; cursor: pointer;
            background-color: color-mix(in srgb, var(--ds-md-border) 78%, var(--ds-md-surface) 22%);
            transition: background-color 180ms cubic-bezier(.2, 0, 0, 1), border-color 180ms cubic-bezier(.2, 0, 0, 1), box-shadow 180ms cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-switch::before {
            content: ""; position: absolute; top: calc(50% - 9px); left: 1px;
            width: 18px; height: 18px; border-radius: 50%;
            background-color: var(--ds-md-surface);
            box-shadow: var(--ds-md-shadow-xs);
            transition: transform 180ms cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-switch:checked { background-color: var(--ds-md-accent); border-color: var(--ds-md-accent); }
        .ds-md-switch:checked::before { transform: translateX(20px); }
        .ds-md-switch:focus-visible { outline: 0; box-shadow: 0 0 0 3px var(--ds-md-ring); }

        .ds-md-opt { display: inline-flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .ds-md-hint { font-size: 11.5px; color: var(--ds-md-tertiary); font-style: normal; font-weight: 400; }

        .ds-md-back {
            display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
            font: inherit; font-size: 13px; font-weight: 600; padding: 6px 12px 6px 8px;
            margin: 0; cursor: pointer; border: 0; background: transparent; color: var(--ds-md-sub);
            border-radius: 8px; transition: background-color .2s ease, color .2s ease;
        }
        .ds-md-back:hover { background: var(--ds-md-surface-2); color: var(--ds-md-text); }
        .ds-md-back:focus, .ds-md-back:focus-visible { outline: 0; }
        .ds-md-tpl-head { display: flex; align-items: center; margin-bottom: 16px; }
        .ds-md-tpl-sub { flex: 1; padding-right: 60px; margin: 0; }   /* 右侧留白以抵消返回按钮，保持居中 */
        /* 模板网格：固定两列（对齐插件 repeat(2,1fr)） */
        .ds-md-template-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .ds-md-template-card {
            position: relative; display: flex; flex-direction: column; overflow: hidden;
            padding: 0; width: 100%; text-align: left; font: inherit; cursor: pointer;
            border: 1px solid var(--ds-md-border); border-radius: 16px;
            background: var(--ds-md-surface); color: var(--ds-md-text);
            transition: border-color .25s cubic-bezier(.2, 0, 0, 1), transform .25s cubic-bezier(.2, 0, 0, 1), box-shadow .25s cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-template-card:hover { border-color: var(--ds-md-accent); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0, 0, 0, .08); }
        .ds-md-template-card:active { transform: translateY(0); }
        .ds-md-template-card.is-remembered { border-color: var(--ds-md-accent); }
        .ds-md-template-card.is-remembered::after {
            content: "上次选择"; position: absolute; top: 8px; right: 8px; z-index: 2;
            padding: 2px 7px; border-radius: 999px;
            background: var(--ds-md-accent); color: #fff; font-size: 10px; font-weight: 600;
        }

        /* 预览区：固定 132px 高 + 底部渐隐（对齐插件 .export-template-preview） */
        .ds-md-pv {
            position: relative; height: 132px; padding: 12px 14px; overflow: hidden;
            background: color-mix(in srgb, var(--ds-md-surface-2) 84%, var(--ds-md-surface) 16%);
        }
        .ds-md-pv::after {
            content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 28px; z-index: 1;
            pointer-events: none;
            background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--ds-md-surface-2) 84%, var(--ds-md-surface) 16%));
        }
        .ds-md-template-card:hover .ds-md-pv {
            background: color-mix(in srgb, var(--ds-md-surface-2) 92%, var(--ds-md-surface) 8%);
        }
        .ds-md-template-card:hover .ds-md-pv::after {
            background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--ds-md-surface-2) 92%, var(--ds-md-surface) 8%));
        }
        /* 缩微排版：整体 9px 起步，标题 11→9.5 递减（对齐插件的 preview 字号体系） */
        .ds-md-pv-line, .ds-md-pv-c { font-size: 9px; line-height: 1.55; color: var(--ds-md-sub); }
        .ds-md-pv-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; padding: 0; }
        .ds-md-pv-line--h1 { font-size: 11px; font-weight: 800; color: var(--ds-md-text); margin-bottom: 1px; letter-spacing: -.01em; }
        .ds-md-pv-line--bold { font-weight: 700; color: var(--ds-md-text); }
        .ds-md-pv-line--accent { color: var(--ds-md-accent); }
        .ds-md-pv-gap { height: 5px; }
        .ds-md-pv-div { height: 1px; margin: 5px 0; background: var(--ds-md-border); }
        .ds-md-pv-sec { margin-bottom: 3px; }
        .ds-md-pv-c { overflow: hidden; }
        .ds-md-pv-c--muted { color: var(--ds-md-sub); opacity: .78; font-size: 8.5px; }
        .ds-md-pv-c p { margin: 2px 0; line-height: 1.5; }
        .ds-md-pv-c blockquote, .ds-md-pv-c ul, .ds-md-pv-c ol { margin: 2px 0; padding-left: 12px; font-size: 8.5px; }
        .ds-md-pv-c ul, .ds-md-pv-c ol { list-style-position: inside; }
        .ds-md-pv-c li { margin: 1px 0; line-height: 1.4; }
        .ds-md-pv-c blockquote { border-left: 2px solid var(--ds-md-accent); padding-left: 6px; }
        .ds-md-pv-c strong, .ds-md-pv-c b { font-weight: 700; color: var(--ds-md-text); }
        .ds-md-pv-c em, .ds-md-pv-c i { font-style: italic; }
        .ds-md-pv-c h1, .ds-md-pv-c h2, .ds-md-pv-c h3, .ds-md-pv-c h4, .ds-md-pv-c h5, .ds-md-pv-c h6 {
            margin: 3px 0 2px; line-height: 1.3; font-weight: 700; color: var(--ds-md-text);
        }
        .ds-md-pv-c h1 { font-size: 11px; }
        .ds-md-pv-c h2 { font-size: 10.5px; }
        .ds-md-pv-c h3 { font-size: 10px; }
        .ds-md-pv-c h4, .ds-md-pv-c h5, .ds-md-pv-c h6 { font-size: 9.5px; }
        .ds-md-pv-c code {
            font-family: Consolas, Monaco, monospace; font-size: 8px;
            padding: 1px 3px; border-radius: 2px;
            background: color-mix(in srgb, var(--ds-md-surface-2) 88%, var(--ds-md-surface) 12%);
        }
        .ds-md-pv-c pre {
            margin: 2px 0; padding: 3px 5px; border-radius: 3px;
            font-size: 7.5px; line-height: 1.4;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            background: color-mix(in srgb, var(--ds-md-surface-2) 88%, var(--ds-md-surface) 12%);
        }
        .ds-md-pv-c table { font-size: 7.5px; border-collapse: collapse; margin: 2px 0; }
        .ds-md-pv-c td, .ds-md-pv-c th { border: 1px solid var(--ds-md-border); padding: 2px 4px; }
        .ds-md-pv-c th { font-weight: 700; background: color-mix(in srgb, var(--ds-md-surface-2) 92%, transparent 8%); }
        .ds-md-pv-quote {
            font-size: 8.5px; line-height: 1.5; color: var(--ds-md-sub);
            margin: 1px 0 2px; padding: 3px 0 3px 8px;
            border-left: 2px solid var(--ds-md-accent); border-radius: 0 3px 3px 0;
            background: color-mix(in srgb, var(--ds-md-accent) 8%, transparent 92%);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ds-md-pv-card {
            margin-bottom: 5px; padding: 6px 10px;
            border: 1px solid var(--ds-md-border); border-radius: 8px;
            background: color-mix(in srgb, var(--ds-md-surface) 70%, var(--ds-md-surface-2) 30%);
        }
        .ds-md-pv-card:last-child { margin-bottom: 0; }

        /* 信息区（对齐插件 .export-template-info） */
        .ds-md-tpl-info { padding: 10px 14px 12px; border-top: 1px solid var(--ds-md-border); }
        .ds-md-tpl-name { display: block; margin-bottom: 3px; font-size: 13px; font-weight: 600; transition: color .25s ease; }
        .ds-md-template-card:hover .ds-md-tpl-name { color: var(--ds-md-accent); }
        .ds-md-tpl-desc { display: block; font-size: 12px; line-height: 1.5; color: var(--ds-md-sub); transition: color .25s ease; }
        .ds-md-template-card:hover .ds-md-tpl-desc { opacity: .92; }

        /* 页脚（对齐插件 .dialog-footer / .dialog-footer-commit） */
        .ds-md-dlg-footer {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            padding: 8px 32px 24px; flex-wrap: wrap;
        }
        .ds-md-footer-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .ds-md-remember {
            display: inline-flex; align-items: center; gap: 8px; padding: 5px 0;
            font-size: 12px; font-weight: 500; line-height: 1.35; color: var(--ds-md-tertiary); cursor: pointer;
        }
        .ds-md-remember[hidden] { display: none; }
        .ds-md-remember input {
            width: 16px; height: 16px; flex: none; margin: 0; cursor: pointer;
            accent-color: var(--ds-md-accent);
        }
        .ds-md-dlg-actions[hidden] { display: none; }
        .ds-md-dlg-cancel {
            font: inherit; font-size: 14px; font-weight: 600;
            padding: 10px 36px; border-radius: 12px; cursor: pointer;
            border: 1px solid var(--ds-md-border);
            background: var(--ds-md-surface-2); color: var(--ds-md-sub);
            transition: background-color 120ms cubic-bezier(.2, 0, 0, 1), border-color 120ms cubic-bezier(.2, 0, 0, 1), color 120ms cubic-bezier(.2, 0, 0, 1), transform 120ms cubic-bezier(.2, 0, 0, 1), box-shadow 120ms cubic-bezier(.2, 0, 0, 1);
        }
        .ds-md-dlg-cancel:hover {
            border-color: var(--ds-md-border-strong); color: var(--ds-md-text);
            transform: translateY(-1px); box-shadow: var(--ds-md-shadow-xs);
        }
        .ds-md-dlg-cancel:active { transform: translateY(0); }
        .ds-md-dlg-cancel:focus, .ds-md-dlg-cancel:focus-visible { outline: 0; }

        /* 窄屏：页脚纵向、格式与大卡单列（对齐插件 @media (max-width:640px)） */
        @media (max-width: 640px) {
            .ds-md-dlg-header { padding: 16px 18px; }
            .ds-md-dlg-body { padding: 10px 18px 22px; }
            .ds-md-dlg-footer { padding: 6px 18px 18px; flex-direction: column; align-items: stretch; }
            .ds-md-dlg-actions { display: flex; justify-content: center; }
            .ds-md-format-options { grid-template-columns: repeat(2, 1fr); }
            .ds-md-template-options { grid-template-columns: 1fr; }
        }

        /* 响应式：窄屏导航转横排、设置项纵向 */
        @media (max-width: 640px) {
            .ds-panel { flex-direction: column; height: 92vh; }
            .ds-p-sidebar { width: 100%; flex-direction: row; flex-wrap: wrap; padding: 10px 10px 6px; overflow-y: visible; max-height: 150px; }
            .ds-p-logo { display: none; }
            .ds-p-nav { width: auto; flex: 1 0 calc(50% - 8px); }
            .ds-p-nav-bd { padding: 7px 10px; }
            .ds-p-nav-ind { display: none; }
            .ds-p-scroll { padding: 16px 16px 16px; }
            .ds-p-card { padding: 2px 12px; }
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

        /* 代码块背景加深 — 浅色主题专用（html.ds-code-bg + 强度档位类） */
        html.ds-code-bg.ds-code-bg-1 { --ds-code-bg: #f3f4f6; --ds-code-bg-line: #e5e8ec; }
        html.ds-code-bg.ds-code-bg-2 { --ds-code-bg: #eef1f5; --ds-code-bg-line: #dde3e9; }
        html.ds-code-bg.ds-code-bg-3 { --ds-code-bg: #e9edf2; --ds-code-bg-line: #d8dfe7; }
        html.ds-code-bg body:not(.dark) .md-code-block,
        html.ds-code-bg body:not(.dark) .md-code-block .md-code-block-banner-wrap,
        html.ds-code-bg body:not(.dark) .md-code-block .md-code-block-banner {
            background: var(--ds-code-bg) !important;
        }
        /* 顶部语言/工具条与代码区同色，补一条底部分隔线消除白条割裂 */
        html.ds-code-bg body:not(.dark) .md-code-block .md-code-block-banner-wrap {
            border-bottom: 1px solid var(--ds-code-bg-line) !important;
        }

        /* ==================== 代码块导出为图片 — 弹窗 ====================
           复用脚本弹窗主题令牌 --ds-md-*（其定义在 body 上、含深色覆盖，见上方说明）。
           这里只定义本功能自己的类名与布局，不重复定义色板。 */
        @keyframes dsCiOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dsCiDialogIn { from { opacity: 0; transform: scale(.94) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .ds-ci-modal {
            position: fixed; inset: 0; z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            background: var(--ds-md-overlay);
            -webkit-backdrop-filter: saturate(160%) blur(4px);
            backdrop-filter: saturate(160%) blur(4px);
            animation: dsCiOverlayIn 180ms cubic-bezier(.2, 0, 0, 1) forwards;
        }
        .ds-ci-dialog {
            width: 92%; max-width: 900px; max-height: 86vh;
            display: flex; flex-direction: column; overflow: hidden;
            background: var(--ds-md-surface);
            border: 1px solid var(--ds-md-border);
            border-radius: 24px;
            box-shadow: var(--ds-md-shadow-xs);
            animation: dsCiDialogIn 280ms cubic-bezier(.16, 1, .3, 1) forwards;
            font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            color: var(--ds-md-text);
        }
        .ds-ci-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 28px 6px; }
        .ds-ci-title { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: .1px; }
        .ds-ci-close {
            width: 32px; height: 32px; display: grid; place-items: center; flex: none;
            border: 0; background: transparent; cursor: pointer; padding: 0;
            font-size: 15px; line-height: 1; color: var(--ds-md-sub); border-radius: 8px;
            transition: background-color 120ms cubic-bezier(.2,0,0,1), color 120ms cubic-bezier(.2,0,0,1);
        }
        .ds-ci-close:hover { background: var(--ds-md-surface-2); color: var(--ds-md-text); }
        .ds-ci-body { padding: 6px 28px 0; overflow-y: auto; flex: 1; min-height: 0; }

        /* 预览区：等比缩放到容器内（缩放由 renderPreview 直接作用于 .ds-shot-root 与包裹层，无需额外类） */
        .ds-ci-preview-wrap {
            display: flex; align-items: center; justify-content: center;
            padding: 18px; border-radius: 14px; min-height: 170px;
            background: var(--ds-md-surface-2); border: 1px solid var(--ds-md-border);
            overflow: hidden;
        }

        /* 选项区（两列） */
        .ds-ci-options { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px 22px; padding: 18px 0 4px; }
        .ds-ci-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
        .ds-ci-field.is-wide { grid-column: 1 / -1; }
        .ds-ci-label { font-size: 12px; font-weight: 600; color: var(--ds-md-sub); letter-spacing: .02em; }
        .ds-ci-seg {
            display: inline-flex; gap: 4px; padding: 3px; width: fit-content;
            border-radius: 10px; background: var(--ds-md-surface-2); border: 1px solid var(--ds-md-border);
        }
        .ds-ci-seg-btn {
            border: 0; background: transparent; padding: 5px 12px; border-radius: 8px;
            cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; color: var(--ds-md-sub);
            transition: background-color 140ms cubic-bezier(.2,0,0,1), color 140ms cubic-bezier(.2,0,0,1);
        }
        .ds-ci-seg-btn:hover { color: var(--ds-md-text); }
        .ds-ci-seg-btn.is-active { background: var(--ds-md-accent); color: #fff; }

        /* 背景色板 */
        .ds-ci-sw-row { display: flex; flex-wrap: wrap; gap: 8px; }
        .ds-ci-sw {
            width: 36px; height: 26px; padding: 0; border-radius: 8px; cursor: pointer;
            border: 2px solid transparent; box-shadow: inset 0 0 0 1px rgba(128,128,128,.28);
            transition: border-color 140ms cubic-bezier(.2,0,0,1), transform 140ms;
        }
        .ds-ci-sw:hover { transform: translateY(-1px); }
        .ds-ci-sw.is-active { border-color: var(--ds-md-accent); }
        .ds-ci-sw.is-transparent { background: repeating-conic-gradient(#c9c9c9 0 25%, #ffffff 0 50%) 50% / 12px 12px; }

        /* 滑块 */
        .ds-ci-range { display: flex; align-items: center; gap: 10px; }
        .ds-ci-range input[type=range] { flex: 1; min-width: 0; accent-color: var(--ds-md-accent); }
        .ds-ci-range-val { font-size: 12px; color: var(--ds-md-sub); min-width: 46px; text-align: right; font-variant-numeric: tabular-nums; }

        /* 开关 */
        .ds-ci-switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; color: var(--ds-md-text); }
        .ds-ci-switch input { width: 16px; height: 16px; accent-color: var(--ds-md-accent); cursor: pointer; }
        .ds-ci-toggles { display: flex; flex-wrap: wrap; gap: 18px; }

        /* 页脚 */
        .ds-ci-footer {
            display: flex; justify-content: flex-end; align-items: center; gap: 10px;
            padding: 16px 28px 20px; margin-top: 12px; border-top: 1px solid var(--ds-md-border);
        }
        .ds-ci-btn {
            border: 1px solid var(--ds-md-border); background: var(--ds-md-surface-2); color: var(--ds-md-text);
            font: inherit; font-size: 14px; font-weight: 600; padding: 9px 18px; border-radius: 10px; cursor: pointer;
            transition: border-color 140ms cubic-bezier(.2,0,0,1), background-color 140ms, filter 140ms, opacity 140ms;
        }
        .ds-ci-btn:hover { border-color: var(--ds-md-accent); }
        .ds-ci-btn.primary { background: var(--ds-md-accent); border-color: var(--ds-md-accent); color: #fff; }
        .ds-ci-btn.primary:hover { filter: brightness(1.06); }
        .ds-ci-btn:disabled { opacity: .55; cursor: default; }
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

    // 创建「导出为图片」按钮（与折叠按钮同容器并列；点击打开样式弹窗）
    function createCodeExportButton(preEl) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ds-code-export-btn';
        btn.setAttribute('aria-label', '导出代码为图片');
        btn.title = '导出为图片';
        const iconDiv = document.createElement('div');
        iconDiv.className = 'export-icon';
        iconDiv.innerHTML = ICON_EXPORT_IMAGE;
        const textSpan = document.createElement('span');
        textSpan.textContent = '导出';
        btn.appendChild(iconDiv);
        btn.appendChild(textSpan);
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!codeExportEnabled) return;
            codeImageUnit.open(preEl);
        });
        return btn;
    }

    // 开关切换时即时增删全部代码块的导出按钮（只动导出按钮，不影响折叠按钮）
    function applyCodeExportButtons(enabled) {
        document.querySelectorAll('pre').forEach(pre => {
            const block = pre.closest('.md-code-block');
            if (!block) return;
            const existing = block.querySelector('.ds-code-export-btn');
            if (enabled) {
                if (existing) return;
                const container = findButtonContainer(pre);
                if (container) container.appendChild(createCodeExportButton(pre));
            } else if (existing) {
                existing.remove();
            }
        });
    }

    function addFoldButtonToCodeBlock(preEl) {
        if (preEl.hasAttribute(processedAttr)) return;
        const targetContainer = findButtonContainer(preEl);
        if (targetContainer) {
            // 两类按钮各自判重，互不牵连（历史实现只判折叠按钮即 return，会漏掉导出按钮）
            if (!targetContainer.querySelector('.ds-fold-btn')) targetContainer.appendChild(createFoldButton(preEl));
            if (codeExportEnabled && !targetContainer.querySelector('.ds-code-export-btn')) {
                targetContainer.appendChild(createCodeExportButton(preEl));
            }
        } else {
            const wrapper = document.createElement('div');
            wrapper.className = 'ds-fold-btn-wrapper';
            wrapper.style.textAlign = 'right';
            wrapper.style.marginBottom = '6px';
            wrapper.appendChild(createFoldButton(preEl));
            if (codeExportEnabled) wrapper.appendChild(createCodeExportButton(preEl));
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
        // 通过按钮文字或类名找到按钮容器，去重其中的折叠按钮与导出按钮
        const seen = new Set();
        const dedupeIn = (container) => {
            ['.ds-fold-btn', '.ds-code-export-btn'].forEach(sel => {
                const btns = container.querySelectorAll(sel);
                for (let i = 1; i < btns.length; i++) btns[i].remove();
            });
        };
        // 新版按钮：.code-info-button-text
        document.querySelectorAll('.code-info-button-text').forEach(span => {
            const btn = span.closest('[role="button"], .ds-button');
            if (!btn) return;
            const container = btn.parentElement;
            if (!container || seen.has(container)) return;
            seen.add(container);
            dedupeIn(container);
        });
        // 旧版按钮：.ds-text-button
        document.querySelectorAll('.ds-text-button').forEach(btn => {
            const container = btn.parentElement;
            if (!container || seen.has(container)) return;
            seen.add(container);
            dedupeIn(container);
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

    // 圆角矩形路径（手写 arcTo，避免依赖较新的 ctx.roundRect；半径传 [左上, 右上, 右下, 左下]）
    function roundRectPath(ctx, x, y, w, h, r) {
        const [tl, tr, br, bl] = r;
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);      ctx.arcTo(x + w, y, x + w, y + tr, tr);
        ctx.lineTo(x + w, y + h - br);  ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
        ctx.lineTo(x + bl, y + h);      ctx.arcTo(x, y + h, x, y + h - bl, bl);
        ctx.lineTo(x, y + tl);          ctx.arcTo(x, y, x + tl, y, tl);
        ctx.closePath();
    }

    // PNG 导出后处理：把 canvas 四角裁成透明圆角。
    // 背景：html2canvas 会把 table 的 border-radius + overflow:hidden 裁成圆角，但被裁处露出的是画布底色
    // （backgroundColor:'#ffffff'）→ 导出图在深色纸张/文档上是「白色直角」，看着像没有圆角。
    // 这里保留白底（auto 主题的半透明叠加色需要纸底衬托），只把圆角之外裁成透明。
    // 关键：html2canvas 会在返回的 canvas 上残留变换矩阵（实测 scale=3 → matrix(3,0,0,3,-48,-48)，
    // 其中 -48 = 导出 iframe 的 body margin 16px × 3）；不先重置为单位矩阵，蒙版会被放大+平移，裁剪完全失效。
    function applyRoundedCorners(canvas, radiiCss, elemWidthCss) {
        if (!canvas || !elemWidthCss) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        if (!w || !h) return;
        const k = w / elemWidthCss;   // canvas 像素 / CSS 像素（不写死 scale，兼容日后调整）
        const lim = Math.min(w, h) / 2;
        const [tl, tr, br, bl] = radiiCss.map(r => Math.max(0, Math.min((r || 0) * k, lim)));
        if (!tl && !tr && !br && !bl) return;   // 表格无圆角 → 保持原样
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);     // 清掉 html2canvas 残留变换（漏掉这步裁剪会失效）
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        roundRectPath(ctx, 0, 0, w, h, [tl, tr, br, bl]);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
    }

    // 导出图片的「纸底」色：跟随页面当前深浅，避免深色主题下深色表头压在纯白底上。
    // auto 模式的表头/条纹是半透明叠加色（rgba(...,0.08) 之类），必须有一层不透明纸底衬托，
    // 所以这里只接受不透明背景色：从 body 沿祖先链（含 html）取第一个不透明背景；
    // 都取不到时按主题兜底（深 #1a1a22 / 浅 #ffffff）。
    function getExportCanvasBg() {
        const isOpaque = (c) => {
            if (!c || c === 'transparent') return false;
            const m = /^rgba?\(([^)]+)\)$/.exec(c);
            if (!m) return true;                                   // 关键字色（如 white）视为不透明
            const p = m[1].split(',').map(s => parseFloat(s));
            return p.length < 4 || p[3] === 1;                     // 半透明底色不采纳（会重演整图半透明）
        };
        let el = document.body;
        while (el) {
            const bg = getComputedStyle(el).backgroundColor;
            if (isOpaque(bg)) return bg;
            el = el.parentElement;
        }
        return document.body.classList.contains('dark') ? '#1a1a22' : '#ffffff';
    }

    async function exportTableAsPNG(table) {
        if (!window.html2canvas) { alert('html2canvas 未加载'); return; }
        let iframe = null;
        try {
            // 深拷贝表格并清洗注入样式（PNG/CSV/MD 共用导出主体）
            const clone = getCleanTableClone(table);

            // 收集页面上表格相关样式（全局注入 + DeepSeek 变量）；传入源表格以便抄其单元格文字色
            const styles = collectTableStyles(table);

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

            // 截图前读取四角圆角半径与元素 CSS 宽度（iframe 尚在文档中，样式可读）
            const tcs = (iframeDoc.defaultView || window).getComputedStyle(iframeTable);
            const radiiCss = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
                .map(p => parseFloat(tcs[p]) || 0);
            const elemWidthCss = iframeTable.getBoundingClientRect().width;

            const canvas = await html2canvas(iframeTable, {
                scale: 3,   // 提升 PNG 导出分辨率（v4.7.0）
                backgroundColor: getExportCanvasBg(),   // 纸底跟随页面深浅（深色页面不再压在纯白底上）
                logging: false,
            });

            // 按「导出图片圆角」开关决定是否把四角裁成透明圆角（白底保留在圆角内；须在 toBlob 之前完成）
            if (tableExportRounded) applyRoundedCorners(canvas, radiiCss, elemWidthCss);

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
    function collectTableStyles(sourceTable) {
        let css = '';

        const isDark = document.body.classList.contains('dark');
        const mode = tableThemeMode;

        // 单元格文字色 / 链接 / 行内代码：导出的 iframe 是一个没有 .ds-markdown 祖先、也不继承页面
        // color 的空白文档 —— 页面上那些 `.ds-markdown ...` 前缀的规则在其中根本不匹配。若不显式取值，
        // 深色纸底会落回浏览器默认：黑字、#0000EE 蓝链接（带下划线）、灰底 code，与页面观感明显不符。
        // 直接抄页面上该表格对应元素的实际计算样式最保真（取不到再按主题兜底）。
        let thColor = '', tdColor = '', aColor = '', aDeco = '', codeColor = '', codeBg = '';
        try {
            const probeTh = sourceTable && sourceTable.querySelector('th');
            const probeTd = sourceTable && sourceTable.querySelector('td');
            const probeA = sourceTable && sourceTable.querySelector('a');
            const probeCode = sourceTable && sourceTable.querySelector('code');
            if (probeTh) thColor = getComputedStyle(probeTh).color;
            if (probeTd) tdColor = getComputedStyle(probeTd).color;
            if (probeA) {
                const sa = getComputedStyle(probeA);
                aColor = sa.color;
                aDeco = sa.textDecorationLine;
            }
            if (probeCode) {
                const sc = getComputedStyle(probeCode);
                codeColor = sc.color;
                codeBg = sc.backgroundColor;
            }
        } catch (_) { /* 取不到就退回主题兜底色 */ }
        const fallbackColor = isDark ? '#e4e4e8' : '#1f2937';
        // code 背景：页面上取到的不透明底色优先，否则退回半透明灰（浅底上是浅灰、深底上是微亮块）
        const codeBgCss = (!codeBg || codeBg === 'transparent' || codeBg === 'rgba(0, 0, 0, 0)')
            ? 'rgba(128,128,128,0.1)' : codeBg;

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
                color: ${tdColor || fallbackColor};
            }
            th { font-weight: 600; color: ${thColor || tdColor || fallbackColor}; }
            /* 链接：抄页面的实际色与下划线（iframe 内 .ds-markdown a 规则不匹配，否则落到默认 #0000EE + 下划线） */
            a { color: ${aColor || 'inherit'};${aDeco ? ` text-decoration: ${aDeco};` : ''} }
            /* 单元格内联代码的兜底样式（PNG iframe 导出图里的 code） */
            table code {
                background: ${codeBgCss}; padding: 2px 4px;
                border-radius: 4px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em;
                ${codeColor ? `color: ${codeColor};` : ''}
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
        let pinGroupCollapsed = !!GM_getValue(STORAGE_PIN_COLLAPSED, false);   // 原生「置顶」分组折叠态

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
            margin:2px 0 4px; padding:2px 8px 8px 0;  /* 对齐原生「分组头→首行」节奏（原生间距 0）；仅兜底挂载（无置顶分组）时由 JS 临时补 22px 让开悬浮「多选」按钮带 */
            background:transparent; border:none; box-shadow:none; border-radius:0;
            user-select:none;
        }
        /* 原生「选择对话」（多选）模式：文件夹树不参与批量选择 → 整区隐藏，让位给原生批量选择 */
        #dsFolderPanel.dsSelectModeHidden{display:none;}

        /* 原生「置顶」分组标题可折叠：点击切换。
           箭头与「文件夹」标题完全一致（同款 chevron、同色 --ds-sub、收起旋转 -90°），用 mask 绘制而非
           往 React 管理的标题里塞节点；hover 也复用文件夹标题的 --ds-hover 底色。
           语义：展开 = 朝下 v，折叠 = 朝右 >（基础图形为朝下 chevron，折叠态 rotate(-90°) 即得朝右）。 */
        .ds-pin-head{cursor:pointer; border-radius:6px; transition:background .15s ease;}
        .ds-pin-head:hover{background:var(--ds-hover);}
        .ds-pin-head::after{content:""; display:inline-block; width:15px; height:15px; margin-left:6px;
            vertical-align:middle; background-color:var(--ds-sub); transition:transform .15s ease;
            -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 6 8 10.5 12.5 6' fill='none' stroke='black' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E") center / 15px 15px no-repeat;
            mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 6 8 10.5 12.5 6' fill='none' stroke='black' stroke-width='1.6' stroke-linejoin='round'/%3E%3C/svg%3E") center / 15px 15px no-repeat;}
        .ds-pin-head.dsPinCollapsed::after{transform:rotate(-90deg);}
        #dsFolderPanel .dsfh{display:flex; align-items:center; justify-content:space-between; margin:2px 0 6px; padding-left:10px;}
        #dsFolderPanel .dsfh .dsHeadTitle{display:flex; align-items:center; gap:6px; cursor:pointer; padding:3px 8px 3px 5px; margin-left:-5px; border-radius:6px; user-select:none;}
        #dsFolderPanel .dsfh .dsHeadTitle:hover{background:var(--ds-hover);}
        #dsFolderPanel .dsHeadCaret{width:15px;height:15px;flex:0 0 auto;color:var(--ds-sub);transition:transform .15s ease;}
        #dsFolderPanel.collapsed .dsHeadCaret{transform:rotate(-90deg);}   /* 展开=朝下 v，折叠=朝右 > */
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
            min-height:32px; box-sizing:border-box; cursor:pointer; color:var(--ds-text); font-size:13px; position:relative;}
        #dsFolderPanel .dsConvRow:hover{background:var(--ds-hover);}
        #dsFolderPanel .dsConvRow.on{color:var(--ds-accent);}
        #dsFolderPanel .dsConvBar{display:none; position:absolute; left:18px; top:50%; transform:translateY(-50%);
            width:3px; height:15px; border-radius:2px; background:var(--ds-accent); pointer-events:none;}
        #dsFolderPanel .dsConvRow.on .dsConvBar{display:block;}
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
        /* ---- 「置顶」分组容器定位 ----
           原生结构：[置顶 sticky 头 → 置顶会话容器 → 分隔线]，父级即「置顶」分组容器。
           两个用途：① 面板锚点（插在分组容器之后，避免夹在「置顶」标题与其会话之间）；
           ② 归档隐藏时跳过置顶分组内的行（置顶是显式行为，不能因归档进文件夹而从置顶区消失）。 */
        let pinnedGroupEl = null;
        function findPinnedGroup() {
            if (pinnedGroupEl && pinnedGroupEl.isConnected) return pinnedGroupEl;
            const sc = findScrollContainer();
            if (!sc) return null;
            const head = [...sc.querySelectorAll('div')].find((d) => {
                const cs = getComputedStyle(d);
                return cs.position === 'sticky' && d.clientHeight > 0 && d.clientHeight < 60
                    && (d.innerText || '').trim() === '置顶';
            });
            pinnedGroupEl = (head && head.parentElement) ? head.parentElement : null;
            return pinnedGroupEl;
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
                if (inScroller) {
                    // 位置校验（v4.9.1 修正自愈判据）：仅当面板**挂在正确锚点**时才认作稳态 → 零扫描早退。
                    // 此前判据为「不在「置顶」分组内即稳态」，语义过宽：若面板曾被兜底挂到滚动容器最顶部
                    // （页面早期 sticky「置顶」头尚未渲染时 `findPinnedGroup()` 返回 null 所走的兜底路径），
                    // 该条件恒成立 → 守卫误判稳态、永不复位，导致面板长期卡在错误位置并残留 22px 死空白。
                    // 现改为直接核对锚点：有「置顶」分组时面板须紧跟其后；无分组时须为滚动容器首子节点。
                    const pg = findPinnedGroup();
                    const sc0 = findScrollContainer();
                    const anchored = pg ? (panel.previousElementSibling === pg) : (sc0 && sc0.firstChild === panel);
                    if (anchored) return;   // 位置正确 → 稳态早退（避免每轮 schedule 重挂引发无限刷新循环）
                    // 位置不正确（夹在置顶分组内 / 兜底挂在最顶而分组已出现 / 误插容器外）→ 继续走下方重挂迁移
                }
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
                        <b>文件夹</b><svg class="dsHeadCaret" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 6 8 10.5 12.5 6"/></svg>
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
            // 锚点 = 「置顶」分组容器之后：原生是 [置顶 sticky 头 → 置顶会话 → 分隔线]，
            // 若插在 sticky 头之后会夹在「置顶」标题与置顶会话之间，把分组切断。
            const pg = findPinnedGroup();
            if (pg) {
                if (panel.previousElementSibling !== pg) pg.insertAdjacentElement('afterend', panel);
                if (panel.style.paddingTop !== '') panel.style.paddingTop = '';   // 正常位置：对齐原生「分组头→首行」零间距节奏，无需为悬浮按钮预留
            } else {
                if (sc.firstChild !== panel) sc.insertBefore(panel, sc.firstChild);   // 兜底：无置顶分组时插到列表最顶
                if (panel.style.paddingTop !== '22px') panel.style.paddingTop = '22px';         // 顶部让开原生悬浮「多选」按钮带
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

        /* ---- 归档可见性：已收进文件夹的会话从原生历史列表隐藏（避免点它时官方滚回原位） ----
           例外：「置顶」分组内的行不隐藏——置顶是用户的显式行为，若因归档进文件夹就整组消失，
           等于置顶功能被脚本静默废掉（实测：脚本开启时置顶会话容器高度归 0）。 */
        const archivedIds = () => Object.keys(data.links);
        function syncArchiveVisibility() {
            const all = document.querySelectorAll('a[href^="/a/chat/s/"]');
            const set = new Set(archivedIds());
            const pg = findPinnedGroup();
            all.forEach((a) => {
                const sid = sessionIdOf(a);
                const isPinned = !!(pg && pg.contains(a));
                if (!isPinned && sid && set.has(sid)) {
                    if (a.style.display !== 'none') a.style.display = 'none';
                } else if (a.style.display === 'none') {
                    a.style.display = '';
                }
            });
        }

        /* ---- 原生「选择对话」（多选）模式互斥 ----
           两者选择态互不相通（原生选择圈只给原生行、文件夹树无任何选择控件），
           多选态下继续展示文件夹树没有意义 → 整区隐藏（display:none），退出后自动恢复。 */
        function syncSelectModeLock() {
            const panel = document.getElementById('dsFolderPanel');
            if (!panel) return;
            const listRoot = (pinnedGroupEl && pinnedGroupEl.isConnected && pinnedGroupEl.parentElement)
                ? pinnedGroupEl.parentElement : findScrollContainer();
            const inSelectMode = !!(listRoot && listRoot.querySelector('.ds-checkbox'));
            panel.classList.toggle('dsSelectModeHidden', inSelectMode);
        }

        /* ---- 原生「置顶」分组折叠 ----
           取「置顶」分组容器内的 sticky 头作为可点击标题；折叠 = 隐藏容器内除标题外的所有兄弟。
           用 document 级事件委托 + 我们自己的稳定类 .ds-pin-head，不依赖官网 hash 类名、不怕 React 重渲染；
           折叠态每轮 schedule 重放（React 重建会重置 inline display / class）。 */
        function findPinHeader() {
            const pg = findPinnedGroup();
            if (!pg) return null;
            return [...pg.children].find((c) => {
                const cs = getComputedStyle(c);
                return cs.position === 'sticky' && (c.innerText || '').trim().startsWith('置顶');
            }) || null;
        }
        function applyPinCollapse() {
            const pg = findPinnedGroup();
            const head = findPinHeader();
            if (!pg || !head) return;
            head.classList.add('ds-pin-head');                                  // 稳定类：样式与事件委托的挂钩
            head.classList.toggle('dsPinCollapsed', pinGroupCollapsed);
            [...pg.children].forEach((c) => {
                if (c === head) return;
                if (pinGroupCollapsed) {
                    if (c.style.display !== 'none') { c.style.display = 'none'; c.dataset.dsPinHidden = '1'; }
                } else if (c.dataset.dsPinHidden === '1') {
                    c.style.display = ''; delete c.dataset.dsPinHidden;         // 只还原自己藏过的，不动其它逻辑的 display
                }
            });
        }
        let pinClickHandler = null;
        function bindPinClick() {
            if (pinClickHandler) return;
            pinClickHandler = (e) => {
                const head = e.target && e.target.closest ? e.target.closest('.ds-pin-head') : null;
                if (!head) return;
                const pg = findPinnedGroup();
                if (!pg || head.parentElement !== pg) return;        // 只认当前置顶组的标题
                if (document.querySelector('.ds-checkbox')) return;  // 原生多选态下不响应折叠
                pinGroupCollapsed = !pinGroupCollapsed;
                GM_setValue(STORAGE_PIN_COLLAPSED, pinGroupCollapsed);
                applyPinCollapse();
            };
            document.addEventListener('click', pinClickHandler, true);
        }
        function unbindPinClick() {
            if (pinClickHandler) { document.removeEventListener('click', pinClickHandler, true); pinClickHandler = null; }
        }
        function resetPinCollapseUi() {
            unbindPinClick();
            const pg = findPinnedGroup();
            if (pg) [...pg.children].forEach((c) => { if (c.dataset.dsPinHidden === '1') { c.style.display = ''; delete c.dataset.dsPinHidden; } });
            document.querySelectorAll('.ds-pin-head').forEach((h) => h.classList.remove('ds-pin-head', 'dsPinCollapsed'));
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
                        cr.innerHTML = `<span class="dsConvBar"></span><span class="dsConvTitle"></span>`;
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
                syncSelectModeLock();    // 原生多选态下禁用文件夹树交互（模式互斥）
                if (pinGroupCollapsible) applyPinCollapse();   // 重放「置顶」分组折叠态（React 重建会重置；仅开关开启时）
            }, 120);
        }
        function cancelSchedule() { if (folderPending) { clearTimeout(folderPending); folderPending = null; } }

        /* ---------- on / off（外层开关驱动） ---------- */
        function on() {
            injectCss();
            applyTheme();
            if (pinGroupCollapsible) bindPinClick();   // 置顶折叠为 opt-in，仅开关开启时接管点击
            schedule();
        }
        function off() {
            cancelSchedule();
            resetPinCollapseUi();   // 解绑「置顶」折叠点击并还原被折叠隐藏的原生节点
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

        /* 置顶折叠能力开关（由设置面板驱动）：开启则绑定点击并应用折叠态；关闭则解绑并还原被折叠节点。 */
        function setPinCollapsible(enabled) {
            if (!folderManagerEnabled) return;   // 文件夹模块未启用时无需处理
            if (enabled) { bindPinClick(); applyPinCollapse(); }
            else { resetPinCollapseUi(); }
        }

        return { on, off, schedule, refreshData, setPinCollapsible, isDark };
    })();

    // hold the ref so disabled switching can re-load stored folder list later
    const folderEnabledChanged = (nowEnabled) => {
        if (nowEnabled) { folderUnit.on(); showToast('对话文件夹管理已开启'); }
        else { folderUnit.off(); showToast('对话文件夹管理已关闭'); }
        // 子开关「置顶分组可折叠」的可用性依赖本项 → 重开面板刷新置灰态
        const ov = document.getElementById('ds-control-panel-overlay');
        if (ov) { ov.remove(); setTimeout(() => openControlPanel(), 300); }
    };

    // ==================== 对话导出为 Markdown ====================
    // 对话 → Markdown 的完整导出链路。
    //
    // 链路：提取（页面 DOM → 语义 DOM）→ 规范化（公式/代码/列表/表格/噪音）
    //       → 规则驱动转换（13 条规则，深度优先）→ 模板装饰 → 收尾归一 → Blob 下载
    //
    // 若干刻意的设计取舍：
    //   1. 自有属性统一带 data-ds-md-* 前缀，不与页面既有属性冲突；
    //   2. 只依赖页面自身的 DOM 结构，不依赖任何注入式的运行时状态；
    //   3. 转换引擎为自研规则表，不引入任何第三方 Markdown 库。
    const mdExportUnit = (() => {
        // ---------- 选择器（取真实页面实测结构） ----------
        const SEL = {
            MESSAGE: '.ds-message',
            AI_CONTENT: '.ds-markdown',              // AI 答案根；用户消息不含此元素 → 角色判据
            THINK_CONTENT: '.ds-think-content',      // 思考过程正文（语义类名）
            COLLAPSIBLE: '.ds-collapsible-text',     // 用户文本容器（语义类名）
            CODE_BLOCK: '.md-code-block',
            CODE_BANNER: '.md-code-block-banner-wrap', // 语言文案所在（"语言\n复制\n下载\n展开"）
            KATEX_DISPLAY: '.katex-display',
            KATEX: '.katex',
            SCROLL_AREA: '.ds-scroll-area',          // 表格外层滚动壳，需脱壳
            VIRTUAL_LIST: '.ds-virtual-list-items',        // 虚拟列表容器（存在即说明对话被虚拟化）
            VIRTUAL_ITEM: '[data-virtual-list-item-key]',  // 虚拟列表项（消息的稳定键来源）
        };
        const ATTR = {
            NODE: 'data-ds-md-node',   // 节点类型标记（同时作为"自有属性"参与 stripNoise 保护判定）
            LEVEL: 'data-ds-md-level',
            SECTION: 'data-ds-md-section', // question | answer —— 模板装饰的定位锚点
            LANG: 'data-ds-md-lang',
            TEX: 'data-ds-md-tex',
            MATH: 'data-ds-md-math',
        };
        const OWN_ATTR_PREFIX = 'data-ds-md-';

        // ---------- 基础工具 ----------
        const isEl = (n) => !!n && n.nodeType === Node.ELEMENT_NODE;
        const tag = (n) => (isEl(n) ? String(n.tagName || '').toLowerCase() : '');
        const lf = (s) => String(s).replace(/\r\n?/g, '\n');                       // CRLF → LF
        const stripNl = (s) => lf(s).replace(/^\n+/, '').replace(/\n+$/, '');     // 去首尾换行
        const maxRun = (s, ch) => { let best = 0, cur = 0; for (const c of s) { if (c === ch) { cur++; if (cur > best) best = cur; } else cur = 0; } return best; };
        // 反引号自适应：比内容中最长反引号串多 1（至少 min）。代码块内含 ``` 时否则必然被提前闭合。
        const fenceOf = (s, min) => '`'.repeat(Math.max(min, maxRun(s, '`') + 1));
        // 行内代码：前后含空格时补空格包裹（CommonMark 规定）
        const inlineCodeWrap = (s) => { const f = fenceOf(s, 1); return f + ((s.startsWith(' ') || s.endsWith(' ')) ? ' ' + s + ' ' : s) + f; };
        // 表格单元格：换行折叠为空格 + 转义竖线
        const cellText = (s) => lf(s).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim();
        const escLinkText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
        const isInside = (el, tags) => { const set = new Set(tags.map(t => t.toLowerCase())); let p = el.parentElement; while (p) { if (set.has(tag(p))) return true; p = p.parentElement; } return false; };
        const headingLevel = (t) => { const m = /^h([1-6])$/.exec(t); return m ? Number(m[1]) : 0; };

        // ---------- 转换引擎：13 条规则（顺序敏感） ----------
        // 规则表顺序决定了嵌套处理：先"吞内容"的块级，再行内。首个命中即用。
        function findCodeChild(el) {
            return [...el.children].find(c => tag(c) === 'code') || el.querySelector('code') || null;
        }

        const RULE_CODE_BLOCK = {
            name: 'code-block',
            filter: (el) => tag(el) === 'pre' && !!findCodeChild(el),
            replacement(el) {
                const code = findCodeChild(el);
                if (!code) return '';
                const lang = String(
                    code.getAttribute(ATTR.LANG) ?? el.getAttribute(ATTR.LANG) ?? ''
                ).trim();
                const body = stripNl(lf(code.textContent ?? '')).replace(/\n+$/g, '');
                const f = fenceOf(body, 3);
                return f + lang + '\n' + body + '\n' + f + '\n\n';
            },
        };

        const RULE_INLINE_CODE = {
            name: 'inline-code',
            filter: (el) => tag(el) === 'code' && !isInside(el, ['pre']),
            replacement(el) {
                const t = el.textContent ?? '';
                return t.trim() ? inlineCodeWrap(t) : '';
            },
        };

        const RULE_MATH = {
            name: 'math',
            filter: (el) => {
                const mt = el.getAttribute(ATTR.MATH);
                const tex = el.getAttribute(ATTR.TEX);
                return (mt === 'inline' || mt === 'block') && typeof tex === 'string' && tex.trim().length > 0;
            },
            replacement(el) {
                const mt = el.getAttribute(ATTR.MATH);
                const tex = lf(el.getAttribute(ATTR.TEX) ?? '').trim();
                if (!tex) return '';
                return mt === 'inline' ? '$' + tex.replace(/\n+/g, ' ') + '$' : '$$\n' + tex + '\n$$\n\n';
            },
        };

        const RULE_TABLE = {
            name: 'table',
            filter: (el) => tag(el) === 'table',
            replacement(el, _content, ctx) {
                const rows = [...el.querySelectorAll('tr')];
                if (!rows.length) return '';
                const cells = (row) => [...row.children].filter(c => tag(c) === 'td' || tag(c) === 'th');
                // 表头：首个含 th 的行；都没有则首行充作表头
                let header = rows.find(r => cells(r).some(c => tag(c) === 'th')) || null;
                let body;
                if (header) body = rows.filter(r => r !== header);
                else { header = rows[0]; body = rows.slice(1); }
                if (!header) return '';
                const conv = (row) => cells(row).map(c => cellText(stripNl(ctx.api.children(c, ctx.state))));
                const hc = conv(header);
                const bc = body.map(conv);
                const cols = Math.max(1, hc.length, ...bc.map(r => r.length));
                const pad = (arr) => '| ' + Array.from({ length: cols }, (_, i) => arr[i] ?? '').join(' | ') + ' |';
                const sep = pad(Array.from({ length: cols }, () => '---'));
                return pad(hc) + '\n' + sep + (bc.length ? '\n' + bc.map(pad).join('\n') : '') + '\n\n';
            },
        };

        const RULE_HEADING = {
            name: 'heading',
            filter: (el) => headingLevel(tag(el)) > 0,
            replacement(el, content) {
                const lv = headingLevel(tag(el));
                const t = stripNl(content).trim();
                return t ? '#'.repeat(lv) + ' ' + t + '\n\n' : '';
            },
        };

        const RULE_HR = {
            name: 'hr',
            filter: (el) => tag(el) === 'hr',
            replacement: () => '---\n\n',
        };

        const RULE_BLOCKQUOTE = {
            name: 'blockquote',
            filter: (el) => tag(el) === 'blockquote',
            replacement(_el, content) {
                const s = stripNl(content).trim();
                if (!s) return '';
                return lf(s).split('\n').map(l => (l.trim() ? '> ' + l : '>')).join('\n') + '\n\n';
            },
        };

        const RULE_LIST = {
            name: 'list',
            filter: (el) => tag(el) === 'ul' || tag(el) === 'ol' || tag(el) === 'li',
            replacement(el, _content, ctx) {
                const t = tag(el);
                // 容器 ul / ol：整体缩进交给子 li 处理，这里只负责外层换行
                if (t === 'ul' || t === 'ol') {
                    const inner = stripNl(ctx.api.children(el, {
                        listDepth: ctx.state.listDepth + 1,
                        listIndent: ctx.state.listIndent,
                    })).replace(/\n+$/g, '');
                    if (!inner.trim()) return '';
                    return (tag(el.parentElement) === 'li' ? '\n' : '') + inner + '\n\n';
                }
                // li：marker + 续行缩进对齐
                const parent = el.parentElement;
                let marker;
                if (tag(parent) === 'ol') {
                    const raw = String(parent.getAttribute('start') ?? '').trim();
                    const n = Number.parseInt(raw, 10);
                    const base = Number.isFinite(n) ? n : 1;
                    const idx = [...parent.children].filter(c => tag(c) === 'li').indexOf(el);
                    marker = (base + (idx >= 0 ? idx : 0)) + '.';
                } else {
                    marker = '-';
                }
                // 每层缩进 2 空格；续行缩进 = 缩进 + marker 长度 + 1（与首行文字左对齐）
                const indent = ctx.state.listIndent || '  '.repeat(Math.max(0, ctx.state.listDepth - 1));
                const contIndent = indent + ' '.repeat(marker.length + 1);
                const inner = stripNl(ctx.api.children(el, {
                    listDepth: ctx.state.listDepth,
                    listIndent: contIndent,
                })).trim();
                if (!inner) return '';
                const lines = lf(inner).split('\n');
                const first = lines[0] ?? '';
                const nested = first.startsWith(contIndent) && /^([-*+]|\d+\.)\s+/.test(first.trimStart());
                const out = nested ? [indent + marker] : [indent + marker + ' ' + first.trim()];
                for (let i = nested ? 0 : 1; i < lines.length; i++) {
                    const l = lines[i] ?? '';
                    if (!l.trim()) continue;
                    out.push(l.startsWith(contIndent) ? l : contIndent + l.trim());
                }
                return out.join('\n') + '\n';
            },
        };

        const RULE_PARAGRAPH = {
            name: 'paragraph',
            filter: (el) => tag(el) === 'p',
            replacement(_el, content, ctx) {
                const t = stripNl(content).trim();
                if (!t) return '';
                return ctx.state.listDepth > 0 ? t + '\n' : t + '\n\n';   // 列表内单换行，列表外双换行
            },
        };

        const RULE_LINK = {
            name: 'link',
            filter: (el) => tag(el) === 'a',
            replacement(el, content) {
                const href = String(el.getAttribute('href') ?? '').trim();
                const text = stripNl(content).trim() || String(el.textContent ?? '').trim() || href;
                return href ? '[' + escLinkText(text) + '](' + href + ')' : text;
            },
        };

        const RULE_IMAGE = {
            name: 'image',
            filter: (el) => tag(el) === 'img',
            replacement(el) {
                const src = String(el.getAttribute('src') ?? '').trim();
                if (!/^https?:\/\//i.test(src)) return '';    // 跳过 data:/blob: 等内联大图
                const alt = String(el.getAttribute('alt') ?? '').trim();
                return '![' + alt.replace(/[\[\]]/g, '') + '](' + src + ')';
            },
        };

        const RULE_STRONG = {
            name: 'strong',
            filter: (el) => tag(el) === 'strong' || tag(el) === 'b',
            replacement(_el, content) {
                const t = stripNl(content).trim();
                return t ? '**' + t + '**' : '';
            },
        };

        const RULE_EMPHASIS = {
            name: 'emphasis',
            filter: (el) => tag(el) === 'em' || tag(el) === 'i',
            replacement(_el, content) {
                const t = stripNl(content).trim();
                return t ? '*' + t + '*' : '';
            },
        };

        const RULES = [
            RULE_CODE_BLOCK, RULE_INLINE_CODE, RULE_MATH, RULE_TABLE,
            RULE_HEADING, RULE_HR, RULE_BLOCKQUOTE, RULE_LIST,
            RULE_PARAGRAPH, RULE_LINK, RULE_IMAGE, RULE_STRONG, RULE_EMPHASIS,
        ];

        const INIT_STATE = { listDepth: 0, listIndent: '' };

        function convertNode(api, n, state) {
            if (n.nodeType === Node.TEXT_NODE) {
                const v = n.nodeValue ?? '';
                // HTML 排版换行（含换行且 trim 后为空）必须丢弃，否则 Markdown 里会留下多余空格
                if (/[^\S\r\n]*[\r\n][^\S\r\n]*/.test(v) && v.trim() === '') return '';
                return lf(v).replace(/\n+/g, ' ').replace(/[\t\f\v]+/g, ' ');
            }
            if (!isEl(n)) {
                if (n.nodeType === Node.DOCUMENT_NODE || n.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                    return api.children(n, state);
                }
                return '';
            }
            const t = tag(n);
            if (t === 'script' || t === 'style') return '';
            if (t === 'br') return '\n';
            const ctx = { api, state };
            const rule = RULES.find(r => { try { return r.filter(n, ctx); } catch (e) { return false; } });
            if (!rule) return api.children(n, state);   // 无规则 → 透明穿透
            try {
                return rule.replacement(n, api.children(n, state), ctx);
            } catch (e) {
                return api.children(n, state);
            }
        }

        const converter = {
            children(node, state) {
                let out = '';
                node.childNodes.forEach(n => { out += convertNode(this, n, state); });
                return out;
            },
            convert(root) {
                const raw = convertNode(this, root, Object.assign({}, INIT_STATE));
                // 收尾：CRLF→LF → 三个及以上换行压成两个 → 去首尾空白
                return lf(raw).replace(/\n{3,}/g, '\n\n').trim();
            },
        };

        // ---------- 规范化：把 DeepSeek 的 DOM 洗成引擎认识的语义 DOM ----------

        // 表格外层滚动壳脱壳（.ds-scroll-area 会架空 table 的父子关系）
        function unwrapTableShell(root) {
            root.querySelectorAll(SEL.SCROLL_AREA).forEach(shell => {
                const tb = shell.querySelector('table');
                if (tb && shell.parentNode) shell.parentNode.replaceChild(tb, shell);
            });
        }

        // KaTeX → data-ds-md-tex / data-ds-md-math（从 MathML 的 annotation 里取回原始 LaTeX 源码）
        // 引擎只需认自有属性，与官网 KaTeX 内部结构解耦。
        function normalizeMath(root) {
            const mark = (el, tex, isDisplay) => {
                const span = document.createElement('span');
                span.setAttribute(ATTR.NODE, 'math');
                span.setAttribute(ATTR.TEX, tex);
                span.setAttribute(ATTR.MATH, isDisplay ? 'block' : 'inline');
                try { el.replaceWith(span); } catch (e) { /* 已脱离文档则忽略 */ }
            };
            root.querySelectorAll(SEL.KATEX_DISPLAY).forEach(el => {
                const ann = el.querySelector('annotation[encoding="application/x-tex"]');
                const tex = String((ann && ann.textContent) || '').trim();
                if (tex) mark(el, tex, true);
            });
            root.querySelectorAll(SEL.KATEX).forEach(el => {
                if (el.closest(SEL.KATEX_DISPLAY)) return;
                const ann = el.querySelector('annotation[encoding="application/x-tex"]');
                let tex = String((ann && ann.textContent) || '').trim();
                if (!tex) return;
                tex = tex.replace(/\r\n?|\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
                mark(el, tex, false);
            });
        }

        // 代码块：提取语言 → 剥离 banner/装饰 svg → 合成 <code> 包裹
        // 真实 DOM 的 pre 只有语法高亮 span，没有 <code>，需要自己合成。
        const CODE_OP_LABEL = /^(复制|下载|展开|收起|编辑|运行|预览|copy|download|expand|collapse|edit|run)$/i;
        function normalizeCodeBlocks(root) {
            root.querySelectorAll(SEL.CODE_BLOCK).forEach(block => {
                const banner = block.querySelector(SEL.CODE_BANNER);
                let lang = '';
                if (banner) {
                    // 双 Tab（代码/图表）→ mermaid
                    const tabs = [...banner.querySelectorAll('div[role="tab"], .ds-segmented-button')]
                        .map(e => String(e.textContent || '').trim().toLowerCase())
                        .filter(Boolean);
                    if (tabs.includes('图表') && tabs.includes('代码')) lang = 'mermaid';
                    // 否则取 banner 内首个非操作按钮的短文本（banner 文案 = "语言\n复制\n下载\n展开"）
                    if (!lang) {
                        for (const sp of banner.querySelectorAll('span')) {
                            const s = String(sp.textContent || '').trim();
                            if (!s || s.length > 40 || CODE_OP_LABEL.test(s)) continue;
                            lang = s.split(/\s+/)[0].trim().toLowerCase();
                            if (lang) break;
                        }
                    }
                    banner.remove();
                }
                [...block.children].forEach(c => { if (tag(c) === 'svg') c.remove(); });
                const pre = block.querySelector('pre');
                if (!pre) return;
                [...pre.children].forEach(c => { if (tag(c) === 'svg') c.remove(); });
                let code = pre.querySelector('code');
                if (!code) {
                    code = document.createElement('code');
                    code.innerHTML = pre.innerHTML;
                    pre.innerHTML = '';
                    pre.appendChild(code);
                }
                if (lang) code.setAttribute(ATTR.LANG, lang);
            });
        }

        // <ol> 只保留 start（其余属性归零），<li> 去掉 value
        function normalizeLists(root) {
            root.querySelectorAll('ol').forEach(ol => {
                let start = 1;
                const n = Number.parseInt(String(ol.getAttribute('start') ?? '').trim(), 10);
                if (Number.isFinite(n)) start = n;
                [...ol.attributes].forEach(a => ol.removeAttribute(a.name));
                ol.setAttribute('start', String(start));
            });
            root.querySelectorAll('li').forEach(li => li.removeAttribute('value'));
        }

        // 纯文本 div → <p>（用户消息体没有 <p>，不补则得不到段落换行）
        // 注意排除自有标记元素：section 容器必须保持 <div>，否则模板装饰的 insertBefore 会产出
        // 非法的 <p> 嵌套（浏览器会重排，装饰失效）。
        const BLOCKISH = 'table, pre, ul, ol, blockquote, hr, h1, h2, h3, h4, h5, h6, .md-code-block';
        function isSimpleTextDiv(el) {
            if (tag(el) !== 'div') return false;
            try {
                if ([...el.attributes].some(a => a.name.startsWith(OWN_ATTR_PREFIX))) return false;
            } catch (e) { /* 忽略 */ }
            try {
                if (el.querySelector(BLOCKISH)) return false;
                if (el.querySelector('div')) return false;
                return !!String(el.textContent || '').trim();
            } catch (e) { return false; }
        }
        function divToParagraph(root) {
            // 自内向外替换，避免上层判定被下层替换结果影响
            [...root.querySelectorAll('div')].reverse().forEach(d => {
                if (!isSimpleTextDiv(d)) return;
                const p = document.createElement('p');
                p.innerHTML = d.innerHTML;
                try { d.replaceWith(p); } catch (e) { /* 忽略 */ }
            });
        }

        // 行内图标标记（引用角标 / 联网标识）
        // 实测结构：<span class="_2ed5dee" style="display:inline">
        //             <span style="opacity:0;margin:0 6.455px">-</span>        ← 隐藏占位，撑宽度
        //             <span style="position:absolute;left:50%">…14×14 svg…</span>  ← 悬浮图标层
        //           </span>
        // 判据用「样式特征」而非哈希类名：含 absolute 或 opacity:0 的装饰子层，且剥掉装饰后仅剩
        // 极短编号（或空）。这样官网改版换类名也不失效。
        const ABS_RE = /position\s*:\s*absolute/i;
        const ZERO_RE = /opacity\s*:\s*0(?:\.0+)?/i;
        const styleOf = (el) => String((el && el.getAttribute && el.getAttribute('style')) || '');
        function isCitationBadge(el) {
            const t = tag(el);
            if (t !== 'span' && t !== 'a') return false;
            if (isInside(el, ['pre', 'code', 'katex'])) return false;
            const kids = [...el.children];
            const hasAbs = kids.some(c => ABS_RE.test(styleOf(c)));
            const hasZero = kids.some(c => ZERO_RE.test(styleOf(c)));
            if (!hasAbs && !hasZero) return false;
            // 剥掉装饰子层后，剩余文本必须为空或极短的引用编号
            const clone = el.cloneNode(true);
            clone.querySelectorAll('svg').forEach(s => s.remove());
            clone.querySelectorAll('*').forEach(c => {
                const st = styleOf(c);
                if (ABS_RE.test(st) || ZERO_RE.test(st)) { try { c.remove(); } catch (e) { /* 忽略 */ } }
            });
            const rest = String(clone.textContent || '').replace(/[\s\u200b\ufeff\u200c\u200d]+/g, '');
            return rest.length <= 3;
        }

        // 噪音清理：引用角标 → 按钮/图标 → 装饰 svg → 空 span 解包
        // 注意顺序：角标判据依赖「绝对定位层 + 装饰 svg」，必须先于删 svg 执行。
        function stripNoise(root) {
            [...root.querySelectorAll('a, span')].forEach(n => {
                if (!n.parentNode) return;
                if (!isCitationBadge(n)) return;
                try { n.remove(); } catch (e) { /* 忽略 */ }
            });
            // 角标剥离后可能留下空链接（只剩 href）→ 一并清掉
            [...root.querySelectorAll('a')].forEach(n => {
                if (!n.parentNode) return;
                if (String(n.textContent || '').trim()) return;
                if (n.querySelector('img')) return;
                try { n.remove(); } catch (e) { /* 忽略 */ }
            });
            root.querySelectorAll('button, [role="button"], .ds-icon').forEach(n => {
                try { n.remove(); } catch (e) { /* 忽略 */ }
            });
            // 数学已抽成自有 span，其余 svg 均为装饰
            root.querySelectorAll('svg').forEach(n => {
                if (isInside(n, ['katex'])) return;
                try { n.remove(); } catch (e) { /* 忽略 */ }
            });
            [...root.querySelectorAll('span')].forEach(n => {
                if (!n.parentNode) return;
                if (n.closest('.katex, .katex-display')) return;
                const attrs = [...n.attributes].map(a => a.name);
                if (attrs.some(a => a.startsWith(OWN_ATTR_PREFIX))) return;   // 自有标记不展开
                if (attrs.includes('class')) return;                         // 带 class 的 span 保守保留
                if (String(n.textContent || '').trim()) return;              // 有文字则保留
                try {                                                        // 无 class 无属性的空 span → 解包
                    while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
                    n.remove();
                } catch (e) { /* 忽略 */ }
            });
        }

        // 八步规范化（各自容错，单点失败不阻断其余）
        function normalizeContent(doc, root, opts) {
            const steps = [
                () => unwrapTableShell(root),
                () => normalizeMath(root),
                () => normalizeCodeBlocks(root),
                () => normalizeLists(root),
                () => divToParagraph(root),
                () => stripNoise(root),
            ];
            steps.forEach(fn => { try { fn(); } catch (e) { console.warn('[deepseektool] 导出规范化步骤失败：', e); } });
        }

        // ---------- 提取：DeepSeek DOM → 语义消息 ----------

        // AI 答案根：取消息内第一个「不在思考区里」的 .ds-markdown。
        // 陷阱：思考过程正文自身也是 .ds-markdown，且在文档顺序上位于答案之前，
        // 直接 querySelector('.ds-markdown') 会错拿到思考内容。
        // 用显式过滤（`closest('.ds-think-content')`）而非 CSS `:not(.a .b)`，兼容性更好。
        function resolveAiContent(msgEl) {
            let all = [];
            try { all = [...msgEl.querySelectorAll(SEL.AI_CONTENT)]; } catch (e) { return null; }
            for (const el of all) {
                let inThink = false;
                try { inThink = !!el.closest(SEL.THINK_CONTENT); } catch (e) { inThink = false; }
                if (!inThink) return el;
            }
            return null;
        }

        // 思考过程正文：直接取 .ds-think-content（语义类名，实测稳定）。
        // 注意结构陷阱：思考正文并不在折叠条的兄弟层，而是挂在折叠条容器（._245c867）的祖父层
        // （._74c0879）下 —— 一条消息可能有多个 .ds-think-content（分片流式输出），需全部收集。
        // 另需排除「已阅读 N 个网页」这类联网标识（同为 .ds-think-content，但不是思考过程）。
        const WEB_READ_RE = /^已阅读\s*\d+\s*个网页$/;
        function collectReasoningNodes(msgEl) {
            let nodes = [];
            try { nodes = [...msgEl.querySelectorAll(SEL.THINK_CONTENT)]; } catch (e) { return []; }
            return nodes.filter(n => {
                const txt = String(n.textContent || '').trim();
                if (!txt) return false;
                return !WEB_READ_RE.test(txt);
            });
        }

        // 用户文本根：优先语义类名 .ds-collapsible-text，回退「直接子级中文本最长且无 AI 内容/媒体/按钮」
        function resolveUserRoot(msgEl) {
            const collapsible = msgEl.querySelector(SEL.COLLAPSIBLE);
            if (collapsible) return collapsible;
            let best = null, bestLen = 0;
            [...msgEl.children].forEach(c => {
                if (!isEl(c)) return;
                try {
                    if ([...c.querySelectorAll(SEL.AI_CONTENT)].some(x => !x.closest(SEL.THINK_CONTENT))) return;
                } catch (e) { /* 忽略 */ }
                if (c.querySelector('img, video, canvas, figure, button, [role="button"]')) return;
                const len = String(c.textContent || '').trim().length;
                if (len > bestLen) { bestLen = len; best = c; }
            });
            return best;
        }

        // 只保留「思考体 + 答案体」，其余（折叠条 / 操作栏 / 引用来源 / 附件缩略图 / 头像）一律丢弃。
        // 这比逐个枚举待删选择器稳健得多 —— 官网加任何新的装饰层都不会污染输出。
        // 产出的是**语义 DOM**（不做字符串转换），以便模板装饰阶段在其上插入 h1/p/blockquote。
        //
        // 拆成「来源 → 语义 DOM」两步，是因为长对话必须靠快照导出（虚拟列表会把滚过的消息卸载）：
        // 快照存的是原始素材（HTML 串），导出时用同一个函数还原，保证两条路径产出一致。
        function wrapFromSource(role, src, opts) {
            if (!src) return null;
            const wrap = document.createElement('div');
            const fill = (host, html) => {
                if (!html) return;
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                while (tmp.firstChild) host.appendChild(tmp.firstChild);
            };
            if (role === 'assistant') {
                if (opts.includeReasoning && src.reasoningHTML) {
                    const bq = document.createElement('blockquote');
                    fill(bq, src.reasoningHTML);
                    if (bq.firstChild) wrap.appendChild(bq);
                }
                if (!src.answerHTML) return null;
                const sec = document.createElement('div');
                sec.setAttribute(ATTR.SECTION, 'answer');
                fill(sec, src.answerHTML);
                wrap.appendChild(sec);
            } else {
                if (!src.questionHTML) return null;
                const sec = document.createElement('div');
                sec.setAttribute(ATTR.SECTION, 'question');
                fill(sec, src.questionHTML);
                wrap.appendChild(sec);
            }
            normalizeContent(document, wrap, opts);
            return wrap;
        }

        const toMarkdown = (wrap) => {
            const md = converter.convert(wrap);
            return md.trim() ? md.trim() : null;
        };

        // ==================== 内容模板 ====================
        // 模板清单与装饰实现。
        // 装饰产出语义 DOM（h1/h2/p/blockquote），正好喂给上面的转换引擎直接得到 Markdown。
        // 模板清单里多加一项「原样输出」（无装饰），它也是本工具此前的默认行为。
        const TEMPLATE_PLAIN = { id: 'plain', name: '原样输出', desc: '不加任何标识前缀，原样导出问答内容' };
        const TEMPLATES = [
            { id: 'conversation', name: '简洁对话',   desc: '简洁的问答格式，用「提问」与「回答」标识每轮对话' },
            { id: 'structured',   name: '结构化笔记', desc: '以序号标题概括问题，附完整问题详情与标注前缀的回答' },
            { id: 'knowledgeDoc', name: '知识文档',   desc: '将问题作为章节标题，回答作为正文，适合整理成文档' },
            { id: 'rolePlay',     name: '角色对话',   desc: '用「我说」与「DeepSeek说」标识每轮对话，适合还原真实交流场景' },
        ];
        const QUESTION_TEMPLATES = [
            { id: 'qPlainText',  name: '问题清单（纯文本）', desc: '以纯文本序号列出问题，便于复制到聊天或笔记' },
            { id: 'qStructured', name: '问题清单（结构化）', desc: '以序号标题概括提问，附完整问题详情，适合整理问题清单' },
            { id: 'qOutline',    name: '问题大纲',           desc: '以每个提问作为章节标题，适合梳理需求与待解决问题' },
            { id: 'qCards',      name: '问题卡片',           desc: '以 Q1/Q2 卡片形式整理提问，适合快速回顾' },
        ];

        const secOf = (wrap, name) => wrap.querySelector('[' + ATTR.SECTION + '="' + name + '"]');
        // 全量问题文本：**保留换行**（仅归一 CRLF）。对应插件 module 1845 的 p()。
        // 注意不要在这个函数里压空白 —— 换行要留给调用方转成 <br>，否则多段提问会被挤成一行。
        const fullText = (el) => String((el && (el.innerText || el.textContent)) || '').replace(/\r\n?/g, '\n').trim();
        // 单行化：连续空白压成一个空格。对应插件的 m()，仅用于「摘要」与「长度判断」。
        const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();
        const shorten = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '...' : s; };
        // 用新节点替换元素内容，但保留其 class / id / 其余属性
        function replaceInner(el, nodes) {
            const cls = el.className, id = el.id;
            const attrs = [];
            try { [...el.attributes].forEach(a => { if (a.name !== 'class' && a.name !== 'id') attrs.push([a.name, a.value]); }); } catch (e) { /* 忽略 */ }
            el.innerHTML = '';
            el.className = cls;
            if (id) el.id = id;
            attrs.forEach(([k, v]) => { try { el.setAttribute(k, v); } catch (e) { /* 忽略 */ } });
            (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => { if (n) el.appendChild(n); });
        }
        function injectBefore(el, node) {
            if (!node) return;
            if (el.firstChild) el.insertBefore(node, el.firstChild);
            else el.appendChild(node);
        }
        // 问题正文折叠成单段（`<br>` 分节），不保留原有块级结构。对应插件的 a()
        function collapseToParagraph(sec) {
            const text = fullText(sec);
            const p = document.createElement('p');
            p.setAttribute('style', 'margin:0');
            String(text).split('\n').forEach((line, i) => {
                if (i > 0) p.appendChild(document.createElement('br'));
                p.appendChild(document.createTextNode(line));
            });
            replaceInner(sec, p);
        }
        // 内容标题整体降一级（h1→h2 …），仅当内容里存在 h1 时才降
        // 目的：让正文标题层级落在模板插入的 h1 之下
        function demoteHeadings(sec) {
            let hasH1 = false;
            try { hasH1 = !!sec.querySelector('h1'); } catch (e) { hasH1 = false; }
            if (!hasH1) return;
            let list = [];
            try { list = [...sec.querySelectorAll('h1, h2, h3, h4, h5, h6')]; } catch (e) { return; }
            for (let i = list.length - 1; i >= 0; i--) {
                const h = list[i];
                if (!h || !h.parentNode) continue;
                const lv = headingLevel(tag(h));
                if (!lv || lv >= 6) continue;
                const nh = document.createElement('h' + Math.min(lv + 1, 6));
                try { [...h.attributes].forEach(a => nh.setAttribute(a.name, a.value)); } catch (e) { /* 忽略 */ }
                while (h.firstChild) nh.appendChild(h.firstChild);
                try { h.parentNode.replaceChild(nh, h); } catch (e) { /* 忽略 */ }
            }
        }
        const boldLabel = (text) => {
            const p = document.createElement('p');
            p.setAttribute('style', 'margin:0;margin-bottom:8px');
            const s = document.createElement('strong');
            s.textContent = text;
            p.appendChild(s);
            return p;
        };
        // 结构化笔记 / 问题清单（结构化）：序号 h1 + 摘要，超长时补「问题详情」。对应插件的 c()
        // 摘要用**单行化文本**判断长度与截断；「问题详情」用**保留换行**的全文（换行转 <br>）
        function structuredHeader(sec, index, hLevel) {
            const level = Math.min(Math.max(hLevel || 1, 1), 6);
            const full = fullText(sec);
            const sum = oneLine(full);
            const box = document.createElement('div');
            box.setAttribute('style', 'margin-bottom:8px');
            const h = document.createElement('h' + level);
            h.textContent = index + '、' + shorten(sum, 15);
            box.appendChild(h);
            if (sum.length > 15) {
                const detail = document.createElement('div');
                detail.setAttribute('style', 'margin-top:4px;margin-bottom:12px;color:#666');
                const p = document.createElement('p');
                p.setAttribute('style', 'margin:0');
                const s = document.createElement('strong');
                s.textContent = '问题详情：';
                p.appendChild(s);
                p.appendChild(document.createElement('br'));
                const lines = full.split('\n');
                lines.forEach((line, i) => {
                    p.appendChild(document.createTextNode(line));
                    if (i < lines.length - 1) p.appendChild(document.createElement('br'));
                });
                detail.appendChild(p);
                box.appendChild(detail);
            }
            replaceInner(sec, box);
        }
        // 知识文档（h1）/ 问题大纲（h2）：序号标题。对应插件的 h()，标题层级由调用方传入
        function outlineHeader(sec, index, hLevel, maxLen) {
            const level = Math.min(Math.max(hLevel || 2, 1), 6);
            const h = document.createElement('h' + level);
            h.textContent = index + '. ' + shorten(oneLine(fullText(sec)), maxLen);
            replaceInner(sec, h);
        }

        const TEMPLATE_DECORATORS = {
            conversation: {
                onUser: (wrap) => { const s = secOf(wrap, 'question'); if (s) { collapseToParagraph(s); injectBefore(s, boldLabel('提问：')); } },
                onAi: (wrap) => { const s = secOf(wrap, 'answer'); if (s) injectBefore(s, boldLabel('回答：')); },
            },
            structured: {
                onUser: (wrap, n) => { const s = secOf(wrap, 'question'); if (s) structuredHeader(s, n, 1); },
                onAi: (wrap) => { const s = secOf(wrap, 'answer'); if (!s) return; injectBefore(s, boldLabel('回答（Answer）：')); demoteHeadings(s); },
            },
            knowledgeDoc: {
                // 插件：h(e, idx, 1) → h1（章节标题与 structured 同级）
                onUser: (wrap, n) => { const s = secOf(wrap, 'question'); if (s) outlineHeader(s, n, 1, 60); },
                onAi: (wrap) => { const s = secOf(wrap, 'answer'); if (s) demoteHeadings(s); },
            },
            rolePlay: {
                // 插件：rolePlay.onUser = a(e) 折叠 + 「我说：」。折叠不可省，否则多段提问会破坏格式
                onUser: (wrap) => { const s = secOf(wrap, 'question'); if (s) { collapseToParagraph(s); injectBefore(s, boldLabel('我说：')); } },
                onAi: (wrap) => { const s = secOf(wrap, 'answer'); if (s) injectBefore(s, boldLabel('DeepSeek说：')); },
            },
            qStructured: {
                onUser: (wrap, n) => { const s = secOf(wrap, 'question'); if (s) structuredHeader(s, n, 1); },
                onAi: () => { },
            },
            qOutline: {
                // 插件：h(e, idx) → 默认 n=2 → h2
                onUser: (wrap, n) => { const s = secOf(wrap, 'question'); if (s) outlineHeader(s, n, 2, 60); },
                onAi: () => { },
            },
            qCards: {
                onUser: (wrap, n) => {
                    const s = secOf(wrap, 'question');
                    if (!s) return;
                    const box = document.createElement('div');
                    box.setAttribute('style', 'margin-bottom:8px');
                    const h = document.createElement('h1');
                    h.setAttribute('style', 'margin:0;margin-bottom:4px;color:#4f46e5');
                    h.textContent = 'Q' + n + '：';
                    box.appendChild(h);
                    const bq = document.createElement('blockquote');
                    bq.setAttribute('style', 'margin:0 0 8px 0;padding:8px 16px;border-left:3px solid #4f46e5;color:#555;background:rgba(79,70,229,0.04);border-radius:0 6px 6px 0');
                    const p = document.createElement('p');
                    p.setAttribute('style', 'margin:0');
                    fullText(s).split('\n').forEach((line, i, arr) => {
                        p.appendChild(document.createTextNode(line));
                        if (i < arr.length - 1) p.appendChild(document.createElement('br'));
                    });
                    bq.appendChild(p);
                    box.appendChild(bq);
                    replaceInner(s, box);
                },
                onAi: () => { },
            },
            qPlainText: {
                onUser: (wrap, n) => {
                    const s = secOf(wrap, 'question');
                    if (!s) return;
                    const p = document.createElement('p');
                    p.setAttribute('style', 'margin:0');
                    p.appendChild(document.createTextNode(n + '. '));
                    fullText(s).split('\n').forEach((line, i) => {
                        if (i > 0) p.appendChild(document.createElement('br'));
                        p.appendChild(document.createTextNode(line));
                    });
                    replaceInner(s, p);
                },
                onAi: () => { },
            },
        };

        // ==================== 模板预览 ====================
        // 插件每张模板卡上方都有一段 132px 的「缩微排版预览」，用真实选中内容渲染，
        // 让用户在点之前就看懂模板长什么样。这里按同样思路实现，但复用自己的标准化 DOM。

        // 采集预览素材：既有问答时最多 2 组；只选提问时最多 8 条（与插件一致）
        // 入参是记录数组 [{role, src}]，因此**已滚出视野的消息也能参与预览**。
        function extractPreview(recs) {
            const questions = [], answers = [];
            const hasAi = recs.some(r => r.role === 'assistant');
            for (const rec of recs) {
                let wrap = null;
                try { wrap = wrapFromSource(rec.role, rec.src, { includeReasoning: false }); } catch (e) { wrap = null; }
                if (!wrap) continue;
                // 剥掉自有属性与 style/class/id，只留语义标签（strong/code/table…），交给预览 CSS 接管
                try {
                    [...wrap.querySelectorAll('*')].forEach(n => {
                        [...n.attributes].forEach(a => {
                            if (a.name.startsWith(OWN_ATTR_PREFIX) || a.name === 'style' || a.name === 'class' || a.name === 'id') {
                                n.removeAttribute(a.name);
                            }
                        });
                    });
                } catch (e) { /* 忽略 */ }
                const html = String(wrap.innerHTML || '').trim();
                if (!html) continue;
                if (rec.role === 'assistant') answers.push(html); else questions.push(html);
                if (hasAi) {
                    if (questions.length >= 2 && answers.length >= 2) break;
                } else if (questions.length >= 8) break;
            }
            return { questions, answers };
        }

        // 按纯文本长度截断但**保留 DOM 结构**（对应插件 getPreviewHtml 里的 u()）
        function clipHtml(html, limit) {
            if (!html) return '';
            const holder = document.createElement('div');
            holder.innerHTML = html;
            if (String(holder.textContent || '').length <= limit) return html;
            let used = 0;
            const out = document.createElement('div');
            const walk = (node, parent) => {
                if (used >= limit) return false;
                if (node.nodeType === Node.TEXT_NODE) {
                    const room = limit - used;
                    const text = node.textContent || '';
                    if (text.length > room) {
                        parent.appendChild(document.createTextNode(text.slice(0, room) + '...'));
                        used = limit;
                        return false;
                    }
                    parent.appendChild(node.cloneNode(true));
                    used += text.length;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node.cloneNode(false);
                    parent.appendChild(el);
                    for (const child of node.childNodes) if (!walk(child, el)) return false;
                }
                return true;
            };
            for (const child of holder.childNodes) if (!walk(child, out)) break;
            return out.innerHTML;
        }
        // 取纯文本摘要并转义（对应插件的 h()）
        function plainHtml(html, limit) {
            if (!html) return '';
            const holder = document.createElement('div');
            holder.innerHTML = html;
            const text = String(holder.textContent || '').replace(/\s+/g, ' ').trim();
            if (!text) return '';
            const cut = text.length > limit ? text.slice(0, limit) + '...' : text;
            const esc = document.createElement('div');
            esc.textContent = cut;
            return esc.innerHTML;
        }
        const pvC = (inner, mod) => (inner ? `<div class="ds-md-pv-c${mod ? ' ' + mod : ''}">${inner}</div>` : '');

        // 每套模板的缩微预览骨架（结构对齐插件，类名改用自己的 ds-md-pv-* 前缀）
        function previewHtml(id, texts) {
            const q = (texts && texts.questions) || [];
            const a = (texts && texts.answers) || [];
            const n = q[0] || '', o = q[1] || '', r = q[2] || '', i = q[3] || '', s4 = q[4] || '', s5 = q[5] || '';
            const l = a[0] || '', d = a[1] || '';
            const line = (cls, html) => `<div class="ds-md-pv-line${cls ? ' ' + cls : ''}">${html}</div>`;
            const H1 = 'ds-md-pv-line--h1', BOLD = 'ds-md-pv-line--bold', ACC = 'ds-md-pv-line--accent';
            const MUTED = 'ds-md-pv-c--muted';
            const div = '<div class="ds-md-pv-div"></div>';
            const gap = '<div class="ds-md-pv-gap"></div>';
            const sec = (inner) => `<div class="ds-md-pv-sec">${inner}</div>`;

            const maps = {
                plain: () => sec(pvC(clipHtml(n, 200))) +
                    (l ? gap + sec(pvC(clipHtml(l, 200))) : ''),
                structured: () => sec(
                    line(H1, '1、' + plainHtml(n, 15)) +
                    line(BOLD, '问题详情：') +
                    pvC(clipHtml(n, 100), MUTED) + gap +
                    line(BOLD, '回答（Answer）：') + pvC(clipHtml(l, 150))
                ) + (o ? div + sec(
                    line(H1, '2、' + plainHtml(o, 15)) +
                    line(BOLD, '问题详情：') +
                    pvC(clipHtml(o, 100), MUTED) + gap +
                    line(BOLD, '回答（Answer）：') + pvC(clipHtml(d, 150))
                ) : ''),
                conversation: () => sec(
                    line(BOLD, '提问：') + pvC(clipHtml(n, 100), MUTED) + gap +
                    line(BOLD, '回答：') + pvC(clipHtml(l, 200))
                ) + (o ? div + sec(
                    line(BOLD, '提问：') + pvC(clipHtml(o, 100), MUTED) + gap +
                    line(BOLD, '回答：') + pvC(clipHtml(d, 200))
                ) : ''),
                knowledgeDoc: () => sec(
                    line(H1, '1. ' + plainHtml(n, 40)) + pvC(clipHtml(l, 250))
                ) + (o ? gap + sec(
                    line(H1, '2. ' + plainHtml(o, 40)) + pvC(clipHtml(d, 250))
                ) : ''),
                rolePlay: () => sec(
                    line(BOLD, '我说：') + pvC(clipHtml(n, 100), MUTED) + gap +
                    line(BOLD, 'DeepSeek说：') + pvC(clipHtml(l, 200))
                ) + (o ? div + sec(
                    line(BOLD, '我说：') + pvC(clipHtml(o, 100), MUTED) + gap +
                    line(BOLD, 'DeepSeek说：') + pvC(clipHtml(d, 200))
                ) : ''),
                qStructured: () => sec(
                    line(H1, '1、' + plainHtml(n, 15)) +
                    line(BOLD, '问题详情：') + pvC(clipHtml(n, 160), MUTED)
                ) + (o ? div + sec(
                    line(H1, '2、' + plainHtml(o, 15)) +
                    line(BOLD, '问题详情：') + pvC(clipHtml(o, 160), MUTED)
                ) : ''),
                qOutline: () => sec(line(H1, '1. ' + plainHtml(n, 60))) +
                    (o ? sec(line(H1, '2. ' + plainHtml(o, 60))) : '') +
                    (r ? sec(line(H1, '3. ' + plainHtml(r, 60))) : '') +
                    (i ? sec(line(H1, '4. ' + plainHtml(i, 60))) : '') +
                    (s4 ? sec(line(H1, '5. ' + plainHtml(s4, 60))) : ''),
                qCards: () => `<div class="ds-md-pv-card">` +
                    line(ACC + ' ' + BOLD, 'Q1：') +
                    `<div class="ds-md-pv-quote">${pvC(clipHtml(n, 140))}</div></div>` +
                    (o ? `<div class="ds-md-pv-card">` +
                        line(ACC + ' ' + BOLD, 'Q2：') +
                        `<div class="ds-md-pv-quote">${pvC(clipHtml(o, 140))}</div></div>` : ''),
                qPlainText: () => sec(
                    line('', '1. ' + plainHtml(n, 92)) +
                    (o ? line('', '2. ' + plainHtml(o, 92)) : '') +
                    (r ? line('', '3. ' + plainHtml(r, 92)) : '') +
                    (i ? line('', '4. ' + plainHtml(i, 92)) : '') +
                    (s4 ? line('', '5. ' + plainHtml(s4, 92)) : '') +
                    (s5 ? line('', '6. ' + plainHtml(s5, 92)) : '')
                ),
            };
            const fn = maps[id];
            return fn ? fn() : '';
        }

        // 按选中内容返回可选模板清单：
        // 只有提问（无回答）→ 问题清单类；否则 → 问答类
        function templatesFor(hasUser, hasAi) {
            const base = (hasUser && !hasAi) ? QUESTION_TEMPLATES : TEMPLATES;
            return [TEMPLATE_PLAIN].concat(base);
        }

        // 采集当前对话的记录（键驱动）。虚拟列表下会先刷新可见消息的来源快照，
        // 已滚过的消息保留早先的快照 —— 两者合起来才是「整段对话」。
        function collectRecords() {
            rememberMessages();
            // pending：已虚拟化但尚未扫描时，窗口外还有消息（扫描后即为 0）
            let pending = 0;
            try {
                if (isVirtualized() && !scanDone) {
                    const sc = findScrollContainer();
                    if (sc && maxScrollTop(sc) > 40) pending = -1;   // -1 = 数量未知
                }
            } catch (e) { pending = 0; }
            return { keys: orderedKeys(), pending };
        }

        // ---------- 文件名生成 ----------
        const FALLBACK_TITLE = 'DeepSeek对话';
        function resolveTitle() {
            let t = String(document.title || '').trim();
            const SUFFIX = ' - DeepSeek';
            if (t.endsWith(SUFFIX)) t = t.slice(0, -SUFFIX.length).trim();
            return t || FALLBACK_TITLE;
        }
        const pad2 = (n) => String(n).padStart(2, '0');
        // 插件格式：YYYY-MM-DD-HH-mm（带时分，避免同日多次导出互相覆盖）
        function formatExportDate(d) {
            const t = (d instanceof Date && !Number.isNaN(d.getTime())) ? d : new Date();
            return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}-${pad2(t.getHours())}-${pad2(t.getMinutes())}`;
        }
        // 空格→下划线、Windows 非法字符→下划线、截断 50 字（与插件一致）
        function sanitizeFilename(name) {
            return (String(name == null ? '' : name).trim() || FALLBACK_TITLE)
                .replace(/\s+/g, '_')
                .replace(/[<>:"/\\|?*]/g, '_')
                .substring(0, 50);
        }
        function buildFilename(ext) {
            const base = resolveTitle();
            const stamp = mdExportAppendDate ? formatExportDate() : '';
            return sanitizeFilename(stamp ? `${base}-${stamp}` : base) + '.' + ext;
        }
        function download(md, filename) {
            const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });   // 注意：Markdown 不写 BOM
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
        }

        // opts: { includeReasoning, templateId, selectedKeys(Set<string>|null) }
        // 注意：**没有**「仅导出 AI 回答」这类选项 —— 导出哪些消息由勾选态决定
        //（对应插件第 ① 步的「全选提问 / 全选AI回答」）。在弹窗里再放一个同类开关会与之打架。
        function buildMarkdown(opts) {
            const o = opts && typeof opts === 'object' ? opts : {};
            const includeReasoning = o.includeReasoning === true;
            const templateId = o.templateId || null;
            const sel = o.selectedKeys instanceof Set ? o.selectedKeys : null;

            const { keys, pending } = collectRecords();
            if (!keys.length) return { ok: false, error: '未找到对话消息，请确认已打开一个对话。' };

            const list = sel ? keys.filter(k => sel.has(k)) : keys;
            if (!list.length) return { ok: false, error: '没有选中的消息。' };

            const recs = list.map(k => sourceCache.get(k)).filter(Boolean);
            if (!recs.length) return { ok: false, error: '没有可导出的内容。' };

            const hasUser = recs.some(r => r.role === 'user');
            const hasAi = recs.some(r => r.role === 'assistant');
            const dec = templateId && TEMPLATE_DECORATORS[templateId] ? TEMPLATE_DECORATORS[templateId] : null;

            const parts = [];
            let aiCount = 0, userCount = 0, reasoningFound = 0;
            recs.forEach(rec => {
                const wrap = wrapFromSource(rec.role, rec.src, { includeReasoning });
                if (!wrap) return;
                // 模板装饰：用户消息序号自增（供模板编号使用）
                if (rec.role === 'user') userCount++;
                if (dec) {
                    const fn = rec.role === 'user' ? dec.onUser : dec.onAi;
                    try { if (typeof fn === 'function') fn(wrap, userCount); } catch (e) { console.warn('[deepseektool] 模板装饰失败：', e); }
                }
                const md = toMarkdown(wrap);
                if (!md) return;
                if (rec.role === 'assistant') {
                    aiCount++;
                    // 「勾了导出思考过程却什么都没多」是高频困惑点 —— 统计实际命中数，交给提示层回显
                    if (includeReasoning && rec.src && rec.src.reasoningHTML) reasoningFound++;
                }
                parts.push(md);
            });
            if (!parts.length) return { ok: false, error: '对话内容为空。' };
            const head = '# ' + resolveTitle() + '\n\n';
            const body = parts.join('\n\n---\n\n');
            return { ok: true, md: head + body + '\n', count: parts.length, aiCount, pending, hasUser, hasAi, reasoningFound };
        }

        // ---------- 稳定键 / 来源快照 / 全对话扫描 ----------
        // 三者配合才能把长对话导全：
        //
        // 为什么必须这样做：DeepSeek 用虚拟列表渲染，**只渲染可视窗口内的消息**；
        // 一旦滚过去，React 会卸载这些节点。所以
        //   ① 选择状态必须按「稳定键」而非元素引用保存（否则滚出视野就丢选中）；
        //   ② 必须在消息可见的当下就**快照**其原始素材，导出时才有东西可用。

        // 稳定键：优先虚拟列表项 key（跨滚动不变），回退 DOM 序号
        function stableKeyOf(msgEl, index) {
            try {
                const item = msgEl && msgEl.closest ? msgEl.closest(SEL.VIRTUAL_ITEM) : null;
                const k = item && item.getAttribute('data-virtual-list-item-key');
                if (k && String(k).trim()) return 'vk:' + String(k).trim();
            } catch (e) { /* 忽略 */ }
            const i = typeof index === 'number' ? index : msgsInDom().indexOf(msgEl);
            return 'ix:' + (i >= 0 ? i : 0);
        }
        // 稳定键排序（对齐插件 7448 compareStableKeys：同前缀按数字，否则中文序）
        function compareStableKeys(a, b) {
            const parse = (s) => {
                const m = /^([a-z]+):(-?\d+)$/i.exec(String(s == null ? '' : s).trim());
                return m ? { p: m[1].toLowerCase(), n: Number(m[2]) } : null;
            };
            const x = parse(a), y = parse(b);
            if (x && y && x.p === y.p) return x.n - y.n;
            return String(a).localeCompare(String(b), 'zh-Hans-CN');
        }

        // 来源快照：只存**原始素材**（问题体 / 思考体 / 答案体的 HTML），与导出选项解耦，
        // 这样「包含思考过程」等选项在导出时才生效，不污染快照。
        function snapshotSource(msgEl, role) {
            if (!msgEl) return null;
            if (role === 'assistant') {
                const ai = resolveAiContent(msgEl);
                if (!ai) return null;
                let reasoningHTML = '';
                try {
                    const nodes = collectReasoningNodes(msgEl);
                    if (nodes.length) reasoningHTML = nodes.map(n => n.outerHTML).join('');
                } catch (e) { /* 忽略 */ }
                return { role, reasoningHTML, answerHTML: ai.outerHTML };
            }
            const root = resolveUserRoot(msgEl);
            if (!root) return null;
            return { role, questionHTML: root.outerHTML };
        }

        const sourceCache = new Map();   // key -> { key, role, src }
        let orderList = [];              // 已发现的键，按对话顺序
        let scanDone = false;

        const noteOrder = (keys) => { keys.forEach(k => { if (k && !orderList.includes(k)) orderList.push(k); }); };
        const orderedKeys = () => orderList.filter(k => sourceCache.has(k));

        // 把当前 DOM 里的可见消息写入缓存（可见的重取，保证流式内容最新；已滚过的保留旧快照）
        function rememberMessages() {
            const list = msgsInDom();
            const keys = [];
            list.forEach((el, i) => {
                const key = stableKeyOf(el, i);
                const role = resolveAiContent(el) ? 'assistant' : 'user';
                let src = null;
                try { src = snapshotSource(el, role); } catch (e) { src = null; }
                if (!src) return;
                sourceCache.set(key, { key, role, src });
                keys.push(key);
            });
            noteOrder(keys);
            return keys;
        }

        // 找出承载消息列表的滚动容器
        // 对齐插件 module 1996 findVirtualListScrollContainer：从虚拟列表容器出发**沿祖先链向上**
        // 找第一个 overflowY ∈ {auto,scroll} 且确实可滚动的元素。
        // ⚠ 绝不能全页扫 .ds-scroll-area —— 实测页面上有 30+ 个（代码块横向滚动区、侧栏、以及
        //   装饰性的 .ds-scroll-area__gutters），"第一个可滚动的"往往**根本不含消息**；
        //   一旦滚错容器，扫描会静默地一条也采集不到。
        function findScrollContainer() {
            let list = null;
            try { list = document.querySelector(SEL.VIRTUAL_LIST); } catch (e) { list = null; }
            if (list) {
                let node = list.parentElement;
                while (node && node !== document.body) {
                    let oy = '';
                    try { oy = String(getComputedStyle(node).overflowY || ''); } catch (e) { oy = ''; }
                    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight + 4) return node;
                    node = node.parentElement;
                }
            }
            // 回退：整页滚动（非虚拟化或列表未用内层滚动时）
            try {
                const se = document.scrollingElement;
                if (se && se.scrollHeight > se.clientHeight) return se;
            } catch (e) { /* 忽略 */ }
            return null;
        }
        const isVirtualized = () => !!document.querySelector(SEL.VIRTUAL_LIST);
        const maxScrollTop = (sc) => (sc ? Math.max(0, sc.scrollHeight - sc.clientHeight) : 0);
        const nextPaint = (n) => new Promise(res => {
            const tick = (k) => (k <= 0 ? res() : requestAnimationFrame(() => tick(k - 1)));
            tick(Math.max(1, n || 1));
        });
        // 窗口签名：当前渲染出来的消息键序列（不变即视为稳定）
        const windowSignature = () => msgsInDom().map((el, i) => stableKeyOf(el, i)).join(',');

        // 等待窗口稳定：连续两次签名一致即返回（上限 24 次，对齐插件）
        async function waitWindowStable(sc, maxTries) {
            const tries = maxTries || 24;
            let prev = '';
            for (let i = 0; i < tries; i++) {
                await nextPaint(1);
                const sig = windowSignature();
                if (sig && sig === prev) return true;
                prev = sig;
            }
            return !!prev;
        }

        // 单步采集：滚到指定位置 → 等稳定 → 记录窗口内消息
        async function captureAt(sc, top) {
            sc.scrollTop = Math.max(0, Math.min(maxScrollTop(sc), Math.round(top)));
            await waitWindowStable(sc);
            // 图表态代码块先切回代码视图，保证快照里 pre 有内容
            try { if (needsCodeViewSwitch(document)) await ensureCodeView(document); } catch (e) { /* 忽略 */ }
            // 内容还没渲染出来时，多给几次机会
            let keys = rememberMessages();
            for (let i = 0; i < 3 && !keys.length; i++) {
                await new Promise(r => setTimeout(r, 40));
                await waitWindowStable(sc);
                keys = rememberMessages();
            }
            return keys;
        }

        // 全对话扫描：逐步滚过整段对话，边滚边快照（对齐插件 discover() 的主循环）
        async function scanAll() {
            if (scanDone) return true;
            const sc = findScrollContainer();
            if (!sc || maxScrollTop(sc) < 40) { scanDone = true; rememberMessages(); return true; }
            const original = sc.scrollTop;
            const step = Math.max(240, Math.floor(0.45 * sc.clientHeight));
            orderList = [];                       // 按滚动顺序重建对话顺序
            showNotice('正在扫描整段对话，请稍候…');
            if (controlsEl) controlsEl.classList.add(CLS.SCANNING);
            document.body.classList.add(CLS.SCANNING);
            try {
                let pos = 0, guard = 0;
                while (guard < 400) {
                    guard++;
                    const keys = await captureAt(sc, pos);
                    if (!keys.length && pos >= maxScrollTop(sc)) break;
                    if (pos >= maxScrollTop(sc)) break;
                    const next = Math.min(maxScrollTop(sc), pos + step);
                    if (next <= pos + 1) break;
                    pos = next;
                }
                // 再冲几次底部，确保末尾消息被渲染
                for (let i = 0; i < 3; i++) await captureAt(sc, maxScrollTop(sc));
                // 兜底：把缓存里剩下没进顺序表的键按稳定键排序补到末尾
                [...sourceCache.keys()].forEach(k => { if (!orderList.includes(k)) orderList.push(k); });
                orderList.sort((a, b) => {
                    const ia = orderList.indexOf(a), ib = orderList.indexOf(b);
                    return ia - ib;
                });
                scanDone = true;
                return true;
            } finally {
                sc.scrollTop = original;
                await waitWindowStable(sc);
                rememberMessages();               // 恢复视野后刷新一次可见消息
                hideNotice();
                if (controlsEl) controlsEl.classList.remove(CLS.SCANNING);
                document.body.classList.remove(CLS.SCANNING);
            }
        }

        // ---------- 图表态代码块切回「代码」视图 ----------
        // 对齐插件 module 230：双 Tab（代码/图表）且当前不在代码视图 → 需要切换。
        // **不需要主世界注入**：DOM 在两个 world 间共享，React 的委托监听挂在 document 上，
        // 沙箱内 click() 派发的真实事件它能收到 —— 顺带绕开页面 CSP 拦截内联脚本的风险。
        const TAB_SEL = 'div[role="tab"], .ds-segmented-button';
        function getSwitchTabs(block) {
            let tabs = [];
            try { tabs = [...block.querySelectorAll(TAB_SEL)]; } catch (e) { return { hasCode: false, hasDiagram: false, codeSelected: false, codeTab: null }; }
            let hasCode = false, hasDiagram = false, codeSelected = false, codeTab = null;
            tabs.forEach(t => {
                const text = String(t.textContent || '').trim();
                if (!text) return;
                const low = text.toLowerCase();
                const sel = t.getAttribute('aria-selected') === 'true' ||
                    (t.classList && t.classList.contains('ds-segmented-button--selected'));
                if (text.includes('代码') || low.includes('code')) { hasCode = true; codeTab = t; if (sel) codeSelected = true; }
                if (text.includes('图表') || low.includes('chart') || low.includes('diagram')) hasDiagram = true;
            });
            return { hasCode, hasDiagram, codeSelected, codeTab };
        }
        function needsCodeViewSwitch(scope) {
            let blocks = [];
            try { blocks = [...scope.querySelectorAll(SEL.CODE_BLOCK)]; } catch (e) { return false; }
            for (const b of blocks) {
                const t = getSwitchTabs(b);
                if (!t.hasCode || !t.hasDiagram) continue;
                if (!t.codeSelected) return true;
                let hasPre = false;
                try { hasPre = !!(b.querySelector('pre code') || b.querySelector('pre')); } catch (e) { hasPre = false; }
                if (!hasPre) return true;
            }
            return false;
        }
        // 切回代码视图并轮询等待（对齐插件 6 × 30ms）
        async function ensureCodeView(scope) {
            if (!scope) return false;
            let blocks = [];
            try { blocks = [...scope.querySelectorAll(SEL.CODE_BLOCK)]; } catch (e) { return false; }
            let clicked = false;
            blocks.forEach(b => {
                const t = getSwitchTabs(b);
                if (!t.hasCode || !t.hasDiagram || t.codeSelected) return;
                try { if (t.codeTab) { t.codeTab.click(); clicked = true; } } catch (e) { /* 忽略 */ }
            });
            if (!clicked) return false;
            for (let i = 0; i < 6; i++) {
                await new Promise(r => setTimeout(r, 30));
                if (!needsCodeViewSwitch(scope)) return true;
            }
            return false;
        }

        // ---------- 右上角提示条（对齐插件 components/feedback/notice.css） ----------
        let noticeEl = null;
        function showNotice(text) {
            hideNotice();
            noticeEl = document.createElement('div');
            noticeEl.className = 'ds-md-notice';
            noticeEl.innerHTML = '<div class="ds-md-notice-content">' +
                '<span class="ds-md-notice-spinner"><i class="ds-md-notice-ring"></i></span>' +
                '<span class="ds-md-notice-message"></span></div>';
            noticeEl.querySelector('.ds-md-notice-message').textContent = text;
            document.body.appendChild(noticeEl);
        }
        function hideNotice() {
            if (!noticeEl) return;
            const el = noticeEl;
            noticeEl = null;
            try {
                el.classList.add('closing');
                setTimeout(() => { try { el.remove(); } catch (e) { /* 忽略 */ } }, 200);
            } catch (e) { try { el.remove(); } catch (e2) { /* 忽略 */ } }
        }

        // ---------- 选择模式 ----------
        // 勾选态：复选框注入 + 控制条 + 选中高亮。
        const CLS = {
            ACTIVE: 'ds-md-selection-active',
            SCANNING: 'ds-md-selection-scanning',
            CB_WRAP: 'ds-md-cb-wrap',
            CB_USER: 'ds-md-cb-user',
            CB_AI: 'ds-md-cb-ai',
            CB: 'ds-md-checkbox',
            SELECTED: 'ds-md-msg-selected',
            SEL_USER: 'ds-md-msg-user',
            SEL_AI: 'ds-md-msg-ai',
            CONTROLS: 'ds-md-controls',
            SELECT_ALL: 'ds-md-select-all',
            SELECT_USER: 'ds-md-select-user',
            SELECT_AI: 'ds-md-select-ai',
            EXPORT_SEL: 'ds-md-export-selected',
            CANCEL: 'ds-md-cancel-sel',
            HINT: 'ds-md-sel-hint',
            MODAL: 'ds-md-modal',
            DIALOG: 'ds-md-dialog',
            STEP_CONTENT: 'ds-md-step-content',
            STEP_TEMPLATE: 'ds-md-step-template',
            FMT_BTN: 'ds-md-fmt-btn',
            TPL_CARD: 'ds-md-template-card',
            REMEMBER: 'ds-md-remember',
            BACK: 'ds-md-back',
            ACTIONS: 'ds-md-dlg-actions',
            CANCEL_DLG: 'ds-md-dlg-cancel',
            TITLE: 'ds-md-dlg-title',
            SUB: 'ds-md-dlg-sub',
        };
        const selectedKeys = new Set();      // 选中的**稳定键**（不是元素引用）
        let selectionActive = false;
        let selObserver = null;
        let controlsEl = null;
        let syncTimer = null;
        let dialogEl = null;
        let dialogCleanup = null;

        const msgsInDom = () => [...document.querySelectorAll(SEL.MESSAGE)];

        function attachCheckbox(msgEl, isUser, key) {
            if (!msgEl) return;
            const k = key || stableKeyOf(msgEl);
            let wrap = null, cb = null;
            try { wrap = msgEl.querySelector('.' + CLS.CB_WRAP); } catch (e) { wrap = null; }
            if (wrap) {
                cb = wrap.querySelector('.' + CLS.CB);
                wrap.classList.toggle(CLS.CB_USER, isUser);
                wrap.classList.toggle(CLS.CB_AI, !isUser);
            } else {
                wrap = document.createElement('div');
                wrap.className = CLS.CB_WRAP + ' ' + (isUser ? CLS.CB_USER : CLS.CB_AI);
                cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.className = CLS.CB;
                cb.setAttribute('aria-label', '选择此条消息');
                cb.addEventListener('change', (e) => {
                    e.stopPropagation();
                    // 每次现算键：React 会重建节点，闭包里捕获的旧节点可能已脱离文档
                    const live = stableKeyOf(msgEl);
                    if (e.target.checked) selectedKeys.add(live); else selectedKeys.delete(live);
                    applyHighlight(msgEl);
                    updateControls();
                });
                wrap.appendChild(cb);
                // 挂载前确保定位上下文（否则 absolute 复选框会跑到页面左上角）
                if (getComputedStyle(msgEl).position === 'static') msgEl.style.position = 'relative';
                msgEl.appendChild(wrap);
            }
            if (cb) { cb.dataset.mdKey = k; cb.checked = selectedKeys.has(k); }
        }

        function syncCheckboxes() {
            rememberMessages();                 // 先刷新可见消息的来源快照（键驱动的前提）
            const list = msgsInDom();
            list.forEach((el, i) => {
                const key = stableKeyOf(el, i);
                attachCheckbox(el, !resolveAiContent(el), key);
            });
            list.forEach(applyHighlight);
        }

        function removeCheckboxes() {
            document.querySelectorAll('.' + CLS.CB_WRAP).forEach(el => {
                try {
                    const msg = el.closest ? el.closest(SEL.MESSAGE) : null;
                    if (msg) msg.style.position = '';
                } catch (e) { /* 忽略 */ }
                el.remove();
            });
            document.querySelectorAll('.' + CLS.SELECTED).forEach(el => {
                el.classList.remove(CLS.SELECTED, CLS.SEL_USER, CLS.SEL_AI);
                el.style.position = '';
            });
        }

        function highlightTarget(msgEl, isUser) {
            if (!msgEl || !isUser) return msgEl;
            try {
                const r = resolveUserRoot(msgEl);
                if (r && r !== msgEl) return r;
            } catch (e) { /* 忽略 */ }
            return msgEl;
        }
        function clearHighlight(msgEl, keep) {
            if (!msgEl || !msgEl.querySelectorAll) return;
            const clear = (n) => {
                if (!n || n === keep) return;
                try { n.classList.remove(CLS.SELECTED, CLS.SEL_USER, CLS.SEL_AI); } catch (e) { /* 忽略 */ }
            };
            clear(msgEl);
            try { msgEl.querySelectorAll('.' + CLS.SELECTED).forEach(clear); } catch (e) { /* 忽略 */ }
        }
        function applyHighlight(msgEl) {
            if (!msgEl) return;
            const isUser = !resolveAiContent(msgEl);
            const on = selectedKeys.has(stableKeyOf(msgEl));
            try {
                const cb = msgEl.querySelector('.' + CLS.CB);
                if (cb) cb.checked = on;
            } catch (e) { /* 忽略 */ }
            const t = highlightTarget(msgEl, isUser);
            clearHighlight(msgEl, t);
            if (!t) return;
            t.classList.toggle(CLS.SELECTED, on);
            t.classList.remove(CLS.SEL_USER, CLS.SEL_AI);
            if (on) t.classList.add(isUser ? CLS.SEL_USER : CLS.SEL_AI);
        }

        function createControls() {
            const box = document.createElement('div');
            box.className = CLS.CONTROLS;
            const mk = (cls, text, onClick) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = cls;
                b.textContent = text;
                b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
                return b;
            };
            const all = mk(CLS.SELECT_ALL, '全选', () => { void selectAll(); });
            const user = mk(CLS.SELECT_USER, '全选提问', () => { void selectByRole('user'); });
            const ai = mk(CLS.SELECT_AI, '全选AI回答', () => { void selectByRole('assistant'); });
            const exp = mk(CLS.EXPORT_SEL, '导出选中 (0)', () => { void exportSelected(); });
            const cancel = mk(CLS.CANCEL, '取消', () => stopSelection());
            const hint = document.createElement('div');
            hint.className = CLS.HINT;
            hint.textContent = '可手动勾选想要导出的内容';
            const tail = document.createElement('div');
            tail.className = 'ds-md-cancel-wrap';
            tail.appendChild(cancel);
            tail.appendChild(hint);
            box.appendChild(all);
            box.appendChild(user);
            box.appendChild(ai);
            box.appendChild(exp);
            box.appendChild(tail);
            return box;
        }

        let busyCount = 0;   // 进行中的扫描次数（>0 时禁用控制条按钮）
        function updateControls() {
            if (!controlsEl) return;
            const total = orderedKeys().length;
            const n = selectedKeys.size;
            const q = (s) => controlsEl.querySelector('.' + s);
            const expBtn = q(CLS.EXPORT_SEL);
            const allBtn = q(CLS.SELECT_ALL);
            const userBtn = q(CLS.SELECT_USER);
            const aiBtn = q(CLS.SELECT_AI);
            const hint = q(CLS.HINT);
            const busy = busyCount > 0;
            if (hint) {
                hint.textContent = n > 0 ? '可手动勾选想要导出的内容' : '当前页无对话内容';
                hint.classList.toggle('is-ok', n > 0);   // 有选中 → 灰字提示；无选中 → 红字警告
            }
            [allBtn, userBtn, aiBtn].forEach(b => { if (b) b.disabled = busy || total === 0; });
            if (expBtn) {
                expBtn.textContent = `导出选中 (${n})`;
                expBtn.disabled = busy || n <= 0;
            }
            if (allBtn) allBtn.textContent = (n > 0 && n === total) ? '取消全选' : '全选';
        }

        // 需要时先扫全对话（虚拟列表下才真正滚动；短对话直接标记完成）
        async function ensureScanned() {
            if (scanDone) return true;
            if (!isVirtualized()) { scanDone = true; rememberMessages(); return true; }
            busyCount++;
            updateControls();
            try {
                return await scanAll();
            } catch (e) {
                console.warn('[deepseektool] 扫描对话失败：', e);
                return false;
            } finally {
                busyCount = Math.max(0, busyCount - 1);
                syncCheckboxes();
                updateControls();
            }
        }

        async function selectAll() {
            await ensureScanned();
            const keys = orderedKeys();
            const willSelect = selectedKeys.size < keys.length;
            selectedKeys.clear();
            if (willSelect) keys.forEach(k => selectedKeys.add(k));
            syncCheckboxes();
            updateControls();
        }
        async function selectByRole(role) {
            await ensureScanned();
            selectedKeys.clear();
            orderedKeys().forEach(k => {
                const rec = sourceCache.get(k);
                if (rec && rec.role === role) selectedKeys.add(k);
            });
            syncCheckboxes();
            updateControls();
        }

        function startObserver() {
            stopObserver();
            selObserver = new MutationObserver(muts => {
                let need = false;
                for (const m of muts) {
                    if (m.type !== 'childList' || !m.addedNodes.length) continue;
                    for (const node of m.addedNodes) {
                        if (node.nodeType !== Node.ELEMENT_NODE) continue;
                        // 只认「新增了消息或含消息的子树」；复选框自身注入不会命中 → 不自激
                        if ((node.matches && node.matches(SEL.MESSAGE)) ||
                            (node.querySelector && node.querySelector(SEL.MESSAGE))) { need = true; break; }
                    }
                    if (need) break;
                }
                if (!need) return;
                clearTimeout(syncTimer);
                syncTimer = setTimeout(() => { if (selectionActive) { syncCheckboxes(); updateControls(); } }, 150);
            });
            selObserver.observe(document.body, { childList: true, subtree: true });
        }
        function stopObserver() {
            clearTimeout(syncTimer);
            syncTimer = null;
            if (selObserver) { try { selObserver.disconnect(); } catch (e) { /* 忽略 */ } selObserver = null; }
        }

        function startSelection() {
            if (selectionActive) return true;
            if (!msgsInDom().length) { showToast('当前页无对话内容'); return false; }
            selectionActive = true;
            // 每次进入都是全新会话：清空上轮的键、顺序与快照（避免跨对话残留）
            selectedKeys.clear();
            sourceCache.clear();
            orderList = [];
            scanDone = false;
            busyCount = 0;
            document.body.classList.add(CLS.ACTIVE);
            syncCheckboxes();
            controlsEl = createControls();
            document.body.appendChild(controlsEl);
            updateControls();
            startObserver();
            document.addEventListener('keydown', onSelectionKey, true);
            return true;
        }

        function onSelectionKey(e) {
            if (!selectionActive) return;
            if (e.key !== 'Escape') return;
            if (document.querySelector('.' + CLS.MODAL)) return;   // 模态框打开时 Esc 归模态框处理
            e.stopPropagation();
            stopSelection();
        }

        function stopSelection() {
            if (!selectionActive) return;
            selectionActive = false;
            selectedKeys.clear();
            document.body.classList.remove(CLS.ACTIVE, CLS.SCANNING);
            document.removeEventListener('keydown', onSelectionKey, true);
            stopObserver();
            hideNotice();
            removeCheckboxes();
            if (controlsEl) { try { controlsEl.remove(); } catch (e) { /* 忽略 */ } controlsEl = null; }
        }

        // ---------- 模态框（两步：导出内容 → 内容模板） ----------
        // 两步弹窗。本工具只有 Markdown 一种格式，故步 1 只列格式
        // 不作为分叉条件（点格式即进入步 2），并把「记住我的选择」用于**预填**而非跳过模板步。
        // 弹窗选项的唯一来源：用户上次勾了「记住我的选择」才生效；否则一律走硬编码默认值。
        // 绝不回落读旧设置键 —— 那会让一个已从设置面板移除的开关继续隐形生效。
        // 默认「导出思考过程 = 开」。
        const DEFAULT_INCLUDE_REASONING = true;
        const ALL_TEMPLATE_IDS = new Set(
            [TEMPLATE_PLAIN.id].concat(TEMPLATES.map(t => t.id), QUESTION_TEMPLATES.map(t => t.id))
        );
        function currentPrefs() {
            let saved = null;
            try { saved = JSON.parse(GM_getValue(STORAGE_MD_EXPORT_PREFS, '') || 'null'); } catch (e) { saved = null; }
            // 只有用户真的勾过「记住我的选择」才会有落库值；没有就用默认
            const hasSaved = !!saved && typeof saved === 'object';
            const s = hasSaved ? saved : {};
            return {
                includeReasoning: typeof s.includeReasoning === 'boolean' ? s.includeReasoning : DEFAULT_INCLUDE_REASONING,
                templateId: ALL_TEMPLATE_IDS.has(s.templateId) ? s.templateId : TEMPLATE_PLAIN.id,
                remember: s.remember === true,
            };
        }
        function savePrefs(p) {
            try { GM_setValue(STORAGE_MD_EXPORT_PREFS, JSON.stringify(p)); } catch (e) { /* 忽略 */ }
        }
        // 清除记忆 = 清掉「记住我的选择」+ 一并归零 v1 遗留键（否则老用户会一直被隐形开关影响）
        function clearPrefs() {
            try { GM_setValue(STORAGE_MD_EXPORT_PREFS, ''); } catch (e) { /* 忽略 */ }
            LEGACY_MD_KEYS.forEach(k => { try { GM_setValue(k, false); } catch (e) { /* 忽略 */ } });
        }
        const templateNameOf = (id) => {
            if (!id) return '';
            if (id === TEMPLATE_PLAIN.id) return TEMPLATE_PLAIN.name;
            const hit = TEMPLATES.concat(QUESTION_TEMPLATES).find(t => t.id === id);
            return hit ? hit.name : '';
        };

        function openDialog() {
            // 从缓存取记录（可能包含已滚出视野的消息）—— 这正是长对话能导全的原因
            const recs = orderedKeys().filter(k => selectedKeys.has(k)).map(k => sourceCache.get(k)).filter(Boolean);
            if (!recs.length) { showToast('请先选择要导出的消息'); return; }
            closeDialog();

            const hasUser = recs.some(r => r.role === 'user');
            const hasAi = recs.some(r => r.role === 'assistant');
            const nUser = recs.filter(r => r.role === 'user').length;
            const nAi = recs.length - nUser;
            const prefs = currentPrefs();
            const tplList = templatesFor(hasUser, hasAi);
            const previewTexts = extractPreview(recs);   // 模板卡缩微预览的素材（最多 2 组问答）

            const modal = document.createElement('div');
            modal.className = CLS.MODAL;
            modal.innerHTML = `
                <div class="${CLS.DIALOG}" role="dialog" aria-modal="true" aria-label="导出为 Markdown">
                    <div class="ds-md-dlg-header">
                        <h2 class="${CLS.TITLE}">选择导出内容</h2>
                        <button type="button" class="ds-md-dlg-close" aria-label="关闭">✕</button>
                    </div>
                    <div class="ds-md-dlg-body">
                        <div class="ds-md-step ${CLS.STEP_CONTENT}">
                            <p class="${CLS.SUB}">即将导出 ${recs.length} 条消息（提问 ${nUser} 条 · 回答 ${nAi} 条）：</p>
                            <div class="ds-md-field">
                                <div class="ds-md-field-label">导出格式</div>
                                <div class="ds-md-format-options">
                                    <button type="button" class="${CLS.FMT_BTN} is-active" data-format="md">Markdown</button>
                                </div>
                            </div>
                        </div>
                        <div class="ds-md-step ${CLS.STEP_TEMPLATE}" style="display:none">
                            <div class="ds-md-tpl-head">
                                <button type="button" class="${CLS.BACK}">‹ 返回</button>
                                <p class="${CLS.SUB} ds-md-tpl-sub">点击所需模板即可导出：</p>
                            </div>
                            <div class="ds-md-template-options"></div>
                        </div>
                    </div>
                    <div class="ds-md-dlg-footer">
                        <div class="ds-md-footer-left">
                            <label class="ds-md-opt"><input type="checkbox" class="ds-md-switch ds-md-chk-reasoning"><span>导出思考过程</span><em class="ds-md-hint">需页面上展开过「已思考」</em></label>
                            <label class="${CLS.REMEMBER}"><input type="checkbox" class="ds-md-chk-remember"><span>记住我的选择，后续不再询问</span></label>
                        </div>
                        <div class="${CLS.ACTIONS}">
                            <button type="button" class="${CLS.CANCEL_DLG}">重新选择</button>
                        </div>
                    </div>
                </div>`;

            const q = (s) => modal.querySelector('.' + s);
            const stepContent = q(CLS.STEP_CONTENT);
            const stepTemplate = q(CLS.STEP_TEMPLATE);
            const titleEl = q(CLS.TITLE);
            const subEl = q(CLS.SUB);
            const tplSub = modal.querySelector('.ds-md-tpl-sub');
            const tplBox = modal.querySelector('.ds-md-template-options');
            const rememberWrap = q(CLS.REMEMBER);
            const rememberChk = modal.querySelector('.ds-md-chk-remember');
            const actions = q(CLS.ACTIONS);
            const reasoningChk = modal.querySelector('.ds-md-chk-reasoning');
            const backBtn = q(CLS.BACK);

            // 预填（来自上次「记住我的选择」）
            reasoningChk.checked = prefs.includeReasoning;
            rememberChk.checked = prefs.remember;

            const readOpts = () => ({
                includeReasoning: !!reasoningChk.checked,
                templateId: null,
            });

            const persist = (templateId) => {
                if (!rememberChk.checked) return;
                const o = readOpts();
                savePrefs({ includeReasoning: o.includeReasoning, templateId, remember: true });
            };

            const finish = (templateId) => {
                const o = readOpts();
                o.templateId = templateId;
                persist(templateId);
                // 必须先快照选中键：stopSelection() 会 clear() 掉 selectedKeys
                const snapshot = new Set(selectedKeys);
                closeDialog();
                stopSelection();
                runExport(o, snapshot);
            };

            const showContentStep = (animate) => {
                stepContent.style.display = '';
                stepTemplate.style.display = 'none';
                titleEl.textContent = '选择导出内容';
                subEl.textContent = `即将导出 ${recs.length} 条消息（提问 ${nUser} 条 · 回答 ${nAi} 条）：`;
                actions.hidden = false;
                rememberWrap.hidden = true;    // 与插件一致：步 1 还没选模板，无可记住的内容
                modal.querySelector('.' + CLS.DIALOG).classList.remove('is-template-step');
                // 仅「从模板步返回」时播滑入动画（首次打开不播）
                if (animate) {
                    stepContent.classList.add('step-slide-back');
                    requestAnimationFrame(() => stepContent.classList.remove('step-slide-back'));
                }
            };
            const showTemplateStep = () => {
                stepContent.style.display = 'none';
                stepTemplate.style.display = '';
                titleEl.textContent = '选择内容模板';
                if (tplSub) tplSub.textContent = '点击所需模板即可导出：';
                actions.hidden = true;
                rememberWrap.hidden = false;
                modal.querySelector('.' + CLS.DIALOG).classList.add('is-template-step');
                // 模板清单已按选中内容（是否只有提问）确定，与步 1 的选项无关
                renderTemplates();
                stepTemplate.classList.add('step-slide-in');
                requestAnimationFrame(() => stepTemplate.classList.remove('step-slide-in'));
            };

            function renderTemplates() {
                tplBox.innerHTML = '';
                tplList.forEach(t => {
                    const card = document.createElement('button');
                    card.type = 'button';
                    card.className = CLS.TPL_CARD;
                    card.dataset.template = t.id;
                    if (t.id === prefs.templateId) card.classList.add('is-remembered');
                    // 结构对齐插件：上半 = 132px 缩微预览，下半 = 名称 + 描述
                    const pv = document.createElement('div');
                    pv.className = 'ds-md-pv';
                    pv.innerHTML = previewHtml(t.id, previewTexts);
                    const info = document.createElement('div');
                    info.className = 'ds-md-tpl-info';
                    const nm = document.createElement('span');
                    nm.className = 'ds-md-tpl-name';
                    nm.textContent = t.name;
                    const ds = document.createElement('span');
                    ds.className = 'ds-md-tpl-desc';
                    ds.textContent = t.desc;
                    info.appendChild(nm);
                    info.appendChild(ds);
                    card.appendChild(pv);
                    card.appendChild(info);
                    card.addEventListener('click', () => finish(t.id));
                    tplBox.appendChild(card);
                });
            }

            modal.querySelectorAll('.' + CLS.FMT_BTN).forEach(btn => {
                btn.addEventListener('click', () => showTemplateStep());
            });
            backBtn.addEventListener('click', () => showContentStep(true));
            q(CLS.CANCEL_DLG).addEventListener('click', () => { closeDialog(); });   // 回到选择态（不退出）
            modal.querySelector('.ds-md-dlg-close').addEventListener('click', () => { closeDialog(); });
            modal.addEventListener('click', (e) => { if (e.target === modal) closeDialog(); });

            const onKey = (e) => { if (e.key === 'Escape') closeDialog(); };
            document.addEventListener('keydown', onKey);
            dialogCleanup = () => document.removeEventListener('keydown', onKey);

            var _dialogInner = modal.querySelector('.' + CLS.DIALOG);
            showContentStep();
            document.body.appendChild(modal);
            dialogEl = modal;
            return true;
        }

        function closeDialog() {
            if (dialogCleanup) { try { dialogCleanup(); } catch (e) { /* 忽略 */ } dialogCleanup = null; }
            if (dialogEl) { try { dialogEl.remove(); } catch (e) { /* 忽略 */ } dialogEl = null; }
        }

        async function exportSelected() {
            if (!selectedKeys.size) { showToast('请先选择要导出的消息'); return false; }
            // 导出前确保已扫全（长对话下窗口外的消息只有扫过才有内容）
            await ensureScanned();
            // 图表态代码块切回代码视图并刷新快照 —— 否则 pre 为空，导出会丢代码
            try {
                if (needsCodeViewSwitch(document)) {
                    showNotice('正在切换代码视图…');
                    await ensureCodeView(document);
                    hideNotice();
                    rememberMessages();
                }
            } catch (e) { hideNotice(); }
            if (!selectedKeys.size) { showToast('请先选择要导出的消息'); return false; }
            return openDialog();
        }

        function runExport(o, selSet) {
            let r;
            try {
                r = buildMarkdown({
                    includeReasoning: o.includeReasoning,
                    templateId: o.templateId,
                    selectedKeys: selSet instanceof Set ? selSet : new Set(selectedKeys),
                });
            } catch (e) {
                console.error('[deepseektool] 导出 Markdown 失败：', e);
                showToast('导出失败：' + (e && e.message ? e.message : '未知错误'));
                return false;
            }
            if (!r.ok) { showToast(r.error); return false; }
            download(r.md, buildFilename('md'));
            // 把实际生效的选项写进提示 —— 「怎么少了内容」这类疑问必须一眼可见，而不是静默发生
            let tip = `已导出 ${r.count} 条消息为 Markdown`;
            const extras = [];
            if (o.includeReasoning) extras.push('含思考过程');
            const tplName = templateNameOf(o.templateId);
            if (tplName) extras.push('模板：' + tplName);
            if (extras.length) tip += `（${extras.join(' · ')}）`;
            // 勾了「导出思考过程」但一条都没取到 → 明确告知原因，不要静默无声
            if (o.includeReasoning && !r.reasoningFound) {
                tip += '；未发现「已思考」内容，需先在页面上展开过才会被导出';
            }
            if (r.pending < 0) tip += '；对话较长，建议先点「全选」扫描后再导出';
            showToast(tip, (o.includeReasoning && !r.reasoningFound) || r.pending < 0 ? 5200 : 4200);
            return true;
        }

        // 菜单命令入口：直接进入勾选态
        function beginExportFlow() {
            if (!mdExportEnabled) { showToast('对话导出已关闭，请在「脚本设置 → 对话导出」中开启'); return false; }
            return startSelection();
        }

        return {
            beginExportFlow, startSelection, stopSelection, exportSelected, clearPrefs,
            buildMarkdown, isSelecting: () => selectionActive,
            SEL, ATTR,
        };
    })();

    // ==================== 代码块导出为图片 ====================
    // 把单个代码块渲染成「窗口卡片」样式的图片：背景 + 窗口 chrome + 代码体（可选行号）。
    //
    // 关键设计（依据真实页面实测，见 .workbuddy/research/code-export-image-trace.md）：
    //   1. 官网高亮是 Prism token class（无内联色）→「浅色底 / 深色底」通过注入 CSS 覆盖实现；
    //   2. 官网 .token / .md-code-block 规则读不到 cssRules → 必须自建完整样式与 token 色板；
    //   3. 折叠态只是 max-height/overflow 的视觉裁剪，内容完整留在 DOM → 克隆后清样式即可拿全文，
    //      **绝不在原 DOM 上改动**（与表格导出同一条「克隆 + 隔离」原则）；
    //   4. 官网 pre 计算样式为 white-space:pre-wrap，但实测最宽行 829px < 内容宽 858px、未触发折行；
    //      导出统一强制 white-space:pre（不折行，卡片按最长行自适应宽），逻辑行 = 视觉行，行号 counter 1:1；
    //   5. 复用既有 html2canvas（@require）与「离屏 iframe 隔离」渲染手法，零新增依赖 / 零新增权限。
    const codeImageUnit = (() => {
        const MONO_STACK = 'Menlo, Monaco, Consolas, "Cascadia Mono", "Ubuntu Mono", "DejaVu Sans Mono", "Liberation Mono", "JetBrains Mono", "Fira Code", Courier, monospace';

        // 背景预设：渐变 / 纯色 / 透明
        const BG_PRESETS = [
            { id: 'grad-indigo', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', label: '靛蓝渐变' },
            { id: 'grad-sunset', css: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', label: '日落渐变' },
            { id: 'grad-mint', css: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', label: '薄荷渐变' },
            { id: 'grad-ocean', css: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', label: '海洋渐变' },
            { id: 'grad-night', css: 'linear-gradient(135deg, #232526 0%, #414345 100%)', label: '深空渐变' },
            { id: 'solid-gray', css: '#e9edf2', label: '浅灰' },
            { id: 'solid-dark', css: '#1e1e24', label: '墨黑' },
            { id: 'transparent', css: 'transparent', label: '透明' },
        ];
        const bgCssOf = (id) => {
            const hit = BG_PRESETS.filter(p => p.id === id)[0];
            return hit ? hit.css : BG_PRESETS[0].css;
        };

        // 浅色 / 深色代码色板。
        // 取值来源：官网真机实测（comment / keyword / function / operator / constant / punctuation）
        // + 标准 One Light / One Dark 对剩余 token 类型的约定。
        // ⚠️ 这份色板只负责「导出底色与页面当前底色**不一致**」的跨主题场景；
        //    底色一致时以 harvestTokenColors() 采到的页面实测色为准（见 buildShotCss）。
        const THEME_LIGHT = {
            name: 'light', bg: '#f3f4f6', text: '#383a42',
            comment: '#a0a1a7', prolog: '#a0a1a7', cdata: '#a0a1a7',
            keyword: '#a626a4', boolean: '#b76b01',
            string: '#50a14f', 'template-string': '#50a14f', 'template-punctuation': '#50a14f',
            'attr-value': '#50a14f', char: '#50a14f', regex: '#50a14f', variable: '#50a14f', inserted: '#50a14f',
            number: '#b76b01', constant: '#b76b01', symbol: '#b76b01', 'attr-name': '#b76b01',
            'class-name': '#b76b01', deleted: '#b76b01',
            tag: '#e45649', selector: '#e45649',
            function: '#4078f2', 'function-variable': '#4078f2', atrule: '#4078f2', operator: '#4078f2',
            property: '#e45649', 'literal-property': '#e45649',
            url: '#0184bc',
            parameter: '#383a42', punctuation: '#383a42',
        };
        const THEME_DARK = {
            name: 'dark', bg: '#282c34', text: '#abb2bf',
            comment: '#5c6370', prolog: '#5c6370', cdata: '#5c6370',
            keyword: '#c678dd',
            string: '#98c379', 'template-string': '#98c379', 'template-punctuation': '#98c379',
            'attr-value': '#98c379', char: '#98c379', regex: '#98c379', variable: '#98c379',
            inserted: '#98c379', selector: '#98c379', builtin: '#98c379',
            number: '#d19a66', constant: '#d19a66', boolean: '#d19a66',
            'attr-name': '#d19a66', 'class-name': '#d19a66', atrule: '#d19a66',
            function: '#61afef', 'function-variable': '#61afef',
            property: '#e06c75', 'literal-property': '#e06c75', tag: '#e06c75', symbol: '#e06c75',
            deleted: '#e06c75', important: '#e06c75',
            operator: '#56b6c2', url: '#56b6c2',
            parameter: '#abb2bf', punctuation: '#abb2bf',
        };

        const DEFAULT_OPTS = {
            bg: 'grad-indigo', window: 'macos', padding: 32, shadow: true,
            fontSize: 13, lineHeight: 22, lineNumbers: false, scale: 2, theme: '',
        };

        // ---------- 样式偏好读写（记住上次选择） ----------
        function loadPrefs() {
            try {
                if (codeImagePrefs) return typeof codeImagePrefs === 'string' ? JSON.parse(codeImagePrefs) : codeImagePrefs;
            } catch (_) { /* 数据损坏则忽略，回落默认 */ }
            return {};
        }
        function savePrefs(p) {
            codeImagePrefs = p;
            try { GM_setValue(STORAGE_CODE_IMAGE_PREFS, JSON.stringify(p)); } catch (_) { /* 忽略 */ }
        }

        // ---------- 语言提取（来自 banner 文案，排除操作按钮文字） ----------
        const OP_LABEL = /^(复制|下载|展开|收起|编辑|运行|预览|导出|copy|download|expand|collapse|edit|run)$/i;
        function extractLang(block) {
            const banner = block.querySelector('.md-code-block-banner-wrap');
            if (!banner) return '';
            for (const sp of banner.querySelectorAll('span')) {
                const s = String(sp.textContent || '').trim();
                if (!s || s.length > 40 || OP_LABEL.test(s)) continue;
                return s.split(/\s+/)[0].toLowerCase();
            }
            return '';
        }

        // ---------- 克隆清洗（绝不改原 DOM） ----------
        function cloneCodeBlockPre(block) {
            if (!block) return null;
            const clone = block.cloneNode(true);
            const stripSvg = (root) => {
                [...root.children].forEach(c => { if (c.tagName && c.tagName.toLowerCase() === 'svg') c.remove(); });
            };
            // 整条 banner（语言标签 + 官网按钮 + 折叠/导出按钮）与装饰 svg 一并剔除
            clone.querySelectorAll('.md-code-block-banner-wrap').forEach(el => el.remove());
            clone.querySelectorAll('.ds-fold-btn, .ds-code-export-btn, .table-internal-buttons').forEach(el => el.remove());
            clone.removeAttribute('data-fold-processed');
            stripSvg(clone);
            const pre = clone.querySelector('pre');
            if (!pre) return null;
            // 清折叠态（仅在克隆体上操作）
            pre.style.maxHeight = '';
            pre.style.overflow = '';
            pre.style.display = '';
            pre.classList.remove('ds-fold-preview');
            delete pre.dataset.origMaxHeight;
            delete pre.dataset.origOverflow;
            delete pre.dataset.origDisplay;
            stripSvg(pre);
            return pre;
        }

        function resolveTheme(opts) {
            if (opts.theme === 'light') return THEME_LIGHT;
            if (opts.theme === 'dark') return THEME_DARK;
            return document.body.classList.contains('dark') ? THEME_DARK : THEME_LIGHT;
        }

        const isPageDark = () => document.body.classList.contains('dark');

        // ---------- 页面实测 token 颜色采集 ----------
        // 为什么需要它：官网高亮色定义在跨域样式表 / CSS-in-JS 里，cssRules 读不到，
        // 自建色板又只能覆盖「我们想得到的」token 类型 —— 实测真机 html 代码块用的是
        // tag / attr-name / attr-value，一度全部落在色板之外，导致 1264/1270 个
        // 本来有颜色的 token 在导出图上掉回纯文字色。
        // 但「当前页面正在渲染的 token」其计算色一定读得到：就地按类名采集，
        // 既不依赖任何外部定义，也能自动覆盖官网后续新增的 token 类型。
        // 仅用于「导出底色 == 页面当前底色」；跨主题时仍走自建色板，否则明暗会串味。
        const TOKEN_CLS_OK = /^[A-Za-z_][\w-]*$/;
        const RESERVED_KEYS = ['name', 'bg', 'text'];
        function harvestTokenColors(root) {
            const map = {};
            if (!root || !root.querySelectorAll) return map;
            root.querySelectorAll('.token').forEach(el => {
                const color = getComputedStyle(el).color;
                if (!color) return;
                String(el.className).split(/\s+/).forEach(c => {
                    if (!c || c === 'token' || RESERVED_KEYS.indexOf(c) >= 0) return;
                    if (!TOKEN_CLS_OK.test(c) || c in map) return;
                    map[c] = color;
                });
            });
            return map;
        }

        // ---------- 组装合成 DOM（背景 / 卡片 / 窗口 chrome / 代码体） ----------
        function buildShotDom(pre, opts, theme) {
            const root = document.createElement('div');
            root.className = 'ds-shot-root';
            root.style.cssText = `display:inline-block;padding:${opts.padding}px;background:${bgCssOf(opts.bg)};`;

            const card = document.createElement('div');
            card.className = 'ds-shot-card';
            // position:relative 是必需的，不是装饰：
            // html2canvas@1.4.1 在分层渲染时，会把「未定位的 inline-block」元素的背景归到
            // 靠后的绘制分组，导致卡片底色排到子元素背景之后 —— 卡片底色会把 macOS 三点
            // 整块反盖掉（实测红点像素 424 → 0），且与代码长短无关。
            // 让卡片成为定位元素即可把它归入 positioned 分组，保证「先卡片底色、后子元素」，
            // 同时不改变任何布局与尺寸（实测节点盒与画布尺寸与修复前逐像素一致）。
            card.style.cssText = 'display:inline-block;min-width:300px;border-radius:12px;overflow:hidden;position:relative;'
                + `background:${theme.bg};`
                + (opts.shadow ? 'box-shadow:0 14px 36px rgba(0,0,0,.30),0 3px 10px rgba(0,0,0,.18);' : '');

            if (opts.window === 'macos') {
                const bar = document.createElement('div');
                bar.className = 'ds-shot-bar';
                bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px 16px;';
                ['#ff5f57', '#febc2e', '#28c840'].forEach(c => {
                    const dot = document.createElement('span');
                    dot.style.cssText = `width:12px;height:12px;border-radius:50%;display:block;background:${c};`;
                    bar.appendChild(dot);
                });
                card.appendChild(bar);
            }

            const body = document.createElement('div');
            body.className = 'ds-shot-body';
            body.appendChild(pre);
            card.appendChild(body);
            root.appendChild(card);
            return root;
        }

        // ---------- 组装样式（自建，不依赖官网规则） ----------
        // liveColors：由 harvestTokenColors() 在**原 DOM** 上采到的「类名 → 计算色」。
        // 只有「导出底色 == 页面当前底色」时才用它（完全还原官网观感）；
        // 跨主题时忽略，改用自建色板，否则浅色 token 会被搬到深色底上。
        function buildShotCss(opts, theme, liveColors) {
            const palette = Object.assign({}, theme);
            if (liveColors && (theme.name === 'dark') === isPageDark()) {
                Object.keys(liveColors).forEach(k => { palette[k] = liveColors[k]; });
            }
            const tokenRules = Object.keys(palette)
                .filter(k => RESERVED_KEYS.indexOf(k) === -1)
                .map(k => `.ds-shot-root .token.${k}{color:${palette[k]} !important;}`)
                .join('');
            const gutter = opts.lineNumbers ? `
                .ds-shot-root pre{counter-reset:ds-shot-line;}
                .ds-shot-root pre > span{counter-increment:ds-shot-line;}
                .ds-shot-root pre > span::before{
                    content:counter(ds-shot-line);display:inline-block;min-width:2.1em;padding-right:1em;
                    text-align:right;opacity:.4;
                }` : '';
            return `
                *{box-sizing:border-box;}
                html,body{margin:0;padding:0;}
                body{display:inline-block;}
                .ds-shot-root{display:inline-block;}
                .ds-shot-root pre{
                    margin:0;padding:16px;display:block;
                    font-family:${MONO_STACK};
                    font-size:${opts.fontSize}px;line-height:${opts.lineHeight}px;
                    color:${theme.text};background:transparent;
                    white-space:pre;overflow:visible;tab-size:4;
                }
                .ds-shot-root .token{color:${theme.text};}
                ${tokenRules}
                ${gutter}
            `;
        }

        // ---------- 渲染为 canvas（离屏 iframe 隔离，复用既有表格导出手法） ----------
        async function renderToCanvas(preEl, opts) {
            if (!window.html2canvas) throw new Error('html2canvas 未加载');
            const block = preEl.closest('.md-code-block') || preEl;
            // 采色必须发生在**原 DOM** 上：克隆体已脱离文档，getComputedStyle 取不到值
            const liveColors = harvestTokenColors(block);
            const cleanPre = cloneCodeBlockPre(block);
            if (!cleanPre) throw new Error('未找到代码内容');
            const theme = resolveTheme(opts);
            const css = buildShotCss(opts, theme, liveColors);
            const dom = buildShotDom(cleanPre, opts, theme);

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'position:fixed;left:-99999px;top:0;width:1400px;height:900px;border:0;';
            iframe.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${dom.outerHTML}</body></html>`;
            document.body.appendChild(iframe);
            try {
                await new Promise(resolve => { iframe.onload = resolve; setTimeout(resolve, 2000); });
                const doc = iframe.contentDocument;
                const node = doc && doc.querySelector('.ds-shot-root');
                if (!node) throw new Error('渲染节点缺失');
                return await window.html2canvas(node, { scale: opts.scale, backgroundColor: null, logging: false });
            } finally {
                setTimeout(() => iframe.remove(), 120);
            }
        }

        // ---------- 输出 ----------
        function canvasToBlob(canvas) {
            return new Promise(res => canvas.toBlob(res, 'image/png'));
        }
        function downloadBlob(blob, filename) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = filename;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 200);
        }
        const canCopyImage = () => !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
        function copyBlob(blob) {
            return navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
        }
        function makeFilename(lang) {
            const d = new Date();
            const p = (n) => String(n).padStart(2, '0');
            const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
            return `code-${lang || 'snippet'}-${ts}.png`;
        }

        // ---------- 弹窗 ----------
        let _activeModal = null;
        let _busy = false;

        function closeDialog() {
            if (_activeModal) {
                if (_activeModal._previewHost && _activeModal._previewHost.shadowRoot) _activeModal._previewHost.shadowRoot.innerHTML = '';
                _activeModal.remove();
                _activeModal = null;
            }
            document.removeEventListener('keydown', onDialogKeydown, true);
        }
        function onDialogKeydown(e) {
            if (e.key === 'Escape') { e.stopPropagation(); closeDialog(); }
        }

        function openDialog(preEl) {
            if (!codeExportEnabled) { showToast('代码块导出已关闭，请在「脚本设置 → 代码块外观」中开启'); return; }
            const block = preEl.closest('.md-code-block');
            if (!block) return;
            closeDialog();

            const lang = extractLang(block);
            const opts = Object.assign({}, DEFAULT_OPTS, loadPrefs());
            if (!opts.theme) opts.theme = document.body.classList.contains('dark') ? 'dark' : 'light';

            const modal = document.createElement('div');
            modal.className = 'ds-ci-modal';
            const dialog = document.createElement('div');
            dialog.className = 'ds-ci-dialog';

            // ----- 头部 -----
            const header = document.createElement('div');
            header.className = 'ds-ci-header';
            const title = document.createElement('h3');
            title.className = 'ds-ci-title';
            title.textContent = '导出代码为图片';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'ds-ci-close';
            closeBtn.setAttribute('aria-label', '关闭');
            closeBtn.textContent = '✕';
            closeBtn.addEventListener('click', closeDialog);
            header.appendChild(title);
            header.appendChild(closeBtn);

            // ----- 主体 -----
            const body = document.createElement('div');
            body.className = 'ds-ci-body';
            const previewWrap = document.createElement('div');
            previewWrap.className = 'ds-ci-preview-wrap';
            body.appendChild(previewWrap);

            const options = document.createElement('div');
            options.className = 'ds-ci-options';
            body.appendChild(options);

            // ----- 页脚 -----
            const footer = document.createElement('div');
            footer.className = 'ds-ci-footer';
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'ds-ci-btn';
            copyBtn.textContent = '复制图片';
            const dlBtn = document.createElement('button');
            dlBtn.type = 'button';
            dlBtn.className = 'ds-ci-btn primary';
            dlBtn.textContent = '下载 PNG';
            footer.appendChild(copyBtn);
            footer.appendChild(dlBtn);

            dialog.appendChild(header);
            dialog.appendChild(body);
            dialog.appendChild(footer);
            modal.appendChild(dialog);

            // ----- 选项控件辅助 -----
            const field = (labelText, controlEl, wide) => {
                const f = document.createElement('div');
                f.className = 'ds-ci-field' + (wide ? ' is-wide' : '');
                const l = document.createElement('div');
                l.className = 'ds-ci-label';
                l.textContent = labelText;
                f.appendChild(l);
                f.appendChild(controlEl);
                return f;
            };
            const seg = (items, current, onPick) => {
                const wrap = document.createElement('div');
                wrap.className = 'ds-ci-seg';
                items.forEach(it => {
                    const b = document.createElement('button');
                    b.type = 'button';
                    b.className = 'ds-ci-seg-btn' + (it.value === current ? ' is-active' : '');
                    b.textContent = it.label;
                    b.addEventListener('click', () => {
                        wrap.querySelectorAll('.ds-ci-seg-btn').forEach(x => x.classList.remove('is-active'));
                        b.classList.add('is-active');
                        onPick(it.value);
                    });
                    wrap.appendChild(b);
                });
                return wrap;
            };
            const slider = (min, max, step, value, unit, onInput) => {
                const wrap = document.createElement('div');
                wrap.className = 'ds-ci-range';
                const input = document.createElement('input');
                input.type = 'range';
                input.min = min; input.max = max; input.step = step; input.value = value;
                const val = document.createElement('span');
                val.className = 'ds-ci-range-val';
                val.textContent = value + (unit || '');
                input.addEventListener('input', () => { val.textContent = input.value + (unit || ''); onInput(Number(input.value)); });
                wrap.appendChild(input);
                wrap.appendChild(val);
                return wrap;
            };
            const toggle = (labelText, checked, onChange) => {
                const l = document.createElement('label');
                l.className = 'ds-ci-switch';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = !!checked;
                input.addEventListener('change', () => onChange(input.checked));
                const s = document.createElement('span');
                s.textContent = labelText;
                l.appendChild(input);
                l.appendChild(s);
                return l;
            };

            // ----- 选项（8 项） -----
            // 1) 背景（色板，整行）
            const swRow = document.createElement('div');
            swRow.className = 'ds-ci-sw-row';
            BG_PRESETS.forEach(p => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'ds-ci-sw' + (p.id === opts.bg ? ' is-active' : '') + (p.id === 'transparent' ? ' is-transparent' : '');
                b.title = p.label;
                b.setAttribute('aria-label', '背景：' + p.label);
                if (p.id !== 'transparent') b.style.background = p.css;
                b.addEventListener('click', () => {
                    swRow.querySelectorAll('.ds-ci-sw').forEach(x => x.classList.remove('is-active'));
                    b.classList.add('is-active');
                    opts.bg = p.id;
                    refreshPreview();
                });
                swRow.appendChild(b);
            });
            options.appendChild(field('背景', swRow, true));
            // 2) 窗口样式 / 8) 底色
            options.appendChild(field('窗口样式', seg(
                [{ value: 'macos', label: 'macOS 三点' }, { value: 'none', label: '无框' }],
                opts.window, v => { opts.window = v; refreshPreview(); }
            )));
            options.appendChild(field('代码底色', seg(
                [{ value: 'light', label: '浅色底' }, { value: 'dark', label: '深色底' }],
                opts.theme, v => { opts.theme = v; refreshPreview(); }
            )));
            // 3) 内边距 / 5) 字号
            options.appendChild(field('内边距', slider(16, 80, 2, opts.padding, 'px', v => { opts.padding = v; refreshPreview(); })));
            options.appendChild(field('字号', slider(12, 18, 1, opts.fontSize, 'px', v => { opts.fontSize = v; refreshPreview(); })));
            // 行高 / 7) 导出倍率
            options.appendChild(field('行高', slider(16, 30, 1, opts.lineHeight, 'px', v => { opts.lineHeight = v; refreshPreview(); })));
            options.appendChild(field('导出倍率', seg(
                [{ value: 1, label: '1x' }, { value: 2, label: '2x' }, { value: 3, label: '3x' }],
                opts.scale, v => { opts.scale = v; refreshPreview(); }
            )));
            // 4) 投影 / 6) 行号
            const toggles = document.createElement('div');
            toggles.className = 'ds-ci-toggles';
            toggles.appendChild(toggle('投影', opts.shadow, v => { opts.shadow = v; refreshPreview(); }));
            toggles.appendChild(toggle('行号', opts.lineNumbers, v => { opts.lineNumbers = v; refreshPreview(); }));
            options.appendChild(field('其他', toggles, true));

            // ----- 预览（Shadow DOM 隔离，与导出共用同一套样式） -----
            let previewTimer = null;
            function refreshPreview() {
                clearTimeout(previewTimer);
                previewTimer = setTimeout(() => {
                    try {
                        renderPreview(previewWrap, preEl, opts);
                        savePrefs(opts);
                    } catch (err) {
                        console.error('[代码导图] 预览失败:', err);
                    }
                }, 30);
            }
            function renderPreview(host, srcPre, o) {
                const theme = resolveTheme(o);
                const liveBlock = srcPre.closest('.md-code-block') || srcPre;
                const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
                shadow.innerHTML = '';
                const style = document.createElement('style');
                style.textContent = buildShotCss(o, theme, harvestTokenColors(liveBlock));
                const cleanPre = cloneCodeBlockPre(liveBlock);
                const dom = buildShotDom(cleanPre, o, theme);
                const wrap = document.createElement('div');
                wrap.style.cssText = 'display:inline-block;overflow:hidden;';
                wrap.appendChild(dom);
                shadow.appendChild(style);
                shadow.appendChild(wrap);
                requestAnimationFrame(() => {
                    const availW = Math.max(120, host.clientWidth - 36);
                    const w = dom.offsetWidth || 1;
                    const k = Math.min(1, availW / w);
                    dom.style.transformOrigin = 'top left';
                    dom.style.transform = `scale(${k})`;
                    wrap.style.width = Math.round(w * k) + 'px';
                    wrap.style.height = Math.round((dom.offsetHeight || 1) * k) + 'px';
                });
            }

            // ----- 导出动作 -----
            async function runExport(mode) {
                if (_busy) return;
                _busy = true;
                copyBtn.disabled = true;
                dlBtn.disabled = true;
                const oldText = dlBtn.textContent;
                dlBtn.textContent = '生成中…';
                try {
                    const canvas = await renderToCanvas(preEl, opts);
                    const blob = await canvasToBlob(canvas);
                    if (!blob) throw new Error('无法生成图片数据');
                    if (mode === 'copy') {
                        await copyBlob(blob);
                        showToast('图片已复制到剪贴板');
                    } else {
                        downloadBlob(blob, makeFilename(lang));
                        showToast('图片已下载');
                    }
                    closeDialog();
                } catch (err) {
                    console.error('[代码导图] 导出失败:', err);
                    showToast('导出失败：' + ((err && err.message) || '未知错误'));
                } finally {
                    _busy = false;
                    copyBtn.disabled = false;
                    dlBtn.disabled = false;
                    dlBtn.textContent = oldText;
                }
            }
            dlBtn.addEventListener('click', () => runExport('download'));
            copyBtn.addEventListener('click', () => runExport('copy'));
            if (!canCopyImage()) { copyBtn.disabled = true; copyBtn.title = '当前环境不支持复制图片'; }

            document.body.appendChild(modal);
            _activeModal = modal;
            _activeModal._previewHost = previewWrap;
            modal.addEventListener('click', (e) => { if (e.target === modal) closeDialog(); });
            document.addEventListener('keydown', onDialogKeydown, true);
            refreshPreview();
        }

        return { open: openDialog };
    })();

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
        applyCodeBlockBg(codeBgEnhance, codeBgLevel);
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