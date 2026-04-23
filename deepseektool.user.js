// ==UserScript==
// @name         DeepSeek 功能增强工具箱
// @namespace    https://github.com/yourname/deepseek-tools
// @version      4.0.0
// @description  一站式管理：代码块折叠、表格优化导出、用户消息折叠、自动折叠AI思考过程。所有设置即时生效。
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
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 存储键与全局变量 ====================
    const STORAGE_FOLD_THRESHOLD = 'deepseek_fold_threshold';
    const STORAGE_PREVIEW_LINES = 'deepseek_fold_preview_lines';
    const STORAGE_TABLE_BUTTONS_ENABLED = 'deepseek_table_buttons_enabled';
    const STORAGE_USER_MSG_THRESHOLD = 'deepseek_user_msg_threshold';
    const STORAGE_AUTO_COLLAPSE_THINKING = 'deepseek_auto_collapse_thinking';
    const STORAGE_SIMULATE_CLICK_THINKING = 'deepseek_simulate_click_thinking';

    let foldThreshold = GM_getValue(STORAGE_FOLD_THRESHOLD, 20);
    let previewLines = GM_getValue(STORAGE_PREVIEW_LINES, 0);
    let enablePreviewLines = previewLines > 0;
    let tableButtonsEnabled = GM_getValue(STORAGE_TABLE_BUTTONS_ENABLED, true);
    let userMsgThreshold = GM_getValue(STORAGE_USER_MSG_THRESHOLD, 100);
    let autoCollapseThinking = GM_getValue(STORAGE_AUTO_COLLAPSE_THINKING, true);
    let simulateClickThinking = GM_getValue(STORAGE_SIMULATE_CLICK_THINKING, true);

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
            background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
            z-index: 10001; display: flex; align-items: center; justify-content: center;
        `;

        const panel = document.createElement('div');
        panel.style.cssText = `
            background: var(--ds-bg-primary, #1e1e2f); border-radius: 16px;
            box-shadow: 0 12px 32px rgba(0,0,0,0.3); width: 440px; max-width: 90%;
            padding: 28px; font-family: system-ui, -apple-system, sans-serif;
            color: var(--ds-text-primary, #e2e2e2); max-height: 80vh; overflow-y: auto;
        `;

        // 标题
        const title = document.createElement('h2');
        title.textContent = '⚙️ DeepSeek 全功能增强设置';
        title.style.cssText = 'margin:0 0 24px 0; font-size:20px; font-weight:600;';

        // --- 代码块折叠部分 ---
        const codeSectionTitle = createSectionTitle('📝 代码块折叠');
        panel.appendChild(codeSectionTitle);

        panel.appendChild(createNumberSetting(
            '自动折叠阈值', '代码块行数超过该值时自动折叠（0 = 禁用）',
            foldThreshold, value => {
                foldThreshold = value;
                GM_setValue(STORAGE_FOLD_THRESHOLD, value);
                reapplyFoldToAllCodeBlocks();
                showToast(`折叠阈值已更新为 ${value === 0 ? '关闭' : value}`);
            }
        ));

        panel.appendChild(createNumberSetting(
            '折叠预览行数', '折叠后显示的行数（0 = 完全隐藏）',
            previewLines, value => {
                previewLines = value;
                enablePreviewLines = value > 0;
                GM_setValue(STORAGE_PREVIEW_LINES, value);
                reapplyFoldToAllCodeBlocks();
                showToast(`预览行数已更新为 ${value === 0 ? '关闭（完全隐藏）' : value}`);
            }
        ));

        // --- 表格优化部分 ---
        const tableSectionTitle = createSectionTitle('📊 表格优化导出');
        panel.appendChild(tableSectionTitle);

        const switchLabel1 = document.createElement('label');
        switchLabel1.style.cssText = 'display:flex; align-items:center; gap:12px; cursor:pointer; margin-bottom: 24px;';
        switchLabel1.innerHTML = `
            <span style="font-size:15px; font-weight:500;">表格导出按钮</span>
            <input type="checkbox" id="ds-table-switch" ${tableButtonsEnabled ? 'checked' : ''}
                style="width:18px; height:18px; accent-color:#0f6e4a; cursor:pointer;">
            <span style="font-size:13px; opacity:0.7;">悬停表格显示 PNG/CSV 导出按钮</span>
        `;
        panel.appendChild(switchLabel1);
        const tableSwitch = switchLabel1.querySelector('input');
        tableSwitch.addEventListener('change', () => {
            tableButtonsEnabled = tableSwitch.checked;
            GM_setValue(STORAGE_TABLE_BUTTONS_ENABLED, tableButtonsEnabled);
            toggleTableButtons(tableButtonsEnabled);
            showToast(`表格导出按钮已${tableButtonsEnabled ? '开启' : '关闭'}`);
        });

        // --- 用户消息折叠部分 ---
        const msgSectionTitle = createSectionTitle('💬 用户消息折叠');
        panel.appendChild(msgSectionTitle);

        panel.appendChild(createNumberSetting(
            '折叠阈值 (字符)', '用户消息超过该字符数时自动折叠（0 = 禁用）',
            userMsgThreshold, value => {
                userMsgThreshold = value;
                GM_setValue(STORAGE_USER_MSG_THRESHOLD, value);
                reapplyUserMessages();
                showToast(`用户消息折叠阈值已更新为 ${value === 0 ? '关闭' : value}`);
            }
        ));

        // --- AI思考区域自动折叠 ---
        const thinkSectionTitle = createSectionTitle('🧠 AI思考过程折叠');
        panel.appendChild(thinkSectionTitle);

        const switchLabel2 = document.createElement('label');
        switchLabel2.style.cssText = 'display:flex; align-items:center; gap:12px; cursor:pointer; margin-bottom: 12px;';
        switchLabel2.innerHTML = `
            <span style="font-size:15px; font-weight:500;">自动折叠思考区域</span>
            <input type="checkbox" id="ds-auto-think-switch" ${autoCollapseThinking ? 'checked' : ''}
                style="width:18px; height:18px; accent-color:#0f6e4a; cursor:pointer;">
            <span style="font-size:13px; opacity:0.7;">AI开始思考后自动收起“已思考”过程</span>
        `;
        panel.appendChild(switchLabel2);
        const thinkSwitch = switchLabel2.querySelector('input');
        thinkSwitch.addEventListener('change', () => {
            autoCollapseThinking = thinkSwitch.checked;
            GM_setValue(STORAGE_AUTO_COLLAPSE_THINKING, autoCollapseThinking);
            reapplyThinkingSections();
            showToast(`自动折叠思考区域已${autoCollapseThinking ? '开启' : '关闭'}`);
        });

        const switchLabel3 = document.createElement('label');
        switchLabel3.style.cssText = 'display:flex; align-items:center; gap:12px; cursor:pointer; margin-bottom: 24px;';
        switchLabel3.innerHTML = `
            <span style="font-size:15px; font-weight:500;">模拟点击折叠</span>
            <input type="checkbox" id="ds-simulate-switch" ${simulateClickThinking ? 'checked' : ''}
                style="width:18px; height:18px; accent-color:#0f6e4a; cursor:pointer;">
            <span style="font-size:13px; opacity:0.7;">通过模拟点击箭头折叠（保持原生交互）</span>
        `;
        panel.appendChild(switchLabel3);
        const simulateSwitch = switchLabel3.querySelector('input');
        simulateSwitch.addEventListener('change', () => {
            simulateClickThinking = simulateSwitch.checked;
            GM_setValue(STORAGE_SIMULATE_CLICK_THINKING, simulateClickThinking);
            showToast(`模拟点击折叠已${simulateClickThinking ? '开启' : '关闭'}（新产生的思考生效）`);
        });

        // 关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭面板';
        closeBtn.style.cssText = `
            width:100%; padding:10px; border:none; border-radius:10px;
            background:#0f6e4a; color:white; font-size:15px; cursor:pointer;
            transition: background 0.2s;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.background = '#0a5a3c';
        closeBtn.onmouseleave = () => closeBtn.style.background = '#0f6e4a';
        closeBtn.addEventListener('click', () => overlay.remove());

        panel.appendChild(closeBtn);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    }

    function createSectionTitle(text) {
        const el = document.createElement('h3');
        el.textContent = text;
        el.style.cssText = 'margin: 24px 0 12px 0; font-size:16px; font-weight:600; border-top: 1px solid rgba(128,128,128,0.2); padding-top: 12px;';
        return el;
    }

    function createNumberSetting(labelText, description, currentValue, onChange) {
        const section = document.createElement('div');
        section.style.marginBottom = '16px';

        const label = document.createElement('div');
        label.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;';
        label.innerHTML = `<span style="font-size:15px; font-weight:500;">${labelText}</span>`;

        const desc = document.createElement('div');
        desc.textContent = description;
        desc.style.cssText = 'font-size:13px; opacity:0.7; margin-bottom:8px; line-height:1.4;';

        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.min = 0;
        input.step = 1;
        input.style.cssText = `
            width:100%; padding:10px 12px; border-radius:8px;
            border:1px solid rgba(128,128,128,0.3);
            background: var(--ds-bg-secondary, #2a2a36);
            color: var(--ds-text-primary, #e2e2e2);
            font-size:14px; box-sizing:border-box; outline:none;
            transition: border-color 0.2s;
        `;
        input.onfocus = () => input.style.borderColor = 'rgba(128,128,128,0.6)';
        input.onblur = () => input.style.borderColor = 'rgba(128,128,128,0.3)';
        input.addEventListener('change', () => {
            let val = parseInt(input.value, 10);
            if (isNaN(val) || val < 0) val = 0;
            input.value = val;
            onChange(val);
        });

        section.appendChild(label);
        section.appendChild(desc);
        section.appendChild(input);
        return section;
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

    function reapplyUserMessages() {
        document.querySelectorAll('.fbb737a4[data-collapse-processed]').forEach(msg => {
            // 移除折叠标记和相关DOM结构
            const wrapper = msg.closest('.user-message-wrapper');
            if (wrapper) {
                const btn = wrapper.querySelector('.user-message-toggle');
                if (btn) btn.remove();
                const originalParent = wrapper.parentNode;
                if (originalParent) {
                    originalParent.insertBefore(msg, wrapper);
                    wrapper.remove();
                }
            }
            msg.removeAttribute('data-collapse-processed');
            msg.classList.remove('user-message-collapsible', 'expanded');
        });
        processAllUserMessages();
    }

    function reapplyThinkingSections() {
        // 如果关闭自动折叠，我们无法自动展开已折叠的思考区域，但可以允许新产生的思考区域不再折叠
        // 如果开启，则立即对现有所有思考区域进行折叠（未折叠过的）
        if (autoCollapseThinking) {
            processAllThinkingSections();
        }
    }

    // ==================== 菜单命令 ====================
    GM_registerMenuCommand('⚙️ 脚本设置', openControlPanel);

    // ==================== 全局样式（包含代码块、表格、用户消息折叠） ====================
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
        .efa13877 .ds-fold-btn { margin-left: 4px; }
        .ds-fold-preview::after { content: " ..."; display: block; text-align: center; color: inherit; opacity: 0.6; margin-top: 4px; }

        /* 表格样式 */
        .ds-markdown table {
            width: 100% !important; border-collapse: separate !important;
            border-spacing: 0 !important; margin: 1em 0 !important;
            background-color: var(--ds-bg-primary, #ffffff) !important;
            border-radius: 12px !important; overflow: hidden !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important; position: relative;
        }
        .ds-markdown th, .ds-markdown td {
            border: 1px solid #e5e7eb !important; padding: 12px 16px !important;
            vertical-align: top !important; font-size: 14px !important; line-height: 1.5 !important;
        }
        .ds-markdown th {
            background: linear-gradient(135deg, #f9fafb, #f3f4f6) !important;
            font-weight: 600 !important; color: #1f2937 !important;
            border-bottom: 1px solid #e5e7eb !important; letter-spacing: 0.02em !important;
        }
        .ds-markdown tbody tr:nth-child(even) { background-color: #fafafa !important; }
        .ds-markdown tbody tr:hover { background-color: #eff6ff !important; transition: background-color 0.2s !important; }

        .table-internal-buttons {
            position: absolute; bottom: 12px; right: 12px;
            display: flex; flex-direction: column; gap: 8px; z-index: 10;
            opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s;
            pointer-events: none;
        }
        .ds-markdown table:hover .table-internal-buttons,
        .table-internal-buttons:hover { opacity: 1; visibility: visible; pointer-events: auto; }
        .internal-export-btn {
            width: 32px; height: 32px; background: rgba(255,255,255,0.95);
            backdrop-filter: blur(4px); border: 1px solid #e2e8f0; border-radius: 8px;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: all 0.2s; font-size: 16px;
            position: relative;
        }
        .internal-export-btn:hover { background: #fff; transform: scale(1.05); box-shadow: 0 4px 10px rgba(0,0,0,0.15); border-color: #cbd5e1; }
        .internal-export-btn:active { transform: scale(0.98); }
        .internal-export-btn::after {
            content: attr(data-tooltip); position: absolute; right: 40px; top: 50%;
            transform: translateY(-50%); background: #1f2937; color: white;
            font-size: 12px; padding: 4px 8px; border-radius: 6px;
            white-space: nowrap; opacity: 0; visibility: hidden; transition: 0.1s;
            pointer-events: none;
        }
        .internal-export-btn:hover::after { opacity: 1; visibility: visible; }

        /* 用户消息折叠 */
        .user-message-collapsible {
            position: relative; max-height: 200px; overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .user-message-collapsible.expanded { max-height: none; }
        .user-message-collapsible:not(.expanded)::after {
            content: ''; position: absolute; bottom: 0; left: 0; right: 0;
            height: 60px; background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.95));
            pointer-events: none; border-radius: 0 0 12px 12px;
        }
        .dark .user-message-collapsible:not(.expanded)::after {
            background: linear-gradient(to bottom, transparent, rgba(30,30,35,0.95));
        }
        .user-message-toggle {
            display: block; margin: 8px 0 4px 0; padding: 6px 16px;
            background-color: #e8e8e8; border: none; border-radius: 20px;
            font-size: 12px; color: #333; cursor: pointer;
            transition: background-color 0.2s; text-align: center;
        }
        .user-message-toggle:hover { background-color: #d0d0d0; }
        .dark .user-message-toggle { background-color: #2a2a2a; color: #e0e0e0; }
        .dark .user-message-toggle:hover { background-color: #3a3a3a; }
        .user-message-wrapper { margin-bottom: 16px; }
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
        let parent = preEl.closest('.md-code-block');
        if (!parent) return null;
        return parent.querySelector('.efa13877') ||
               parent.querySelector('[class*="button-group"], [class*="actions"], [class*="buttons"]') || null;
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
        document.querySelectorAll('.efa13877').forEach(container => {
            const btns = container.querySelectorAll('.ds-fold-btn');
            if (btns.length > 1) for (let i = 1; i < btns.length; i++) btns[i].remove();
        });
    }

    function observeCodeBlocks() {
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                if (m.type === 'childList' && m.addedNodes.length) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && node.matches('pre')) addFoldButtonToCodeBlock(node);
                            if (node.querySelectorAll) node.querySelectorAll('pre').forEach(addFoldButtonToCodeBlock);
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ==================== 表格优化逻辑 ====================
    function applyTableStyles(table) {
        const vc = document.querySelector('.ds-virtual-list-visible-items');
        if (vc) {
            table.style.maxWidth = vc.clientWidth + 'px';
            vc.style.overflowX = 'visible';
            vc.style.maxWidth = '100%';
        } else {
            table.style.maxWidth = '100%';
        }
        table.style.width = '100%';
        table.style.tableLayout = 'fixed';
        if (getComputedStyle(table).position !== 'relative') table.style.position = 'relative';

        table.querySelectorAll('th,td').forEach(cell => {
            cell.style.whiteSpace = 'normal';
            cell.style.wordWrap = 'break-word';
            cell.style.overflowWrap = 'break-word';
            cell.style.wordBreak = 'break-word';
        });

        const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
        if (headerRow && headerRow.cells.length) {
            const per = (100 / headerRow.cells.length).toFixed(2) + '%';
            for (let i = 0; i < headerRow.cells.length; i++) headerRow.cells[i].style.width = per;
        }

        let parent = table.parentElement;
        while (parent && parent !== document.body) {
            const comp = window.getComputedStyle(parent);
            if (comp.overflowX === 'auto' || comp.overflowX === 'scroll') parent.style.overflowX = 'visible';
            if (parent.style.maxWidth && parent.style.maxWidth !== 'none') parent.style.maxWidth = '100%';
            parent = parent.parentElement;
        }
    }

    async function exportTableAsPNG(table) {
        if (!window.html2canvas) { alert('html2canvas 未加载'); return; }
        try {
            const bc = table.querySelector('.table-internal-buttons');
            let orig = null;
            if (bc) { orig = bc.style.display; bc.style.display = 'none'; }
            const canvas = await html2canvas(table, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: false });
            if (bc) bc.style.display = orig;
            const a = document.createElement('a');
            a.download = `table_${Date.now()}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        } catch (e) { console.error(e); alert('导出PNG失败'); }
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
        return t.replace(/\s+/g,' ').trim();
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

    function processAllTables() {
        document.querySelectorAll('.ds-markdown').forEach(container => {
            container.style.overflowX = 'visible';
            container.style.maxWidth = '100%';
            container.querySelectorAll('table').forEach(table => {
                applyTableStyles(table);
                addButtonsToTable(table);
            });
        });
    }

    function observeTables() {
        const observer = new MutationObserver(() => processAllTables());
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('load', processAllTables);
        window.addEventListener('resize', () => {
            clearTimeout(window._resizeFix);
            window._resizeFix = setTimeout(processAllTables, 100);
        });
        processAllTables();
    }

    // ==================== 用户消息折叠逻辑 ====================
    function isUserMessage(el) {
        return el.classList && el.classList.contains('fbb737a4');
    }

    function getMessageText(el) {
        return el.innerText || el.textContent || '';
    }

    function addCollapseToMessage(msgDiv) {
        if (msgDiv.hasAttribute('data-collapse-processed')) return;
        const text = getMessageText(msgDiv);
        if (userMsgThreshold === 0 || text.length < userMsgThreshold) return;

        msgDiv.setAttribute('data-collapse-processed', 'true');
        const parent = msgDiv.parentNode;
        if (!parent) return;

        let wrapper = msgDiv.parentElement;
        if (!wrapper.classList.contains('user-message-wrapper')) {
            wrapper = document.createElement('div');
            wrapper.className = 'user-message-wrapper';
            parent.insertBefore(wrapper, msgDiv);
            wrapper.appendChild(msgDiv);
        }

        msgDiv.classList.add('user-message-collapsible');
        if (wrapper.querySelector('.user-message-toggle')) return;

        const btn = document.createElement('button');
        btn.className = 'user-message-toggle';
        btn.textContent = '▼ 展开全文';
        let expanded = false;
        btn.addEventListener('click', e => {
            e.stopPropagation();
            if (expanded) {
                msgDiv.classList.remove('expanded');
                btn.textContent = '▼ 展开全文';
                expanded = false;
            } else {
                msgDiv.classList.add('expanded');
                btn.textContent = '▲ 收起';
                expanded = true;
            }
        });
        wrapper.appendChild(btn);
    }

    function processAllUserMessages() {
        document.querySelectorAll('.fbb737a4').forEach(addCollapseToMessage);
    }

    // ==================== AI思考区域自动折叠逻辑 ====================
    function collapseThinkingSection(container) {
        if (!autoCollapseThinking || container.hasAttribute('data-thinking-collapsed')) return;
        if (!simulateClickThinking) return;

        let clickableArrow = null;
        const icons = container.querySelectorAll('.ds-icon');
        if (icons.length >= 2) clickableArrow = icons[icons.length-1];
        else if (icons.length === 1) clickableArrow = icons[0];
        if (!clickableArrow) {
            const svg = container.querySelector('svg');
            if (svg && svg.parentElement) clickableArrow = svg.parentElement;
        }
        if (clickableArrow && typeof clickableArrow.click === 'function') {
            container.setAttribute('data-thinking-collapsed', 'true');
            setTimeout(() => clickableArrow.click(), 100);
        }
    }

    function processAllThinkingSections() {
        if (!autoCollapseThinking) return;
        // 查找包含“已思考”文本的 span
        const spans = document.querySelectorAll('span[class*="5255ff8"], span[class*="4d41763"]');
        spans.forEach(span => {
            if (span.textContent && span.textContent.includes('已思考')) {
                let container = span.closest('div[class*="_5ab5d64"]') || span.parentElement;
                if (container) collapseThinkingSection(container);
            }
        });
        // 备用：文本节点直接包含“已思考”
        document.querySelectorAll('*').forEach(el => {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE && el.textContent.includes('已思考')) {
                if (!el.hasAttribute('data-thinking-processed')) {
                    let container = el.closest('div[class*="_5ab5d64"]') || el.parentElement;
                    if (container) collapseThinkingSection(container);
                    el.setAttribute('data-thinking-processed', 'true');
                }
            }
        });
    }

    // ==================== 统一 DOM 监听 ====================
    function observeDynamicContent() {
        const observer = new MutationObserver(mutations => {
            let needUser = false, needThink = false;
            for (const m of mutations) {
                if (m.type === 'childList') {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (isUserMessage(node) || node.querySelector('.fbb737a4')) needUser = true;
                            if (autoCollapseThinking && (node.textContent && node.textContent.includes('已思考') ||
                                (node.querySelector && node.querySelector('span') && node.querySelector('span').textContent?.includes('已思考')))) {
                                needThink = true;
                            }
                        }
                    }
                }
            }
            if (needUser) setTimeout(processAllUserMessages, 100);
            if (needThink) setTimeout(processAllThinkingSections, 150);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ==================== 初始化 ====================
    function init() {
        cleanupLegacyWrappers();
        deduplicateButtons();
        processAllExistingCodeBlocks();
        observeCodeBlocks();
        observeTables();
        processAllUserMessages();
        if (autoCollapseThinking) processAllThinkingSections();
        observeDynamicContent();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();