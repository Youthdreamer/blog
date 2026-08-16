#!/usr/bin/env node
/* ============================================================
   youth — 零依赖构建入口
   把 content/ 下的 Markdown 编译成 site/ 静态站点

   用法：node build.js
   实现拆分在 lib/ 目录下（config / utils / markdown / content / templates / build）
   ============================================================ */

'use strict';

require('./lib/build').build();
