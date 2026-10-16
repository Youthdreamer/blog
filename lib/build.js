'use strict';

/* 构建流程：清理、拷贝资源、生成元数据、渲染页面、标签页、SEO 产物 */

const fs = require('fs');
const path = require('path');
const { PATHS, absUrl, PAGE_SIZE } = require('./config');
const { slugify } = require('./utils');
const { fmtScore } = require('./markdown');
const { loadPosts, loadPages, loadSeriesMeta } = require('./content');
const {
  renderPost, renderIndexPage, renderPage,
  renderTagsIndex, renderTagPage, renderSeriesIndex, renderSeriesPage,
  renderScores,
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

/* 汇总所有合集：series.md 里 pin 了的排在最前（几部之间按书写顺序），
   其余按篇数降序、名称升序（与标签同一套规矩），内部已排好序 */
function collectSeries(posts, pinned = []) {
  const map = new Map();
  for (const p of posts) {
    if (!p.series) continue;
    if (!map.has(p.series)) map.set(p.series, []);
    map.get(p.series).push(p);
  }
  const rank = new Map(pinned.map((name, i) => [name, i]));
  const list = [...map.entries()]
    .sort((a, b) => {
      // 没置顶的一律排到置顶的后面（rank 取不到就是 Infinity），置顶之间比书写顺序
      const ra = rank.has(a[0]) ? rank.get(a[0]) : Infinity;
      const rb = rank.has(b[0]) ? rank.get(b[0]) : Infinity;
      if (ra !== rb) return ra - rb;
      return b[1].length - a[1].length || a[0].localeCompare(b[0]);
    })
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

/* 评分墙分组：只收正文里有评分卡的（score 非空；score_badge: false 只收列表徽标，
   这里照收）。组序沿用合集页那套（置顶在前、其余按篇数——seriesList 已经排好），
   组内按总分降序、同分日期新的在前；没归合集的评分凑成末尾一组「散篇」（name 空串）。
   满分不一样的一律折成十分制再排、再平均——4.5/5 与 9.1/10 才有可比性。
   纯函数：测试直接喂数据（见 scripts/test-posts.js） */
function collectScoreGroups(posts, seriesList) {
  const norm10 = (s) => (Number(s.value) / Number(s.max)) * 10;
  const byScore = (a, b) =>
    norm10(b.score) - norm10(a.score) ||
    (a.dateISO === b.dateISO
      ? a.slug.localeCompare(b.slug)
      : a.dateISO < b.dateISO ? 1 : -1);
  const asGroup = (name, list) => {
    const sorted = [...list].sort(byScore);
    const mean = sorted.reduce((n, p) => n + norm10(p.score), 0) / sorted.length;
    return { name, posts: sorted, avgText: fmtScore(mean) };
  };
  const groups = [];
  for (const [name, list] of seriesList) {
    const rows = list.filter((p) => p.score);
    if (rows.length) groups.push(asGroup(name, rows));
  }
  const loose = posts.filter((p) => p.score && !p.series);
  if (loose.length) groups.push(asGroup("", loose));
  const count = groups.reduce((n, g) => n + g.posts.length, 0);
  const avgText = count
    ? fmtScore(
        groups.reduce(
          (n, g) => n + g.posts.reduce((m, p) => m + norm10(p.score), 0),
          0,
        ) / count,
      )
    : "";
  return { groups, count, avgText };
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
    { loc: absUrl('scores.html'), lastmod: '' },
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

/* opts.previewDrafts：只由 dev.js 传（生产构建 node build.js 不带）。草稿也会
   出一张单页（带草稿横幅、noindex），但一切列表口径不变——分页/标签/合集/
   评分墙/sitemap/±上下篇/相关文章只吃 published；缺省路径连草稿对象都不加载，
   输出与从前逐字节一致 */
function build(opts = {}) {
  // 清理并重建
  fs.rmSync(PATHS.out, { recursive: true, force: true });
  fs.mkdirSync(path.join(PATHS.out, 'post'), { recursive: true });
  fs.mkdirSync(path.join(PATHS.out, 'page'), { recursive: true });
  fs.mkdirSync(path.join(PATHS.out, 'tag'), { recursive: true });
  fs.mkdirSync(path.join(PATHS.out, 'series'), { recursive: true });

  // 拷贝静态资源
  copyDir(PATHS.assets, path.join(PATHS.out, 'assets'));

  // 文章。草稿在这里就分流：published（变量名沿用 posts）是本行所有下游的唯一
  // 输入——含 __POSTS__ 悬停预览数据；drafts 只喂末尾那个单页循环
  const all = loadPosts(PATHS.posts, { includeDrafts: !!opts.previewDrafts });
  const posts = all.filter((p) => !p.draft);
  const drafts = all.filter((p) => p.draft);

  // 记录全局序号（供文章卡片与标签页统一显示 №）
  posts.forEach((p, i) => { p.index = i; });

  // 封面：md 旁边留的图，拷成 img/<slug>.<ext>（源路径已在 loadPosts 里解析好，
  // 缺文件的提醒也在那边发过了）。扁平输出，重名由 slug 兜住
  const covers = posts.filter((p) => p.coverSrc);
  if (covers.length) {
    fs.mkdirSync(path.join(PATHS.out, 'img'), { recursive: true });
    for (const p of covers) {
      fs.copyFileSync(p.coverSrc, path.join(PATHS.out, p.cover));
    }
  }

  // 标签汇总
  const tagList = collectTags(posts);

  // 合集汇总；简介与置顶从 content/series.md 读（可选、独立），顺带记下每篇的
  // 位次与左右邻，供文章页角标「03 / 06」和底部的合集上/下篇取用。
  // 邻篇按合集顺序（不是日期序），且只记 slug 与标题
  const { descs: seriesDescs, pins: pinnedSeries } = loadSeriesMeta();
  const seriesList = collectSeries(posts, pinnedSeries).map(([name, list]) => [
    name,
    list,
    seriesDescs[name] || "",
    pinnedSeries.includes(name), // 第 4 位：卡片上要不要盖「置顶」
  ]);
  const usedSeries = new Set(seriesList.map(([name]) => name));
  const orphanDescs = Object.keys(seriesDescs).filter((n) => !usedSeries.has(n));
  if (orphanDescs.length) {
    console.warn(
      `[build] 警告：series.md 里的「${orphanDescs.join('」「')}」没有文章在用，已忽略（名字要与文件夹名或 frontmatter 的 series 完全一致）`,
    );
  }
  const orphanPins = pinnedSeries.filter((n) => !usedSeries.has(n));
  if (orphanPins.length) {
    console.warn(
      `[build] 警告：series.md 里置顶的「${orphanPins.join('」「')}」没有对应的合集，已忽略（名字要与文件夹名或 frontmatter 的 series 完全一致）`,
    );
  }
  // 评分墙分组（/scores.html 用；顺序跟着 seriesList 走，见 collectScoreGroups）
  const scoreData = collectScoreGroups(posts, seriesList);
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

  // 关于 / 404 两个页面。提前在这里加载：下面生成预览数据要用「关于」的标题
  const pages = loadPages();

  // 生成文章元数据（供链接悬停预览使用）。
  // 「关于」也登记进来：正文里链到 /about.html 时同样出卡片，kind 标出身份
  // （卡片头部显示「页面」，而不是日期 · 阅读时长）；slug 撞上文章时以文章为准
  // （正文里的链接多半指向文章）。404 是错误页，不登记
  const postsMeta = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary || '',
    dateText: p.dateText,
    minutes: p.minutes,
    tags: Array.isArray(p.tags) ? p.tags : [],
  }));
  if (!postsMeta.some((m) => m.slug === 'about')) {
    postsMeta.push({
      kind: 'page',
      slug: 'about',
      title: pages.about.title,
      summary: pages.about.summary || '',
      tags: [],
    });
  }
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

  // 草稿单页（仅预览构建）：URL 与正式文章同构；index 传 -1 表示「不在任何排序
  // 里」，视图据此摘掉上/下篇与相关文章（见 lib/views.js 的 isDraft 分支）
  for (const d of drafts) {
    fs.writeFileSync(
      path.join(PATHS.out, 'post', `${d.slug}.html`),
      renderPost(d, -1, posts)
    );
  }

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

  // 评分墙
  fs.writeFileSync(path.join(PATHS.out, 'scores.html'), renderScores(scoreData));

  // 关于 / 404（pages 已在生成预览数据前加载）
  fs.writeFileSync(path.join(PATHS.out, 'about.html'), renderPage(pages.about, 'about'));
  fs.writeFileSync(path.join(PATHS.out, '404.html'), renderPage(pages['404'], '404'));

  // SEO 产物
  fs.writeFileSync(path.join(PATHS.out, 'sitemap.xml'), buildSitemap(posts, totalPages, tagList, seriesList));
  fs.writeFileSync(path.join(PATHS.out, 'robots.txt'), buildRobots());

  // 统计
  console.log(`✓ ${posts.length} 篇文章已构建（共 ${totalPages} 页，${tagList.length} 个标签，${seriesList.length} 个合集）`);
  if (drafts.length) {
    // 草稿多了只报前三条：看全的走 dev 页面左下角的挂件（见 dev.js）
    const head = drafts.slice(0, 3).map((d) => `post/${d.slug}.html`).join(' · ');
    console.log(
      `✓ 草稿（仅本地预览，不进任何列表）：${drafts.length} 篇 · ${head}${drafts.length > 3 ? ' 等' : ''}`,
    );
  }
  console.log(`✓ 页面：index.html · page/*.html · tags.html · tag/*.html · about.html · 404.html · post/*.html`);
  console.log(`✓ 合集：series.html · series/*.html · 评分墙：scores.html`);
  if (covers.length) console.log(`✓ 封面：${covers.length} 张 → img/`);
  console.log(`✓ SEO：sitemap.xml · robots.txt`);
  console.log(`✓ 输出目录：${PATHS.out}`);
  console.log(`✓ 零依赖，构建完成。`);

  // 回给调用方（只有 dev.js 需要）：草稿的 slug 与标题，用来拼本机可点开的地址、
  // 渲染服务时注入的草稿挂件；生产构建恒为空数组
  return { drafts: drafts.map((d) => ({ slug: d.slug, title: d.title })) };
}

module.exports = { build, collectScoreGroups };
