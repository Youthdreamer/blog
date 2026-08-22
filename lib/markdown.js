'use strict';

/* 迷你 Markdown 解析器（零依赖，够用就好） */

const { esc } = require('./utils');

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

function inline(src) {
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
        const img =
          `<img src="${esc(m.url)}" alt="${esc(m.text)}" loading="lazy">`;
        out += m.title != null
          ? `<figure class="md-figure">${img}<figcaption>${esc(m.title)}</figcaption></figure>`
          : img;
        i = m.end;
        continue;
      }
    }

    // 链接：外部 http(s) 开新标签，内部相对链接在当前页打开
    if (c === '[') {
      const m = linkMatch(src, i);
      if (m && m.text !== '') {
        const inner = inline(m.text);
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
          out += '<strong><em>' + inline(src.slice(i + 3, end)) + '</em></strong>';
          i = end + 3;
          continue;
        }
      }
      const end = findClose(src, i + 2, '**');
      if (end !== -1) {
        out += '<strong>' + inline(src.slice(i + 2, end)) + '</strong>';
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
        out += '<em>' + inline(src.slice(i + 1, end)) + '</em>';
        i = end + 1;
        continue;
      }
    }

    // 删除线 ~~...~~
    if (src.startsWith('~~', i)) {
      const end = findClose(src, i + 2, '~~');
      if (end !== -1) {
        out += '<del>' + inline(src.slice(i + 2, end)) + '</del>';
        i = end + 2;
        continue;
      }
      out += '~~';
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

/* 渲染列表项的内容块：按空行拆段；loose 或多段 → <p>，否则直接内联 */
function renderBlocks(block, loose) {
  const paras = [];
  let cur = [];
  for (const l of block) {
    if (l.trim() === '') {
      if (cur.length) { paras.push(cur); cur = []; }
    } else cur.push(l);
  }
  if (cur.length) paras.push(cur);
  if (!paras.length) return '';
  if (loose || paras.length > 1) {
    return paras.map((p) => `<p>${inline(p.join('\n'))}</p>`).join('\n');
  }
  return inline(paras[0].join('\n'));
}

/* 渲染单个列表项：内容中任何列表标记行 → 递归为子列表 */
function renderItem(content, loose) {
  let inner = '';
  let block = [];
  const push = () => {
    if (block.length) { inner += renderBlocks(block, loose); block = []; }
  };
  let i = 0;
  while (i < content.length) {
    if (matchListItem(content[i])) {
      push();
      const sub = parseList(content, i);
      if (sub) { inner += sub.html; i = sub.i; continue; }
    }
    block.push(content[i]);
    i++;
  }
  push();
  return `  <li>${inner}</li>\n`;
}

/* 从 lines[i] 起解析一个列表块；返回 { html, i }（i 为列表结束后的行号）或 null */
function parseList(lines, i) {
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
  for (const it of items) html += renderItem(it.content, loose);
  html += `</${tag}>\n`;
  return { html, i };
}

function mdToHtml(src) {
  const lines = src.split('\n');
  let html = '';
  const headings = [];
  let headingCount = 0;
  let i = 0;
  let inCode = false;
  let codeBuf = [];
  let codeLang = '';

  while (i < lines.length) {
    const line = lines[i];

    // 围栏代码块
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!inCode) { inCode = true; codeBuf = []; codeLang = fence[1]; }
      else {
        html += `<pre><code class="lang-${esc(codeLang || 'plaintext')}">${esc(codeBuf.join('\n'))}</code></pre>\n`;
        inCode = false;
      }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    // 标题（h2/h3 生成锚点并纳入目录）
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const text = inline(h[2]);
      if (lvl === 2 || lvl === 3) {
        headingCount++;
        const id = `sec-${headingCount}`;
        headings.push({ level: lvl, text: text.replace(/<[^>]+>/g, ''), id });
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
      const inner = mdToHtml(buf.join('\n'));
      html += `<blockquote>\n${inner.html}</blockquote>\n`;
      continue;
    }

    // 列表（无序/有序：start / 嵌套 / 多行项 / loose / 缩进限制）
    if (matchListItem(line)) {
      const list = parseList(lines, i);
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
      while (i < lines.length && lines[i].trim() !== '' && !/^```/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      const th = header
        .map((h, idx) => {
          const a = alignOf(aligns[idx]);
          return `      <th${a ? ` style="text-align:${a}"` : ''}>${inline(h)}</th>`;
        })
        .join('\n');
      const trs = rows
        .map((r) => '      <tr>\n' + r
          .map((c, idx) => {
            const a = alignOf(aligns[idx]);
            return `        <td${a ? ` style="text-align:${a}"` : ''}>${inline(c)}</td>`;
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
           !/^```/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    html += `<p>${inline(buf.join('\n'))}</p>\n`;
  }

  return { html, headings };
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

module.exports = { inline, mdToHtml, parseFrontmatter };
