'use strict';

/* 读取 content/ 下的文章与页面 */

const fs = require('fs');
const path = require('path');
const { PATHS } = require('./config');
const { slugify, formatDate, readMinutes } = require('./utils');
const { mdToHtml, parseFrontmatter } = require('./markdown');

function loadPosts() {
  return fs.readdirSync(PATHS.posts)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(PATHS.posts, f), 'utf8'));
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

function loadPages() {
  const out = {};
  for (const [file, key] of [['about.md', 'about'], ['404.md', '404']]) {
    const { meta, body } = parseFrontmatter(fs.readFileSync(path.join(PATHS.pages, file), 'utf8'));
    out[key] = { ...meta, html: mdToHtml(body) };
  }
  return out;
}

module.exports = { loadPosts, loadPages };
