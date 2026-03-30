## 背景

`br1` 在 Tauri + Vite 开发模式下打不开 PDF，但 `Readest` 可以。继续往下追后，问题并不在 `pdf.worker` 本身，而是在 `foliate-js/pdf.js` 模块刚加载时，Vite 已经把 fallback 里的 vendor 路径预处理歪了。

## 主要目标

- 修掉 `foliate-js/pdf.js` 在 Vite 源码模式下触发的错误 vendor 加载链
- 保留 `host /vendor/pdfjs` 优先、bundled vendor 兜底 的两层策略

## 改动概览

- 把 `bundledPdfjsPath` 从顶层 `new URL('./vendor/pdfjs/...', import.meta.url)` 改成运行时字符串基址
- fallback 分支不再 `import('./vendor/pdfjs/pdf.mjs')`
- 改成 `import(/* @vite-ignore */ bundledPdfjsPath('pdf.mjs'))`
- 保留 `GlobalWorkerOptions.workerSrc`，并删掉之前多余的 `workerPort` / fake-worker 预加载逻辑

## 关键知识

### 1. `new URL('./asset', import.meta.url)` 在 Vite 里不只是普通运行时代码

当这段写在顶层时，Vite 往往会把它当成静态资产入口来预处理。  
这对普通图片很方便，但对 `pdf.mjs` 这种“本身还是一个模块、还带 source map”的文件很危险，因为它会被转成 `...?url` 形式，后面再顺着 map 拉出一条完全不同的资源链。

### 2. `@vite-ignore` 只有在真正的动态 `import(url)` 上才有意义

如果模块在顶层已经被 Vite 静态扫描进依赖图，再往后加 `@vite-ignore` 也救不回来。  
所以要先避免“顶层静态 URL 被预处理”，再让 fallback 的 import 走运行时绝对 URL。

## 补充知识

- 这次抓到根因的关键，不是看最终报错文本，而是看 `Performance` 里的新资源列表：里面出现了 `pdf.mjs.map?import&url`，这基本就说明问题出在 bundler 对模块资产的错误重写。

## 验证

- `bash /Users/dev/workspace2/hc_apps/br1/scripts/automation/test-tauri-webdriver.sh "pnpm -C /Users/dev/workspace2/hc_apps/br1 exec wdio run /Users/dev/workspace2/hc_apps/br1/wdio.conf.ts --spec /Users/dev/workspace2/hc_apps/br1/.tmp-direct-foliate-import.e2e.ts"` (PASS)

## 未覆盖项

- 这次没有给 `foliate-js` 自己新增正式测试文件，验证仍然借助了 `br1` 的桌面 WDIO 探针
- 这次没有处理 `pdf.js` 以外的其它格式加载路径
