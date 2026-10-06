"use strict";

/* 内容视图：文章页 / 首页（分页）/ 标签索引与详情 / 关于 / 404 的渲染 */

const { esc, slugify } = require("./utils");
const { SITE, absUrl, PAGE_SIZE } = require("./config");
const { shell, inlineCoreJs, LINK_FIXER } = require("./shell");

/* 文章标签链接（文章页头部的 # 标签） */
function tagLinks(tags, prefix) {
  return (Array.isArray(tags) ? tags : [])
    .map((t) => `<a href="${prefix}tag/${slugify(t)}.html"># ${esc(t)}</a>`)
    .join("");
}

/* 合集标签正文：合集 · 名字 · 01 / 05（文章页角标与底部小标题共用一套写法） */
function seriesLabel(s) {
  return `合集 · ${esc(s.name)} · ${String(s.order).padStart(2, "0")} / ${String(s.total).padStart(2, "0")}`;
}

function postCard(p, i, prefix = "") {
  const num = typeof p.index === "number" ? p.index : i;
  return `  <a class="post" href="${prefix}post/${esc(p.slug)}.html" data-reveal>
    <p class="meta">${p.pin ? '<span class="pin">置顶</span>' : ""}<span class="no">№ ${String(num + 1).padStart(2, "0")}</span><span>${esc(p.dateText)}</span><span>约 ${p.minutes} 分钟</span></p>
    <h2>${esc(p.title)}</h2>
    ${p.summary ? `    <p class="summary">${esc(p.summary)}</p>` : ""}
  </a>`;
}

/* 紧凑归档条目（用于标签页，区别于首页大卡片） */
function indexItem(p, prefix) {
  return `  <a class="idx" href="${prefix}post/${esc(p.slug)}.html">
    <span class="idx-date">${esc(p.dateText)}</span>
    <span class="idx-title">${p.pin ? '<span class="pin">置顶</span> ' : ""}${esc(p.title)}</span>
  </a>`;
}

/* 合集条目（合集页）：序号 + 标题靠左、日期靠右。
   在一部合集里，顺序比日期要紧，所以把日期让到右边去。
   id="p-<slug>" 是给文章页的合集链接当锚点用的：点进来直接落在本篇这一行 */
function seriesItem(p, no, prefix) {
  return `  <a class="idx" id="p-${esc(p.slug)}" href="${prefix}post/${esc(p.slug)}.html">
    <span class="idx-no">${String(no).padStart(2, "0")}</span>
    <span class="idx-title">${esc(p.title)}</span>
    <span class="idx-date">${esc(p.dateText)}</span>
  </a>`;
}

/* 文章目录（仅小节数 ≥ 5 的长文才显示） */
function renderToc(headings) {
  if (!headings || headings.length < 5) return "";
  let h2Count = 0;
  const items = headings
    .map((h) => {
      if (h.level === 2) {
        h2Count++;
        const no = `<span class="no">${String(h2Count).padStart(2, "0")}</span>`;
        return `    <a href="#${h.id}">${no}${h.text}</a>`;
      }
      return `    <a class="toc-sub" href="#${h.id}">${h.text}</a>`;
    })
    .join("\n");
  return `<nav class="toc" data-reveal>
  <p class="toc-label">目录</p>
${items}
</nav>`;
}

/* 相关文章：按共同标签数排序取前 n 篇（排除自身），无共同标签则不显示 */
function relatedPosts(p, posts, n = 3) {
  const mine = new Set(Array.isArray(p.tags) ? p.tags : []);
  return posts
    .filter((q) => q.slug !== p.slug)
    .map((q) => ({
      q,
      score: (Array.isArray(q.tags) ? q.tags : []).reduce((s, t) => s + (mine.has(t) ? 1 : 0), 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || (a.q.dateISO < b.q.dateISO ? 1 : -1))
    .slice(0, n)
    .map((x) => x.q);
}

function renderPost(p, index, posts) {
  const total = posts.length;
  const prev = posts[index - 1] || null; // 上一篇 = 更新的文章
  const next = posts[index + 1] || null; // 下一篇 = 更旧的文章
  const related = relatedPosts(p, posts);
  const tags = tagLinks(p.tags, "../");
  // 合集角标（写了 series 才出现）：指路回整部合集，顺带报出本篇是第几。
  // 链接带上 #p-<slug> 锚点：落在合集页里本篇那一行（那一行会被点亮），
  // 合集再长也不用从顶上翻找
  const s = p.seriesInfo;
  const seriesUrl = s ? `../series/${s.slug}.html#p-${esc(p.slug)}` : "";
  const seriesPill = s
    ? `    <p class="article-series"><a href="${seriesUrl}">${seriesLabel(s)}</a></p>`
    : "";
  // 合集上/下篇（在合集里、且不止一篇才出现）：读完了，顺着同一条线继续走。
  // 小标题整行指回整部合集；只有一篇的合集没地方可去，整块不出现。
  // 邻篇在构建期已按合集顺序记好（见 lib/build.js 的 seriesInfo），这里照着摆
  const snPrev = s && s.prev
    ? `      <a class="pn prev" href="${esc(s.prev.slug)}.html">
        <span class="pn-label">← 上一篇</span>
        <span class="pn-title">${esc(s.prev.title)}</span>
      </a>`
    : '      <span class="pn prev empty"></span>';
  const snNext = s && s.next
    ? `      <a class="pn next" href="${esc(s.next.slug)}.html">
        <span class="pn-label">下一篇 →</span>
        <span class="pn-title">${esc(s.next.title)}</span>
      </a>`
    : '      <span class="pn next empty"></span>';
  const seriesNav = s && s.total > 1
    ? `  <nav class="series-nav" data-reveal>
    <p class="sn-head"><a href="${seriesUrl}">${seriesLabel(s)} ↗</a></p>
    <div class="sn-links">
${snPrev}
${snNext}
    </div>
  </nav>`
    : "";
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
  const relatedHtml = related.length
    ? `  <nav class="related" data-reveal>
    <p class="related-label">相关文章</p>
${related.map((q) => `    <a class="related-item" href="${esc(q.slug)}.html"><span class="related-date">${esc(q.dateText)}</span><span class="related-title">${esc(q.title)}</span></a>`).join('\n')}
  </nav>`
    : "";
  // 目录：frontmatter toc: false 可关闭
  const toc = p.toc === false ? "" : renderToc(p.headings);
  const updatedHtml = p.updatedText
    ? `<span class="sep">·</span><span>更新于 ${esc(p.updatedText)}</span>`
    : "";
  const body = `<article class="article post-page" data-page="post">
  <header>
    <p class="kicker">est. ${SITE.founded} · 私人写作</p>
    <h1>${esc(p.title)}</h1>
    <p class="meta">
      <span>${esc(p.dateText)}</span>${updatedHtml}<span class="sep">·</span><span>约 ${p.minutes} 分钟</span>
      <span class="sep">·</span><span>№ ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span>
    </p>
    ${seriesPill ? `${seriesPill}\n` : ""}${tags ? `    <p class="article-tags">${tags}</p>\n` : ""}  </header>
  ${toc ? toc + "\n" : ""}  <div class="content" data-reveal>
${p.html}  </div>
  <div class="the-endwrap" data-reveal>
  <p class="the-end">全文完</p>
  <div class="the-secret">
    <span class="spark hint" style="--dx:-18px;--dy:-10px;--dur:3.4s;--delay:0s"></span>
    <span class="spark hint" style="--dx:16px;--dy:-8px;--dur:3.9s;--delay:1.2s"></span>
    <div class="the-reveal">
      <span class="spark" style="--dx:-34px;--dy:-16px;--dur:2.7s;--delay:.1s"></span>
      <span class="spark" style="--dx:30px;--dy:-12px;--dur:3.1s;--delay:.7s"></span>
      <span class="spark" style="--dx:-14px;--dy:-22px;--dur:2.4s;--delay:1.2s"></span>
      <span class="spark" style="--dx:22px;--dy:-18px;--dur:2.9s;--delay:.4s"></span>
      <span class="secret-name">${esc(SITE.author)}</span>
      <span class="secret-seal" title="印章">y。</span>
    </div>
  </div>
  </div>
  <nav class="post-nav" data-reveal>
${prevHtml}
${nextHtml}
  </nav>
${seriesNav}
${relatedHtml}
  <div class="post-foot">
    <a href="../index.html#posts">← 全部文章</a>
    <span class="end">${esc(SITE.name)} · ${esc(p.dateText)}</span>
    <a href="../tags.html">标签 →</a>
  </div>
</article>`;
  const title = `${p.title} — ${SITE.name}`;
  return shell(title, body, {
    current: "posts",
    desc: p.summary,
    prefix: "../",
    url: absUrl(`post/${p.slug}.html`),
    type: "article",
    published: p.dateISO,
    updated: p.updatedISO,
    tags: Array.isArray(p.tags) ? p.tags : [],
  });
}

/* 首页 Hero：kicker 一行顺带报出文章总数（补零，与文章页 № 01 / 06 同一写法） */
function hero(postCount) {
  const total = String(postCount).padStart(2, "0");
  return `<header class="hero">
  <p class="kicker" data-reveal>est. ${SITE.founded} · 私人写作 · ${total} 篇</p>
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
  if (totalPages <= 1) return "";
  const items = [];
  if (page > 1) {
    const href =
      page === 2 ? `${prefix}index.html` : `${prefix}page/${page - 1}.html`;
    items.push(`    <a class="pager" href="${href}">← 上一页</a>`);
  }
  for (let i = 1; i <= totalPages; i++) {
    const href = i === 1 ? `${prefix}index.html` : `${prefix}page/${i}.html`;
    if (i === page) items.push(`    <span class="pager current">${i}</span>`);
    else items.push(`    <a class="pager" href="${href}">${i}</a>`);
  }
  if (page < totalPages) {
    items.push(
      `    <a class="pager" href="${prefix}page/${page + 1}.html">下一页 →</a>`,
    );
  }
  return `<nav class="pagination" data-reveal>\n${items.join("\n")}\n  </nav>`;
}

function renderIndexPage(posts, page, totalPages) {
  const start = (page - 1) * PAGE_SIZE;
  const slice = posts.slice(start, start + PAGE_SIZE);
  const isFirst = page === 1;
  const prefix = isFirst ? "" : "../";

  const list = slice.map((p, i) => postCard(p, start + i, prefix)).join("\n");
  const pagination = paginationLinks(page, totalPages, prefix);

  const headPart = isFirst
    ? hero(posts.length)
    : `<header class="page-head">
  <p class="kicker" data-reveal>第 ${page} 页 · 共 ${totalPages} 页</p>
</header>`;

  const body = `${headPart}

<main class="section" id="posts">
  <h2 class="section-title" data-reveal>全部文章</h2>
${list}
${pagination}
</main>`;

  const title = isFirst
    ? `${SITE.name} — ${SITE.tagline}`
    : `第 ${page} 页 — ${SITE.name}`;
  const url = isFirst ? absUrl("") : absUrl(`page/${page}.html`);
  return shell(title, body, { desc: SITE.desc, url, prefix });
}

/* 标签索引页（/tags.html）——简洁大气的加权词云：
   字号按文章数平滑缩放（开方曲线，1.05–1.9rem），颜色统一，权重隐约可见不突兀；
   每个标签以极轻的错峰悬浮缓慢浮动（如尘埃在光里呼吸）；
   悬停时停驻、转金，底部金细线从左向右流动描出指向 */
function renderTagsIndex(tagList, postCount) {
  const maxN = Math.max(...tagList.map(([, posts]) => posts.length), 1);
  const items = tagList
    .map(([tag, posts], i) => {
      // 开方曲线压缩差距：1 篇 → 1.05rem，最多的 → 1.9rem，中间平滑过渡
      const t = maxN > 1 ? Math.sqrt((posts.length - 1) / (maxN - 1)) : 0;
      const size = (1.05 + 0.85 * t).toFixed(2);
      return `    <li style="--fd:${(i % 6) * 800}ms; font-size:${size}rem" data-reveal><a href="tag/${slugify(tag)}.html"><span class="wc-name">${esc(tag)}</span><span class="wc-count">${posts.length}</span></a></li>`;
    })
    .join("\n");
  const body = `<header class="page-head">
  <p class="kicker" data-reveal>tags · ${tagList.length} 个 · ${postCount} 篇</p>
  <h1 class="display" data-reveal>标签</h1>
</header>

<main class="section tag-section">
  <ul class="word-cloud">
${items}
  </ul>
</main>`;
  return shell(`标签 — ${SITE.name}`, body, {
    current: "tags",
    desc: `全部标签（共 ${tagList.length} 个）。`,
    url: absUrl("tags.html"),
  });
}

/* 单个标签页（/tag/<slug>.html） */
function renderTagPage(tag, posts) {
  const prefix = "../"; // tag 页面在 tag/ 子目录
  const list = posts.map((p) => indexItem(p, prefix)).join("\n");
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
    current: "tags",
    desc: `标签「${tag}」下的 ${posts.length} 篇文章。`,
    url: absUrl(`tag/${slugify(tag)}.html`),
    prefix,
  });
}

/* 合集索引页（/series.html）——卡片式：
   每部合集一张卡，名字与篇数一行，一句简介，底下把开头几篇的标题用 · 串成一串，
   像先把这条线摊开给你看一眼。
   简介是独立的，写在 content/series.md 里（见 lib/content.js 的 loadSeriesDesc），
   没写就不显示——不借用任何文章的摘要 */
function renderSeriesIndex(seriesList, postCount) {
  const items = seriesList
    .map(([name, list, desc]) => {
      const titles =
        list.slice(0, 4).map((p) => esc(p.title)).join(" · ") +
        (list.length > 4 ? " …" : "");
      return `    <li data-reveal><a class="series-card" href="series/${slugify(name)}.html">
      <p class="sc-head"><span class="sc-name">${esc(name)}</span><span class="sc-count">${list.length} 篇</span></p>
${desc ? `      <p class="sc-desc">${esc(desc)}</p>\n` : ""}      <p class="sc-titles">${titles}</p>
    </a></li>`;
    })
    .join("\n");

  // 导航里常驻「合集」这一项，零合集时这页也得说句话
  const body = `<header class="page-head">
  <p class="kicker" data-reveal>series · ${seriesList.length} 部 · ${postCount} 篇</p>
  <h1 class="display" data-reveal>合集</h1>
</header>

<main class="section series-section">
${
    items
      ? `  <ul class="series-list">\n${items}\n  </ul>`
      : `  <p class="series-empty" data-reveal>还没有合集。在文章 frontmatter 里写 series: 合集名 即可加入。</p>`
  }
</main>`;
  return shell(`合集 — ${SITE.name}`, body, {
    current: "series",
    desc: `全部合集（共 ${seriesList.length} 部）。`,
    url: absUrl("series.html"),
  });
}

/* 单部合集页（/series/<slug>.html）——按合集内的顺序读下来就是一条完整的路 */
function renderSeriesPage(name, posts) {
  const prefix = "../"; // 合集页在 series/ 子目录
  const list = posts.map((p, i) => seriesItem(p, i + 1, prefix)).join("\n");
  const body = `<header class="page-head">
  <p class="kicker" data-reveal>series · 共 ${posts.length} 篇</p>
  <h1 class="display" data-reveal>${esc(name)}</h1>
</header>

<main class="section">
  <div class="idx-list series-posts" data-reveal>
${list}
  </div>
</main>`;
  return shell(`${name} — ${SITE.name}`, body, {
    current: "series",
    desc: `合集「${name}」下的 ${posts.length} 篇文章。`,
    url: absUrl(`series/${slugify(name)}.html`),
    prefix,
  });
}

function renderPage(page, kind) {
  const title = `${page.title} — ${SITE.name}`;
  if (kind === "about") {
    const body = `<header class="about-hero">
  <p class="kicker" data-reveal>about</p>
  <h1 class="display" data-reveal>${esc(page.title)}</h1>
</header>
<article class="article">
  <div class="content" data-reveal>
${page.html}  </div>
  <p class="signature" data-reveal>${esc(SITE.author)}</p>
</article>`;
    return shell(title, body, { current: "about", url: absUrl("about.html") });
  }
  if (kind === "404") {
    const body = `<main class="lost">
  <p class="kicker" data-reveal>error 404</p>
  <h1 class="display" data-reveal>${esc(page.title)}</h1>
  <div class="lost-copy" data-reveal>${page.html}</div>
  <a class="btn" href="index.html" data-reveal>回到首页</a>
</main>
${inlineCoreJs()}
${LINK_FIXER}`;
    return shell(title, body, {
      current: "index",
      noindex: true,
      inline: true,
    });
  }
  return "";
}

module.exports = {
  renderPost,
  renderIndexPage,
  renderPage,
  renderTagsIndex,
  renderTagPage,
  renderSeriesIndex,
  renderSeriesPage,
};
