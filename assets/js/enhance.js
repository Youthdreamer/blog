/* ============================================================
   enhance.js — 正文增强：图片放大 + 代码高亮/复制 + 自定义视频播放器
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

  /* ---------- 剧透遮罩：点一下 / 回车揭开，揭开就不再合上 ---------- */
  /* ||……|| 渲染成可聚焦的 .spoiler（lib/markdown.js）。无 JS 或纯键盘时
     靠 CSS 的 :focus 也能看；这里补点击与回车的「点亮」。只加不减：
     揭开是单向动作，再点一下不会合上（合上只会误触） */
  document.querySelectorAll('.article .content .spoiler').forEach(function (s) {
    var reveal = function () { s.classList.add('on'); };
    s.addEventListener('click', reveal);
    s.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault(); /* 空格默认滚页，别让页面跟着跳 */
        reveal();
      }
    });
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

    /* 行高亮（```js {3,5-7}）：构建端把归一后的行号表写在 pre[data-hl] 上，
       这里往内层 code 画色带——每个区间一条淡金带 + 一条 2px 左金条。
       用 lh 单位逐行对位（pre 的行高 1.75 无单位，1lh 就是一行高），不用监听 resize。
       lh 单位有门槛：不支持时整段跳过——不探的话 position/size 被丢、
       background-image 独活，整块代码会被染成一片 */
    var hlSpec = pre.getAttribute('data-hl');
    if (code && hlSpec && window.CSS && CSS.supports && CSS.supports('width', '1lh')) {
      var imgs = [], sizes = [], poses = [];
      /* 颜色留在 CSS（--hl-band / --hl-bar，见 components.css 的 pre[data-hl] 规则） */
      var band = 'linear-gradient(var(--hl-band), var(--hl-band))';
      var bar = 'linear-gradient(var(--hl-bar), var(--hl-bar))';
      hlSpec.split(',').forEach(function (range) {
        var m = range.split('-');
        var from = parseInt(m[0], 10);
        var to = m[1] ? parseInt(m[1], 10) : from;
        var h = 'calc(1lh * ' + (to - from + 1) + ')';   // 带高 = 行数 × 一行高
        var top = 'calc(1lh * ' + (from - 1) + ')';
        imgs.push(bar, band);                            // 先 push 的在最上层：金条压住带
        sizes.push('2px ' + h, '100% ' + h);
        poses.push('0 ' + top, '0 ' + top);
      });
      code.style.backgroundImage = imgs.join(', ');
      code.style.backgroundSize = sizes.join(', ');
      code.style.backgroundPosition = poses.join(', ');
      code.style.backgroundRepeat = 'no-repeat';
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

  /* ---------- 自定义视频播放器（贴合站点风格） ---------- */
  document.querySelectorAll('.article video').forEach(function (video) {
    if (video.dataset.player) return;
    video.dataset.player = '1';

    // 包裹容器（替代原生控件，JS 不可用时保留 controls 兜底）
    video.removeAttribute('controls');
    var wrap = document.createElement('div');
    wrap.className = 'video-player';
    video.parentNode.insertBefore(wrap, video);
    wrap.appendChild(video);

    /* 控件条 */
    var bar = document.createElement('div');
    bar.className = 'vp-bar';
    bar.innerHTML =
      '<button class="vp-play" type="button" aria-label="播放/暂停">' +
        '<svg class="vp-play-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>' +
        '<svg class="vp-pause-icon" viewBox="0 0 24 24" aria-hidden="true" style="display:none"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>' +
      '</button>' +
      '<div class="vp-track"><div class="vp-trackline"><div class="vp-fill"></div><div class="vp-knob"></div></div></div>' +
      '<span class="vp-time">00:00 / 00:00</span>' +
      '<div class="vp-volwrap">' +
        '<button class="vp-vol" type="button" aria-label="音量">' +
          '<svg class="vp-vol-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
          '<svg class="vp-vol-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
        '</button>' +
        '<div class="vp-volpop">' +
          '<div class="vp-volslider"><div class="vp-volfill"></div></div>' +
        '</div>' +
      '</div>' +
      '<button class="vp-full" type="button" aria-label="全屏">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>';
    wrap.appendChild(bar);

    var play = bar.querySelector('.vp-play');
    var playIcon = bar.querySelector('.vp-play-icon');
    var pauseIcon = bar.querySelector('.vp-pause-icon');
    var fill = bar.querySelector('.vp-fill');
    var knob = bar.querySelector('.vp-knob');
    var timeEl = bar.querySelector('.vp-time');
    var track = bar.querySelector('.vp-track');
    var trackline = bar.querySelector('.vp-trackline');
    var volOn = bar.querySelector('.vp-vol-on');
    var volOff = bar.querySelector('.vp-vol-off');
    var volPop = bar.querySelector('.vp-volpop');
    var volSlider = bar.querySelector('.vp-volslider');
    var volFill = bar.querySelector('.vp-volfill');

    var fmt = function (s) {
      if (!isFinite(s)) return '00:00';
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return (m < 10 ? '0' + m : m) + ':' + (sec < 10 ? '0' + sec : sec);
    };
    var update = function () {
      if (dragging) return; // 拖动中：UI 由鼠标控制，避免与播放进度打架
      var p = video.duration ? video.currentTime / video.duration : 0;
      fill.style.width = (p * 100) + '%';
      knob.style.left = (p * 100) + '%';
      timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
      var paused = video.paused;
      playIcon.style.display = paused ? 'block' : 'none';
      pauseIcon.style.display = paused ? 'none' : 'block';
    };
    video.addEventListener('timeupdate', update);
    video.addEventListener('loadedmetadata', update);
    video.addEventListener('play', update);
    video.addEventListener('pause', update);

    play.addEventListener('click', function () {
      if (video.paused) video.play();
      else video.pause();
    });
    /* 点击画面播放/暂停 */
    video.addEventListener('click', function () {
      if (video.paused) video.play();
      else video.pause();
    });
    /* 进度条：拖动时 UI 跟随鼠标（不碰视频），松手提交跳转 */
    var dragging = false;
    var preview = function (e) {
      if (!video.duration) return;
      var r = trackline.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      fill.style.width = (p * 100) + '%';
      knob.style.left = (p * 100) + '%';
    };
    var commitSeek = function (e) {
      if (!video.duration) return;
      var r = trackline.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      video.currentTime = p * video.duration;
    };
    track.addEventListener('pointerdown', function (e) {
      dragging = true;
      track.setPointerCapture(e.pointerId);
      preview(e);
    });
    track.addEventListener('pointermove', function (e) {
      if (dragging) preview(e);
    });
    track.addEventListener('pointerup', function (e) {
      if (!dragging) return;
      dragging = false;
      commitSeek(e);
    });
    track.addEventListener('pointercancel', function () {
      dragging = false;
    });

    /* 音量：图标点击静音/取消；悬停弹出竖向滑条（点击/拖动调节） */
    var renderVol = function () {
      var muted = video.muted || video.volume === 0;
      volOn.style.display = muted ? 'none' : 'block';
      volOff.style.display = muted ? 'block' : 'none';
      volFill.style.height = (video.muted ? 0 : video.volume * 100) + '%';
    };
    var setVolFromEvent = function (e) {
      var r = volSlider.getBoundingClientRect();
      var v = (r.bottom - e.clientY) / r.height;
      video.volume = Math.max(0, Math.min(1, v));
      video.muted = video.volume === 0;
      renderVol();
    };
    /* 事件挂在弹出层上：加宽了命中区与桥接空隙，拖动不易脱手 */
    volPop.addEventListener('click', setVolFromEvent);
    volPop.addEventListener('pointerdown', function (e) {
      setVolFromEvent(e);
      volPop.setPointerCapture(e.pointerId);
    });
    volPop.addEventListener('pointermove', function (e) {
      if (e.buttons === 1) setVolFromEvent(e);
    });
    bar.querySelector('.vp-vol').addEventListener('click', function () {
      video.muted = !video.muted;
      renderVol();
    });
    video.addEventListener('volumechange', renderVol);
    video.addEventListener('loadedmetadata', renderVol);
    renderVol();

    bar.querySelector('.vp-full').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (wrap.requestFullscreen) wrap.requestFullscreen();
    });

    /* 控件条：播放中自动隐藏，移动/悬停显示 */
    var hideTimer = null;
    var showBar = function () {
      bar.classList.add('show');
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () {
        if (!video.paused) bar.classList.remove('show');
      }, 2200);
    };
    wrap.addEventListener('mousemove', showBar);
    wrap.addEventListener('mouseleave', function () {
      if (!video.paused) bar.classList.remove('show');
    });
    showBar();
  });

  /* ---------- 折叠块：点开/收起的高度过渡 ---------- */
  /* 原生 <details> 自己会开合，这里只把开合演成一段过渡。没有 WAAPI、
     或系统偏好减少动效时直接不拦，交还原生的瞬时开合；
     reduced-motion 里全局关掉了 transition，但 WAAPI 不受它管，得自己判 */
  var FOLD_EASE = 'cubic-bezier(.22,.61,.36,1)'; /* 与 --ease 同一条曲线（base.css） */
  document.querySelectorAll('.article .fold').forEach(function (d) {
    var head = d.querySelector('.fold-head');
    var body = d.querySelector('.fold-body');
    if (!head || !body || !body.animate) return;

    var anim = null;     /* 正在演的动画；演完置回 null */
    var opening = false; /* 动画进行中的目标方向；空闲时以 d.open 为准 */

    head.addEventListener('click', function (e) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      e.preventDefault();
      var want = anim ? !opening : !d.open; /* 演到一半再点 = 掉头 */
      /* 取消前量下当前值：从眼前的样子接着演，不跳变 */
      var fromH = anim ? body.getBoundingClientRect().height : body.offsetHeight;
      var fromO = parseFloat(window.getComputedStyle(body).opacity) || 0;
      if (anim) anim.cancel(); /* cancel 不触发 onfinish，不会误关 */
      opening = want;
      var opts = { duration: want ? 240 : 200, easing: FOLD_EASE };
      if (want) {
        d.open = true; /* 先亮出来，UA 才量得到高度 */
        anim = body.animate(
          [{ height: fromH + 'px', opacity: fromH < 2 ? 0 : fromO },
           { height: body.scrollHeight + 'px', opacity: 1 }], /* 裁切着也报全高 */
          opts);
      } else {
        anim = body.animate(
          [{ height: fromH + 'px', opacity: fromO },
           { height: '0px', opacity: 0 }],
          opts);
      }
      anim.onfinish = function () {
        anim = null;
        if (!opening) d.open = false; /* 收完才真关，收起那段才看得见 */
      };
    });
  });
})();
