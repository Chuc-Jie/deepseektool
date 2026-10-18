/**
 * MV3 content script 入口。
 *
 * 时序：
 *   1. 等待 chrome.storage.local 全量数据进入内存缓存
 *   2. 把本地打包的 html2canvas 挂到 window（源码里读 window.html2canvas）
 *   3. 执行 userscript 主体
 *
 * deepseektool.user.js 由 esbuild 打包为 runUserScript()，静态 import
 * 不会提前执行，确保存储预加载一定先完成。
 */

import html2canvas from 'html2canvas';
import { preloadStorage } from './gm-shim.js';
import { runUserScript } from '../../deepseektool.user.js';

(async () => {
  let storageReady = false;
  try {
    storageReady = await preloadStorage();
  } catch (err) {
    // preloadStorage 自身已降级；这里只兜住意料外的实现错误。
    console.error('[DS Toolbox] 存储预加载异常:', err);
  }

  document.documentElement.dataset.dsExtension = '1';
  window.html2canvas = html2canvas;
  if (!storageReady) {
    console.warn('[DS Toolbox] 存储不可用，本次设置只在当前页面内存生效');
  }

  try {
    runUserScript();
  } catch (err) {
    console.error('[DS Toolbox] 扩展初始化失败:', err);
  }
})();
