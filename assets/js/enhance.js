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
})();
