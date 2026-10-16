#!/usr/bin/env node
'use strict';

/* ============================================================
   check.js — 文章体检（构建前的内容 lint，零依赖）
   给作者的安全网：把「构建会崩 / 会静默出错」的地方拦下来，把「能跑但不
   讲究」的地方提醒一句。两类口径：

     错误（✗，退出码 1）——组件/围栏语法、frontmatter 字段与类型、死链、封面
     提醒（·）          ——中文排版、落单的高亮标记、疑似被当键帽的 Lua 长字符串、
                          阅读时长与篇幅明显不符 / 未来的日期（这两条草稿不算）、
                          标签近似拼写（归一后撞页或只差一个字符）

   体检是内容 lint，与代码回归是两件事：不挂在 pnpm test 里。
   用法：node scripts/check.js [postsDir]   （或 pnpm run check）
         给了目录就只查那个目录（坏例夹具靠它），站点页面一档跳过
   ============================================================ */

const fs = require('fs');
const path = require('path');
const { KINDS, PROSE_FENCES } = require('../lib/components');
const { PATHS } = require('../lib/config');
const { loadPosts, loadPages, listPostFiles, seriesOfPath } = require('../lib/content');
const { mdToHtml, parseFrontmatter } = require('../lib/markdown');
const { slugify, readMinutes } = require('../lib/utils');

/* ---------- 终端配色（仅 TTY 时启用，管道输出保持纯净，同 new.js） ---------- */
const TTY = !!process.stdout.isTTY;
const C = {
  gold: TTY ? '\x1b[38;2;185;163;124m' : '', // 站点香槟金
  red: TTY ? '\x1b[38;2;198;118;104m' : '', // 错误：一档压暗的砖红
  dim: TTY ? '\x1b[2m' : '',
  reset: TTY ? '\x1b[0m' : '',
};
const gold = (msg) => console.log(C.gold + msg + C.reset);
const dim = (msg) => console.log(C.dim + msg + C.reset);
const red = (msg) => console.log(C.red + msg + C.reset);

/* ---------- 通用 ---------- */

/* 跑一段构建代码，收走它的 console.warn，也接住它抛的错（slug 冲突、
   date 无效崩在 toISOString——都在这条路上） */
function run(fn) {
  const warns = [];
  const orig = console.warn;
  console.warn = (msg) => warns.push(String(msg));
  try {
    return { value: fn(), warns, error: null };
  } catch (e) {
    return { value: null, warns, error: e };
  } finally {
    console.warn = orig;
  }
}

const strip = (msg) => msg.replace(/^\[build\] (?:警告：)?/, '');

/* 编辑距离：拼错字段名给建议用（upadted → updated） */
function dist(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
function nearest(key) {
  let best = '';
  for (const f of FIELDS) {
    if (dist(key, f) <= 2 && (!best || dist(key, f) < dist(key, best))) best = f;
  }
  return best;
}

/* ---------- 构建警告的分类 ----------
   文案是 lib/content.js 与 lib/markdown.js 里写死的，这里按关键词对号。
   DROP 的那几种是 loadPosts 内部那次 mdToHtml 发的组件提醒——逐文件一档
   还会原样报一遍，不丢就双报 */
const DROP = Object.values(KINDS).map((k) => `的${k}：`); // 组件 kind 表在 lib/components.js
const BUILD_ERRORS = ['找不到对应的文章', '对上了多篇同名文章', '名字首尾有空白', '与文件夹名不一致', '的封面找不到', '已跳过'];
const BUILD_WARNS = ['还是草稿，链接保持原样', '文件名含中文且未写 slug'];
function classify(msg) {
  if (DROP.some((s) => msg.includes(s))) return 'drop';
  if (BUILD_ERRORS.some((s) => msg.includes(s))) return 'error';
  if (BUILD_WARNS.some((s) => msg.includes(s))) return 'warn';
  return 'warn';
}

/* ---------- frontmatter 字段表（与 README 的字段参考、new.js 向导同表） ---------- */
const FIELDS = ['title', 'slug', 'date', 'updated', 'tags', 'series', 'series_order',
  'summary', 'minutes', 'draft', 'pin', 'toc', 'score_badge', 'cover', 'subject'];
const BOOL_FIELDS = ['draft', 'pin', 'toc', 'score_badge'];
const NUM_FIELDS = ['series_order', 'minutes'];

/* 文件行号映射：正文第 i 行（0 起）在文件里是第几行。
   与 parseFrontmatter 用同一处切分（第二个 --- 之后就是正文） */
function lineMapper(raw) {
  const end = raw.indexOf('---', raw.indexOf('---') + 3);
  const hasFm = raw.startsWith('---') && end !== -1;
  const before = hasFm ? raw.slice(0, end + 3) : '';
  const base = (before.match(/\n/g) || []).length + 1;
  return (i) => base + i;
}

/* ---------- 正文的剥离：围栏感知 ----------
   返回「正文行」（含正文行号）：围栏里的代码整段剥掉；fold / note / tip / warn
   里子是正文，递归进去接着剥（与 mdToHtml 的递归同构）。没有收尾的围栏其内容
   本来就会被丢掉，这里也不当正文报 */

/* 里子是正文的围栏（fold + 便笺家族）——名单在 lib/components.js（PROSE_FENCES）。
   扫描逻辑仍是本文件自含一套（与 mdToHtml 同构），不引 markdown.js 的函数 */
function proseLines(text, out, baseLine) {
  const lines = text.split('\n');
  let inCode = false;
  let fenceLen = 3;
  let lang = '';
  let buf = [];
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const f = lines[i].match(/^(`{3,})(\w*)\s*(?:\{([^}]*)\})?\s*$/);
    if (f && (!inCode || f[1].length >= fenceLen)) {
      if (!inCode) { inCode = true; fenceLen = f[1].length; lang = f[2]; buf = []; start = i + 1; }
      else {
        if (PROSE_FENCES.has(lang)) proseLines(buf.join('\n'), out, baseLine + start);
        inCode = false;
      }
      continue;
    }
    if (inCode) buf.push(lines[i]);
    else out.push({ line: baseLine + i, text: lines[i] });
  }
  return out;
}

/* 行内剥离（留文字、去语法）：代码里的东西一不算排版、二不算标记 */
const stripCode = (s) => s.replace(/`[^`\n]*`/g, '');
const stripRefs = (s) => stripCode(s)
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')            // 图片连 alt 一起（alt 是给机器看的）
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')         // 链接留文字、去地址
  .replace(/https?:\/\/[^\s)）]+/g, '')             // 裸地址
  .replace(/\[\^[^\]]*\]/g, '');                    // 脚注引用
const stripInline = (s) => stripRefs(s).replace(/\[\[[^\]]*\]\]/g, ''); // 再去键帽

/* ---------- 排版（提醒） ---------- */
const CJK = '\\u4e00-\\u9fa5';
const EX_UNITS = '年月日号时分秒'; // 「2026年10月」这类数字贴日期单位是正常汉语，不唠叨

function typoHits(line) {
  const s = stripInline(line);
  const hits = [];
  let m;
  // 中英、中数相邻：中文abc / abc中文 / 30行（「6年」这种日期单位放行）
  const reLatin = new RegExp(`([${CJK}])([A-Za-z0-9])|([A-Za-z0-9])([${CJK}])`, 'g');
  while ((m = reLatin.exec(s))) {
    const cjk = m[1] || m[4];
    const lat = m[2] || m[3];
    if (/\d/.test(lat) && EX_UNITS.includes(cjk)) continue;
    hits.push({ at: m.index, text: m[0], kind: 'space' });
  }
  // 中文旁夹半角标点：中文,中文。「hello, 中文」这种英文句尾的半角标点不算
  const rePunc = new RegExp(`([${CJK}])([,;:?!])|([,;:?!])([${CJK}])`, 'g');
  while ((m = rePunc.exec(s))) {
    if (m[3] && /[A-Za-z0-9]/.test(s[m.index - 1] || '')) continue;
    hits.push({ at: m.index, text: m[0], kind: 'punct', punc: m[2] || m[3] });
  }
  return hits;
}

/* ---------- 落单的高亮标记（提醒） ----------
   与 lib/markdown.js 的 inline() 同一套守卫：开栅前一个字符不能是 ASCII
   单词字符、后面不能紧跟空格；闭合前一个字符不能是空格。只报落单的
   「开栅」——孤立的闭栅（C++ 这类）自然安静 */
function unpairedMarkers(text) {
  const hits = [];
  for (const marker of ['==', '++']) {
    for (let i = 0; i + 2 < text.length; i++) {
      if (!text.startsWith(marker, i)) continue;
      const prev = i === 0 ? '' : text[i - 1];
      if (prev && /[A-Za-z0-9_]/.test(prev)) continue;
      const next = text[i + 2];
      if (next === undefined || next === ' ') continue;
      let end = -1;
      for (let k = text.indexOf(marker, i + 2); k !== -1; k = text.indexOf(marker, k + 2)) {
        if (text[k - 1] !== ' ') { end = k; break; }
      }
      if (end !== -1 && end > i + 2) { i = end + 1; continue; } // 配上了，整段跳过
      if (end === i + 2) { i += 3; continue; }                  // ==== 四连是字面
      hits.push({ marker, at: i });
    }
  }
  return hits;
}

/* ---------- 已发布的 slug / 合集（死链比对用；草稿不算——线上会 404） ---------- */
function collectPublished(base) {
  const slugs = new Set();
  const series = new Set();
  for (const rel of listPostFiles(base)) {
    const at = seriesOfPath(rel);
    if (!at || at.error) continue;
    let meta = {};
    try {
      meta = parseFrontmatter(fs.readFileSync(path.join(base, rel), 'utf8')).meta;
    } catch (e) { continue; }
    if (meta.draft) continue;
    slugs.add(String(meta.slug || path.basename(rel, '.md')).trim());
    const metaSeries = typeof meta.series === 'string' ? meta.series.trim() : '';
    const name = at.series || metaSeries; // 文件夹优先（同 pickSeries）
    if (name) series.add(slugify(name));
  }
  return { slugs, series };
}

/* ---------- 逐文件体检 ---------- */
function checkPost(base, rel, slugs, seriesSlugs, item) {
  const raw = fs.readFileSync(path.join(base, rel), 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  const title = meta.title || path.basename(rel, '.md');
  const lineOf = lineMapper(raw);

  checkFrontmatter(raw, meta, body, item);

  // 组件 / 围栏语法：与构建同一套 ctx，提醒都是错误级（写坏的内容不该流出）
  const render = run(() => mdToHtml(body, { title }));
  for (const w of render.warns) item.errors.push({ line: 0, text: strip(w) });

  // 死链：正文里手写的 /post/xxx.html、/series/xxx.html 与已发布集合比对
  if (render.value) checkDeadLinks(render.value.html, slugs, seriesSlugs, item);

  // 正文级：排版、落单标记、疑似 Lua 长字符串的键帽
  const prose = proseLines(body, [], 0); // line 是正文内行号（0 起）
  const typos = [];
  for (const p of prose) {
    const no = lineOf(p.line);
    for (const h of typoHits(p.text)) typos.push({ ...h, line: no });
    const brief = stripInline(p.text);
    for (const h of unpairedMarkers(brief)) {
      item.warns.push({
        line: no,
        text: `「${h.marker}」开了没关上：会原样显示——想涂高亮就补上闭合的 ${h.marker}，想写字面就用行内代码包住`,
      });
    }
    let m;
    const reKbd = /\[\[([^\]]+)\]\]/g;
    while ((m = reKbd.exec(stripRefs(p.text)))) {
      if (m[1].length >= 4 && /^[a-z_][a-z0-9_.]*$/.test(m[1])) {
        item.warns.push({ line: no, text: `[[${m[1]}]] 像 Lua 的长字符串（'[[x]]'），会渲染成键帽——是本意就带过，不是就用反引号包住` });
      }
    }
  }
  // 排版提醒最多列 5 条，其余收成一句
  const FULL = { ',': '，', ';': '；', ':': '：', '?': '？', '!': '！' };
  for (const t of typos.slice(0, 5)) {
    item.warns.push({
      line: t.line,
      text: t.kind === 'punct'
        ? `「${t.text}」中文旁夹了半角「${t.punc}」，建议换成「${FULL[t.punc]}」（排版建议，可忽略）`
        : `「${t.text}」中英/数字之间建议留空格（排版建议，可忽略）`,
    });
  }
  if (typos.length > 5) item.warns.push({ line: 0, text: `还有 ${typos.length - 5} 处同类排版建议（这一篇共 ${typos.length} 处）` });
  // 按行号排（稳定排序）：读起来顺，构建级那种没有行号的排最前
  item.errors.sort((a, b) => a.line - b.line);
  item.warns.sort((a, b) => a.line - b.line);
}

function checkFrontmatter(raw, meta, body, item) {
  const end = raw.indexOf('---', raw.indexOf('---') + 3);
  const E = (line, text) => item.errors.push({ line, text });
  const W = (line, text) => item.warns.push({ line, text });
  // 站点级标签近似检查（checkTagCloseness）取用的内部字段；不参与输出
  item.tagLine = 0;
  item.tagList = Array.isArray(meta.tags) ? meta.tags.map(String) : [];
  if (!raw.startsWith('---') || end === -1) {
    W(1, '没有 frontmatter（--- 包起来的头部）：标题会退回文件名，日期、标签都没有');
    return;
  }
  const seen = new Map(); // 字段 → 行号
  raw.slice(3, end).split('\n').forEach((line, idx) => {
    const no = idx + 1; // 行号：slice(3) 从头一个换行符起，空段对应首行 ---，故 +1 即文件行号
    const t = line.trim();
    if (!t || t.startsWith('#')) return; // 空行与注释行（# cover: 这种）
    const m = line.match(/^([\w]+):\s*(.*)$/);
    if (!m) {
      const loose = t.match(/^([^\s:：]+)\s*[:：]/);
      if (loose) {
        const norm = loose[1].replace(/[-\s]+/g, '_');
        E(no, FIELDS.includes(norm)
          ? `「${loose[1]}:」不是合法字段名，这一行会被静默忽略——是不是想写 ${norm}:？`
          : `「${loose[1]}:」不是合法字段名（只能用字母数字下划线），会被忽略`);
      } else {
        E(no, `「${t}」不是 字段: 值 的样子，会被忽略`);
      }
      return;
    }
    const key = m[1];
    if (seen.has(key)) E(no, `${key}: 写了不止一次，后一个覆盖前一个`);
    seen.set(key, no);
    if (!FIELDS.includes(key)) {
      const near = nearest(key);
      E(no, `未知字段 ${key}:（会被忽略）${near ? `——是不是想写 ${near}:？` : ''}`);
      return;
    }
    const v = meta[key];
    if (v === undefined || v === '') return; // 空值不唠叨
    const rawVal = m[2].trim();
    if (NUM_FIELDS.includes(key) && (typeof v === 'boolean' || isNaN(Number(v)))) {
      E(no, `${key}: 要写数字（现在是「${rawVal}」）`);
    }
    if (key === 'tags' && !Array.isArray(v)) {
      E(no, `tags: 要写成 [a, b] 的样子（「${rawVal}」会被当单个标签）`);
    }
    if (BOOL_FIELDS.includes(key) && typeof v !== 'boolean') {
      E(no, `${key}: 只认 true / false（「${rawVal}」是字符串，按真值走——多半不同意）`);
    }
  });
  item.tagLine = seen.get('tags') || 0; // ③ 报行号用（tagList 见函数开头）
  // 日期：写了但解不出 → 构建会直接崩（content.js 里 toISOString 见 Invalid Date 就抛）
  for (const key of ['date', 'updated']) {
    const v = meta[key];
    if (v === undefined || v === '') continue;
    const t = new Date(v).getTime();
    if (isNaN(t)) {
      E(seen.get(key) || 2, `${key}: 解析不出日期（「${v}」），构建会直接报错`);
      continue;
    }
    // ② date 写在未来：站点不做定时发布（构建照发、列表日期就是未来），多半是
    // 笔误。today 取本地日历日再比字符串——toISOString 的「今天」是 UTC 的，
    // 东八区傍晚会差一天而误报。草稿豁免（排期中的稿子），updated 不查（克制）
    if (key === 'date' && !meta.draft) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (iso > today) {
        W(seen.get('date') || 2, `date: ${iso} 是未来的日期（今天 ${today}）——站点不做定时发布，多半是笔误`);
      }
    }
  }
  if (meta.date === undefined) W(2, '没写 date：列表排序与日期显示会空着，建议补上');

  // ① 手写 minutes 与正文篇幅明显不符：口径与构建同源（lib/content.js：
  // meta.minutes ? Number(...) : readMinutes(body)，400 字/分）。差距小是正常
  // 口径差，差 2 分钟以上且比例 1.5 倍以上才提醒；草稿豁免——发布前还会重估
  const m = Number(meta.minutes);
  if (!meta.draft && meta.minutes !== undefined && meta.minutes !== ''
      && typeof meta.minutes !== 'boolean' && !isNaN(m) && m > 0) {
    const auto = readMinutes(body);
    const lo = Math.min(m, auto);
    const hi = Math.max(m, auto);
    if (hi - lo >= 2 && hi / lo >= 1.5) {
      W(seen.get('minutes') || 2, `minutes: 手写 ${m} 分钟，正文按字数约 ${auto} 分钟（400 字/分）——差得有点多，若是笔误删掉 minutes: 即用估算`);
    }
  }
}

/* 死链：渲染后的 href 里手写的站内绝对链接。草稿不算发布 */
function checkDeadLinks(html, slugs, seriesSlugs, item) {
  const re = /href="(\/(?:post|series)\/[^"#?]+\.html)(?:[#?][^"]*)?"/g;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    const isPost = url.startsWith('/post/');
    const slug = url.replace(/^\/(?:post|series)\//, '').replace(/\.html$/, '');
    const ok = isPost ? slugs.has(slug) : seriesSlugs.has(slug);
    if (!ok) {
      item.errors.push({
        line: 0,
        text: isPost
          ? `死链：${url} 指向的文章不存在（草稿不算发布，线上会 404）`
          : `死链：${url} 指向的合集不存在（检查合集名与 slugify 后的地址）`,
      });
    }
  }
}

/* ---------- 标签近似拼写（站点级） ----------
   归一（slugify）后比对全站标签。两条规则：
     · 归一后相同、原文不同 → 标签页落点是 tag/<归一>.html，两个写法撞同一页会
       互相覆盖（build 对合集 slug 冲突是硬报错，标签没有这层哨，这里是唯一一道）
       ——每个写法各报一条，挂在它首次出现的篇上
     · 归一后只差一个字符且都不短于 4 → 疑似拼写不一；一发即耗，一个标签最多
       参与一次配对（不然一串近似的会两两刷屏），短于 4 的不比（中文双字词两两
       相近太吵）。含草稿——笔误早发现早好
   全站封顶 8 条；追加完对 warn 补排一次序（checkPost 里那次排在这之前） */
function checkTagCloseness(report) {
  const forms = new Map(); // 归一 → [{ tag, item, line }]，按首次出现先后
  for (const item of report) {
    for (const tag of item.tagList || []) {
      const key = slugify(tag);
      if (!key) continue;
      const arr = forms.get(key) || [];
      if (!arr.some((f) => f.tag === tag)) arr.push({ tag, item, line: item.tagLine });
      forms.set(key, arr);
    }
  }
  const notes = [];
  const keys = [...forms.keys()];
  for (const key of keys) {
    const arr = forms.get(key);
    if (arr.length < 2) continue;
    const names = arr.map((f) => `「${f.tag}」`).join('与');
    for (const f of arr) {
      notes.push({
        item: f.item,
        line: f.line,
        text: `标签${names}的标签页落点相同（都是 tag/${key}.html）——两页会互相覆盖，多半是同一个标签的两种写法，统一成一种即可`,
      });
    }
  }
  const used = new Set();
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i];
      const b = keys[j];
      if (used.has(a) || used.has(b)) continue;
      if (Math.min(a.length, b.length) < 4 || Math.abs(a.length - b.length) > 1) continue;
      if (dist(a, b) !== 1) continue;
      used.add(a);
      used.add(b);
      const fa = forms.get(a)[0];
      const fb = forms.get(b)[0];
      notes.push({
        item: fa.item,
        line: fa.line,
        text: `标签「${fa.tag}」与「${fb.tag}」只差一个字符——疑似拼写不一（本意就是两个标签可忽略）`,
      });
    }
  }
  const CAP = 8;
  const shown = notes.slice(0, CAP);
  for (const n of shown) n.item.warns.push({ line: n.line, text: n.text });
  if (notes.length > CAP) {
    shown[shown.length - 1].item.warns.push({
      line: 0,
      text: `还有 ${notes.length - CAP} 处标签近似提醒（这一档只列前 ${CAP} 处）`,
    });
  }
  for (const item of report) item.warns.sort((a, b) => a.line - b.line);
}

/* ---------- main ---------- */
function main() {
  const argDir = process.argv[2];
  const base = argDir ? path.resolve(argDir) : PATHS.posts;
  if (!fs.existsSync(base)) {
    console.error(`文章体检：目录不存在——${base}`);
    process.exit(1);
  }

  const buildErrors = [];
  const buildWarns = [];

  // 构建级：loadPosts / loadPages 的警告按文案分类；抛错（slug 冲突、date 无效）按错误报。
  // 抛出的错有两副面孔：构建自己写的话（slug 冲突，带上下文）原样展示；
  // 裸异常（Invalid time value 这种）没头没尾，指一下逐文件一档
  const posts = run(() => loadPosts(base));
  if (posts.error) {
    const msg = String(posts.error.message || posts.error);
    buildErrors.push(/^\[build\]/.test(msg) ? strip(msg) : `内容读取中断：${msg}（具体是哪里，看下面逐文件一档）`);
  }
  for (const w of posts.warns) {
    const cls = classify(w);
    if (cls === 'error') buildErrors.push(strip(w));
    else if (cls === 'warn') buildWarns.push(strip(w));
  }
  if (!argDir) {
    const pages = run(() => loadPages());
    if (pages.error) buildErrors.push(strip(String(pages.error.message || pages.error)));
    for (const w of pages.warns) {
      const cls = classify(w);
      if (cls === 'error') buildErrors.push(strip(w));
      else if (cls === 'warn') buildWarns.push(strip(w));
    }
  }

  // 逐文件（草稿也体检；_ / . 开头的私用文件夹安静跳过）
  const { slugs, series } = collectPublished(base);
  // 给了目录就按目录相对的短路径显示（夹具在 /tmp 下，别满屏 ../..）
  const showPath = (abs) => (argDir ? path.relative(base, abs) : path.relative(process.cwd(), abs));
  const report = [];
  for (const rel of listPostFiles(base)) {
    const at = seriesOfPath(rel);
    if (!at || at.error) continue; // 结构问题上面已经报过
    const item = { rel: showPath(path.join(base, rel)), errors: [], warns: [] };
    checkPost(base, rel, slugs, series, item);
    report.push(item);
  }

  // 站点级：标签近似拼写（跨篇比对，逐文件一档做不了这种现象）
  checkTagCloseness(report);

  // 站点页面也扫一遍组件语法与死链（about / 404 是手写的正文）
  const pagesReport = [];
  if (!argDir) {
    for (const file of ['about.md', '404.md']) {
      const abs = path.join(PATHS.pages, file);
      if (!fs.existsSync(abs)) continue;
      const raw = fs.readFileSync(abs, 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const item = { rel: showPath(abs), errors: [], warns: [] };
      const render = run(() => mdToHtml(body, { title: meta.title || file }));
      for (const w of render.warns) item.errors.push({ line: 0, text: strip(w) });
      if (render.value) checkDeadLinks(render.value.html, slugs, series, item);
      pagesReport.push(item);
    }
  }

  /* ---------- 输出 ---------- */
  const all = report.concat(pagesReport);
  const nErr = all.reduce((n, f) => n + f.errors.length, 0) + buildErrors.length;
  const nWarn = all.reduce((n, f) => n + f.warns.length, 0) + buildWarns.length;

  gold('  ◇ youth · 文章体检');
  dim('  ────────────────────────────');

  const show = (mark, line, text) => {
    const at = line ? `第 ${line} 行` : '';
    // 多行错误（slug 冲突的行 1) 2)）跟着首行一起缩进
    const body = `      ${at}${at ? '  ' : ''}${text}`.split('\n').join('\n      ');
    if (mark === '✗') red(body); else dim(body);
  };

  if (buildErrors.length || buildWarns.length) {
    dim('  ── 构建级 ──');
    for (const e of buildErrors) show('✗', 0, e);
    for (const w of buildWarns) show('·', 0, w);
  }
  for (const item of all) {
    if (!item.errors.length && !item.warns.length) continue;
    dim(`  ${item.rel}`);
    for (const e of item.errors) show('✗', e.line, e.text);
    for (const w of item.warns) show('·', w.line, w.text);
  }
  dim('  ────────────────────────────');
  if (nErr || nWarn) {
    const head = `  检查 ${report.length} 篇：`;
    if (nErr) red(`${head}${nErr} 错误 · ${nWarn} 提醒`); else dim(`${head}0 错误 · ${nWarn} 提醒`);
  } else {
    gold(`  检查 ${report.length} 篇：干干净净 ✓`);
  }
  process.exit(nErr ? 1 : 0);
}

main();
