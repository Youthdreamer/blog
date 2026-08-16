---
title: 一份最小 configuration.nix
date: 2025-08-22
tags: [NixOS, 配置]
slug: minimal-nixos-config
summary: 从一个最小可用配置开始，理解 NixOS 的骨架。
---

刚接触 NixOS 时，最怕的是不知道从哪下手。其实一个最小配置，几十行就够。

## 骨架

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

## 几个关键部分

- **boot** —— 引导方式
- **networking** —— 主机名、网络
- **environment.systemPackages** —— 装什么软件
- **services** —— 开什么服务

## 从最小开始

我的建议：**从最小配置开始，用到一个加一个**。不要一上来就抄别人的巨型配置，那样永远学不会。

*—— 写于一次 NixOS 重装之后*
