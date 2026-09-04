# 0022 - 修复 EPUB 包引用兼容性

## 背景

`S2-R04A2` 对齐 Readest 的三个嵌套 foliate 修复：OPF 中未转义的 `&`、需要百分号解码的 ZIP entry 名称，以及 manifest 未声明的封面。修复继续放在 foliate 的 EPUB 解析链里，br1 不增加第二套格式解析器。

## 改动

- 保留合法命名实体与十进制/十六进制数字实体，只转义裸 ampersand。
- URL 路径解码普通百分号字符，同时让 `%2F` 和 `%23` 保持字面量，避免把 entry 名变成路径层级或 fragment。
- 外部基址继续交给原生 `URL` 解析。
- manifest 解析后立即排除缺失 `href` 的不可加载条目，避免 Loader 后续把它当成 `OPS/null` 或在资源替换时解引用 `null`。
- manifest 没有声明封面时，按 ZIP central-directory 顺序选择首个 `cover` / `couv` 图片，并补充 SVG MIME。

## 两个知识点

1. 百分号解码不能把路径分隔符和 fragment 分隔符一起解开。先保护 `%2F` 与 `%23`，再调用平台解码器，可以复用标准行为而不改变 ZIP entry 的结构。
2. 非法资源应在共享清单入口被丢弃。只在 spine 处跳过缺失 `href`，仍会让 Loader 的 CSS/脚本资源替换遍历到坏条目；入口过滤能一次保护所有消费者。

## 验证

- `node --check epub.js`：PASS
- `node --test tests/view-zip-loader.test.mjs`：PASS（6/6）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 exec playwright test tests/e2e/foliate-zip-compat.spec.ts --workers=1`：PASS（5/5）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 check`：PASS（0 errors, 0 warnings）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 build`：PASS
- 两个仓库 `git diff --check`：PASS
- Terra high 修复复审：PASS（无 findings）
- Sol high 架构审查：PASS（无 findings）

## 证据边界

br1 的生产构建直接打包 sibling foliate 源码并已通过，浏览器 fixture 覆盖真实 `makeBook`、`section.load()`、资源替换和 `getCover()`。本轮没有执行打包后的 Tauri/WebView 手工打开。foliate 独立 `npm run build` 未重跑；该路径仍受既有 ignored `node_modules` 中 Zip.js 入口漂移及 PDF.js manifest/lockfile 不一致阻塞。MOBI/AZW3 并发与 CBZ 排序留给 `S2-R04A3`。
