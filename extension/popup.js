'use strict';

/**
 * Popup 控制器。
 * - 检测当前标签页是否为 DeepSeek 对话页
 * - 通过 chrome.tabs.sendMessage 触发 content script 中的菜单命令
 * - 非扩展环境（如本地 file:// 预览）安全降级为"未连接"
 */

const TARGET_ORIGIN = 'https://chat.deepseek.com';

const ui = {
  version: document.getElementById('version'),
  status: document.getElementById('status'),
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

function syncButtons() {
  const disabled = !state.ready || state.busy;
  ui.openPanel.disabled = disabled;
  ui.exportChat.disabled = disabled;
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

async function run(action) {
  if (state.busy || !state.ready) return;

  state.busy = true;
  syncButtons();
  setStatus('正在处理…', 'busy');

  try {
    await requestCommand(action);
    setStatus(action === 'open-panel' ? '已打开设置面板' : '已开始导出', 'ok');
    window.setTimeout(() => window.close(), 240);
  } catch (err) {
    state.busy = false;
    syncButtons();
    setStatus(err.message, 'error');
  }
}

async function init() {
  const manifest = globalThis.chrome?.runtime?.getManifest?.();
  ui.version.textContent = manifest ? `v${manifest.version}` : '预览';

  const tab = await getActiveTab();
  state.ready = isTargetTab(tab);
  syncButtons();
  setStatus(
    state.ready ? '已连接到当前对话页' : '请先打开 chat.deepseek.com 对话页',
    state.ready ? 'ok' : 'warn'
  );

  ui.openPanel.addEventListener('click', () => run('open-panel'));
  ui.exportChat.addEventListener('click', () => run('export-chat'));
}

init().catch((err) => {
  state.ready = false;
  state.busy = false;
  syncButtons();
  setStatus(`初始化失败：${err.message}`, 'error');
});
