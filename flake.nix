{
  description = "youth 博客 — 零依赖 Node 静态站（半山居）";

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
      # 博客只用 Node 内置模块，任意现代 Node 均可；如需匹配本机 Node 24 可改为 pkgs.nodejs_24
      node = pkgs.nodejs_24;
    in {
      # ── nix develop ── 进入开发环境（node + git）
      devShells.default = pkgs.mkShell {
        buildInputs = [node pkgs.git];

        shellHook = ''
          echo ""
          echo "  youth 博客开发环境 · node $(node --version)"
          echo "  ─────────────────────────────"
          echo "  node build.js    # 一次性构建 → site/"
          echo "  node dev.js      # 开发模式（保存 .md 自动重建 + 浏览器刷新）"
          echo "  node serve.js    # 静态预览"
          echo ""
        '';
      };

      # ── nix build ── 可复现地构建出纯静态站点（输出到 result/）
      packages.default = pkgs.stdenv.mkDerivation {
        pname = "youth-blog";
        version = "0.0.1";
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
