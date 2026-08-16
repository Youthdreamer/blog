'use strict';

/* 构建流程：清理、拷贝资源、生成元数据、渲染页面、SEO 产物 */

const fs = require('fs');
const path = require('path');
const { PATHS, SITE, absUrl } = require('./config');
const { esc } = require('./utils');
const { loadPosts, loadPages } = require('./content');
const { renderPost, renderIndex, renderPage } = require('./templates');

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/* sitemap.xml */
function buildSitemap(posts) {
  const urls = [
    { loc: absUrl(''), lastmod: posts[0] ? posts[0].dateISO : '' },
    { loc: absUrl('about.html'), lastmod: '' },
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

  // 拷贝静态资源
  copyDir(PATHS.assets, path.join(PATHS.out, 'assets'));

  // 文章
  const posts = loadPosts();

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
    fs.writeFileSync(path.join(PATHS.out, 'post', `${p.slug}.html`), renderPost(p, i, posts.length));
  });

  // 首页
  fs.writeFileSync(path.join(PATHS.out, 'index.html'), renderIndex(posts));

  // 关于 / 404
  const pages = loadPages();
  fs.writeFileSync(path.join(PATHS.out, 'about.html'), renderPage(pages.about, 'about'));
  fs.writeFileSync(path.join(PATHS.out, '404.html'), renderPage(pages['404'], '404'));

  // SEO 产物
  fs.writeFileSync(path.join(PATHS.out, 'sitemap.xml'), buildSitemap(posts));
  fs.writeFileSync(path.join(PATHS.out, 'robots.txt'), buildRobots());
  fs.writeFileSync(path.join(PATHS.out, 'feed.xml'), buildFeed(posts));

  // 统计
  console.log(`✓ ${posts.length} 篇文章已构建`);
  console.log(`✓ 页面：index.html · about.html · 404.html · post/*.html`);
  console.log(`✓ SEO：sitemap.xml · robots.txt · feed.xml`);
  console.log(`✓ 输出目录：${PATHS.out}`);
  console.log(`✓ 零依赖，构建完成。`);
}

module.exports = { build };
