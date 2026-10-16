/* ============================================================
   preview.js — 链接悬停预览（仅文章正文内链接）
   站内文章链接 → 富预览；外站链接 → favicon + 域名 + URL
   脚注引用（#fn-N）→ 脚注定义（走同一条延迟/定位/隐藏的生命周期）
   ============================================================ */
(function () {
  'use strict';

  var postsMeta = window.__POSTS__ || [];
  var bySlug = {};
  postsMeta.forEach(function (p) { bySlug[p.slug] = p; });

  var lpCard = document.createElement('div');
  lpCard.className = 'link-preview';
  lpCard.setAttribute('aria-hidden', 'true'); // 纯视觉弹层：正文里本就有同样的信息，不进读屏顺序
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
    // 页面（kind: 'page'，如「关于」）没有日期与阅读时长，头部换成身份标签；文章照旧
    var meta = p.kind === 'page'
      ? '<p class="lp-meta">页面</p>'
      : '<p class="lp-meta">' + lpEsc(p.dateText) + ' · 约 ' + p.minutes + ' 分钟</p>';
    return meta +
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
  /* 脚注定义 → 卡片：克隆文末的 <li id="fn-N">，剥掉回跳锚（.fn-back）与
     克隆内全部 [id]——带进卡片会成重复 id、搅乱锚点。正文已由构建转义，
     拿到就是安全的 HTML，直接嵌 */
  function lpRenderFootnote(li, n) {
    var clone = li.cloneNode(true);
    var drop = clone.querySelectorAll('.fn-back');
    for (var i = 0; i < drop.length; i++) drop[i].parentNode.removeChild(drop[i]);
    var ids = clone.querySelectorAll('[id]');
    for (var j = 0; j < ids.length; j++) ids[j].removeAttribute('id');
    return '<p class="lp-meta">脚注 ' + n + '</p>' +
      '<div class="lp-fn">' + clone.innerHTML + '</div>';
  }
  function lpShow() {
    if (!lpCurrent) return;
    lpCard.classList.toggle('is-fn', !!lpCurrent.fn);
    lpCard.innerHTML = lpCurrent.fn
      ? lpRenderFootnote(lpCurrent.fn, lpCurrent.n)
      : lpCurrent.external
        ? lpRenderExternal(lpCurrent.href)
        : lpRenderInternal(lpCurrent.p);
    var r = lpCurrent.a.getBoundingClientRect();
    // 截断渐隐只在真溢出时挂（css 的 mask 常开会把短定义的末行也啃掉）
    var fnBody = lpCard.querySelector('.lp-fn');
    if (fnBody) fnBody.classList.toggle('is-clipped', fnBody.scrollHeight > fnBody.clientHeight + 1);
    // 尺寸实测：脚注定义长短不一，翻不翻到上方得看实际高度（visibility:
    // hidden 下布局照算，量得到；链接卡量出来与旧硬编码等价）
    var w = lpCard.offsetWidth || 300;
    var h = lpCard.offsetHeight + 20;
    var x = r.left;
    var y = r.bottom + 10;
    if (x + w > window.innerWidth - 12) x = window.innerWidth - w - 12;
    if (y + h > window.innerHeight - 12) y = r.top - h;
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

    // 脚注引用（#fn-N）→ 弹这条定义。正则整串锚定：回跳锚 #fnref-N 同样以
    // #fn 开头，不锚定会把它也吃进来（它该安静地落到下面的「非预览」去）
    var fn = String(href).match(/^#fn-(\d+)$/);
    if (fn) {
      var li = document.getElementById('fn-' + fn[1]);
      if (!li) return;
      lpCurrent = { a: a, fn: li, n: fn[1] };
    } else if (lpIsExternal(href)) {
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
  // Esc 收起（与 enhance.js 目录浮层的习惯一致。键盘用户回车本就直达定义，
  // 不为脚注专门做焦点触发——弹层是重复信息）
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') lpHide();
  });
  window.addEventListener('scroll', lpHide, { passive: true });
})();
