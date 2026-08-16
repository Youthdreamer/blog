---
title: Hyprland：我的 Wayland 桌面
date: 2025-08-26
tags: [Wayland, 桌面]
slug: hyprland-tiling-wm
summary: 一个漂亮的 Wayland 平铺窗口管理器，动画丝滑，配置灵活。
---

在试过 Sway 和 KDE 之后，我最终停在了一个叫 **Hyprland** 的 Wayland 平铺窗口管理器上。

它最大的特点是**动画**——窗口打开、关闭、切换都有丝滑的过渡，这在平铺窗口管理器里很少见。

## 平铺是什么

平铺（tiling）就是窗口自动排列、不重叠，像贴瓷砖一样。你不需要手动拖拽、对齐，窗口管理器替你安排。

```hypr
# hyprland.conf 片段
general {
  gaps_in = 6
  gaps_out = 12
  border_size = 2
}

decoration {
  rounding = 10
}
```

## 为什么选它

- 动画顺滑，颜值在线
- 配置是声明式的，改起来清晰
- 社区活跃，文档齐全

## 代价

平铺有学习成本：你要记快捷键、适应"键盘优先"的思维。但一旦习惯，效率提升是实打实的。

*—— 写于一个调好动画的下午*
