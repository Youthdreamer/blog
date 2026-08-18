#!/usr/bin/env node
'use strict';

/* ============================================================
   stop.js — 停止开发服务器（零依赖）
   按 .dev.pid 定位 dev.js 进程并发送 SIGTERM。
   用法：node stop.js   （或 npm run stop）
   ============================================================ */

const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '.dev.pid');

const pidText = fs.existsSync(PID_FILE) ? fs.readFileSync(PID_FILE, 'utf8').trim() : '';
const pid = Number(pidText);

if (!pid) {
  console.log('· 没有找到正在运行的开发服务器（无 .dev.pid 记录）');
  process.exit(0);
}

/* 探测进程是否还活着 */
try {
  process.kill(pid, 0);
} catch (e) {
  console.log(`· PID ${pid} 已不存在，清理记录`);
  try { fs.unlinkSync(PID_FILE); } catch (e2) { /* 忽略 */ }
  process.exit(0);
}

try {
  process.kill(pid, 'SIGTERM');
  console.log(`✓ 已向开发服务器（PID ${pid}）发送停止信号`);
} catch (e) {
  console.log(`✗ 停止失败：${e.message}`);
  process.exit(1);
}

/* 给 dev.js 一点时间清理 pid 文件 */
setTimeout(() => {
  try { fs.unlinkSync(PID_FILE); } catch (e) { /* dev.js 已自行删除 */ }
  console.log('· 开发服务器已停止');
}, 500);
