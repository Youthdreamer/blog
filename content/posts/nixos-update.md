---
title: Nixos 系统更新
date: 2026-09-17
tags: [linux, nixos, 教程, 实操演示]
slug: nixos-update
summary: 演示如何更新 nixos
---

简单演示一下如何更新 **Nixos(flake)** ，如：25.11 升级到 26.05 

## 开篇

首先先了解一下，Nixos 的更新规则。

- 稳定版本(stable)，在每年的**五月与十一月**各推出一个稳定版本。版本号如下：
  - YY.05
  - YY.11
- 非稳定版本(unstable)，持续滚动更新

所以如果你使用稳定版本，可以通过当前月份决定你是否来一次大更新。

## 更新实操

### 更新flake
这里就以 **flake** 中为稳定版本的 Nixos 来做演示，比如从**25.11**升级到**26.05**版本的 Nixos。

其中 **flake** 的 **input** 内容如下图：
![flake截图](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-09/flake-nixos-25.11.webp "25.11版本的flake截图")

从图中可以看到，`nixpkgs.url` 指向的版本是 `25.11` 版本。更新系统的目的就是从 `25.11`升级到`26.05`。所以第一步要做的就是更改 **flake**文件中的版本。更改后如下图：
![修改为26.05](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-09/flake-file-26.11.webp "修改为26.05")

如图所示你需要更新的位置都应该做修改。

**接下来你需要执行：**
```nix
nix flake update 
```
用来更新对应的 **`flake.lock`** 文件内容。

### 更新系统

以上的 `flake` 更新成功后，就可以更新系统了，与其说是更新系统，不如说是重建整个系统。所以我们使用以下命令(做演示)
```nix
sudo nixos-rebuild switch --flake ~/nixos-config#cook
```

其中 `~/nixos-config#cook` 应该改成自己的位置与`hostname`，如下：

```nix
sudo nixos-rebuild switch --flake nixos配置文件地址#你的hostname
```
## 温馨提示
不用担心，更新系统后一些配置选项的问题，你不需要知道有哪些配置选项进行了更改，一切问题会在重建的时候在终端的提示信息中告诉你那些配置选项进行了调整，只需要查看新的选项配置重新配置即可，一般来说不会有太多的选项更新，只需简单调整，完全可以将重建中的错误提示发送给 AI 帮你完成配置修复。如下图的一个例子：
![系统重建的错误展示](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-09/nixos-update-error.webp "系统重建的错误展示")

另外还有一些警告可能在后续的版本中变为错误，可以在这之前修改。例如下图中的提示：
![系统重建时的警告提示](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-09/nixos-update-warning.webp "系统重建时的警告提示")

## 避坑指南
- 注意本篇适用于使用 `flake` 配置系统的实操
- 检查你的网络环境，确保你能链接到 `github`
- 注意查看重建时的信息提示
- 善用 **AI** 检查与解决错误
- **Nixos** 系统更新可能会导致部分软件的配置失效，所以可能更新时间较长，记得吃饭，饿肚子更新系统会显的很命苦
- 注意身体健康，按时睡觉，不要熬夜
