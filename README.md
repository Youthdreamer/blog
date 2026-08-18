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
node stop.js    # 停止开发服务器（按 .dev.pid 定位，精确关闭）
node new.js     # 新文章向导：交互填写标题/日期/标签，生成文件并打开预览（写作入口）
```

打开 http://127.0.0.1:8000 即可。

## 目录结构

```
.
├── build.js                  # 构建入口（薄，委托给 lib/）
├── new.js                    # 新文章向导（交互生成文章 + 打开预览）
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

**推荐入口：`npm run new`**（或 `node new.js`）——create-next-app 式一问一答向导，把 frontmatter 所有字段问全：

```
$ node new.js

  ◇ 新文章向导
  ──────────────────────────

1/10 标题：NixOS 折腾记
· 标题含中文，建议用拉丁字符 slug（避免中文文件名/URL）
· slug 就是文件名：content/posts/<slug>.md，文章 URL 为 /post/<slug>.html
2/10 文件名 [nixos-折腾记]：nixos-guide
  → content/posts/nixos-guide.md  ·  URL：/post/nixos-guide.html
3/10 日期 [2026-08-18]：
4/10 更新日期（可空，留空不显示"更新于"）：
5/10 标签（空格分隔，可空）：NixOS 配置
6/10 摘要（一句话，可空）：把系统写进一个文件
7/10 阅读时长（分钟，可空=自动估算）：
8/10 草稿？（y/N）：n
9/10 置顶？（y/N）：n
10/10 隐藏目录？（y/N）：n

  确认信息 ────────────────────────
   1  标题     NixOS 折腾记
   2  文件名   nixos-guide
   3  日期     2026-08-18
   4  更新日期 （空）
   5  标签     NixOS, 配置
   6  摘要     把系统写进一个文件
   7  阅读时长 自动
   8  草稿     否
   9  置顶     否
  10  隐藏目录 否
  ────────────────────────────
回车确认生成，或输入编号修改 [确认]：      ← 输入编号可返回修改任意一项

  ✓ 已创建 content/posts/nixos-guide.md
  → 正在启动开发服务器并打开预览…
  → http://127.0.0.1:8000/post/nixos-guide.html
```

向导生成带 frontmatter 的空文章（保持干净），并自动启动（或复用）开发服务器打开浏览器预览、自动用 $VISUAL/$EDITOR 打开新文件（缺省尝试 code/nvim/vim/vi），直接开始写作。全部字段参考随时用 `npm run fields` 查看。文件名输入后会**立即检查冲突**：同名文件、或其他文章 frontmatter 里已占用的 slug 都会被拒绝（绝不覆盖），确认页还能输入编号返回修改任意一项。也可以手动新建 `.md`，开头写 frontmatter：

```markdown
---
title: 文章标题
date: 2025-08-20
updated: 2025-08-25       # 可选，最后更新日期（文章页显示"更新于"，并写入 JSON-LD dateModified）
tags: [随笔, 代码]
slug: my-post            # 可选，默认取文件名（不含 .md 后缀）
summary: 一句话摘要，显示在文章列表里
minutes: 5               # 可选，手动指定阅读时长（缺省按字数自动估算）
draft: true              # 可选，true 则不发布
pin: true                # 可选，true 则置顶到文章列表最前
toc: false               # 可选，false 则隐藏该文章的目录
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
