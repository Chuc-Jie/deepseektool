// ==UserScript==
// @name         DeepSeek 代码块折叠 + 表格优化导出
// @namespace    https://github.com/yourname/deepseek-tools
// @version      2.0.0
// @description  代码块折叠（阈值/预览可配）+ 表格样式优化及 PNG/CSV 导出（可开关）
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

    // ==================== 1. 代码块折叠相关配置 ====================
    const STORAGE_FOLD_THRESHOLD = 'deepseek_fold_threshold';
    const STORAGE_PREVIEW_LINES = 'deepseek_fold_preview_lines';
    let foldThreshold = GM_getValue(STORAGE_FOLD_THRESHOLD, 20);
    let previewLines = GM_getValue(STORAGE_PREVIEW_LINES, 0);
    let enablePreviewLines = previewLines > 0;

    const btnTextFold = '折叠';
    const btnTextUnfold = '展开';

    // ==================== 2. 表格优化开关配置 ====================
    const STORAGE_TABLE_BUTTONS_ENABLED = 'deepseek_table_buttons_enabled';
    let tableButtonsEnabled = GM_getValue(STORAGE_TABLE_BUTTONS_ENABLED, true);  // 默认开启

    // ==================== 3. SVG 图标 ====================
    const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/></svg>`;
    const ICON_CHEVRON_UP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/></svg>`;

    // ==================== 4. 通用 Toast ====================
    function showToast(message, duration = 2000) {
        const existingToast = document.getElementById('ds-fold-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'ds-fold-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
            z-index: 10001;
            opacity: 0;
            transition: opacity 0.2s ease;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '1', 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 200);
        }, duration);
    }

    // ==================== 5. 配置弹窗（代码块用） ====================
    function showConfigDialog(title, description, currentValue, storageKey, onConfirm) {
        const existingDialog = document.getElementById('ds-fold-config-dialog');
        if (existingDialog) existingDialog.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ds-fold-config-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const dialog = document.createElement('div');
        dialog.id = 'ds-fold-config-dialog';
        dialog.style.cssText = `
            background: var(--ds-bg-primary, #1e1e2f);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            width: 360px;
            max-width: 90%;
            padding: 24px;
            font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
            color: var(--ds-text-primary, #e2e2e2);
        `;

        const titleEl = document.createElement('h3');
        titleEl.textContent = title;
        titleEl.style.cssText = `margin: 0 0 16px 0; font-size: 18px; font-weight: 500;`;

        const descEl = document.createElement('p');
        descEl.textContent = description;
        descEl.style.cssText = `margin: 0 0 20px 0; font-size: 13px; opacity: 0.7; line-height: 1.4;`;

        const inputWrapper = document.createElement('div');
        inputWrapper.style.marginBottom = '24px';

        const input = document.createElement('input');
        input.type = 'number';
        input.value = currentValue;
        input.min = 0;
        input.step = 1;
        input.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid rgba(128, 128, 128, 0.3);
            background: var(--ds-bg-secondary, #2a2a36);
            color: var(--ds-text-primary, #e2e2e2);
            font-size: 14px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        `;
        input.addEventListener('focus', () => input.style.borderColor = 'rgba(128, 128, 128, 0.6)');
        input.addEventListener('blur', () => input.style.borderColor = 'rgba(128, 128, 128, 0.3)');
        inputWrapper.appendChild(input);

        const buttonGroup = document.createElement('div');
        buttonGroup.style.display = 'flex';
        buttonGroup.style.gap = '12px';
        buttonGroup.style.justifyContent = 'flex-end';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            border: none;
            background: transparent;
            color: var(--ds-text-primary, #e2e2e2);
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        cancelBtn.addEventListener('mouseenter', () => cancelBtn.style.background = 'rgba(128, 128, 128, 0.1)');
        cancelBtn.addEventListener('mouseleave', () => cancelBtn.style.background = 'transparent');
        cancelBtn.addEventListener('click', () => overlay.remove());

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确认';
        confirmBtn.style.cssText = `
            padding: 8px 16px;
            border-radius: 8px;
            border: none;
            background: #0f6e4a;
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.2s;
        `;
        confirmBtn.addEventListener('mouseenter', () => confirmBtn.style.background = '#0a5a3c');
        confirmBtn.addEventListener('mouseleave', () => confirmBtn.style.background = '#0f6e4a');
        confirmBtn.addEventListener('click', () => {
            let newValue = parseInt(input.value, 10);
            if (isNaN(newValue)) newValue = 0;
            if (newValue < 0) newValue = 0;
            GM_setValue(storageKey, newValue);
            overlay.remove();
            if (onConfirm) onConfirm(newValue);
            showToast(`已设置为 ${newValue === 0 ? '关闭' : newValue}`, 1800);
            setTimeout(() => location.reload(), 1800);
        });

        buttonGroup.appendChild(cancelBtn);
        buttonGroup.appendChild(confirmBtn);

        dialog.appendChild(titleEl);
        dialog.appendChild(descEl);
        dialog.appendChild(inputWrapper);
        dialog.appendChild(buttonGroup);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') confirmBtn.click(); });
        input.focus();
    }

    // ==================== 6. 菜单命令 ====================
    // 代码块折叠菜单
    GM_registerMenuCommand('⚙️ 设置自动折叠阈值', () => {
        showConfigDialog(
            '自动折叠阈值设置',
            '设置代码块自动折叠的行数阈值（0 表示禁用自动折叠）',
            foldThreshold,
            STORAGE_FOLD_THRESHOLD,
            (newVal) => { foldThreshold = newVal; }
        );
    });

    GM_registerMenuCommand('⚙️ 设置折叠预览行数', () => {
        showConfigDialog(
            '折叠预览行数设置',
            '设置折叠时显示的行数（0 表示关闭预览，完全隐藏代码块）',
            previewLines,
            STORAGE_PREVIEW_LINES,
            (newVal) => { previewLines = newVal; }
        );
    });

    // 表格按钮开关菜单
    GM_registerMenuCommand(`🖼️ 表格导出按钮: ${tableButtonsEnabled ? '开启' : '关闭'}`, () => {
        tableButtonsEnabled = !tableButtonsEnabled;
        GM_setValue(STORAGE_TABLE_BUTTONS_ENABLED, tableButtonsEnabled);
        showToast(`表格导出按钮已${tableButtonsEnabled ? '开启' : '关闭'}，刷新页面生效`, 2000);
        // 为了简单，提示刷新页面；也可以动态重新处理所有表格（较复杂，刷新更可靠）
        setTimeout(() => location.reload(), 2000);
    });

    // ==================== 7. 全局样式（合并两个脚本的样式） ====================
    GM_addStyle(`
        /* ---------- 代码块折叠样式 ---------- */
        .ds-fold-btn {
            background: transparent;
            border: none;
            border-radius: 12px;
            font-size: 13px;
            padding: 4px 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: system-ui, -apple-system, 'Segoe UI', monospace;
            user-select: none;
            display: inline-flex;
            align-items: center;
            gap: 2px;
            margin-left: 0;
            opacity: 0.7;
        }
        .ds-fold-btn:hover {
            background: rgba(128, 128, 128, 0.2);
            opacity: 1;
        }
        .ds-fold-btn .fold-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
        }
        .ds-fold-btn svg {
            width: 20px;
            height: 20px;
            display: block;
        }
        .efa13877 .ds-fold-btn {
            margin-left: 4px;
        }
        .ds-fold-preview::after {
            content: " ...";
            display: block;
            text-align: center;
            color: inherit;
            opacity: 0.6;
            margin-top: 4px;
        }

        /* ---------- 表格优化样式 ---------- */
        .ds-markdown table {
            width: 100% !important;
            border-collapse: separate !important;
            border-spacing: 0 !important;
            margin: 1em 0 !important;
            background-color: #ffffff !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05) !important;
            position: relative;
        }
        .ds-markdown th,
        .ds-markdown td {
            border: 1px solid #e5e7eb !important;
            padding: 12px 16px !important;
            vertical-align: top !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
        }
        .ds-markdown th {
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%) !important;
            font-weight: 600 !important;
            color: #1f2937 !important;
            border-bottom: 1px solid #e5e7eb !important;
            letter-spacing: 0.02em !important;
        }
        .ds-markdown tbody tr:nth-child(even) {
            background-color: #fafafa !important;
        }
        .ds-markdown tbody tr:hover {
            background-color: #eff6ff !important;
            transition: background-color 0.2s ease !important;
        }
        /* 内部按钮容器 */
        .table-internal-buttons {
            position: absolute;
            bottom: 12px;
            right: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 10;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s ease, visibility 0.2s ease;
            pointer-events: none;
        }
        .ds-markdown table:hover .table-internal-buttons,
        .table-internal-buttons:hover {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
        .internal-export-btn {
            width: 32px;
            height: 32px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(4px);
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            transition: all 0.2s ease;
            font-size: 16px;
            position: relative;
        }
        .internal-export-btn:hover {
            background: #ffffff;
            transform: scale(1.05);
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            border-color: #cbd5e1;
        }
        .internal-export-btn:active {
            transform: scale(0.98);
        }
        .internal-export-btn::after {
            content: attr(data-tooltip);
            position: absolute;
            right: 40px;
            top: 50%;
            transform: translateY(-50%);
            background: #1f2937;
            color: white;
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 6px;
            white-space: nowrap;
            opacity: 0;
            visibility: hidden;
            transition: 0.1s;
            pointer-events: none;
        }
        .internal-export-btn:hover::after {
            opacity: 1;
            visibility: visible;
        }
    `);

    // ==================== 8. 代码块折叠核心逻辑 ====================
    const processedAttr = 'data-fold-processed';

    function getLineCount(preEl) {
        const text = preEl.innerText || preEl.textContent || '';
        let lines = text.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
        return lines.length;
    }

    function getLineHeight(preEl) {
        const style = window.getComputedStyle(preEl);
        let lineHeight = style.lineHeight;
        if (lineHeight === 'normal') {
            const fontSize = parseFloat(style.fontSize);
            lineHeight = fontSize * 1.2 + 'px';
        }
        return parseFloat(lineHeight);
    }

    function shouldUsePreviewMode(preEl) {
        if (!enablePreviewLines) return false;
        const lineCount = getLineCount(preEl);
        return lineCount > previewLines;
    }

    function collapseBlock(preEl, btn) {
        if (shouldUsePreviewMode(preEl)) {
            const lineHeight = getLineHeight(preEl);
            const maxHeight = lineHeight * previewLines;
            if (!preEl.dataset.origMaxHeight) {
                preEl.dataset.origMaxHeight = preEl.style.maxHeight || '';
                preEl.dataset.origOverflow = preEl.style.overflow || '';
            }
            preEl.style.maxHeight = maxHeight + 'px';
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
        let btnGroup = parent.querySelector('.efa13877');
        if (btnGroup) return btnGroup;
        btnGroup = parent.querySelector('[class*="button-group"], [class*="actions"], [class*="buttons"]');
        return btnGroup || null;
    }

    function createFoldButton(preEl) {
        if (!preEl.dataset.origDisplay) {
            preEl.dataset.origDisplay = window.getComputedStyle(preEl).display;
        }

        const shouldAutoFold = foldThreshold > 0 && getLineCount(preEl) > foldThreshold;
        let isFolded = false;
        if (shouldAutoFold) {
            if (shouldUsePreviewMode(preEl)) {
                const lineHeight = getLineHeight(preEl);
                const maxHeight = lineHeight * previewLines;
                if (!preEl.dataset.origMaxHeight) {
                    preEl.dataset.origMaxHeight = preEl.style.maxHeight || '';
                    preEl.dataset.origOverflow = preEl.style.overflow || '';
                }
                preEl.style.maxHeight = maxHeight + 'px';
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
            if (preEl.dataset.origMaxHeight !== undefined && preEl.style.maxHeight !== '' && preEl.style.maxHeight !== 'none') {
                currentlyFolded = true;
            } else if (preEl.style.display === 'none') {
                currentlyFolded = true;
            } else {
                currentlyFolded = false;
            }
            if (currentlyFolded) {
                expandBlock(preEl, btn);
            } else {
                collapseBlock(preEl, btn);
            }
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
            if (!block.hasAttribute(processedAttr)) {
                addFoldButtonToCodeBlock(block);
            }
        });
    }

    function cleanupLegacyWrappers() {
        document.querySelectorAll('.ds-fold-btn-wrapper').forEach(w => w.remove());
    }

    function deduplicateButtons() {
        document.querySelectorAll('.efa13877').forEach(container => {
            const btns = container.querySelectorAll('.ds-fold-btn');
            if (btns.length > 1) {
                for (let i = 1; i < btns.length; i++) btns[i].remove();
            }
        });
    }

    function observeCodeBlocks() {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && node.matches('pre')) {
                                addFoldButtonToCodeBlock(node);
                            }
                            if (node.querySelectorAll) {
                                node.querySelectorAll('pre').forEach(innerPre => addFoldButtonToCodeBlock(innerPre));
                            }
                        }
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ==================== 9. 表格优化核心逻辑（带开关） ====================
    // 以下函数只在 tableButtonsEnabled 为 true 时才会被调用初始化

    async function exportTableAsPNG(table) {
        if (!window.html2canvas) {
            alert('html2canvas 库未加载，请检查网络或稍后再试。');
            return;
        }
        try {
            const btnContainer = table.querySelector('.table-internal-buttons');
            let originalDisplay = null;
            if (btnContainer) {
                originalDisplay = btnContainer.style.display;
                btnContainer.style.display = 'none';
            }
            const canvas = await html2canvas(table, {
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: false
            });
            if (btnContainer) btnContainer.style.display = originalDisplay;
            const link = document.createElement('a');
            link.download = `table_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('导出PNG失败:', err);
            alert('导出失败，请查看控制台错误信息。');
        }
    }

    function exportTableAsCSV(table) {
        const rows = [];
        const thead = table.querySelector('thead');
        if (thead) {
            thead.querySelectorAll('tr').forEach(tr => {
                const rowData = [];
                tr.querySelectorAll('th').forEach(th => rowData.push(getCellText(th)));
                if (rowData.length) rows.push(rowData);
            });
        }
        const tbody = table.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(tr => {
                const rowData = [];
                tr.querySelectorAll('td').forEach(td => rowData.push(getCellText(td)));
                if (rowData.length) rows.push(rowData);
            });
        } else {
            table.querySelectorAll('tr').forEach(tr => {
                const rowData = [];
                tr.querySelectorAll('td, th').forEach(cell => rowData.push(getCellText(cell)));
                if (rowData.length) rows.push(rowData);
            });
        }
        if (rows.length === 0) {
            alert('表格无数据可导出');
            return;
        }
        const csvContent = rows.map(row => 
            row.map(cell => {
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    cell = cell.replace(/"/g, '""');
                    cell = `"${cell}"`;
                }
                return cell;
            }).join(',')
        ).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `table_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function getCellText(cell) {
        let text = '';
        cell.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent;
            } else if (node.nodeName === 'BR') {
                text += '\n';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                text += getCellText(node);
            }
        });
        return text.replace(/\s+/g, ' ').trim();
    }

    function addInternalButtons(table) {
        if (table.getAttribute('data-internal-buttons-added') === 'true') return;
        table.setAttribute('data-internal-buttons-added', 'true');

        const btnContainer = document.createElement('div');
        btnContainer.className = 'table-internal-buttons';

        const pngBtn = document.createElement('button');
        pngBtn.className = 'internal-export-btn';
        pngBtn.innerHTML = '📸';
        pngBtn.setAttribute('data-tooltip', '导出为 PNG');
        pngBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await exportTableAsPNG(table);
        });

        const csvBtn = document.createElement('button');
        csvBtn.className = 'internal-export-btn';
        csvBtn.innerHTML = '📄';
        csvBtn.setAttribute('data-tooltip', '导出为 CSV');
        csvBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            exportTableAsCSV(table);
        });

        btnContainer.appendChild(pngBtn);
        btnContainer.appendChild(csvBtn);
        table.appendChild(btnContainer);

        // 智能显隐：鼠标进入表格或按钮容器时显示，离开延迟隐藏
        let hideTimer = null;
        const showButtons = () => {
            if (hideTimer) clearTimeout(hideTimer);
            btnContainer.style.opacity = '1';
            btnContainer.style.visibility = 'visible';
            btnContainer.style.pointerEvents = 'auto';
        };
        const hideButtons = () => {
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => {
                btnContainer.style.opacity = '';
                btnContainer.style.visibility = '';
                btnContainer.style.pointerEvents = '';
            }, 300);
        };
        table.addEventListener('mouseenter', showButtons);
        table.addEventListener('mouseleave', hideButtons);
        btnContainer.addEventListener('mouseenter', showButtons);
        btnContainer.addEventListener('mouseleave', hideButtons);
    }

    function fixAllTables() {
        if (!tableButtonsEnabled) return; // 开关关闭，不处理任何表格

        const virtualListContainer = document.querySelector('.ds-virtual-list-visible-items');
        let availableWidth = null;
        if (virtualListContainer) {
            availableWidth = virtualListContainer.clientWidth;
            virtualListContainer.style.overflowX = 'visible';
            virtualListContainer.style.maxWidth = '100%';
        }

        const markdownContainers = document.querySelectorAll('.ds-markdown');
        if (!markdownContainers.length) return;

        markdownContainers.forEach(container => {
            container.style.overflowX = 'visible';
            container.style.maxWidth = '100%';

            const tables = container.querySelectorAll('table');
            tables.forEach(table => {
                if (availableWidth && availableWidth > 0) {
                    table.style.maxWidth = `${availableWidth}px`;
                } else {
                    table.style.maxWidth = '100%';
                }
                table.style.width = '100%';
                table.style.tableLayout = 'fixed';
                if (getComputedStyle(table).position !== 'relative') {
                    table.style.position = 'relative';
                }
                const cells = table.querySelectorAll('th, td');
                cells.forEach(cell => {
                    cell.style.whiteSpace = 'normal';
                    cell.style.wordWrap = 'break-word';
                    cell.style.overflowWrap = 'break-word';
                    cell.style.wordBreak = 'break-word';
                });
                const headerRow = table.querySelector('thead tr') || table.querySelector('tr');
                if (headerRow) {
                    const colCount = headerRow.cells.length;
                    if (colCount > 0) {
                        const colPercent = (100 / colCount).toFixed(2) + '%';
                        for (let i = 0; i < colCount; i++) {
                            if (headerRow.cells[i]) headerRow.cells[i].style.width = colPercent;
                        }
                    }
                }
                let parent = table.parentElement;
                while (parent && parent !== document.body) {
                    const computed = window.getComputedStyle(parent);
                    if (computed.overflowX === 'auto' || computed.overflowX === 'scroll') {
                        parent.style.overflowX = 'visible';
                    }
                    if (parent.style.maxWidth && parent.style.maxWidth !== 'none') {
                        parent.style.maxWidth = '100%';
                    }
                    parent = parent.parentElement;
                }
                addInternalButtons(table);
            });
        });
    }

    function observeTables() {
        if (!tableButtonsEnabled) return;
        const observer = new MutationObserver(() => fixAllTables());
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('load', fixAllTables);
        window.addEventListener('resize', () => {
            clearTimeout(window._resizeFix);
            window._resizeFix = setTimeout(fixAllTables, 100);
        });
        setInterval(fixAllTables, 2000);
        fixAllTables();
    }

    // ==================== 10. 初始化入口 ====================
    function init() {
        // 代码块折叠初始化
        cleanupLegacyWrappers();
        deduplicateButtons();
        processAllExistingCodeBlocks();
        observeCodeBlocks();

        // 表格优化初始化（受开关控制）
        if (tableButtonsEnabled) {
            observeTables();
        } else {
            // 可选：如果开关关闭，可以清理已存在的按钮，但刷新页面即可，简单处理
            console.log('表格导出按钮已禁用');
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();