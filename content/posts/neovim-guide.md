---
title: neovim教程入门——介绍
date: 2026-08-19
tags: [neovim, 入门, 教程]
slug: neovim-guide
summary: neovim的入门教程，neovim的简单介绍与基本操作
---

本篇仅仅简单了解一下 Neovim
![neovim-logo](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-08/neovim-logo-300x87.webp)

# Neovim 简单介绍

简单的说，Neovim 是 Vim 原版的一个**分支**，所以其保留了 Vim 的经典全键盘操作。不过 Neovim 并非用来取代 Vim，不过与 Vim 相比 Neovim 更容易维护与扩展，同时也带来了更好的性能。配置方面，Neovim 可采取传统的 `init.vim` 配置，不过现在主流推荐使用 `init.lua`。


# Neovim 基本操作

接下来简单的了解基本操作。  

首先 neovim 的不同操作要在对应的模式下才能生效。以下就是 Neovim 常用模式：

| **模式** | **进入方式** | **可进行的操作** |
| :--- | :--- | :--- |
|**普通模式**（Normal）|进入后默认在普通模式，可使用 `Esc` 切换到普通模式 |光标移动，删除，复制，粘贴等 |
|**插入模式**（Insert）|在普通模式下按下`i` 、`a` 、`o` 等|输入文本|
|**命令模式**（Command）|在普通模式下按下`:`|输入命令，搜索，保存，退出等|
|**可视模式**（Visual）|在普通模式下按下`v`、`V`、`Ctrl-v`|选中文本|

# Neovim 配置介绍

# Neovim 插件介绍

