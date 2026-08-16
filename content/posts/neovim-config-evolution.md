---
title: 我的 Neovim 配置进化史
date: 2025-08-18
tags: [Neovim, 配置]
slug: neovim-config-evolution
summary: 从一段 300 行的 vimrc，到一个用 Lua 组织的模块化配置。
---

每个 Neovim 用户都经历过这个阶段：先抄别人的配置，再删掉大半，最后只留下自己真正用的。

我的配置也走过了这条路。

## 从 vimrc 到 Lua

Neovim 0.5 引入原生 Lua 后，配置从一堆 `vim.cmd` 变成了真正的代码。我花了一个周末，把 300 行 vimrc 重写成了 Lua。

```lua
-- init.lua 的骨架
require("options")
require("keymaps")
require("plugins")
```

模块化之后，改配置终于不再是一团乱麻。

## 我用到的插件

- **telescope** —— 模糊查找文件、内容、符号
- **nvim-treesitter** —— 精确的语法高亮
- **lspconfig** —— 语言服务器接入
- **which-key** —— 忘了快捷键时救我一命

## 配置的终点

配置的终点不是"功能最多"，而是**不再折腾**。现在我的配置已经很久没大改了——这大概是最好的状态。

*—— youth，于一次折腾之后*
