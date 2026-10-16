"use strict";

/* 读取 content/ 下的文章与页面 */

const fs = require("fs");
const path = require("path");
const { PATHS } = require("./config");
const { formatDate, readMinutes } = require("./utils");
const { mdToHtml, parseFrontmatter, fmtScore } = require("./markdown");

/* content/posts 下所有文件的相对路径（正斜杠，含子文件夹）。
   枚举只管「有哪些文件」；其中一个路径算不算文章、归哪部合集，交给 seriesOfPath 判 */
function listPostFiles(dir = PATHS.posts, prefix = "") {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) out.push(...listPostFiles(path.join(dir, ent.name), rel));
    else out.push(rel);
  }
  return out;
}

/* 私用文件夹：`_` 或 `.` 开头（草稿、素材、杂物）。规则只写在这里一处，
   构建与 new.js 向导都问它——两处各写一份正则迟早抄歪 */
const isPrivateDir = (name) => name.startsWith("_") || name.startsWith(".");

/* 相对路径 → 归属（纯函数，导出供 scripts/test-posts.js 断言——同 fmtScore 的道理）。
   文件夹即合集：content/posts/个人影评/interstellar.md 属于「个人影评」，不必写 series。
   返回 null = 不是文章 / 私用文件夹（安静跳过）；{ series } 是合集名（根下的文章为空串，
   回退看 frontmatter）；{ error } 是结构有问题，调用方提醒后跳过（不静默丢文章）。
   只认一层文件夹；`_` 和 `.` 开头的文件夹留作私用——文件夹是新约定，这么定不会误伤
   已有内容（根下叫 `_foo.md` 的**文件**照旧发布，只有文件夹吃这条规矩） */
function seriesOfPath(relPath) {
  const parts = relPath.split("/").filter((s) => s && s !== ".");
  const file = parts.pop();
  if (!file || !file.endsWith(".md")) return null;
  if (!parts.length) return { series: "" };
  if (isPrivateDir(parts[0])) return null;
  if (parts.length > 1) {
    return { error: "在两层以上的文件夹里，只认一层（文件夹名 = 合集名）" };
  }
  return { series: parts[0].trim() };
}

/* 文件夹与 frontmatter 都说了合集名时：文件夹优先（Next 式约定的核心）。
   两者一致就不吭声——「搬进文件夹了，series: 行还没删」是迁移中的正常状态，
   不该为它刷屏；真的不一致才提醒，且以文件夹为准 */
function pickSeries(folderSeries, metaSeries) {
  if (!folderSeries) return { series: metaSeries, warn: "" };
  if (metaSeries && metaSeries !== folderSeries) {
    return {
      series: folderSeries,
      warn: `frontmatter 的 series: ${metaSeries} 与文件夹名不一致，以文件夹为准`,
    };
  }
  return { series: folderSeries, warn: "" };
}

/* 正文里的站内链接改写：`[他](./另一篇.md)` → `[他](另一篇.html)`。
   写文件名是作者最顺手的写法，但文章实际住在 /post/<slug>.html，解析器不认得
   这层关系——改写之后，悬停预览（只认 .html）与点击跳转才都接得上。
   目标按文件名找（frontmatter 的 slug 覆盖文件名时，按真实 slug 改写）；
   找不到、指向草稿、或对上了多篇同名文章时，原样留下并提醒一句：链接会 404，
   但构建日志里说得清楚，好过悄悄断在半路。
   只动相对路径（./x.md、sub/x.md）；外链、/ 开头的绝对路径、纯 #锚点都不碰。
   文章正文只渲染在 /post/ 下的文章页，改写出的相对链接从当前页起算正好，
   与文章页本身的上一页/下一页链接（lib/views.js）同一种写法 */
function resolveMdLinks(html, byName, post) {
  return html.replace(/<a href="([^"]*)"/g, (whole, url) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url)) return whole; // 外链（含 mailto: 之类）不动
    // 末尾是 .md（可带 #锚点 / ?查询）才算站内文章链接
    const m = url.match(/^([^\/#?][^"#?]*)\.md((?:[#?].*)?)$/);
    if (!m) return whole;
    const name = m[1].split("/").pop(); // 只认文件名：URL 是扁平的，文件夹信息无用
    const hit = (byName.get(name) || []).filter((h) => !h.draft);
    if (!hit.length) {
      const draft = (byName.get(name) || [])[0];
      console.warn(
        `[build] 警告：《${post.title}》里的链接 ${url} ` +
          (draft ? `指向的《${draft.title}》还是草稿，链接保持原样` : "找不到对应的文章，链接保持原样"),
      );
      return whole;
    }
    if (hit.length > 1) {
      console.warn(
        `[build] 警告：《${post.title}》里的链接 ${url} 对上了多篇同名文章` +
          `（${hit.map((h) => h.title).join("、")}），链接保持原样`,
      );
      return whole;
    }
    return `<a href="${hit[0].slug}.html${m[2]}"`;
  });
}

/* base 缺省就是 content/posts；留这个参数是为了测试能在临时目录里造一棵树跑全流程。
   opts.includeDrafts 只给本地预览构建（dev.js）用：草稿带 draft: true 一起返回，
   由调用方（lib/build.js）分流；生产构建走缺省值，看到的数组与从前逐字节一致 */
function loadPosts(base = PATHS.posts, opts = {}) {
  const trimWarned = new Set(); // 文件夹名空白的提醒，一个文件夹只说一次
  const byName = new Map(); // 文件名 → 文章（可能多篇同名），正文链接改写用（见 resolveMdLinks）
  const posts = listPostFiles(base)
    .map((rel) => {
      const at = seriesOfPath(rel);
      if (!at) return null; // 不是 .md，或 _/. 开头的私用文件夹
      if (at.error) {
        console.warn(`[build] 警告：content/posts/${rel} ${at.error}，已跳过`);
        return null;
      }
      // 文件夹名首尾有空白（含全角空格）：合集名按 trim 后的算，提醒一声——
      // 不然「个人影评 」与「个人影评」会静默并成一部合集，series.md 的简介也悄悄失联
      const rawDir = rel.includes("/") ? rel.slice(0, rel.indexOf("/")) : "";
      if (rawDir && rawDir !== at.series && !trimWarned.has(rawDir)) {
        trimWarned.add(rawDir);
        console.warn(
          `[build] 警告：文件夹「${rawDir}」名字首尾有空白，按「${at.series}」当合集名（建议重命名文件夹）`,
        );
      }
      const { meta, body } = parseFrontmatter(
        fs.readFileSync(path.join(base, rel), "utf8"),
      );
      const fileBase = path.basename(rel, ".md");
      const title = meta.title || fileBase;
      // 中文文件名且未写 slug → 仅提醒（不阻断），避免生成中文编码 URL
      if (!meta.slug && /[\u4e00-\u9fa5]/.test(fileBase)) {
        console.warn(
          `[build] 警告：《${title}》文件名含中文且未写 slug，URL 将含中文编码；建议加 \`slug: my-post\``,
        );
      }
      // slug 默认取自文件名（文件系统本就保证唯一）；显式 slug 仅作为可读覆盖。
      // 必须保持扁平：文章 URL 是 /post/<slug>.html，文件夹只决定合集归属、不进 URL
      const slug = String(meta.slug || fileBase).trim();
      if (/[\\/]/.test(slug)) {
        throw new Error(
          `[build] slug 不能含斜杠：“${slug}”（content/posts/${rel}）\n` +
            `  文章 URL 一律是扁平的 /post/<slug>.html；合集归属交给文件夹，别把文件夹写进 slug。`,
        );
      }
      // 登记「文件名 → 文章」。草稿也登记：正文里链到未发布的文章时，
      // 提醒才说得清是「草稿」还是「根本没这篇」（见 resolveMdLinks）
      const same = byName.get(fileBase) || [];
      same.push({ slug, title, draft: !!meta.draft });
      byName.set(fileBase, same);
      // 合集归属：文件夹说了算，根下的文章才回退到 frontmatter（不一致时提醒，不阻断）
      const metaSeries = typeof meta.series === "string" ? meta.series.trim() : "";
      const { series, warn } = pickSeries(at.series, metaSeries);
      if (warn) console.warn(`[build] 警告：《${title}》在「${at.series}」文件夹里，${warn}`);
      // 传标题进去：评分卡的构建期提醒要能指名道姓是哪一篇
      const { html, headings, score } = mdToHtml(body, { title });
      // 评分数据（正文里有评分卡就有）：两个数先格式化好（8.50 → 8.5），
      // 视图层拿到的就是能直接写进页面的文本——列表徽标与评分墙共用这一份。
      // 挂不挂徽标是另一回事（hideScoreBadge），评分墙不受它影响；
      // note 是评分卡里那句评语，评分墙把它当条目下的一行短评（可能为空串）
      const scoreData = score
        ? { value: fmtScore(score.value), max: fmtScore(score.max), note: score.note || "" }
        : null;
      // 草稿不发布。放在这里才跳：上面的解析期提醒照发，跟「先 map 再 filter」的旧行为一致。
      // 预览构建（opts.includeDrafts，见 dev.js）不跳：草稿带 draft: true 返回——
      // 分流交给 lib/build.js，那边一切列表照样只吃非草稿
      if (meta.draft && !opts.includeDrafts) return null;
      // 封面（可选）：写 md 同目录的相对路径（cover: poster.jpg），评分墙拿它当海报。
      // 构建期拷到 img/<slug>.<ext>——输出目录是扁平的，重名由 slug 兜住。
      // 也可以直接写完整 URL（图床外链）：原样当 src 用，不拷贝、构建期也不校验
      // （远端什么时候挂管不着，那就不是构建期能拦的事）。
      // 本地文件不在就提醒一声当没写：封面是可选字段，不该为一个笔误让构建倒下
      let coverSrc = null;
      let cover = null;
      const coverRaw = typeof meta.cover === "string" ? meta.cover.trim() : "";
      if (/^https?:\/\//i.test(coverRaw)) {
        cover = coverRaw;
      } else if (coverRaw) {
        const src = path.resolve(path.dirname(path.join(base, rel)), coverRaw);
        if (fs.existsSync(src) && fs.statSync(src).isFile()) {
          coverSrc = src;
          cover = `img/${slug}${path.extname(src).toLowerCase()}`;
        } else {
          console.warn(
            `[build] 警告：《${title}》的封面找不到：${coverRaw}` +
              `（本地图放 content/posts/${rel} 旁边，或直接写 http(s):// 图片地址）`,
          );
        }
      }
      // 评分对象（可选）：条目名——标题常带副题（「星际穿越——跨越时空的是爱」），
      // 而评分墙一行要的是对象本身。归一成字符串（空串 = 没写），
      // 缺省由视图回退到标题（见 lib/views.js 的 scoreItem）
      const subject = typeof meta.subject === "string" ? meta.subject.trim() : "";
      return {
        ...meta,
        file: rel, // 相对 content/posts 的路径，slug 冲突报错时一眼看出是谁
        slug, // 上面已算好，含「不能含 /」的兜底
        body,
        html,
        headings,
        subject, // 放在 ...meta 之后：subject: true 之类的写法归一成空串，不落到视图里
        score: scoreData,
        // 封面：cover 是视图直接当 src 用的地址——本地图是站内输出路径
        // （img/<slug>.<ext>），外链就是原样的 URL；coverSrc 只有本地图才有
        // （源文件绝对路径），构建期照它拷贝（lib/build.js）
        cover,
        coverSrc,
        // score_badge: false —— 只收列表徽标（首页/标签/合集的小评分角标），
        // 正文里的评分卡与评分墙照旧
        hideScoreBadge: meta.score_badge === false,
        // 阅读时长：frontmatter 可手动指定（minutes: 5），否则按字数自动估算
        minutes: meta.minutes ? Number(meta.minutes) : readMinutes(body),
        // 合集（可选）：series 是合集名（文件夹优先，见 pickSeries）；
        // series_order 写的是第几篇，归一化成数字（0 = 没指定，按日期排）。
        // 解析器给出的是字符串，别直接拿去比较
        series,
        seriesOrder:
          Number.isInteger(Number(meta.series_order)) && Number(meta.series_order) > 0
            ? Number(meta.series_order)
            : 0,
        dateISO: meta.date
          ? new Date(meta.date).toISOString().slice(0, 10)
          : "",
        dateText: meta.date ? formatDate(meta.date) : "",
        // 更新日期（可选）：显示"更新于"，并作为 JSON-LD 的 dateModified
        updatedISO: meta.updated
          ? new Date(meta.updated).toISOString().slice(0, 10)
          : "",
        updatedText: meta.updated ? formatDate(meta.updated) : "",
      };
    })
    .filter(Boolean); // 前半段返回的 null（非文章 / 私用文件夹 / 草稿）在这里滤掉

  // slug 唯一性校验（默认只校验收进来的文章；预览构建连草稿一起收，冲突提前暴露）
  const seen = new Map();
  for (const p of posts) {
    if (seen.has(p.slug)) {
      const q = seen.get(p.slug);
      throw new Error(
        `[build] slug 冲突："${p.slug}"\n` +
          `  1) ${q.file} → 《${q.title}》\n` +
          `  2) ${p.file} → 《${p.title}》\n` +
          `  请修改其中一篇的 frontmatter slug，或重命名文件后重新构建。`,
      );
    }
    seen.set(p.slug, p);
  }

  // 正文里的 .md 站内链接 → 文章 URL（见 resolveMdLinks）。
  // 要等全部文章（连同草稿）都登记进 byName 之后才能做，故放在这里
  for (const p of posts) p.html = resolveMdLinks(p.html, byName, p);

  // 置顶优先，同层按日期倒序
  return posts.sort((a, b) => {
    if (!!a.pin !== !!b.pin) return a.pin ? -1 : 1;
    return a.dateISO < b.dateISO ? 1 : -1;
  });
}

/* 合集简介与置顶（可选）：content/series.md，一行一部合集，「合集名: 简介」。
   名字与文章 frontmatter 的 series 原样对应（对不上的由构建期提醒）；
   空行与 # 开头的行忽略；只在第一个冒号处切分，简介里再出现冒号也不受影响。

   置顶另起一行写「pin: 合集名」（写多行就置顶多部，按书写顺序排在最前）。
   和文章 frontmatter 的 pin 同一个词、同一个意思；没有简介的合集也能置顶，
   简介与置顶因此共用这一个文件，但彼此独立 */
function loadSeriesMeta() {
  const descs = {};
  const pins = [];
  if (!fs.existsSync(PATHS.series)) return { descs, pins };
  for (const line of fs.readFileSync(PATHS.series, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const m = s.match(/^([^:：]+)[:：]\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim();
    if (key === "pin" || key === "置顶") { // 指令行，不是合集名
      if (!pins.includes(val)) pins.push(val);
      continue;
    }
    descs[key] = val;
  }
  return { descs, pins };
}

function loadPages() {
  const out = {};
  for (const [file, key] of [
    ["about.md", "about"],
    ["404.md", "404"],
  ]) {
    const { meta, body } = parseFrontmatter(
      fs.readFileSync(path.join(PATHS.pages, file), "utf8"),
    );
    const { html } = mdToHtml(body, { title: meta.title || file });
    out[key] = { ...meta, html };
  }
  return out;
}

module.exports = {
  loadPosts,
  loadPages,
  loadSeriesMeta,
  listPostFiles,
  seriesOfPath,
  pickSeries,
  isPrivateDir,
};
