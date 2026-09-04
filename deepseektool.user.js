// ==UserScript==
// @name         DeepSeek 功能增强工具箱
// @namespace    https://github.com/Chuc-Jie/deepseektool
// @version      4.7.0
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
        panel.style.cssText = `
            background: #1a1a24; border-radius: 20px;
            box-shadow: 0 16px 40px rgba(0,0,0,0.35); width: 480px; max-width: 94%;
            font-family: system-ui, -apple-system, sans-serif;
            color: #e4e4e8; max-height: 82vh; overflow-y: auto;
        `;

        // 头部
        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:20px 24px 0 24px;';
        const closeX = document.createElement('button');
        closeX.textContent = '\u2715';
        closeX.style.cssText = 'background:none; border:none; color:rgba(255,255,255,0.4); font-size:22px; cursor:pointer; padding:4px 8px; line-height:1; border-radius:6px; transition:all 0.15s;';
        closeX.addEventListener('mouseenter', () => { closeX.style.background = 'rgba(255,255,255,0.08)'; closeX.style.color = 'rgba(255,255,255,0.8)'; });
        closeX.addEventListener('mouseleave', () => { closeX.style.background = 'none'; closeX.style.color = 'rgba(255,255,255,0.4)'; });
        closeX.addEventListener('click', () => overlay.remove());
        header.innerHTML = '<h2 style="margin:0; font-size:18px; font-weight:600;">\u2699\ufe0f 脚本设置</h2>';
        header.appendChild(closeX);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'padding:16px 24px;';

        // 代码块折叠
        body.appendChild(createCard('\uD83D\uDCE6 代码块折叠', [
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
        ]));

        // 表格优化导出
        body.appendChild(createCard('\uD83D\uDCCA 表格优化导出', [
            createToggle('表格导出按钮', '悬停表格显示 PNG / CSV 导出按钮', tableButtonsEnabled, checked => {
                tableButtonsEnabled = checked;
                GM_setValue(STORAGE_TABLE_BUTTONS_ENABLED, checked);
                toggleTableButtons(checked);
                showToast(`表格导出按钮已${checked ? '开启' : '关闭'}`);
            }),
            createToggle('持续显示导出按钮', '无需悬停，表格上的 📸 📄 📝 导出按钮始终可见（需上面的“表格导出按钮”开启才生效）', tableButtonsAlways, checked => {
                tableButtonsAlways = checked;
                GM_setValue(STORAGE_TABLE_BUTTONS_ALWAYS, checked);
                setTableButtonsAlways(checked);
                showToast(`导出按钮已改为${checked ? '常显' : '悬停显示'}`);
            }),
            createSelect('表格主题适配', '自动：半透明叠加色通用 \u00B7 双模式：浅色/深色各自优化', [
                { value: 'auto', label: '自动适应（透明叠加）' },
                { value: 'dual', label: '双模式（浅色 / 深色）' },
            ], tableThemeMode, value => {
                tableThemeMode = value;
                GM_setValue(STORAGE_TABLE_THEME_MODE, value);
                applyTableThemeClass(value);
                showToast(`表格主题已切换为${value === 'auto' ? '自动适应' : '双模式'}`);
            }),
            createSelect('表格列宽策略', '均分：等宽 \u00B7 自适应：按内容比例 \u00B7 均分+保护：等宽且不低于 80px', [
                { value: 'equal', label: '均分列宽' },
                { value: 'auto', label: '自适应（内容比例）' },
                { value: 'equal-minwidth', label: '均分 + 最小宽度保护' },
            ], tableWidthMode, value => {
                tableWidthMode = value;
                GM_setValue(STORAGE_TABLE_WIDTH_MODE, value);
                document.querySelectorAll('.ds-markdown table').forEach(t => applyTableStyles(t));
                showToast('列宽策略已切换');
            }),
        ]));

        // AI 思考过程折叠
        body.appendChild(createCard('\uD83E\uDDE0 AI 思考过程折叠', [
            createToggle('自动折叠思考区域', 'AI 开始思考后自动收起\u300C已思考\u300D过程', autoCollapseThinking, checked => {
                autoCollapseThinking = checked;
                GM_setValue(STORAGE_AUTO_COLLAPSE_THINKING, checked);
                reapplyThinkingSections();
                showToast(`自动折叠思考区域已${checked ? '开启' : '关闭'}`);
            }),
            createToggle('模拟点击折叠', '通过模拟点击箭头折叠（保持原生交互）', simulateClickThinking, checked => {
                simulateClickThinking = checked;
                GM_setValue(STORAGE_SIMULATE_CLICK_THINKING, checked);
                showToast(`模拟点击折叠已${checked ? '开启' : '关闭'}（新产生的思考生效）`);
            }),
        ]));

        // 宽屏模式
        body.appendChild(createCard('\uD83D\uDDA5\uFE0F 宽屏模式', [
            createToggle('启用宽屏布局', '消息区域扩展至全宽，减少左右留白', wideScreen, checked => {
                wideScreen = checked;
                GM_setValue(STORAGE_WIDE_SCREEN, checked);
                applyWideScreen(checked);
                showToast(`宽屏模式已${checked ? '开启' : '关闭'}`);
            }),
        ]));

        // 发送快捷键（Ctrl+Enter）/ 聊天增强
        body.appendChild(createCard('\u2328\uFE0F 聊天发送设置', [
            createToggle('Ctrl+Enter 发送', '改为 Ctrl+Enter 发送、原生 Enter 换行；关闭时恢复官方（Enter 发送 / Shift+Enter 换行）',
                ctrlEnterEnabled, checked => {
                    ctrlEnterEnabled = checked;
                    GM_setValue(STORAGE_CTRL_ENTER, checked);
                    if (!checked) showToast('已恢复 Enter 发送，Shift+Enter 换行');
                    else showToast('已开启 Ctrl+Enter 发送，Enter 换行');
                }),
        ]));

        // 侧边栏对话文件夹管理（并入自 waitadd 独立脚本）
        body.appendChild(createCard('\uD83D\uDCC1 对话文件夹管理', [
            createToggle('启用文件夹分组', '在左侧对话历史栏加入「文件夹」分组面板，可通过会话 ⋯ 菜单移入/移出；关闭即整体移除（含已应用的分组/标签）',
                folderManagerEnabled, checked => {
                    folderManagerEnabled = checked;
                    GM_setValue(STORAGE_FOLDER_MANAGER, checked);
                    folderEnabledChanged(checked);
                }),
        ]));

        panel.appendChild(body);

        // 底部
        const footer = document.createElement('div');
        footer.style.cssText = 'padding:0 24px 20px 24px;';
        footer.innerHTML = `
            <div class="ds-panel-footer">
                <button class="ds-panel-btn" id="ds-panel-close-btn">关闭面板</button>
                <span class="ds-panel-reset" id="ds-panel-reset">恢复默认设置</span>
            </div>
        `;
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
        panel.appendChild(footer);

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

    function createCard(title, children) {
        const card = document.createElement('div');
        card.className = 'ds-panel-card';
        const hd = document.createElement('div');
        hd.className = 'ds-panel-card-title';
        hd.textContent = title;
        card.appendChild(hd);
        children.forEach(c => card.appendChild(c));
        return card;
    }

    function createNumberSetting(labelText, description, unit, currentValue, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'ds-panel-control';
        wrap.innerHTML = `
            <div class="ds-panel-label">${labelText}</div>
            <div class="ds-panel-desc">${description}</div>
        `;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:8px; align-items:center;';
        const input = document.createElement('input');
        input.type = 'number'; input.value = currentValue; input.min = 0; input.step = 1;
        input.className = 'ds-panel-input';
        input.style.flex = '1';
        input.addEventListener('change', () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            input.value = val;
            onChange(val);
        });
        row.appendChild(input);
        if (unit) {
            const u = document.createElement('span');
            u.style.cssText = 'font-size:13px; opacity:0.5; flex-shrink:0;';
            u.textContent = unit;
            row.appendChild(u);
        }
        wrap.appendChild(row);
        return wrap;
    }

    function createToggle(labelText, description, checked, onToggle) {
        const wrap = document.createElement('div');
        wrap.className = 'ds-panel-control';
        const label = document.createElement('label');
        label.className = 'ds-toggle';
        label.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
        label.innerHTML = `
            <div>
                <div class="ds-panel-label" style="margin-bottom:2px;">${labelText}</div>
                <div class="ds-panel-desc" style="margin-bottom:0;">${description}</div>
            </div>
        `;
        const input = document.createElement('input');
        input.type = 'checkbox';
        if (checked) input.checked = true;
        const track = document.createElement('span');
        track.className = 'ds-toggle-track';
        track.style.position = 'relative';
        track.innerHTML = '<span class="ds-toggle-thumb"></span>';
        label.appendChild(input);
        label.appendChild(track);
        input.addEventListener('change', () => onToggle(input.checked));
        wrap.appendChild(label);
        return wrap;
    }

    function createSelect(labelText, description, options, selectedValue, onChange) {
        const wrap = document.createElement('div');
        wrap.className = 'ds-panel-control';
        wrap.innerHTML = `
            <div class="ds-panel-label">${labelText}</div>
            <div class="ds-panel-desc">${description}</div>
        `;

        const container = document.createElement('div');
        container.className = 'ds-custom-select';

        const trigger = document.createElement('button');
        trigger.className = 'ds-custom-select-trigger';
        trigger.type = 'button';

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
        wrap.appendChild(container);
        return wrap;
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
    GM_registerMenuCommand('⚙️ 脚本设置', openControlPanel);

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

        /* 控制面板 — Toggle 开关 */
        .ds-toggle { position: relative; display: inline-flex; align-items: center; cursor: pointer; user-select: none; }
        .ds-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
        .ds-toggle-track {
            width: 44px; height: 24px; border-radius: 12px;
            background: rgba(128,128,128,0.3); transition: background 0.2s;
            flex-shrink: 0;
        }
        .ds-toggle input:checked + .ds-toggle-track { background: #4f46e5; }
        .ds-toggle-thumb {
            position: absolute; top: 2px; left: 2px; width: 20px; height: 20px;
            border-radius: 50%; background: white; transition: transform 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .ds-toggle input:checked + .ds-toggle-track .ds-toggle-thumb { transform: translateX(20px); }
        .ds-toggle input:focus-visible + .ds-toggle-track { outline: 2px solid #4f46e5; outline-offset: 2px; }

        /* 控制面板 — 卡片分区 */
        .ds-panel-card {
            background: rgba(128,128,128,0.06); border-radius: 12px;
            padding: 16px; margin-bottom: 12px;
        }
        .ds-panel-card-title {
            font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
            text-transform: uppercase; opacity: 0.5; margin-bottom: 12px;
        }
        .ds-panel-control {
            margin-bottom: 14px;
        }
        .ds-panel-control:last-child { margin-bottom: 0; }
        .ds-panel-label {
            font-size: 14px; font-weight: 500; margin-bottom: 4px;
            display: flex; align-items: center; gap: 8px;
        }
        .ds-panel-desc {
            font-size: 12px; opacity: 0.55; margin-bottom: 8px; line-height: 1.5;
        }
        .ds-panel-input {
            width: 100%; padding: 8px 12px; border-radius: 8px;
            border: 1px solid rgba(128,128,128,0.25);
            background: rgba(128,128,128,0.08); color: inherit;
            font-size: 14px; box-sizing: border-box; outline: none;
            transition: border-color 0.2s;
        }
        .ds-panel-input:focus { border-color: #4f46e5; }
        select.ds-panel-input { cursor: pointer; -webkit-appearance: none; appearance: none;
            background-color: rgba(128,128,128,0.08);
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23aaa' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat; background-position: right 10px center;
            padding-right: 28px;
        }
        /* 自定义下拉面板 */
        .ds-custom-select { position: relative; }
        .ds-custom-select-trigger {
            width: 100%; padding: 8px 28px 8px 12px; border-radius: 8px;
            border: 1px solid rgba(128,128,128,0.25); font-size: 14px;
            background: rgba(128,128,128,0.08); color: inherit; cursor: pointer;
            box-sizing: border-box; outline: none; transition: border-color 0.2s;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23aaa' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat; background-position: right 10px center;
            -webkit-appearance: none; appearance: none;
        }
        .ds-custom-select-trigger:focus { border-color: #4f46e5; }
        .ds-custom-select-dropdown {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 10002;
            background: #1e1e2d; border: 1px solid rgba(128,128,128,0.25);
            border-radius: 8px; margin-top: 4px; overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            max-height: 200px; overflow-y: auto;
        }
        .ds-custom-select-option {
            padding: 10px 12px; font-size: 14px; cursor: pointer; color: #e4e4e8;
            transition: background 0.1s;
        }
        .ds-custom-select-option:hover { background: rgba(128,128,128,0.12); }
        .ds-custom-select-option.active { background: rgba(255,255,255,0.08); }
        .ds-panel-footer { border-top: 1px solid rgba(128,128,128,0.15); padding-top: 12px; margin-top: 4px; }
        .ds-panel-btn {
            width: 100%; padding: 10px; border: none; border-radius: 10px;
            background: #4f46e5; color: white; font-size: 15px; font-weight: 500;
            cursor: pointer; transition: background 0.2s;
        }
        .ds-panel-btn:hover { background: #6366f1; }
        .ds-panel-reset {
            display: block; text-align: center; font-size: 12px; opacity: 0.4;
            cursor: pointer; margin-top: 8px; transition: opacity 0.2s;
        }
        .ds-panel-reset:hover { opacity: 0.7; }

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

        const pngBtn = document.createElement('button');
        pngBtn.className = 'internal-export-btn'; pngBtn.innerHTML = '📸';
        pngBtn.setAttribute('data-tooltip', '导出为 PNG');
        pngBtn.addEventListener('click', e => { e.stopPropagation(); exportTableAsPNG(table); });

        const csvBtn = document.createElement('button');
        csvBtn.className = 'internal-export-btn'; csvBtn.innerHTML = '📄';
        csvBtn.setAttribute('data-tooltip', '导出为 CSV');
        csvBtn.addEventListener('click', e => { e.stopPropagation(); exportTableAsCSV(table); });

        const mdBtn = document.createElement('button');
        mdBtn.className = 'internal-export-btn'; mdBtn.innerHTML = '📝';
        mdBtn.setAttribute('data-tooltip', '导出为 Markdown');
        mdBtn.addEventListener('click', e => { e.stopPropagation(); exportTableAsMD(table); });

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
            margin:2px 0 4px; padding:6px 8px 8px 0;
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
            const link = document.querySelector('a[href^="/a/chat/s/"]');
            if (!link) return null;
            let el = link.parentElement;
            while (el) {
                const cs = getComputedStyle(el);
                if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') return el;
                el = el.parentElement;
            }
            return null;
        }
        function ensurePanel() {
            applyTheme();
            if (document.getElementById('dsFolderPanel')) return;
            const panel = document.createElement('div');
            panel.id = 'dsFolderPanel';
            panel.innerHTML = `
                <div class="dsfh">
                    <span class="dsHeadTitle" title="${data.collapsed ? '展开全部' : '折叠全部'}" role="button" tabindex="0">
                        <svg class="dsHeadCaret" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg><b>文件夹</b>
                    </span>
                    <button class="dsNew" title="新建文件夹">＋ 新建</button>
                </div>
                <div class="dsList"></div>`;
            setCollapsedUI();
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
            const sc = findScrollContainer();
            if (sc) {
                const titleRow = [...sc.querySelectorAll('div')].find((d) => {
                    const cs = getComputedStyle(d);
                    return cs.position === 'sticky' && d.clientHeight > 0 && d.clientHeight < 60;
                });
                if (titleRow && titleRow.parentElement) {
                    titleRow.insertAdjacentElement('afterend', panel);
                } else {
                    sc.insertBefore(panel, sc.firstChild); // 兜底
                }
            } else {
                const btn = findNewChatBtn();  // 无会话链接时降级常驻顶部
                if (!btn) return;
                btn.insertAdjacentElement('afterend', panel);
            }
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
                    <button class="dsCaret" title="${isExpanded(f.id) ? '收起' : '展开'}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3.2 6.2A1.7 1.7 0 0 1 4.9 4.5h4.6l2 2.2h7.6a1.7 1.7 0 0 1 1.7 1.7v9.6a1.7 1.7 0 0 1-1.7 1.7H4.9a1.7 1.7 0 0 1-1.7-1.7V6.2Z"/></svg></button>
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