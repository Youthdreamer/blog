---
title: 为什么我还留在 Vim
date: 2025-08-16
tags: [Vim, 编辑器]
slug: why-i-stay-with-vim
summary: 编辑器大战从未停止，但我还是留在了这把"老"编辑器里。说说为什么。
---

有人把编辑器之争比作宗教战争：Emacs、VS Code、JetBrains……吵了二十年，没有赢家。

我用了很多年 Vim，中途也叛逃过几次，最后又回来了。这篇写写为什么。

## 手不离开键盘

Vim 的核心魅力，是**模态编辑**。普通模式下，`dd` 删一行、`ci"` 改引号内内容、`%` 跳到匹配括号——每一个操作都是"动词 + 范围"，像一门小语言。

> 用鼠标编辑代码，就像用筷子喝汤——能做，但别扭。

## 无处不在

Vim 几乎无处不在：服务器的默认编辑器是它，`git commit` 默认打开它，几乎所有 IDE 都有 Vim 键位插件。

这意味着你学一次，可以用一辈子。

## 我的最小配置

```vim
set number
set relativenumber
set expandtab
set shiftwidth=2
set ignorecase
set smartcase
```

就这么几行，足够我工作。编辑器不需要华丽，需要**顺手**。

*—— 写于一次深夜的重装之后*
