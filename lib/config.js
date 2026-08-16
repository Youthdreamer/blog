'use strict';

/* 站点级配置与路径常量 */
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SITE = {
  name: 'youth',
  author: 'youth',
  tagline: '于静默处，听见回响。',
  desc: '一间写给时间、也写给你我的小屋。',
  url: 'https://example.com', // 部署后改成你的域名
};

const PATHS = {
  content: path.join(ROOT, 'content'),
  posts: path.join(ROOT, 'content', 'posts'),
  pages: path.join(ROOT, 'content', 'pages'),
  assets: path.join(ROOT, 'assets'),
  out: path.join(ROOT, 'site'),
};

module.exports = { ROOT, SITE, PATHS };
