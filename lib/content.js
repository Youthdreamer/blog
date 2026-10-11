"use strict";

/* 读取 content/ 下的文章与页面 */

const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");
const { formatDate, readMinutes } = require("./utils");
const { mdToHtml, parseFrontmatter, fmtScore } = require("./markdown");

function loadPosts() {
  const posts = fs
    .readdirSync(PATHS.posts)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { meta, body } = parseFrontmatter(
        fs.readFileSync(path.join(PATHS.posts, f), "utf8"),
      );
      const fileBase = f.replace(/\.md$/, "");
      // 中文文件名且未写 slug → 仅提醒（不阻断），避免生成中文编码 URL
      if (!meta.slug && /[\u4e00-\u9fa5]/.test(fileBase)) {
        console.warn(
          `[build] 警告：《${meta.title || f}》文件名含中文且未写 slug，URL 将含中文编码；建议加 \`slug: my-post\``,
        );
      }
      // 传标题进去：评分卡的构建期提醒要能指名道姓是哪一篇
      const { html, headings, score } = mdToHtml(body, { title: meta.title || fileBase });
      // 评分徽标（列表卡片上那枚「◇ 9.5/10」）：正文里有评分卡才挂。
      // 不想挂就在 frontmatter 写 score_badge: false——只收徽标，正文里的评分卡照旧。
      // 两个数先格式化好（8.50 → 8.5），视图层拿到的就是能直接写进页面的文本
      const badge =
        score && meta.score_badge !== false
          ? { value: fmtScore(score.value), max: fmtScore(score.max) }
          : null;
      return {
        ...meta,
        file: f,
        // slug 默认取自文件名（文件系统本就保证唯一）；显式 slug 仅作为可读覆盖
        slug: String(meta.slug || fileBase).trim(),
        body,
        html,
        headings,
        score: badge,
        // 阅读时长：frontmatter 可手动指定（minutes: 5），否则按字数自动估算
        minutes: meta.minutes ? Number(meta.minutes) : readMinutes(body),
        // 合集（可选）：series 是合集名；series_order 写的是第几篇，
        // 归一化成数字（0 = 没指定，按日期排）。解析器给出的是字符串，别直接拿去比较
        series: typeof meta.series === "string" ? meta.series.trim() : "",
        seriesOrder:
          Number.isInteger(Number(meta.series_order)) && Number(meta.series_order) > 0
            ? Number(meta.series_order)
            : 0,
        dateISO: meta.date
          ? new Date(meta.date).toISOString().slice(0, 10)
          : "",
        dateText: meta.date ? formatDate(meta.date) : "",
        // 更新日期（可选）：显示"更新于"，并作为 JSON-LD 的 dateModified
        updatedISO: meta.updated
          ? new Date(meta.updated).toISOString().slice(0, 10)
          : "",
        updatedText: meta.updated ? formatDate(meta.updated) : "",
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
          `  请修改其中一篇的 frontmatter slug，或重命名文件后重新构建。`,
      );
    }
    seen.set(p.slug, p);
  }

  // 置顶优先，同层按日期倒序
  return posts.sort((a, b) => {
    if (!!a.pin !== !!b.pin) return a.pin ? -1 : 1;
    return a.dateISO < b.dateISO ? 1 : -1;
  });
}

/* 合集简介与置顶（可选）：content/series.md，一行一部合集，「合集名: 简介」。
   名字与文章 frontmatter 的 series 原样对应（对不上的由构建期提醒）；
   空行与 # 开头的行忽略；只在第一个冒号处切分，简介里再出现冒号也不受影响。

   置顶另起一行写「pin: 合集名」（写多行就置顶多部，按书写顺序排在最前）。
   和文章 frontmatter 的 pin 同一个词、同一个意思；没有简介的合集也能置顶，
   简介与置顶因此共用这一个文件，但彼此独立 */
function loadSeriesMeta() {
  const descs = {};
  const pins = [];
  if (!fs.existsSync(PATHS.series)) return { descs, pins };
  for (const line of fs.readFileSync(PATHS.series, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (key === "pin" || key === "置顶") { // 指令行，不是合集名
      if (!pins.includes(val)) pins.push(val);
      continue;
    }
    descs[key] = val;
  }
  return { descs, pins };
}

function loadPages() {
  const out = {};
  for (const [file, key] of [
    ["about.md", "about"],
    ["404.md", "404"],
  ]) {
    const { meta, body } = parseFrontmatter(
      fs.readFileSync(path.join(PATHS.pages, file), "utf8"),
    );
    const { html } = mdToHtml(body, { title: meta.title || file });
    out[key] = { ...meta, html };
  }
  return out;
}

module.exports = { loadPosts, loadPages, loadSeriesMeta };
