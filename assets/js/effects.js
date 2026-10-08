/* ============================================================
   effects.js — 首页特效：光晕 / 墨滴 / 逐字 / 墨尘
   （尊重 prefers-reduced-motion）
   ============================================================ */
(function () {
  'use strict';

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
      chars.forEach(function (c) {
        c.style.animation = ''; // 先清空（这会连带清掉上一轮留下的行内 animation-delay）
        // 再把节奏换回 55ms / +180ms：effects.css 给首页 h1 写的是开幕那一套
        // （75ms / +0.8s），那是等遮幅板退位用的时间；点击重播时片子早开场了，
        // 沿用就等于先空等 0.8s 才落第一笔。这两处数字要一起改
        c.style.animationDelay = 'calc(var(--i, 0) * 55ms + 180ms)';
      });
    });
  });

  var hero = document.querySelector('.hero');

  /* ⑥ 菱格底纹的涟漪：底纹本身是一层静态网格（layout.css .hero::before），
     这里把其中一部分菱形拎出来做缩放。相位只取决于「到中心的距离」，
     于是等距的菱形同时动，连成一圈一圈向外荡开的同心波纹 */
  if (hero && !reduceMotion) {
    var TILE_W = 66, TILE_H = 80; // 必须与 .hero::before 的 background-size 一致
    var STEP_X = TILE_W * 2;      // 横向隔一枚取一枚：不然整屏一起动，看不出波纹
    var STEP_Y = TILE_H;
    var SPEED = 88;               // 波速（px/秒）：慢慢荡，一圈从中心到边上要十几秒
    var CYCLE = 5.2;              // 与 CSS 里的 --dur 一致；周期 × 波速 ≈ 460px，
                                  // 就是相邻两圈的间距——要远大于菱形间距（80/132px），
                                  // 圈与圈之间的静水才留得出来。宁疏勿密，才静得下来

    var layer = document.createElement('div');
    layer.className = 'lattice';
    layer.setAttribute('aria-hidden', 'true');

    var fillLattice = function () {
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      var vw = window.innerWidth;
      var vh = hero.offsetHeight || window.innerHeight;
      // 落石点：与底纹遮罩的焦点同一处，涟漪像是从那块地方荡开
      var cx = vw / 2, cy = vh * 0.46;
      var far = Math.sqrt(cx * cx + (vh - cy) * (vh - cy)) || 1; // 到最远一角
      var frag = document.createDocumentFragment();
      for (var y = 0; y < vh + TILE_H; y += STEP_Y) {
        for (var x = 0; x < vw + TILE_W; x += STEP_X) {
          var dx = x + TILE_W / 2 - cx, dy = y + TILE_H / 2 - cy;
          var dist = Math.sqrt(dx * dx + dy * dy);
          // 越远越弱：水波扩散本来就在耗散，也顺势和底纹的径向遮罩合上
          var peak = 0.42 * (1 - 0.7 * Math.min(1, dist / far));
          if (peak < 0.02) continue;
          var cell = document.createElement('i');
          cell.style.left = x + 'px';
          cell.style.top = y + 'px';
          cell.style.setProperty('--dgd', (dist / SPEED).toFixed(2) + 's');
          cell.style.setProperty('--dur', CYCLE + 's');
          cell.style.setProperty('--peak', peak.toFixed(3));
          frag.appendChild(cell);
        }
      }
      layer.appendChild(frag);
    };

    fillLattice();
    hero.insertBefore(layer, hero.firstChild); // 在墨尘之下

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(fillLattice, 250);
    });
  }

  /* ④ 漂浮墨尘：Hero 背景里的微光粒子 */
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
