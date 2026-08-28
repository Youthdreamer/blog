---
title: MPD + ncmpcpp 极简安装与配置指南
date: 2026-08-27
tags: [mpd, ncmpcpp, 音乐播放器, 指南]
slug: mpd-ncmpcpp-guide
summary: 一份极简的 MPD + ncmpcpp 安装配置指南
---
本文将在 arch 上 安装 mpd 和 ncmpcpp 做演示

## 前言
听音乐，可以说是大部分人生活中必备的娱乐方式，甚至是生活习惯。那么我在平时编码时也会一直听歌。听歌的方式要么是在线流媒体，要么本地音乐播放。前者固然非常方便，但是会受限制于流媒体厂商。本地音乐就更自由些，但是麻烦的是音频文件需要自己去找。但是我认为这不是阻碍，毕竟这是一个海量信息的时代。有点类似于车载U盘，不是吗。

## 本地播放方案
那么既然选择了本地音乐播放，那么就应该合适的方式去实现。非常有名的 mpv 既可以播放视频也可以播放音乐，但是它没有界面，仅仅只是单纯的播放音乐，显然这只适合想随手播放歌曲听一听，简单但是纯粹。但是如果本地有大量歌曲，并需要长期管理，我觉得这就并不是适合了，所以我选择了经典组合 **mpd** 与 **ncmpcpp**。mpd 作为后台进程，ncmpcpp 作为前端显示，另外 ncmpcpp 是 TUI 这非常符合我的习惯。

## mpd 与 ncmpcpp 的安装(arch)

- 在 arch 上先安装音频服务，我个人推荐 pipewire
```bash 
  sudo pacman -S pipewire pipewire-pulse wireplumber
```
- 安装 mpd 与 ncmpcpp
```bash
sudo pacman -S mpd ncmpcpp
```
这里会有个询问，选择 **jack-pipewire** 的选项，如下图所示选择`2`
![jack选择](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-08/arch%E5%AE%89%E8%A3%85mpd%20%2B%20ncmpcpp.webp "依赖选择")

## 启动音乐服务

有多种启动服务的方式吗，这里我个人只推荐使用 systemd 用户服务启动。

- 启用并启动用户级 MPD 服务：
```bash
systemctl --user enable --now mpd
```

- 检查 MPD 服务状态：
```bash
systemctl --user status mpd
```

出现下图显示的状态就证明启动成功
![mpd服务检查](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-08/mpd%E6%9C%8D%E5%8A%A1%E5%90%AF%E5%8A%A8%E6%A3%80%E6%9F%A5.webp "mpd服务检查")

## mpd 与 ncmpcpp 配置

mpd 与 ncmpcpp 可配置的选项很多，这里我只给出最少可运行的配置，也是我目前正在使用的配置，非常简单。其实主要 mpd 的服务跑起来就基本成功。

> 关于 二者的 详细配置文档，我先放在这里。[mpd配置说明](https://mpd.readthedocs.io/en/stable/user.html#configuration) 与 [ncmpcpp配置说明](https://github.com/ncmpcpp/ncmpcpp/blob/master/doc/config)

想更深入的配置请查看官方文档编写。这里先说一下，二者的配置地址，分别为：

- **~/.config/mpd/mpd.conf**
- **~/.config/ncmpcpp/config**

这里展示我的配置:

- **mpd**
```config
# ~/.config/mpd/mpd.conf
music_directory    "~/music" # 指定 MPD 扫描音乐文件的根目录
audio_output {
    type    "pipewire"   # 或 "pulse"
    name    "My PipeWire Output"
}
auto_update    "yes"  # 开启音乐库自动更新功能。

```
- **ncmpcpp**
```config
# ~/.config/ncmpcpp/config
lyrics_directory=~/music # 置本地歌词文件的存储目录。
mpd_music_dir=~/music # 告诉 ncmpcpp，MPD 的音乐库根目录在哪里。
```

## 使用方式

之后的使用就方便了，只需要在自己设定的音乐文件目录中存放下载好的音乐，之后在终端中使用 `ncmpcpp` 命令，就可以打开 TUI 界面进行音乐播放管理等功能。

### 简单介绍一下 ncmpcpp 的使用
ncmpcpp 是一个强大的终端音乐播放器客户端，用于控制 MPD（Music Player Daemon）。启动后，你会看到一个分栏界面，使用以下按键可以在不同面板间切换：

| 按键 | 面板功能 |
|------|----------|
| `1`  | 当前播放列表 |
| `2`  | 文件浏览器（浏览音乐目录） |
| `3`  | 搜索 |
| `4`  | 媒体库（按艺术家/专辑等浏览） |
| `5`  | 播放列表管理器 |
| `6`  | 标签编辑器 |
| `7`  | 输出选择 |
| `=`  | 时钟显示 |


**基本播放控制：**

- `空格`：添加选中歌曲到播放列表（不打断当前播放）
- `回车`：立即播放选中歌曲
- `p`：播放/暂停
- `s`：停止
- `z`：切换随机播放
- `x`：切换交叉淡入淡出

**音量调节：**

- `+`：增大音量
- `-`：减小音量

**其他常用操作：**

- `u`：更新 MPD 音乐数据库（扫描新歌曲）
- `q`：退出 ncmpcpp
- `F1`：查看完整快捷键帮助

### 视频演示
![ncmpcpp视频演示](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-08/ncmpcpp%E6%BC%94%E7%A4%BA.mp4 "ncmpcpp视频演示")

## 其他的 mpd 前端推荐

- **rmpc**

![rmpc截图展示](https://cdn.jsdelivr.net/gh/youthdreamer/image-bed/blog-image/2026-08/rmpc.webp "rmpc截图展示")
