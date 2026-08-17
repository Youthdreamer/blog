---
title: 关于 dotfiles 与可复现的配置
date: 2025-08-30
tags: [dotfiles, 配置]
slug: dotfiles-reproducible-config
summary: 把配置文件放进 git 仓库，让任何一台机器都能变回"我的环境"。
---

换电脑、重装系统，最怕的不是装软件，而是**找回那些改了无数次的配置**。

![明日香](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-08/%E6%98%8E%E6%97%A5%E9%A6%99.webp)
我的解法是把所有配置放进一个 **dotfiles 仓库**，用 git 管理。

## 思路

所有以 `.` 开头的配置文件——`.vimrc`、`.zshrc`、`.tmux.conf`——都放进一个仓库，用软链接指回 `$HOME`。
![明日香](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/%E6%98%8E%E6%97%A5%E9%A6%99.png)

```bash
# 一个简单的安装脚本
ln -sf ~/dotfiles/.zshrc ~/.zshrc
ln -sf ~/dotfiles/.tmux.conf ~/.tmux.conf
ln -sf ~/dotfiles/.config/nvim ~/.config/nvim
```

## 更进一步：Nix 全家桶

如果配合 NixOS + Home Manager，连"装软件 + 配环境"都可以声明式完成——dotfiles 仓库变成了整个系统的单一事实来源。

- 新机器：克隆仓库 → 跑安装脚本 → 环境就绪
- 改动配置：改仓库 → 提交 → 同步到所有机器

## 最后

> 配置不是一次性的，它是你与工具之间长期磨合的结果。让它可复现，是对自己时间的尊重。

_—— 写于第 N 次配置同步之后_
