---
title: 使用 Lua 配置 Hyprland
date: 2026-09-26
tags: [hyprland, lua, 配置, 教程]
slug: hyprland-config-lua
summary: 关于使用 lua 配置 hyprland 的简单教程
---
Hyprland 转向使用 `Lua` 配置啦！！！


## Hyprland 介绍
Hyprland 是一个用 C++ 编写的动态平铺式 Wayland 合成器，带来了非常流畅的窗口动效。就在 Hypland v0.55.0 版本中正式鼓励用户使用 `Lua` 作为配置语言。

## 配置方式

配置位置与之前几乎没有区别，同样在 `.config/hypr/` 下配置。不过配置文件从 `hpyrland.conf` 改为了 `hyprland.lua`。
完整的地址为：
```bash
.config/hypr/hpyrland.lua
```


## 配置说明
关于配置说明我将分为几大块，分别以实际代码为例子展示，同时会说明注意事项，让不熟悉 `Lua` 的朋友们也能轻松照猫画虎的配置。

### 语法提示配置
由于使用了成熟的 `Lua` ，同时为了更方便的配置官方给到了配置智能提示的方式。这里就直接引用官方的方法说明。

> 前置说明，想要使用该智能提示，首先需要安装 `Lua` 的 `LSP` 服务器，这里推荐安装使用 `lua-language-server`。

- 第一种 vscode 中配置
在 `.vscode/` 文件夹下 创建名为 `settings.json` 的文件。
并写入一下文件(可直接复制)
```json
{
  "Lua.workspace.library": [
    "/usr/share/hypr/stubs"
  ]
}
```
- 通用配置方式
在配置文件地址，也就是 `.config/hypr/` 下，创建文件 `.luarc.json` 因为是隐藏文件，所以可能创建完成后看不到，所以 `linux` 上请使用 `ls -la` 来查看是否存在该文件。

请在 `.luarc.json` 中写入以下代码：
```josn
{
  "workspace": {
    "library": [
      "/usr/share/hypr/stubs"
    ]
  }
}
```
下图就是智能提示的效果，大幅度提升配置编写体验

![hyprland智能提示](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-09/hyprland%E6%99%BA%E8%83%BD%E6%8F%90%E7%A4%BA.webp "hyprland智能提示")

> [官方原文链接](https://wiki.hypr.land/0.56.0/Configuring/Start/#autocompletions)

### 第一部分——变量
改部分是变量部分，主要目的是设定我们在后续的配置中要使用的一些软件与快捷键，例如：终端、文件管理器、浏览器等等。方便后续同一修改。

实际代码展示：
```lua
local terminal = "kitty"
local yazi_filemanager = "yazi"
local google_browser = "google-chrome-stable"
local firefox_browser = "firefox"
local music = "spotify"

-- 快捷键
local mainMod = "SUPER + "
local super_shift = "SUPER + SHIFT + "
local super_alt = "SUPER + ALT + "
```
> 细节说明，这里的快捷键变量后个 `+` 后面都应该有个空格，方便后续快捷键绑定时不会出错。

### 第二部分——屏幕设置
这里的配置需要根据官网文档说明与自身情况调整,[官方文档链接](https://wiki.hypr.land/0.56.0/Configuring/Basics/Monitors/)，这里我就以我个人只使用一个屏幕为例子展示代码：

```lua
hl.monitor({
	output = "",
	mode = "1920x1080@144",
	position = "auto",
	scale = 1, -- 这里是缩放，界面太小就调整这里
})
```
### 第三部分——开机自启动
该部分是开机自启部分，比如可以开机自启 `waybar` 等软件与用户服务。
```lua
hl.on("hyprland.start", function()
	-- 自定义用户服务
	hl.exec_cmd("systemctl --user start env-loader.service")
	-- 音频服务
	hl.exec_cmd("systemd --user restart pipewire.service")
	hl.exec_cmd("systemd --user restart pipewire-pulse.service")
	hl.exec_cmd("systemd --user restart wireplumber.service")
	-- 开机自启动软件
	hl.exec_cmd("nm-applet")
	hl.exec_cmd("waybar & awww-daemon")
	hl.exec_cmd("swaync")
	hl.exec_cmd("fcitx5")
end)
```

### 第四部分——环境设置
该部分可以设置，系统的中英、字体，渲染等相关设置。
```lua
hl.env("LANG", "zh_CN.UTF-8")
hl.env("LC_ALL", "zh_CN.UTF-8")

-- 字体与渲染相关
hl.env("XFT_ANTIALIAS", "1")
hl.env("XFT_RGBA", "rgb")

-- Wayland 缩放与 DPI
hl.env("GDK_SCALE", "1")
hl.env("GDK_DPI_SCALE", "1")

-- 游标 & 图标大小（可选）
hl.env("XCURSOR_SIZE", "24")
hl.env("XCURSOR_THEME", "Breeze")
```

### 第五部分——通用设置
该部分为 hyprland 的通用设置，包括杂项，窗口，布局、模糊等，下面以代码展示如何配置(未含有具体配置代码)，具体配置选项查看[官方文档链接](https://wiki.hypr.land/0.56.0/Configuring/Basics/Variables)
```lua
hl.config({
	-- 窗口基本样式
	general = {
		gaps_out = 5, -- 窗口与显示器之间空隙
		border_size = 2, -- 窗口边框宽度
    -- 具体配置选项查看官网说明

		-- 浮动窗口吸附
		snap = {
    -- 具体配置选项查看官网说明
		},
	},
	-- 布局设置
	dwindle = {
    -- 具体配置选项查看官网说明
	},
	-- 窗口样式配置
	decoration = {
		rounding = 10, -- 圆角半径
		rounding_power = 2.0, -- 圆角曲线，2.0圆形，4.0圆角矩形
    -- 具体配置选项查看官网说明
		-- 阴影效果
		shadow = {
			enabled = true, -- 启用窗口阴影投影效果
			range = 10, -- 设置阴影范围尺寸，px
      -- 具体配置选项查看官网说明
		},
		-- 模糊效果
		blur = {
			enabled = true, -- 开启窗口模糊效果
			size = 8, -- 模糊范围
      -- 具体配置选项查看官网说明
		},
	},
  -- 杂项设置
	debug = {
		disable_logs = false,
		enable_stdout_logs = true,
	},
	ecosystem = {
		no_update_news = true, -- 禁用Hyprland更新后弹出的更新新闻窗口
		no_donation_nag = true, -- 禁用每年两次的捐赠提示窗口
	},
	misc = {
		disable_hyprland_logo = false, -- 禁用随机出现的动漫女孩或者LOGO
		force_default_wallpaper = -1, -- 强制使用三块壁纸之一，-1随机，0与1可禁用动漫壁纸
	},
})
```
### 第六部分——动画
这里就以贝赛尔曲线做例子，[官方文档链接](https://wiki.hypr.land/0.56.0/Configuring/Advanced-and-Cool/Animations/)
首先第一步可以定制自己喜欢的动画贝赛尔曲线
```lua
-- 自定义贝塞尔曲线
hl.curve("gentle", { type = "bezier", points = { { 0.23, 1 }, { 0.32, 1 } } })
hl.curve("natural", { type = "bezier", points = { { 0.16, 1 }, { 0.3, 1 } } })
hl.curve("quick", { type = "bezier", points = { { 0.15, 0 }, { 0.1, 1 } } })
hl.curve("organic", { type = "bezier", points = { { 0.645, 0.045 }, { 0.355, 1 } } })
```
接下来按着官方文档中的 [`动画树`](https://wiki.hypr.land/0.56.0/Configuring/Advanced-and-Cool/Animations/#animation-tree) 来逐个按着喜好配置动画效果，以下代码仅展示部分。
```lua
-- 窗口动画设置
hl.animation({ leaf = "windowsIn", enabled = true, speed = 3.6, bezier = "gentle", style = "popin 70%" })
-- 图层动画
hl.animation({ leaf = "layersOut", enabled = true, speed = 3, bezier = "robotic", style = "slide top" })
-- 窗口的淡入淡出
hl.animation({ leaf = "fade", enabled = true, speed = 3.03, bezier = "quick" })
hl.animation({ leaf = "fadeDim", enabled = true, speed = 2.6, bezier = "smoothOut" })
-- 弹窗的淡入淡出
hl.animation({ leaf = "fadeLayersIn", enabled = true, speed = 2.79, bezier = "organic" })
hl.animation({ leaf = "fadeLayersOut", enabled = true, speed = 1.39, bezier = "organic" })
-- 工作区
hl.animation({ leaf = "workspaces", enabled = true, speed = 3.8, bezier = "organic", style = "slidefadevert" })
hl.animation({ leaf = "workspacesOut", enabled = true, speed = 3.6, bezier = "organic", style = "slide" })
```
> 其中 `leaf` 的参数就是动画树，可参看官方文档说明填写，其中的 `bezier` 的参数就是之前配置的贝赛尔曲线的名称，`style` 动画状态，可以在动画树中查看到

### 第七部分——窗口规则

根据规则匹配相对应的窗口实现自定义的一些效果，比如：浮动窗口，窗口最大化等。
这里以模糊 `rofi` 启动器层与创建浮动终端窗口为例子。[官方文档原文](https://wiki.hypr.land/0.56.0/Configuring/Basics/Window-Rules/)

```lua
hl.window_rule({ -- window 规则
	match = {
		class = "floating-term",
	},
	center = true,
	size = { "(monitor_w*0.6)", "(monitor_h*0.6)" },
	float = true,
})

hl.layer_rule({ -- layer 规则
	match = {
		namespace = "rofi",
	},
	blur = true,
	blur_popups = true,
	xray = true,
	ignore_alpha = false,
})
```

### 第八部分——快捷键绑定(重要！！！)
该部分是就最重要的，决定了日常的使用习惯。所以请仔细查看代码，并结合，**第一部分的快捷键变量来看**。

- 执行终端命令的快捷键绑定
```lua
hl.bind(mainMod .. "return", hl.dsp.exec_cmd(terminal)) -- 打开默认终端
hl.bind(super_shift .. "return", hl.dsp.exec_cmd(terminal .. " --class floating-term")) -- 标记浮动终端，在窗口规则设置浮动终端样式
hl.bind(mainMod .. "b", hl.dsp.exec_cmd(google_browser)) -- 打开谷歌浏览器
```
> 其中的`mainMod` 等就是前文的变量，使用 `Lua` 字符拼接(`..`)将按键结合起来成为组合快捷键。正常为`hl.bind("SUPER + SHIFT + Q", hl.dsp.exec_cmd("firefox"))`

- 执行官方调度器的快捷键绑定
官方调度器提供了类似于窗口移动，工作区移动等方便绑定快捷键，这里给到[官方文档链接](https://wiki.hypr.land/0.56.0/Configuring/Basics/Dispatchers/)
```lua
-- 窗口快捷键
hl.bind(mainMod .. "f", hl.dsp.window.fullscreen_state({ internal = 2, client = 0, action = "toggle" })) -- 全屏
hl.bind(super_shift .. "f", hl.dsp.window.fullscreen_state({ internal = 1, client = 0, action = "toggle" })) -- 假全屏（最大化但保留状态栏）
hl.bind(mainMod .. "p", hl.dsp.window.float({ action = "toggle" })) -- 切换当前窗口的布局模式为浮动模式或平铺模式
hl.bind(super_shift .. "p", hl.dsp.window.pin({ action = "toggle" })) -- 固定浮动窗口
hl.bind(super_shift .. "a", hl.dsp.window.center()) -- 窗口居中
hl.bind(mainMod .. "v", hl.dsp.window.pseudo({ action = "toggle" })) --  伪窗口模式（pseudo 模式），常用来布局微调，配合改变窗口大小使用
hl.bind(mainMod .. "j", hl.dsp.layout("togglesplit")) --  切换当前窗口的分割方向（水平/垂直）

-- 使用主修饰键（mainMod）加方向键来移动焦点
hl.bind(mainMod .. "tab", hl.dsp.window.cycle_next())
hl.bind(mainMod .. "left", hl.dsp.focus({ direction = "l" }))
hl.bind(mainMod .. "right", hl.dsp.focus({ direction = "r" }))
hl.bind(mainMod .. "up", hl.dsp.focus({ direction = "u" }))
hl.bind(mainMod .. "down", hl.dsp.focus({ direction = "d" }))
```
> 请仔细查看，对应的调度器中的参数。

## 注意事项
- 文件拆分，在 `Lua` 中拆分文件，需要使用 `require` 来导入文件
- 编写时注意看清楚，`{}` 的关系,尤其是 `hl.config` 中做通用配置，会嵌套许多的 `{}`，所以建议，将 `hl.config` 中的不同配置选项拆分着，更清楚。比如：杂项一部分，窗口模糊一部分等。
- 动画方面，一定要根据博客中提供的动画树链接去查看对应的结构。
- 建议跟随博客中说明的智能提示进行了配置同时正常运行，会提高配置编写体验。
- 建议照猫画虎的使用博客中的一些代码，可帮助你更方便的编写配置。

## 总结
使用 `Lua` 配置，我认为是一次不错的选择，使用更成熟的 `Lua` 替代原来的 `hyprland.conf` 让配置更清晰，体验会更好，同时 `Lua` 的上手难度不是很高，用来做配置上不需要过多的 `Lua` 知识，甚至比 `neovim` 更容易配置。

> 最后将我的完整 `hyprland.lua` 的配置链接放在这里。[`Hyprland配置链接`](https://github.com/Youthdreamer/nixos-config/blob/main/home/youth/hyprland/hypr/hyprland.lua)
