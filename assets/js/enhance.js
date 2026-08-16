/* ============================================================
   enhance.js — 正文增强：图片点击放大 + 代码高亮/复制
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 图片点击放大（零依赖 lightbox） ---------- */
  var imgbox = document.createElement('div');
  imgbox.className = 'imgbox';
  imgbox.innerHTML = '<img alt="">';
  document.body.appendChild(imgbox);
  var imgboxImg = imgbox.querySelector('img');

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.closest && t.closest('.article .content, .md-figure')) {
      imgboxImg.src = t.getAttribute('src') || t.src;
      imgboxImg.alt = t.getAttribute('alt') || '';
      imgbox.classList.add('show');
    }
  });
  imgbox.addEventListener('click', function () {
    imgbox.classList.remove('show');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') imgbox.classList.remove('show');
  });

  /* ---------- 代码块：语法高亮 + 复制按钮 ---------- */
  document.querySelectorAll('.article pre').forEach(function (pre) {
    var code = pre.querySelector('code');
    if (code && window.hljs) {
      try {
        // hljs 无 hyprlang 语法，用 ini 近似高亮
        if (code.classList.contains('lang-hypr')) code.classList.replace('lang-hypr', 'lang-ini');
        window.hljs.highlightElement(code);
      } catch (e) { /* 高亮失败则保持原样 */ }
    }

    var wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.textContent = '复制';
    wrap.appendChild(btn);

    btn.addEventListener('click', function () {
      var text = pre.textContent || '';
      var done = function () {
        btn.textContent = '已复制 ✓';
        setTimeout(function () { btn.textContent = '复制'; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
  });
})();
