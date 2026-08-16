/* ============================================================
   preview.js — 链接悬停预览（仅文章正文内链接）
   站内文章链接 → 富预览；外站链接 → favicon + 域名 + URL
   ============================================================ */
(function () {
  'use strict';

  var postsMeta = window.__POSTS__ || [];
  var bySlug = {};
  postsMeta.forEach(function (p) { bySlug[p.slug] = p; });

  var lpCard = document.createElement('div');
  lpCard.className = 'link-preview';
  document.body.appendChild(lpCard);

  var lpTimer = null;
  var lpCurrent = null;

  function lpEsc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function lpSlug(href) {
    if (!href) return null;
    var m = String(href).match(/([^\/#?]+)\.html?/i);
    return m ? m[1] : null;
  }
  function lpIsExternal(href) {
    return /^(https?:)?\/\//.test(String(href || ''));
  }
  function lpHost(href) {
    try { return new URL(href, location.href).hostname; }
    catch (e) { return String(href).replace(/^[a-z]+:\/\//, '').replace(/^\/\//, '').split('/')[0].split('?')[0]; }
  }
  function lpRenderInternal(p) {
    var tags = (p.tags || []).map(function (t) { return '<span># ' + lpEsc(t) + '</span>'; }).join('');
    return '<p class="lp-meta">' + lpEsc(p.dateText) + ' · 约 ' + p.minutes + ' 分钟</p>' +
      '<p class="lp-title">' + lpEsc(p.title) + '</p>' +
      (p.summary ? '<p class="lp-summary">' + lpEsc(p.summary) + '</p>' : '') +
      (tags ? '<p class="lp-tags">' + tags + '</p>' : '');
  }
  function lpRenderExternal(href) {
    var host = lpHost(href);
    return '<p class="lp-meta">外部链接</p>' +
      '<div class="lp-ext">' +
      '<img class="lp-favicon" src="https://icons.duckduckgo.com/ip3/' + encodeURIComponent(host) + '.ico" alt="">' +
      '<div>' +
      '<p class="lp-ext-host">' + lpEsc(host) + '</p>' +
      '<p class="lp-ext-url">' + lpEsc(href) + '</p>' +
      '</div></div>';
  }
  function lpShow() {
    if (!lpCurrent) return;
    lpCard.innerHTML = lpCurrent.external
      ? lpRenderExternal(lpCurrent.href)
      : lpRenderInternal(lpCurrent.p);
    var r = lpCurrent.a.getBoundingClientRect();
    var w = 300;
    var x = r.left;
    var y = r.bottom + 10;
    if (x + w > window.innerWidth - 12) x = window.innerWidth - w - 12;
    if (y + 180 > window.innerHeight - 12) y = r.top - 190;
    lpCard.style.left = Math.max(12, x) + 'px';
    lpCard.style.top = Math.max(12, y) + 'px';
    lpCard.classList.add('show');
  }
  function lpHide() {
    clearTimeout(lpTimer);
    lpCard.classList.remove('show');
    lpCurrent = null;
  }

  document.addEventListener('mouseover', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a') : null;
    if (!a) return;
    // 仅处理文章正文内的链接
    if (!a.closest('.article .content')) return;
    var href = a.getAttribute('href');
    if (!href) return;

    if (lpIsExternal(href)) {
      lpCurrent = { a: a, external: true, href: href };
    } else {
      var slug = lpSlug(href);
      if (!slug || !bySlug[slug]) return;
      lpCurrent = { a: a, external: false, p: bySlug[slug] };
    }
    clearTimeout(lpTimer);
    lpTimer = setTimeout(lpShow, 250);
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a') : null;
    if (a && lpCurrent && a === lpCurrent.a) lpHide();
  });
  window.addEventListener('scroll', lpHide, { passive: true });
})();
