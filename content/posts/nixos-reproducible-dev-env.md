---
title: 用 NixOS 打造可复现的开发环境
date: 2025-09-02
tags: [NixOS, 指南]
slug: nixos-reproducible-dev-env
summary: 从配置、Flakes、Home Manager 到编辑器与桌面的完整工作流，一篇长文讲清楚。
---

换电脑、重装系统、给新机器配环境——这件事我做腻了。于是我把整个开发环境搬进了 NixOS，从此"配环境"变成了"克隆一个仓库、跑一条命令"。这篇长文，记录我摸索出来的完整工作流。

## 为什么我在意「可复现」

传统方式配环境，靠的是"我脑子里记得装过什么"。装到什么依赖、改了什么配置、加了哪个别名，时间一久就忘了。换台机器，光是想起来"我到底配了哪些东西"就要半天。

> 可复现的本质，是让环境**从记忆变成文件**。

NixOS 的价值就在这：你的整个系统——装了什么包、开了什么服务、什么用户、什么 shell——都被描述在一个（或几个）纯文本文件里。任何一台机器，拿到这些文件，就能还原出**一模一样**的环境。

## 起点：一个最小的 configuration.nix

先别急着写复杂配置。NixOS 的入口是 `/etc/nixos/configuration.nix`，最小可用形态长这样：

```nix
{ config, pkgs, ... }:

{
  imports = [ ./hardware-configuration.nix ];

  boot.loader.systemd-boot.enable = true;
  boot.loader.efi.canTouchEfiVariables = true;

  networking.hostName = "nixbox";

  environment.systemPackages = with pkgs; [
    vim
    git
    curl
  ];

  services.openssh.enable = true;

  system.stateVersion = "24.11";
}
```

改完保存，执行 `nixos-rebuild switch`，系统就切到了新状态。每次切换都生成一个"世代"（generation），升级翻车了可以在引导菜单里回退。

## Flakes：锁定一切版本

`configuration.nix` 里 `imports` 的包版本，默认跟随你的 nixpkgs channel——这仍然不够"锁定"。真正的可复现靠 **Flakes**。

一个 `flake.nix` 会生成 `flake.lock`，把 nixpkgs、以及所有输入的**精确提交哈希**锁死：

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };
  outputs = { nixpkgs, ... }: {
    nixosConfigurations.nixbox = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [ ./configuration.nix ];
    };
  };
}
```

有了 `flake.lock`，一年后再换新机器，环境还是当年那个版本，不会因为上游更新而悄悄变样。

## Home Manager：用户态配置

系统级配置（configuration.nix）管的是"机器"，而 dotfiles、shell、编辑器这些"人的偏好"，应该交给 **Home Manager** 管用户态：

```nix
# home.nix
{ config, pkgs, ... }:
{
  home.username = "youth";
  home.stateVersion = "24.11";

  programs.zsh.enable = true;
  programs.tmux.enable = true;
  programs.neovim.enable = true;
  programs.git = {
    enable = true;
    userName = "半山屏风";
  };
}
```

系统和用户两层分离，职责清晰：系统负责"能不能跑"，Home Manager 负责"好不好用"。

## 编辑器：Neovim + LSP

编辑器是我折腾最多的地方。最终形态是 Neovim + 原生 LSP + Treesitter，全部用 Lua 模块化管理：

```lua
-- init.lua
require("options")   -- 基础选项
require("keymaps")   -- 键位
require("plugins")   -- 插件与 LSP
```

用 NixOS 的好处是：Neovim 及其语言服务器、依赖工具，都可以声明式装好，不用手动 `npm install`、`pip install` 一堆全局包。

## 显示：Wayland 与 Hyprland

显示层我选了 Wayland + Hyprland 平铺窗口管理器。窗口自动排列、动画丝滑，配置也是声明式的：

```hypr
general {
  gaps_in = 6
  gaps_out = 12
  border_size = 2
}

decoration {
  rounding = 10
}
```

Wayland 相比 X11 更安全、无撕裂，代价是一些老工具（截图、录屏）要换新方案——2025 年的今天，主流应用基本都跟上了。

## 终端：tmux 与 shell

终端里，tmux 负责"会话不丢"，shell 负责"顺手"。我的组合是 tmux + zsh：

- **tmux**：断线重连后，所有窗格原样还在
- **zsh**：补全、别名、历史，加上一点点主题

```bash
tmux new -s work       # 新建会话
tmux attach -t work    # 重连
```

配合 Home Manager，`.tmux.conf` 和 `.zshrc` 也被纳入了版本管理，不再是散落的文件。

## dotfiles 的最终形态

把上面所有东西串起来，我的 dotfiles 仓库最终长这样：

```
dotfiles/
├── flake.nix              # 系统 + 用户配置入口
├── configuration.nix      # 系统级
├── home.nix               # 用户级（Home Manager）
└── programs/              # 各程序配置
    ├── neovim/
    ├── tmux/
    └── zsh/
```

- **新机器**：克隆仓库 → `nixos-rebuild switch` → 环境就绪
- **改配置**：改文件 → 提交 → 所有机器同步

## 几个常见的坑

这条路不是一帆风顺，我踩过的坑有这些：

1. **Nix 语言的学习曲线**：函数式、惰性求值，刚接触会懵，但跨过去就好了
2. **Flakes 还标着"实验性"**：要开 `experimental-features = nix-command flakes`
3. **一些软件没有 Nix 包**：要么自己写 derivation，要么用 `fetchFromGitHub` 从源码构建
4. **缓存**：优先用 `cache.nixos.org` 的二进制缓存，别自己从头编译大项目

## 结语：配置是长期的事

可复现不是为了炫技，而是**对未来的自己负责**。今天多花一点时间把配置写清楚，换机器、帮朋友、甚至重装系统时，都能省下成倍的时间。

> 配置不是一次性的，它是你与工具之间长期磨合的结果。让它可复现，是对自己时间的尊重。

*—— 写于第 N 次一键还原环境之后*
