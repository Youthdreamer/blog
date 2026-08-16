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
