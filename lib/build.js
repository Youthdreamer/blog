"use strict";

/* 构建流程：清理、拷贝资源、生成元数据、渲染页面 */

const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");
const { loadPosts, loadPages } = require("./content");
const { renderPost, renderIndex, renderPage } = require("./templates");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const s = path.join(from, name);
    const d = path.join(to, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function build() {
  // 清理并重建
  fs.rmSync(PATHS.out, { recursive: true, force: true });
  fs.mkdirSync(path.join(PATHS.out, "post"), { recursive: true });

  // 拷贝静态资源
  copyDir(PATHS.assets, path.join(PATHS.out, "assets"));

  // 文章
  const posts = loadPosts();

  // 生成文章元数据（供链接悬停预览使用）
  const postsMeta = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    summary: p.summary || "",
    dateText: p.dateText,
    minutes: p.minutes,
    tags: Array.isArray(p.tags) ? p.tags : [],
  }));
  fs.writeFileSync(
    path.join(PATHS.out, "assets", "js", "posts-data.js"),
    "window.__POSTS__ = " + JSON.stringify(postsMeta) + ";\n",
  );

  // 文章页
  posts.forEach((p, i) => {
    fs.writeFileSync(
      path.join(PATHS.out, "post", `${p.slug}.html`),
      renderPost(p, i, posts.length),
    );
  });

  // 首页
  fs.writeFileSync(path.join(PATHS.out, "index.html"), renderIndex(posts));

  // 关于 / 404
  const pages = loadPages();
  fs.writeFileSync(
    path.join(PATHS.out, "about.html"),
    renderPage(pages.about, "about"),
  );
  fs.writeFileSync(
    path.join(PATHS.out, "404.html"),
    renderPage(pages["404"], "404"),
  );

  // 统计
  console.log(`✓ ${posts.length} 篇文章已构建`);
  console.log(`✓ 页面：index.html · about.html · 404.html · post/*.html`);
  console.log(`✓ 输出目录：${PATHS.out}`);
  console.log(`✓ 零依赖，构建完成。`);
}

module.exports = { build };
