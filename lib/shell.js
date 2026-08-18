"use strict";

/* 页面骨架：字体 / 资源清单 / head / nav / footer / shell
   以及 404 自包含模式的辅助（内联 CSS/JS、链接自愈脚本） */

const fs = require("fs");
const path = require("path");
const { esc } = require("./utils");
const { SITE, PATHS, absUrl, VERSION, YEAR } = require("./config");

/* 字体（国内镜像 fonts.loli.net，异步加载不阻塞首屏渲染） */
const FONT_URL =
  "https://fonts.loli.net/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Noto+Serif+SC:wght@300;400;600&family=JetBrains+Mono:wght@300;400&display=swap";
const FONTS =
  '<link rel="preconnect" href="https://fonts.loli.net">' +
  '<link rel="preconnect" href="https://gstatic.loli.net" crossorigin>' +
  `<link href="${FONT_URL}" rel="stylesheet" media="print" onload="this.media='all'">` +
  `<noscript><link href="${FONT_URL}" rel="stylesheet"></noscript>`;

/* 拆分后的资源清单（相对 assets/，按加载顺序） */
const CSS_FILES = [
  "css/base.css",
  "css/layout.css",
  "css/components.css",
  "css/effects.css",
];
const JS_FILES = [
  "vendor/highlight.min.js",
  "vendor/highlight-languages.min.js",
  "js/posts-data.js",
  "js/core.js",
  "js/effects.js",
  "js/enhance.js",
  "js/preview.js",
];

/* ---------- 404 自包含模式 ----------
   404 页会被服务器托管到任意深度的 URL（如 /post/xxx.html/sdsd），
   相对资源链接必然解析错位。因此构建时把 CSS 与核心 JS 直接内联进页面，
   页面内链接再由 404 页内置的“链接自愈”脚本在运行时修正。 */
function readAsset(rel) {
  return fs.readFileSync(path.join(PATHS.assets, rel), "utf8");
}

function inlineCss() {
  const files = [
    "css/base.css",
    "css/layout.css",
    "css/components.css",
    "css/effects.css",
  ];
  return `<style>\n${files.map((f) => readAsset(f)).join("\n")}\n</style>`;
}

/* 内联到 404 页 body 末尾的核心 JS（reveal 渐显 / 光晕 / 年份 / 彩蛋） */
function inlineCoreJs() {
  const files = ["js/core.js", "js/effects.js"];
  return `<script>\n${files.map((f) => readAsset(f)).join("\n")}\n</script>`;
}

/* 链接自愈：向上探测站点根（第一个存在 index.html 的祖先目录），
   把相对链接改写为指向根的绝对路径，任何深度都正确跳转 */
const LINK_FIXER = `<script>
(function () {
  'use strict';
  function dirOf(p) {
    var i = p.lastIndexOf('/');
    return i <= 0 ? '/' : p.slice(0, i + 1);
  }
  var dir = dirOf(location.pathname);
  var steps = 0;
  function apply(root) {
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href');
      if (h && !/^(https?:|mailto:|tel:|#|\\/)/.test(h)) links[i].href = root + h;
    }
    var icon = document.querySelector('link[rel="icon"]');
    if (icon) {
      var ih = icon.getAttribute('href');
      if (ih && !/^(https?:|data:|\\/)/.test(ih)) icon.href = root + ih;
    }
  }
  function step() {
    if (steps++ >= 8) { apply('/'); return; }
    var x = new XMLHttpRequest();
    x.open('HEAD', dir + 'index.html', true);
    x.timeout = 2000;
    x.onload = function () { if (x.status === 200) apply(dir); else goUp(); };
    x.onerror = goUp;
    x.ontimeout = goUp;
    x.send();
  }
  function goUp() {
    var next = dir.replace(/[^/]*\\/$/, '');
    if (!next || next === dir) { apply('/'); return; }
    dir = next;
    step();
  }
  document.addEventListener('DOMContentLoaded', step);
})();
</script>`;

/* JSON-LD 结构化数据 */
function buildJsonLd(type, title, desc, url, published, tags, updated) {
  const data =
    type === "article"
      ? {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: title,
          description: desc,
          url,
          datePublished: published,
          dateModified: updated || published,
          author: { "@type": "Person", name: SITE.author },
          publisher: { "@type": "Person", name: SITE.author },
          mainEntityOfPage: { "@type": "WebPage", "@id": url },
          keywords: tags.join(", "),
          inLanguage: "zh-CN",
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE.name,
          description: SITE.desc,
          url: absUrl(""),
          author: { "@type": "Person", name: SITE.author },
        };
  // 防止用户内容里的 </script> 破坏页面
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function head(title, desc, opts = {}) {
  const prefix = opts.prefix || "";
  const url = opts.url || absUrl("");
  const type = opts.type || "website";
  const image = opts.image || absUrl(SITE.image);
  const published = opts.published || "";
  const updated = opts.updated || "";
  const tags = opts.tags || [];
  const noindex = !!opts.noindex;
  const d = desc || SITE.desc;

  const css = opts.inline
    ? inlineCss()
    : CSS_FILES.map(
        (f) =>
          `  <link rel="stylesheet" href="${prefix}assets/${f}?v=${VERSION}">`,
      ).join("\n");
  const js = opts.inline
    ? "" // 核心 JS 内联到 body 末尾（见 views.js 的 renderPage 404 分支）
    : JS_FILES.map(
        (f) =>
          `  <script defer src="${prefix}assets/${f}?v=${VERSION}"></script>`,
      ).join("\n");

  const articleMeta =
    type === "article"
      ? `
  <meta property="article:published_time" content="${published}">
  <meta property="article:modified_time" content="${updated || published}">
  <meta property="article:author" content="${esc(SITE.author)}">
${tags.map((t) => `  <meta property="article:tag" content="${esc(t)}">`).join("\n")}`
      : "";

  const jsonLd = buildJsonLd(type, title, d, url, published, tags, updated);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(d)}">
<meta name="author" content="${esc(SITE.author)}">
<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}">
${noindex ? "" : `<link rel="canonical" href="${esc(url)}">`}
<meta name="theme-color" content="#12100e">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:locale" content="${esc(SITE.locale)}">
<meta property="og:type" content="${type === "article" ? "article" : "website"}">
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
<button id="to-top" type="button" aria-label="回到顶部" title="回到顶部">
  <svg viewBox="0 0 52 52" aria-hidden="true" focusable="false"><path class="tt-frame" d="M29.82 7.63 Q26 3 22.18 7.63 L10.82 21.37 Q7 26 10.82 30.63 L22.18 44.37 Q26 49 29.82 44.37 L41.18 30.63 Q45 26 41.18 21.37 Z" fill="none" stroke="currentColor" stroke-width="0.75" stroke-linejoin="round"/><path class="tt-v" d="M17.5 31 L26 21 L34.5 31" fill="none" stroke="currentColor" stroke-width="0.75" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>
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

function nav(current, prefix = "") {
  const link = (href, label, key) =>
    `    <a href="${prefix}${href}"${current === key ? ' class="on"' : ""}>${label}</a>`;
  return `<nav class="nav">
  <a class="logo" href="${prefix}index.html" title="回到首页">y<span>.</span></a>
  <div class="nav-links">
${link("index.html", "首页", "index")}
${link("index.html#posts", "文章", "posts")}
${link("tags.html", "标签", "tags")}
${link("about.html", "关于", "about")}
  </div>
</nav>`;
}

function footer(prefix = "") {
  return `<footer>
  <span class="seal" title="印章">y。</span>
  <p class="line">© <span data-year>${YEAR}</span> ${esc(SITE.author)} · ${esc(SITE.tagline)}</p>
  <p class="line dim">built with paper &amp; code — no frameworks were harmed</p>
</footer>
<div id="toast" role="status"></div>
</body>
</html>`;
}

function shell(title, body, opts = {}) {
  return (
    head(title, opts.desc, opts) +
    "\n" +
    nav(opts.current || "index", opts.prefix) +
    "\n" +
    body +
    "\n" +
    footer(opts.prefix)
  );
}

module.exports = { shell, inlineCoreJs, LINK_FIXER };
