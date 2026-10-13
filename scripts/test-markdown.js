#!/usr/bin/env node
'use strict';

/* ============================================================
   test-markdown.js — Markdown 解析器全语法回归测试

   用法：node scripts/test-markdown.js   （或 npm test）
   覆盖 README 承诺的全部语法：粗体 / 斜体 / 删除线 / 行内代码 /
   内外链接 / 图片（含图注）/ 键帽（[[Ctrl+w]]）/ 引用 / 列表 / 标题 / 分隔线 /
   围栏代码块（含行高亮 {3,5-7}）/ 表格（GFM 对齐）/ 评分卡（```score，含列表徽标用的总分提取）/
   折叠块（```fold，含锚点接续与长围栏）/ 提示框（```note，含围栏误嵌提醒），
   以及嵌套组合与转义安全。
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

/* 包含式断言：评分卡整块 HTML 太长，每一条都逐字面对会比测试本身还长。
   完整字面量只留一条（钉住总体形状），其余用 has 断关键片段 */
function has(name, html, needle) {
  if (html.includes(needle)) {
    pass++;
    console.log(`  ✓ ${name}`);
    return;
  }
  fail++;
  failures.push({ name, actual: html, expected: `包含 ${JSON.stringify(needle)}` });
  console.log(`  ✗ ${name}`);
  console.log(`      期望包含: ${JSON.stringify(needle)}`);
  console.log(`      实际: ${JSON.stringify(html)}`);
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

console.log('── 键帽（[[Ctrl+w]]）──────────────────────');

eq('键帽 [[Ctrl+w]]',
  inline('按 [[Ctrl+w]] 切窗口'),
  '按 <kbd>Ctrl+w</kbd> 切窗口');
eq('键帽内容转义 [[<C-w>]]',
  inline('[[<C-w>]]'),
  '<kbd>&lt;C-w&gt;</kbd>');
eq('未闭合 [[ 原样输出', inline('[[没闭合'), '[[没闭合');
eq('空键帽 [[]] 原样输出', inline('[[]]'), '[[]]');
eq('行内代码里的 [[x]] 不误渲染', inline('`[[x]]`'), '<code>[[x]]</code>');
eq('粗体里的键帽 **[[x]]**', inline('**[[x]]**'), '<strong><kbd>x</kbd></strong>');
eq('键帽先到先得 [[a]](url)', inline('[[a]](url)'), '<kbd>a</kbd>(url)');
eq('普通链接不受键帽影响 [a](url)', inline('[a](url)'), '<a href="url">a</a>');

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
block('列表项内表格（缩进）', '1. 甲\n\n   | a | b |\n   | --- | --- |\n   | 1 | 2 |\n\n2. 乙\n',
  '<ol>\n  <li><p>甲</p>\n<div class="table-wrap">\n<table>\n  <thead>\n      <th>a</th>\n      <th>b</th>\n  </thead>\n  <tbody>\n      <tr>\n        <td>1</td>\n        <td>2</td>\n      </tr>\n  </tbody>\n</table>\n</div></li>\n  <li><p>乙</p></li>\n</ol>\n');
block('列表项内引用', '- 甲\n\n  > 引用内容\n',
  '<ul>\n  <li><p>甲</p>\n<blockquote>\n<p>引用内容</p>\n</blockquote></li>\n</ul>\n');
block('列表项内代码块', '- 甲\n\n  ```js\n  const x = 1;\n  ```\n',
  '<ul>\n  <li><p>甲</p>\n<pre><code class="lang-js">const x = 1;</code></pre></li>\n</ul>\n');
block('列表项内多块与段落', '1. 甲\n\n   第一段\n\n   | x |\n   | --- |\n   | 1 |\n\n   第二段\n',
  '<ol>\n  <li><p>甲</p>\n<p>第一段</p>\n<div class="table-wrap">\n<table>\n  <thead>\n      <th>x</th>\n  </thead>\n  <tbody>\n      <tr>\n        <td>1</td>\n      </tr>\n  </tbody>\n</table>\n</div>\n<p>第二段</p></li>\n</ol>\n');
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

console.log('── 评分卡（```score 围栏） ────────────────');

/* 多行期望值：逐行写、贴左对齐，空格的多少是断言的一部分 */
const L = (...ls) => ls.join('\n') + '\n';

/* 静音跑一段解析，收下它打出来的构建提醒（数据有问题时只提醒、不断构建） */
function quiet(fn) {
  const warns = [];
  const real = console.warn;
  console.warn = (m) => warns.push(m);
  try { return { html: fn(), warns }; } finally { console.warn = real; }
}

block('评分卡：整体形状（没有分数时只剩评语与分项）',
  '```score\n评语: 一句话\n演技: 在线\n```\n',
  L('<div class="score-card" data-reveal>',
    '  <p class="score-label">评分</p>',
    '  <p class="score-verdict">一句话</p>',
    '  <ul class="score-dims">',
    '    <li style="--r:0"><span class="sd-name">演技</span><span class="sd-num">在线</span></li>',
    '  </ul>',
    '</div>'));

const card = mdToHtml('```score\n8.5\n评语: 值得一看\n剧情: 9\n画面: 10\n```\n').html;
has('评分卡：围栏被吃掉，不是代码块', card, '<div class="score-card" data-reveal>');
has('评分卡：总分与满分', card, '<p class="score-total"><b>8.5</b><span class="score-max">/10</span></p>');
has('评分卡：8.5 → 前八格亮、第九格半亮、第十格空', card,
  '<i class="score-cell is-on" style="--i:7"></i><i class="score-cell is-half" style="--i:8"></i><i class="score-cell" style="--i:9"></i>');
has('评分卡：评语在分数与分项之间', card,
  '<p class="score-verdict">值得一看</p>\n  <ul class="score-dims">');
has('评分卡：分项名与分值', card, '<li style="--r:0"><span class="sd-name">剧情</span>');
has('评分卡：9 分的分项第九格亮、第十格空', card,
  '<i class="score-cell is-on" style="--i:8"></i><i class="score-cell" style="--i:9"></i></span><span class="sd-num">9</span>');
has('评分卡：行序号逐行加一（动效错峰用）', card, '<li style="--r:1">');
has('评分卡：刻度对读屏静音', card, '<span class="score-scale" aria-hidden="true">');
eq('评分卡：总分与两个分项各十格', (card.match(/score-cell/g) || []).length, 30);

const bare = mdToHtml('```score\n9\n```\n').html;
has('评分卡：裸数字当总分', bare, '<b>9</b><span class="score-max">/10</span>');

const five = mdToHtml('```score\n4.5/5\n```\n').html;
has('评分卡：满分照写', five, '<span class="score-max">/5</span>');
eq('评分卡：满分五分就画五格', (five.match(/score-cell/g) || []).length, 5);

const over = quiet(() => mdToHtml('```score\n总分: 12/10\n```\n').html);
eq('评分卡：超出满分的刻度封顶十格全亮', (over.html.match(/is-on/g) || []).length, 10);
eq('评分卡：超出满分只提醒一次', over.warns.length, 1);

const bad = quiet(() => mdToHtml('```score\n评分: 很好\n评语: 值\n```\n').html);
eq('评分卡：总分不是数字只提醒一次', bad.warns.length, 1);
has('评分卡：那行被忽略，其余照常', bad.html, '<p class="score-verdict">值</p>');

const empty = quiet(() => mdToHtml('```score\n\n```\n').html);
eq('评分卡：一行内容都没有时整块不渲染', empty.html, '');
eq('评分卡：空围栏也提醒一次', empty.warns.length, 1);

const titled = quiet(() => mdToHtml('```score\n```\n', { title: '星际穿越' }).html);
eq('评分卡：提醒带文章标题',
  titled.warns[0], '[build] 警告：《星际穿越》的评分卡：一行内容都没有，已跳过');

const sound = quiet(() => mdToHtml('```score\n8\n```\n', { title: '星际穿越' }).html);
eq('评分卡：数据没问题时不出声', sound.warns.length, 0);

/* 解析结果里的 score：正文第一张评分卡的总分，列表卡片的评分徽标用它 */
const s95 = mdToHtml('```score\n9.5\n剧情: 10\n```\n').score;
eq('评分提取：总分与满分', `${s95.value}/${s95.max}`, '9.5/10');

const sFive = mdToHtml('```score\n4.5/5\n```\n').score;
eq('评分提取：满分照报', `${sFive.value}/${sFive.max}`, '4.5/5');

eq('评分提取：没有评分卡就是 null', mdToHtml('正文\n').score, null);
eq('评分提取：只有分项、没有总分也是 null', mdToHtml('```score\n剧情: 9\n```\n').score, null);

const sTwo = mdToHtml('```score\n8\n```\n\n```score\n9\n```\n').score;
eq('评分提取：两张卡时只认第一张', `${sTwo.value}/${sTwo.max}`, '8/10');

const sBad = quiet(() => mdToHtml('```score\n评分: 很好\n评语: 值\n```\n')).html.score;
eq('评分提取：总分不是数字就不当评分', sBad, null);

const sEmpty = quiet(() => mdToHtml('```score\n\n```\n')).html.score;
eq('评分提取：空围栏不报评分', sEmpty, null);

console.log('── 折叠块（```fold 围栏） ─────────────────');

block('折叠块：整体形状（提示语在外，正文折叠）',
  '```fold\n剧透警告\n结局其实是**这样**。\n```\n',
  L('<details class="fold" data-reveal>',
    '  <summary class="fold-head"><span class="fold-label">剧透警告</span></summary>',
    '  <div class="fold-body"><div class="fold-inner"><p>结局其实是<strong>这样</strong>。</p>',
    '</div></div>',
    '</details>'));

const foldRich = mdToHtml('```fold\n展开看清单\n- 甲\n- 乙\n```\n').html;
has('折叠块：正文照常按 markdown 解析（列表）', foldRich, '<li>甲</li>');
has('折叠块：提示语走行内解析', mdToHtml('```fold\n**重要**\n正文\n```\n').html,
  '<span class="fold-label"><strong>重要</strong></span>');
has('折叠块：提示语留空用默认「此段封存」', mdToHtml('```fold\n\n正文\n```\n').html,
  '<span class="fold-label">此段封存</span>');

const foldEmpty = quiet(() => mdToHtml('```fold\n只写了提示语\n```\n').html);
eq('折叠块：只有提示语时整块不渲染', foldEmpty.html, '');
eq('折叠块：空块提醒一次', foldEmpty.warns.length, 1);
const foldTitled = quiet(() => mdToHtml('```fold\n\n```\n', { title: '星际穿越' }).html);
eq('折叠块：提醒带文章标题',
  foldTitled.warns[0], '[build] 警告：《星际穿越》的折叠块：没有可折叠的内容，已跳过');

/* 锚点：内层标题不进目录，但它的 sec-N 接着外层编号走，不与外层撞号 */
const foldHead = mdToHtml('```fold\n内层\n## 藏起来的标题\n```\n\n## 外面的标题\n');
eq('折叠块：内层标题不进目录', foldHead.headings.length, 1);
eq('折叠块：目录里是外层那个', foldHead.headings[0].text, '外面的标题');
has('折叠块：内层标题的锚点接着外层编号', foldHead.html, '<h2 id="sec-1">藏起来的标题</h2>');
has('折叠块：外层标题接在内层之后', foldHead.html, '<h2 id="sec-2">外面的标题</h2>');

/* 评分提取：折叠里的卡是「合着的内容」，不当全篇评分。
   外层一律四反引号开栅——三反引号会被内层的 ```score 行提前关掉
   （同长嵌套的歧义是 CommonMark 的固有规矩，构建日志会提醒误嵌，见文末用例） */
const foldNoScore = quiet(() =>
  mdToHtml('上面的正文\n\n````fold\n藏着结局\n\n```score\n9\n```\n````\n'));
eq('折叠块：内层评分卡不算全篇评分', foldNoScore.html.score, null);
has('折叠块：四反引号开栅时折叠块真的渲染', foldNoScore.html.html,
  '<details class="fold" data-reveal>');
has('折叠块：四反引号开栅时内层评分卡真的渲染', foldNoScore.html.html,
  '<div class="score-card" data-reveal>');
eq('折叠块：四反引号开栅不带误嵌提醒', foldNoScore.warns.length, 0);

const foldOuter = quiet(() =>
  mdToHtml('```score\n8\n```\n\n````fold\n藏着\n\n```score\n9\n```\n````\n'));
eq('折叠块：外层有卡时外层说了算', `${foldOuter.html.score.value}/${foldOuter.html.score.max}`, '8/10');
eq('折叠块：外层与折叠里的评分卡各画一张',
  (foldOuter.html.html.match(/class="score-card"/g) || []).length, 2);

/* 长围栏（CommonMark 式长度匹配）：折叠正文里要写代码块，就用四反引号开栅 */
const foldCode = mdToHtml('````fold\n展开看代码\n```js\nconst x = 1;\n```\n````\n').html;
has('折叠块：四反引号开栅，正文里能安稳放代码块', foldCode,
  '<pre><code class="lang-js">const x = 1;</code></pre>');
has('折叠块：代码块落在折叠正文里', foldCode, '<div class="fold-inner"><pre>');
eq('长围栏：四反引号代码块里的三反引号原样显示',
  mdToHtml('````\n```\n代码里的围栏\n```\n````\n').html,
  '<pre><code class="lang-plaintext">```\n代码里的围栏\n```</code></pre>\n');

console.log('── 提示框（```note 围栏） ─────────────────');

block('提示框：整体形状（整段都是正文）',
  '```note\n改配置前先**备份**。\n```\n',
  L('<div class="note" data-reveal><p>改配置前先<strong>备份</strong>。</p>',
    '</div>'));

/* 列表前照常留空行——紧跟段落的 `- 甲` 是段落续行，全站块级语法同一规矩 */
const noteRich = mdToHtml('```note\n注意事项：\n\n- 甲\n- 乙\n```\n').html;
has('提示框：正文照常按 markdown 解析（列表）', noteRich, '<li>甲</li>');
has('提示框：多段正文各成一段',
  mdToHtml('```note\n第一段。\n\n第二段。\n```\n').html,
  '</p>\n<p>第二段。</p>');

const noteCode = mdToHtml('````note\n先备份再改：\n```bash\ncp config config.bak\n```\n````\n').html;
has('提示框：四反引号开栅，正文里能安稳放代码块', noteCode,
  '<pre><code class="lang-bash">cp config config.bak</code></pre>');
has('提示框：代码块落在便笺内', noteCode, '<div class="note" data-reveal><p>先备份再改：</p>');

const noteEmpty = quiet(() => mdToHtml('```note\n\n```\n').html);
eq('提示框：一行内容都没有时整块不渲染', noteEmpty.html, '');
eq('提示框：空围栏提醒一次', noteEmpty.warns.length, 1);
const noteTitled = quiet(() => mdToHtml('```note\n\n```\n', { title: 'Hyprland 配置' }).html);
eq('提示框：提醒带文章标题',
  noteTitled.warns[0], '[build] 警告：《Hyprland 配置》的提示框：一行内容都没有，已跳过');
eq('提示框：内容正常时不出声',
  quiet(() => mdToHtml('```note\n提醒\n```\n')).warns.length, 0);

/* 同折叠块：内层标题不进目录，但 sec-N 接着外层编号走；内层评分不当全篇评分 */
const noteHead = mdToHtml('```note\n内层提醒\n## 便笺里的标题\n```\n\n## 外面的标题\n');
eq('提示框：内层标题不进目录', noteHead.headings.length, 1);
eq('提示框：目录里是外层那个', noteHead.headings[0].text, '外面的标题');
has('提示框：内层标题的锚点接着外层编号', noteHead.html, '<h2 id="sec-1">便笺里的标题</h2>');
has('提示框：外层标题接在内层之后', noteHead.html, '<h2 id="sec-2">外面的标题</h2>');

const noteNoScore = quiet(() =>
  mdToHtml('正文\n\n````note\n提醒\n\n```score\n9\n```\n````\n'));
eq('提示框：内层评分卡不算全篇评分', noteNoScore.html.score, null);
has('提示框：内层评分卡照常画在便笺里', noteNoScore.html.html, '<div class="score-card" data-reveal>');

console.log('── 代码行高亮（围栏信息 {3,5-7}）──────────');

block('行高亮：整体形状（行号表写进 data-hl）',
  '```js {2}\n第一行\n第二行\n```\n',
  L('<pre data-hl="2"><code class="lang-js">第一行',
    '第二行</code></pre>'));

block('行高亮：相连区间合并（{5,3-4,4} → 3-5）',
  '```js {5,3-4,4}\n1\n2\n3\n4\n5\n```\n',
  L('<pre data-hl="3-5"><code class="lang-js">1',
    '2',
    '3',
    '4',
    '5</code></pre>'));

has('行高亮：倒着写的区间按正序算（{7-5} → 5-7）',
  mdToHtml('```js {7-5}\n1\n2\n3\n4\n5\n6\n7\n```\n').html, 'data-hl="5-7"');
has('行高亮：区间收边到末行（{2-99} → 2-3）',
  mdToHtml('```js {2-99}\n1\n2\n3\n```\n').html, 'data-hl="2-3"');
has('行高亮：碎片两侧留白照常认（{ 2 , 3-4 }）',
  mdToHtml('```js { 2 , 3-4 }\n1\n2\n3\n4\n```\n').html, 'data-hl="2-4"');
has('行高亮：无语言照常（``` {2}）',
  mdToHtml('``` {2}\n1\n2\n```\n').html, '<pre data-hl="2"><code class="lang-plaintext">');

/* 单行超出实际行数整条丢弃——不悄悄收到末行；全无效时提醒一句，块照常渲染 */
const hlMiss = quiet(() =>
  mdToHtml('```js {99}\n1\n2\n3\n```\n', { title: 'Hyprland 配置' }).html);
has('行高亮：单行超界整条丢弃（不画线）', hlMiss.html, '<pre><code class="lang-js">');
eq('行高亮：全无效时提醒一次', hlMiss.warns.length, 1);
eq('行高亮：提醒的文案', hlMiss.warns[0],
  '[build] 警告：《Hyprland 配置》的代码行高亮：围栏里的「{99}」没解析出行号，高亮已跳过');
eq('行高亮：个别碎片写坏、还有效时静默',
  quiet(() => mdToHtml('```js {3,x}\n1\n2\n3\n```\n').html).warns.length, 0);
has('行高亮：坏碎片被略过，好行照样标',
  mdToHtml('```js {3,x}\n1\n2\n3\n```\n').html, 'data-hl="3"');

/* 行号表只归纯代码分支：特判围栏跟着的花括号照旧（与误嵌提醒同一套语义） */
has('行高亮：score 围栏跟着的花括号照旧是评分卡',
  mdToHtml('```score{8}\n9.5\n```\n').html, '<div class="score-card" data-reveal>');

/* 围栏在递归里照常带行号表（提示框/折叠块/引用/列表里走同一条路） */
has('行高亮：提示框里的代码块照常标行',
  mdToHtml('````note\n先备份：\n```bash {1}\ncp a b\n```\n````\n').html,
  '<pre data-hl="1"><code class="lang-bash">');

console.log('── 围栏误嵌提醒（长围栏的缘由）───────────');

/* 同长的带语言围栏会把外层的块提前关掉（CommonMark 的固有歧义，
   解法定在「外层加长」）——构建日志提醒一句，别让内容悄悄缺一截 */
const foldGuard = quiet(() =>
  mdToHtml('```fold\n剧透警告\n结局是这样\n\n```note\n提醒\n```\n```\n', { title: '星际穿越' }));
eq('误嵌提醒：折叠块里直接写 ```note 时提醒一次', foldGuard.warns.length, 1);
eq('误嵌提醒：折叠块的文案', foldGuard.warns[0],
  '[build] 警告：《星际穿越》的折叠块：正文里的 ```note 会提前把它关掉——要往里嵌围栏或代码块，外层得用更长的围栏开栅（四个反引号）');
has('误嵌提醒：提醒归提醒，折叠块本身照常渲染', foldGuard.html.html, '<p>结局是这样</p>');

const noteGuard = quiet(() =>
  mdToHtml('```note\n提醒内容\n\n```fold\n折叠\n```\n```\n', { title: 'Hyprland 配置' }));
eq('误嵌提醒：提示框里直接写 ```fold 时提醒一次', noteGuard.warns.length, 1);
eq('误嵌提醒：提示框的文案', noteGuard.warns[0],
  '[build] 警告：《Hyprland 配置》的提示框：正文里的 ```fold 会提前把它关掉——要往里嵌围栏或代码块，外层得用更长的围栏开栅（四个反引号）');

console.log('──────────────────────────────────────────');
console.log(`结果：${pass} 通过，${fail} 失败`);

if (fail > 0) {
  console.log('\n失败清单：');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
process.exit(0);
