#!/usr/bin/env node
'use strict';

/* ============================================================
   test-markdown.js — Markdown 解析器全语法回归测试

   用法：node scripts/test-markdown.js   （或 npm test）
   覆盖 README 承诺的全部语法：粗体 / 斜体 / 删除线 / 行内代码 /
   内外链接 / 图片（含图注）/ 引用 / 列表 / 标题 / 分隔线 /
   围栏代码块 / 表格（GFM 对齐），以及嵌套组合与转义安全。
   ============================================================ */

const { inline, mdToHtml } = require('../lib/markdown');

let pass = 0;
let fail = 0;
const failures = [];

function eq(name, actual, expected) {
  if (actual === expected) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push({ name, actual, expected });
    console.log(`  ✗ ${name}`);
    console.log(`      期望: ${JSON.stringify(expected)}`);
    console.log(`      实际: ${JSON.stringify(actual)}`);
  }
}

/* 块级测试辅助：mdToHtml 返回 { html, headings }，只断言 html */
function block(name, src, expected) {
  eq(name, mdToHtml(src).html, expected);
}

console.log('── 行内语法 ──────────────────────────────');

eq('粗体 **粗体**', inline('**粗体**'), '<strong>粗体</strong>');
eq('斜体 *斜体*', inline('*斜体*'), '<em>斜体</em>');
eq('删除线 ~~删除线~~', inline('~~删除线~~'), '<del>删除线</del>');
eq('行内代码 `code`', inline('`code`'), '<code>code</code>');
eq('多反引号包裹含反引号内容 ``a`b``', inline('``a`b``'), '<code>a`b</code>');
eq('三反引号包裹含双反引号内容 ``` ``code`` ```', inline('``` ``code`` ```'), '<code> ``code`` </code>');
eq('代码内星号不被强调 `a*b`', inline('`a*b`'), '<code>a*b</code>');
eq('外链 [a](https://x.com)',
  inline('[a](https://x.com)'),
  '<a href="https://x.com" target="_blank" rel="noopener">a</a>');
eq('外链 [a](//x.com)',
  inline('[a](//x.com)'),
  '<a href="//x.com" target="_blank" rel="noopener">a</a>');
eq('内链 [a](/about.html)',
  inline('[a](/about.html)'),
  '<a href="/about.html">a</a>');
eq('图片 ![a](u.png)',
  inline('![a](u.png)'),
  '<img src="u.png" alt="a" loading="lazy">');
eq('图片含图注 ![a](u.png "注")',
  inline('![a](u.png "注")'),
  '<figure class="md-figure"><img src="u.png" alt="a" loading="lazy"><figcaption>注</figcaption></figure>');

console.log('── 嵌套与组合（本次修复重点）──────────────');

eq('粗体套斜体 **粗*斜*粗**',
  inline('**粗*斜*粗**'),
  '<strong>粗<em>斜</em>粗</strong>');
eq('粗体内容含星号 **a*b**',
  inline('**a*b**'),
  '<strong>a*b</strong>');
eq('斜体套粗体 *斜**粗**斜*',
  inline('*斜**粗**斜*'),
  '<em>斜<strong>粗</strong>斜</em>');
eq('粗斜体 ***粗斜体***',
  inline('***粗斜体***'),
  '<strong><em>粗斜体</em></strong>');
eq('粗体套代码 **a `b` c**',
  inline('**a `b` c**'),
  '<strong>a <code>b</code> c</strong>');
eq('粗体套链接 **看[x](https://x.com)**',
  inline('**看[x](https://x.com)**'),
  '<strong>看<a href="https://x.com" target="_blank" rel="noopener">x</a></strong>');
eq('删除线套粗体 ~~**粗体**~~',
  inline('~~**粗体**~~'),
  '<del><strong>粗体</strong></del>');
eq('粗体套删除线 **~~粗体~~**',
  inline('**~~粗体~~**'),
  '<strong><del>粗体</del></strong>');
eq('粗体紧邻斜体 **粗***斜*',
  inline('**粗***斜*'),
  '<strong>粗</strong><em>斜</em>');
eq('链接文字含粗体 [**粗**](u)',
  inline('[**粗**](u)'),
  '<a href="u"><strong>粗</strong></a>');
eq('粗体含 & 与 > 不双重转义 **a & b > c**',
  inline('**a & b > c**'),
  '<strong>a &amp; b &gt; c</strong>');
eq('英文单词间 * 不误渲染 a*b*',
  inline('a*b*'),
  'a*b*');

console.log('── 转义安全 ──────────────────────────────');

eq('<script> 被转义', inline('<script>alert(1)</script>'),
  '&lt;script&gt;alert(1)&lt;/script&gt;');
eq('图片 alt 含 & 被转义', inline('![a&b](u.png)'),
  '<img src="u.png" alt="a&amp;b" loading="lazy">');
eq('未闭合粗体原样输出', inline('**没闭合'), '**没闭合');
eq('未闭合删除线原样输出', inline('~~没闭合'), '~~没闭合');

console.log('── 块级语法 ──────────────────────────────');

block('标题 h2 带锚点', '## 标题\n',
  '<h2 id="sec-1">标题</h2>\n');
block('标题 h1 无锚点', '# 大标题\n',
  '<h1>大标题</h1>\n');
block('分隔线 ---', '---\n', '<hr>\n');
block('分隔线 ***', '***\n', '<hr>\n');
block('引用', '> 引用内容\n',
  '<blockquote>\n<p>引用内容</p>\n</blockquote>\n');
block('无序列表', '- 甲\n- 乙\n',
  '<ul>\n  <li>甲</li>\n  <li>乙</li>\n</ul>\n');
block('有序列表', '1. 甲\n2. 乙\n',
  '<ol>\n  <li>甲</li>\n  <li>乙</li>\n</ol>\n');
block('列表项含粗体', '- **会话**\n',
  '<ul>\n  <li><strong>会话</strong></li>\n</ul>\n');
block('有序列表 start 非 1', '3. 三\n4. 四\n',
  '<ol start="3">\n  <li>三</li>\n  <li>四</li>\n</ol>\n');
block('有序列表 start 为 1 不加属性', '1. 一\n2. 二\n',
  '<ol>\n  <li>一</li>\n  <li>二</li>\n</ol>\n');
block('无序列表嵌套', '- 甲\n  - 乙\n',
  '<ul>\n  <li>甲<ul>\n  <li>乙</li>\n</ul>\n</li>\n</ul>\n');
block('有序列表嵌套', '1. 甲\n   1. 乙\n',
  '<ol>\n  <li>甲<ol>\n  <li>乙</li>\n</ol>\n</li>\n</ol>\n');
block('三层嵌套', '- a\n  - b\n    - c\n',
  '<ul>\n  <li>a<ul>\n  <li>b<ul>\n  <li>c</li>\n</ul>\n</li>\n</ul>\n</li>\n</ul>\n');
block('混合类型同缩进嵌套', '- a\n1. b\n',
  '<ul>\n  <li>a<ol>\n  <li>b</li>\n</ol>\n</li>\n</ul>\n');
block('嵌套列表 start 继承', '3. 甲\n  4. 乙\n',
  '<ol start="3">\n  <li>甲<ol start="4">\n  <li>乙</li>\n</ol>\n</li>\n</ol>\n');
block('多行列表项（收集后续缩进行）', '- 第一行\n  第二行\n',
  '<ul>\n  <li>第一行\n第二行</li>\n</ul>\n');
block('loose 列表（项间空行）', '- a\n\n- b\n',
  '<ul>\n  <li><p>a</p></li>\n  <li><p>b</p></li>\n</ul>\n');
block('loose 项内多段', '- a\n\n  续行\n',
  '<ul>\n  <li><p>a</p>\n<p>续行</p></li>\n</ul>\n');
block('4 空格缩进不算列表', '    1. x\n',
  '<p>    1. x</p>\n');
block('子列表后接父项内容', '- 甲\n  - 子\n  继续\n',
  '<ul>\n  <li>甲<ul>\n  <li>子</li>\n</ul>\n继续</li>\n</ul>\n');
block('列表后空行再接段落', '- a\n\n段落\n',
  '<ul>\n  <li>a</li>\n</ul>\n<p>段落</p>\n');
block('引用含粗体', '> **引用**\n',
  '<blockquote>\n<p><strong>引用</strong></p>\n</blockquote>\n');
block('围栏代码块带语言', '```js\nconst a = 1;\n```\n',
  '<pre><code class="lang-js">const a = 1;</code></pre>\n');
block('代码块内容转义', '```\n<b>&</b>\n```\n',
  '<pre><code class="lang-plaintext">&lt;b&gt;&amp;&lt;/b&gt;</code></pre>\n');
block('表格默认对齐', '| 名 | 值 |\n| --- | --- |\n| 甲 | 1 |\n',
  '<div class="table-wrap">\n<table>\n  <thead>\n      <th>名</th>\n      <th>值</th>\n  </thead>\n  <tbody>\n      <tr>\n        <td>甲</td>\n        <td>1</td>\n      </tr>\n  </tbody>\n</table>\n</div>\n');
block('表格对齐（左/中/右）', '| a | b | c |\n| :--- | :---: | ---: |\n| 1 | 2 | 3 |\n',
  '<div class="table-wrap">\n<table>\n  <thead>\n      <th style="text-align:left">a</th>\n      <th style="text-align:center">b</th>\n      <th style="text-align:right">c</th>\n  </thead>\n  <tbody>\n      <tr>\n        <td style="text-align:left">1</td>\n        <td style="text-align:center">2</td>\n        <td style="text-align:right">3</td>\n      </tr>\n  </tbody>\n</table>\n</div>\n');
block('表格单元格含粗体', '| 名 |\n| --- |\n| **甲** |\n',
  '<div class="table-wrap">\n<table>\n  <thead>\n      <th>名</th>\n  </thead>\n  <tbody>\n      <tr>\n        <td><strong>甲</strong></td>\n      </tr>\n  </tbody>\n</table>\n</div>\n');
block('段落（多行合并）', '第一行\n第二行\n',
  '<p>第一行\n第二行</p>\n');
block('前后留空的表格（GFM 要求）', '正文\n\n| a |\n| --- |\n| 1 |\n\n结尾\n',
  '<p>正文</p>\n<div class="table-wrap">\n<table>\n  <thead>\n      <th>a</th>\n  </thead>\n  <tbody>\n      <tr>\n        <td>1</td>\n      </tr>\n  </tbody>\n</table>\n</div>\n<p>结尾</p>\n');

console.log('──────────────────────────────────────────');
console.log(`结果：${pass} 通过，${fail} 失败`);

if (fail > 0) {
  console.log('\n失败清单：');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
process.exit(0);
