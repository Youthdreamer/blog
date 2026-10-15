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
const { collectScoreGroups } = require('../lib/build');

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

console.log('');
console.log('评分数据分工（临时目录）');

/* 评分墙与列表徽标共用一份 score；score_badge: false 只收徽标、不丢数据 */
const tmp5 = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-score-'));
const mk5 = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(tmp5, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp5, rel), text);
};
try {
  mk5('scored.md', '---\ntitle: 有分\nslug: scored\ndate: 2026-01-01\n---\n\n```score\n9.50\n```\n');
  mk5('hidden.md', '---\ntitle: 收徽标\nslug: hidden\ndate: 2026-01-02\nscore_badge: false\n---\n\n```score\n8.5\n```\n');
  mk5('noted.md', '---\ntitle: 带评语\nslug: noted\ndate: 2026-01-03\n---\n\n```score\n9.2\n评语: 硬得漂亮，苦得甘心\n玩法: 9\n```\n');
  mk5('plain.md', post('无分', 'plain'));
  const { value: pts5 } = quiet(() => loadPosts(tmp5));
  const b5 = Object.fromEntries(pts5.map((p) => [p.slug, p]));
  eq('有评分卡：score 先格式化再给视图层（9.50 → 9.5）',
    JSON.stringify(b5.scored.score), '{"value":"9.5","max":"10","note":""}');
  eq('评分卡里的评语带进 score.note（评分墙的短评要用）',
    b5.noted.score.note, '硬得漂亮，苦得甘心');
  eq('没写评语：note 是空串（不是缺字段）', b5.scored.score.note, '');
  eq('score_badge: false：score 照旧给出（评分墙要用）',
    JSON.stringify(b5.hidden.score), '{"value":"8.5","max":"10","note":""}');
  eq('score_badge: false → hideScoreBadge', b5.hidden.hideScoreBadge, true);
  eq('不写 score_badge：不隐藏徽标', b5.scored.hideScoreBadge, false);
  eq('没有评分卡：score 为 null', b5.plain.score, null);
} finally {
  fs.rmSync(tmp5, { recursive: true, force: true });
}

console.log('');
console.log('评分对象名（临时目录）');

/* subject：评分墙一行要的是评价对象本身，标题的副题不进卡面。
   归一成字符串（空串 = 没写），布尔之类的写法不落到视图里（见 lib/content.js） */
const tmp7 = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-subject-'));
try {
  fs.writeFileSync(
    path.join(tmp7, 'subjected.md'),
    post('空洞骑士：丝之歌——硬得漂亮', 'subjected', 'subject:  空洞骑士：丝之歌  \n'),
  );
  fs.writeFileSync(
    path.join(tmp7, 'flag.md'),
    post('写成了布尔', 'flag', 'subject: true\n'),
  );
  fs.writeFileSync(path.join(tmp7, 'plain.md'), post('没写对象', 'plain'));

  const { value: pts7 } = quiet(() => loadPosts(tmp7));
  const b7 = Object.fromEntries(pts7.map((p) => [p.slug, p]));
  eq('subject：评分墙的条目名（首尾空白 trim 掉）', b7.subjected.subject, '空洞骑士：丝之歌');
  eq('没写 subject：空串（视图回退到标题）', b7.plain.subject, '');
  eq('subject 写成 true 之类的非字符串：归一成空串', b7.flag.subject, '');
} finally {
  fs.rmSync(tmp7, { recursive: true, force: true });
}

console.log('');
console.log('封面解析（临时目录）');

/* cover 写 md 同目录的相对路径：解析成 img/<slug>.<ext>（评分墙拿它当海报）。
   文件不在就当没写、提醒一句——封面是可选字段，不该为一个笔误让构建倒下 */
const tmp6 = fs.mkdtempSync(path.join(os.tmpdir(), 'youth-posts-cover-'));
const mk6 = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(tmp6, rel)), { recursive: true });
  fs.writeFileSync(path.join(tmp6, rel), text);
};
try {
  mk6('海报.jpg', '假装是图片');
  mk6('draw/art.PNG', '假装是图片');
  mk6('with-cover.md', post('带封面', 'with-cover', 'cover: 海报.jpg\n'));
  mk6('with-sub.md', post('子目录封面', 'with-sub', 'cover: draw/art.PNG\n'));
  mk6('missing.md', post('丢封面', 'missing', 'cover: nope.jpg\n'));
  mk6('remote.md', post('图床封面', 'remote', 'cover: https://img.example.com/poster.jpg?v=2\n'));
  mk6('no-cover.md', post('没封面', 'no-cover'));

  const { value: pts6, warns: w6 } = quiet(() => loadPosts(tmp6));
  const b6 = Object.fromEntries(pts6.map((p) => [p.slug, p]));
  const w6all = w6.join('\n');

  eq('cover 解析成站内输出路径（img/<slug>.<ext>）', b6['with-cover'].cover, 'img/with-cover.jpg');
  eq('coverSrc 指向源文件（构建期照它拷贝）', b6['with-cover'].coverSrc, path.join(tmp6, '海报.jpg'));
  eq('相对 md 所在路径解析，扩展名统一小写', b6['with-sub'].cover, 'img/with-sub.png');
  eq('文件不在：cover 当没写', b6.missing.cover, null);
  has('文件不在的提醒指名道姓', w6all, '《丢封面》');
  has('提醒里带上写错的路径', w6all, 'nope.jpg');
  eq('完整 URL：原样当 cover（图床外链）', b6.remote.cover, 'https://img.example.com/poster.jpg?v=2');
  eq('外链没有源文件可拷：coverSrc 为 null', b6.remote.coverSrc, null);
  eq('外链不提醒（远端的事构建期管不着）', w6all.includes('图床封面'), false);
  eq('没写 cover：安静 null', b6['no-cover'].cover, null);
} finally {
  fs.rmSync(tmp6, { recursive: true, force: true });
}

console.log('');
console.log('评分墙分组（纯函数，直接喂数据）');

/* 甲合集：两篇 9.5（同分比日期）+ 一篇 4.5/5（折成十分制 9.0）+ 一篇无分；
   乙合集整组无分；散篇一篇 8.2 在组外收尾 */
const at = (slug, val, max, dateISO, series) => ({
  slug,
  dateISO,
  series: series || '',
  score: val == null ? null : { value: String(val), max: String(max) },
});
const scorePosts = [
  at('jia-1', 9.5, 10, '2026-03-01', '甲合集'),
  at('jia-2', 9.5, 10, '2026-05-01', '甲合集'),
  at('jia-3', 4.5, 5, '2026-02-01', '甲合集'),
  at('jia-4', null, null, '2026-01-01', '甲合集'),
  at('yi-1', null, null, '2026-01-01', '乙合集'),
  at('loose-1', 8.2, 10, '2026-01-01', ''),
];
const slist = [
  ['甲合集', scorePosts.slice(0, 4)],
  ['乙合集', scorePosts.slice(4, 5)],
];
const g = collectScoreGroups(scorePosts, slist);
eq('没有分的文章不进组、整组没分就不出组', g.groups.map((x) => x.name).join('|'), '甲合集|');
eq('组内按总分降序，同分日期新的在前，4.5/5 折成十分制参与排序',
  g.groups[0].posts.map((p) => p.slug).join(','), 'jia-2,jia-1,jia-3');
eq('组均分（折算后的平均，9.333… → 9.33）', g.groups[0].avgText, '9.33');
eq('没归合集的收尾一组「散篇」（name 空串）',
  `${g.groups[1].name}|${g.groups[1].posts[0].slug}`, '|loose-1');
eq('总篇数与总均分（36.2 / 4）', `${g.count}|${g.avgText}`, '4|9.05');
const empty = collectScoreGroups([], []);
eq('一篇都没有：安静空态', `${empty.count}|${empty.avgText}|${empty.groups.length}`, '0||0');

console.log('──────────────────────────────────────────');
console.log(`结果：${pass} 通过，${fail} 失败`);

if (fail > 0) {
  console.log('\n失败清单：');
  for (const f of failures) console.log(`  - ${f.name}`);
  process.exit(1);
}
process.exit(0);
