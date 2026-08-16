---
title: NixOS：把系统写进一个文件
date: 2025-08-20
tags: [NixOS, Linux]
slug: nixos-declarative-system
summary: 一个用配置文件描述整个操作系统、可复现、可回滚的 Linux 发行版。
---

NixOS 是我用过的所有 Linux 发行版里，最"不一样"的一个。

它不靠手动装软件、改配置，而是**用一个声明式的配置文件描述整个系统**——装了什么包、开了什么服务、怎么分区，全都写在一个文件里。

## 声明式 vs 命令式

传统发行版是"命令式"的：你执行一条条命令，系统一步步变成现在的样子。NixOS 是"声明式"的：你声明想要的最终状态，它负责达到这个状态。

```nix
# configuration.nix 的一小段
{ config, pkgs, ... }: {
  environment.systemPackages = with pkgs; [
    vim
    git
    firefox
  ];
}
```

改配置 → `nixos-rebuild switch` → 系统就变了。

## 可回滚

每次切换配置都会生成一个新的"世代"（generation）。装坏了、升级翻车了？重启时选上一个世代，立刻回到之前的状态。

> 一个可以"后悔"的操作系统，这本身就很迷人。

## 代价

代价是学习曲线陡峭：Nix 语言、Flakes、依赖模型……刚开始会很痛苦。但一旦跨过去，就回不去了。
