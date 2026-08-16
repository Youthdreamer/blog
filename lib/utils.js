'use strict';

/* 通用工具函数 */

const esc = (s) => s
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const slugify = (s) => s.toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .replace(/^-+|-+$/g, '');

function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function readMinutes(text) {
  const chars = text.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 400));
}

module.exports = { esc, slugify, formatDate, readMinutes };
