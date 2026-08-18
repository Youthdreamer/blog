"use strict";

/* 站点级配置与路径常量 */
const path = require("path");

const ROOT = path.join(__dirname, "..");

const SITE = {
  name: "youth",
  author: "半山屏风",
  tagline: "于静默处，听见回响。",
  desc: "一间写给时间、也写给你我的小屋。",
  // 站点根地址（无末尾斜杠）。部署后务必核对：项目站是 用户名.github.io/仓库名，
  // 用户站是 用户名.github.io；自定义域名则填自定义域名。
  url: "https://Youthdreamer.github.io/blog",
  locale: "zh_CN",
  image: "assets/og-image.png", // 社交分享图（相对站点根）
  founded: 2026, // 建站年份（"est." 显示，固定值，不随年份变化）
};

/* 生成绝对 URL：absUrl('') → 首页；absUrl('post/x.html') → 文章 */
function absUrl(p = "") {
  return SITE.url.replace(/\/$/, "") + "/" + String(p).replace(/^\//, "");
}

const PATHS = {
  content: path.join(ROOT, "content"),
  posts: path.join(ROOT, "content", "posts"),
  pages: path.join(ROOT, "content", "pages"),
  assets: path.join(ROOT, "assets"),
  out: path.join(ROOT, "site"),
};

/* 首页每页文章数（分页） */
const PAGE_SIZE = 10;

/* 资源版本（构建时间戳，用于 CSS/JS 缓存失效） */
const VERSION = Date.now().toString(36);

/* 当前年份（构建时自动获取，用于 est. / 页脚 © 等显示，无需每年手动改） */
const YEAR = new Date().getFullYear();

module.exports = { ROOT, SITE, PATHS, absUrl, PAGE_SIZE, VERSION, YEAR };
