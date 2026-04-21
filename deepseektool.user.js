// ==UserScript==
// @name         DeepSeek 代码块折叠
// @namespace    https://github.com/yourname/deepseek-code-fold
// @version      1.15.0
// @description  代码块折叠按钮，支持自定义自动折叠阈值和预览行数（双菜单配置）
// @author       友野YouyEr
// @icon         https://fe-static.deepseek.com/chat/favicon.svg
// @match        https://chat.deepseek.com/*
// @match        https://www.deepseek.com/*
// @match        https://deepseek.com/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ==================== 配置存储 ====================
    const STORAGE_FOLD_THRESHOLD = 'deepseek_fold_threshold';
    const STORAGE_PREVIEW_LINES = 'deepseek_fold_preview_lines';

    // 读取存储的配置，未设置时使用默认值
    let foldThreshold = GM_getValue(STORAGE_FOLD_THRESHOLD, 20);
    let previewLines = GM_getValue(STORAGE_PREVIEW_LINES, 0);
    const enablePreviewLines = previewLines > 0;

    // 按钮文字（可手动修改）
    const btnTextFold = '折叠';
    const btnTextUnfold = '展开';

    // ==================== SVG 图标 ====================
    const ICON_CHEVRON_DOWN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 470.6C309.9 483.1 330.2 483.1 342.7 470.6L534.7 278.6C547.2 266.1 547.2 245.8 534.7 233.3C522.2 220.8 501.9 220.8 489.4 233.3L320 402.7L150.6 233.4C138.1 220.9 117.8 220.9 105.3 233.4C92.8 245.9 92.8 266.2 105.3 278.7L297.3 470.7z"/></svg>`;
    const ICON_CHEVRON_UP = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor"><path d="M297.4 169.4C309.9 156.9 330.2 156.9 342.7 169.4L534.7 361.4C547.2 373.9 547.2 394.2 534.7 406.7C522.2 419.2 501.9 419.2 489.4 406.7L320 237.3L150.6 406.6C138.1 419.1 117.8 419.1 105.3 406.6C92.8 394.1 92.8 373.8 105.3 361.3L297.3 169.3z"/></svg>`;

    // ==================== 自定义 Toast 提示 ====================
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

    // ==================== 通用配置弹窗 ====================
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

    // ==================== 菜单命令 ====================
    // 先注册自动折叠阈值菜单（位置在上方）
    GM_registerMenuCommand('⚙️ 设置自动折叠阈值', () => {
        showConfigDialog(
            '自动折叠阈值设置',
            '设置代码块自动折叠的行数阈值（0 表示禁用自动折叠）',
            foldThreshold,
            STORAGE_FOLD_THRESHOLD,
            (newVal) => { foldThreshold = newVal; }
        );
    });

    // 再注册预览行数菜单
    GM_registerMenuCommand('⚙️ 设置折叠预览行数', () => {
        showConfigDialog(
            '折叠预览行数设置',
            '设置折叠时显示的行数（0 表示关闭预览，完全隐藏代码块）',
            previewLines,
            STORAGE_PREVIEW_LINES,
            (newVal) => { previewLines = newVal; }
        );
    });

    // ==================== 样式 ====================
    GM_addStyle(`
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
    `);

    const processedAttr = 'data-fold-processed';

    // ---------- 辅助函数 ----------
    function getLineCount(preEl) {
        const text = preEl.innerText || preEl.textContent || '';
        let lines = text.split('\n');
        if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
        return lines.length || 1;
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

    function collapseBlock(preEl, btn) {
        if (enablePreviewLines && previewLines > 0) {
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
        }
        const iconDiv = btn.querySelector('.fold-icon');
        if (iconDiv) iconDiv.innerHTML = ICON_CHEVRON_UP;
        btn.querySelector('span').textContent = btnTextUnfold;
        btn.setAttribute('aria-label', '展开代码块');
    }

    function expandBlock(preEl, btn) {
        if (enablePreviewLines && previewLines > 0) {
            preEl.style.maxHeight = preEl.dataset.origMaxHeight || '';
            preEl.style.overflow = preEl.dataset.origOverflow || '';
            preEl.classList.remove('ds-fold-preview');
        } else {
            preEl.style.display = preEl.dataset.origDisplay || '';
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

        // 使用动态读取的 foldThreshold 判断是否自动折叠
        const shouldAutoFold = foldThreshold > 0 && getLineCount(preEl) > foldThreshold;

        let isFolded = false;
        if (shouldAutoFold) {
            if (enablePreviewLines && previewLines > 0) {
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
            const currentlyFolded = (() => {
                if (enablePreviewLines && previewLines > 0) {
                    return preEl.style.maxHeight !== '' && preEl.style.maxHeight !== 'none';
                } else {
                    return preEl.style.display === 'none';
                }
            })();
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

    function removeOldFoldWrappers() {
        document.querySelectorAll('.ds-fold-btn-wrapper').forEach(w => w.remove());
    }

    function resetProcessedFlags() {
        document.querySelectorAll(`[${processedAttr}]`).forEach(block => block.removeAttribute(processedAttr));
    }

    function cleanDuplicateButtons() {
        document.querySelectorAll('.efa13877').forEach(container => {
            const btns = container.querySelectorAll('.ds-fold-btn');
            if (btns.length > 1) {
                for (let i = 1; i < btns.length; i++) btns[i].remove();
            }
        });
    }

    function processAllCodeBlocks() {
        removeOldFoldWrappers();
        resetProcessedFlags();
        cleanDuplicateButtons();

        document.querySelectorAll('pre').forEach(block => {
            if (!block.hasAttribute(processedAttr)) {
                addFoldButtonToCodeBlock(block);
            }
        });
    }

    function observeCodeBlocks() {
        const observer = new MutationObserver((mutations) => {
            let needProcess = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && node.matches('pre')) {
                                if (!node.hasAttribute(processedAttr)) {
                                    addFoldButtonToCodeBlock(node);
                                }
                                needProcess = true;
                            }
                            if (node.querySelectorAll) {
                                const innerBlocks = node.querySelectorAll('pre');
                                innerBlocks.forEach(block => {
                                    if (!block.hasAttribute(processedAttr)) {
                                        addFoldButtonToCodeBlock(block);
                                    }
                                });
                                if (innerBlocks.length) needProcess = true;
                            }
                        }
                    }
                }
            }
            if (needProcess) {
                processAllCodeBlocks();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        processAllCodeBlocks();
        observeCodeBlocks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();