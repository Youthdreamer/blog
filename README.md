# youth — 一间写字的屋子

零依赖、手工定制的个人博客。深色底 · 香槟金 · 宋体排版，没有框架，没有模板——构建脚本、样式、交互全部手写。

## 特性

- **零 npm 依赖**：构建与预览只用 Node 内置模块，不 `npm install`、不会坏
- **手写 Markdown 解析器**：标题、粗体/斜体/删除线、行内代码、内/外链接、图片（含图注）、引用、有序/无序列表、表格（GFM 管道语法，支持对齐）、分隔线、围栏代码块
- **服务端构建**：Markdown → 纯静态 HTML（`node build.js`）
- **代码高亮 + 复制按钮**：highlight.js 本地自托管 + 手写复制交互
- **图片**：响应式 + 香槟金细边 + 懒加载 + 点击放大（零依赖 lightbox）
- **首页特效**：鼠标光晕、点击墨滴涟漪、逐字浮现标题（点击可重播）、漂浮墨尘
- **链接悬停预览**：站内文章富预览 + 外站 favicon/域名预览
- **阅读体验**：长文自动生成目录（TOC）、阅读进度条、上一篇/下一篇、相关文章推荐（按共同标签）、"全文完"落款
- **分页**：文章过多时自动分页（`index.html` + `page/N.html`，每页篇数可配置）
- **文章置顶**：frontmatter `pin: true` 置顶，卡片与归档显示 ◇ 标记
- **标签页**：加权词云（字号随文章数平滑缩放、错峰浮动、悬停金线）与各标签归档页（`tag/*.html`）
- **回到顶部**：菱形按钮，滚动超过一屏浮现，平滑回顶（尊重减弱动效）
- **自定义 404**：迷路页自包含渲染（内联 CSS/JS + 链接自愈），任意深度 URL 都正常显示
- **年份自动获取**：页脚 © 与 est. 构建时自动取当年，建站年单独配置
- **彩蛋**：键盘敲出 `youth`、连点三次页脚印章
- **SEO**：canonical、完整 Open Graph、Twitter Card、JSON-LD 结构化数据、`sitemap.xml`、`robots.txt`、RSS feed、社交分享图
- **响应式与无障碍**：窄屏适配、`prefers-reduced-motion`、焦点环、语义化标签
- **GitHub Pages 自动部署**：每次 push 自动构建发布

## 快速开始

```bash
node build.js   # 构建站点（输出到 site/）
node serve.js   # 本地预览（默认 8000，可用 PORT=9000 换端口）
node dev.js     # 开发模式：编辑 content/ 或 assets/ 保存后自动重建 + 浏览器刷新（推荐写作时用）
```

打开 http://127.0.0.1:8000 即可。

## 目录结构

```
.
├── build.js                  # 构建入口（薄，委托给 lib/）
├── serve.js                  # 本地预览服务器（零依赖，支持自定义 404）
├── lib/                      # 构建逻辑（模块化）
│   ├── config.js             #   站点配置 + 路径常量
│   ├── utils.js              #   工具函数（转义/日期/阅读时长…）
│   ├── markdown.js           #   手写 Markdown 解析器
│   ├── content.js            #   读取 content/ 下的文章与页面
│   ├── shell.js              #   页面骨架（head/nav/footer + 404 自包含辅助）
│   ├── views.js              #   内容视图（文章/首页/标签/关于/404 渲染）
│   └── build.js              #   构建流程（清理/拷贝/元数据/渲染/SEO 产物）
├── assets/
│   ├── css/                  # 样式（按职责拆分，构建时合并加载）
│   │   ├── base.css          #   设计变量 / 重置 / 排版基础
│   │   ├── layout.css        #   导航 / Hero / 页脚 / 关于 / 404
│   │   ├── components.css    #   列表 / 文章 / 代码 / 图片 / 提示
│   │   └── effects.css       #   特效 / 动画 / 链接预览 / 响应式
│   ├── js/
│   │   ├── core.js           #   进度条 / 入场动画 / 回到顶部 / 提示 / 彩蛋
│   │   ├── effects.js        #   首页特效
│   │   ├── enhance.js        #   图片放大 / 代码高亮复制
│   │   └── preview.js        #   链接悬停预览
│   ├── vendor/               # 第三方库（highlight.js）
│   ├── og-image.png          # 社交分享图（og:image）
│   └── favicon.svg
├── content/
│   ├── posts/                # 文章（每篇一个 .md）
│   └── pages/                # about.md / 404.md
├── .github/workflows/deploy.yml
├── .gitignore
├── package.json
└── site/                     # 构建产物（已被 git 忽略）
```

## 写一篇文章

在 `content/posts/` 新建 `.md`，开头写 frontmatter：

```markdown
---
title: 文章标题
date: 2025-08-20
tags: [随笔, 代码]
slug: my-post            # 可选，默认取文件名（不含 .md 后缀）
summary: 一句话摘要，显示在文章列表里
draft: true              # 可选，true 则不发布
pin: true                # 可选，true 则置顶到文章列表最前
---

正文支持 Markdown：
**粗体**、*斜体*、~~删除线~~、`行内代码`、
[链接](https://example.com)、引用、列表、```代码块```、标题、分隔线。

表格（GFM 管道语法，支持对齐，表格前后留空行）：

```markdown
| 名称 | 数量 |
| :--- | ---: |
| 甲   | 2    |
```

对齐方式：`:---` 左对齐、`:---:` 居中、`---:` 右对齐。
```

然后 `node build.js` 重新构建。文章按日期倒序排列（`pin: true` 的置顶文章排最前），`draft: true` 自动隐藏；若两篇文章 slug 重复，构建会**报错并列出冲突的文件与标题**。

### 图片

图片语法（支持可选图注，点击可放大）：

```markdown
![图片说明](https://cdn.jsdelivr.net/gh/你的用户名/images@main/photo.jpg)
![图片说明](https://.../photo.jpg "这里是图注")
```

图注写法：链接后加一个空格和双引号包裹的文字。

> 建议图片放**独立图床仓库 + jsDelivr CDN**（免费、零维护、不撑大博客仓库），或使用 Cloudinary 等免费图床。注意：jsDelivr 只代理**公开** GitHub 仓库。

## 个性化

| 想改什么 | 去哪里改 |
| --- | --- |
| 站点名 / 标语 / 作者 | `lib/config.js` 的 `SITE` |
| 每页文章数 | `lib/config.js` 的 `PAGE_SIZE` |
| 建站年份（est.） | `lib/config.js` 的 `SITE.founded` |
| 配色 | `assets/css/base.css` 的 `:root` 变量 |
| 字体 | `lib/shell.js` 的 `FONTS` + `base.css` 的字体变量 |
| 导航 / 页脚文字 | `lib/shell.js` 的 `nav()` / `footer()` |
| 相关文章推荐篇数 | `lib/views.js` 的 `relatedPosts()`（`n` 参数） |
| 回到顶部按钮样式 | `assets/css/components.css` 的 `#to-top` |
| 彩蛋台词 | `assets/js/core.js` 的 `showToast(...)` |
| 关于页内容 | `content/pages/about.md` |

配色是"高级感"的关键：金色只用在链接、标记、印章这类**需要被看见**的地方，正文保持纸白色。

## 部署到 GitHub Pages

1. 推到 GitHub 仓库（`git push -u origin main`）
2. 仓库 `Settings → Pages → Build and deployment` 的 **Source 选 `GitHub Actions`**
3. 每次 push 会自动构建并发布（见 `.github/workflows/deploy.yml`）
4. 把 `lib/config.js` 里的 `SITE.url` 改成你的真实地址——**SEO 的 canonical / sitemap / og:url / RSS 都依赖它**，改错会影响收录和分享卡片
5. 每次构建会自动生成 `sitemap.xml`、`robots.txt`、`feed.xml`，并给每页写入 JSON-LD 结构化数据

> 站点用全相对路径，部署在 `用户名.github.io/仓库名/` 子路径下也能正常显示。当前 `SITE.url` 预填的是 `https://Youthdreamer.github.io/blog`，部署前请核对。

## 彩蛋

1. 键盘敲出 `youth` 五个字母
2. 连点三次页脚的金色印章

（找到的人，请保持安静。）
