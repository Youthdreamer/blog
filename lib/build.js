'use strict';

/* 构建流程：清理、拷贝资源、生成元数据、渲染页面、标签页、SEO 产物 */

const fs = require('fs');
const path = require('path');
const { PATHS, SITE, absUrl, PAGE_SIZE } = require('./config');
const { esc, slugify } = require('./utils');
const { loadPosts, loadPages, loadSeriesDesc } = require('./content');
const {
  renderPost, renderIndexPage, renderPage,
  renderTagsIndex, renderTagPage, renderSeriesIndex, renderSeriesPage,
} = require('./views');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/* 汇总所有标签，按文章数降序、名称升序 */
function collectTags(posts) {
  const map = new Map();
  for (const p of posts) {
    for (const t of (Array.isArray(p.tags) ? p.tags : [])) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(p);
    }
  }
  return [...map.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
  );
}

/* 合集内排序：默认按发布日期从早到晚——不同时间发布的文章，就这么连成一条线。
   写了 series_order 的那篇先按序号占位（从 1 起，号超出总数则封顶到末位）；
   同一个号被多篇占用时日期较早的占位，其余的退回按日期排；
   剩下的文章按日期填入空位。先复制再排，绝不扰动全局顺序 */
function orderSeries(list) {
  const n = list.length;
  const byDate = [...list].sort((a, b) => {
    if (!a.dateISO || !b.dateISO) return a.dateISO ? -1 : b.dateISO ? 1 : a.slug.localeCompare(b.slug);
    return a.dateISO === b.dateISO
      ? a.slug.localeCompare(b.slug)
      : a.dateISO < b.dateISO ? -1 : 1;
  });
  const slots = new Array(n).fill(null);
  for (const p of byDate.filter((p) => p.seriesOrder > 0)) {
    const i = Math.min(p.seriesOrder, n) - 1;
    if (!slots[i]) slots[i] = p; // 号撞了：先到（日期较早）者占位
  }
  const rest = byDate.filter((p) => !slots.includes(p));
  for (let i = 0, j = 0; i < n; i++) if (!slots[i]) slots[i] = rest[j++];
  return slots;
}

/* 汇总所有合集，按篇数降序、名称升序（与标签同一套规矩），内部已排好序 */
function collectSeries(posts) {
  const map = new Map();
  for (const p of posts) {
    if (!p.series) continue;
    if (!map.has(p.series)) map.set(p.series, []);
    map.get(p.series).push(p);
  }
  const list = [...map.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([name, arr]) => [name, orderSeries(arr)]);

  // 两个不同的合集名可能 slugify 成同一条路径（如「Neovim 入门」与「neovim-入门」），
  // 撞了就会互相覆盖页面——构建期直接报错，别静默丢一部合集
  const seen = new Map();
  for (const [name] of list) {
    const s = slugify(name);
    if (seen.has(s)) {
      throw new Error(
        `[build] 合集 slug 冲突：\n` +
          `  1) ${seen.get(s)}\n` +
          `  2) ${name}\n` +
          `  两者都生成 series/${s}.html，请改掉其中一个合集名。`
      );
    }
    seen.set(s, name);
  }
  return list;
}

/* sitemap.xml */
function buildSitemap(posts, totalPages, tagList, seriesList) {
  const paginationUrls = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    loc: absUrl(`page/${i + 2}.html`),
    lastmod: '',
  }));
  const tagUrls = tagList.map(([tag]) => ({ loc: absUrl(`tag/${slugify(tag)}.html`), lastmod: '' }));
  const seriesUrls = seriesList.map(([name]) => ({ loc: absUrl(`series/${slugify(name)}.html`), lastmod: '' }));
  const urls = [
    { loc: absUrl(''), lastmod: posts[0] ? posts[0].dateISO : '' },
    { loc: absUrl('about.html'), lastmod: '' },
    { loc: absUrl('tags.html'), lastmod: '' },
    { loc: absUrl('series.html'), lastmod: '' },
    ...paginationUrls,
    ...tagUrls,
    ...seriesUrls,
    ...posts.map((p) => ({ loc: absUrl(`post/${p.slug}.html`), lastmod: p.dateISO })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
}

/* robots.txt */
function buildRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${absUrl('sitemap.xml')}
`;
}

/* Atom feed */
function buildFeed(posts) {
  const updated = posts[0] ? posts[0].dateISO : new Date().toISOString().slice(0, 10);
  const items = posts.map((p) => `  <entry>
    <title>${esc(p.title)}</title>
    <link href="${absUrl(`post/${p.slug}.html`)}"/>
    <id>${absUrl(`post/${p.slug}.html`)}</id>
    <published>${p.dateISO}</published>
    <updated>${p.dateISO}</updated>
    <summary>${esc(p.summary || '')}</summary>
    <author><name>${esc(SITE.author)}</name></author>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(SITE.name)}</title>
  <subtitle>${esc(SITE.tagline)}</subtitle>
  <link href="${absUrl('')}"/>
  <id>${absUrl('')}</id>
  <updated>${updated}</updated>
  <author><name>${esc(SITE.author)}</name></author>
${items}
</feed>
`;
}

function build() {
  // 清理并重建
  fs.rmSync(PATHS.out, { recursive: true, force: true });
  fs.mkdirSync(path.join(PATHS.out, 'post'), { recursive: true });
  fs.mkdirSync(path.join(PATHS.out, 'page'), { recursive: true });
  fs.mkdirSync(path.join(PATHS.out, 'tag'), { recursive: true });
  fs.mkdirSync(path.join(PATHS.out, 'series'), { recursive: true });

  // 拷贝静态资源
  copyDir(PATHS.assets, path.join(PATHS.out, 'assets'));

  // 文章
  const posts = loadPosts();

  // 记录全局序号（供文章卡片与标签页统一显示 №）
  posts.forEach((p, i) => { p.index = i; });

  // 标签汇总
  const tagList = collectTags(posts);

  // 合集汇总；简介从 content/series.md 读（可选、独立），顺带记下每篇的位次与
  // 左右邻，供文章页角标「03 / 06」和底部的合集上/下篇取用。
  // 邻篇按合集顺序（不是日期序），且只记 slug 与标题
  const seriesDescs = loadSeriesDesc();
  const seriesList = collectSeries(posts).map(([name, list]) => [
    name,
    list,
    seriesDescs[name] || "",
  ]);
  const usedSeries = new Set(seriesList.map(([name]) => name));
  const orphanDescs = Object.keys(seriesDescs).filter((n) => !usedSeries.has(n));
  if (orphanDescs.length) {
    console.warn(
      `[build] 警告：series.md 里的「${orphanDescs.join('」「')}」没有文章在用，已忽略（名字要与 frontmatter 的 series 完全一致）`,
    );
  }
  for (const [name, list] of seriesList) {
    list.forEach((p, i) => {
      const prev = list[i - 1] || null;
      const next = list[i + 1] || null;
      p.seriesInfo = {
        name,
        slug: slugify(name),
        order: i + 1,
        total: list.length,
        prev: prev ? { slug: prev.slug, title: prev.title } : null,
        next: next ? { slug: next.slug, title: next.title } : null,
      };
    });
  }

  // 生成文章元数据（供链接悬停预览使用）
  const postsMeta = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary || '',
    dateText: p.dateText,
    minutes: p.minutes,
    tags: Array.isArray(p.tags) ? p.tags : [],
  }));
  fs.writeFileSync(
    path.join(PATHS.out, 'assets', 'js', 'posts-data.js'),
    'window.__POSTS__ = ' + JSON.stringify(postsMeta) + ';\n'
  );

  // 文章页
  posts.forEach((p, i) => {
    fs.writeFileSync(
      path.join(PATHS.out, 'post', `${p.slug}.html`),
      renderPost(p, i, posts)
    );
  });

  // 首页 + 分页
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  for (let page = 1; page <= totalPages; page++) {
    const file = page === 1 ? 'index.html' : path.join('page', `${page}.html`);
    fs.writeFileSync(path.join(PATHS.out, file), renderIndexPage(posts, page, totalPages));
  }

  // 标签索引 + 各标签页
  fs.writeFileSync(path.join(PATHS.out, 'tags.html'), renderTagsIndex(tagList, posts.length));
  for (const [tag, tagged] of tagList) {
    fs.writeFileSync(path.join(PATHS.out, 'tag', `${slugify(tag)}.html`), renderTagPage(tag, tagged));
  }

  // 合集索引 + 各部合集页
  fs.writeFileSync(path.join(PATHS.out, 'series.html'), renderSeriesIndex(seriesList, posts.length));
  for (const [name, list] of seriesList) {
    fs.writeFileSync(path.join(PATHS.out, 'series', `${slugify(name)}.html`), renderSeriesPage(name, list));
  }

  // 关于 / 404
  const pages = loadPages();
  fs.writeFileSync(path.join(PATHS.out, 'about.html'), renderPage(pages.about, 'about'));
  fs.writeFileSync(path.join(PATHS.out, '404.html'), renderPage(pages['404'], '404'));

  // SEO 产物
  fs.writeFileSync(path.join(PATHS.out, 'sitemap.xml'), buildSitemap(posts, totalPages, tagList, seriesList));
  fs.writeFileSync(path.join(PATHS.out, 'robots.txt'), buildRobots());
  fs.writeFileSync(path.join(PATHS.out, 'feed.xml'), buildFeed(posts));

  // 统计
  console.log(`✓ ${posts.length} 篇文章已构建（共 ${totalPages} 页，${tagList.length} 个标签，${seriesList.length} 个合集）`);
  console.log(`✓ 页面：index.html · page/*.html · tags.html · tag/*.html · about.html · 404.html · post/*.html`);
  console.log(`✓ 合集：series.html · series/*.html`);
  console.log(`✓ SEO：sitemap.xml · robots.txt · feed.xml`);
  console.log(`✓ 输出目录：${PATHS.out}`);
  console.log(`✓ 零依赖，构建完成。`);
}

module.exports = { build };
