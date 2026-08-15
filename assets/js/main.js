/* ============================================================
   youth — 交互脚本
   阅读进度 / 入场动画 / 小彩蛋 / 页脚年份
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
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el, i) {
      el.style.setProperty('--rd', ((i % 3) * 90) + 'ms');
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
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

  /* ---------- 彩蛋一：敲出密语 "youth" ---------- */
  var buf = '';
  var SECRET = 'youth';
  document.addEventListener('keydown', function (e) {
    if (e.key && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      buf = (buf + e.key.toLowerCase()).slice(-SECRET.length);
      if (buf === SECRET) {
        showToast('你唤醒了这间屋子的密语。');
        buf = '';
      }
    }
  });

  /* ---------- 彩蛋二：连击印章 ---------- */
  var seal = document.querySelector('.seal');
  var clicks = 0, clickTimer = null;
  if (seal) {
    seal.addEventListener('click', function () {
      clicks++;
      clearTimeout(clickTimer);
      clickTimer = setTimeout(function () { clicks = 0; }, 900);
      if (clicks >= 3) {
        showToast('这枚印章，是你我的暗号。');
        clicks = 0;
      }
    });
  }

  /* ---------- 页脚年份 ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  /* ==========================================================
     首页特效（尊重 prefers-reduced-motion）
     ========================================================== */
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ① 鼠标光晕：柔和金斑跟随光标 */
  var glow = document.getElementById('glow');
  if (glow && !reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    var gx = window.innerWidth / 2, gy = window.innerHeight / 3;
    var tx = gx, ty = gy;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
    }, { passive: true });
    (function tick() {
      gx += (tx - gx) * 0.09;
      gy += (ty - gy) * 0.09;
      glow.style.transform = 'translate(' + Math.round(gx) + 'px,' + Math.round(gy) + 'px)';
      requestAnimationFrame(tick);
    })();
  }

  /* ② 墨滴涟漪：左键轻点，一圈墨环悄然化开 */
  if (!reduceMotion) {
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return; // 只响应左键
      if (e.target.closest('a, button, .seal, .logo')) return; // 交互元素上不打扰
      var r = document.createElement('span');
      r.className = 'ink-ripple';
      r.style.left = e.clientX + 'px';
      r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      setTimeout(function () { r.remove(); }, 1500);
    });
  }

  /* ③ 逐字浮现：把 .stagger 标题拆成单个字符，依次浮现 */
  function staggerChars(root) {
    var count = 0;
    (function walk(node) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { // 文本节点
          var text = n.textContent;
          if (!text) return;
          var frag = document.createDocumentFragment();
          Array.prototype.forEach.call(text, function (c) {
            if (c === ' ' || c === '\n') { frag.appendChild(document.createTextNode(c)); return; }
            var s = document.createElement('span');
            s.className = 'ch';
            s.textContent = c;
            s.style.setProperty('--i', count);
            count++;
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { // 元素节点（如 <span class="dot">）
          walk(n);
        }
      });
    })(root);
  }
  document.querySelectorAll('.stagger').forEach(function (el) {
    if (reduceMotion) return;
    staggerChars(el);
  });

  /* ⑤ 点击标题：重新"落笔"，逐字动画再写一遍 */
  document.querySelectorAll('.stagger').forEach(function (h1) {
    h1.addEventListener('click', function () {
      if (reduceMotion) return;
      var chars = h1.querySelectorAll('.ch');
      chars.forEach(function (c) { c.style.animation = 'none'; });
      void h1.offsetWidth; // 强制重排，让动画重新播放
      chars.forEach(function (c) { c.style.animation = ''; });
    });
  });

  /* ④ 漂浮墨尘：Hero 背景里的微光粒子 */
  var hero = document.querySelector('.hero');
  if (hero && !reduceMotion) {
    var N = 14;
    for (var i = 0; i < N; i++) {
      var d = document.createElement('span');
      d.className = 'dust';
      d.style.left = (Math.random() * 96 + 2) + '%';
      d.style.bottom = (Math.random() * 55) + '%';
      d.style.setProperty('--s', (Math.random() * 4 + 4).toFixed(2) + 's');
      d.style.setProperty('--delay', (Math.random() * 7).toFixed(2) + 's');
      d.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(1) + 'px');
      d.style.setProperty('--dy', (Math.random() * 60 + 40).toFixed(1) + 'px');
      d.style.setProperty('--o', (Math.random() * 0.16 + 0.07).toFixed(2));
      hero.appendChild(d);
    }
  }
})();
