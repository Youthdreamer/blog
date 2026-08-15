#!/usr/bin/env node
/* ============================================================
   youth — 本地预览服务器（零依赖，Node 内置模块）
   用法：node serve.js        # 默认端口 8000
         PORT=9000 node serve.js
   ============================================================ */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'site');
const PORT = Number(process.env.PORT) || 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.normalize(path.join(ROOT, url === '/' ? 'index.html' : url));

  // 防目录穿越
  if (!file.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');

    fs.readFile(file, (err2, data) => {
      if (err2) {
        // 找不到就送出定制的 404 页
        fs.readFile(path.join(ROOT, '404.html'), (e3, notFound) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(e3 ? '404 Not Found' : notFound);
        });
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      });
      res.end(data);
    });
  });
});

server.listen(PORT, () => {
  console.log(`youth 博客已在 http://127.0.0.1:${PORT} 运行（Ctrl+C 停止）`);
});
