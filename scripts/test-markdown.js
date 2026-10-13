#!/usr/bin/env node
'use strict';

/* ============================================================
   test-markdown.js — Markdown 解析器全语法回归测试

   用法：node scripts/test-markdown.js   （或 npm test）
   覆盖 README 承诺的全部语法：粗体 / 斜体 / 删除线 / 行内代码 /
   内外链接 / 图片（含图注）/ 键帽（[[Ctrl+w]]）/ 剧透遮罩（||……||）/ 引用 / 列表 / 标题 / 分隔线 /
   围栏代码块（含行高亮 {3,5-7}）/ 表格（GFM 对齐）/ 评分卡（```score，含列表徽标用的总分提取）/
   折叠块（```fold，含锚点接续与长围栏）/ 提示框（```note，含围栏误嵌提醒）/
   脚注（[^1] 引用与定义汇总，含三种构建提醒），
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

console.log('── 剧透遮罩（||……||）──────────────────────');

eq('遮罩 ||结局他赢了||',
  inline('剧透：||结局他赢了||'),
  '剧透：<span class="spoiler" tabindex="0">结局他赢了</span>');
eq('遮罩内容走行内语法 ||**重点**||',
  inline('||**重点**||'),
  '<span class="spoiler" tabindex="0"><strong>重点</strong></span>');
eq('遮罩内容转义 ||<b>||',
  inline('||<b>||'),
  '<span class="spoiler" tabindex="0">&lt;b&gt;</span>');
eq('未闭合 || 原样输出', inline('没闭合 || 原样'), '没闭合 || 原样');
/* 空遮罩保持字面：与 ~~ 的空删除线（出空 <del>）有意不同——空的可聚焦
   span 更糟；四连整段收走，不与后面的 || 再配对，||||x|||| 不藏字 */
eq('空遮罩 |||| 原样输出', inline('||||'), '||||');
eq('空遮罩四连不与后文再配对 ||||x||||', inline('||||x||||'), '||||x||||');
/* 裸写两个独立 || 会被配成一个遮罩——README 已知边界，进反引号即可 */
eq('裸写的两个 || 配对成遮罩 a || b || c',
  inline('a || b || c'),
  'a <span class="spoiler" tabindex="0"> b </span> c');
eq('行内代码里的 || 不误渲染', inline('`||不改||`'), '<code>||不改||</code>');
eq('键帽里的 || 不误渲染', inline('[[||]]'), '<kbd>||</kbd>');
block('遮罩：段落里的一条', '结局：||他赢了||\n',
  '<p>结局：<span class="spoiler" tabindex="0">他赢了</span></p>\n');

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

console.log('── 脚注（[^1] 引用与定义）─────────────');

block('脚注：整体形状（引用出上标，定义汇总文末）',
  '正文引用[^1]。\n\n[^1]: 第一条定义\n',
  L('<p>正文引用<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup>。</p>',
    '<section class="footnotes" data-reveal>',
    '<p class="fn-label">脚注</p>',
    '<ol>',
    '<li id="fn-1">第一条定义 <a class="fn-back" href="#fnref-1" aria-label="回到引用">↩</a></li>',
    '</ol>',
    '</section>'));

/* 同一标签多处引用：只有第一处带 id（回跳的落点），其余只出号码 */
const fnRepeat = mdToHtml('再看[^a] 和 [^a]。\n\n[^a]: 甲\n').html;
has('脚注：第一处引用带回跳锚点 id', fnRepeat,
  '<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup>');
has('脚注：重复引用只出号码、不带 id', fnRepeat,
  '<sup class="fn-ref"><a href="#fn-1">1</a></sup>');
eq('脚注：回跳锚点全篇只挂一处', (fnRepeat.match(/id="fnref-1"/g) || []).length, 1);

/* 编号看引用顺序，不看定义摆放顺序——定义倒着写也照引用序发号 */
block('脚注：编号按首次引用顺序（定义倒着写也照引用序）',
  '先 B[^b] 后 A[^a]。\n\n[^a]: 甲\n[^b]: 乙\n',
  L('<p>先 B<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup> 后 A<sup class="fn-ref"><a href="#fn-2" id="fnref-2">2</a></sup>。</p>',
    '<section class="footnotes" data-reveal>',
    '<p class="fn-label">脚注</p>',
    '<ol>',
    '<li id="fn-1">乙 <a class="fn-back" href="#fnref-1" aria-label="回到引用">↩</a></li>',
    '<li id="fn-2">甲 <a class="fn-back" href="#fnref-2" aria-label="回到引用">↩</a></li>',
    '</ol>',
    '</section>'));

has('脚注：标签不限数字（[^注] 之类照常）',
  mdToHtml('看这里[^注]。\n\n[^注]: 中文标签也行\n').html,
  '<li id="fn-1">中文标签也行 <a class="fn-back" href="#fnref-1"');
has('脚注：缩进续行并入定义（剥 2 格）',
  mdToHtml('引用[^1]。\n\n[^1]: 第一行\n  第二行\n').html,
  '<li id="fn-1">第一行\n第二行 <a class="fn-back"');
has('脚注：定义正文走行内语法（链接/粗体照常）',
  mdToHtml('引用[^1]。\n\n[^1]: 见[官方文档](https://example.com)与**重点**\n').html,
  '<li id="fn-1">见<a href="https://example.com" target="_blank" rel="noopener">官方文档</a>与<strong>重点</strong> <a class="fn-back"');

/* 定义行在正文里不留痕：紧跟段落与表格行（无空行）都要被接住 */
block('脚注：定义紧跟段落（无空行）也被接住',
  '一段话。[^1]\n[^1]: 定义\n',
  L('<p>一段话。<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup></p>',
    '<section class="footnotes" data-reveal>',
    '<p class="fn-label">脚注</p>',
    '<ol>',
    '<li id="fn-1">定义 <a class="fn-back" href="#fnref-1" aria-label="回到引用">↩</a></li>',
    '</ol>',
    '</section>'));

const fnTable = quiet(() =>
  mdToHtml('看这个[^1]。\n\n| a |\n| --- |\n| 1 |\n[^1]: 定义\n').html);
eq('脚注：定义紧跟表格行也被接住、不出声', fnTable.warns.length, 0);
has('脚注：表格后的定义进了文末', fnTable.html, '<li id="fn-1">定义 <a class="fn-back" href="#fnref-1"');
eq('脚注：表格后的定义不成段落', fnTable.html.includes('<p>[^1]:'), false);

/* ctx 透传钉子：引用写在粗体/遮罩/引用块/表格单元里都照常认 */
has('脚注：粗体里的引用照常认（ctx 透传）',
  mdToHtml('**粗[^1]**\n\n[^1]: 甲\n').html,
  '<strong>粗<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup></strong>');
has('脚注：遮罩里的引用照常认（ctx 透传）',
  mdToHtml('||遮[^1]||\n\n[^1]: 甲\n').html,
  '<span class="spoiler" tabindex="0">遮<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup></span>');
has('脚注：引用块里的引用照常认（ctx 透传）',
  mdToHtml('> 引用里也要出处[^1]\n\n[^1]: 甲\n').html,
  '<blockquote>\n<p>引用里也要出处<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup></p>\n</blockquote>');
has('脚注：表格单元格里的引用照常认（ctx 透传）',
  mdToHtml('| 来源 |\n| --- |\n| 官方[^1] |\n\n[^1]: 甲\n').html,
  '<td>官方<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup></td>');

/* 折叠块里写的引用与定义：账本跟着递归走，最外层统一汇总（只出一个区） */
const fnFold = quiet(() =>
  mdToHtml('外面引用[^1]。\n\n```fold\n点开看\n里面引用[^2]\n[^2]: 折里的定义\n```\n\n[^1]: 甲\n').html);
eq('脚注：折叠块里的引用与定义也汇总文末、不出声', fnFold.warns.length, 0);
has('脚注：折叠块里的引用照常出号',
  fnFold.html,
  '<div class="fold-inner"><p>里面引用<sup class="fn-ref"><a href="#fn-2" id="fnref-2">2</a></sup></p>');
has('脚注：折里的定义进了文末', fnFold.html, '<li id="fn-2">折里的定义 <a class="fn-back" href="#fnref-2"');
eq('脚注：全篇只拼一个「脚注」区', (fnFold.html.match(/class="footnotes"/g) || []).length, 1);

/* 标题里的引用：正文照常出号，目录文本剥掉占位（先剥占位再剥标签） */
const fnHead = mdToHtml('## 标题[^1]\n\n[^1]: 一\n');
eq('脚注：标题里引用——目录不带号', fnHead.headings[0].text, '标题');
has('脚注：标题正文里照常出号', fnHead.html,
  '<h2 id="sec-1">标题<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup></h2>\n');

const fnHeadStrip = quiet(() => mdToHtml('## 标题[^<b>]\n', { title: '星际穿越' }));
eq('脚注：目录剥占位不留残渣（标签含尖括号时）', fnHeadStrip.html.headings[0].text, '标题');
has('脚注：没定义的引用正文里还原字面、标签照转义',
  fnHeadStrip.html.html, '<h2 id="sec-1">标题[^&lt;b&gt;]</h2>');

/* 三种构建提醒：重复定义 / 引用没有定义 / 定义没人引用 */
const fnDup = quiet(() => mdToHtml('[^1]。\n\n[^1]: 先\n[^1]: 后\n', { title: '星际穿越' }).html);
eq('脚注：重复定义提醒一次', fnDup.warns.length, 1);
eq('脚注：重复定义提醒的文案', fnDup.warns[0],
  '[build] 警告：《星际穿越》的脚注：[^1] 的定义写了不止一次，后一个已忽略（只认第一个）');
has('脚注：重复定义只认第一个', fnDup.html, '<li id="fn-1">先 <a class="fn-back"');

const fnMiss = quiet(() => mdToHtml('引用[^ok] 和 [^ghost]。\n\n[^ok]: 有\n', { title: '星际穿越' }).html);
eq('脚注：引用没有定义时提醒一次', fnMiss.warns.length, 1);
eq('脚注：引用没有定义提醒的文案', fnMiss.warns[0],
  '[build] 警告：《星际穿越》的脚注：引用 [^ghost] 没有对应定义，保持原样');
has('脚注：没有定义的引用还原成字面', fnMiss.html,
  '<p>引用<sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup> 和 [^ghost]。</p>');

const fnLonely = quiet(() => mdToHtml('正文。\n\n[^lonely]: 没人用\n', { title: '星际穿越' }).html);
eq('脚注：定义没人引用时提醒一次', fnLonely.warns.length, 1);
eq('脚注：定义没人引用提醒的文案', fnLonely.warns[0],
  '[build] 警告：《星际穿越》的脚注：定义 [^lonely] 没有地方引用，已忽略');
eq('脚注：没人引用的定义不拼区', fnLonely.html, '<p>正文。</p>\n');

/* 容错与边界：无效标签静默；引用先于链接；代码里不认；占位不残留 */
const fnBadLabel = quiet(() => mdToHtml('空标签[^] 与空白标签[^a b]。\n').html);
eq('脚注：空标签与含空白的标签不认', fnBadLabel.html, '<p>空标签[^] 与空白标签[^a b]。</p>\n');
eq('脚注：无效标签不出声', fnBadLabel.warns.length, 0);

has('脚注：引用先于链接（[^1](url) 按脚注意图走）',
  mdToHtml('[^1](url)。\n\n[^1]: 甲\n').html,
  '<p><sup class="fn-ref"><a href="#fn-1" id="fnref-1">1</a></sup>(url)。</p>');

eq('脚注：裸 inline（无 ctx）时引用保持字面', inline('[^1]'), '[^1]');
eq('脚注：无引用无定义时输出不变', mdToHtml('正文。\n').html, '<p>正文。</p>\n');

const fnCode = quiet(() => mdToHtml('看 `[^1]` 就行\n').html);
eq('脚注：行内代码里的引用不渲染', fnCode.html, '<p>看 <code>[^1]</code> 就行</p>\n');
eq('脚注：行内代码里的引用不提醒', fnCode.warns.length, 0);
has('脚注：代码块里的 [^1]: 照旧是代码',
  mdToHtml('```\n[^1]: 不是定义\n```\n').html,
  '<code class="lang-plaintext">[^1]: 不是定义</code>');

/* 工作队列：定义正文里的引用照常编号（二层定义跟着解析）；
   没人引用的定义正文根本不解析，幽灵引用不会被拉进提醒 */
const fnChain = mdToHtml('引用[^1]。\n\n[^1]: 见[^2]\n[^2]: 二层\n').html;
has('脚注：定义正文里再引用照常编号（工作队列）', fnChain,
  '<li id="fn-1">见<sup class="fn-ref"><a href="#fn-2" id="fnref-2">2</a></sup> <a class="fn-back" href="#fnref-1"');
has('脚注：二层定义照常成条目', fnChain, '<li id="fn-2">二层 <a class="fn-back" href="#fnref-2"');

const fnJunk = quiet(() => mdToHtml('引用[^1]。\n\n[^1]: 甲\n[^unused]: 见[^ghost]\n', { title: '星际穿越' }));
eq('脚注：没人引用的定义正文不解析（不留幽灵提醒）', fnJunk.warns.length, 1);
eq('脚注：幽灵引用不会被拉进提醒', fnJunk.warns[0],
  '[build] 警告：《星际穿越》的脚注：定义 [^unused] 没有地方引用，已忽略');

const fnNul = quiet(() => mdToHtml('引用[^1] 与没定义的[^ghost]。\n\n[^1]: 甲\n').html);
eq('脚注：占位符一个不残留', fnNul.html.includes('\0'), false);

console.log('──────────────────────────────────────────');
console.log(`结果：${pass} 通过，${fail} 失败`);

if (fail > 0) {
  console.log('\n失败清单：');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
process.exit(0);
