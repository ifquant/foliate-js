# 0013：保留连续滚动 PDF 的页内位置

## 背景

Readest 提交 `dab92c8a4` 只更新了 `packages/foliate-js` 的 gitlink。继续解析后，对应 foliate-js 变化是 `2204a28..9f12ba9`：PDF 页面真实尺寸落地或滚动布局 resize 时，旧实现只保存页编号，再调用 `scrollIntoView()`，因此阅读位置会跳回该页顶部。

## 改动

- 重排前记录当前页索引、页内 fraction 和原始 `scrollTop`。
- 页面真实尺寸落地后恢复同一页的 fraction。
- 整组滚动页因缩放或容器变化而重排后使用同一恢复逻辑。
- 找不到原页面时退回旧 `scrollTop`，并统一限制到有效滚动范围。

## 两个知识点

1. 只保存“当前页”不等于保存阅读位置；长页还需要保存页内比例。
2. 锚点必须在尺寸变化前捕获、变化后恢复，否则读取到的是已经失真的几何信息。

## 验证

- `node --check fixed-layout.js`：PASS
- br1 真实 PDF 连续滚动加载/resize 回归：PASS（重复运行 3/3）
- br1 `pnpm build`：PASS
- `npm ci`：FAIL，既有 `package-lock.json` 的 PDF.js 版本与 `package.json` 不一致
- `npm run build`：FAIL，无锁安装当前依赖后，既有 Rollup 配置引用的 `@zip.js` 文件路径不存在

## 未包含

- 分数 DPR 页缝、滚轮与 pinch 手势
- 连续滚动 PDF 高亮重建
- foliate-js 锁文件和 Rollup vendor 路径修复；它们是既有独立维护项，不混入本提交
