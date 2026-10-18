/**
 * 工具栏 popup：替代用户脚本的 GM_registerMenuCommand。
 * 通过 chrome.tabs.sendMessage 让 content script 执行对应命令。
 */

const TARGET_PREFIX = 'https://chat.deepseek.com/';

const els = {
  status: document.getElementById('status'),
  openPanel: document.getElementById('open-panel'),
  exportChat: document.getElementById('export-chat'),
  version: document.getElementById('version'),
};

function setStatus(text, tone = '') {
  els.status.textContent = text;
  if (tone) els.status.dataset.tone = tone;
  else delete els.status.dataset.tone;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isTargetTab(tab) {
  return Boolean(tab?.url && tab.url.startsWith(TARGET_PREFIX));
}

async function sendCommand(action) {
  const tab = await getActiveTab();
  if (!isTargetTab(tab)) {
    throw new Error('请先打开 chat.deepseek.com 对话页');
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'ds-toolbox', action });
  } catch {
    // content script 尚未注入（页面未刷新 / 扩展刚安装）
    throw new Error('无法连接到页面，请刷新 DeepSeek 页面后重试');
  }

  if (!response?.ok) {
    throw new Error(
      response?.error === 'command-not-ready'
        ? '扩展尚未初始化完成，请刷新页面后重试'
        : '操作未完成，请刷新页面后重试'
    );
  }
}

async function run(action, label) {
  els.openPanel.disabled = true;
  els.exportChat.disabled = true;
  setStatus('正在处理…', 'busy');
  try {
    await sendCommand(action);
    setStatus(label, 'ok');
    setTimeout(() => window.close(), 250);
  } catch (err) {
    setStatus(err.message, 'error');
    els.openPanel.disabled = false;
    els.exportChat.disabled = false;
  }
}

async function init() {
  const manifest = globalThis.chrome?.runtime?.getManifest?.();
  els.version.textContent = manifest ? 'v' + manifest.version : 'v0.1.0';

  const tab = await getActiveTab();
  const ready = isTargetTab(tab);
  els.openPanel.disabled = !ready;
  els.exportChat.disabled = !ready;
  setStatus(
    ready ? '已连接到当前对话页' : '请打开 chat.deepseek.com 对话页',
    ready ? 'ok' : 'warn'
  );

  els.openPanel.addEventListener('click', () => run('open-panel', '已打开设置面板'));
  els.exportChat.addEventListener('click', () => run('export-chat', '已开始导出'));
}

init().catch((err) => setStatus('初始化失败：' + err.message, 'error'));
