# 0023 - 稳定 MOBI/AZW3 与 CBZ 归档读取

## 背景

`S2-R04A3` 对齐 Readest 嵌套 foliate 提交 `a7ecb05`、`4735c0a` 和 `ca3f118`。三个问题都属于格式引擎：MOBI6 的非 void 自闭合标签会改变后续 DOM 结构；CBZ 整串字典序会让分卷目录倒置；KF8 的共享原始字节累加器会被重叠章节加载交错写入。

## 改动

- MOBI6 在交给 `DOMParser` 前，将已观察到的无属性 `<a/>`、`<div/>`、`<span/>`、`<p/>` 改写成显式闭合标签。
- CBZ 按 `/` 分段并使用 numeric collator 比较，使基础目录先于 `(2)`、`(3)`、`(10)`，同时让 `2.jpg` 先于 `10.jpg`。
- KF8 用一个 promise chain 串行化 `loadRaw`，保护 `rawHead` / `rawTail` 及 record index 的共同可变状态。
- 某次读取失败只向该调用者返回错误，内部队列转换为已处理状态，使后续读取仍能继续。

## 两个知识点

1. KF8 的 byte offset 依赖前面所有解压记录的顺序。并发读取不是单纯的 cache race；任何一次交错 append 都会让之后的正文、UTF-8 边界和 TOC fragment 一起偏移。
2. 归档路径的自然顺序必须按 segment 比较。把完整路径当字符串时，空格会排在 `/` 前面，因此 `Chapter 0060 (2)` 会错误地先于基础目录 `Chapter 0060`。

## 验证

- `node --check mobi.js`：PASS
- `node --check comic-book.js`：PASS
- `node --test tests/view-zip-loader.test.mjs`：PASS（6/6）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 exec playwright test tests/e2e/foliate-mobi-cbz-compat.spec.ts --workers=1`：PASS（3/3）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 check`：PASS（0 errors, 0 warnings）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 build`：PASS
- 两个仓库 `git diff --check`：PASS
- 任务级与架构所有权复审：PASS（无 findings）

## 证据边界

KF8 使用 Readest #5918 的 84,908-byte fixture 和确定性乱序 File，在 Chromium 中证明 serial/overlapping section text 完全一致；没有执行打包后的 Tauri 手工阅读。MOBI6 是生产 helper 加静态调用链证明，不是二进制 MOBI6 fixture。Readest 的 `RemoteFile.fetchRange` inclusive-end 修复不适用，因为 br1 将本地完整字节构造成原生 `File`，没有远程 range cache。foliate 独立 `npm run build` 未重跑，既有依赖安装阻塞仍保持不变。
