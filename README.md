# youth — 一间写字的屋子

零依赖、手工定制的个人博客。深色底 · 香槟金 · 宋体排版——没有框架，没有模板，构建脚本、样式、交互全部手写。

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [写一篇文章](#写一篇文章)
- [目录结构](#目录结构)
- [Nix 开发环境](#nix-开发环境nixos)
- [个性化](#个性化)
- [部署到 GitHub Pages](#部署到-github-pages)
- [彩蛋](#彩蛋)

## 特性

- **零依赖**：构建与预览只用 Node 内置模块，无任何第三方包；pnpm 仅作脚本入口，无需 `pnpm install`
- **手写 Markdown 解析器**：标题、粗体/斜体/删除线、行内代码、内/外链接、图片（含图注）、引用、列表、表格（GFM 管道语法，支持对齐）、分隔线、围栏代码块
- **新文章向导**：`pnpm run new` 一问一答填写全部字段，自动生成文章、打开预览、可选拉起编辑器
- **阅读体验**：长文自动目录（TOC）、阅读进度条、上一篇/下一篇、相关文章推荐（按共同标签）、隐藏式落款（微尘浮沉）
- **代码高亮 + 复制按钮**：highlight.js 本地自托管
- **图片**：懒加载 + 点击放大（零依赖 lightbox）+ 香槟金细边
- **链接悬停预览**：站内文章富预览 + 外站 favicon/域名预览
- **首页特效**：鼠标光晕、点击墨滴涟漪、逐字浮现标题、漂浮墨尘
- **分页 / 置顶**：文章过多自动分页；`pin: true` 置顶到列表最前
- **标签页**：加权词云（字号平滑缩放、错峰浮动、悬停金线）+ 标签归档页
- **回到顶部**：菱形按钮，滚动浮现、平滑回顶
- **自定义 404**：自包含渲染，任意深度 URL 都正常显示
- **年份自动获取**：页脚 © 与 est. 构建时自动取当年
- **SEO**：canonical、Open Graph、Twitter Card、JSON-LD、`sitemap.xml`、`robots.txt`、RSS
- **响应式与无障碍**：窄屏适配、`prefers-reduced-motion`、焦点环
- **GitHub Pages 自动部署**：每次 push 自动构建发布

## 快速开始

```bash
pnpm run new      # 新文章向导（写作入口，推荐）
pnpm run dev      # 开发模式：改 content/ 或 assets/ 自动重建 + 浏览器刷新
pnpm run build    # 一次性构建站点 → site/
pnpm run serve    # 静态预览（默认 8000，PORT=9000 换端口）
pnpm run stop     # 停止开发服务器（按 .dev.pid 定位）
pnpm run fields   # frontmatter 字段参考
```

> 全部命令等价于 `node <脚本>.js`；pnpm 只是脚本入口，无需 `install`。

打开 http://127.0.0.1:8000 即可。

## 写一篇文章

### 方式一：向导（推荐）

`pnpm run new`——一问一答填写全部字段，生成文章并打开预览：

```
$ node new.js

  ◇ youth · 新文章向导
  ────────────────────────────

01/10 标题：NixOS 折腾记
02/10 文件名 [nixos-折腾记]：nixos-guide
  → content/posts/nixos-guide.md · URL：/post/nixos-guide.html
03/10 日期 [2026-08-18]：
04/10 更新日期（可空，留空不显示"更新于"）：
05/10 标签（空格分隔，可空）：NixOS 配置
06/10 摘要（一句话，可空）：把系统写进一个文件
07/10 阅读时长（分钟，可空=自动估算）：
08/10 草稿？（y/N）：n
09/10 置顶？（y/N）：n
10/10 隐藏目录？（y/N）：n

  确认信息 ────────────────────────
  № 01  标题       NixOS 折腾记
  № 02  文件名     nixos-guide
  № 03  日期       2026-08-18
  № 04  更新日期   （空）
  № 05  标签       NixOS, 配置
  № 06  摘要       把系统写进一个文件
  № 07  阅读时长   自动
  № 08  草稿       否
  № 09  置顶       否
  № 10  隐藏目录   否
  ────────────────────────────
回车确认生成，或输入编号修改 [确认]：   ← 输入编号可返回修改任意一项

  ✓ 已创建 content/posts/nixos-guide.md
  → http://127.0.0.1:8000/post/nixos-guide.html
```

向导的贴心之处：

- 文件名输入后**立即检查冲突**（同名文件 / 其他文章 frontmatter 占用），绝不覆盖
- 确认页输入编号可返回修改任意一项
- 自动启动（或复用）开发服务器并打开浏览器预览
- 询问后可用 `$VISUAL`/`$EDITOR` 打开新文件直接写作（默认不打开；终端编辑器如 nvim 会在独立终端窗口打开，dev 日志保持在本终端）
- 全部字段参考：`pnpm run fields`

### 方式二：手动创建

在 `content/posts/` 新建 `.md`。frontmatter 字段一览：

| 字段 | 必填 | 作用 |
| --- | --- | --- |
| `title` | ✅ | 文章标题 |
| `date` | ✅ | 发布日期（`YYYY-MM-DD`） |
| `slug` | ⚠️ | 文件名 / URL（缺省取文件名，含中文时建议显式指定） |
| `updated` | | 最后更新日期，文章页显示"更新于"，写入 JSON-LD |
| `tags` | | 标签数组，如 `[NixOS, 配置]` |
| `summary` | | 一句话摘要，显示在文章列表 |
| `minutes` | | 手动阅读时长（缺省按字数自动估算） |
| `draft` | | `true` = 草稿，不发布 |
| `pin` | | `true` = 置顶到列表最前 |
| `toc` | | `false` = 隐藏本文目录 |

```markdown
---
title: 文章标题
date: 2025-08-20
slug: my-post
---
```

### Markdown 语法

支持：**粗体**、*斜体*、~~删除线~~、`` `行内代码` ``、[链接](https://example.com)、引用、列表、标题、分隔线、图片（含图注）、围栏代码块、**表格**。

表格使用 GFM 管道语法（前后需留空行，支持对齐）：

```markdown
| 名称 | 数量 |
| :--- | ---: |
| 甲   | 2    |
```

对齐方式：`:---` 左对齐 · `:---:` 居中 · `---:` 右对齐。

构建：`pnpm run build`。文章按日期倒序排列（`pin: true` 置顶最前），`draft: true` 自动隐藏；slug 重复时构建会**报错并列出冲突文件**。

### 图片

```markdown
![图片说明](https://cdn.jsdelivr.net/gh/你的用户名/images@main/photo.jpg)
![图片说明](https://.../photo.jpg "这里是图注")   <!-- 加空格+双引号即图注 -->
```

图片点击可放大。建议放**独立图床仓库 + jsDelivr CDN**（免费、零维护、不撑大博客仓库）；注意 jsDelivr 只代理**公开** GitHub 仓库。

## 目录结构

```
.
├── build.js                  # 构建入口（薄，委托给 lib/）
├── new.js                    # 新文章向导
├── stop.js                   # 停止开发服务器（按 .dev.pid 定位）
├── serve.js                  # 本地预览服务器（支持自定义 404）
├── lib/                      # 构建逻辑（模块化，单向依赖）
│   ├── config.js             #   站点配置 + 路径常量
│   ├── utils.js              #   工具函数（转义/日期/阅读时长…）
│   ├── markdown.js           #   手写 Markdown 解析器
│   ├── content.js            #   读取 content/ 下的文章与页面
│   ├── shell.js              #   页面骨架（head/nav/footer + 404 自包含辅助）
│   ├── views.js              #   内容视图（文章/首页/标签/关于/404 渲染）
│   └── build.js              #   构建流程（清理/拷贝/渲染/SEO 产物）
├── assets/
│   ├── css/                  # 样式（按职责拆分）
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
├── flake.nix                 # Nix 开发环境（node/pnpm/git/imagemagick）
├── package.json
└── site/                     # 构建产物（git 忽略）
```

## Nix 开发环境（NixOS）

项目带 `flake.nix`（`.envrc` 已配 `use flake`），进入目录自动加载开发环境：

- **工具**：Node 24、pnpm（脚本入口）、git、ImageMagick（图片处理）
- **进入方式**：`nix develop`（或装 `direnv` 后进入目录自动激活）
- **可复现构建**：`nix build` 输出纯静态站点到 `result/`
- **一键起 dev**：`nix run .#dev`
- 修改 `flake.nix` 后：`nix flake update` 或 `nix develop --refresh` 生效

## 个性化

| 想改什么 | 去哪里改 |
| --- | --- |
| 站点名 / 标语 / 作者 | `lib/config.js` 的 `SITE` |
| 每页文章数 / 建站年份 | `lib/config.js` 的 `PAGE_SIZE` / `SITE.founded` |
| 配色 | `assets/css/base.css` 的 `:root` 变量 |
| 字体 | `lib/shell.js` 的 `FONTS` + `base.css` 字体变量 |
| 导航 / 页脚文字 | `lib/shell.js` 的 `nav()` / `footer()` |
| 相关文章推荐篇数 | `lib/views.js` 的 `relatedPosts()`（`n` 参数） |
| 回到顶部按钮 | `assets/css/components.css` 的 `#to-top` |
| 彩蛋台词 | `assets/js/core.js` 的 `showToast(...)` |
| 关于页内容 | `content/pages/about.md` |

> 配色是"高级感"的关键：金色只用在链接、标记、印章这类**需要被看见**的地方，正文保持纸白色。

## 部署到 GitHub Pages

1. 推到 GitHub 仓库（`git push -u origin main`）
2. 仓库 `Settings → Pages → Build and deployment` 的 **Source 选 `GitHub Actions`**
3. 每次 push 自动构建并发布（见 `.github/workflows/deploy.yml`）
4. 把 `lib/config.js` 里的 `SITE.url` 改成你的真实地址——**canonical / sitemap / og:url / RSS 都依赖它**
5. 构建自动生成 `sitemap.xml`、`robots.txt`、`feed.xml`，每页写入 JSON-LD

> 站点用全相对路径，部署在 `用户名.github.io/仓库名/` 子路径下也能正常显示。当前 `SITE.url` 预填 `https://Youthdreamer.github.io/blog`，部署前请核对。

## 彩蛋

1. 键盘敲出 `youth` 五个字母
2. 连点三次页脚的金色印章

（找到的人，请保持安静。）
