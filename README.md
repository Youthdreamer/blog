# youth — 一间写字的屋子

零依赖、手工定制的个人博客。深色底 · 香槟金 · 宋体排版，没有框架，没有模板，每一条线都是手写的。

## 快速开始

```bash
node build.js          # 构建站点（输出到 site/）
node serve.js          # 本地预览（默认 8000 端口，可用 PORT=9000 换端口）
```

打开 http://localhost:8000 即可。

## 目录结构

```
.
├── build.js            # 构建脚本（零依赖，Node 内置模块即可）
├── serve.js            # 本地预览服务器（零依赖）
├── package.json        # npm run build / npm run serve 快捷方式
├── assets/             # 静态资源（构建时原样拷贝到 site/assets）
│   ├── css/style.css   # 全部样式——改这里就能整站换肤
│   ├── js/main.js      # 滚动进度、入场动画、彩蛋、首页特效
│   └── favicon.svg
├── content/            # 所有内容都是 Markdown
│   ├── posts/          # 文章（每篇一个 .md）
│   └── pages/          # 关于、404 页面
└── site/               # 构建产物（可整体部署，勿手改）
```

## 写一篇文章

在 `content/posts/` 里新建一个 `.md` 文件，开头写 frontmatter：

```markdown
---
title: 文章的标题
date: 2025-08-20
tags: [随笔, 代码]
slug: my-post            # 可选，默认由标题生成
summary: 一句话摘要，显示在文章列表里
draft: true              # 可选，true 则不会发布
---

正文从这里开始，支持 Markdown：
**粗体**、*斜体*、`行内代码`、[链接](https://example.com)、
引用、列表、```代码块```、标题、分隔线。
```

然后 `node build.js` 重新构建即可。文章会自动按日期倒序排列。

## 个性化指南

| 想改什么 | 去哪里改 |
| --- | --- |
| 站点名字 / 标语 | `build.js` 顶部的 `SITE` 配置 |
| 配色 | `style.css` 顶部的 `:root` 变量（底色、纸色、香槟金） |
| 字体 | `style.css` 的 `--serif` / `--mono`，以及 `build.js` 里的 `FONTS` 链接 |
| 导航 / 页脚文字 | `build.js` 里的 `nav()` / `footer()` 函数 |
| 彩蛋台词 | `main.js` 里的两处 `showToast(...)` |
| 关于页内容 | `content/pages/about.md` |

配色是"高级感"的关键：金色只用在链接、标记、印章这类**需要被看见**的地方，正文保持纸白色。

## 首页特效

- 点击任意处：一圈若隐若现的墨环化开
- 鼠标光晕：柔和金斑跟随光标（触摸设备自动隐藏）
- 大标题逐字浮现，点击可重新播放
- Hero 背景漂浮微光粒子
- 彩蛋：键盘敲出 `youth`、连点三次页脚印章

全部尊重系统 `prefers-reduced-motion` 设置。

## 部署

`site/` 是纯静态文件，可以部署到任意静态托管：

- **GitHub Pages**：把 `site/` 内容推送到仓库根目录即可
- **Netlify / Vercel**：构建命令 `node build.js`，输出目录 `site`
- **任意服务器**：把 `site/` 丢给 Nginx / Caddy 即可

部署后记得把 `build.js` 里 `SITE.url` 改成你的域名。
