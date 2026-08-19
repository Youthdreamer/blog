#!/usr/bin/env node
'use strict';

/* ============================================================
   new.js — 新文章向导（一问一答，create-next-app 风格，零依赖）
   逐项填写 frontmatter 全部字段，生成 content/posts/<slug>.md，
   然后自动启动开发服务器并在浏览器打开预览，直接开始写作。
   用法：node new.js   （或 pnpm run new）
   ============================================================ */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const net = require('net');
const { execFile, spawn, spawnSync } = require('child_process');
const { PATHS, ROOT, SITE } = require('./lib/config');
const { slugify } = require('./lib/utils');
const { parseFrontmatter } = require('./lib/markdown');

const PORT = Number(process.env.PORT) || 8000;
const BASE = `http://127.0.0.1:${PORT}`;
const CJK = /[\u4e00-\u9fa5]/;
const today = new Date().toISOString().slice(0, 10);

/* ---------- 终端配色（仅 TTY 时启用，管道输出保持纯净） ---------- */
const TTY = !!process.stdout.isTTY;
const C = {
  gold: TTY ? '\x1b[38;2;185;163;124m' : '', // 站点香槟金
  dim: TTY ? '\x1b[2m' : '',
  reset: TTY ? '\x1b[0m' : '',
};
const say = (msg) => console.log(msg);
const gold = (msg) => say(C.gold + msg + C.reset);
const dim = (msg) => say(C.dim + msg + C.reset);

/* 按显示宽度补空格（中文算 2 列，保证确认页对齐） */
function displayWidth(s) {
  return [...s].reduce((acc, c) => acc + (CJK.test(c) ? 2 : 1), 0);
}
function pad(s, n) {
  return s + ' '.repeat(Math.max(0, n - displayWidth(s)));
}

/* ---------- 行队列提问 ----------
   用 rl.setPrompt + rl.prompt 让 readline 自己管理提示符与行编辑：
   退格只删输入、提示符由 readline 重绘；每次回车后换行，历史问答留在屏幕上。
   'line' 事件在“无提问挂起”时会丢弃（管道一次性灌入时），故收到行先入队。 */
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lineQueue = [];
const waiters = [];

rl.on('line', (line) => {
  const w = waiters.shift();
  if (w) w(line);
  else lineQueue.push(line);
});

function ask(q, def) {
  return new Promise((resolve) => {
    const prompt = def !== undefined ? `${q} [${def}] ` : `${q} `;
    rl.setPrompt(prompt);
    rl.prompt();
    const finish = (line) =>
      resolve(line.replace(/[\r\n]+/g, '').trim() || def || '');
    const queued = lineQueue.shift();
    if (queued !== undefined) finish(queued);
    else waiters.push(finish);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 探测端口是否已被占用（dev 是否已在运行） */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

/* 启动开发服务器（detached，向导退出后继续运行） */
function startDev() {
  const dev = spawn(process.execPath, ['dev.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    detached: true,
  });
  dev.unref();
}

/* 等待开发服务器就绪 */
async function waitServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(PORT)) return true;
    await sleep(300);
  }
  return false;
}

/* 打开浏览器（跨平台，失败静默） */
function openBrowser(url) {
  const cmds =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  try { execFile(cmds[0], cmds[1], () => {}); } catch (e) { /* 忽略 */ }
}

/* 检查命令是否可用 */
function hasBin(bin) {
  try {
    const r = spawnSync(bin, ['--version'], { stdio: 'ignore', timeout: 3000 });
    return !r.error;
  } catch (e) {
    return false;
  }
}

/* 解析要用的编辑器：返回 { cmd, source }；无可用编辑器返回 null */
function resolveEditor() {
  if (process.env.VISUAL) return { cmd: process.env.VISUAL.trim(), source: '$VISUAL' };
  if (process.env.EDITOR) return { cmd: process.env.EDITOR.trim(), source: '$EDITOR' };
  for (const c of ['code', 'nvim', 'vim', 'vi']) {
    if (hasBin(c)) return { cmd: c, source: '自动检测' };
  }
  return null;
}

/* 自动打开编辑器：同步等待，终端型编辑器（nvim/vim）占用当前终端，
   关闭后向导继续；GUI 编辑器（code）会自行后台化快速返回 */
function openEditor(file) {
  const ed = resolveEditor();
  const name = file.split('/').pop();
  if (!ed) {
    dim(`  · 未找到可用编辑器，请手动打开：content/posts/${name}`);
    return;
  }
  const [bin, ...args] = ed.cmd.split(/\s+/);
  const r = spawnSync(bin, [...args, file], { stdio: 'inherit' });
  if (r.error) {
    dim(`  · 编辑器启动失败（${bin}），请手动打开：content/posts/${name}`);
  } else {
    say('  · 编辑器已关闭，保存的内容会自动刷新到浏览器预览');
  }
}

/* ---------- 表单状态与提问 ---------- */

const state = {
  title: '',
  slug: '',
  date: today,
  updated: '',
  tags: [],
  summary: '',
  minutes: '',
  draft: false,
  pin: false,
  toc: false,
};

const FIELD_ORDER = ['title', 'slug', 'date', 'updated', 'tags', 'summary', 'minutes', 'draft', 'pin', 'toc'];
const FIELD_LABEL = {
  title: '标题',
  slug: '文件名',
  date: '日期',
  updated: '更新日期',
  tags: '标签',
  summary: '摘要',
  minutes: '阅读时长',
  draft: '草稿',
  pin: '置顶',
  toc: '隐藏目录',
};

const fieldNum = (key) => FIELD_ORDER.indexOf(key) + 1;

/* 逐个提问某个字段；校验不过就重复问 */
async function askField(key) {
  const num = `${C.gold}${String(fieldNum(key)).padStart(2, '0')}${C.reset}${C.dim}/${FIELD_ORDER.length}${C.reset} `;
  if (key === 'title') {
    while (true) {
      const v = await ask(`${num}标题`);
      if (v) { state.title = v; return; }
      dim('  ✗ 标题不能为空');
    }
  }
  if (key === 'slug') {
    const auto = slugify(state.title);
    if (CJK.test(state.title)) {
      dim('  · 标题含中文，建议用拉丁字符 slug（避免中文文件名/URL）');
    }
    dim('  · slug 就是文件名：content/posts/<slug>.md，文章 URL 为 /post/<slug>.html');
    let offered = false; // 冲突重问时不再默认填入被占用的 slug
    while (true) {
      const def = offered ? undefined : auto || undefined;
      offered = true;
      const v = slugify(await ask(`${num}文件名`, def));
      if (!v) {
        dim('  ✗ 文件名不能为空');
        continue;
      }
      const conflict = slugConflict(v);
      if (conflict) {
        dim(`  ✗ 文件名「${v}」已被占用（${conflict}），不会覆盖，请换一个`);
        continue;
      }
      state.slug = v;
      say(`  ${C.gold}→${C.reset} content/posts/${v}.md · URL：/post/${v}.html`);
      return;
    }
  }
  if (key === 'date') {
    while (true) {
      const v = await ask(`${num}日期`, today);
      if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime())) {
        state.date = v;
        return;
      }
      dim('  ✗ 日期格式应为 YYYY-MM-DD');
    }
  }
  if (key === 'updated') {
    while (true) {
      const v = await ask(`${num}更新日期（可空，留空不显示"更新于"）`);
      if (v === '') { state.updated = ''; return; }
      if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime())) {
        state.updated = v;
        return;
      }
      dim('  ✗ 日期格式应为 YYYY-MM-DD');
    }
  }
  if (key === 'tags') {
    const raw = await ask(`${num}标签（空格分隔，可空）`);
    state.tags = raw
      ? raw.split(/[\s,，、]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    return;
  }
  if (key === 'summary') {
    state.summary = await ask(`${num}摘要（一句话，可空）`);
    return;
  }
  if (key === 'minutes') {
    while (true) {
      const v = await ask(`${num}阅读时长（分钟，可空=自动估算）`);
      if (v === '') { state.minutes = ''; return; }
      if (/^\d+$/.test(v) && Number(v) > 0) { state.minutes = v; return; }
      dim('  ✗ 请输入正整数，或留空自动估算');
    }
  }
  if (key === 'draft') {
    state.draft = /^y/i.test(await ask(`${num}草稿？（y/N）`));
    return;
  }
  if (key === 'pin') {
    state.pin = /^y/i.test(await ask(`${num}置顶？（y/N）`));
    return;
  }
  if (key === 'toc') {
    state.toc = /^y/i.test(await ask(`${num}隐藏目录？（y/N）`));
    return;
  }
}

/* 显示当前所有已填内容（确认页） */
function showState() {
  say('');
  say(`  ${C.gold}确认信息${C.reset} ${C.dim}${'─'.repeat(24)}${C.reset}`);
  FIELD_ORDER.forEach((k, i) => {
    let v;
    if (k === 'draft' || k === 'pin' || k === 'toc') v = state[k] ? '是' : '否';
    else if (k === 'tags') v = state.tags.join(', ');
    else if (k === 'minutes') v = state[k] || '自动';
    else v = state[k];
    const label = pad(FIELD_LABEL[k], 10);
    say(`  ${C.gold}№ ${String(i + 1).padStart(2, '0')}${C.reset}  ${label}${v || C.dim + '（空）' + C.reset}`);
  });
  say(`  ${C.dim}${'─'.repeat(28)}${C.reset}`);
}

/* 目标文件是否存在（重名保护） */
function fileExists() {
  return fs.existsSync(path.join(PATHS.posts, `${state.slug}.md`));
}

/* slug 冲突检测：同名文件，或 frontmatter 里已存在相同 slug 的其他文件
   返回冲突说明（无冲突返回空串） */
function slugConflict(slug) {
  const file = path.join(PATHS.posts, `${slug}.md`);
  if (fs.existsSync(file)) return `已存在 ${slug}.md`;
  for (const f of fs.readdirSync(PATHS.posts)) {
    if (!f.endsWith('.md')) continue;
    const { meta } = parseFrontmatter(fs.readFileSync(path.join(PATHS.posts, f), 'utf8'));
    if (meta.slug === slug && f !== `${slug}.md`) {
      return `《${meta.title || f}》的 frontmatter 已占用该 slug`;
    }
  }
  return '';
}

/* 字段参考（pnpm run fields / node new.js --fields） */
function printFields() {
  say('');
  gold('  ◇ frontmatter 字段参考');
  dim(`  ${'─'.repeat(26)}`);
  say('');
  say(`  ${C.gold}必填${C.reset}`);
  say('    title    文章标题');
  say('    date     发布日期（YYYY-MM-DD）');
  say('    slug     文件名 / URL（/post/<slug>.html）');
  say('');
  say(`  ${C.gold}可选（不写即缺省）${C.reset}`);
  say('    updated  最后更新日期（YYYY-MM-DD），文章页显示"更新于"');
  say('    tags     标签，如 [NixOS, 配置]（英文逗号分隔）');
  say('    summary  一句话摘要，显示在文章列表里');
  say('    minutes  手动阅读时长（正整数），缺省自动按字数估算');
  say('    draft    true=草稿不发布');
  say('    pin      true=置顶到列表最前');
  say('    toc      false=隐藏本文目录');
  say('');
  say('  示例：');
  say('    ---');
  say('    title: 我的文章');
  say('    date: 2026-08-18');
  say('    slug: my-post');
  say('    updated: 2026-08-20');
  say('    tags: [NixOS, 配置]');
  say('    summary: 一句话摘要');
  say('    minutes: 8');
  say('    draft: true');
  say('    pin: true');
  say('    toc: false');
  say('    ---');
  say('');
}

async function main() {
  say('');
  gold(`  ◇ ${SITE.name} · 新文章向导`);
  dim(`  ${'─'.repeat(28)}`);
  say('');

  /* 第一轮：逐个提问 */
  for (const k of FIELD_ORDER) await askField(k);

  /* 确认页：可回看、可输入编号返回修改；确认时做重名保护 */
  while (true) {
    showState();
    const ans = await ask('回车确认生成，或输入编号修改', '确认');
    if (ans === '' || ans === '确认' || /^y/i.test(ans)) {
      /* 重名保护：绝不覆盖已有文件（slug 输入时已查，此处兜底） */
      const conflict = slugConflict(state.slug);
      if (conflict) {
        dim(`  ✗ slug「${state.slug}」已被占用（${conflict}），不会覆盖`);
        dim('  · 请重新输入 slug（Ctrl+C 可取消）');
        state.slug = '';
        await askField('slug');
        continue;
      }
      break;
    }
    const n = Number(ans);
    if (Number.isInteger(n) && n >= 1 && n <= FIELD_ORDER.length) {
      await askField(FIELD_ORDER[n - 1]);
    } else {
      dim(`  · 请输入 1-${FIELD_ORDER.length} 修改对应项，或直接回车确认`);
    }
  }

  /* 生成文件（保持干净，字段参考用 pnpm run fields 查看） */
  const lines = ['---', `title: ${state.title}`, `date: ${state.date}`];
  if (state.updated) lines.push(`updated: ${state.updated}`);
  if (state.tags.length) lines.push(`tags: [${state.tags.join(', ')}]`);
  lines.push(`slug: ${state.slug}`);
  if (state.summary) lines.push(`summary: ${state.summary}`);
  if (state.minutes) lines.push(`minutes: ${state.minutes}`);
  if (state.draft) lines.push('draft: true');
  if (state.pin) lines.push('pin: true');
  if (state.toc) lines.push('toc: false');
  lines.push('---', '', '');

  fs.writeFileSync(path.join(PATHS.posts, `${state.slug}.md`), lines.join('\n'));

  gold(`  ✓ 已创建 content/posts/${state.slug}.md`);
  dim(`  · 可选字段：updated / tags / summary / minutes / draft / pin / toc · 完整说明：pnpm run fields`);

  /* 询问是否立即打开编辑器：先告知将使用哪个编辑器（默认不打开，避免侵入） */
  const editor = resolveEditor();
  let openNow = false;
  if (editor) {
    dim(`  · 将使用 ${editor.cmd} 打开（来源 ${editor.source}）`);
    openNow = /^y/i.test(await ask('打开编辑器开始写作？（y/N）'));
  } else {
    dim('  · 未找到可用编辑器（$VISUAL/$EDITOR 均未设置）');
  }
  rl.close();

  /* 启动 dev（若未在运行）并等待就绪；无论哪种情况都汇报 PID 与停止方式 */
  const already = await isPortOpen(PORT);
  if (already) {
    const pid = readPid();
    dim(`  · 开发服务器已在运行${pid ? `（PID ${pid}）` : ''}：${BASE} · 停止：pnpm run stop`);
  } else {
    say(`  → 正在启动开发服务器…`);
    startDev();
    const ready = await waitServer();
    if (!ready) {
      dim(`  ⚠ 开发服务器未能就绪，请手动运行 node dev.js 后访问 ${BASE}`);
      return;
    }
    const pid = readPid();
    say(`  → 开发服务器已在后台启动${pid ? `（PID ${pid}）` : ''}：${BASE} · 停止：pnpm run stop`);
  }

  /* 等待重建（250ms 防抖 + 构建），再打开页面 */
  await sleep(1800);
  const url = state.draft ? `${BASE}/` : `${BASE}/post/${state.slug}.html`;
  gold(`  → ${url}`);
  say('');
  openBrowser(url);

  /* 询问同意后再打开编辑器，直接开始写作 */
  if (openNow) {
    openEditor(path.join(PATHS.posts, `${state.slug}.md`));
  } else {
    dim(`  · 未打开编辑器，可直接编辑：content/posts/${state.slug}.md`);
  }
}

/* 读取 dev.js 写入的 PID 记录（.dev.pid） */
function readPid() {
  const f = path.join(ROOT, '.dev.pid');
  try {
    return fs.readFileSync(f, 'utf8').trim() || '';
  } catch (e) {
    return '';
  }
}

/* 支持 --fields / -h：打印字段参考后直接退出 */
if (process.argv.includes('--fields') || process.argv.includes('-h')) {
  printFields();
  process.exit(0);
}

main().catch((e) => {
  console.error('  ✗ 出错了：', e.message);
  process.exit(1);
});
