// 表格渲染边界回归：<br> 行宽、图片尺寸、colspan 分配、PNG 列宽换算。
// 运行：NODE_PATH=<jsdom node_modules> node tests/table-edge-cases.js
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = process.env.DSTOOL_SRC || path.resolve(__dirname, '../deepseektool.user.js');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
const check = (cond, msg, extra) => {
    if (cond) { pass++; console.log('  \u2713 ' + msg); }
    else { fail++; console.log('  \u2717 ' + msg + (extra ? '  →  ' + extra : '')); }
};

// ---------- 静态守卫：确认修复点没有被后续重构悄悄删掉 ----------
console.log('\n【静态守卫】');
check(/function getTableContentSignature/.test(src), '流式文本签名存在');
check(/characterData:\s*true/.test(src), 'MutationObserver 监听 characterData');
check(/node\.nodeType === Node\.TEXT_NODE[\s\S]{0,160}closest\('\.ds-markdown table'\)/.test(src), '表格内新增文本节点也触发重测');
check(/m\.target[\s\S]{0,220}closest\('\.ds-markdown table'\)/.test(src), '表格内删除节点也触发重测');
check(/data-internal-buttons-added'\) === 'true'/.test(src), '表格按钮热更新判重');
check(/function getTableCellFixed/.test(src), '动态单元格固定开销');
check(/restoreButtonHostPosition/.test(src), '按钮宿主 position 恢复');
check(/if \(ox === 'auto' \|\| ox === 'scroll'\) host = parent/.test(src), '滚动宿主只接受真正的滚动父节点');
check(/if \(child\.tagName === 'BR'\) \{ flush\(\); continue; \}/.test(src), '<br> 结束当前行');
check(/replacedW = child\.naturalWidth/.test(src), '图片 naturalWidth 计入列宽');
check(/const span = Math\.max\(1, cell\.colSpan \|\| 1\)/.test(src), 'colspan 参与列索引推算');

// ---------- 从源码抽取待测函数 ----------
function extractFn(name) {
    const re = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
    const m = re.exec(src);
    if (!m) return null;
    let i = m.index + m[0].length;
    let depth = 1;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
    }
    return depth === 0 ? src.slice(m.index, i) : null;
}

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const { window } = dom;
const document = window.document;
const Node = window.Node;

// canvas mock：每个字符 10px，便于断言
const ctx = { font: '', measureText: (t) => ({ width: String(t).length * 10 }) };
const getMeasureCtx = () => ctx;

// 计算样式 mock：固定 14px 字体、无 padding/border；td/th 为 table-cell，div 为 block
const getComputedStyle = (el) => {
    const tag = String((el && el.tagName) || '').toUpperCase();
    return {
        fontStyle: 'normal',
        fontWeight: tag === 'TH' ? '600' : '400',
        fontSize: '14px',
        fontFamily: 'sans-serif',
        letterSpacing: '0px',
        paddingLeft: '0px',
        paddingRight: '0px',
        borderLeftWidth: '0px',
        borderRightWidth: '0px',
        display: (tag === 'TD' || tag === 'TH') ? 'table-cell' : ((tag === 'DIV' || tag === 'P') ? 'block' : 'inline'),
    };
};

const measureSrc = extractFn('measureColumnNaturals');
const scaleSrc = extractFn('scaleCloneColumns');
check(!!measureSrc, '抽取 measureColumnNaturals');
check(!!scaleSrc, '抽取 scaleCloneColumns');
if (!measureSrc || !scaleSrc) {
    console.log('\n===== 表格边界回归：' + pass + ' 通过 / ' + fail + ' 失败 =====');
    process.exit(1);
}

const measureColumnNaturals = new Function(
    'document', 'Node', 'getComputedStyle', 'getMeasureCtx', 'TABLE_CELL_FIXED',
    'return (' + measureSrc + ')'
)(document, Node, getComputedStyle, getMeasureCtx, 34);
const scaleCloneColumns = new Function('return (' + scaleSrc + ')')();

// ---------- <br> 取最长行 ----------
console.log('\n【<br> 与块级元素】');
const t1 = document.createElement('table');
t1.innerHTML = '<tbody><tr><td>foo<br>bar</td><td>x</td></tr></tbody>';
const n1 = measureColumnNaturals(t1, 2);
check(n1 && n1[0] < 45, '<br> 取最长行（foo/bar 各 30px，而不是 60px）', n1 && n1[0]);
check(n1 && n1[0] > 25, '<br> 保留最长行宽度', n1 && n1[0]);

const tBlock = document.createElement('table');
tBlock.innerHTML = '<tbody><tr><td><div>foo</div><div>bar</div></td><td>x</td></tr></tbody>';
const nBlock = measureColumnNaturals(tBlock, 2);
check(nBlock && nBlock[0] < 45, '块级子元素按最长行计算，而不是累加', nBlock && nBlock[0]);

// ---------- 图片等替换元素 ----------
console.log('\n【替换元素】');
const t2 = document.createElement('table');
t2.innerHTML = '<tbody><tr><td><img></td><td>x</td></tr></tbody>';
const img = t2.querySelector('img');
Object.defineProperty(img, 'naturalWidth', { value: 120, configurable: true });
const n2 = measureColumnNaturals(t2, 2);
check(n2 && n2[0] >= 120, '图片 naturalWidth 计入列宽', n2 && n2[0]);

// ---------- colspan 列索引 ----------
console.log('\n【colspan】');
const t3 = document.createElement('table');
t3.innerHTML = '<tbody><tr><td colspan="2">abcdef</td><td>x</td></tr>'
    + '<tr><td>1</td><td>2</td><td>3</td></tr></tbody>';
const n3 = measureColumnNaturals(t3, 3);
check(n3 && n3[0] > 25 && n3[0] < 40, 'colspan 第一列按均摊（30px）', n3 && n3[0]);
check(n3 && n3[1] > 25 && n3[1] < 40, 'colspan 第二列按均摊，而不是整体前移到第一列', n3 && n3[1]);
check(n3 && n3[2] > 5 && n3[2] < 20, 'colspan 后的第三列仍对位', n3 && n3[2]);

// ---------- PNG 列宽换算 ----------
console.log('\n【PNG 列宽换算】');
const c1 = document.createElement('table');
c1.innerHTML = '<colgroup><col style="width:33.3333%"><col style="width:33.3333%"><col style="width:33.3333%"></colgroup>'
    + '<tbody><tr><td></td><td></td><td></td></tr></tbody>';
const w1 = scaleCloneColumns(c1, 900, 600);
const sum1 = w1.reduce((a, b) => a + b, 0);
check(w1.length === 3 && sum1 === 600, '百分比列宽总和精确等于目标宽', sum1);

const c2 = document.createElement('table');
c2.innerHTML = '<colgroup><col style="width:100px"><col style="width:50%"><col style="width:bad"></colgroup>'
    + '<tbody><tr><td></td><td></td><td></td></tr></tbody>';
const w2 = scaleCloneColumns(c2, 800, 400);
const sum2 = w2.reduce((a, b) => a + b, 0);
check(w2.length === 3 && sum2 === 400, '混合 px/%/脏值总和精确等于目标宽', sum2);
check(w2.every(w => w >= 1), '每列至少 1px', w2.join(','));

console.log('\n===== 表格边界回归：' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail ? 1 : 0);
