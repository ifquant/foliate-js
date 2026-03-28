# 0009: 让 PDF.js 的加载从 import map 依赖变成自包含

## 背景

`foliate-js/pdf.js` 之前用了这两种假设：

- 运行环境会提供 `@pdfjs/pdf.min.mjs` 的 import map
- PDF 相关静态资源总能从 `/vendor/pdfjs/...` 这个绝对路径拿到

这在仓库自带测试壳里可以成立，因为 [`tests/tests.html`](/Users/dev/workspace2/hc_apps/foliate-js/tests/tests.html) 手动提供了 import map。  
但一旦把 `foliate-js` 作为本地依赖接进 `Vite` 应用，这个假设就会立刻崩掉。`Vite/esbuild` 会把 `@pdfjs/pdf.min.mjs` 当成普通裸模块去解析，然后直接失败。

## 主要目标

- 去掉 `pdf.js` 对 import map 的硬依赖
- 让 `pdf.js` 自己能定位 `vendor/pdfjs/` 里的产物
- 让它更适合被 `Vite` 之类的打包/预构建工具消费

## 改动概览

1. 把：

```js
import '@pdfjs/pdf.min.mjs'
```

改成：

```js
import './vendor/pdfjs/pdf.mjs'
```

这样模块解析就不再依赖外部 import map，而是直接走仓库内部的相对路径。

2. 把：

```js
const pdfjsPath = path => `/vendor/pdfjs/${path}`
```

改成：

```js
const pdfjsPath = path => new URL(`./vendor/pdfjs/${path}`, import.meta.url).href
```

这样 worker、cmaps、standard fonts、CSS 等资源路径都改成了**基于模块位置自动推导**，而不是硬编码站点根目录。

## 关键知识

### 1. `import map` 适合页面壳，不适合作为库的默认前提

import map 很适合 demo 页面、实验页面、裸浏览器运行环境。  
但如果一个库的公共入口默认依赖 import map，接到 `Vite`、`Webpack`、`esbuild` 时就很容易炸。

原因是这些工具会把：

- `@pdfjs/pdf.min.mjs`

当成普通包名或裸模块 specifier 去解析，而不是自动帮你补 import map。

所以如果目标是“让库更通用”，通常更稳的做法是：

- 库内部尽量用相对路径或明确 exports
- 把 import map 留给 demo/test 壳，而不是留给核心入口

### 2. `import.meta.url` 很适合做“跟着模块走”的静态资源定位

以前那种：

```js
'/vendor/pdfjs/...'
```

本质上是假设资源一定挂在站点根目录。  
这在应用里很脆弱，因为：

- 部署路径可能不是根目录
- 依赖可能被放进 `node_modules`
- bundler/dev server 可能会重写资源路径

而：

```js
new URL('./vendor/pdfjs/pdf.worker.mjs', import.meta.url).href
```

表达的是：

- “这个资源就在当前模块旁边”

这对 ESM 和 bundler 都更友好，也更适合库代码。

## 补充知识

- 这次没有重建 `vendor/pdfjs/`，因为问题不在产物本身，而在**入口如何引用这些产物**。
- `tests/tests.html` 里的 import map 目前即使还在，也不会再是 `pdf.js` 正常工作的必要条件。

## 验证

- `pnpm -C /Users/dev/workspace2/hc_apps/br1 check`（PASS）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 exec vite optimize --force`（PASS）

## 未覆盖项

- 还没有把 `tests/tests.html` 和 `tests/phase0-auto-benchmark.html` 里的旧 `@pdfjs/...` import map 清理掉，它们现在只是冗余配置。
- 这次修的是模块解析和资产定位，不涉及 PDF 渲染性能或 `pdfjs-dist` 版本升级。
