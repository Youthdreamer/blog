{
  description = "youth 博客 — 零依赖 Node 静态站";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {inherit system;};
      # 博客只用 Node 内置模块，任意现代 Node 均可；这里固定 Node 24
      node = pkgs.nodejs_24;
    in {
      # ── nix develop ── 开发环境：node + pnpm + git + imagemagick
      devShells.default = pkgs.mkShell {
        buildInputs = [
          node
          pkgs.pnpm # 脚本入口（零依赖，无 install 步骤）
          pkgs.git
          pkgs.imagemagick # 图片处理（图床压缩/分享图等）
        ];

        shellHook = ''
          echo ""
          echo "  youth 博客开发环境 · node $(node --version) · pnpm $(pnpm --version)"
          echo "  ───────────────────────────────────"
          echo "  pnpm run new      # 新文章向导（生成 + 预览 + 可选编辑）"
          echo "  pnpm run dev      # 开发模式（保存 .md 自动重建 + 浏览器刷新）"
          echo "  pnpm run build    # 一次性构建 → site/"
          echo "  pnpm run serve    # 静态预览"
          echo "  pnpm run stop     # 停止开发服务器"
          echo "  pnpm run fields   # frontmatter 字段参考"
          echo ""
        '';
      };

      # ── nix build ── 可复现地构建出纯静态站点（输出到 result/）
      packages.default = pkgs.stdenv.mkDerivation {
        pname = "youth-blog";
        version = "0.1.0";
        src = pkgs.lib.cleanSource self;
        buildInputs = [node];
        buildPhase = "node build.js";
        installPhase = ''
          mkdir -p "$out"
          cp -r site/. "$out/"
        '';
      };

      # ── nix run ── 直接启动开发服务器
      apps.dev = {
        type = "app";
        program = toString (pkgs.writeShellScript "youth-dev" ''
          cd ${self}
          ${node}/bin/node dev.js
        '');
      };
    });
}
