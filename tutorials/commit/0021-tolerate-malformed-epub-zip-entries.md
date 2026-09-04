# 0021 - 容忍 EPUB ZIP 头与路径大小写错误

## 背景

`S2-R04A1` 对齐 Readest 提交 `234ecc311` 和 `c30a59a9e`。部分可被 ZIP central directory 正确读取的 EPUB，首个 local header 第四字节并不是标准的 `0x04`；另一些 EPUB 的 OPF 路径大小写与 ZIP entry 不一致。旧实现会在进入 ZipReader 前拒绝前一种文件，也只支持精确路径查找。

## 改动

- ZIP 初筛只检查 `PK\x03`，把最终归档合法性继续交给现有 ZipReader。
- ZIP entry 始终优先精确路径。
- 仅当小写路径对应唯一 entry 时才执行大小写回退。
- 大小写折叠后发生冲突时返回未找到，避免任意读取错误章节。
- 新增真实 ZipWriter/ZipReader 回归，覆盖异常 local header、普通非 ZIP、精确匹配、唯一回退和冲突拒绝。

## 两个知识点

1. 文件签名初筛只负责路由，不负责完整验证。放宽一字节后，归档结构仍由 ZipReader 校验，因此不需要再写一套 ZIP parser。
2. 大小写容错必须保留确定性。精确路径是作者声明的首选；只有折叠后唯一时才能回退，否则同一请求会随 entry 顺序读到不同内容。

## 验证

- `node --test tests/view-zip-loader.test.mjs`：PASS（6/6，包括实际读取异常 header 后的 entry）
- `git diff --check`：PASS
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 check`：PASS（0 errors, 0 warnings）
- `pnpm -C /Users/dev/workspace2/hc_apps/br1 build`：PASS
- `npm run build`：FAIL；当前 ignored `node_modules` 的 `@zip.js/zip.js 2.9.0` 已移除旧 Rollup 入口，且 `npm ci` 被仓库既有的 `package.json` / `package-lock.json` PDF.js 版本不一致阻塞

## 证据边界

br1 的真实生产构建会直接打包 sibling foliate 源码并已通过；foliate 自身独立 vendor build 的锁文件/安装状态仍需单独维护。本切片只处理 ZIP 容器探测和 entry 查找，不包含 OPF 裸 `&`、百分号路径、未声明封面、MOBI/AZW3 并发读取或 CBZ 章节排序；这些留给后续 `S2-R04A` 子任务。
