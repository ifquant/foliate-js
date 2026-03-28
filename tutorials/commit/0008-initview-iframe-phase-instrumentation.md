# 0008: initView 首屏链路细粒度 phase instrumentation

这次改动不是直接做性能优化，而是先把 `foliate-view -> foliate-paginator -> EPUB Loader` 的首屏链路拆成可测的细粒度 phase。目的很简单：在继续改首屏前，先确认真正慢的是哪一段，而不是盲改。

## 这次做了什么

1. 把 benchmark 的 `tracker` 从 [`view.js`](/Users/dev/workspace2/hc_apps/foliate-js/view.js) 继续往 renderer 透传。
2. 在 [`paginator.js`](/Users/dev/workspace2/hc_apps/foliate-js/paginator.js) 里把 `#display()` 拆成这些 phase：
   - `renderer:display:loadPrimary`
   - `renderer:display:preloadPrevious`
   - `renderer:display:updatePadding`
   - `renderer:display:scrollToAnchor`
   - `renderer:display:fillVisibleArea`
3. 在 `View.load()` 里把 iframe 装载拆成这些 phase：
   - `renderer:view:iframeLoadWait`
   - `renderer:view:afterLoadHooks`
   - `renderer:view:prepareDocument`
   - `renderer:view:renderSetup`
4. 在 [`epub.js`](/Users/dev/workspace2/hc_apps/foliate-js/epub.js) 的 `Loader` 里继续拆首章 XHTML 处理链：
   - `epub:loader:loadText`
   - `epub:loader:parseMarkup`
   - `epub:loader:rewriteMarkupRefs`
   - `epub:loader:serializeMarkup`
   - `epub:loader:createMarkupURL`
   - `epub:section:loadContent`

## 这次拿到的关键信息

对样本 [`股票魔法.epub`](/Users/dev/workspace2/hc_apps/股票魔法.epub) 跑 `a,b` 场景后，可以确认：

- `scrollToAnchor` 很小，不是首屏主犯
- 前 DOM 也很小，不是首屏主犯
- 最大块落在 `renderer:view:iframeLoadWait`

也就是说，当前首屏更像是卡在“iframe 文档及其资源真正完成加载”这层，而不是卡在 EPUB 索引解析。

## 为什么这一步值得单独提交

因为后续如果继续做 `initView` 优化，这套 phase 会直接决定我们：

- 是该优化 `iframe` 装载策略
- 还是该优化首章资源等待
- 还是该优化 paginator 的布局阶段

没有这层 instrumentation，后面的优化很容易优化错对象。

## 新人知识点

知识点 1：性能优化里“先量再改”不是口号。  
像这次，如果只看总时间，很容易误判成 `scrollToAnchor` 或 EPUB 解析慢。但拆 phase 之后，主犯其实是 iframe load wait。

知识点 2：浏览器里的 `load` 和“页面已经能看”不是一回事。  
一个文档有时候视觉上已经差不多了，但 `load` 还在等图片、样式、子资源。首屏性能经常就卡在这里。
