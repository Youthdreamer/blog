'use strict';

/* 迷你 Markdown 解析器（零依赖，够用就好） */

const { esc } = require('./utils');

function inline(src) {
  return esc(src)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    // 图片：必须放在链接之前，否则 ![alt](url) 会被链接规则误吞
    // 支持可选图注：![alt](url "caption")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (m, alt, src, title) => title
        ? `<figure class="md-figure"><img src="${src}" alt="${alt}" loading="lazy"><figcaption>${title}</figcaption></figure>`
        : `<img src="${src}" alt="${alt}" loading="lazy">`)
    // 链接：外部 http(s) 开新标签，内部相对链接在当前页打开
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      (m, text, url) => /^(https?:)?\/\//.test(url)
        ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>`
        : `<a href="${url}">${text}</a>`)
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
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

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*[-*+]\s+/, '')));
        i++;
      }
      html += `<ul>\n${items.map((x) => `  <li>${x}</li>`).join('\n')}\n</ul>\n`;
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\s*\d+\.\s+/, '')));
        i++;
      }
      html += `<ol>\n${items.map((x) => `  <li>${x}</li>`).join('\n')}\n</ol>\n`;
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
          val = val.slice(1, -1).split(',').map((t) => t.trim()).filter(Boolean);
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
