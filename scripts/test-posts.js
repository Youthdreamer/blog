#!/usr/bin/env node
'use strict';

/* ============================================================
   test-posts.js — 文章归属（文件夹 = 合集）与正文链接改写回归测试

   用法：node scripts/test-posts.js   （或 pnpm test，与 markdown 测试一起跑）
   归属规则都收在 lib/content.js 的 seriesOfPath（路径 → 合集）与
   pickSeries（文件夹优先）两个纯函数里，前半段直接喂字符串断言，不碰任何文件。
   末段在系统临时目录里造一棵树跑 loadPosts(base)，钉住纯函数测不到的那半：
   文件名只取末段（slug 不带文件夹）、file 记相对路径、各类提醒的触发时机、
   正文 .md 链接的改写（见 lib/content.js 的 resolveMdLinks）。
   夹具只建在 os.tmpdir()，绝不碰仓库的 content/。
   ============================================================ */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { seriesOfPath, pickSeries, loadPosts } = require('../lib/content');

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

/* 包含式断言：整条提醒的文案太长，断关键片段就够，改文案时不至于连测试一起抄 */
function has(name, haystack, needle) {
  if (haystack.includes(needle)) {
    pass++;
    console.log(`  ✓ ${name}`);
    return;
  }
  fail++;
  failures.push({ name, actual: haystack, expected: `包含 ${needle}` });
  console.log(`  ✗ ${name}`);
  console.log(`      应包含: ${JSON.stringify(needle)}`);
  console.log(`      实际: ${JSON.stringify(haystack)}`);
}

/* 静音跑一段并收下构建提醒（loadPosts 用 console.warn 说话） */
function quiet(fn) {
  const warns = [];
  const real = console.warn;
  console.warn = (m) => warns.push(m);
  try {
    return { value: fn(), warns };
  } finally {
    console.warn = real;
  }
}

/* 返回值压成短标签，便于全等断言 */
const sp = (rel) => {
  const r = seriesOfPath(rel);
  if (!r) return '跳过';
  if (r.error) return '太深';
  return `合集：${r.series}`;
};
const ps = (folder, meta) => {
  const r = pickSeries(folder, meta);
  return `${r.series}|${r.warn ? '冲突' : '不冲突'}`;
};

console.log('──────────────────────────────────────────');
console.log('路径 → 归属');

eq('根下的文章：没有文件夹信息，回退 frontmatter', sp('first-letter.md'), '合集：');
eq('一层文件夹：文件夹名就是合集名', sp('个人影评/interstellar.md'), '合集：个人影评');
eq('中文与大小写原样保留', sp('Neovim教程/01.md'), '合集：Neovim教程');
eq('文件夹名首尾空白 trim 掉', sp('  个人影评  /x.md'), '合集：个人影评');
eq('两层文件夹：不算文章（提醒后跳过）', sp('个人影评/2026/x.md'), '太深');
eq('三层及以上同样', sp('a/b/c/d.md'), '太深');
eq('不是 .md：安静跳过', sp('notes.txt'), '跳过');
eq('文件夹里的非 .md（图片）也安静跳过', sp('个人影评/cover.png'), '跳过');
eq('_ 开头的文件夹：私用，安静跳过', sp('_drafts/wip.md'), '跳过');
eq('. 开头的文件夹：私用，安静跳过', sp('.trash/x.md'), '跳过');
eq('_ 开头的**文件**照旧发布（只有文件夹吃私用规矩）', sp('_foo.md'), '合集：');

console.log('');
console.log('文件夹优先');

eq('根下没写 series：没有合集', ps('', ''), '|不冲突');
eq('根下的文章：用 frontmatter', ps('', 'Neovim教程'), 'Neovim教程|不冲突');
eq('文件夹里没写 series：文件夹说了算', ps('个人影评', ''), '个人影评|不冲突');
eq('文件夹里写了同名：一致，不吭声', ps('个人影评', '个人影评'), '个人影评|不冲突');
eq('文件夹里写了别的名字：文件夹优先', ps('个人影评', '影视评论'), '个人影评|冲突');
has('冲突时提醒里点名被忽略的名字', pickSeries('个人影评', '影视评论').warn, '影视评论');

console.log('');
console.log('loadPosts 集成（临时目录）');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-'));
const mk = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp, rel), text);
};
const post = (title, slug, extra = '') =>
  `---\ntitle: ${title}\nslug: ${slug}\ndate: 2026-01-01\n${extra}---\n\n正文\n`;

try {
  mk('root-post.md', post('根下的文章', 'root-post'));
  mk('个人影评/interstellar.md', post('星际穿越', 'interstellar'));
  mk('个人影评/cover.png', '假装是图片');
  mk('Neovim教程/guide.md', post('入门', 'guide', 'series: Neovim教程\n'));
  mk('旧影评/dune.md', post('沙丘', 'dune', 'series: 影视评论\n'));
  mk('影评 /spacey.md', post('空白文件夹', 'spacey'));
  mk('_草稿/wip.md', post('草稿', 'wip'));
  mk('_草稿/draft2.md', post('草稿二', 'draft2', 'draft: true\n'));
  mk('深度/旧稿/x.md', post('太深', 'deep'));

  const { value: posts, warns } = quiet(() => loadPosts(tmp));
  const bySlug = Object.fromEntries(posts.map((p) => [p.slug, p]));
  const allWarns = warns.join('\n');

  eq(
    '收下的文章：草稿、私用文件夹、非 .md、过深的都不在内',
    posts.map((p) => p.slug).sort().join(','),
    'dune,guide,interstellar,root-post,spacey',
  );
  eq('文件夹里的文章：slug 只取文件名（不带文件夹）', bySlug.interstellar.slug, 'interstellar');
  eq('file 记相对路径（冲突报错要指得出文件夹）', bySlug.interstellar.file, '个人影评/interstellar.md');
  eq('文件夹即合集', bySlug.interstellar.series, '个人影评');
  eq('文件夹与 frontmatter 一致时照旧归入', bySlug.guide.series, 'Neovim教程');
  eq('不一致时文件夹说了算', bySlug.dune.series, '旧影评');
  eq('根下的文章仍看 frontmatter', bySlug['root-post'].series, '');
  has('冲突提醒指名道姓', allWarns, '《沙丘》');
  has('冲突提醒说清以谁为准', allWarns, '以文件夹为准');
  has('过深的提醒带上路径', allWarns, '深度/旧稿/x.md');
  has('空白文件夹名的提醒', allWarns, '名字首尾有空白');
  eq('一致时不刷屏', allWarns.includes('Neovim教程'), false);
  eq('私用文件夹不提醒', allWarns.includes('_草稿'), false);
  eq('非 .md 不提醒', allWarns.includes('cover.png'), false);

  /* 跨文件夹重名：URL 是扁平的，构建必须拦住（报错要能指出是哪个文件夹） */
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-dup-'));
  try {
    fs.writeFileSync(path.join(tmp2, 'a.md'), post('甲', 'dup'));
    fs.mkdirSync(path.join(tmp2, '个人影评'));
    fs.writeFileSync(path.join(tmp2, '个人影评', 'a.md'), post('乙', 'dup'));
    let msg = '';
    try {
      quiet(() => loadPosts(tmp2));
    } catch (e) {
      msg = e.message;
    }
    has('跨文件夹同名 slug：构建报错并指名文件夹', msg, '个人影评/a.md');
  } finally {
    fs.rmSync(tmp2, { recursive: true, force: true });
  }

  /* slug 里写进文件夹（URL 是扁平的）：给出能看懂的报错，而不是写到一半 ENOENT */
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-slug-'));
  try {
    fs.writeFileSync(path.join(tmp3, 'x.md'), post('斜杠', '个人影评/x'));
    let msg = '';
    try {
      quiet(() => loadPosts(tmp3));
    } catch (e) {
      msg = e.message;
    }
    has('slug 含斜杠：报错说清 URL 是扁平的', msg, '一律是扁平的');
  } finally {
    fs.rmSync(tmp3, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log('正文 .md 链接改写（临时目录）');

const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-mdlink-'));
const mk4 = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(tmp4, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp4, rel), text);
};
try {
  mk4(
    'source.md',
    '---\ntitle: 源头\nslug: source\ndate: 2026-01-02\n---\n\n' +
      '[甲](./target.md)、[带锚点](./target.md#sec-2)、[子文件夹](./个人影评/inside.md)、' +
      '[改了名](./中文文件.md)\n\n' +
      '[外链](https://example.com/note.md)、[绝对路径](/post/target.md)\n\n' +
      '[草稿](./wip.md)、[没这篇](./ghost.md)\n\n' +
      '[撞名](./dup.md)\n',
  );
  mk4('target.md', post('目标', 'target'));
  mk4('中文文件.md', '---\ntitle: 改名了\nslug: renamed\ndate: 2026-01-01\n---\n\n正文\n');
  mk4('个人影评/inside.md', post('夹里', 'inside'));
  mk4('个人影评/dup.md', post('甲篇', 'dup-a'));
  mk4('旧影评/dup.md', post('乙篇', 'dup-b'));
  mk4('wip.md', post('草稿目标', 'wip', 'draft: true\n'));

  const { value: ps4, warns: w4 } = quiet(() => loadPosts(tmp4));
  const src = ps4.find((p) => p.slug === 'source').html;
  const w = w4.join('\n');

  has('相对 .md 链接：改写成文章 URL', src, '<a href="target.html">甲</a>');
  has('带锚点：锚点原样跟上', src, '<a href="target.html#sec-2">');
  has('子文件夹里的文章：按文件名照样找得到', src, '<a href="inside.html">');
  has('frontmatter slug 覆盖文件名：按真实 slug 改写', src, '<a href="renamed.html">');
  has('外链不动', src, '<a href="https://example.com/note.md" target="_blank"');
  has('/ 开头的绝对路径不动', src, '<a href="/post/target.md">');
  has('指向草稿：链接保持原样', src, '<a href="./wip.md">');
  has('草稿的提醒指名道姓', w, '《草稿目标》还是草稿');
  has('找不到目标：链接保持原样', src, '<a href="./ghost.md">');
  has('找不到的提醒', w, '找不到对应的文章');
  has('同名多篇：不瞎猜，保持原样', src, '<a href="./dup.md">');
  has('撞名的提醒列出两边', w, '对上了多篇同名文章');
} finally {
  fs.rmSync(tmp4, { recursive: true, force: true });
}

console.log('──────────────────────────────────────────');
console.log(`结果：${pass} 通过，${fail} 失败`);

if (fail > 0) {
  console.log('\n失败清单：');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
process.exit(0);
