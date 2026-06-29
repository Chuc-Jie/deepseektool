// ==UserScript==
// @name         DeepSeek 功能增强工具箱
// @namespace    https://github.com/Chuc-Jie/deepseektool
// @version      4.5.0
// @description  一站式管理：代码块折叠、表格优化导出、自动折叠AI思考过程。所有设置即时生效，选择器全面加固。
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
    const STORAGE_AUTO_COLLAPSE_THINKING = 'deepseek_auto_collapse_thinking';
    const STORAGE_SIMULATE_CLICK_THINKING = 'deepseek_simulate_click_thinking';
    const STORAGE_TABLE_THEME_MODE = 'deepseek_table_theme_mode';
    const STORAGE_TABLE_WIDTH_MODE = 'deepseek_table_width_mode';
    const STORAGE_WIDE_SCREEN = 'deepseek_wide_screen';

    let foldThreshold = GM_getValue(STORAGE_FOLD_THRESHOLD, 20);
    let previewLines = GM_getValue(STORAGE_PREVIEW_LINES, 0);
    let enablePreviewLines = previewLines > 0;
    let tableButtonsEnabled = GM_getValue(STORAGE_TABLE_BUTTONS_ENABLED, true);
    let autoCollapseThinking = GM_getValue(STORAGE_AUTO_COLLAPSE_THINKING, true);
    let simulateClickThinking = GM_getValue(STORAGE_SIMULATE_CLICK_THINKING, true);
    let tableThemeMode = GM_getValue(STORAGE_TABLE_THEME_MODE, 'auto');
    let tableWidthMode = GM_getValue(STORAGE_TABLE_WIDTH_MODE, 'equal');
    let wideScreen = GM_getValue(STORAGE_WIDE_SCREEN, false);

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
    }

    async function exportTableAsPNG(table) {
        if (!window.html2canvas) { alert('html2canvas 未加载'); return; }
        let iframe = null;
        try {
            // 克隆表格（深拷贝，避免污染页面 DOM）
            const clone = table.cloneNode(true);
            // 移除导出按钮，避免出现在截图中
            const btns = clone.querySelector('.table-internal-buttons');
            if (btns) btns.remove();
            // 移除脚本注入的自定义属性
            clone.removeAttribute('data-internal-buttons-added');

            // 清洗 applyTableStyles 注入的内联样式，使 iframe 中表格回归 auto 布局
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
                scale: 2,
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
            body { background: ${bodyBg}; }
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
        const rows = [];
        const thead = table.querySelector('thead');
        if (thead) thead.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('th').forEach(th => rd.push(getCellText(th)));
            if (rd.length) rows.push(rd);
        });
        const tbody = table.querySelector('tbody');
        if (tbody) tbody.querySelectorAll('tr').forEach(tr => {
            const rd = []; tr.querySelectorAll('td').forEach(td => rd.push(getCellText(td)));
            if (rd.length) rows.push(rd);
        });
        else table.querySelectorAll('tr').forEach(tr => {
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

        bc.appendChild(pngBtn); bc.appendChild(csvBtn);
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

    // ==================== 统一 DOM 监听（合并三个 observer，添加节流） ====================
    let _domObserver = null;
    function observeDOM() {
        if (_domObserver) return;
        _domObserver = new MutationObserver(mutations => {
            let hasNewCodeBlocks = false;
            let hasNewTables = false;
            let hasNewThinking = false;

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
                }
            }

            if (hasNewCodeBlocks) {
                document.querySelectorAll('pre').forEach(pre => {
                    if (!pre.hasAttribute(processedAttr)) addFoldButtonToCodeBlock(pre);
                });
            }
            if (hasNewTables) scheduleTableProcess();
            if (hasNewThinking) setTimeout(processAllThinkingSections, 150);
        });
        _domObserver.observe(document.body, { childList: true, subtree: true });
    }

    // ==================== 初始化 ====================
    function init() {
        applyTableThemeClass(tableThemeMode);
        applyWideScreen(wideScreen);
        cleanupLegacyWrappers();
        deduplicateButtons();
        processAllExistingCodeBlocks();
        processAllTables();
        if (autoCollapseThinking) {
            setupThinkContentHiding();
            processAllThinkingSections();
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