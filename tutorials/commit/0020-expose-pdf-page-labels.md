# 0020：暴露 PDF 文档页码标签

## 背景

PDF 的 PageLabels 可以把前言标为 `i`、`ii`，并让正文重新从 `1` 开始。过去 foliate 只有物理页索引，宿主无法同时显示参考页码和完整物理页数。

## 改动

- 读取 `pdf.getPageLabels()`，只在至少一个标签不同于默认物理页码时创建 `book.pageList`。
- 每个条目保留显示标签、零基物理索引和数字 JSON href。
- `resolveHref` 与 `splitTOCHref` 直接识别数字页目标，不把它误当 PDF destination 数组。
- 默认数字标签或读取失败时保持 `pageList = null`，由宿主继续使用原有物理页导航。

## 两个知识点

1. PageLabels 是展示层编号，不改变 PDF 的物理页顺序；因此条目必须同时携带 label 和 index。
2. 数字索引已经足够定位页面，继续调用 `getPageIndex(dest[0])` 会把数字错误地按 destination 结构解析。

## 验证

- `node --check pdf.js`：PASS
- `node --test tests/pdf-page-labels.test.mjs`：PASS（2/2）
- `git diff --check`：PASS

## 未包含

- PDF 文字断行重建与跨页选择，由 br1 宿主层负责
- br1 宿主的物理 Tauri WebView 人工拖选验收
