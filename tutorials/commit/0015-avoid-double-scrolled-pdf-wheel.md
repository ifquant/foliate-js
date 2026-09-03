# 0015：避免连续滚动 PDF 的滚轮位移叠加

## 背景

Readest 提交 `1b44b95d3` 把 `packages/foliate-js` 从 `24d9a0c0e` 更新到 `e366bdb79`。嵌套提交修复了连续滚动 PDF 中，鼠标位于页面正文时一次滚轮输入移动约两倍距离的问题。

## 根因

连续滚动页使用 `scrolling="no"` 且内容不可滚动的 iframe。浏览器会把 wheel 输入原生链到外层阅读器；旧监听器又对外层调用一次 `scrollBy()`，于是原生滚动和脚本滚动叠加。指针位于页边距时事件直接落在外层，因此没有第二次位移，这也造成页面与边距手感不一致。

## 改动

- 保留 iframe 收到 wheel 后立即关闭 pointer events 的行为，让同一手势后续输入直接交给宿主。
- 删除冗余的宿主 `scrollBy()`，首个输入也只走浏览器原生 scroll chaining。
- 不改显式的下一页、上一页和拖拽平移路径。

## 验证

- `node --check fixed-layout.js`
- br1 真实 PDF 连续滚动 wheel 回归
- br1 PDF B1-B4 联合回归

## 未包含

- `S2-R03B5` 的 pinch 和 pan 手势协调
- 单页居中和连续滚动高亮修复
- foliate-js 既有 lockfile/Rollup vendor 路径维护
