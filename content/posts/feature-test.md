---
title: 功能测试
date: 2026-08-17
updated: 2026-08-20
tags: [测试]
slug: feature-test
summary: 用于验证分享图、更新日期、目录隐藏
minutes: 6
toc: false
---

这是一篇功能测试文章，验证分享图、更新日期与目录隐藏。

## 第一节 分享图

站点不再支持 per-article 分享图字段，所有页面统一使用默认分享图（`assets/og-image.png`）作为 `og:image`。在页面源码里搜 `og:image` 即可看到。

## 第二节 更新日期

`updated: 2026-08-20` 会在文章页头部显示"更新于 2026年8月20日"，并写入 JSON-LD 的 `dateModified`。

## 第三节 目录隐藏

本文有 5 个 `##` 小节，按规则会自动生成目录（≥5 个标题）。但 frontmatter 写了 `toc: false`，所以目录不应出现。

## 第四节 普通段落

用来凑足标题数量，让"有 5 个标题却不显示目录"的对比成立。

## 第五节 收尾

如果页面顶部没有目录框，说明隐藏生效。
