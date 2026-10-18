/**
 * GM_* → chrome.* 兼容层（仅扩展构建时注入）
 *
 * 通过 esbuild 的 inject 功能，把 deepseektool.user.js 中的自由变量
 * GM_getValue / GM_setValue / GM_addStyle / GM_registerMenuCommand
 * 绑定到本模块。源码本身保持 userscript 原样，不做任何替换。
 *
 * 存储策略：启动时一次性读取 chrome.storage.local 全量数据到内存，
 * 之后 GM_getValue 保持同步语义（现有 20+ 处顶层读取无需改成 await）。
 */

const storageCache = Object.create(null);
let storageLoaded = false;

/* 本标签页刚写入的键：用于忽略 chrome.storage.onChanged 的回环通知。
   值为序列化后的内容，便于和 newValue 比较。 */
const pendingLocalWrites = new Map();
let storageSyncInstalled = false;

function serialize(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function installStorageSync() {
  if (storageSyncInstalled) return;
  storageSyncInstalled = true;

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const changedKeys = [];
    for (const [key, change] of Object.entries(changes)) {
      const next = change.newValue;
      if (next === undefined) delete storageCache[key];
      else storageCache[key] = next;

      if (pendingLocalWrites.has(key)) {
        const expected = pendingLocalWrites.get(key);
        pendingLocalWrites.delete(key);
        if (expected === serialize(next)) continue; // 本标签写入，不触发重载
      }
      changedKeys.push(key);
    }

    if (!changedKeys.length) return;
    document.dispatchEvent(new CustomEvent('ds-storage-changed', {
      detail: { keys: changedKeys },
    }));
  });
}

/** 在执行业务脚本之前调用；userscript 版本不需要。 */
export async function preloadStorage() {
  if (storageLoaded) return;
  installStorageSync();
  const all = await chrome.storage.local.get(null);
  Object.assign(storageCache, all);
  storageLoaded = true;
}

export function GM_getValue(key, fallback) {
  return Object.prototype.hasOwnProperty.call(storageCache, key)
    ? storageCache[key]
    : fallback;
}

export function GM_setValue(key, value) {
  storageCache[key] = value;
  pendingLocalWrites.set(key, serialize(value));
  // 与 GM_setValue 一样保持"写入即生效"的内存语义；落盘异步，失败只影响持久化。
  chrome.storage.local.set({ [key]: value }).catch((err) => {
    pendingLocalWrites.delete(key);
    console.warn('[DS Toolbox] 写入存储失败:', key, err);
  });
}

export function GM_addStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
  return style;
}

/* ==================== 菜单命令 → popup 消息 ==================== */

const commands = [];
let listenerInstalled = false;

export function GM_registerMenuCommand(name, fn) {
  commands.push({ name, fn });
  installMessageListener();
}

function installMessageListener() {
  if (listenerInstalled) return;
  listenerInstalled = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'ds-toolbox') return;

    const fn = findCommand(message.action);
    if (!fn) {
      sendResponse({ ok: false, error: 'command-not-ready' });
      return;
    }
    try {
      fn();
      sendResponse({ ok: true });
    } catch (err) {
      console.error('[DS Toolbox] 菜单命令执行失败:', message.action, err);
      sendResponse({ ok: false, error: String(err) });
    }
  });
}

function findCommand(action) {
  // 按名称匹配，避免依赖 GM_registerMenuCommand 的注册顺序；
  // 名称兜底用顺序，防止未来文案调整导致 popup 失效。
  if (action === 'open-panel') {
    const byName = commands.find((c) => c.name.includes('设置'));
    return (byName || commands[0])?.fn;
  }
  if (action === 'export-chat') {
    const byName = commands.find((c) => c.name.includes('导出'));
    return (byName || commands[1])?.fn;
  }
  return null;
}
