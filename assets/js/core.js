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
