'use strict';

/* 迷你 Markdown 解析器（零依赖，够用就好） */

const { esc } = require('./utils');

/* 视频扩展名 → MIME 类型（图片语法里识别到这些后缀就渲染成 <video>） */
const VIDEO_TYPE = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
  mov: 'video/mp4',
};

/* ---------- 行内解析（单遍扫描 + 递归，支持嵌套） ---------- */

const isWordChar = (c) => /[A-Za-z0-9_]/.test(c);

/* 从 start 起找第一个闭合标记 token 的位置；找不到返回 -1 */
function findClose(src, start, token) {
  return src.indexOf(token, start);
}

/* 斜体闭合：找下一个"独立"的 *（跳过构成 ** 的部分，避免误吞粗体标记） */
function findEmClose(src, start) {
  let j = start;
  for (;;) {
    const idx = src.indexOf('*', j);
    if (idx === -1) return -1;
    if (src[idx + 1] === '*') { j = idx + 2; continue; } // 属于 **，整体跳过
    return idx;
  }
}

/* 解析 [text](url) / ![alt](url "title")，start 指向 '['；
   返回 { text, url, title, end }，end 为 ')' 之后；失败返回 null */
function linkMatch(src, start) {
  const close = src.indexOf(']', start + 1);
  if (close === -1 || src[close + 1] !== '(') return null;
  const paren = src.indexOf(')', close + 1);
  if (paren === -1) return null;
  const inside = src.slice(close + 2, paren);
  const m = inside.match(/^([^\s)]+)(?:\s+"([^"]*)")?$/);
  if (!m) return null;
  return {
    text: src.slice(start + 1, close),
    url: m[1],
    title: m[2] == null ? null : m[2],
    end: paren + 1,
  };
}

function inline(src, ctx) {
  let out = '';
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];

    // 行内代码 `...`（支持多反引号包裹：`` `code` ``、```` ``code`` ````）
    if (c === '`') {
      let k = 0;
      while (src[i + k] === '`') k++;
      const marker = '`'.repeat(k);
      const end = src.indexOf(marker, i + k);
      if (end !== -1) {
        out += '<code>' + esc(src.slice(i + k, end)) + '</code>';
        i = end + k;
        continue;
      }
    }

    // 图片 ![alt](url "caption") —— 先于链接，否则 ![alt](url) 会被链接规则误吞
    if (c === '!' && src[i + 1] === '[') {
      const m = linkMatch(src, i + 1);
      if (m) {
        // 视频扩展名自动识别为 <video controls>（动图/录屏直接放）
        const vm = m.url.match(/\.(mp4|webm|ogv|ogg|mov)(\?|$)/i);
        const media = vm
          ? `<video controls preload="metadata" playsinline><source src="${esc(m.url)}" type="${VIDEO_TYPE[vm[1].toLowerCase()]}">${esc(m.text)}</video>`
          : `<img src="${esc(m.url)}" alt="${esc(m.text)}" loading="lazy">`;
        out += m.title != null
          ? `<figure class="md-figure">${media}<figcaption>${esc(m.title)}</figcaption></figure>`
          : media;
        i = m.end;
        continue;
      }
    }

    // 键帽 [[Ctrl+w]]——整串就是一个键帽，内容照字面印（只转义，不递归解析）；
    // [[]] 空内容保持字面，同链接的规矩。整串一个键帽，不拆 +（见 README）
    if (c === '[' && src[i + 1] === '[') {
      const end = src.indexOf(']]', i + 2);
      if (end !== -1 && end > i + 2) {
        out += '<kbd>' + esc(src.slice(i + 2, end)) + '</kbd>';
        i = end + 2;
        continue;
      }
    }

    // 脚注引用 [^标签]：先于链接规则（[^1](url) 按脚注意图走，先到先得）。
    // 标签不许含 ] 与空白；这里只发占位符，编号与替换留到文末统一结算
    // （引用常写在定义前头，见 resolveFootnotes）；没有 ctx.foot（如测试直接
    // inline(src)）时落到字符兜底，保持字面
    if (c === '[' && src[i + 1] === '^' && ctx && ctx.foot) {
      const close = src.indexOf(']', i + 2);
      const label = close === -1 ? '' : src.slice(i + 2, close);
      if (label && !/[\s\]\0]/.test(label)) {
        if (ctx.foot.order.indexOf(label) === -1) ctx.foot.order.push(label);
        out += '\0fn:' + label + '\0';
        i = close + 1;
        continue;
      }
    }

    // 链接：外部 http(s) 开新标签，内部相对链接在当前页打开
    if (c === '[') {
      const m = linkMatch(src, i);
      if (m && m.text !== '') {
        const inner = inline(m.text, ctx);
        out += /^(https?:)?\/\//.test(m.url)
          ? `<a href="${esc(m.url)}" target="_blank" rel="noopener">${inner}</a>`
          : `<a href="${esc(m.url)}">${inner}</a>`;
        i = m.end;
        continue;
      }
    }

    // 粗体 **...**（内容允许单个 *，支持嵌套）；***...*** 为粗斜体
    if (src.startsWith('**', i)) {
      if (src[i + 2] === '*') {
        const end = findClose(src, i + 3, '***');
        if (end !== -1) {
          out += '<strong><em>' + inline(src.slice(i + 3, end), ctx) + '</em></strong>';
          i = end + 3;
          continue;
        }
      }
      const end = findClose(src, i + 2, '**');
      if (end !== -1) {
        out += '<strong>' + inline(src.slice(i + 2, end), ctx) + '</strong>';
        i = end + 2;
        continue;
      }
      // 找不到闭合：当两个普通字符输出，避免死循环
      out += '**';
      i += 2;
      continue;
    }

    // 斜体 *...*（前置非单词字符，保持旧行为：a*b* 不误渲染）
    if (c === '*' && (i === 0 || !isWordChar(src[i - 1]))) {
      const end = findEmClose(src, i + 1);
      if (end !== -1 && (end + 1 >= n || src[end + 1] !== '*')) {
        out += '<em>' + inline(src.slice(i + 1, end), ctx) + '</em>';
        i = end + 1;
        continue;
      }
    }

    // 删除线 ~~...~~
    if (src.startsWith('~~', i)) {
      const end = findClose(src, i + 2, '~~');
      if (end !== -1) {
        out += '<del>' + inline(src.slice(i + 2, end), ctx) + '</del>';
        i = end + 2;
        continue;
      }
      out += '~~';
      i += 2;
      continue;
    }

    // 剧透遮罩 ||……||：内容递归走 inline（是正文，可含 **粗体** 等）。
    // 空遮罩（||||）保持字面——与 ~~ 的空删除线（出空 <del>）有意不同：
    // 空的可聚焦 span 更糟，|||| 也更可能是正文内容。找不到闭合时两个 |
    // 当普通字符输出，避免死循环（同 ~~ 的规矩）
    if (src.startsWith('||', i)) {
      const end = findClose(src, i + 2, '||');
      if (end !== -1 && end > i + 2) {
        out += '<span class="spoiler" tabindex="0">' + inline(src.slice(i + 2, end), ctx) + '</span>';
        i = end + 2;
        continue;
      }
      // 空遮罩（||||）：四连当一个字面单位整段收走——只吐前两个 |、把后两个
      // 留在原地重扫的话，它会和后面别的 || 配上，||||x|||| 就把 x 藏起来了
      if (end === i + 2) { out += '||||'; i += 4; continue; }
      out += '||';
      i += 2;
      continue;
    }

    out += esc(c);
    i++;
  }
  return out;
}

/* ---------- 列表（无序/有序：start / 嵌套 / 多行项 / loose / 缩进限制） ---------- */

/* 行首空格数（tab 不参与，按 CommonMark 以空格计缩进） */
function indentOf(line) {
  let n = 0;
  while (n < line.length && line[n] === ' ') n++;
  return n;
}

/* 匹配列表项标记；标记前缩进限 0-3 空格（≥4 视为代码块，不算列表）。
   返回 { ordered, indent, marker, rest, num } 或 null */
function matchListItem(line) {
  const m = line.match(/^( {0,3})(\d{1,9}[.)]|[-*+])([ \t]+)(.*)$/);
  if (!m) return null;
  const ordered = /^\d/.test(m[2]);
  return {
    ordered,
    indent: m[1].length,
    marker: m[2],
    rest: m[4],
    num: ordered ? parseInt(m[2], 10) : null,
  };
}

/* 渲染列表项的内容块：统一走块级递归（支持项内表格/引用/代码块等）；
   loose → 保留 <p>；tight 且仅一段 → 剥掉 <p>（CommonMark tight 语义） */
function renderBlocks(block, loose, ctx) {
  if (!block.length) return '';
  const inner = mdToHtml(block.join('\n'), ctx).html;
  if (loose) return inner.replace(/\n$/, '');
  const m = inner.match(/^<p>([\s\S]*)<\/p>\n?$/);
  return m ? m[1] : inner.replace(/\n$/, '');
}

/* 渲染单个列表项：内容中任何列表标记行 → 递归为子列表 */
function renderItem(content, loose, ctx) {
  let inner = '';
  let block = [];
  const push = () => {
    if (block.length) { inner += renderBlocks(block, loose, ctx); block = []; }
  };
  let i = 0;
  while (i < content.length) {
    if (matchListItem(content[i])) {
      push();
      const sub = parseList(content, i, ctx);
      if (sub) { inner += sub.html; i = sub.i; continue; }
    }
    block.push(content[i]);
    i++;
  }
  push();
  return `  <li>${inner}</li>\n`;
}

/* 从 lines[i] 起解析一个列表块；返回 { html, i }（i 为列表结束后的行号）或 null */
function parseList(lines, i, ctx) {
  const first = matchListItem(lines[i]);
  if (!first) return null;
  const ordered = first.ordered;
  const indent0 = first.indent;
  const markerW = first.marker.length + 1; // 标记 + 一个空格为内容缩进基准
  const contentIndent = indent0 + markerW;

  const items = [];
  let cur = null;
  let loose = false;
  const flush = () => {
    if (cur) { items.push(cur); cur = null; }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      // 空行：前瞻——其后仍是同层列表项（或当前项缩进续行）→ loose 列表继续
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length) {
        const mj = matchListItem(lines[j]);
        const indJ = indentOf(lines[j]);
        if (mj && indJ === indent0 && mj.ordered === ordered) {
          loose = true; flush(); i = j; continue;
        }
        if (cur && indJ >= contentIndent) {
          loose = true; cur.content.push(''); i++; continue;
        }
      }
      break; // 空行后无列表内容 → 列表结束
    }

    const m = matchListItem(line);
    const ind = indentOf(line);

    if (m && ind === indent0 && m.ordered === ordered) {
      flush();
      cur = { content: [m.rest] };
      i++;
      continue;
    }
    if (cur) {
      if (ind >= contentIndent) {
        // 续行：去掉内容基准缩进，保留更深缩进（供嵌套/子列表递归）
        cur.content.push(line.slice(contentIndent));
        i++;
        continue;
      }
      if (m && ind >= indent0) {
        // 不同类型但同缩进的标记行 → 属于当前项的子列表
        cur.content.push(line);
        i++;
        continue;
      }
    }
    break;
  }
  flush();

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && first.num !== 1 ? ` start="${first.num}"` : '';
  let html = `<${tag}${startAttr}>\n`;
  for (const it of items) html += renderItem(it.content, loose, ctx);
  html += `</${tag}>\n`;
  return { html, i };
}

/* ---------- 评分卡（正文里的 ```score 围栏） ----------
   写法则：

     ```score
     8.5
     评语: 值得一看
     剧情: 9
     画面: 10
     ```

   一行只写一个数字就是总分（写成 9/10 也行，不写满分按十分制），裸行里的
   非数字当评语；「评语」那行的一句话说在分数下面；其余「名字: 分数」行各画
   一条小菱形刻度，名字后面不是数字的（如「演技: 在线」）就照原样写出来。
   数据有问题只提醒、不打断构建——评分卡是给人看的，别为一行笔误挡住整站 */
const SCORE_TOTAL_KEYS = ['总分', '评分', 'score'];
const SCORE_VERDICT_KEYS = ['评语', '一句话', '短评'];

/* 「8.5」「9/10」「4.5 / 5」→ [值, 满分]；不是数字返回 null */
function parseScore(str) {
  const m = String(str).trim().match(/^(\d+(?:\.\d+)?)\s*(?:\/\s*(\d+(?:\.\d+)?))?$/);
  if (!m) return null;
  const max = m[2] ? parseFloat(m[2]) : 10;
  return [parseFloat(m[1]), max > 0 ? max : 10];
}

/* 数字原样显示：8.50 → 8.5、9.0 → 9 */
const fmtScore = (n) => String(Number(n.toFixed(2)));

/* 一排小菱形刻度：满格点金、半格斜着填一半、空格只留细边。
   格数照满分来（十分制就是十格）；满分超过十格时按比例摊到十格上 */
function scoreScale(value, max) {
  const n = Math.max(1, Math.min(10, Math.round(max)));
  const filled = Math.max(0, Math.min(n, (value / max) * n));
  let cells = '';
  for (let i = 0; i < n; i++) {
    const d = filled - i;
    const cls = d >= 1 ? ' is-on' : d >= 0.5 ? ' is-half' : '';
    cells += `<i class="score-cell${cls}" style="--i:${i}"></i>`;
  }
  return `<span class="score-scale" aria-hidden="true">${cells}</span>`;
}

/* 提醒带上文章标题（ctx 由调用方给），构建日志里才知道是哪一篇的事。
   kind 是块的名字（评分卡 / 折叠块 / 提示框），三种围栏共用同一句式 */
function partWarn(ctx, kind) {
  const who = ctx && ctx.title ? `《${ctx.title}》的` : '';
  return (msg) => console.warn(`[build] 警告：${who}${kind}：${msg}`);
}

/* 解析一段 ```score 的内容 → { html, total, totalMax, verdict }。
   total 是总分（没写就是 null）——正文里第一张评分卡的总分要报给调用方，
   列表卡片上的那枚评分徽标用它（见 lib/content.js 的 score）；
   verdict 是那句评语（可能为空串），评分墙把它当条目下的一行短评 */
function scoreCard(lines, warn) {
  const dims = [];
  let total = null, totalMax = 10, verdict = '';
  for (const raw of lines) {
    const s = raw.trim();
    if (!s) continue;
    const m = s.match(/^([^:：]+)[:：]\s*(.+)$/);
    const key = m ? m[1].trim() : '';
    const val = m ? m[2].trim() : s;
    if (SCORE_TOTAL_KEYS.indexOf(key) > -1) {
      const p = parseScore(val);
      if (!p) { warn(`评分「${val}」不是数字，已忽略`); continue; }
      if (total !== null) { warn(`评分写了不止一次，「${val}」已忽略（只认第一个）`); continue; }
      total = p[0]; totalMax = p[1];
      continue;
    }
    if (SCORE_VERDICT_KEYS.indexOf(key) > -1) { verdict = val; continue; }
    if (key) { dims.push([key, val]); continue; }
    const p = parseScore(s); // 无键的裸行：数字当总分，其余当评语
    if (p && total === null) { total = p[0]; totalMax = p[1]; continue; }
    if (!verdict) verdict = s;
  }
  // 整块空空如也才丢；只剩一句评语也照画——写下的字不能悄悄消失
  if (total === null && !dims.length && !verdict) {
    warn('一行内容都没有，已跳过');
    return { html: '', total: null, totalMax: 10, verdict: '' };
  }
  if (total !== null && total > totalMax) {
    warn(`评了 ${fmtScore(total)}，超出满分 ${fmtScore(totalMax)}，刻度只画到满分`);
  }

  const head = total === null ? '' : `
  <div class="score-head">
    <p class="score-total"><b>${fmtScore(total)}</b><span class="score-max">/${fmtScore(totalMax)}</span></p>
    ${scoreScale(total, totalMax)}
  </div>`;
  // --r 是行的序号（0 起）：刻度点亮的动效靠它一行一行错开（见 effects.css）
  const rows = dims.map(([name, val], r) => {
    const p = parseScore(val);
    return `
    <li style="--r:${r}"><span class="sd-name">${esc(name)}</span>${p ? scoreScale(p[0], p[1]) : ''}<span class="sd-num">${p ? fmtScore(p[0]) : esc(val)}</span></li>`;
  }).join('');
  const dimsHtml = rows ? `
  <ul class="score-dims">${rows}
  </ul>` : '';
  const verdictHtml = verdict ? `
  <p class="score-verdict">${esc(verdict)}</p>` : '';

  const html = `<div class="score-card" data-reveal>
  <p class="score-label">评分</p>${head}${verdictHtml}${dimsHtml}
</div>
`;
  return { html, total, totalMax, verdict };
}

/* ---------- 折叠块（正文里的 ```fold 围栏） ----------
   写法则：

     ```fold
     剧透警告：下面要讲结局了   ← 第一行：露在外面的提示语（空则用默认）
     结局其实是……              ← 其余：折起来的正文，照常写 markdown
     ```

   正文照常走 mdToHtml（引用块、列表项同款递归），但只取 .html：
   里面的标题不进目录、评分卡不挂列表徽标——合着的内容不在外面留痕。
   正文里要写代码块就用四个反引号开栅（````fold），三反引号留给里面的代码 */
function foldBlock(lines, ctx, headingStart, warn) {
  const label = (lines[0] || '').trim() || '此段封存';
  const body = lines.slice(1).join('\n');
  // 只有提示语、或空空如也：没有可揭晓的东西，提醒一声，别让它变成一张空壳
  if (!body.trim()) {
    warn('没有可折叠的内容，已跳过');
    return { html: '', headings: 0 };
  }
  const inner = mdToHtml(body, Object.assign({}, ctx, { headingStart }));
  return {
    html: `<details class="fold" data-reveal>
  <summary class="fold-head"><span class="fold-label">${inline(label, ctx)}</span></summary>
  <div class="fold-body"><div class="fold-inner">${inner.html}</div></div>
</details>
`,
    headings: inner.headings.length,
  };
}

/* ---------- 提示框（正文里的 ```note 围栏） ----------
   写法则：

     ```note
     改配置前先**备份**。   ← 整段都是正文，照常写 markdown
     ```

   照折叠块的规矩只取 .html：里面的标题不进目录、评分卡不挂列表徽标；
   headingStart 让内层 sec-N 接着外层编号走，不与外层撞号。
   正文里要写代码块（或嵌别的围栏）同样用四个反引号开栅 */
function noteBlock(lines, ctx, headingStart, warn) {
  const body = lines.join('\n');
  if (!body.trim()) {
    warn('一行内容都没有，已跳过');
    return { html: '', headings: 0 };
  }
  const inner = mdToHtml(body, Object.assign({}, ctx, { headingStart }));
  return {
    html: `<div class="note" data-reveal>${inner.html}</div>\n`,
    headings: inner.headings.length,
  };
}

/* ---------- 脚注（正文里的 [^1] 引用与 [^1]: 定义） ----------
   写法则：

     配置细节见官方文档[^1]。   ← 引用：标签不限，除 ] 与空白

     [^1]: 定义习惯放文末，构建时自动汇总成「脚注」区   ← 定义：行首（≤3 空格）

   引用在正文里换成一枚上标号码（同一标签第一处带回跳锚点），定义统一抽到
   文末的「脚注」区。引用常写在定义前头、定义还可能落在折叠块里，索性先记账
   后结算：inline() 见到引用只登记顺序、发一个占位符（\0fn:标签\0），等最外层
   的 mdToHtml 收尾时再统一编号、替换、拼区（见 resolveFootnotes）。号码按
   首次引用的顺序发，与定义摆在哪、摆成什么次序无关 */

/* 脚注定义行：[^标签]: 内容（行首，≤3 空格缩进）。标签不许含 ] 与空白，
   NUL 也不行——那是占位符的骨架，别让标签把它拆开。
   三处共用一个规则源：主循环、段落续行、表格行（都要在定义行前收住） */
const matchDefLine = (line) => line.match(/^ {0,3}\[\^([^\]\s\0]+)\]:[ \t]*(.*)$/);

/* 文末结算：编号 → 拼「脚注」区 → 正文与区拼起来一遍替换占位 → 发提醒。
   编号只认 order 里出现过的标签（= 正文真的引用了的），定义正文因此要按
   工作队列解析：解析中 order 还长（定义里又引用了别的）就接着来；没人引用
   的定义正文根本不解析，免得它把幽灵引用拉进 order——那种引用没有对应的
   上标，编号就会出现 1、3 这样的断档 */
function resolveFootnotes(html, foot, ctx) {
  const warn = partWarn(ctx, '脚注');
  const texts = new Map(); // 标签 → 定义正文的 html
  for (let k = 0; k < foot.order.length; k++) {
    const label = foot.order[k];
    if (!foot.defs.has(label) || texts.has(label)) continue;
    texts.set(label, inline(foot.defs.get(label), ctx));
  }

  const num = new Map(); // 有定义的标签，按首次引用顺序发号
  for (const label of foot.order) {
    if (!num.has(label) && foot.defs.has(label)) num.set(label, num.size + 1);
  }
  for (const label of foot.order) {
    if (!foot.defs.has(label)) warn(`引用 [^${label}] 没有对应定义，保持原样`);
  }
  for (const label of foot.defs.keys()) {
    if (!num.has(label)) warn(`定义 [^${label}] 没有地方引用，已忽略`);
  }

  let section = '';
  if (num.size) {
    const items = [];
    for (const [label, n] of num) {
      items.push(`<li id="fn-${n}">${texts.get(label)} <a class="fn-back" href="#fnref-${n}" aria-label="回到引用">↩</a></li>`);
    }
    section = `<section class="footnotes" data-reveal>
<p class="fn-label">脚注</p>
<ol>
${items.join('\n')}
</ol>
</section>
`;
  }

  // 正文和脚注区拼起来一遍替换：同一标签第一处带 id（回跳锚点），其后只出号码；
  // 没定义的还原成字面（label 照转义——它可以含 < >，不转义就是注入口子）。
  // 用替换函数不用替换串：label 里的 $& 之类不会炸
  const seen = new Set();
  return (html + section).replace(/\0fn:([^\0]+)\0/g, (m, label) => {
    const n = num.get(label);
    if (!n) return '[^' + esc(label) + ']';
    if (seen.has(label)) return `<sup class="fn-ref"><a href="#fn-${n}">${n}</a></sup>`;
    seen.add(label);
    return `<sup class="fn-ref"><a href="#fn-${n}" id="fnref-${n}">${n}</a></sup>`;
  });
}

/* 代码行高亮：把围栏信息里的行号表（{3,5-7}）归一成 "3" / "3-5"（没有有效行号就 ""）。
   碎片 trim 后须是纯数字（N）或区间（N-M）；倒着写（7-5）按正序算，0 收成 1；
   单行超出实际行数整条丢弃（不悄悄收到末行），区间收边到末行；排序后把相连的
   区间也合掉——色带是半透明的，相叠会出一道深印。整段解析不出行号时调用方
   提醒一句（块照常渲染，见 mdToHtml 里纯代码分支） */
function parseHl(spec, total) {
  const ranges = [];
  for (const part of spec.split(',')) {
    const t = part.trim();
    if (!t) continue;
    const m = t.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    let from = Math.max(1, parseInt(m[1], 10));
    let to = m[2] ? parseInt(m[2], 10) : from;
    if (to < from) [from, to] = [to, from];
    from = Math.max(1, from);
    if (from > total) continue;
    ranges.push([from, Math.min(to, total)]);
  }
  if (!ranges.length) return '';
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else merged.push([...r]);
  }
  return merged.map((r) => (r[0] === r[1] ? `${r[0]}` : `${r[0]}-${r[1]}`)).join(',');
}

/* 返回 { html, headings, score }：score 是全篇第一张评分卡的总分（没有就是 null），
   列表卡片的评分徽标用它。只认最外层的卡——嵌在引用/列表/折叠块/提示框里的评分卡
   算正文内容，不当全篇评分（这种写法本身也不合常理，无需支持。
   折叠块与提示框见 foldBlock / noteBlock） */
function mdToHtml(src, ctx) {
  const lines = src.split('\n');
  // 脚注账本：最外层新建，递归层（引用块/列表/折叠块/提示框）跟着 ctx 用同一本。
  // 主意顺序：先判 outermost、再把 foot 补进 ctx——反了，递归层都以为自己
  // 是最外层，脚注区会插进正文中间、编号还会重来
  const outermost = !(ctx && ctx.foot);
  const foot = (ctx && ctx.foot) || { defs: new Map(), order: [] };
  ctx = Object.assign({}, ctx, { foot });
  const warn = partWarn(ctx, '评分卡');
  const foldWarn = partWarn(ctx, '折叠块');
  const noteWarn = partWarn(ctx, '提示框');
  const hlWarn = partWarn(ctx, '代码行高亮');
  const footWarn = partWarn(ctx, '脚注');
  let html = '';
  const headings = [];
  let score = null;
  let headingCount = (ctx && ctx.headingStart) || 0; // 接着外层的编号（折叠块/提示框递归时用，见 foldBlock / noteBlock）
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let codeLang = '';
  let codeHl = ''; // 围栏信息里的行号表（```js {3,5-7}）——只有纯代码分支用它
  let fenceLen = 3; // 开栅那条围栏的反引号数；关栅要 ≥ 它（长围栏里能安稳嵌短围栏）

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块；```score / ```fold / ```note 是特判（不是代码，不进 <pre>）。
    // 围栏长度照 CommonMark：关栅的反引号要 ≥ 开栅，短围栏行在栅内只是内容——
    // 折叠正文里要写代码块时，用四个反引号开 fold 栅就能安稳嵌住三反引号。
    // 行号表（```js {3,5-7}）只落在纯代码分支：score/fold/note 跟着的花括号一律不管
    const fence = line.match(/^(`{3,})(\w*)\s*(?:\{([^}]*)\})?\s*$/);
    if (fence && (!inCode || fence[1].length >= fenceLen)) {
      if (!inCode) { inCode = true; codeBuf = []; codeLang = fence[2]; codeHl = fence[3] || ''; fenceLen = fence[1].length; }
      else {
        if (codeLang === 'score') {
          const card = scoreCard(codeBuf, warn);
          html += card.html;
          // 一篇文章一个评分：第一张有总分的卡说了算，后面的只是正文。
          // note（评语）一起带上——评分墙拿它当条目下的一行短评
          if (score === null && card.total !== null) {
            score = { value: card.total, max: card.totalMax, note: card.verdict };
          }
        } else if (codeLang === 'fold') {
          // 关栅那行带着语言：作者多半是想往里嵌围栏（```note 之类），
          // 却被这一行提前关掉了——同长的围栏分不清「嵌进来」还是「关上」，
          // 规矩是外层加长一档（见 foldBlock 注释）。提醒一句，别让内容悄悄缺一截
          if (fence[2]) foldWarn(`正文里的 \`\`\`${fence[2]} 会提前把它关掉——要往里嵌围栏或代码块，外层得用更长的围栏开栅（四个反引号）`);
          const block = foldBlock(codeBuf, ctx, headingCount, foldWarn);
          html += block.html;
          // 内层标题占了号，外层接着往下数，sec-N 不撞
          headingCount += block.headings;
        } else if (codeLang === 'note') {
          if (fence[2]) noteWarn(`正文里的 \`\`\`${fence[2]} 会提前把它关掉——要往里嵌围栏或代码块，外层得用更长的围栏开栅（四个反引号）`);
          const block = noteBlock(codeBuf, ctx, headingCount, noteWarn);
          html += block.html;
          headingCount += block.headings;
        } else {
          // 行号表解析不出有效行号（写三写的都有）→ 提醒一句，块照常渲染
          const hl = parseHl(codeHl, codeBuf.length);
          if (codeHl && !hl) hlWarn(`围栏里的「{${codeHl}}」没解析出行号，高亮已跳过`);
          html += `<pre${hl ? ` data-hl="${hl}"` : ''}><code class="lang-${esc(codeLang || 'plaintext')}">${esc(codeBuf.join('\n'))}</code></pre>\n`;
        }
        inCode = false;
      }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    // 脚注定义行（[^标签]: 内容）：登记进 foot，正文里不留痕。
    // 限一段话——续行要缩进 ≥2（剥掉 2 格并入），遇空行或别的内容收尾；
    // 重复定义只认第一个（同评分卡总分的规矩），提醒一声
    const def = matchDefLine(line);
    if (def) {
      const cont = [def[2]];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== '' && /^ {2,}/.test(lines[j])) {
        cont.push(lines[j].slice(2));
        j++;
      }
      if (foot.defs.has(def[1])) footWarn(`[^${def[1]}] 的定义写了不止一次，后一个已忽略（只认第一个）`);
      else foot.defs.set(def[1], cont.join('\n'));
      i = j;
      continue;
    }

    // 标题（h2/h3 生成锚点并纳入目录）
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const text = inline(h[2], ctx);
      if (lvl === 2 || lvl === 3) {
        headingCount++;
        const id = `sec-${headingCount}`;
        // 目录文本：先剥脚注占位符再剥标签——顺序反了，[^<b>] 这类标签的
        // 占位会被标签正则咬掉一半，\0fn:\0 泄进目录（views.js 原样注入 h.text）
        headings.push({ level: lvl, text: text.replace(/\0fn:[^\0]+\0/g, '').replace(/<[^>]+>/g, ''), id });
        html += `<h${lvl} id="${id}">${text}</h${lvl}>\n`;
      } else {
        html += `<h${lvl}>${text}</h${lvl}>\n`;
      }
      i++; continue;
    }

    // 分隔线
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { html += '<hr>\n'; i++; continue; }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      const inner = mdToHtml(buf.join('\n'), ctx);
      html += `<blockquote>\n${inner.html}</blockquote>\n`;
      continue;
    }

    // 列表（无序/有序：start / 嵌套 / 多行项 / loose / 缩进限制）
    if (matchListItem(line)) {
      const list = parseList(lines, i, ctx);
      if (list) {
        html += list.html;
        i = list.i;
        continue;
      }
    }

    // 表格（GFM 管道语法）：
    //   | 名称 | 数量 |     支持对齐：:--- 左 / :---: 中 / ---: 右
    //   | :--- | ---: |
    //   | 甲   | 2    |
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (row) => {
        const parts = row.split('|');
        if (parts.length && parts[0].trim() === '') parts.shift();
        if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
        return parts.map((s) => s.trim());
      };
      const alignOf = (c) => {
        const t = (c || '').trim();
        if (t.startsWith(':') && t.endsWith(':')) return 'center';
        if (t.endsWith(':')) return 'right';
        if (t.startsWith(':')) return 'left';
        return '';
      };
      const header = cells(line);
      const aligns = cells(lines[i + 1]);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim() !== '' && !/^```/.test(lines[i]) && !matchDefLine(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      const th = header
        .map((h, idx) => {
          const a = alignOf(aligns[idx]);
          return `      <th${a ? ` style="text-align:${a}"` : ''}>${inline(h, ctx)}</th>`;
        })
        .join('\n');
      const trs = rows
        .map((r) => '      <tr>\n' + r
          .map((c, idx) => {
            const a = alignOf(aligns[idx]);
            return `        <td${a ? ` style="text-align:${a}"` : ''}>${inline(c, ctx)}</td>`;
          })
          .join('\n') + '\n      </tr>')
        .join('\n');
      html += `<div class="table-wrap">\n<table>\n  <thead>\n${th}\n  </thead>\n  <tbody>\n${trs}\n  </tbody>\n</table>\n</div>\n`;
      continue;
    }

    // 空行
    if (line.trim() === '') { i++; continue; }

    // 段落
    const buf = [line];
    i++;
    while (i < lines.length &&
           lines[i].trim() !== '' &&
           !/^(#{1,6})\s/.test(lines[i]) &&
           !/^```/.test(lines[i]) &&
           !matchDefLine(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    html += `<p>${inline(buf.join('\n'), ctx)}</p>\n`;
  }

  // 最外层收尾：编号、拼「脚注」区、替换占位（详见 resolveFootnotes）。
  // 递归层不收——收了会在正文中间插区，编号也会重来一遍
  if (outermost) html = resolveFootnotes(html, foot, ctx);

  return { html, headings, score };
}

/* frontmatter 解析 */
function parseFrontmatter(raw) {
  const bodyStart = raw.indexOf('---', raw.indexOf('---') + 3);
  const meta = {};
  if (raw.startsWith('---') && bodyStart !== -1) {
    raw.slice(3, bodyStart).split('\n').forEach((line) => {
      const m = line.match(/^([\w]+):\s*(.*)$/);
      if (m) {
        let val = m[2].trim();
        if (val.startsWith('[') && val.endsWith(']')) {
          // 兼容英文逗号、中文逗号、顿号
          val = val
            .slice(1, -1)
            .split(/[,，、]/)
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (val === 'true') val = true;
        else if (val === 'false') val = false;
        meta[m[1]] = val;
      }
    });
    return { meta, body: raw.slice(bodyStart + 3) };
  }
  return { meta, body: raw };
}

/* fmtScore 一并导出：列表卡片的评分徽标要按同一套写法显示数字（见 lib/content.js） */
module.exports = { inline, mdToHtml, parseFrontmatter, fmtScore };
