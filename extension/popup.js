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
  footerVersion: document.getElementById('footer-version'),
  status: document.getElementById('status'),
  openDeepseek: document.getElementById('open-deepseek'),
  actionsCard: document.getElementById('actions-card'),
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

  ui.actionsCard.hidden = !state.ready;
  ui.openPanel.disabled = disabled;
  ui.exportChat.disabled = disabled;

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

/* content script 就绪探测：扩展安装/重载后，已打开的 Tab 不会自动获得新脚本。
   popup 先 ping，失败就刷新页面并等待脚本重新注入，避免用户手动刷新。 */
const CONTENT_PING_TIMEOUT_MS = 800;
const CONTENT_READY_TIMEOUT_MS = 12000;
const CONTENT_READY_POLL_MS = 300;
const CONTENT_RELOAD_SETTLE_MS = 800;

function pingContentScript(tabId) {
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    timer = setTimeout(() => finish(false), CONTENT_PING_TIMEOUT_MS);
    try {
      chrome.tabs.sendMessage(tabId, { type: 'ds-toolbox', action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          finish(false);
          return;
        }
        finish(Boolean(response?.ok));
      });
    } catch {
      finish(false);
    }
  });
}

async function waitForContentScript(tabId, timeoutMs = CONTENT_READY_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await pingContentScript(tabId)) return true;
    await new Promise((resolve) => setTimeout(resolve, CONTENT_READY_POLL_MS));
  }
  return false;
}

async function refreshAndWaitForContentScript(tab) {
  setStatus('页面未就绪，正在刷新…', 'busy');
  try {
    await chrome.tabs.reload(tab.id);
  } catch {
    return false;
  }
  // reload 返回时旧文档可能还没卸载，立即 ping 会命中旧 content script。
  // 先等导航真正开始，再轮询；后续 ping 失败/成功都只反映新文档。
  await new Promise((resolve) => setTimeout(resolve, CONTENT_RELOAD_SETTLE_MS));
  return waitForContentScript(tab.id);
}

async function requestCommand(action) {
  const tab = await getActiveTab();
  if (!isTargetTab(tab)) {
    throw new Error('请先打开 DeepSeek 对话页');
  }

  // 扩展安装/重载后，旧标签页没有 content script：先探测，必要时自动刷新一次。
  if (!(await pingContentScript(tab.id))) {
    const ready = await refreshAndWaitForContentScript(tab);
    if (!ready) {
      throw new Error('页面未就绪，请手动刷新 DeepSeek 后重试');
    }
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: 'ds-toolbox', action });
  } catch {
    throw new Error('页面未就绪，请手动刷新 DeepSeek 后重试');
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
      // 已经打开过的页面可能是在扩展安装/重载之前打开的：先确认 content script，
      // 未注入就刷新一次，保证用户点「打开 DeepSeek」后立即可用。
      if (!(await pingContentScript(tabs[0].id))) {
        const ready = await refreshAndWaitForContentScript(tabs[0]);
        if (!ready) {
          throw new Error('页面刷新后仍未就绪，请稍后重试');
        }
      }
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
    setStatus(action === 'open-panel' ? '已打开设置' : '已开始导出', 'ok');
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
  ui.footerVersion.textContent = manifest ? `扩展版本 v${manifest.version}` : '扩展版本 预览';

  const tab = await getActiveTab();
  if (!isTargetTab(tab)) {
    state.ready = false;
    syncActions();
    setStatus('请先打开 DeepSeek 对话页', 'warn');
  } else {
    // 页面 URL 正确不代表 content script 已注入：扩展刚安装/重载时，
    // 旧标签页需要刷新。这里自动刷新并等待，避免用户自己手动刷新。
    setStatus('正在检查页面…', 'busy');
    let ready = await pingContentScript(tab.id);
    if (!ready) {
      ready = await refreshAndWaitForContentScript(tab);
    }
    state.ready = ready;
    syncActions();
    setStatus(
      ready ? '已连接到当前对话页' : '页面未就绪，请手动刷新 DeepSeek 后重试',
      ready ? 'ok' : 'error'
    );
  }

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
