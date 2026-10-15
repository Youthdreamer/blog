/* ============================================================
   core.js — 核心交互：阅读进度 / 入场动画 / 提示 / 彩蛋 / 年份
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 阅读进度条 ---------- */
  var bar = document.getElementById('progress');
  if (bar) {
    var onScroll = function () {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var y = doc.scrollTop || document.body.scrollTop;
      bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 入场渐显 ---------- */
  var revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -5% 0px' });
    revealEls.forEach(function (el, i) {
      el.style.setProperty('--rd', ((i % 3) * 90) + 'ms');
      io.observe(el);
    });
    // 兜底：1.2s 后仍未显示的元素强制显示（防止长文等超高元素因阈值不达标而一直隐藏）
    setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add('in'); });
    }, 1200);
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- 回到顶部 ---------- */
  var toTop = document.getElementById('to-top');
  if (toTop) {
    var toggleTop = function () {
      var y = window.scrollY || document.documentElement.scrollTop;
      toTop.classList.toggle('show', y > 500);
    };
    window.addEventListener('scroll', toggleTop, { passive: true });
    toggleTop();
    toTop.addEventListener('click', function () {
      var reduce = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---------- 提示 ---------- */
  var toast = document.getElementById('toast');
  var toastTimer = null;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3600);
  }

  /* 密语缓冲（彩蛋一用）。声明提在这里：下面的阅读刻度段也要读它——
     两层 keydown 都挂在 document 上，按注册先后跑；这一段的处理器必须
     注册在彩蛋之前，才来得及看见敲到一半的 youth（那时 t 让路，别抢
     彩蛋的最后一个字母） */
  var buf = '';
  var SECRET = 'youth';

  /* ---------- 阅读刻度：进度条上的章节尺 / 悬停小签 / t 目录面板 / n·p 翻节 ----------
     与文首目录同门槛：有 .article .toc 才有这一套。
     刻度只画章（h2），但条目取自目录本身（而不是正文里的 h2[id]）：折叠块里的
     标题在 DOM 里有 id、关着时高度却是零，照它画刻度会画出一枚点不动的死刻度。
     目录是唯一真相——面板就是它的一份拷贝。 */
  var tocNav = document.querySelector('.article .toc');
  if (tocNav) (function () {
    var doc = document.documentElement;
    var SECTIONS = []; // 目录里的所有条目（h2 与 h3）——面板用
    var H2S = [];      // 只有章（h2）——刻度与 n/p 用
    var byId = Object.create(null);

    tocNav.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (!el) return;
      var noEl = a.querySelector('.no');
      var item = {
        id: el.id, el: el, tick: null, panelA: null, left: 0,
        no: noEl ? noEl.textContent : '',
        title: (el.textContent || '').replace(/\s+/g, ' ').trim(),
      };
      SECTIONS.push(item);
      byId[item.id] = item;
      if (!a.classList.contains('toc-sub')) H2S.push(item);
    });
    if (!SECTIONS.length) return;

    // 跳转的落地余量：与 CSS 的 .article h2 { scroll-margin-top } 同源，读出来用，不写死
    var GAP = parseFloat(getComputedStyle(SECTIONS[0].el).scrollMarginTop);
    if (!(GAP >= 0)) GAP = 96;

    // 精指针才有悬停小签；粗指针（触屏）改成点顶部窄条开面板
    var fine = !window.matchMedia || window.matchMedia('(hover: hover)').matches;
    var reduceMotion = function () {
      return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };
    var layer = null, chip = null, panel = null, lastFocus = null;
    var panelOpen = false, activeIdx = -1;

    function maxScroll() { return doc.scrollHeight - doc.clientHeight; }
    function pageY() { return doc.scrollTop || document.body.scrollTop; }

    // 每节在整页里的进度位置（百分比）：跳到哪，刻度就画在哪（先减掉落地余量）
    function pctOf(item) {
      var m = maxScroll();
      if (m <= 0) return 0;
      var top = item.el.getBoundingClientRect().top + pageY() - GAP;
      return Math.min(100, Math.max(0, (top / m) * 100));
    }

    function label(item) {
      return (item.no ? item.no + ' · ' : '') + item.title;
    }

    /* ----- 刻度尺 ----- */

    function buildRuler() {
      if (H2S.length < 2) return; // 一枚刻度不成尺（面板照旧能用）
      layer = document.createElement('div');
      layer.id = 'ruler';
      layer.setAttribute('aria-hidden', 'true'); // 纯装饰：真目录在文首与 t 面板里
      H2S.forEach(function (item) {
        var t = document.createElement('i');
        t.className = 'rl-tick';
        layer.appendChild(t);
        item.tick = t;
      });
      document.body.appendChild(layer);
      layer.addEventListener('mousemove', onMove);
      layer.addEventListener('mouseleave', hideChip);
      layer.addEventListener('click', onLayerClick);
    }

    // 离指针最近的刻度（视口 px；命中容差 16px），没有就是 -1
    function nearestTick(x) {
      var best = -1, bestD = 16;
      H2S.forEach(function (item, i) {
        var d = Math.abs((item.left / 100) * doc.clientWidth - x);
        if (d <= bestD) { bestD = d; best = i; }
      });
      return best;
    }

    function hideChip() { if (chip) chip.classList.remove('show'); }

    function onMove(e) {
      if (!fine) return;
      var i = nearestTick(e.clientX);
      if (i < 0) { hideChip(); return; }
      if (!chip) {
        chip = document.createElement('span');
        chip.className = 'rl-chip';
        document.body.appendChild(chip);
      }
      chip.textContent = label(H2S[i]);
      chip.style.left = Math.min(doc.clientWidth - 48, Math.max(48, e.clientX)) + 'px';
      chip.classList.add('show');
    }

    function onLayerClick(e) {
      if (!fine) { togglePanel(); return; } // 触屏：顶部窄条一按 = 呼出目录
      var i = nearestTick(e.clientX);
      if (i >= 0) jump(H2S[i]);
    }

    function jump(item) {
      item.el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' }); // 落点由 6rem 余量接住
      // 顺手把地址栏换成这一节：链接可分享。file:// 等场景 replaceState 会抛，算了
      try { history.replaceState(null, '', '#' + item.id); } catch (err) {}
    }

    /* ----- 目录面板（t 呼出） ----- */

    function buildPanel() {
      panel = document.createElement('div');
      panel.className = 'tpanel';
      panel.id = 'toc-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', '目录');
      panel.tabIndex = -1;
      var inner = document.createElement('div');
      inner.className = 'tp-inner';
      var head = document.createElement('p');
      head.className = 'tp-head';
      head.appendChild(document.createTextNode('目录'));
      var hint = document.createElement('span');
      hint.className = 'tp-hint';
      hint.textContent = fine ? 'n / p 翻节 · t / esc 收起' : '点标题跳转 · 点外面收起';
      head.appendChild(hint);
      inner.appendChild(head);
      // 列表直接拷一份文首目录：编号、层级、措辞天然同源，以后目录改了面板不掉队
      // （cloneNode 不带事件，交互全由本段接管）
      var list = tocNav.cloneNode(true);
      list.removeAttribute('data-reveal');
      list.classList.add('in');
      var lab = list.querySelector('.toc-label');
      if (lab) lab.remove();
      var as = list.querySelectorAll('a[href^="#"]');
      SECTIONS.forEach(function (item, i) { item.panelA = as[i] || null; });
      inner.appendChild(list);
      panel.appendChild(inner);
      document.body.appendChild(panel);
      panel.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a') : null;
        if (!a) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey) return; // 修饰键点击交给浏览器（新标签页打开）
        e.preventDefault();
        var item = byId[a.getAttribute('href').slice(1)];
        if (item) { jump(item); closePanel(); }
      });
    }

    function markPanel() {
      var cur = activeIdx >= 0 ? H2S[activeIdx] : null;
      SECTIONS.forEach(function (item) {
        if (item.panelA) item.panelA.classList.toggle('is-cur', item === cur);
      });
    }

    function openPanel() {
      if (!panel) buildPanel();
      lastFocus = document.activeElement;
      panel.classList.add('show');
      panelOpen = true;
      hideChip();
      markPanel();
      panel.focus(); // 焦点收进面板，Esc / t / 点外面都能走
    }

    function closePanel() {
      if (!panelOpen) return;
      panel.classList.remove('show');
      panelOpen = false;
      // 只把焦点还回去（还留在面板里 / 落在 body 上时）；用户点去别处了就别抢
      var ae = document.activeElement;
      if (lastFocus && document.body.contains(lastFocus) &&
          (ae === document.body || panel.contains(ae))) lastFocus.focus();
    }

    function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }

    /* ----- 滚动状态：读过的刻度漫金，当前章亮一档 ----- */

    function update() {
      var m = maxScroll(), y = pageY();
      var pct = m > 0 ? (y / m) * 100 : 0;
      var cur = -1;
      H2S.forEach(function (item, i) {
        var passed = item.left <= pct + 0.01;
        if (passed) cur = i;
        if (item.tick) item.tick.classList.toggle('is-passed', passed);
      });
      // 末尾的章往往很短，读到底也等不到它被「越过」——到底就点亮它
      if (m > 0 && y >= m - 1 && H2S.length) cur = H2S.length - 1;
      if (cur !== activeIdx) {
        activeIdx = cur;
        H2S.forEach(function (item, i) {
          if (item.tick) item.tick.classList.toggle('is-on', i === cur);
        });
        if (panelOpen) markPanel();
      }
      hideChip(); // 滚动后小签位置就旧了，收掉（动一下鼠标它会回来）
    }

    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; update(); });
    }, { passive: true });

    /* ----- 量位置（图片晚到 / 折叠开合 / 字体就位 / 窗口变化都要重来） ----- */

    function layout() {
      if (layer) {
        layer.classList.toggle('off', maxScroll() <= 0); // 页面短到不用滚就不画尺
        H2S.forEach(function (item) {
          item.left = pctOf(item);
          if (item.tick) item.tick.style.left = item.left.toFixed(2) + '%';
        });
      }
      update();
    }

    var relayoutTimer = null;
    function onResize() { // 与 effects.js 的防抖同一节奏
      clearTimeout(relayoutTimer);
      relayoutTimer = setTimeout(layout, 250);
    }

    /* ----- 按键：t 开合面板，n / p 翻节 ----- */

    function step(dir) {
      if (!H2S.length) return;
      if (dir < 0 && activeIdx < 0) return; // 还在第一章之前，往回没有去处
      var next = Math.min(Math.max(activeIdx + dir, 0), H2S.length - 1);
      if (next === activeIdx) return; // 到头了，安静收场
      closePanel();
      jump(H2S[next]);
      showToast('§ ' + label(H2S[next]));
    }

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.isComposing || e.keyCode === 229) return; // 中文输入法组词中，别抢键
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' ||
                t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('.imgbox.show')) return; // 灯箱开着：键盘归它
      var k = (e.key || '').toLowerCase();
      if (k === 'escape' || k === 'esc') {
        if (panelOpen) closePanel();
        return;
      }
      if (k === 't') {
        // 密语 "youth" 正敲到一半（缓冲是它的非空前缀，如 'you'）：t 让路，别抢彩蛋
        if (buf && buf.length < SECRET.length && SECRET.indexOf(buf) === 0) return;
        e.preventDefault();
        togglePanel();
        return;
      }
      if (k === 'n' || k === 'p') {
        e.preventDefault();
        step(k === 'n' ? 1 : -1);
      }
    }

    buildRuler();
    var hintBtn = tocNav.querySelector('.toc-hint');
    if (hintBtn) hintBtn.addEventListener('click', togglePanel);
    document.addEventListener('keydown', onKey);
    // 点面板/提示按钮/顶部窄条之外的地方收面板（没有遮罩，靠这个收）
    document.addEventListener('click', function (e) {
      if (!panelOpen) return;
      var t = e.target;
      if ((panel && panel.contains(t)) || (hintBtn && hintBtn.contains(t)) || (layer && layer.contains(t))) return;
      closePanel();
    });
    if (layer) {
      window.addEventListener('load', layout);
      window.addEventListener('resize', onResize);
      if ('ResizeObserver' in window) {
        // 图片晚到、折叠块开合都会改变正文高度——量到变化就重排刻度
        try {
          new ResizeObserver(onResize).observe(document.querySelector('.article .content') || document.body);
        } catch (err) { /* 量不了就算了，resize/load 还能兜底 */ }
      }
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
        document.fonts.ready.then(function () { layout(); }); // 字体晚到会挪行高
      }
    }
    layout(); // 首次：量位置 + 点亮当前章
  })();

  /* ---------- 彩蛋一：敲出密语 "youth" ---------- */
  document.addEventListener('keydown', function (e) {
    if (e.key && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      buf = (buf + e.key.toLowerCase()).slice(-SECRET.length);
      if (buf === SECRET) {
        showToast('你唤醒了这间屋子的密语。');
        buf = '';
      }
    }
  });

  /* ---------- 彩蛋二：连击印章（页脚 + 隐藏落款的印章） ---------- */
  var seals = document.querySelectorAll('.seal, .secret-seal');
  var clicks = 0, clickTimer = null;
  seals.forEach(function (seal) {
    seal.addEventListener('click', function () {
      clicks++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { clicks = 0; }, 900);
      if (clicks >= 3) {
        showToast('这枚印章，是你我的暗号。');
        clicks = 0;
      }
    });
  });

  /* ---------- 页脚年份 ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
