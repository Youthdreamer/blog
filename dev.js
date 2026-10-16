#!/usr/bin/env node
'use strict';

/* ============================================================
   dev.js — 开发模式：构建 + 预览 + 监听 + 浏览器实时刷新

   用法：node dev.js   （或 pnpm run dev）
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
        // 开发模式：注入实时刷新脚本 + 草稿入口挂件（都只在服务时进页面，
        // 磁盘上的构建产物保持干净）
        body = data.toString().replace('</body>', RELOAD_SCRIPT + draftsWidget() + '</body>');
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

/* —— 草稿入口（build 的回值，见 lib/build.js）——
   草稿不进任何列表，本地总要有个随手可点的地方。入口一律走「服务时注入」，
   与热刷新脚本同一条路：构建产物里一个字都不加，浏览器里看到的正式页面
   与发布版逐字节一致——预览的正是将来发布的东西 */

let draftList = []; // 每次构建后刷新，服务时注入挂件用

/* 左下角小挂件：一颗「草稿 · N」胶囊，点开是可滚动的草稿清单（草稿多了也不怕）。
   标题进 JSON 再 escape 掉 <，免得 </script> 之类把注入的脚本截断 */
function draftsWidget() {
  if (!draftList.length) return "";
  const data = JSON.stringify(draftList).replace(/</g, "\\u003c");
  return `<style>
#__drafts{position:fixed;left:16px;bottom:16px;z-index:9999;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace}
#__drafts button{cursor:pointer;padding:5px 14px;border:1px solid rgba(185,163,124,.5);border-radius:999px;background:rgba(23,21,18,.94);color:#d8c39a;font:inherit;letter-spacing:.14em}
#__drafts button:hover{border-color:#d8c39a}
#__drafts ul{list-style:none;margin:0 0 8px;padding:8px 10px;max-height:50vh;overflow:auto;border:1px solid rgba(185,163,124,.35);border-radius:10px;background:rgba(18,16,14,.96);box-shadow:0 12px 40px rgba(0,0,0,.55)}
#__drafts li+li{margin-top:8px}
#__drafts a{color:#d8c39a;text-decoration:none;border-bottom:1px solid rgba(185,163,124,.35)}
#__drafts a:hover{color:#b9a37c}
#__drafts .d_slug{display:block;color:#6f695d;font-size:10px;letter-spacing:.08em;margin-top:2px}
</style>
<script>(function(){var ds=${data};
if(!ds.length)return;
var w=document.createElement('div');w.id='__drafts';
var b=document.createElement('button');b.type='button';b.textContent='草稿 · '+ds.length;
var u=document.createElement('ul');u.hidden=true;
ds.forEach(function(d){var li=document.createElement('li'),a=document.createElement('a'),s=document.createElement('span');
a.href='/post/'+d.slug+'.html';a.textContent=d.title;s.className='d_slug';s.textContent='/post/'+d.slug+'.html';
a.appendChild(s);li.appendChild(a);u.appendChild(li);});
b.addEventListener('click',function(){u.hidden=!u.hidden;});
w.appendChild(u);w.appendChild(b);document.body.appendChild(w);})();</script>`;
}

/* 终端里直接可点；草稿一多只列前六条，看全的走左下角挂件 */
function printDrafts(drafts) {
  const head = drafts.slice(0, 6);
  for (const d of head) {
    console.log(`[dev] 草稿入口：http://127.0.0.1:${PORT}/post/${d.slug}.html`);
  }
  if (drafts.length > head.length) {
    console.log(`[dev] 另有 ${drafts.length - head.length} 篇草稿：页面左下角的挂件里看全`);
  }
}

/* 首次构建。previewDrafts：草稿也出一张单页（带草稿横幅、noindex），
   本地才对得起「写完先看看」——一切列表口径不变，见 lib/build.js */
const initial = build({ previewDrafts: true });
draftList = initial.drafts;

/* 监听 + 防抖重建 */
let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      // 分割线：连续多次重建的日志之间清晰分界
      console.log('\n' + '─'.repeat(46) + '  ' + new Date().toLocaleTimeString());
      draftList = build({ previewDrafts: true }).drafts;
      printDrafts(draftList);
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

/* 记录 PID：便于 `pnpm run stop` 精确停止（避免留下看不见的后台进程） */
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
  console.log('[dev] 草稿预览：开 · draft: true 的文章照常出单页，不进任何列表');
  printDrafts(initial.drafts);
  console.log(`[dev] 停止：pnpm run stop（PID ${process.pid}）`);
});
