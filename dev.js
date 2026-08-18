#!/usr/bin/env node
'use strict';

/* ============================================================
   dev.js — 开发模式：构建 + 预览 + 监听 + 浏览器实时刷新

   用法：node dev.js   （或 npm run dev）
   编辑 content/ 下的 .md 或 assets/ 下的样式/脚本，保存后
   自动重新构建，并让浏览器自动刷新。
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { build } = require('./lib/build');
const { PATHS, ROOT } = require('./lib/config');

const PORT = Number(process.env.PORT) || 8000;
const SITE = PATHS.out;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/* 注入到 HTML 里的实时刷新脚本（仅开发模式） */
const RELOAD_SCRIPT =
  '<script>(function(){try{var s=new EventSource("/__reload");s.onmessage=function(){location.reload()}}catch(e){}})();</script>';

const clients = new Set();

function broadcast() {
  for (const res of clients) {
    try { res.write('data: reload\n\n'); } catch (e) { clients.delete(res); }
  }
}

function serveFile(res, urlPath) {
  let file = path.normalize(path.join(SITE, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(SITE)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err2, data) => {
      if (err2) {
        fs.readFile(path.join(SITE, '404.html'), (e3, notFound) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(e3 ? '404 Not Found' : notFound);
        });
        return;
      }
      const ext = path.extname(file);
      let body = data;
      if (ext === '.html') {
        // 开发模式：注入实时刷新脚本
        body = data.toString().replace('</body>', RELOAD_SCRIPT + '</body>');
      }
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(body);
    });
  });
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);

  // 实时刷新：SSE 长连接
  if (url === '/__reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  serveFile(res, url);
});

/* 首次构建 */
build();

/* 监听 + 防抖重建 */
let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      build();
      broadcast();
      console.log(`[dev] ✓ 已重新构建 ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      console.error(`[dev] ✗ 构建失败：${e.message}`);
    }
  }, 250);
}

for (const dir of [PATHS.content, PATHS.assets]) {
  try {
    fs.watch(dir, { recursive: true }, schedule);
    console.log(`[dev] 监听 ${dir}`);
  } catch (e) {
    console.warn(`[dev] 无法递归监听 ${dir}：${e.message}`);
  }
}

/* 记录 PID：便于 `npm run stop` 精确停止（避免留下看不见的后台进程） */
const PID_FILE = path.join(ROOT, '.dev.pid');
try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch (e) { /* 忽略 */ }
process.on('SIGINT', () => { cleanupPid(); process.exit(0); });
process.on('SIGTERM', () => { cleanupPid(); process.exit(0); });
process.on('exit', cleanupPid);
function cleanupPid() {
  try { fs.unlinkSync(PID_FILE); } catch (e) { /* 已删除则忽略 */ }
}

server.listen(PORT, () => {
  console.log(`[dev] 开发服务器已启动 → http://127.0.0.1:${PORT}`);
  console.log('[dev] 编辑 content/ 或 assets/ 下的文件，保存后浏览器自动刷新');
  console.log(`[dev] 停止：npm run stop（PID ${process.pid}）`);
});
