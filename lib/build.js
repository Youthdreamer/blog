'use strict';

/* 构建流程：清理、拷贝资源、生成元数据、渲染页面、标签页、SEO 产物 */

const fs = require('fs');
const path = require('path');
const { PATHS, SITE, absUrl, PAGE_SIZE } = require('./config');
const { esc, slugify } = require('./utils');
const { loadPosts, loadPages } = require('./content');
const { renderPost, renderIndexPage, renderPage, renderTagsIndex, renderTagPage } = require('./views');

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

/* sitemap.xml */
function buildSitemap(posts, totalPages, tagList) {
  const paginationUrls = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    loc: absUrl(`page/${i + 2}.html`),
    lastmod: '',
  }));
  const tagUrls = tagList.map(([tag]) => ({ loc: absUrl(`tag/${slugify(tag)}.html`), lastmod: '' }));
  const urls = [
    { loc: absUrl(''), lastmod: posts[0] ? posts[0].dateISO : '' },
    { loc: absUrl('about.html'), lastmod: '' },
    { loc: absUrl('tags.html'), lastmod: '' },
    ...paginationUrls,
    ...tagUrls,
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

  // 拷贝静态资源
  copyDir(PATHS.assets, path.join(PATHS.out, 'assets'));

  // 文章
  const posts = loadPosts();

  // 记录全局序号（供文章卡片与标签页统一显示 №）
  posts.forEach((p, i) => { p.index = i; });

  // 标签汇总
  const tagList = collectTags(posts);

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

  // 关于 / 404
  const pages = loadPages();
  fs.writeFileSync(path.join(PATHS.out, 'about.html'), renderPage(pages.about, 'about'));
  fs.writeFileSync(path.join(PATHS.out, '404.html'), renderPage(pages['404'], '404'));

  // SEO 产物
  fs.writeFileSync(path.join(PATHS.out, 'sitemap.xml'), buildSitemap(posts, totalPages, tagList));
  fs.writeFileSync(path.join(PATHS.out, 'robots.txt'), buildRobots());
  fs.writeFileSync(path.join(PATHS.out, 'feed.xml'), buildFeed(posts));

  // 统计
  console.log(`✓ ${posts.length} 篇文章已构建（共 ${totalPages} 页，${tagList.length} 个标签）`);
  console.log(`✓ 页面：index.html · page/*.html · tags.html · tag/*.html · about.html · 404.html · post/*.html`);
  console.log(`✓ SEO：sitemap.xml · robots.txt · feed.xml`);
  console.log(`✓ 输出目录：${PATHS.out}`);
  console.log(`✓ 零依赖，构建完成。`);
}

module.exports = { build };
