'use strict';

/* 页面模板：head / nav / footer / 文章卡片 / 首页（分页）/ 文章页 / 标签页 / 关于 / 404 */

const { esc, slugify } = require('./utils');
const { SITE, absUrl, PAGE_SIZE, VERSION } = require('./config');

/* 字体（国内镜像 fonts.loli.net，异步加载不阻塞首屏渲染） */
const FONT_URL = 'https://fonts.loli.net/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Serif+SC:wght@300;400;600&family=JetBrains+Mono:wght@300;400&display=swap';
const FONTS = '<link rel="preconnect" href="https://fonts.loli.net">' +
  '<link rel="preconnect" href="https://gstatic.loli.net" crossorigin>' +
  `<link href="${FONT_URL}" rel="stylesheet" media="print" onload="this.media='all'">` +
  `<noscript><link href="${FONT_URL}" rel="stylesheet"></noscript>`;

/* 拆分后的资源清单（相对 assets/，按加载顺序） */
const CSS_FILES = ['css/base.css', 'css/layout.css', 'css/components.css', 'css/effects.css'];
const JS_FILES = [
  'vendor/highlight.min.js',
  'vendor/highlight-languages.min.js',
  'js/posts-data.js',
  'js/core.js',
  'js/effects.js',
  'js/enhance.js',
  'js/preview.js',
];

/* JSON-LD 结构化数据 */
function buildJsonLd(type, title, desc, url, published, tags) {
  const data = type === 'article'
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        description: desc,
        url,
        datePublished: published,
        dateModified: published,
        author: { '@type': 'Person', name: SITE.author },
        publisher: { '@type': 'Person', name: SITE.author },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        keywords: tags.join(', '),
        inLanguage: 'zh-CN',
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: SITE.name,
        description: SITE.desc,
        url: absUrl(''),
        author: { '@type': 'Person', name: SITE.author },
      };
  // 防止用户内容里的 </script> 破坏页面
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function head(title, desc, opts = {}) {
  const prefix = opts.prefix || '';
  const url = opts.url || absUrl('');
  const type = opts.type || 'website';
  const image = opts.image || absUrl(SITE.image);
  const published = opts.published || '';
  const tags = opts.tags || [];
  const noindex = !!opts.noindex;
  const d = desc || SITE.desc;

  const css = CSS_FILES.map((f) => `  <link rel="stylesheet" href="${prefix}assets/${f}?v=${VERSION}">`).join('\n');
  const js = JS_FILES.map((f) => `  <script defer src="${prefix}assets/${f}?v=${VERSION}"></script>`).join('\n');

  const articleMeta = type === 'article'
    ? `
  <meta property="article:published_time" content="${published}">
  <meta property="article:modified_time" content="${published}">
  <meta property="article:author" content="${esc(SITE.author)}">
${tags.map((t) => `  <meta property="article:tag" content="${esc(t)}">`).join('\n')}`
    : '';

  const jsonLd = buildJsonLd(type, title, d, url, published, tags);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(d)}">
<meta name="author" content="${esc(SITE.author)}">
<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}">
${noindex ? '' : `<link rel="canonical" href="${esc(url)}">`}
<meta name="theme-color" content="#12100e">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:locale" content="${esc(SITE.locale)}">
<meta property="og:type" content="${type === 'article' ? 'article' : 'website'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">${articleMeta}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(d)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" type="image/svg+xml" href="${prefix}assets/favicon.svg">
${css}
${FONTS}
${js}
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<div id="progress"></div>
<div id="glow"></div>
<div id="loader" aria-hidden="true">
  <svg class="ld1" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg"><path d="M26 3 L45 26 L26 49 L7 26 Z" fill="none" stroke="currentColor" stroke-opacity=".45" stroke-linejoin="round"/></svg>
  <svg class="ld2" viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg"><path d="M26 13 L36 26 L26 39 L16 26 Z" fill="none" stroke="currentColor" stroke-opacity=".32" stroke-linejoin="round"/></svg>
</div>
<script>
  (function () {
    var l = document.getElementById('loader');
    var t = setTimeout(function () { if (l) l.classList.add('show'); }, 200);
    document.addEventListener('DOMContentLoaded', function () {
      clearTimeout(t);
      if (l) { l.classList.remove('show'); setTimeout(function () { l.style.display = 'none'; }, 600); }
    });
  })();
</script>`;
}

function nav(current, prefix = '') {
  const link = (href, label, key) =>
    `    <a href="${prefix}${href}"${current === key ? ' class="on"' : ''}>${label}</a>`;
  return `<nav class="nav">
  <a class="logo" href="${prefix}index.html" title="回到首页">y<span>.</span></a>
  <div class="nav-links">
${link('index.html', '首页', 'index')}
${link('index.html#posts', '文章', 'posts')}
${link('tags.html', '标签', 'tags')}
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
</body>
</html>`;
}

function shell(title, body, opts = {}) {
  return head(title, opts.desc, opts) + '\n' + nav(opts.current || 'index', opts.prefix) + '\n' + body + '\n' + footer(opts.prefix);
}

function tagLinks(tags, prefix) {
  return (Array.isArray(tags) ? tags : [])
    .map((t) => `<a href="${prefix}tag/${slugify(t)}.html"># ${esc(t)}</a>`)
    .join('');
}

function postCard(p, i, prefix = '') {
  const num = typeof p.index === 'number' ? p.index : i;
  return `  <a class="post" href="${prefix}post/${esc(p.slug)}.html" data-reveal>
    <p class="meta"><span class="no">№ ${String(num + 1).padStart(2, '0')}</span><span>${esc(p.dateText)}</span><span>约 ${p.minutes} 分钟</span></p>
    <h2>${esc(p.title)}</h2>
    ${p.summary ? `    <p class="summary">${esc(p.summary)}</p>` : ''}
  </a>`;
}

/* 紧凑归档条目（用于标签页，区别于首页大卡片） */
function indexItem(p, prefix) {
  return `  <a class="idx" href="${prefix}post/${esc(p.slug)}.html">
    <span class="idx-date">${esc(p.dateText)}</span>
    <span class="idx-title">${esc(p.title)}</span>
  </a>`;
}

/* 文章目录（仅小节数 ≥ 5 的长文才显示） */
function renderToc(headings) {
  if (!headings || headings.length < 5) return '';
  let h2Count = 0;
  const items = headings.map((h) => {
    if (h.level === 2) {
      h2Count++;
      const no = `<span class="no">${String(h2Count).padStart(2, '0')}</span>`;
      return `    <a href="#${h.id}">${no}${h.text}</a>`;
    }
    return `    <a class="toc-sub" href="#${h.id}">${h.text}</a>`;
  }).join('\n');
  return `<nav class="toc" data-reveal>
  <p class="toc-label">目录</p>
${items}
</nav>`;
}

function renderPost(p, index, total, prev, next) {
  const tags = tagLinks(p.tags, '../');
  const prevHtml = prev
    ? `    <a class="pn prev" href="${esc(prev.slug)}.html">
      <span class="pn-label">← 上一篇</span>
      <span class="pn-title">${esc(prev.title)}</span>
    </a>`
    : '    <span class="pn prev empty"></span>';
  const nextHtml = next
    ? `    <a class="pn next" href="${esc(next.slug)}.html">
      <span class="pn-label">下一篇 →</span>
      <span class="pn-title">${esc(next.title)}</span>
    </a>`
    : '    <span class="pn next empty"></span>';
  const toc = renderToc(p.headings);
  const body = `<article class="article post-page" data-page="post">
  <header>
    <p class="kicker">est. 2025 · 私人写作</p>
    <h1>${esc(p.title)}</h1>
    <p class="meta">
      <span>${esc(p.dateText)}</span><span class="sep">·</span><span>约 ${p.minutes} 分钟</span>
      <span class="sep">·</span><span>№ ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
    </p>
    ${tags ? `    <p class="article-tags">${tags}</p>\n` : ''}  </header>
  ${toc ? toc + '\n' : ''}  <div class="content" data-reveal>
${p.html}  </div>
  <nav class="post-nav" data-reveal>
${prevHtml}
${nextHtml}
  </nav>
  <div class="post-foot">
    <a href="../index.html#posts">← 全部文章</a>
    <span class="end">${esc(SITE.name)} · ${esc(p.dateText)}</span>
    <a href="../tags.html">标签 →</a>
  </div>
</article>`;
  const title = `${p.title} — ${SITE.name}`;
  return shell(title, body, {
    current: 'posts',
    desc: p.summary,
    prefix: '../',
    url: absUrl(`post/${p.slug}.html`),
    type: 'article',
    published: p.dateISO,
    tags: Array.isArray(p.tags) ? p.tags : [],
  });
}

/* 首页 Hero */
function hero() {
  return `<header class="hero">
  <p class="kicker" data-reveal>est. 2025 · 私人写作</p>
  <div class="hero-title" data-reveal>
    <h1 class="display stagger">${esc(SITE.name)}<span class="dot">.</span></h1>
    <span class="hero-note" aria-hidden="true"><span class="hero-note-dot">◇</span>以字为居</span>
  </div>
  <p class="tagline" data-reveal>${esc(SITE.tagline)}<br>${esc(SITE.desc)}</p>
  <div class="rule" data-reveal></div>
  <a class="scroll" href="#posts" data-reveal>向下卷动 ↓</a>
</header>`;
}

/* 分页导航 */
function paginationLinks(page, totalPages, prefix) {
  if (totalPages <= 1) return '';
  const items = [];
  if (page > 1) {
    const href = page === 2 ? `${prefix}index.html` : `${prefix}page/${page - 1}.html`;
    items.push(`    <a class="pager" href="${href}">← 上一页</a>`);
  }
  for (let i = 1; i <= totalPages; i++) {
    const href = i === 1 ? `${prefix}index.html` : `${prefix}page/${i}.html`;
    if (i === page) items.push(`    <span class="pager current">${i}</span>`);
    else items.push(`    <a class="pager" href="${href}">${i}</a>`);
  }
  if (page < totalPages) {
    items.push(`    <a class="pager" href="${prefix}page/${page + 1}.html">下一页 →</a>`);
  }
  return `<nav class="pagination" data-reveal>\n${items.join('\n')}\n  </nav>`;
}

function renderIndexPage(posts, page, totalPages) {
  const start = (page - 1) * PAGE_SIZE;
  const slice = posts.slice(start, start + PAGE_SIZE);
  const isFirst = page === 1;
  const prefix = isFirst ? '' : '../';

  const list = slice.map((p, i) => postCard(p, start + i, prefix)).join('\n');
  const pagination = paginationLinks(page, totalPages, prefix);

  const headPart = isFirst
    ? hero()
    : `<header class="page-head">
  <p class="kicker" data-reveal>第 ${page} 页 · 共 ${totalPages} 页</p>
</header>`;

  const body = `${headPart}

<main class="section" id="posts">
  <h2 class="section-title" data-reveal>全部文章</h2>
${list}
${pagination}
</main>`;

  const title = isFirst ? `${SITE.name} — ${SITE.tagline}` : `第 ${page} 页 — ${SITE.name}`;
  const url = isFirst ? absUrl('') : absUrl(`page/${page}.html`);
  return shell(title, body, { desc: SITE.desc, url, prefix });
}

/* 标签索引页（/tags.html） */
function renderTagsIndex(tagList) {
  const items = tagList.map(([tag, posts]) =>
    `    <li><a href="tag/${slugify(tag)}.html"><span class="tag-name">${esc(tag)}</span><span class="tag-count">${posts.length}</span></a></li>`
  ).join('\n');
  const body = `<header class="page-head">
  <p class="kicker" data-reveal>tags · ${tagList.length} 个</p>
  <h1 class="display" data-reveal>标签</h1>
</header>

<main class="section">
  <ul class="tag-cloud" data-reveal>
${items}
  </ul>
</main>`;
  return shell(`标签 — ${SITE.name}`, body, {
    current: 'tags',
    desc: `全部标签（共 ${tagList.length} 个）。`,
    url: absUrl('tags.html'),
  });
}

/* 单个标签页（/tag/<slug>.html） */
function renderTagPage(tag, posts) {
  const prefix = '../'; // tag 页面在 tag/ 子目录
  const list = posts.map((p) => indexItem(p, prefix)).join('\n');
  const body = `<header class="page-head">
  <p class="kicker" data-reveal>tag · 共 ${posts.length} 篇</p>
  <h1 class="display" data-reveal>${esc(tag)}</h1>
</header>

<main class="section">
  <div class="idx-list" data-reveal>
${list}
  </div>
</main>`;
  return shell(`${tag} — ${SITE.name}`, body, {
    current: 'tags',
    desc: `标签「${tag}」下的 ${posts.length} 篇文章。`,
    url: absUrl(`tag/${slugify(tag)}.html`),
    prefix,
  });
}

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
    return shell(title, body, { current: 'about', url: absUrl('about.html') });
  }
  if (kind === '404') {
    const body = `<main class="lost">
  <p class="kicker" data-reveal>error 404</p>
  <h1 class="display" data-reveal>${esc(page.title)}</h1>
  <div class="lost-copy" data-reveal>${page.html}</div>
  <a class="btn" href="index.html" data-reveal>回到首页</a>
</main>`;
    return shell(title, body, { current: 'index', noindex: true });
  }
  return '';
}

module.exports = { renderPost, renderIndexPage, renderPage, renderTagsIndex, renderTagPage };
