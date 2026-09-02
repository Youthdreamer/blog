---
title: Neovim 插件分享
date: 2026-09-02
tags: [neovim, 插件分享, 开发工具]
slug: nvim-plugin-share
summary: 分享一些我个人常用的neovim插件。
---

简单分享，不做完整插件使用教程，下面就以我在 **neovim 0.12 **的使用体验做推荐，并某些插件在 **0.12** 版本才有更好的效果，推荐在 **0.12** 中使用。

## UI类插件

- **颜色插件**

颜色插件在 neovim 中会带来最直观的视觉影响，所以我这次推荐几个我个人很喜欢的颜色主题插件。
  
1. **tokyonight**
其中有四个颜色主题可选：`tokyonight-night` `tokyonight-storm` `tokyonight-day` `tokyonight-moon`

安装地址：
```
https://github.com/folke/tokyonight.nvim
```

2. **gruvbox**
其中有两个颜色主题可选：`dark` `light`，通过设置 `vim.o.background = "dark"` 来切换。

安装地址：
```
https://github.com/ellisonleao/gruvbox.nvim
```

3. **catppuccin**
该主题已在 neovim 0.12 版本中内置，使用 `colorscheme catppuccin` 直接使用，不过也可通过安装该主题插件，进行更多配置。

安装地址：
```
https://github.com/catppuccin/nvim
```

4. **vague**
只有一个主题可选

安装地址：
```
https://github.com/vague-theme/vague.nvim
```

- **文件图标**
插件：`nvim-wbe-devicons`

图标也是提升编辑器视觉效果的一个重要元素，所以我个人会使用 
安装地址：
```
https://github.com/nvim-tree/nvim-web-devicons
```

- **缓冲区选项卡**
插件：`bufferline.nvim`

neovim 中显示每个打开后的文件的选项卡，一方面是很轻易知道目前在那个文件下编辑代码，另一方面，也可以清楚的看到开了几个正在编辑的文件，除此之外，还可以通过插件带来一些使用功能，比如：缓冲区快捷键跳转、查找打开的缓冲区等等。
安装地址：
```
https://github.com/akinsho/bufferline.nvim
```




## 编辑器增强类插件
其实这一类的插件也有不少，但是我个人偏向于简洁的neovim配置，所以这里我只推荐一个插件。

- **文件管理**
`oil.nvim`

以编辑缓冲区的方式做文件的增加，改名，删除等，非常的舒服。

安装地址：
```
https://github.com/stevearc/oil.nvim
```


## 编程类插件
- **lsp 配置**
`nvim-lspconfig`

想要使用 `lsp` 服务，如果没有相关的配置是无法启动 lsp 服务的，所以这个插件可以很方便的获取一些默认的 lsp 的配置。同时配合 neovim 内置的 `vim.lsp.config()` 来进行个性化的 lsp 配置。也是十分灵活的。

安装地址：
```
https://github.com/neovim/nvim-lspconfig
```

- **代码格式化**
`conform.nvim`

编程中对代码格式化是一个非常重要的事情，使用 lsp 自带的格式化功能往往不能满足，所以需要使用的对应的格式化工具。

安装地址：
```
https://github.com/stevearc/conform.nvim
```

## 工具类插件

- **文件搜索**
`fzf-lua`

这款文件搜索插件，是我从 `telescope.nvim` 换用过来的。这个插件无需依赖其他的 neovim 插件，这点深得我心。功能也完全足够，界面的美观程度也是开箱即用的程度。

安装地址：
```
https://github.com/ibhagwan/fzf-lua
```

- **括号成对**
`nvim-autopairs`

无序多言，括号、引号等。多数情况下都是成对出现，这宽插件省去了不少麻烦。

安装地址：
```
https://github.com/windwp/nvim-autopairs
```

- **屏幕内快速跳转**
`hop.nvim`

非常好用的快速跳转插件，尤其对**中文内容**的跳转，也做到了非常好的效果。

安装地址：
```
https://github.com/smoka7/hop.nvim
```

- **项目跳转**
`project.nvim`

方便的在不同的项目之间跳转，如果使用的 GUI。那么这个插件必不可少。

安装地址：
```
https://github.com/DrKJeff16/project.nvim

```

- **快速添加成对符号**
`nvim-surround`

非常经典的 vim 插件，非常快速的为单词加上引号、括号等。

安装地址：
```
https://github.com/kylechui/nvim-surround
```

- **git功能集成**
`gitsigns.nvim`

提供了非常的 git 功能在编辑器中显示，我个人尤其喜欢侧边的git 状态栏，还有其他很实用的功能可以探索。


安装地址：
```
https://github.com/lewis6991/gitsigns.nvim
```

- **快捷键显示(可选)**

`which-key.nvim`

非常方便的能看到自己的快捷键绑定，当然对于非常熟悉自己快捷键的人来说，这个插件是可有可无的存在，不过有时候我偶尔会忘记一些不常用快捷键所以也做推荐。

安装地址：
```
https://github.com/folke/which-key.nvim
```

## nvim内置插件

在 `Neovim 0.12` 版本中，存在了几个内置的插件，例如：`difftool` `undotree` 等。这里我推荐 `undotree`

- **undotree**

首先先了解一下如何开启该功能吧。代码如下：

```lua
	vim.cmd([[packadd nvim.undotree]]) -- 加载该内置插件
	require("undotree").open() -- 打开该插件
```

我个人的使用方式是直接放在快捷中使用。如下：
```lua
local map = vim.keymap.set

map("n", "<leader>uu", function()
	vim.cmd([[packadd nvim.undotree]])
	require("undotree").open()
end, { desc = "Undotree" })
```

## 尾声

上面所推荐的全部插件都在我个人的的neovim配置([**nvim-pack**](https://github.com/Youthdreamer/nvim-pack))中使用，是一整套完整且简洁舒适的插件选择。
