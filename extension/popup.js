'use strict';

/**
 * Popup 控制器。
 * - 未打开 DeepSeek 时只提供「打开 DeepSeek」入口
 * - 进入对话页后才显示「打开设置面板 / 导出当前对话」
 * - 通过 chrome.tabs.sendMessage 触发 content script 中的菜单命令
 * - 非扩展环境（如本地 file:// 预览）安全降级
 */

const TARGET_ORIGIN = 'https://chat.deepseek.com';

const ui = {
  version: document.getElementById('version'),
  status: document.getElementById('status'),
  openDeepseek: document.getElementById('open-deepseek'),
  openPanel: document.getElementById('open-panel'),
  exportChat: document.getElementById('export-chat'),
};

const state = {
  ready: false,
  busy: false,
};

function setStatus(text, tone = 'busy') {
  ui.status.textContent = text;
  ui.status.dataset.tone = tone;
  ui.status.setAttribute('aria-busy', tone === 'busy' ? 'true' : 'false');
}

function syncActions() {
  const disabled = !state.ready || state.busy;

  ui.openPanel.disabled = disabled;
  ui.exportChat.disabled = disabled;
  ui.openPanel.hidden = !state.ready;
  ui.exportChat.hidden = !state.ready;

  ui.openDeepseek.hidden = state.ready;
  ui.openDeepseek.disabled = state.busy;
}

function hasExtensionApi() {
  return Boolean(globalThis.chrome?.tabs?.query && globalThis.chrome?.runtime?.id);
}

async function getActiveTab() {
  if (!hasExtensionApi()) return null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

function isTargetTab(tab) {
  if (!tab?.url) return false;
  try {
    return new URL(tab.url).origin === TARGET_ORIGIN;
  } catch {
    return false;
  }
}

async function requestCommand(action) {
  const tab = await getActiveTab();
  if (!isTargetTab(tab)) {
    throw new Error('请先打开 chat.deepseek.com 对话页');
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'ds-toolbox', action });
  } catch {
    // content script 尚未注入：扩展刚安装、页面未刷新、或页面正在跳转
    throw new Error('页面未就绪，请刷新 DeepSeek 后重试');
  }

  if (!response?.ok) {
    const message = response?.error === 'command-not-ready'
      ? '扩展仍在初始化，请稍后重试'
      : '操作未完成，请刷新后重试';
    throw new Error(message);
  }
}

async function openDeepseekPage() {
  if (state.busy) return;

  state.busy = true;
  syncActions();
  setStatus('正在打开 DeepSeek…', 'busy');

  try {
    if (!hasExtensionApi()) {
      window.open(`${TARGET_ORIGIN}/`, '_blank', 'noopener');
      state.busy = false;
      syncActions();
      setStatus('已在新标签页打开 DeepSeek', 'ok');
      return;
    }

    const tabs = await chrome.tabs.query({ url: `${TARGET_ORIGIN}/*` });
    if (tabs.length) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId != null) {
        try {
          await chrome.windows.update(tabs[0].windowId, { focused: true });
        } catch {
          // 窗口聚焦失败不影响标签切换，忽略
        }
      }
    } else {
      await chrome.tabs.create({ url: `${TARGET_ORIGIN}/` });
    }
    window.close();
  } catch (err) {
    state.busy = false;
    syncActions();
    setStatus(`打开失败：${err.message}`, 'error');
  }
}

async function runCommand(action) {
  if (state.busy || !state.ready) return;

  state.busy = true;
  syncActions();
  setStatus('正在处理…', 'busy');

  try {
    await requestCommand(action);
    setStatus(action === 'open-panel' ? '已打开设置面板' : '已开始导出', 'ok');
    window.setTimeout(() => window.close(), 240);
  } catch (err) {
    state.busy = false;
    syncActions();
    setStatus(err.message, 'error');
  }
}

async function init() {
  const manifest = globalThis.chrome?.runtime?.getManifest?.();
  ui.version.textContent = manifest ? `v${manifest.version}` : '预览';

  const tab = await getActiveTab();
  state.ready = isTargetTab(tab);
  syncActions();
  setStatus(
    state.ready ? '已连接到当前对话页' : '请先打开 DeepSeek 对话页',
    state.ready ? 'ok' : 'warn'
  );

  ui.openDeepseek.addEventListener('click', openDeepseekPage);
  ui.openPanel.addEventListener('click', () => runCommand('open-panel'));
  ui.exportChat.addEventListener('click', () => runCommand('export-chat'));
}

init().catch((err) => {
  state.ready = false;
  state.busy = false;
  syncActions();
  setStatus(`初始化失败：${err.message}`, 'error');
});
