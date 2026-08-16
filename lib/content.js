'use strict';

/* 读取 content/ 下的文章与页面 */

const fs = require('fs');
const path = require('path');
const { PATHS } = require('./config');
const { formatDate, readMinutes } = require('./utils');
const { mdToHtml, parseFrontmatter } = require('./markdown');

function loadPosts() {
  const posts = fs.readdirSync(PATHS.posts)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(PATHS.posts, f), 'utf8'));
      const fileBase = f.replace(/\.md$/, '');
      // 中文文件名且未写 slug → 仅提醒（不阻断），避免生成中文编码 URL
      if (!meta.slug && /[\u4e00-\u9fa5]/.test(fileBase)) {
        console.warn(
          `[build] 警告：《${meta.title || f}》文件名含中文且未写 slug，URL 将含中文编码；建议加 \`slug: my-post\``
        );
      }
      return {
        ...meta,
        file: f,
        // slug 默认取自文件名（文件系统本就保证唯一）；显式 slug 仅作为可读覆盖
        slug: String(meta.slug || fileBase).trim(),
        body,
        html: mdToHtml(body),
        minutes: readMinutes(body),
        dateISO: meta.date ? new Date(meta.date).toISOString().slice(0, 10) : '',
        dateText: meta.date ? formatDate(meta.date) : '',
      };
    })
    .filter((p) => !p.draft);

  // slug 唯一性校验（只校验会发布的文章）
  const seen = new Map();
  for (const p of posts) {
    if (seen.has(p.slug)) {
      const q = seen.get(p.slug);
      throw new Error(
        `[build] slug 冲突："${p.slug}"\n` +
        `  1) ${q.file} → 《${q.title}》\n` +
        `  2) ${p.file} → 《${p.title}》\n` +
        `  请修改其中一篇的 frontmatter slug，或重命名文件后重新构建。`
      );
    }
    seen.set(p.slug, p);
  }

  return posts.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
}

function loadPages() {
  const out = {};
  for (const [file, key] of [['about.md', 'about'], ['404.md', '404']]) {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(PATHS.pages, file), 'utf8'));
    out[key] = { ...meta, html: mdToHtml(body) };
  }
  return out;
}

module.exports = { loadPosts, loadPages };
