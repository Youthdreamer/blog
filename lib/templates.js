'use strict';

/* 页面模板：head / nav / footer / 文章卡片 / 首页 / 文章页 / 关于 / 404 */

const { esc } = require('./utils');
const { SITE, absUrl } = require('./config');

/* 字体（Google Fonts） */
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Serif+SC:wght@300;400;600&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet">';

/* 拆分后的资源清单（相对 assets/，按加载顺序） */
const CSS_FILES = ['css/base.css', 'css/layout.css', 'css/components.css', 'css/effects.css'];
const JS_FILES = [
  'vendor/highlight.min.js',
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

  const css = CSS_FILES.map((f) => `  <link rel="stylesheet" href="${prefix}assets/${f}">`).join('\n');
  const js = JS_FILES.map((f) => `  <script defer src="${prefix}assets/${f}"></script>`).join('\n');

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
</body>
</html>`;
}

function shell(title, body, opts = {}) {
  return head(title, opts.desc, opts) + '\n' + nav(opts.current || 'index', opts.prefix) + '\n' + body + '\n' + footer(opts.prefix);
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
  return shell(`${SITE.name} — ${SITE.tagline}`, body, { desc: SITE.desc, url: absUrl('') });
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

module.exports = { renderPost, renderIndex, renderPage };
