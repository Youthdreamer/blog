#!/usr/bin/env node
/* ============================================================
   youth — 零依赖构建脚本
   把 content/ 下的 Markdown 编译成 site/ 下的静态站点

   用法：node build.js
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT       = __dirname;
const CONTENT    = path.join(ROOT, 'content');
const POSTS_SRC  = path.join(CONTENT, 'posts');
const PAGES_SRC  = path.join(CONTENT, 'pages');
const ASSETS_SRC = path.join(ROOT, 'assets');
const OUT        = path.join(ROOT, 'site');

/* ---------- 站点配置（改这里就能整站换名字） ---------- */
const SITE = {
  name: 'youth',
  author: 'youth',
  tagline: '于静默处，听见回响。',
  desc: '一间写给时间、也写给你我的小屋。',
  url: 'https://example.com', // 部署后改成你的域名
};

/* ---------- 工具函数 ---------- */

const esc = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const slugify = (s) => s.toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .replace(/^-+|-+$/g, '');

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function readMinutes(text) {
  const chars = text.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 400));
}

/* ---------- 迷你 Markdown 解析器（够用就好） ---------- */

function inline(src) {
  return esc(src)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
}

function mdToHtml(src) {
  const lines = src.split('\n');
  let html = '';
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
        html += `<pre><code class="lang-${esc(codeLang || 'text')}">${esc(codeBuf.join('\n'))}</code></pre>\n`;
        inCode = false;
      }
      i++; continue;
    }
    if (inCode) { codeBuf.push(line); i++; continue; }

    // 标题
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      html += `<h${lvl}>${inline(h[2])}</h${lvl}>\n`;
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
      html += `<blockquote>\n${mdToHtml(buf.join('\n'))}</blockquote>\n`;
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

  return html;
}

/* ---------- frontmatter 解析 ---------- */

function parseMd(raw) {
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

/* ---------- 页面外壳模板 ---------- */

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Serif+SC:wght@300;400;600&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">';

function head(title, desc, prefix = '') {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc || SITE.desc)}">
<meta name="theme-color" content="#12100e">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc || SITE.desc)}">
<meta property="og:type" content="website">
<link rel="icon" type="image/svg+xml" href="${prefix}assets/favicon.svg">
<link rel="stylesheet" href="${prefix}assets/css/style.css">
${FONTS}
</head>
<body>
<div id="progress"></div>
<div id="glow"></div>`;
}

function nav(current, prefix = '') {
  const link = (href, label, key) =>
    `    <a href="${prefix}${href}"${current === key ? ' class="on"' : ''}>${label}</a>`;
  return `<nav class="nav">
  <a class="logo" href="${prefix}index.html" title="回到首页">y<span>.</span></a>
  <div class="nav-links">
${link('index.html', '首页', 'index')}
${link('index.html#posts', '文章', 'posts')}
${link('about.html', '关于', 'about')}
  </div>
</nav>`;
}

function footer(prefix = '') {
  return `<footer>
  <span class="seal" title="印章">y。</span>
  <p class="line">© <span data-year>2025</span> ${esc(SITE.author)} · ${esc(SITE.tagline)}</p>
  <p class="line dim">built with paper &amp; code — no frameworks were harmed</p>
</footer>
<div id="toast" role="status"></div>
<script src="${prefix}assets/js/main.js"></script>
</body>
</html>`;
}

function shell(title, body, opts = {}) {
  return head(title, opts.desc, opts.prefix) + '\n' + nav(opts.current || 'index', opts.prefix) + '\n' + body + '\n' + footer(opts.prefix);
}

/* ---------- 文章 ---------- */

function loadPosts() {
  return fs.readdirSync(POSTS_SRC)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { meta, body } = parseMd(fs.readFileSync(path.join(POSTS_SRC, f), 'utf8'));
      return {
        ...meta,
        slug: meta.slug || slugify(meta.title || f),
        body,
        html: mdToHtml(body),
        minutes: readMinutes(body),
        dateISO: meta.date ? new Date(meta.date).toISOString().slice(0, 10) : '',
        dateText: meta.date ? formatDate(meta.date) : '',
      };
    })
    .filter((p) => !p.draft)
    .sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
}

function postCard(p, i) {
  const tags = Array.isArray(p.tags)
    ? p.tags.map((t) => `<span># ${esc(t)}</span>`).join('')
    : '';
  return `  <a class="post" href="post/${esc(p.slug)}.html" data-reveal>
    <p class="meta"><span class="no">№ ${String(i + 1).padStart(2, '0')}</span><span>${esc(p.dateText)}</span><span>约 ${p.minutes} 分钟</span></p>
    <h2>${esc(p.title)}</h2>
    ${p.summary ? `    <p class="summary">${esc(p.summary)}</p>\n` : ''}    <p class="tags">${tags}</p>
  </a>`;
}

function renderPost(p, index, total) {
  const tags = Array.isArray(p.tags)
    ? p.tags.map((t) => `<span># ${esc(t)}</span>`).join('')
    : '';
  const body = `<article class="article post-page" data-page="post">
  <header>
    <p class="kicker">est. 2025 · 私人写作</p>
    <h1>${esc(p.title)}</h1>
    <p class="meta">
      <span>${esc(p.dateText)}</span><span class="sep">·</span><span>约 ${p.minutes} 分钟</span>
      <span class="sep">·</span><span>№ ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
    </p>
  </header>
  <div class="content" data-reveal>
${p.html}  </div>
  <div class="post-foot">
    <a href="../index.html#posts">← 返回文章</a>
    <span class="end">${esc(SITE.name)} · ${esc(p.dateText)}</span>
    <a href="../about.html">关于 →</a>
  </div>
</article>`;
  const title = `${p.title} — ${SITE.name}`;
  return shell(title, body, { current: 'posts', desc: p.summary, prefix: '../' });
}

/* ---------- 首页 ---------- */

function renderIndex(posts) {
  const list = posts.map(postCard).join('\n');
  const body = `<header class="hero">
  <p class="kicker" data-reveal>est. 2025 · 私人写作</p>
  <div class="hero-title" data-reveal>
    <h1 class="display stagger">${esc(SITE.name)}<span class="dot">.</span></h1>
    <span class="hero-note" aria-hidden="true"><span class="hero-note-dot">◇</span>以字为居</span>
  </div>
  <p class="tagline" data-reveal>${esc(SITE.tagline)}<br>${esc(SITE.desc)}</p>
  <div class="rule" data-reveal></div>
  <a class="scroll" href="#posts" data-reveal>向下卷动 ↓</a>
</header>

<main class="section" id="posts">
  <h2 class="section-title" data-reveal>全部文章</h2>
${list}
</main>`;
  return shell(`${SITE.name} — ${SITE.tagline}`, body, { desc: SITE.desc });
}

/* ---------- 普通页面（关于 / 404） ---------- */

function renderPage(page, kind) {
  const title = `${page.title} — ${SITE.name}`;
  if (kind === 'about') {
    const body = `<header class="about-hero">
  <p class="kicker" data-reveal>about</p>
  <h1 class="display" data-reveal>${esc(page.title)}</h1>
</header>
<article class="article">
  <div class="content" data-reveal>
${page.html}  </div>
  <p class="signature" data-reveal>${esc(SITE.author)}</p>
</article>`;
    return shell(title, body, { current: 'about' });
  }
  if (kind === '404') {
    const body = `<main class="lost">
  <p class="kicker" data-reveal>error 404</p>
  <h1 class="display" data-reveal>${esc(page.title)}</h1>
  <div class="lost-copy" data-reveal>${page.html}</div>
  <a class="btn" href="index.html" data-reveal>回到首页</a>
</main>`;
    return shell(title, body, { current: 'index' });
  }
  return '';
}

/* ---------- 构建 ---------- */

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function build() {
  // 清理并重建
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'post'), { recursive: true });

  // 拷贝静态资源
  copyDir(ASSETS_SRC, path.join(OUT, 'assets'));

  // 文章
  const posts = loadPosts();
  posts.forEach((p, i) => {
    fs.writeFileSync(path.join(OUT, 'post', `${p.slug}.html`), renderPost(p, i, posts.length));
  });

  // 首页
  fs.writeFileSync(path.join(OUT, 'index.html'), renderIndex(posts));

  // 关于 / 404
  for (const [file, kind] of [['about.md', 'about'], ['404.md', '404']]) {
    const { meta, body } = parseMd(fs.readFileSync(path.join(PAGES_SRC, file), 'utf8'));
    const page = { ...meta, html: mdToHtml(body) };
    fs.writeFileSync(path.join(OUT, kind === '404' ? '404.html' : 'about.html'), renderPage(page, kind));
  }

  // 统计
  console.log(`✓ ${posts.length} 篇文章已构建`);
  console.log(`✓ 页面：index.html · about.html · 404.html · post/*.html`);
  console.log(`✓ 输出目录：${OUT}`);
  console.log(`✓ 零依赖，构建完成。`);
}

build();
