# 0019：让 PDF 文本层抵消系统字体缩放

## 背景

Readest 提交 `2a837cb50` 对应嵌套 foliate-js 提交 `7c9cc45b`。系统 accessibility 字体设置会放大 WebView 中的透明 PDF 文本层，却不会放大 canvas 位图，导致选择框与页面文字错位。

## 改动

- 在统一 PDF `render()` 路径用 100px 隐藏文字探针测量系统字体倍率。
- text layer 完成异步渲染且仍属于当前 generation 后，仅从 `--text-scale-factor` 除去该倍率。
- 比例回到 1 时删除旧覆盖值，避免同一 iframe 重渲染后保留过期补偿。
- canvas 尺寸、文字位置和 annotation 坐标不变。

## 两个知识点

1. 系统字体设置只改变 glyph 的字体大小，PDF text layer 的百分比位置仍由 `--total-scale-factor` 决定，因此只能修正字体变量。
2. text layer 会异步重建；补偿必须放在 `await textLayer.render()` 与 generation 检查之后，否则可能写到已过期页面。

## 验证

- `pnpm test:pdf-text-scale`：PASS（2/2）
- br1 字体缩放与选择范围浏览器回归：PASS
- `node --check pdf.js`：PASS
- `git diff --check`：PASS

## 未包含

- 修改操作系统 accessibility 字体设置的自动化
- 移动端 canvas 内存上限
- PDF 导航、复制或跨页选择行为
