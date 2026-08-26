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
      '<button class="vp-play" type="button" aria-label="播放/暂停">▶</button>' +
      '<div class="vp-track"><div class="vp-fill"></div><div class="vp-knob"></div></div>' +
      '<span class="vp-time">00:00 / 00:00</span>' +
      '<button class="vp-full" type="button" aria-label="全屏">⛶</button>';
    wrap.appendChild(bar);

    var play = bar.querySelector('.vp-play');
    var fill = bar.querySelector('.vp-fill');
    var knob = bar.querySelector('.vp-knob');
    var timeEl = bar.querySelector('.vp-time');
    var track = bar.querySelector('.vp-track');

    var fmt = function (s) {
      if (!isFinite(s)) return '00:00';
      var m = Math.floor(s / 60);
      var sec = Math.floor(s % 60);
      return (m < 10 ? '0' + m : m) + ':' + (sec < 10 ? '0' + sec : sec);
    };
    var update = function () {
      var p = video.duration ? video.currentTime / video.duration : 0;
      fill.style.width = (p * 100) + '%';
      knob.style.left = (p * 100) + '%';
      timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
      play.textContent = video.paused ? '▶' : '❚❚';
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
    /* 点击进度条跳转 */
    track.addEventListener('click', function (e) {
      if (!video.duration) return;
      var r = track.getBoundingClientRect();
      video.currentTime = ((e.clientX - r.left) / r.width) * video.duration;
    });
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
