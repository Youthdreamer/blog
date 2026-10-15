'use strict';

/* 迷你组件名单（与 lib/config.js 同一种东西：常量模块，零依赖） */

/* ============================================================
   components.js — 围栏组件（特判围栏）的一份名单

   正文里不是代码块的那些围栏都在这登记，名单流向两处：
     · lib/markdown.js  —— dispatch 分支与 partWarn 的 kind
     · scripts/check.js —— 构建警告分类（DROP）与正文剥离（PROSE_FENCES）

   加一个新组件（例：```danger）就走这份名单：
     1. 这里登记：名字（NOTES 之类）/ 里子算不算正文（PROSE_FENCES）/ 警告 kind（KINDS）
     2. lib/markdown.js：dispatch 加分支，渲染照 foldBlock / noteBlock 的家法
     3. assets/css/components.css：样式一节；变体只许改自定义属性，
        别加会压过 effects.css 覆盖的高特异规则
     4. assets/css/effects.css：窄屏修正用同名选择器；打印有规矩才动
     5. scripts/test-markdown.js：形状 + 空块文案 + 边界，各钉一条
     6. 文档：README 一节 + 展示文加法式示例
     7. 验收：pnpm test → node scripts/check.js → 输出等价 diff（重构建后与旧产物
        剥 ?v= 版本号对比；白名单只该有 css / 404.html / 展示文）→ 截图
   ============================================================ */

/* 便笺家族（```note / ```tip / ```warn）：同一套家法，只差记号与色调
   （渲染见 markdown.js 的 noteBlock，样式见 components.css 的 .note） */
const NOTES = ['note', 'tip', 'warn'];

/* 构建警告的 kind——【接口】：partWarn 的文案里《标题》后面紧跟的就是这串。
   check.js 的 DROP 按「的<kind>：」分类，BUILD_ERRORS 里的「已跳过」是错误级；
   动一个字的 kind 就可能让提醒被误分类甚至升级成构建错误（exit 1），改前想清楚 */
const KINDS = {
  score: '评分卡',
  fold: '折叠块',
  note: '提示框', // 三型共用（见上）；不带型名是 check.js 对号的一部分
  hl: '代码行高亮',
  foot: '脚注',
  fence: '围栏代码块',
};

/* 里子是正文的围栏：check.js 的正文剥离要递归进去（fold + 便笺家族） */
const PROSE_FENCES = new Set(['fold', ...NOTES]);

module.exports = { NOTES, KINDS, PROSE_FENCES };
