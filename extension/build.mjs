/**
 * Extension 构建脚本（esbuild）
 *
 * - 把 deepseektool.user.js 包成 runUserScript()，保证存储预加载先于业务执行
 * - GM_* 通过 inject 绑定到 src/gm-shim.js
 * - html2canvas 本地打包，满足 MV3 禁止远程代码的要求
 * - 从 SVG 源生成 16/32/48/128 PNG 图标
 *
 * 用法：
 *   node extension/build.mjs            # 一次性构建到 dist/
 *   node extension/build.mjs --minify   # 压缩 content.js
 *   node extension/build.mjs --watch    # 监听源码变化
 */

import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.resolve(root, 'dist');

const watch = process.argv.includes('--watch');
const minify = process.argv.includes('--minify');

/** 把 userscript 源码包成一个延迟调用的函数，避免静态 import 立即执行。 */
const wrapUserscript = {
  name: 'wrap-userscript',
  setup(buildApi) {
    buildApi.onLoad({ filter: /deepseektool\.user\.js$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      return {
        contents: `export function runUserScript() {\n${source}\n}`,
        loader: 'js',
        resolveDir: path.dirname(args.path),
      };
    });
  },
};

async function copyStatic() {
  await mkdir(path.join(dist, 'icons'), { recursive: true });
  for (const file of ['manifest.json', 'popup.html', 'popup.css', 'popup.js']) {
    await cp(path.join(__dirname, file), path.join(dist, file));
  }

  const svg = path.join(__dirname, 'icons', 'icon.svg');
  await cp(svg, path.join(dist, 'icons', 'icon.svg'));
  for (const size of [16, 32, 48, 128]) {
    await sharp(svg).resize(size, size).png().toFile(path.join(dist, 'icons', `${size}.png`));
  }
}

const options = {
  entryPoints: [path.join(__dirname, 'src', 'content-entry.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome111'],
  outfile: path.join(dist, 'content.js'),
  inject: [path.join(__dirname, 'src', 'gm-shim.js')],
  plugins: [wrapUserscript],
  minify,
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await copyStatic();
  const ctx = await context(options);
  await ctx.watch();
  console.log('[DS Toolbox] watching extension sources...');
} else {
  await rm(dist, { recursive: true, force: true });
  await build(options);
  await copyStatic();
  console.log('[DS Toolbox] build complete ->', dist);
}
