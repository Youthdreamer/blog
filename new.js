#!/usr/bin/env node
'use strict';

/* ============================================================
   new.js — 新文章向导（一问一答，create-next-app 风格，零依赖）
   逐项填写 frontmatter 全部字段，生成 content/posts/<slug>.md
   （合集名与已有文件夹同名时写进 content/posts/<合集名>/——文件夹即合集），
   然后自动启动开发服务器并在浏览器打开预览，直接开始写作。
   用法：node new.js   （或 pnpm run new）
   ============================================================ */

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const net = require('net');
const { execFile, spawn, spawnSync } = require('child_process');
const { PATHS, ROOT, SITE } = require('./lib/config');
const { slugify } = require('./lib/utils');
const { parseFrontmatter } = require('./lib/markdown');
// 归属规则与构建共用一套（文件夹即合集）：向导不自己再抄一份判断
const { listPostFiles, seriesOfPath, isPrivateDir, loadSeriesMeta } = require('./lib/content');

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

/* 启动开发服务器（前台：日志持续显示在当前终端，Ctrl+C 停止；
   编辑器在独立窗口，两个终端互不干扰） */
function startDev() {
  return spawn(process.execPath, ['dev.js'], {
    cwd: ROOT,
    stdio: 'inherit',
  });
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

/* 检测可用的终端模拟器：返回 [命令, ...前缀参数]；无则 null */
function detectTerminal() {
  const env = (process.env.TERMINAL || '').trim();
  if (env) {
    const parts = env.split(/\s+/);
    if (parts.length && hasBin(parts[0])) return parts;
  }
  const candidates = [
    ['kitty', '-e'],
    ['alacritty', '-e'],
    ['foot'],
    ['wezterm', 'start', '--'],
    ['gnome-terminal', '--'],
    ['konsole', '-e'],
    ['xterm', '-e'],
  ];
  for (const c of candidates) {
    if (hasBin(c[0])) return c;
  }
  return null;
}

/* 终端型编辑器（需要 TTY 的），GUI 编辑器不算 */
const TERM_EDITORS = new Set(['nvim', 'vim', 'vi', 'emacs', 'nano', 'micro']);

/* 打开编辑器：
   - 终端型编辑器：在独立终端窗口打开（不占用当前终端，dev 日志不受干扰）
   - GUI 编辑器（code）：直接启动 */
function openEditor(file) {
  const ed = resolveEditor();
  // 显示相对仓库根的路径：合集文件夹里的文章只报文件名会看不出在哪
  const shown = path.relative(ROOT, file).split(path.sep).join('/');
  if (!ed) {
    dim(`  · 未找到可用编辑器，请手动打开：${shown}`);
    return;
  }
  const bin = ed.cmd.split(/\s+/)[0];
  const isTerm = TERM_EDITORS.has(bin);

  if (isTerm) {
    const term = detectTerminal();
    if (!term) {
      dim(`  · 未找到终端模拟器，回退为当前终端打开 ${ed.cmd}（dev 日志可能混入画面）`);
    } else {
      const [tbin, ...targs] = term;
      const child = spawn(
        tbin,
        [...targs, 'sh', '-c', `cd "${ROOT}" && exec ${ed.cmd} "${file}"`],
        { detached: true, stdio: 'ignore' }
      );
      child.unref();
      say(`  · 已在新的终端窗口用 ${ed.cmd} 打开 ${shown}，dev 日志保持在当前终端`);
      return;
    }
  }

  const r = spawnSync(bin, [...ed.cmd.split(/\s+/).slice(1), file], { stdio: 'inherit' });
  if (r.error) {
    dim(`  · 编辑器启动失败（${bin}），请手动打开：${shown}`);
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
  series: '',
  seriesOrder: '',
  summary: '',
  minutes: '',
  draft: false,
  pin: false,
  toc: false,
  scoreBadge: false,
  cover: '',
  subject: '',
};

const FIELD_ORDER = [
  'title', 'slug', 'date', 'updated', 'tags', 'series', 'seriesOrder',
  'summary', 'minutes', 'draft', 'pin', 'toc', 'scoreBadge', 'cover', 'subject',
];
const FIELD_LABEL = {
  title: '标题',
  slug: '文件名',
  date: '日期',
  updated: '更新日期',
  tags: '标签',
  series: '合集',
  seriesOrder: '合集序号',
  summary: '摘要',
  minutes: '阅读时长',
  draft: '草稿',
  pin: '置顶',
  toc: '隐藏目录',
  scoreBadge: '隐藏卡片评分',
  cover: '封面',
  subject: '评分对象',
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
    dim('  · slug 是文件名末段，也是文章 URL：/post/<slug>.html（放进合集文件夹也不变）');
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
      say(`  ${C.gold}→${C.reset} ${v}.md · URL：/post/${v}.html`);
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
  if (key === 'series') {
    dim('  · 合集：同一部教程系列填同一个名字，合集页会按顺序把它们串成一条线');
    const menu = seriesMenu();
    if (menu.length) {
      dim('  · 输编号选已有，或直接输名字（新合集）：');
      menu.forEach((m, i) => {
        dim(`    ${i + 1}) ${m.name} · ${m.mdOnly ? 'series.md' : `${m.count} 篇`}`);
      });
      dim('    0) 新合集（再输一次名字） · 回车跳过');
    }
    while (true) {
      let v = await ask(`${num}合集（可空）`);
      if (!v) return;
      if (menu.length && v === '0') {
        v = await ask(`${num}新合集名（可空）`);
        if (!v) return;
      } else if (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= menu.length) {
        const picked = menu[Number(v) - 1];
        say(`  ${C.gold}→${C.reset} ${picked.name}`); // 回显选中的是谁（确认页还会再列）
        v = picked.name;
      }
      // 其余（含没命中的数字——纯数字的合集名让路给编号，见 seriesMenu）按手输走
      state.series = v;
      // 私用文件夹里的文章构建时不收，别把稿子写进黑洞
      const priv = listFolders().find((d) => d.trim() === state.series && isPrivateDir(d));
      if (priv) {
        dim(`  ✗ 「${priv}」以 _ 或 . 开头，是私用文件夹，里面的文章不会发布；请换个名字或留空`);
        continue;
      }
      const folder = findSeriesFolder(state.series);
      if (folder) {
        say(
          `  ${C.gold}→${C.reset} 写进 content/posts/${folder}/ ${C.dim}（文件夹即合集，frontmatter 不再写 series）${C.reset}`,
        );
      } else {
        dim('  · 没有同名文件夹：series: 会写进 frontmatter');
      }
      return;
    }
  }
  if (key === 'seriesOrder') {
    if (!state.series) {
      state.seriesOrder = '';
      dim('  · 未填合集，跳过');
      return;
    }
    while (true) {
      const v = await ask(`${num}合集序号（第几篇，可空=按日期）`);
      if (v === '') { state.seriesOrder = ''; return; }
      if (/^\d+$/.test(v) && Number(v) > 0) { state.seriesOrder = v; return; }
      dim('  ✗ 请输入正整数，或留空按日期自动排序');
    }
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
  if (key === 'scoreBadge') {
    dim('  · 正文里写了 ```score 评分卡的文章，列表卡片上会挂一枚评分徽标；y = 这篇不挂');
    state.scoreBadge = /^y/i.test(await ask(`${num}隐藏卡片评分？（y/N）`));
    return;
  }
  if (key === 'cover') {
    dim('  · 封面：评分墙上的海报图——md 同目录下的图片文件名（图放文章旁边），或完整的 http(s) 图片地址（图床外链）');
    state.cover = await ask(`${num}封面（可空）`);
    return;
  }
  if (key === 'subject') {
    dim('  · 评分对象：评分墙一行显示的条目名——标题带副题时写评价对象本身（如「星际穿越」），留空回退用标题');
    state.subject = await ask(`${num}评分对象（可空）`);
    return;
  }
}

/* 显示当前所有已填内容（确认页） */
function showState() {
  say('');
  say(`  ${C.gold}确认信息${C.reset} ${C.dim}${'─'.repeat(24)}${C.reset}`);
  FIELD_ORDER.forEach((k, i) => {
    let v;
    if (k === 'draft' || k === 'pin' || k === 'toc' || k === 'scoreBadge') v = state[k] ? '是' : '否';
    else if (k === 'tags') v = state.tags.join(', ');
    else if (k === 'minutes') v = state[k] || '自动';
    else v = state[k];
    const label = pad(FIELD_LABEL[k], 13); // 13 列：最宽的「隐藏卡片评分」占 12 列，留一列空格
    say(`  ${C.gold}№ ${String(i + 1).padStart(2, '0')}${C.reset}  ${label}${v || C.dim + '（空）' + C.reset}`);
  });
  say(`  ${C.dim}${'─'.repeat(28)}${C.reset}`);
  // 目标落点：合集名撞上已有文件夹就写进文件夹（文件夹即合集）；返回改任意一项后这里会跟着变
  const t = targetPath();
  say(
    `  ${C.gold}→${C.reset} content/posts/${t.rel} · URL：/post/${state.slug}.html` +
      (t.folder ? `  ${C.dim}（文件夹即合集，不写 series）${C.reset}` : ''),
  );
}

/* content/posts 下的顶层文件夹名（合集文件夹的候选；私用与否由调用方判） */
function listFolders() {
  return fs
    .readdirSync(PATHS.posts, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/* 合集的现有名单（第 06 问的编号菜单）。三个来源，都按构建同款归属规则收：
   · 文件夹（空文件夹也算——名字能与文件夹对上，文章就直接写进去）
   · 根下文章 frontmatter 在用的 series（文件夹里的文件归属文件夹，不看 frontmatter）
   · series.md 里露过面的名字（独有者标 mdOnly：写过去只会落 frontmatter）
   篇数照数（草稿也算）。排序同合集页：篇数降序、名字升序——mdOnly 的篇数为
   0，自然排在最后。纯数字的「合集名」在这里让路给编号（现实中不存在，不伺候） */
function seriesMenu() {
  const counts = new Map();
  for (const rel of listPostFiles()) {
    const at = seriesOfPath(rel);
    if (!at || at.error) continue;
    let name = at.series; // 文件夹优先（同 pickSeries）
    if (!name) {
      try {
        const { meta } = parseFrontmatter(fs.readFileSync(path.join(PATHS.posts, rel), 'utf8'));
        name = typeof meta.series === 'string' ? meta.series.trim() : '';
      } catch (e) { name = ''; }
    }
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  const names = new Map();
  for (const [n, c] of counts) names.set(n, c);
  for (const d of listFolders()) {
    const t = d.trim();
    if (t && !isPrivateDir(d) && !names.has(t)) names.set(t, 0);
  }
  const mdOnly = new Set();
  const { descs, pins } = loadSeriesMeta();
  for (const n of [...Object.keys(descs), ...pins]) {
    if (!names.has(n)) { names.set(n, 0); mdOnly.add(n); }
  }
  return [...names.entries()]
    .map(([name, count]) => ({ name, count, mdOnly: mdOnly.has(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* 合集名 → 该写进哪个文件夹（没有就空串）。与构建同一套归一：trim 后精确匹配 */
function findSeriesFolder(name) {
  if (!name) return '';
  return listFolders().find((d) => d.trim() === name) || '';
}

/* 目标落点。slug 是第 02 问、合集是第 06 问，确认页还能返回改任意一项——
   所以每次现算，不要缓存 */
function targetPath() {
  const name = findSeriesFolder(state.series);
  const folder = name && !isPrivateDir(name) ? name : '';
  const rel = `${folder ? folder + '/' : ''}${state.slug}.md`;
  return { folder, rel, abs: path.join(PATHS.posts, rel) };
}

/* slug 冲突检测：slug 是全局唯一的（URL 扁平），所以根下与各文件夹里都要查——
   向导放行、构建才 throw 就晚了。不参与构建的文件（非 .md、私用文件夹）不占 slug，
   判断直接问构建用的同一个 seriesOfPath，规则只有一份 */
function slugConflict(slug) {
  for (const rel of listPostFiles()) {
    if (!seriesOfPath(rel)) continue;
    const { meta } = parseFrontmatter(fs.readFileSync(path.join(PATHS.posts, rel), 'utf8'));
    if (path.basename(rel, '.md') === slug) return `已存在 ${rel}`;
    if (String(meta.slug || '').trim() === slug) {
      return `《${meta.title || rel}》的 frontmatter 已占用该 slug（${rel}）`;
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
  say('    series   合集名，同一部教程系列填同一个名字；把文章直接放进');
  say('             content/posts/<合集名>/ 文件夹也一样（文件夹即合集，此时不用写 series）');
  say('    series_order  第几篇（正整数），缺省按发布日期升序排');
  say('    summary  一句话摘要，显示在文章列表里');
  say('    minutes  手动阅读时长（正整数），缺省自动按字数估算');
  say('    draft    true=草稿不发布（本地 dev 预览下仍出单页）');
  say('    pin      true=置顶到列表最前');
  say('    toc      false=隐藏本文目录');
  say('    score_badge  false=列表卡片上不显示评分徽标（正文里的评分卡照常显示）');
  say('    cover    封面图：评分墙的海报——md 同目录下的相对路径，或完整图片 URL（图床外链）');
  say('    subject  评分墙的条目名（标题带副题时写评价对象本身，如 subject: 星际穿越）；缺省用标题');
  say('');
  say('  示例：');
  say('    ---');
  say('    title: 我的文章');
  say('    date: 2026-08-18');
  say('    slug: my-post');
  say('    updated: 2026-08-20');
  say('    tags: [NixOS, 配置]');
  say('    series: Neovim 入门');
  say('    series_order: 2');
  say('    summary: 一句话摘要');
  say('    minutes: 8');
  say('    draft: true');
  say('    pin: true');
  say('    toc: false');
  say('    score_badge: false');
  say('    cover: 海报.jpg');
  say('    subject: 星际穿越');
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

  /* 生成文件（保持干净，字段参考用 pnpm run fields 查看）。
     落点现算：上面可能刚改过 slug 或合集 */
  const t = targetPath();
  const lines = ['---', `title: ${state.title}`, `date: ${state.date}`];
  if (state.updated) lines.push(`updated: ${state.updated}`);
  if (state.tags.length) lines.push(`tags: [${state.tags.join(', ')}]`);
  // 写进合集文件夹就不写 series:（文件夹即合集）；series_order 单独判——文件夹里照样管用
  if (state.series && !t.folder) lines.push(`series: ${state.series}`);
  if (state.series && state.seriesOrder) lines.push(`series_order: ${state.seriesOrder}`);
  lines.push(`slug: ${state.slug}`);
  if (state.summary) lines.push(`summary: ${state.summary}`);
  if (state.minutes) lines.push(`minutes: ${state.minutes}`);
  if (state.draft) lines.push('draft: true');
  if (state.pin) lines.push('pin: true');
  if (state.toc) lines.push('toc: false');
  if (state.scoreBadge) lines.push('score_badge: false');
  if (state.cover) lines.push(`cover: ${state.cover}`);
  if (state.subject) lines.push(`subject: ${state.subject}`);
  lines.push('---', '', '');

  fs.writeFileSync(t.abs, lines.join('\n'));

  gold(`  ✓ 已创建 content/posts/${t.rel}`);
  if (t.folder) dim(`  · 「${t.folder}」这个文件夹就是那部合集，frontmatter 里无需 series:`);
  // 本地封面图要放在文章旁边才作数：没就位就提前说一声（不然只等构建期提醒）
  if (state.cover && !/^https?:\/\//i.test(state.cover)) {
    const img = path.resolve(path.dirname(t.abs), state.cover);
    if (!fs.existsSync(img)) {
      dim(
        `  · 封面图还没就位：把 ${state.cover} 放到 content/posts/${t.folder ? t.folder + '/' : ''}（评分墙才会出海报）`,
      );
    }
  }
  dim(`  · 可选字段：updated / tags / series / series_order / summary / minutes / draft / pin / toc / score_badge / cover / subject · 完整说明：pnpm run fields`);

  /* 询问是否立即打开编辑器：先告知将使用哪个编辑器（默认不打开，避免侵入） */
  const editor = resolveEditor();
  let openNow = false;
  if (editor) {
    const isTerm = TERM_EDITORS.has(editor.cmd.split(/\s+/)[0]);
    dim(`  · 将使用 ${editor.cmd} 打开${isTerm ? '（将在新的终端窗口打开，dev 日志保持在本终端）' : ''}（来源 ${editor.source}）`);
    openNow = /^y/i.test(await ask('打开编辑器开始写作？（y/N）'));
  } else {
    dim('  · 未找到可用编辑器（$VISUAL/$EDITOR 均未设置）');
  }
  rl.close();

  /* 启动 dev：确保在本终端前台运行——若端口被本博客旧 dev 占用，先停掉再重启 */
  let already = await isPortOpen(PORT);
  if (already) {
    const pid = Number(readPid());
    if (pid && isAlive(pid)) {
      dim(`  · 检测到旧开发服务器（PID ${pid}），先停止它，改为本终端前台运行…`);
      try { process.kill(pid, 'SIGTERM'); } catch (e) { /* 忽略 */ }
      for (let i = 0; i < 20 && (await isPortOpen(PORT)); i++) await sleep(300);
      already = await isPortOpen(PORT);
    }
  }
  let devChild = null;
  if (already) {
    dim(`  · 端口 ${PORT} 被其他进程占用（非本博客 dev），无法在本终端启动；仅打开预览与编辑器`);
  } else {
    say(`  → 启动开发服务器（前台运行，日志持续显示，Ctrl+C 停止）…`);
    devChild = startDev();
    const ready = await waitServer();
    if (!ready) {
      dim(`  ⚠ 开发服务器未能就绪，请手动运行 node dev.js 后访问 ${BASE}`);
      return;
    }
    const pid = readPid();
    say(`  → 开发服务器已就绪${pid ? `（PID ${pid}）` : ''}：${BASE} · 停止：Ctrl+C 或 pnpm run stop`);
  }

  /* 等待重建（250ms 防抖 + 构建），再打开页面。
     草稿不必再退回首页：dev 构建连草稿一起出单页（带草稿横幅），URL 与正式文章同构 */
  await sleep(1800);
  const url = `${BASE}/post/${state.slug}.html`;
  gold(`  → ${url}`);
  say('');
  openBrowser(url);

  /* 询问同意后再打开编辑器（终端编辑器在新窗口打开，GUI 编辑器直接启动） */
  if (openNow) {
    openEditor(t.abs);
  } else {
    dim(`  · 未打开编辑器，可直接编辑：content/posts/${t.rel}`);
  }

  /* 前台 dev：本终端即 dev 控制台，挂住直到 Ctrl+C（编辑器窗口独立不受影响） */
  if (devChild) {
    say('');
    dim('  · 开发服务器前台运行中——编辑保存即刷新浏览器；Ctrl+C 停止');
    await new Promise((resolve) => devChild.on('exit', resolve));
  }
}

/* 进程是否存活 */
function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
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
